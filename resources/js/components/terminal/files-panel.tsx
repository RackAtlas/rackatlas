import {
    ArrowUp,
    Download,
    Eye,
    EyeOff,
    File as FileIcon,
    Folder,
    Loader2,
    RefreshCw,
    TriangleAlert,
    Upload,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { TransferError } from '@/lib/terminal-files';
import type { FileClient, FileEntry } from '@/lib/terminal-files';
import { cn } from '@/lib/utils';

type Transfer = {
    id: number;
    name: string;
    direction: 'upload' | 'download';
    done: number;
    total: number;
    status: 'running' | 'done' | 'error' | 'exists';
    message?: string;
    file?: File;
    dir?: string;
    abort: AbortController;
};

type Props = {
    getClient: () => FileClient | null;
    /** Files dropped on the terminal: they go to the folder shown here. `id` makes every drop a new one. */
    incoming: { id: number; files: File[] } | null;
    onClose: () => void;
};

const UNITS = ['B', 'KB', 'MB', 'GB'];

export function formatSize(bytes: number): string {
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
}

const joinPath = (dir: string, name: string) =>
    `${dir.replace(/\/+$/, '')}/${name}`;

/**
 * A small file browser on the server of the active terminal: look around, click a file to download it, drop
 * files on it (or on the terminal) to upload them. Works for servers the bridge reaches over SSH.
 */
export default function FilesPanel({ getClient, incoming, onClose }: Props) {
    const { t } = useTranslation();
    const [path, setPath] = useState<string | null>(null);
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showHidden, setShowHidden] = useState(false);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [dragging, setDragging] = useState(false);
    const nextId = useRef(1);
    const pathRef = useRef<string | null>(null);
    const picker = useRef<HTMLInputElement>(null);
    const handledDrop = useRef(0);

    pathRef.current = path;

    const load = useCallback(
        async (target: string) => {
            const client = getClient();

            if (client === null) {
                setError(t('The terminal is not connected.'));
                setLoading(false);

                return;
            }

            setLoading(true);
            setError(null);

            try {
                const listing = await client.list(target);

                setPath(listing.path);
                setEntries(listing.entries);
                setTruncated(listing.truncated);
            } catch (failure) {
                setError(
                    failure instanceof TransferError &&
                        failure.code === 'closed'
                        ? t('The terminal is not connected.')
                        : t('The folder could not be opened.'),
                );
            } finally {
                setLoading(false);
            }
        },
        [getClient, t],
    );

    useEffect(() => {
        void load('');
    }, [load]);

    const patch = (id: number, changes: Partial<Transfer>) =>
        setTransfers((current) =>
            current.map((item) =>
                item.id === id ? { ...item, ...changes } : item,
            ),
        );

    const fail = (id: number, failure: unknown) => {
        const code = failure instanceof TransferError ? failure.code : 'failed';

        if (code === 'aborted') {
            setTransfers((current) => current.filter((item) => item.id !== id));

            return;
        }

        patch(id, {
            status: code === 'exists' ? 'exists' : 'error',
            message:
                code === 'too-large'
                    ? t('The file is too large.')
                    : failure instanceof Error
                      ? failure.message
                      : t('The transfer failed.'),
        });
    };

    const upload = async (
        file: File,
        dir: string,
        overwrite: boolean,
        existingId?: number,
    ) => {
        const client = getClient();
        const id = existingId ?? nextId.current++;
        const abort = new AbortController();
        const entry: Transfer = {
            id,
            name: file.name,
            direction: 'upload',
            done: 0,
            total: file.size,
            status: 'running',
            file,
            dir,
            abort,
        };

        setTransfers((current) =>
            existingId === undefined
                ? [entry, ...current]
                : current.map((item) => (item.id === id ? entry : item)),
        );

        if (client === null) {
            return fail(
                id,
                new TransferError(
                    'closed',
                    t('The terminal is not connected.'),
                ),
            );
        }

        try {
            await client.upload(file, dir, {
                overwrite,
                signal: abort.signal,
                onProgress: (done, total) => patch(id, { done, total }),
            });
            patch(id, { status: 'done', done: file.size });

            if (pathRef.current === dir) {
                void load(dir);
            }
        } catch (failure) {
            fail(id, failure);
        }
    };

    const download = async (name: string) => {
        const client = getClient();
        const id = nextId.current++;
        const abort = new AbortController();

        setTransfers((current) => [
            {
                id,
                name,
                direction: 'download',
                done: 0,
                total: 0,
                status: 'running',
                abort,
            },
            ...current,
        ]);

        try {
            if (client === null || path === null) {
                throw new TransferError(
                    'closed',
                    t('The terminal is not connected.'),
                );
            }

            await client.download(
                joinPath(path, name),
                (done, total) => patch(id, { done, total }),
                abort.signal,
            );
            patch(id, { status: 'done' });
        } catch (failure) {
            fail(id, failure);
        }
    };

    const uploadAll = (files: File[]) => {
        if (path === null) {
            return;
        }

        files.forEach((file) => void upload(file, path, false));
    };

    useEffect(() => {
        if (
            incoming !== null &&
            path !== null &&
            incoming.id !== handledDrop.current
        ) {
            handledDrop.current = incoming.id;
            uploadAll(incoming.files);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incoming, path]);

    const visible = useMemo(
        () =>
            entries
                .filter((entry) => showHidden || !entry.name.startsWith('.'))
                .sort(
                    (a, b) =>
                        Number(b.dir) - Number(a.dir) ||
                        a.name.localeCompare(b.name),
                ),
        [entries, showHidden],
    );

    const segments = (path ?? '').split('/').filter(Boolean);
    const parent =
        segments.length > 0 ? `/${segments.slice(0, -1).join('/')}` : null;

    return (
        <div
            className={cn(
                'relative flex h-full min-h-0 flex-col',
                dragging && 'bg-primary/5',
            )}
            onDragOver={(event) => {
                if (event.dataTransfer.types.includes('Files')) {
                    event.preventDefault();
                    setDragging(true);
                }
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                uploadAll([...event.dataTransfer.files]);
            }}
        >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
                <h2 className="text-sm font-semibold">{t('Files')}</h2>
                <div className="flex items-center gap-0.5">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={t('Upload files')}
                        title={t('Upload files')}
                        disabled={path === null}
                        onClick={() => picker.current?.click()}
                    >
                        <Upload className="size-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={
                            showHidden
                                ? t('Hide hidden files')
                                : t('Show hidden files')
                        }
                        title={
                            showHidden
                                ? t('Hide hidden files')
                                : t('Show hidden files')
                        }
                        aria-pressed={showHidden}
                        onClick={() => setShowHidden(!showHidden)}
                    >
                        {showHidden ? (
                            <Eye className="size-4" />
                        ) : (
                            <EyeOff className="size-4" />
                        )}
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={t('Refresh')}
                        title={t('Refresh')}
                        onClick={() => void load(path ?? '')}
                    >
                        <RefreshCw
                            className={cn('size-4', loading && 'animate-spin')}
                        />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={t('Close')}
                        onClick={onClose}
                    >
                        <X className="size-4" />
                    </Button>
                </div>
                <input
                    ref={picker}
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => {
                        uploadAll([...(event.target.files ?? [])]);
                        event.target.value = '';
                    }}
                />
            </div>

            <nav
                aria-label={t('Folder')}
                className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b px-2 py-1.5 font-mono text-xs"
            >
                <button
                    type="button"
                    aria-label={t('Up one folder')}
                    title={t('Up one folder')}
                    disabled={parent === null || loading}
                    onClick={() => parent !== null && void load(parent)}
                    className="mr-1 rounded p-1 hover:bg-accent disabled:opacity-40"
                >
                    <ArrowUp className="size-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => void load('/')}
                    className="rounded px-1 py-0.5 hover:bg-accent"
                >
                    /
                </button>
                {segments.map((segment, index) => (
                    <span key={index} className="flex items-center">
                        <button
                            type="button"
                            onClick={() =>
                                void load(
                                    `/${segments.slice(0, index + 1).join('/')}`,
                                )
                            }
                            className="max-w-32 truncate rounded px-1 py-0.5 hover:bg-accent"
                        >
                            {segment}
                        </button>
                        {index < segments.length - 1 && (
                            <span className="text-muted-foreground">/</span>
                        )}
                    </span>
                ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {loading && entries.length === 0 && (
                    <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        {t('Loading…')}
                    </div>
                )}

                {error && (
                    <div className="m-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                        {error}
                    </div>
                )}

                {!error && !loading && visible.length === 0 && (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                        {t(
                            'This folder is empty. Drop files here to upload them.',
                        )}
                    </p>
                )}

                <ul>
                    {visible.map((entry) => (
                        <li key={entry.name}>
                            <button
                                type="button"
                                onClick={() =>
                                    entry.dir
                                        ? void load(
                                              joinPath(path ?? '', entry.name),
                                          )
                                        : void download(entry.name)
                                }
                                title={entry.dir ? undefined : t('Download')}
                                className="group flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                            >
                                {entry.dir ? (
                                    <Folder className="size-4 shrink-0 text-sky-500" />
                                ) : (
                                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    {entry.name}
                                </span>
                                {entry.dir ? null : (
                                    <>
                                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                            {formatSize(entry.size)}
                                        </span>
                                        <Download className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 max-lg:opacity-100" />
                                    </>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>

                {truncated && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                        {t('Only the first 2000 items are shown.')}
                    </p>
                )}
            </div>

            {transfers.length > 0 && (
                <div className="max-h-48 shrink-0 space-y-1.5 overflow-y-auto border-t bg-muted/30 p-2">
                    {transfers.map((transfer) => {
                        const percent =
                            transfer.total > 0
                                ? Math.min(
                                      100,
                                      Math.round(
                                          (transfer.done / transfer.total) *
                                              100,
                                      ),
                                  )
                                : transfer.status === 'done'
                                  ? 100
                                  : 0;

                        return (
                            <div
                                key={transfer.id}
                                className="rounded-md border bg-background px-2 py-1.5 text-xs"
                            >
                                <div className="flex items-center gap-1.5">
                                    {transfer.direction === 'upload' ? (
                                        <Upload className="size-3 shrink-0" />
                                    ) : (
                                        <Download className="size-3 shrink-0" />
                                    )}
                                    <span className="min-w-0 flex-1 truncate">
                                        {transfer.name}
                                    </span>
                                    {transfer.status === 'running' && (
                                        <>
                                            <span className="text-muted-foreground tabular-nums">
                                                {percent}%
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={t('Cancel')}
                                                onClick={() =>
                                                    transfer.abort.abort()
                                                }
                                                className="rounded p-0.5 hover:bg-accent"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </>
                                    )}
                                    {transfer.status === 'done' && (
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                            {t('Done')}
                                        </span>
                                    )}
                                    {(transfer.status === 'done' ||
                                        transfer.status === 'error') && (
                                        <button
                                            type="button"
                                            aria-label={t('Dismiss')}
                                            onClick={() =>
                                                setTransfers((current) =>
                                                    current.filter(
                                                        (item) =>
                                                            item.id !==
                                                            transfer.id,
                                                    ),
                                                )
                                            }
                                            className="rounded p-0.5 hover:bg-accent"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    )}
                                </div>
                                {transfer.status === 'running' && (
                                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full bg-primary transition-[width]"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                )}
                                {transfer.status === 'error' && (
                                    <p className="mt-1 text-destructive">
                                        {transfer.message}
                                    </p>
                                )}
                                {transfer.status === 'exists' &&
                                    transfer.file &&
                                    transfer.dir && (
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <span className="text-amber-600 dark:text-amber-400">
                                                {t(
                                                    'A file with this name already exists.',
                                                )}
                                            </span>
                                            <div className="flex shrink-0 gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-6 px-2 text-xs"
                                                    onClick={() =>
                                                        void upload(
                                                            transfer.file!,
                                                            transfer.dir!,
                                                            true,
                                                            transfer.id,
                                                        )
                                                    }
                                                >
                                                    {t('Replace')}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-xs"
                                                    onClick={() =>
                                                        setTransfers(
                                                            (current) =>
                                                                current.filter(
                                                                    (item) =>
                                                                        item.id !==
                                                                        transfer.id,
                                                                ),
                                                        )
                                                    }
                                                >
                                                    {t('Skip')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        );
                    })}
                </div>
            )}

            {dragging && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-primary bg-background/80 text-sm font-medium">
                    {t('Drop to upload to this folder')}
                </div>
            )}
        </div>
    );
}
