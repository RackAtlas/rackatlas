import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import {
    CaseSensitive,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    TriangleAlert,
    X,
} from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import TerminalSessionController from '@/actions/App/Http/Controllers/Terminal/TerminalSessionController';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import {
    beginHandshake,
    pinFingerprint,
    pinnedFingerprint,
} from '@/lib/terminal-e2e';
import type { Handshake, KeyReply, SecureChannel } from '@/lib/terminal-e2e';
import { TransferError, createFileClient } from '@/lib/terminal-files';
import type { FileClient } from '@/lib/terminal-files';

export type TerminalState = 'connecting' | 'ready' | 'closed' | 'error';

/** What the bridge reports once the shell is open. */
export type TerminalInfo = {
    /** The shell runs in tmux on the server and survives a lost connection. */
    persistent: boolean;
    /** The bridge can move files over SFTP (ssh servers only). */
    files: boolean;
};

export type TerminalHandle = {
    clear: () => void;
    focus: () => void;
    copySelection: () => Promise<boolean>;
    openSearch: () => void;
    /** Types into the shell like the keyboard does, without telling `onTyped`. */
    sendInput: (data: string) => void;
    /** All the text in the scrollback and on the screen. */
    getText: () => string;
    /** The whole history kept by tmux on the server, or null when the session is not kept there. */
    getHistory: () => Promise<string | null>;
    /** Ends the shell for good (also the tmux session behind it) before the tab goes away. */
    end: () => void;
    getFiles: () => FileClient | null;
};

type Props = {
    serverId: number;
    /** Names the shell kept on the server, so a reconnect or a reload finds the same one. */
    sessionKey: string;
    /** Ask the bridge to keep the shell running on the server (tmux). */
    persist: boolean;
    active: boolean;
    fontSize: number;
    onState: (state: TerminalState, message?: string) => void;
    onInfo?: (info: TerminalInfo) => void;
    /** Everything the user types, so another terminal can get it too. */
    onTyped?: (data: string) => void;
    ref?: Ref<TerminalHandle>;
};

const THEME = {
    background: '#0c0e12',
    foreground: '#d4d8e0',
    cursor: '#e2e8f0',
    cursorAccent: '#0c0e12',
    selectionBackground: '#334155aa',
    black: '#1e2229',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#fbbf24',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: '#d4d8e0',
    brightBlack: '#64748b',
    brightRed: '#fca5a5',
    brightGreen: '#86efac',
    brightYellow: '#fde68a',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#67e8f9',
    brightWhite: '#f8fafc',
};

type IdentityPrompt = {
    fingerprint: string;
    previous: string | null;
    answer: (trusted: boolean) => void;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function csrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/** The keys a phone keyboard lacks. Sent to the shell as the escape sequences a real keyboard would produce. */
const EXTRA_KEYS: { label: string; data: string; name: string }[] = [
    { label: 'Esc', data: '\x1b', name: 'Escape' },
    { label: 'Tab', data: '\t', name: 'Tab' },
    { label: '↑', data: '\x1b[A', name: 'Arrow up' },
    { label: '↓', data: '\x1b[B', name: 'Arrow down' },
    { label: '←', data: '\x1b[D', name: 'Arrow left' },
    { label: '→', data: '\x1b[C', name: 'Arrow right' },
    { label: '|', data: '|', name: 'Pipe' },
    { label: '~', data: '~', name: 'Tilde' },
    { label: '/', data: '/', name: 'Slash' },
    { label: '-', data: '-', name: 'Dash' },
];

/** A phone or tablet: the keyboard is on the screen and has no Esc, Tab, Ctrl or arrows. */
const hasTouchKeyboard = (): boolean =>
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches;

/** Ctrl plus a letter or one of @[\\]^_ as the control character the shell expects, or null. */
function controlCharacter(data: string): string | null {
    if (data.length !== 1) {
        return null;
    }

    const code = data.toUpperCase().charCodeAt(0);

    return code >= 64 && code <= 95 ? String.fromCharCode(code - 64) : null;
}

/**
 * One terminal: asks the app for a one-time ticket, opens a WebSocket to the terminal server with it and
 * wires the keyboard and the screen to the SSH shell on the other side.
 */
export default function TerminalView({
    serverId,
    sessionKey,
    persist,
    active,
    fontSize,
    onState,
    onInfo,
    onTyped,
    ref,
}: Props) {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState<IdentityPrompt | null>(null);
    const [keyBar] = useState(hasTouchKeyboard);
    const [ctrl, setCtrl] = useState(false);
    const ctrlRef = useRef(false);
    ctrlRef.current = ctrl;
    const host = useRef<HTMLDivElement>(null);
    const term = useRef<Terminal | null>(null);
    const fit = useRef<FitAddon | null>(null);
    const onStateRef = useRef(onState);
    onStateRef.current = onState;
    const onInfoRef = useRef(onInfo);
    onInfoRef.current = onInfo;
    const onTypedRef = useRef(onTyped);
    onTypedRef.current = onTyped;
    const inputRef = useRef<(data: string) => void>(() => {});
    const endRef = useRef<() => void>(() => {});
    const filesRef = useRef<FileClient | null>(null);
    const persistentRef = useRef(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [matchCase, setMatchCase] = useState(false);
    const [position, setPosition] = useState({ current: 0, total: 0 });
    const searchInput = useRef<HTMLInputElement>(null);
    const searchState = useRef({ query: '', matchCase: false, cursor: -1 });
    const openSearchRef = useRef<() => void>(() => {});

    openSearchRef.current = () => {
        const selected = term.current?.getSelection() ?? '';

        if (selected !== '' && !selected.includes('\n')) {
            setQuery(selected);
        }

        setSearchOpen(true);
        requestAnimationFrame(() => {
            searchInput.current?.focus();
            searchInput.current?.select();
        });
    };

    /** Every place the text occurs in the buffer, one line of the screen at a time. */
    const findMatches = (text: string, sensitive: boolean) => {
        const buffer = term.current?.buffer.active;
        const found: { row: number; col: number; length: number }[] = [];

        if (!buffer || text === '') {
            return found;
        }

        const needle = sensitive ? text : text.toLowerCase();

        for (let row = 0; row < buffer.length; row++) {
            const raw = buffer.getLine(row)?.translateToString(true) ?? '';
            const line = sensitive ? raw : raw.toLowerCase();
            let from = line.indexOf(needle);

            while (from !== -1) {
                found.push({ row, col: from, length: needle.length });
                from = line.indexOf(needle, from + needle.length);
            }
        }

        // The newest match comes first: it is the nearest to the prompt, where people look first.
        return found.reverse();
    };

    /** Selects and scrolls to a match. `step` moves from the one shown now (1 = older), 0 starts from the newest. */
    const goToMatch = (step: 1 | -1 | 0) => {
        const terminal = term.current;
        const matches = findMatches(query, matchCase);

        if (!terminal || matches.length === 0) {
            terminal?.clearSelection();
            setPosition({ current: 0, total: 0 });
            searchState.current.cursor = -1;

            return;
        }

        const previous = searchState.current.cursor;
        const index =
            step === 0 || previous < 0
                ? 0
                : (previous + step + matches.length) % matches.length;

        searchState.current.cursor = index;

        const match = matches[index];

        terminal.select(match.col, match.row, match.length);
        terminal.scrollToLine(
            Math.max(0, match.row - Math.floor(terminal.rows / 2)),
        );
        setPosition({ current: index + 1, total: matches.length });
    };

    const closeSearch = () => {
        setSearchOpen(false);
        term.current?.clearSelection();
        searchState.current.cursor = -1;
        setPosition({ current: 0, total: 0 });
        term.current?.focus();
    };

    useEffect(() => {
        searchState.current = { query, matchCase, cursor: -1 };

        if (!searchOpen) {
            return;
        }

        const matches = findMatches(query, matchCase);

        if (matches.length === 0) {
            term.current?.clearSelection();
            setPosition({ current: 0, total: 0 });

            return;
        }

        goToMatch(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, matchCase, searchOpen]);

    useImperativeHandle(ref, () => ({
        openSearch: () => openSearchRef.current(),
        sendInput: (data: string) => inputRef.current(data),
        getText: () => {
            const buffer = term.current?.buffer.active;
            const lines: string[] = [];

            if (!buffer) {
                return '';
            }

            for (let row = 0; row < buffer.length; row++) {
                const line = buffer.getLine(row);
                const text = line?.translateToString(true) ?? '';

                if (line?.isWrapped && lines.length > 0) {
                    lines[lines.length - 1] += text;
                } else {
                    lines.push(text);
                }
            }

            return lines.join('\n').replace(/\s+$/, '');
        },
        getHistory: async () =>
            persistentRef.current && filesRef.current
                ? filesRef.current.history().catch(() => null)
                : null,
        end: () => endRef.current(),
        getFiles: () => filesRef.current,
        clear: () => term.current?.clear(),
        focus: () => term.current?.focus(),
        copySelection: async () => {
            const text = term.current?.getSelection() ?? '';

            if (text === '') {
                return false;
            }

            await navigator.clipboard.writeText(text);

            return true;
        },
    }));

    useEffect(() => {
        const element = host.current;

        if (element === null) {
            return;
        }

        const terminal = new Terminal({
            fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
            fontSize,
            lineHeight: 1.25,
            cursorBlink: true,
            scrollback: 5000,
            theme: THEME,
            allowProposedApi: true,
            macOptionClickForcesSelection: true,
        });
        const fitAddon = new FitAddon();

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(new WebLinksAddon());
        terminal.open(element);
        term.current = terminal;
        fit.current = fitAddon;

        let socket: WebSocket | null = null;
        let disposed = false;
        let finished = false;
        // Through the agent everything after the handshake is end-to-end encrypted.
        let secure = false;
        // Whether the next binary frame from the bridge belongs to the file channel (it announces itself with {"t":"f"}).
        let fileNext = false;
        let agentFiles = false;
        const files = createFileClient({
            get flowControl() {
                return secure;
            },
            send: (frame) => {
                if (socket?.readyState !== WebSocket.OPEN) {
                    throw new TransferError(
                        'closed',
                        'The connection is closed.',
                    );
                }

                if (!secure) {
                    socket.send(JSON.stringify(frame));

                    return;
                }

                if (channel === null) {
                    throw new TransferError(
                        'closed',
                        'The encrypted connection is not ready.',
                    );
                }

                // Encrypting is asynchronous, but the frames come out of it in the order they went in.
                channel.files
                    .encrypt(encoder.encode(JSON.stringify(frame)))
                    .then((encrypted) => {
                        if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ t: 'f' }));
                            socket.send(encrypted);
                        }
                    })
                    .catch(() => fail(t('The encrypted connection failed.')));
            },
        });

        filesRef.current = files;
        persistentRef.current = false;
        let handshake: Handshake | null = null;
        let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
        let channel: SecureChannel | null = null;
        let resolveChannel: (channel: SecureChannel) => void = () => {};
        const channelReady = new Promise<SecureChannel>((resolve) => {
            resolveChannel = resolve;
        });

        const finish = (state: TerminalState, message?: string) => {
            if (finished) {
                return;
            }

            finished = true;
            onStateRef.current(state, message);
        };

        const sendSize = () => {
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(
                    JSON.stringify({
                        t: 'r',
                        c: terminal.cols,
                        r: terminal.rows,
                    }),
                );
            }
        };

        const refit = () => {
            if (element.offsetParent !== null) {
                try {
                    fitAddon.fit();
                } catch {
                    // The terminal is not visible yet.
                }
            }
        };

        refit();

        const observer = new ResizeObserver(() => requestAnimationFrame(refit));
        observer.observe(element);

        const fail = (message: string) => {
            terminal.write(`\r\n\x1b[31m${message}\x1b[0m\r\n`);
            finish('error', message);
            socket?.close();
        };

        /** Sends keystrokes to the shell, encrypted when the terminal runs through the agent. */
        const write = (data: string) => {
            if (socket?.readyState !== WebSocket.OPEN) {
                return;
            }

            if (!secure) {
                socket.send(JSON.stringify({ t: 'i', d: data }));

                return;
            }

            // Keystrokes typed before the encryption is ready are dropped on purpose.
            channel
                ?.encrypt(encoder.encode(data))
                .then((encrypted) => {
                    if (socket?.readyState === WebSocket.OPEN) {
                        socket.send(encrypted);
                    }
                })
                .catch(() => fail(t('The encrypted connection failed.')));
        };

        inputRef.current = write;
        endRef.current = () => {
            if (socket?.readyState === WebSocket.OPEN && !secure) {
                socket.send(JSON.stringify({ t: 'end' }));
            }
        };

        terminal.onData((typed) => {
            let data = typed;

            // The Ctrl key of the key bar applies to the next character only.
            if (ctrlRef.current) {
                setCtrl(false);
                data = controlCharacter(typed) ?? typed;
            }

            write(data);
            onTypedRef.current?.(data);
        });
        // Cmd+F (Ctrl+Shift+F elsewhere) searches the output. Plain Ctrl+F stays with the shell.
        terminal.attachCustomKeyEventHandler((event) => {
            const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
            const wanted = isMac
                ? event.metaKey && !event.ctrlKey
                : event.ctrlKey && event.shiftKey;

            if (
                event.type === 'keydown' &&
                wanted &&
                event.key.toLowerCase() === 'f'
            ) {
                event.preventDefault();
                openSearchRef.current();

                return false;
            }

            return true;
        });
        terminal.onResize(sendSize);

        void (async () => {
            onStateRef.current('connecting');

            try {
                const response = await fetch(
                    TerminalSessionController.store.url(),
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': csrfToken(),
                        },
                        body: JSON.stringify({
                            server_id: serverId,
                            session: sessionKey,
                            persist,
                        }),
                    },
                );
                const data = await response.json().catch(() => ({}));

                if (disposed) {
                    return;
                }

                if (!response.ok) {
                    finish(
                        'error',
                        data.message ?? 'The session could not be prepared.',
                    );

                    return;
                }

                secure = data.mode === 'agent';

                socket = new WebSocket(
                    `${data.url}?token=${encodeURIComponent(data.token)}`,
                );
                socket.binaryType = 'arraybuffer';

                socket.onopen = sendSize;
                const verifyIdentity = async (reply: KeyReply) => {
                    if (handshake === null) {
                        return;
                    }

                    clearTimeout(handshakeTimer);

                    // Only the first answer counts.
                    const started = handshake;
                    handshake = null;

                    const verified = await started.verify(reply);
                    const pinned = pinnedFingerprint(serverId);

                    if (pinned !== verified.fingerprint) {
                        const trusted = await new Promise<boolean>((answer) =>
                            setPrompt({
                                fingerprint: verified.fingerprint,
                                previous: pinned,
                                answer,
                            }),
                        );

                        setPrompt(null);

                        if (!trusted) {
                            finish('closed');
                            socket?.close();

                            return;
                        }

                        pinFingerprint(serverId, verified.fingerprint);
                    }

                    channel = await verified.open();
                    resolveChannel(channel);
                    onInfoRef.current?.({
                        persistent: false,
                        files: agentFiles,
                    });
                    onStateRef.current('ready');
                    terminal.focus();
                };

                socket.onmessage = (event) => {
                    if (typeof event.data !== 'string') {
                        const bytes = new Uint8Array(event.data);

                        if (!secure) {
                            terminal.write(bytes);

                            return;
                        }

                        if (fileNext) {
                            fileNext = false;

                            void channelReady
                                .then((ready) => ready.files.decrypt(bytes))
                                .then((plain) =>
                                    files.handle(
                                        JSON.parse(decoder.decode(plain)),
                                    ),
                                )
                                .catch(() =>
                                    fail(
                                        t(
                                            'The encrypted connection could not be verified.',
                                        ),
                                    ),
                                );

                            return;
                        }

                        // Output may arrive while the user is still checking the fingerprint.
                        void channelReady
                            .then((ready) => ready.decrypt(bytes))
                            .then((plain) => terminal.write(plain))
                            .catch(() =>
                                fail(
                                    t(
                                        'The encrypted connection could not be verified.',
                                    ),
                                ),
                            );

                        return;
                    }

                    const message = JSON.parse(event.data);

                    if (message.t === 'f') {
                        fileNext = secure;
                    } else if (message.rid !== undefined && !secure) {
                        files.handle(message);
                    } else if (
                        message.t === 'status' &&
                        message.state === 'ready'
                    ) {
                        if (!secure) {
                            persistentRef.current = Boolean(message.persistent);
                            onInfoRef.current?.({
                                persistent: Boolean(message.persistent),
                                files: Boolean(message.files),
                            });
                            onStateRef.current('ready');
                            terminal.focus();

                            return;
                        }

                        agentFiles = Boolean(message.files);

                        void beginHandshake().then((started) => {
                            handshake = started;
                            handshakeTimer = setTimeout(
                                () =>
                                    fail(
                                        t(
                                            'The terminal service on the server does not support encryption. Update the agent.',
                                        ),
                                    ),
                                10_000,
                            );
                            socket?.send(
                                JSON.stringify({
                                    t: 'k',
                                    pub: started.publicKey,
                                }),
                            );
                        });
                    } else if (message.t === 'key' && secure) {
                        verifyIdentity(message).catch(() =>
                            fail(
                                t(
                                    'The identity of the terminal service could not be verified.',
                                ),
                            ),
                        );
                    } else if (message.t === 'error') {
                        terminal.write(
                            `\r\n\x1b[31m${message.message}\x1b[0m\r\n`,
                        );
                        finish('error', message.message);
                    }
                };
                socket.onerror = () =>
                    finish('error', 'The terminal server is not reachable.');
                socket.onclose = () => {
                    setPrompt(null);
                    files.close();

                    if (!disposed) {
                        terminal.write(
                            '\r\n\x1b[90m[connection closed]\x1b[0m\r\n',
                        );
                        finish('closed');
                    }
                };
            } catch {
                finish('error', 'The terminal server is not reachable.');
            }
        })();

        return () => {
            disposed = true;
            clearTimeout(handshakeTimer);
            observer.disconnect();
            files.close();
            filesRef.current = null;
            socket?.close();
            terminal.dispose();
            term.current = null;
            fit.current = null;
        };
        // The terminal is created once per mount: a new connection mounts a new one.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverId, sessionKey]);

    useEffect(() => {
        if (term.current) {
            term.current.options.fontSize = fontSize;
            requestAnimationFrame(() => fit.current?.fit());
        }
    }, [fontSize]);

    useEffect(() => {
        if (active) {
            requestAnimationFrame(() => {
                try {
                    fit.current?.fit();
                } catch {
                    // Not visible yet.
                }

                term.current?.focus();
            });
        }
    }, [active]);

    return (
        <div className="relative flex h-full w-full flex-col">
            <div ref={host} className="min-h-0 w-full flex-1" />

            {searchOpen && (
                <div
                    role="search"
                    className="absolute top-2 right-4 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-[#12151b]/95 p-1 text-slate-200 shadow-lg backdrop-blur"
                >
                    <input
                        ref={searchInput}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                goToMatch(event.shiftKey ? -1 : 1);
                            } else if (event.key === 'Escape') {
                                event.preventDefault();
                                event.stopPropagation();
                                closeSearch();
                            }
                        }}
                        placeholder={t('Find in output…')}
                        aria-label={t('Find in output…')}
                        className="h-7 w-44 rounded-md bg-black/40 px-2 text-sm outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-emerald-400"
                    />
                    <span className="min-w-12 px-1 text-center text-xs text-slate-400 tabular-nums">
                        {query === ''
                            ? ''
                            : position.total === 0
                              ? t('No matches')
                              : `${position.current}/${position.total}`}
                    </span>
                    <button
                        type="button"
                        aria-label={t('Match case')}
                        aria-pressed={matchCase}
                        title={t('Match case')}
                        onClick={() => setMatchCase(!matchCase)}
                        className={`rounded p-1 hover:bg-white/10 ${matchCase ? 'bg-emerald-500/30 text-emerald-300' : ''}`}
                    >
                        <CaseSensitive className="size-4" />
                    </button>
                    <button
                        type="button"
                        aria-label={t('Older match')}
                        title={t('Older match (Enter)')}
                        onClick={() => goToMatch(1)}
                        className="rounded p-1 hover:bg-white/10"
                    >
                        <ChevronUp className="size-4" />
                    </button>
                    <button
                        type="button"
                        aria-label={t('Newer match')}
                        title={t('Newer match (Shift+Enter)')}
                        onClick={() => goToMatch(-1)}
                        className="rounded p-1 hover:bg-white/10"
                    >
                        <ChevronDown className="size-4" />
                    </button>
                    <button
                        type="button"
                        aria-label={t('Close')}
                        onClick={closeSearch}
                        className="rounded p-1 hover:bg-white/10"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            )}

            {keyBar && (
                <div
                    className="flex shrink-0 gap-1 overflow-x-auto border-t border-white/10 bg-[#12151b] p-1.5"
                    role="toolbar"
                    aria-label={t('Extra keys')}
                    data-test="terminal-key-bar"
                >
                    <button
                        type="button"
                        aria-pressed={ctrl}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => {
                            setCtrl(!ctrl);
                            term.current?.focus();
                        }}
                        className={`min-w-11 shrink-0 rounded-md px-3 py-2 font-mono text-sm ${
                            ctrl
                                ? 'bg-emerald-500 text-black'
                                : 'bg-white/10 text-slate-200'
                        }`}
                    >
                        Ctrl
                    </button>
                    {EXTRA_KEYS.map((key) => (
                        <button
                            key={key.name}
                            type="button"
                            aria-label={t(key.name)}
                            // Keeps the focus in the terminal, so the keyboard stays open.
                            onPointerDown={(event) => event.preventDefault()}
                            onClick={() => {
                                term.current?.input(key.data, true);
                            }}
                            className="min-w-11 shrink-0 rounded-md bg-white/10 px-3 py-2 font-mono text-sm text-slate-200 active:bg-white/20"
                        >
                            {key.label}
                        </button>
                    ))}
                </div>
            )}

            {prompt && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-lg space-y-4 rounded-xl border border-white/10 bg-[#12151b] p-5 text-sm text-slate-200 shadow-xl">
                        <div className="flex items-center gap-2 font-medium text-slate-50">
                            {prompt.previous ? (
                                <TriangleAlert className="size-5 text-amber-400" />
                            ) : (
                                <ShieldCheck className="size-5 text-emerald-400" />
                            )}
                            {prompt.previous
                                ? t(
                                      'The identity of the terminal service has changed',
                                  )
                                : t('Verify the terminal service')}
                        </div>

                        <p className="text-slate-400">
                            {prompt.previous
                                ? t(
                                      'The fingerprint differs from the one you trusted before. If you reinstalled the server or its agent, compare the new fingerprint with the one on the server. Otherwise someone may be impersonating it.',
                                  )
                                : t(
                                      'The terminal is end-to-end encrypted: neither RackAtlas nor Cloudflare can read it. Compare the fingerprint below with the one printed on the server by this command, then trust it.',
                                  )}
                        </p>

                        <code className="block rounded-md bg-black/40 px-3 py-2 font-mono text-xs text-slate-300">
                            sudo rackatlas-terminal --fingerprint
                        </code>

                        {prompt.previous && (
                            <div className="space-y-1">
                                <p className="text-xs text-slate-500">
                                    {t('Trusted before')}
                                </p>
                                <code className="block rounded-md bg-black/40 px-3 py-2 font-mono text-xs break-all text-slate-400">
                                    {prompt.previous}
                                </code>
                            </div>
                        )}

                        <div className="space-y-1">
                            <p className="text-xs text-slate-500">
                                {t('Offered now')}
                            </p>
                            <code className="block rounded-md bg-black/40 px-3 py-2 font-mono text-xs break-all text-emerald-300">
                                {prompt.fingerprint}
                            </code>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                className="text-slate-300 hover:text-slate-50"
                                onClick={() => prompt.answer(false)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button onClick={() => prompt.answer(true)}>
                                {t('Trust and connect')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
