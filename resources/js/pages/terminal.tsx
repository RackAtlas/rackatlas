import { Head, Link } from '@inertiajs/react';
import {
    Download,
    Eraser,
    FolderOpen,
    LayoutGrid,
    Loader2,
    Maximize2,
    Minimize2,
    Minus,
    MapPin,
    Plus,
    Radio,
    Rows3,
    RefreshCw,
    Search,
    SquareTerminal,
    TextSearch,
    TriangleAlert,
    X,
    Copy,
    Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import FilesPanel from '@/components/terminal/files-panel';
import SnippetsPanel from '@/components/terminal/snippets-panel';
import type { Snippet } from '@/components/terminal/snippets-panel';
import TerminalView from '@/components/terminal/terminal-view';
import type {
    TerminalHandle,
    TerminalInfo,
    TerminalState,
} from '@/components/terminal/terminal-view';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { dotClass } from '@/lib/server-colors';
import { cn } from '@/lib/utils';
import { terminal } from '@/routes';
import { index as teamsIndex } from '@/routes/teams';
import { toast } from 'sonner';

type TerminalServer = {
    id: number;
    name: string;
    host: string | null;
    port: number;
    username: string | null;
    provider: string | null;
    country: string | null;
    status: 'unknown' | 'online' | 'offline';
    category: { id: number; name: string; color: string } | null;
    can_connect: boolean;
};

type Props = {
    team: { id: number; name: string } | null;
    canManage: boolean;
    enabled: boolean;
    idleMinutes: number;
    servers: TerminalServer[];
    snippets: Snippet[];
};

type Session = {
    id: number;
    /** Names the shell kept on the server, so a reconnect or a reload finds the same one. */
    key: string;
    /** The tab asked for a shell that keeps running on the server (tmux). */
    persist: boolean;
    /** The bridge confirmed it: tmux exists on the server. */
    persistent: boolean;
    /** The bridge can move files for this server. */
    files: boolean;
    server: TerminalServer;
    /** Changes with every reconnect, so a fresh terminal replaces the old one. */
    attempt: number;
    state: TerminalState;
    message?: string;
};

const FONT_KEY = 'terminal.fontSize';
const KEEP_KEY = 'terminal.keepRunning';
const SESSIONS_KEY = 'terminal.sessions';
const MIN_FONT = 10;
const MAX_FONT = 22;

const STATUS_DOT: Record<TerminalServer['status'], string> = {
    online: 'bg-emerald-500',
    offline: 'bg-red-500',
    unknown: 'bg-slate-400',
};

const STATE_DOT: Record<TerminalState, string> = {
    connecting: 'bg-amber-500 animate-pulse',
    ready: 'bg-emerald-500',
    closed: 'bg-slate-400',
    error: 'bg-red-500',
};

function newSessionKey(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(12));

    return [...bytes]
        .map((byte) => byte.toString(36).padStart(2, '0'))
        .join('')
        .slice(0, 20);
}

function saveText(text: string, name: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Notice({
    icon: Icon,
    title,
    children,
}: {
    icon: typeof SquareTerminal;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Icon className="size-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="text-sm text-muted-foreground">{children}</div>
        </div>
    );
}

export default function TerminalPage({
    team,
    canManage,
    enabled,
    idleMinutes,
    servers,
    snippets,
}: Props) {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [fullscreen, setFullscreen] = useState(false);
    const [tiled, setTiled] = useState(false);
    const [fontSize, setFontSize] = useState(() => {
        const saved = Number(
            typeof window === 'undefined'
                ? 0
                : window.localStorage.getItem(FONT_KEY),
        );

        return saved >= MIN_FONT && saved <= MAX_FONT ? saved : 14;
    });
    const [keepRunning, setKeepRunning] = useState(() => {
        try {
            return window.localStorage.getItem(KEEP_KEY) !== '0';
        } catch {
            return true;
        }
    });
    const [panel, setPanel] = useState<'snippets' | 'files' | null>(null);
    const [broadcast, setBroadcast] = useState(false);
    const [excluded, setExcluded] = useState<number[]>([]);
    const [incoming, setIncoming] = useState<{
        id: number;
        files: File[];
    } | null>(null);
    const [dropping, setDropping] = useState(false);
    const nextId = useRef(1);
    const handles = useRef(new Map<number, TerminalHandle>());
    const restored = useRef(false);
    const sessionsStorageKey = `${SESSIONS_KEY}.${team?.id ?? 0}`;

    useEffect(() => {
        try {
            window.localStorage.setItem(KEEP_KEY, keepRunning ? '1' : '0');
        } catch {
            // Storage is blocked: the choice just does not stay.
        }
    }, [keepRunning]);

    useEffect(() => {
        window.localStorage.setItem(FONT_KEY, String(fontSize));
    }, [fontSize]);

    useEffect(() => {
        if (!fullscreen) {
            return;
        }

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setFullscreen(false);
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [fullscreen]);

    const groups = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const matching = servers.filter(
            (server) =>
                needle === '' ||
                [server.name, server.host, server.provider, server.username]
                    .filter(Boolean)
                    .some((value) => value!.toLowerCase().includes(needle)),
        );
        const map = new Map<string, TerminalServer[]>();

        for (const server of matching) {
            const key = server.category?.name ?? '';

            map.set(key, [...(map.get(key) ?? []), server]);
        }

        return [...map.entries()].sort((a, b) =>
            a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0]),
        );
    }, [servers, search]);

    const active = sessions.find((session) => session.id === activeId) ?? null;
    const showTiles = tiled && sessions.length > 1;
    const tileColumns = Math.ceil(Math.sqrt(sessions.length));
    const tileRows = Math.ceil(sessions.length / tileColumns);

    const open = (server: TerminalServer, restore?: { key: string }) => {
        const id = nextId.current++;

        setSessions((current) => [
            ...current,
            {
                id,
                key: restore?.key ?? newSessionKey(),
                persist: restore !== undefined || keepRunning,
                persistent: false,
                files: false,
                server,
                attempt: 0,
                state: 'connecting',
            },
        ]);
        setActiveId(id);
    };

    // Shells kept on the server come back after a reload: the tabs that were open are opened again.
    useEffect(() => {
        if (restored.current || team === null) {
            return;
        }

        restored.current = true;

        try {
            const saved: { key: string; serverId: number }[] = JSON.parse(
                window.localStorage.getItem(sessionsStorageKey) ?? '[]',
            );
            const reopened = saved.filter((item) =>
                servers.some(
                    (server) =>
                        server.id === item.serverId && server.can_connect,
                ),
            );

            reopened.forEach((item) =>
                open(
                    servers.find((server) => server.id === item.serverId)!,
                    {
                        key: item.key,
                    },
                ),
            );

            if (reopened.length > 0) {
                toast.info(
                    t('Reopened :count kept sessions.', {
                        count: reopened.length,
                    }),
                );
            }
        } catch {
            // Nothing usable was saved.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!restored.current) {
            return;
        }

        try {
            window.localStorage.setItem(
                sessionsStorageKey,
                JSON.stringify(
                    sessions
                        .filter(
                            (session) =>
                                session.persist &&
                                !(
                                    session.state === 'ready' &&
                                    !session.persistent
                                ),
                        )
                        .map((session) => ({
                            key: session.key,
                            serverId: session.server.id,
                        })),
                ),
            );
        } catch {
            // Storage is blocked: the tabs just do not come back.
        }
    }, [sessions, sessionsStorageKey]);

    const close = (id: number) => {
        // Closing a tab ends the shell on the server too, like closing a terminal window.
        handles.current.get(id)?.end();
        setExcluded((current) => current.filter((item) => item !== id));
        setSessions((current) => {
            const index = current.findIndex((session) => session.id === id);
            const rest = current.filter((session) => session.id !== id);

            if (activeId === id) {
                setActiveId(rest[Math.min(index, rest.length - 1)]?.id ?? null);
            }

            return rest;
        });
        handles.current.delete(id);
    };

    const reconnect = (id: number) =>
        setSessions((current) =>
            current.map((session) =>
                session.id === id
                    ? {
                          ...session,
                          attempt: session.attempt + 1,
                          state: 'connecting',
                          message: undefined,
                      }
                    : session,
            ),
        );

    const setState = (id: number, state: TerminalState, message?: string) =>
        setSessions((current) =>
            current.map((session) =>
                session.id === id ? { ...session, state, message } : session,
            ),
        );

    const setInfo = (id: number, info: TerminalInfo) =>
        setSessions((current) =>
            current.map((session) =>
                session.id === id ? { ...session, ...info } : session,
            ),
        );

    /** The terminals that get what is typed while broadcasting. */
    const receivers = sessions.filter(
        (session) =>
            session.state === 'ready' && !excluded.includes(session.id),
    );
    const broadcasting = broadcast && sessions.length > 1;

    const typed = (from: number, data: string) => {
        if (!broadcasting || excluded.includes(from)) {
            return;
        }

        receivers
            .filter((session) => session.id !== from)
            .forEach((session) =>
                handles.current.get(session.id)?.sendInput(data),
            );
    };

    /** A snippet goes to the active terminal, or to every receiving one while broadcasting. */
    const sendSnippet = (command: string, run: boolean) => {
        const text = run ? `${command.replace(/\r?\n/g, '\r')}\r` : command;
        const to = broadcasting
            ? receivers
            : receivers.filter((session) => session.id === activeId);

        if (to.length === 0) {
            toast.info(t('Connect to a server first.'));

            return;
        }

        to.forEach((session) =>
            handles.current.get(session.id)?.sendInput(text),
        );
        handles.current.get(activeId ?? -1)?.focus();
    };

    const exportOutput = async (mode: 'save' | 'copy') => {
        if (active === null) {
            return;
        }

        const handle = handles.current.get(active.id);
        const kept = active.persistent ? await handle?.getHistory() : null;
        const text = (kept ?? handle?.getText() ?? '').trim();

        if (text === '') {
            toast.info(t('There is no output yet.'));

            return;
        }

        if (mode === 'copy') {
            await navigator.clipboard.writeText(text);
            toast.success(t('Copied.'));

            return;
        }

        const stamp = new Date()
            .toISOString()
            .slice(0, 16)
            .replace(/[:T]/g, '-');

        saveText(`${text}\n`, `${active.server.name}-${stamp}.txt`);
    };

    const dropFiles = (files: File[]) => {
        if (files.length === 0 || active === null) {
            return;
        }

        if (!active.files || active.state !== 'ready') {
            toast.info(
                t(
                    'This server cannot transfer files. If it uses the agent, update the agent.',
                ),
            );

            return;
        }

        setPanel('files');
        setIncoming({ id: Date.now(), files });
    };

    const stateLabel = (state: TerminalState): string =>
        ({
            connecting: t('Connecting…'),
            ready: t('Connected'),
            closed: t('Disconnected'),
            error: t('Connection failed'),
        })[state];

    if (team === null) {
        return (
            <>
                <Head title={t('Terminal')} />
                <Notice icon={MapPin} title={t('Create a team first')}>
                    <p>{t('Create a team first, servers belong to a team.')}</p>
                    <Button asChild className="mt-4">
                        <Link href={teamsIndex()}>{t('Teams')}</Link>
                    </Button>
                </Notice>
            </>
        );
    }

    if (!canManage) {
        return (
            <>
                <Head title={t('Terminal')} />
                <Notice
                    icon={TriangleAlert}
                    title={t('Terminal is for team admins')}
                >
                    {t(
                        'Opening a shell on a server is limited to the owner and admins of the team.',
                    )}
                </Notice>
            </>
        );
    }

    if (!enabled) {
        return (
            <>
                <Head title={t('Terminal')} />
                <Notice
                    icon={SquareTerminal}
                    title={t('Terminal is not set up yet')}
                >
                    <p>
                        {t(
                            'Set TERMINAL_SECRET and TERMINAL_URL in the .env file, then start the terminal server:',
                        )}
                    </p>
                    <code className="mt-3 inline-block rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-foreground">
                        npm run terminal
                    </code>
                </Notice>
            </>
        );
    }

    return (
        <>
            <Head title={t('Terminal')} />
            <div
                className={cn(
                    'mx-auto flex w-full max-w-[100rem] flex-col gap-4 p-4 md:p-6 lg:h-[calc(100svh-5rem)] lg:overflow-hidden',
                    fullscreen &&
                        'fixed inset-0 z-50 h-svh max-w-none gap-0 bg-background p-0 md:p-0 lg:h-svh',
                )}
            >
                {!fullscreen && (
                    <div className="shrink-0">
                        <h1 className="text-2xl font-semibold">
                            {t('Terminal')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('Open a shell on any of your servers.')}
                        </p>
                    </div>
                )}

                <div
                    className={cn(
                        'grid gap-4 lg:min-h-0 lg:flex-1',
                        fullscreen
                            ? 'h-full grid-cols-1 gap-0'
                            : 'lg:grid-cols-[18rem_1fr]',
                    )}
                >
                    {!fullscreen && (
                        <aside className="flex max-h-72 min-h-0 flex-col overflow-hidden rounded-xl border bg-card lg:max-h-none">
                            <div className="border-b p-2">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder={t('Search servers…')}
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                                {servers.length === 0 ? (
                                    <p className="p-3 text-sm text-muted-foreground">
                                        {t('No servers yet.')}
                                    </p>
                                ) : groups.length === 0 ? (
                                    <p className="p-3 text-sm text-muted-foreground">
                                        {t('No server matches your search.')}
                                    </p>
                                ) : (
                                    groups.map(([category, list]) => (
                                        <section
                                            key={category}
                                            className="mb-3 last:mb-0"
                                        >
                                            <h2 className="flex items-center gap-1.5 px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                {list[0].category && (
                                                    <span
                                                        className={cn(
                                                            'size-1.5 rounded-full',
                                                            dotClass(
                                                                list[0].category
                                                                    .color,
                                                            ),
                                                        )}
                                                    />
                                                )}
                                                {category || t('No category')}
                                            </h2>
                                            <ul className="space-y-0.5">
                                                {list.map((server) => {
                                                    const sessionCount =
                                                        sessions.filter(
                                                            (session) =>
                                                                session.server
                                                                    .id ===
                                                                server.id,
                                                        ).length;
                                                    const row = (
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                !server.can_connect
                                                            }
                                                            onClick={() =>
                                                                open(server)
                                                            }
                                                            className={cn(
                                                                'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                                                                server.can_connect
                                                                    ? 'hover:bg-muted'
                                                                    : 'cursor-not-allowed opacity-50',
                                                                active?.server
                                                                    .id ===
                                                                    server.id &&
                                                                    'bg-muted',
                                                            )}
                                                        >
                                                            <span
                                                                className={cn(
                                                                    'size-2 shrink-0 rounded-full',
                                                                    STATUS_DOT[
                                                                        server
                                                                            .status
                                                                    ],
                                                                )}
                                                            />
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm font-medium">
                                                                    {
                                                                        server.name
                                                                    }
                                                                </span>
                                                                <span className="block truncate font-mono text-xs text-muted-foreground">
                                                                    {server.host
                                                                        ? `${server.username}@${server.host}`
                                                                        : t(
                                                                              'Agent',
                                                                          )}
                                                                </span>
                                                            </span>
                                                            {sessionCount >
                                                                0 && (
                                                                <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary tabular-nums">
                                                                    {
                                                                        sessionCount
                                                                    }
                                                                </span>
                                                            )}
                                                        </button>
                                                    );

                                                    return (
                                                        <li key={server.id}>
                                                            {server.can_connect ? (
                                                                row
                                                            ) : (
                                                                <Tooltip>
                                                                    <TooltipTrigger
                                                                        asChild
                                                                    >
                                                                        <div>
                                                                            {
                                                                                row
                                                                            }
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        {t(
                                                                            'Reports through the agent, no SSH access.',
                                                                        )}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </section>
                                    ))
                                )}
                            </div>

                            <label className="flex cursor-pointer items-start gap-3 border-t p-3">
                                <Switch
                                    checked={keepRunning}
                                    onCheckedChange={setKeepRunning}
                                    aria-label={t('Keep sessions running')}
                                    className="mt-0.5"
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">
                                        {t('Keep sessions running')}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                        {t(
                                            'The shell stays alive on the server (tmux) when the connection drops, and comes back after a reload. Applies to new sessions.',
                                        )}
                                    </span>
                                </span>
                            </label>
                        </aside>
                    )}

                    <section
                        className={cn(
                            'flex min-h-96 min-w-0 flex-col overflow-hidden border bg-card lg:min-h-0',
                            fullscreen ? 'rounded-none border-0' : 'rounded-xl',
                        )}
                    >
                        {sessions.length > 0 && (
                            <>
                                <div
                                    role="tablist"
                                    className="flex shrink-0 items-end gap-1 overflow-x-auto border-b bg-muted/40 px-2 pt-2"
                                >
                                    {sessions.map((session) => (
                                        <div
                                            key={session.id}
                                            role="tab"
                                            aria-selected={
                                                session.id === activeId
                                            }
                                            className={cn(
                                                'group flex max-w-52 shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 text-sm transition-colors',
                                                session.id === activeId
                                                    ? 'bg-card font-medium'
                                                    : 'border-transparent text-muted-foreground hover:bg-muted',
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setActiveId(session.id)
                                                }
                                                className="flex min-w-0 items-center gap-2"
                                            >
                                                <span
                                                    className={cn(
                                                        'size-2 shrink-0 rounded-full',
                                                        STATE_DOT[
                                                            session.state
                                                        ],
                                                    )}
                                                />
                                                <span className="truncate">
                                                    {session.server.name}
                                                </span>
                                            </button>
                                            {broadcasting && (
                                                <button
                                                    type="button"
                                                    aria-pressed={
                                                        !excluded.includes(
                                                            session.id,
                                                        )
                                                    }
                                                    aria-label={t(
                                                        'Receive broadcast',
                                                    )}
                                                    title={t(
                                                        'Receive broadcast',
                                                    )}
                                                    onClick={() =>
                                                        setExcluded(
                                                            (current) =>
                                                                current.includes(
                                                                    session.id,
                                                                )
                                                                    ? current.filter(
                                                                          (
                                                                              item,
                                                                          ) =>
                                                                              item !==
                                                                              session.id,
                                                                      )
                                                                    : [
                                                                          ...current,
                                                                          session.id,
                                                                      ],
                                                        )
                                                    }
                                                    className={cn(
                                                        'rounded p-0.5 hover:bg-accent',
                                                        excluded.includes(
                                                            session.id,
                                                        )
                                                            ? 'text-muted-foreground/50'
                                                            : 'text-amber-500',
                                                    )}
                                                >
                                                    <Radio className="size-3.5" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    close(session.id)
                                                }
                                                aria-label={t('Close')}
                                                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {active && (
                                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                                        <div className="flex min-w-0 items-center gap-2 text-sm">
                                            {active.state === 'connecting' ? (
                                                <Loader2 className="size-4 animate-spin text-amber-500" />
                                            ) : (
                                                <span
                                                    className={cn(
                                                        'size-2 rounded-full',
                                                        STATE_DOT[active.state],
                                                    )}
                                                />
                                            )}
                                            <span className="font-medium">
                                                {stateLabel(active.state)}
                                            </span>
                                            <span className="truncate font-mono text-xs text-muted-foreground">
                                                {active.server.username}@
                                                {active.server.host}:
                                                {active.server.port}
                                            </span>
                                            {active.persistent && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                                                            {t(
                                                                'Kept on server',
                                                            )}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {t(
                                                            'The shell runs in tmux, so it survives a lost connection and a reload.',
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {(active.state === 'closed' ||
                                                active.state === 'error') && (
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        reconnect(active.id)
                                                    }
                                                >
                                                    <RefreshCw className="size-3.5" />
                                                    {t('Reconnect')}
                                                </Button>
                                            )}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t(
                                                            'Find in output',
                                                        )}
                                                        onClick={() =>
                                                            handles.current
                                                                .get(active.id)
                                                                ?.openSearch()
                                                        }
                                                    >
                                                        <TextSearch className="size-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {t('Find in output')}
                                                    <span className="ml-2 text-muted-foreground">
                                                        {/Mac|iPhone|iPad/.test(
                                                            navigator.platform,
                                                        )
                                                            ? '⌘F'
                                                            : 'Ctrl+Shift+F'}
                                                    </span>
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t(
                                                            'Copy selection',
                                                        )}
                                                        onClick={async () => {
                                                            const copied =
                                                                await handles.current
                                                                    .get(
                                                                        active.id,
                                                                    )
                                                                    ?.copySelection();

                                                            toast[
                                                                copied
                                                                    ? 'success'
                                                                    : 'info'
                                                            ](
                                                                copied
                                                                    ? t(
                                                                          'Copied.',
                                                                      )
                                                                    : t(
                                                                          'Select some text first.',
                                                                      ),
                                                            );
                                                        }}
                                                    >
                                                        <Copy className="size-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {t('Copy selection')}
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t(
                                                            'Clear screen',
                                                        )}
                                                        onClick={() =>
                                                            handles.current
                                                                .get(active.id)
                                                                ?.clear()
                                                        }
                                                    >
                                                        <Eraser className="size-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {t('Clear screen')}
                                                </TooltipContent>
                                            </Tooltip>
                                            <DropdownMenu>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <DropdownMenuTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label={t(
                                                                    'Save output',
                                                                )}
                                                            >
                                                                <Download className="size-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {t('Save output')}
                                                    </TooltipContent>
                                                </Tooltip>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            void exportOutput(
                                                                'save',
                                                            )
                                                        }
                                                    >
                                                        {t('Download as .txt')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            void exportOutput(
                                                                'copy',
                                                            )
                                                        }
                                                    >
                                                        {t('Copy all output')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <div className="mx-1 flex items-center rounded-md border">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 rounded-none"
                                                    aria-label={t(
                                                        'Smaller text',
                                                    )}
                                                    disabled={
                                                        fontSize <= MIN_FONT
                                                    }
                                                    onClick={() =>
                                                        setFontSize(
                                                            fontSize - 1,
                                                        )
                                                    }
                                                >
                                                    <Minus className="size-3.5" />
                                                </Button>
                                                <span className="w-7 text-center text-xs text-muted-foreground tabular-nums">
                                                    {fontSize}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 rounded-none"
                                                    aria-label={t(
                                                        'Larger text',
                                                    )}
                                                    disabled={
                                                        fontSize >= MAX_FONT
                                                    }
                                                    onClick={() =>
                                                        setFontSize(
                                                            fontSize + 1,
                                                        )
                                                    }
                                                >
                                                    <Plus className="size-3.5" />
                                                </Button>
                                            </div>
                                            {sessions.length > 1 && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant={
                                                                showTiles
                                                                    ? 'secondary'
                                                                    : 'ghost'
                                                            }
                                                            size="icon"
                                                            aria-pressed={
                                                                showTiles
                                                            }
                                                            aria-label={t(
                                                                'Show terminals side by side',
                                                            )}
                                                            onClick={() =>
                                                                setTiled(!tiled)
                                                            }
                                                        >
                                                            {showTiles ? (
                                                                <Rows3 className="size-4" />
                                                            ) : (
                                                                <LayoutGrid className="size-4" />
                                                            )}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {showTiles
                                                            ? t('Back to tabs')
                                                            : t(
                                                                  'Show terminals side by side',
                                                              )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            {sessions.length > 1 && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant={
                                                                broadcasting
                                                                    ? 'secondary'
                                                                    : 'ghost'
                                                            }
                                                            size="icon"
                                                            aria-pressed={
                                                                broadcasting
                                                            }
                                                            aria-label={t(
                                                                'Broadcast typing to all terminals',
                                                            )}
                                                            className={cn(
                                                                broadcasting &&
                                                                    'text-amber-500',
                                                            )}
                                                            onClick={() =>
                                                                setBroadcast(
                                                                    !broadcast,
                                                                )
                                                            }
                                                        >
                                                            <Radio className="size-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {t(
                                                            'Broadcast typing to all terminals',
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant={
                                                            panel === 'snippets'
                                                                ? 'secondary'
                                                                : 'ghost'
                                                        }
                                                        size="icon"
                                                        aria-pressed={
                                                            panel === 'snippets'
                                                        }
                                                        aria-label={t(
                                                            'Snippets',
                                                        )}
                                                        onClick={() =>
                                                            setPanel(
                                                                panel ===
                                                                    'snippets'
                                                                    ? null
                                                                    : 'snippets',
                                                            )
                                                        }
                                                    >
                                                        <Zap className="size-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {t('Snippets')}
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant={
                                                            panel === 'files'
                                                                ? 'secondary'
                                                                : 'ghost'
                                                        }
                                                        size="icon"
                                                        aria-pressed={
                                                            panel === 'files'
                                                        }
                                                        aria-label={t('Files')}
                                                        onClick={() =>
                                                            setPanel(
                                                                panel ===
                                                                    'files'
                                                                    ? null
                                                                    : 'files',
                                                            )
                                                        }
                                                    >
                                                        <FolderOpen className="size-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {t('Files')}
                                                </TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={t(
                                                            'Full screen',
                                                        )}
                                                        onClick={() =>
                                                            setFullscreen(
                                                                !fullscreen,
                                                            )
                                                        }
                                                    >
                                                        {fullscreen ? (
                                                            <Minimize2 className="size-4" />
                                                        ) : (
                                                            <Maximize2 className="size-4" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {fullscreen
                                                        ? t(
                                                              'Leave full screen (Esc)',
                                                          )
                                                        : t('Full screen')}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {broadcasting && (
                            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                                <span className="flex items-center gap-1.5">
                                    <Radio className="size-3.5" />
                                    {t(
                                        'Broadcasting: what you type goes to :count terminals. Use the antenna on a tab to leave it out.',
                                        { count: receivers.length },
                                    )}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setBroadcast(false)}
                                    className="rounded px-2 py-0.5 font-medium hover:bg-amber-500/20"
                                >
                                    {t('Stop')}
                                </button>
                            </div>
                        )}

                        <div className="relative flex min-h-0 flex-1">
                            <div
                                className={cn(
                                    'relative min-h-0 min-w-0 flex-1 bg-[#0c0e12]',
                                    showTiles && 'grid gap-1 p-1',
                                    broadcasting &&
                                        'ring-2 ring-amber-500/60 ring-inset',
                                )}
                                onDragOver={(event) => {
                                    if (
                                        active !== null &&
                                        event.dataTransfer.types.includes(
                                            'Files',
                                        )
                                    ) {
                                        event.preventDefault();
                                        setDropping(true);
                                    }
                                }}
                                onDragLeave={(event) => {
                                    if (
                                        !event.currentTarget.contains(
                                            event.relatedTarget as Node | null,
                                        )
                                    ) {
                                        setDropping(false);
                                    }
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setDropping(false);
                                    dropFiles([...event.dataTransfer.files]);
                                }}
                                style={
                                    showTiles
                                        ? {
                                              gridTemplateColumns: `repeat(${tileColumns}, minmax(0, 1fr))`,
                                              gridTemplateRows: `repeat(${tileRows}, minmax(0, 1fr))`,
                                          }
                                        : undefined
                                }
                            >
                                {sessions.map((session) => (
                                    <div
                                        key={`${session.id}-${session.attempt}`}
                                        onMouseDown={
                                            showTiles
                                                ? () => setActiveId(session.id)
                                                : undefined
                                        }
                                        className={cn(
                                            showTiles
                                                ? 'relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border'
                                                : 'absolute inset-0 p-3',
                                            showTiles &&
                                                (session.id === activeId
                                                    ? 'border-primary'
                                                    : 'border-white/10'),
                                            !showTiles &&
                                                session.id !== activeId &&
                                                'hidden',
                                        )}
                                    >
                                        {showTiles && (
                                            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
                                                <span
                                                    className={cn(
                                                        'size-2 shrink-0 rounded-full',
                                                        STATE_DOT[
                                                            session.state
                                                        ],
                                                    )}
                                                />
                                                <span className="min-w-0 flex-1 truncate">
                                                    {session.server.name}
                                                </span>
                                                {broadcasting && (
                                                    <button
                                                        type="button"
                                                        aria-pressed={
                                                            !excluded.includes(
                                                                session.id,
                                                            )
                                                        }
                                                        aria-label={t(
                                                            'Receive broadcast',
                                                        )}
                                                        title={t(
                                                            'Receive broadcast',
                                                        )}
                                                        onClick={() =>
                                                            setExcluded(
                                                                (current) =>
                                                                    current.includes(
                                                                        session.id,
                                                                    )
                                                                        ? current.filter(
                                                                              (
                                                                                  item,
                                                                              ) =>
                                                                                  item !==
                                                                                  session.id,
                                                                          )
                                                                        : [
                                                                              ...current,
                                                                              session.id,
                                                                          ],
                                                            )
                                                        }
                                                        className={cn(
                                                            'rounded p-0.5 hover:bg-white/10',
                                                            excluded.includes(
                                                                session.id,
                                                            )
                                                                ? 'text-slate-500'
                                                                : 'text-amber-400',
                                                        )}
                                                    >
                                                        <Radio className="size-3" />
                                                    </button>
                                                )}
                                                {(session.state === 'closed' ||
                                                    session.state ===
                                                        'error') && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            reconnect(
                                                                session.id,
                                                            )
                                                        }
                                                        aria-label={t(
                                                            'Reconnect',
                                                        )}
                                                        className="rounded p-0.5 hover:bg-white/10"
                                                    >
                                                        <RefreshCw className="size-3" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        close(session.id)
                                                    }
                                                    aria-label={t('Close')}
                                                    className="rounded p-0.5 hover:bg-white/10"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                showTiles &&
                                                    'min-h-0 flex-1 p-1.5',
                                                !showTiles && 'h-full w-full',
                                            )}
                                        >
                                            <TerminalView
                                                ref={(handle) => {
                                                    if (handle) {
                                                        handles.current.set(
                                                            session.id,
                                                            handle,
                                                        );
                                                    }
                                                }}
                                                serverId={session.server.id}
                                                sessionKey={session.key}
                                                persist={session.persist}
                                                active={session.id === activeId}
                                                fontSize={fontSize}
                                                onInfo={(info) =>
                                                    setInfo(session.id, info)
                                                }
                                                onTyped={(data) =>
                                                    typed(session.id, data)
                                                }
                                                onState={(state, message) =>
                                                    setState(
                                                        session.id,
                                                        state,
                                                        message,
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                ))}

                                {active?.state === 'error' &&
                                    active.message && (
                                        <div className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/90 px-3 py-2 text-sm text-red-100 shadow-lg">
                                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                                            <span>{active.message}</span>
                                        </div>
                                    )}

                                {sessions.length === 0 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                                        <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5">
                                            <SquareTerminal className="size-7 text-slate-300" />
                                        </div>
                                        <h2 className="text-base font-medium text-slate-100">
                                            {t('Pick a server to start')}
                                        </h2>
                                        <p className="max-w-sm text-sm text-slate-400">
                                            {t(
                                                'Choose a server on the left to open a shell. You can keep several sessions open in tabs.',
                                            )}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {t(
                                                'Sessions close after :minutes minutes without typing.',
                                                { minutes: idleMinutes },
                                            )}
                                        </p>
                                    </div>
                                )}

                                {dropping && (
                                    <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-sky-400 bg-sky-500/15 text-sm font-medium text-sky-100">
                                        {active?.files
                                            ? t(
                                                  'Drop files to upload them to the server',
                                              )
                                            : t(
                                                  'This server cannot transfer files. If it uses the agent, update the agent.',
                                              )}
                                    </div>
                                )}
                            </div>

                            {panel !== null && active !== null && (
                                <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm min-w-0 flex-col border-l bg-card shadow-xl lg:static lg:w-80 lg:max-w-none lg:shrink-0 lg:shadow-none">
                                    {panel === 'snippets' ? (
                                        <SnippetsPanel
                                            snippets={snippets}
                                            targets={
                                                broadcasting
                                                    ? receivers.length
                                                    : 1
                                            }
                                            onSend={sendSnippet}
                                            onClose={() => setPanel(null)}
                                        />
                                    ) : active.files &&
                                      active.state === 'ready' ? (
                                        <FilesPanel
                                            key={`${active.id}-${active.attempt}`}
                                            getClient={() =>
                                                handles.current
                                                    .get(active.id)
                                                    ?.getFiles() ?? null
                                            }
                                            incoming={incoming}
                                            onClose={() => setPanel(null)}
                                        />
                                    ) : (
                                        <div className="flex h-full flex-col">
                                            <div className="flex items-center justify-between border-b px-3 py-2">
                                                <h2 className="text-sm font-semibold">
                                                    {t('Files')}
                                                </h2>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="size-8"
                                                    aria-label={t('Close')}
                                                    onClick={() =>
                                                        setPanel(null)
                                                    }
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                            <p className="p-6 text-center text-sm text-muted-foreground">
                                                {active.state === 'ready'
                                                    ? t(
                                                          'This server cannot transfer files. If it uses the agent, update the agent.',
                                                      )
                                                    : t(
                                                          'Connect to a server first.',
                                                      )}
                                            </p>
                                        </div>
                                    )}
                                </aside>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

TerminalPage.layout = {
    breadcrumbs: [{ title: 'Terminal', href: terminal() }],
};
