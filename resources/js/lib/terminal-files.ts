/**
 * Files and session history over the terminal WebSocket (ssh servers only). The bridge does the work over SFTP;
 * this is the browser side of the small request/response protocol described in resources/terminal/server.mjs.
 */

export type FileEntry = {
    name: string;
    dir: boolean;
    size: number;
    mtime: number;
};

export type Listing = {
    path: string;
    entries: FileEntry[];
    truncated: boolean;
};

/** `code` tells the UI what happened: exists, too-large, directory, name, busy, closed, aborted, unsupported, failed. */
export class TransferError extends Error {
    constructor(
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

/** How frames get to the bridge. */
export type FileTransport = {
    /** Throws a TransferError('closed') when there is no connection. */
    send: (frame: Record<string, unknown>) => void;
};

export type FileClient = {
    list: (path: string) => Promise<Listing>;
    download: (
        path: string,
        onProgress: (done: number, total: number) => void,
        signal?: AbortSignal,
    ) => Promise<void>;
    upload: (
        file: File,
        dir: string,
        options: {
            overwrite: boolean;
            onProgress: (done: number, total: number) => void;
            signal?: AbortSignal;
        },
    ) => Promise<string>;
    history: () => Promise<string>;
    /** Called with every JSON frame that carries a request id. */
    handle: (message: Record<string, unknown>) => void;
    /** The connection is gone: everything that waits fails. */
    close: () => void;
};

const CHUNK = 96 * 1024;

type Frame = Record<string, any>;

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    const step = 0x8000;

    for (let index = 0; index < bytes.length; index += step) {
        binary += String.fromCharCode(...bytes.subarray(index, index + step));
    }

    return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function saveBlob(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function createFileClient(transport: FileTransport): FileClient {
    let next = 1;
    const channels = new Map<number, (frame: Frame) => void>();

    const send = (frame: Frame) => transport.send(frame);

    /** A request id with a queue of the frames that come back for it. */
    const channel = () => {
        const rid = next++;
        const queue: Frame[] = [];
        let waiting: ((frame: Frame) => void) | null = null;

        channels.set(rid, (frame) => {
            if (waiting) {
                const resolve = waiting;

                waiting = null;
                resolve(frame);
            } else {
                queue.push(frame);
            }
        });

        return {
            rid,
            /** The next frame, or an error when the bridge reports one. */
            next: async (): Promise<Frame> => {
                const frame =
                    queue.shift() ??
                    (await new Promise<Frame>((resolve) => {
                        waiting = resolve;
                    }));

                if (frame.t === "fs-error") {
                    throw new TransferError(
                        String(frame.code ?? "failed"),
                        String(frame.message ?? "The transfer failed."),
                    );
                }

                return frame;
            },
            release: () => channels.delete(rid),
        };
    };

    const onAbort = (rid: number, signal?: AbortSignal) => {
        const abort = () => {
            try {
                send({ t: "cancel", rid });
            } catch {
                // The connection is gone anyway.
            }

            channels.get(rid)?.({
                t: "fs-error",
                code: "aborted",
                message: "Cancelled.",
            });
        };

        signal?.addEventListener("abort", abort, { once: true });

        return () => signal?.removeEventListener("abort", abort);
    };

    return {
        async list(path) {
            const request = channel();

            try {
                send({ t: "ls", rid: request.rid, path });
                const frame = await request.next();

                return {
                    path: frame.path,
                    entries: frame.entries,
                    truncated: Boolean(frame.truncated),
                };
            } finally {
                request.release();
            }
        },

        async history() {
            const request = channel();

            try {
                send({ t: "cap", rid: request.rid });

                return String((await request.next()).text ?? "");
            } finally {
                request.release();
            }
        },

        async download(path, onProgress, signal) {
            const request = channel();
            const stopWatching = onAbort(request.rid, signal);
            const parts: Uint8Array<ArrayBuffer>[] = [];
            let done = 0;
            let name = path.split("/").pop() || "download";

            try {
                send({ t: "get", rid: request.rid, path });

                for (;;) {
                    const frame = await request.next();

                    if (frame.last) {
                        break;
                    }

                    name = frame.name ?? name;

                    const bytes = fromBase64(frame.data);

                    parts.push(bytes);
                    done += bytes.length;
                    onProgress(done, Number(frame.size) || done);
                }

                saveBlob(new Blob(parts), name);
            } finally {
                stopWatching();
                request.release();
            }
        },

        async upload(file, dir, { overwrite, onProgress, signal }) {
            const request = channel();
            const stopWatching = onAbort(request.rid, signal);

            try {
                send({
                    t: "put",
                    rid: request.rid,
                    path: dir,
                    name: file.name,
                    size: file.size,
                    overwrite,
                });

                const ready = await request.next();
                let sent = 0;

                while (sent < file.size) {
                    const slice = file.slice(sent, sent + CHUNK);
                    const bytes = new Uint8Array(await slice.arrayBuffer());

                    send({
                        t: "chunk",
                        rid: request.rid,
                        data: toBase64(bytes),
                    });
                    await request.next();
                    sent += bytes.length;
                    onProgress(sent, file.size);
                }

                send({ t: "done", rid: request.rid });
                await request.next();
                onProgress(file.size, file.size);

                return String(ready.path ?? file.name);
            } catch (error) {
                if (!(error instanceof TransferError)) {
                    throw error;
                }

                if (error.code !== "aborted") {
                    try {
                        send({ t: "cancel", rid: request.rid });
                    } catch {
                        // Nothing to cancel.
                    }
                }

                throw error;
            } finally {
                stopWatching();
                request.release();
            }
        },

        handle(message) {
            const rid = Number(message.rid);

            if (Number.isFinite(rid)) {
                channels.get(rid)?.(message);
            }
        },

        close() {
            for (const deliver of channels.values()) {
                deliver({
                    t: "fs-error",
                    code: "closed",
                    message: "The connection is closed.",
                });
            }
        },
    };
}
