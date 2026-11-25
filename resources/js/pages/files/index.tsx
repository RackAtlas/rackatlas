import { Head } from '@inertiajs/react';
import {
    Archive,
    ArrowUp,
    Bookmark,
    BookmarkPlus,
    ChevronRight,
    ClipboardCopy,
    Copy,
    Download,
    Eye,
    EyeOff,
    File,
    FilePlus,
    FileText,
    Folder,
    FolderInput,
    FolderOpen,
    FolderPlus,
    HardDrive,
    Home,
    Link2,
    MoreHorizontal,
    PackageOpen,
    Pencil,
    Search,
    ShieldCheck,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import FileManagerController from '@/actions/App/Http/Controllers/FileManagerController';
import { FileEditor } from '@/components/files/file-editor';
import { modeString, PermissionsDialog, type PermissionChange } from '@/components/files/permissions-dialog';
import { PromptDialog, type PromptRequest } from '@/components/server-tools/prompt-dialog';
import {
    LoadError,
    NoSshServers,
    PrivilegeNotice,
    ServerToolbar,
    useSelectedServer,
    type SshServer,
} from '@/components/server-tools/server-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTranslation } from '@/hooks/use-translation';
import { formatBytes } from '@/lib/dashboard';
import { errorMessage, serverDownload, serverRequest, serverUpload } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { index } from '@/routes/files';

type Entry = {
    name: string;
    type: 'dir' | 'file' | 'link' | 'other';
    link_target: string | null;
    link_dir: boolean;
    mode: string;
    owner: string;
    group: string;
    size: number;
    mtime: number;
};

type Listing = {
    path: string;
    entries: Entry[];
    truncated: boolean;
    privilege: string;
    writable: boolean;
};

type SearchResult = { path: string; type: string; size: number; mtime: number };

type Props = {
    team: { id: number; name: string } | null;
    servers: SshServer[];
    canManage: boolean;
    selected: number | null;
    initialPath: string | null;
    limits: { edit: number; download: number; upload: number };
};

type SortKey = 'name' | 'size' | 'mtime' | 'owner';

const DEFAULT_BOOKMARKS = ['/', '/etc', '/etc/nginx', '/var/www', '/var/log', '/home', '/root', '/tmp'];
const BOOKMARK_STORAGE = 'files.bookmarks';
const HIDDEN_STORAGE = 'files.hidden';
const ARCHIVE = /\.(zip|tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz)$/i;

function join(directory: string, name: string): string {
    return `${directory.replace(/\/+$/, '')}/${name}`;
}

function parent(path: string): string {
    const trimmed = path.replace(/\/+$/, '');
    const index = trimmed.lastIndexOf('/');

    return index <= 0 ? '/' : trimmed.slice(0, index);
}

function isDir(entry: Entry): boolean {
    return entry.type === 'dir' || (entry.type === 'link' && entry.link_dir);
}

function readStorage<T>(key: string, fallback: T): T {
    try {
        const value = localStorage.getItem(key);

        return value === null ? fallback : (JSON.parse(value) as T);
    } catch {
        return fallback;
    }
}

function writeStorage(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage is not available.
    }
}

export default function FilesPage({ team, servers, canManage, selected, initialPath, limits }: Props) {
    const { t, locale } = useTranslation();
    const [server, setServer] = useSelectedServer(servers, selected);
    const [listing, setListing] = useState<Listing | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [pathInput, setPathInput] = useState('');
    const [filter, setFilter] = useState('');
    const [showHidden, setShowHidden] = useState(() => readStorage(HIDDEN_STORAGE, false));
    const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false });
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [editing, setEditing] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<PromptRequest | null>(null);
    const [permissionsFor, setPermissionsFor] = useState<Entry[] | null>(null);
    const [bookmarks, setBookmarks] = useState<string[]>(() => readStorage(BOOKMARK_STORAGE, DEFAULT_BOOKMARKS));
    const [search, setSearch] = useState<{ query: string; contents: boolean; results: SearchResult[] | null; truncated: boolean; loading: boolean } | null>(null);
    const [sizes, setSizes] = useState<Record<string, number | 'loading'>>({});
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const uploadInput = useRef<HTMLInputElement>(null);
    const firstLoad = useRef(true);
    const [, copy] = useClipboard();

    const serverId = server?.id ?? null;

    const open = useCallback(
        async (path: string | null) => {
            if (serverId === null) {
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const answer = await serverRequest<Listing>(FileManagerController.list(serverId), { path });
                setListing(answer);
                setPathInput(answer.path);
                setChecked(new Set());
                setFilter('');
                setSizes({});

                const url = new URL(window.location.href);
                url.searchParams.set('path', answer.path);
                window.history.replaceState(window.history.state, '', url);
            } catch (e) {
                setError(errorMessage(e));
            } finally {
                setLoading(false);
            }
        },
        [serverId],
    );

    useEffect(() => {
        setListing(null);
        void open(firstLoad.current ? initialPath : null);
        firstLoad.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverId]);

    useEffect(() => writeStorage(HIDDEN_STORAGE, showHidden), [showHidden]);
    useEffect(() => writeStorage(BOOKMARK_STORAGE, bookmarks), [bookmarks]);

    const directory = listing?.path ?? '/';
    const refresh = () => void open(directory);

    const entries = useMemo(() => {
        const query = filter.trim().toLowerCase();
        const list = (listing?.entries ?? []).filter(
            (entry) => (showHidden || !entry.name.startsWith('.')) && (query === '' || entry.name.toLowerCase().includes(query)),
        );

        return list.sort((a, b) => {
            if (isDir(a) !== isDir(b)) {
                return isDir(a) ? -1 : 1;
            }

            const order =
                sort.key === 'size'
                    ? a.size - b.size
                    : sort.key === 'mtime'
                      ? a.mtime - b.mtime
                      : sort.key === 'owner'
                        ? a.owner.localeCompare(b.owner)
                        : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

            return sort.desc ? -order : order;
        });
    }, [listing, filter, showHidden, sort]);

    const selectedEntries = entries.filter((entry) => checked.has(entry.name));
    const hiddenCount = (listing?.entries ?? []).filter((entry) => entry.name.startsWith('.')).length;

    /** Run a change, show its message and list the directory again. */
    const act = async (route: { url: string; method: string }, payload: Record<string, unknown>, reload = true): Promise<boolean> => {
        setBusy(true);

        try {
            const answer = await serverRequest<{ message?: string }>(route, payload);

            if (answer.message) {
                toast.success(answer.message);
            }

            if (reload) {
                await open(directory);
            }

            return true;
        } catch (e) {
            toast.error(errorMessage(e));

            return false;
        } finally {
            setBusy(false);
        }
    };

    const download = async (path: string) => {
        if (serverId === null) {
            return;
        }

        const toastId = toast.loading(t('Downloading :name…', { name: path.split('/').pop() ?? path }));

        try {
            await serverDownload(FileManagerController.download(serverId), { path }, path.split('/').pop() || 'download');
            toast.dismiss(toastId);
        } catch (e) {
            toast.error(errorMessage(e), { id: toastId });
        }
    };

    const upload = async (files: FileList | File[]) => {
        if (serverId === null || files.length === 0) {
            return;
        }

        const list = Array.from(files);
        const tooBig = list.find((file) => file.size > limits.upload);

        if (tooBig) {
            toast.error(t(':name is bigger than :size.', { name: tooBig.name, size: formatBytes(limits.upload) }));

            return;
        }

        const existing = new Set(listing?.entries.map((entry) => entry.name));
        const clashes = list.filter((file) => existing.has(file.name));
        const overwrite =
            clashes.length > 0 && window.confirm(t('Overwrite :names?', { names: clashes.map((file) => file.name).join(', ') }));

        if (clashes.length > 0 && !overwrite && clashes.length === list.length) {
            return;
        }

        const form = new FormData();
        form.append('directory', directory);
        form.append('overwrite', overwrite ? '1' : '0');
        list.filter((file) => overwrite || !existing.has(file.name)).forEach((file) => form.append('files[]', file));

        setUploading(t('Uploading :count files…', { count: list.length }));

        try {
            const answer = await serverUpload<{ message: string }>(FileManagerController.upload(serverId), form);
            toast.success(answer.message);
            await open(directory);
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setUploading(null);
        }
    };

    const remove = (items: Entry[]) => {
        const dirs = items.filter(isDir).length;
        const question =
            items.length === 1
                ? dirs
                    ? t('Delete the directory :name with everything in it? This cannot be undone.', { name: items[0].name })
                    : t('Delete :name? This cannot be undone.', { name: items[0].name })
                : t('Delete :count items? This cannot be undone.', { count: items.length });

        if (window.confirm(question)) {
            void act(FileManagerController.destroy(serverId!), { paths: items.map((entry) => join(directory, entry.name)) });
        }
    };

    const rename = (entry: Entry) =>
        setPrompt({
            title: t('Rename'),
            value: entry.name,
            confirm: t('Rename'),
            selectName: !isDir(entry),
            onSubmit: (name) =>
                act(FileManagerController.move(serverId!), { from: join(directory, entry.name), to: join(directory, name) }),
        });

    const moveOrCopy = (entry: Entry, copying: boolean) =>
        setPrompt({
            title: copying ? t('Copy to') : t('Move to'),
            description: t('The full path of the new place, including the name.'),
            value: join(directory, copying ? `${entry.name}.copy` : entry.name),
            confirm: copying ? t('Copy') : t('Move'),
            onSubmit: (to) => act(FileManagerController.move(serverId!), { from: join(directory, entry.name), to, copy: copying }),
        });

    const create = (type: 'file' | 'dir') =>
        setPrompt({
            title: type === 'dir' ? t('New directory') : t('New file'),
            value: '',
            confirm: t('Create'),
            onSubmit: async (name) => {
                const ok = await act(FileManagerController.create(serverId!), { directory, name, type });

                if (ok && type === 'file') {
                    setEditing(join(directory, name));
                }

                return ok;
            },
        });

    const compress = (items: Entry[]) =>
        setPrompt({
            title: t('Pack into an archive'),
            description: t('End the name with .tar.gz or .zip.'),
            value: `${items.length === 1 ? items[0].name : (directory.split('/').pop() || 'archive')}.tar.gz`,
            confirm: t('Pack'),
            selectName: true,
            onSubmit: (archive) =>
                act(FileManagerController.compress(serverId!), { directory, names: items.map((entry) => entry.name), archive }),
        });

    const measure = async (entry: Entry) => {
        const path = join(directory, entry.name);
        setSizes((current) => ({ ...current, [entry.name]: 'loading' }));

        try {
            const answer = await serverRequest<{ bytes: number }>(FileManagerController.size(serverId!), { path });
            setSizes((current) => ({ ...current, [entry.name]: answer.bytes }));
        } catch (e) {
            toast.error(errorMessage(e));
            setSizes((current) => {
                const next = { ...current };
                delete next[entry.name];

                return next;
            });
        }
    };

    const changePermissions = (items: Entry[], change: PermissionChange) =>
        act(FileManagerController.permissions(serverId!), {
            paths: items.map((entry) => join(directory, entry.name)),
            ...change,
        });

    const runSearch = async (query: string, contents: boolean) => {
        setSearch({ query, contents, results: null, truncated: false, loading: true });

        try {
            const answer = await serverRequest<{ results: SearchResult[]; truncated: boolean }>(
                FileManagerController.search(serverId!),
                { directory, query, contents },
            );
            setSearch({ query, contents, results: answer.results, truncated: answer.truncated, loading: false });
        } catch (e) {
            toast.error(errorMessage(e));
            setSearch((current) => (current ? { ...current, loading: false, results: [] } : null));
        }
    };

    const openEntry = (entry: Entry) => {
        if (isDir(entry)) {
            void open(join(directory, entry.name));
        } else if (entry.type === 'file' || entry.type === 'link') {
            setEditing(join(directory, entry.name));
        }
    };

    const toggleSort = (key: SortKey) => setSort((current) => ({ key, desc: current.key === key ? !current.desc : false }));

    const crumbs = directory === '/' ? [] : directory.split('/').filter(Boolean);
    const isBookmarked = bookmarks.includes(directory);

    return (
        <>
            <Head title={t('Files')} />

            <div
                className="mx-auto flex w-full max-w-[100rem] min-w-0 flex-col gap-4 p-4 md:p-6"
                onDragOver={(e) => {
                    if (canManage && listing && e.dataTransfer.types.includes('Files')) {
                        e.preventDefault();
                        setDragging(true);
                    }
                }}
                onDragLeave={(e) => {
                    if (e.currentTarget === e.target) {
                        setDragging(false);
                    }
                }}
                onDrop={(e) => {
                    if (canManage && e.dataTransfer.files.length > 0) {
                        e.preventDefault();
                        setDragging(false);
                        void upload(e.dataTransfer.files);
                    }
                }}
            >
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold">{t('Files')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Browse, edit, upload and download the files of a server. Every change is written to the activity log.')}
                    </p>
                </div>

                {servers.length === 0 ? (
                    <NoSshServers team={team} />
                ) : (
                    <>
                        <ServerToolbar servers={servers} server={server} onChange={setServer} loading={loading} onRefresh={refresh}>
                            {canManage && listing && (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => create('file')} disabled={busy}>
                                        <FilePlus className="size-3.5" />
                                        {t('New file')}
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => create('dir')} disabled={busy}>
                                        <FolderPlus className="size-3.5" />
                                        {t('New directory')}
                                    </Button>
                                    <Button size="sm" onClick={() => uploadInput.current?.click()} disabled={busy || uploading !== null}>
                                        {uploading ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" />}
                                        {t('Upload')}
                                    </Button>
                                    <input
                                        ref={uploadInput}
                                        type="file"
                                        multiple
                                        hidden
                                        onChange={(e) => {
                                            if (e.target.files) {
                                                void upload(e.target.files);
                                            }

                                            e.target.value = '';
                                        }}
                                    />
                                </>
                            )}
                        </ServerToolbar>

                        <PrivilegeNotice privilege={listing?.privilege} username={server?.username} />

                        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2">
                            <Button variant="ghost" size="sm" onClick={() => void open(null)} aria-label={t('Home directory')}>
                                <Home className="size-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void open(parent(directory))}
                                disabled={directory === '/'}
                                aria-label={t('Up')}
                            >
                                <ArrowUp className="size-4" />
                            </Button>

                            <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 text-sm" aria-label={t('Path')}>
                                <button type="button" className="rounded px-1.5 py-0.5 font-mono hover:bg-muted" onClick={() => void open('/')}>
                                    /
                                </button>
                                {crumbs.map((part, i) => (
                                    <span key={i} className="flex items-center gap-0.5">
                                        {i > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
                                        <button
                                            type="button"
                                            className="rounded px-1.5 py-0.5 font-mono hover:bg-muted"
                                            onClick={() => void open(`/${crumbs.slice(0, i + 1).join('/')}`)}
                                        >
                                            {part}
                                        </button>
                                    </span>
                                ))}
                            </nav>

                            <form
                                className="flex items-center gap-1"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void open(pathInput.trim() || '/');
                                }}
                            >
                                <Input
                                    value={pathInput}
                                    onChange={(e) => setPathInput(e.target.value)}
                                    className="h-8 w-64 font-mono text-xs"
                                    aria-label={t('Go to path')}
                                    placeholder="/etc/nginx"
                                />
                            </form>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" aria-label={t('Bookmarks')}>
                                        <Bookmark className={cn('size-4', isBookmarked && 'fill-current')} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64">
                                    <DropdownMenuLabel>{t('Bookmarks')}</DropdownMenuLabel>
                                    {bookmarks.map((path) => (
                                        <DropdownMenuItem key={path} onSelect={() => void open(path)} className="font-mono text-xs">
                                            <Folder className="size-3.5" />
                                            {path}
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={() =>
                                            setBookmarks(
                                                isBookmarked ? bookmarks.filter((b) => b !== directory) : [...bookmarks, directory],
                                            )
                                        }
                                    >
                                        <BookmarkPlus className="size-3.5" />
                                        {isBookmarked ? t('Remove this directory') : t('Add this directory')}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-48 flex-1 sm:max-w-xs">
                                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    placeholder={t('Filter this directory')}
                                    className="h-8 pl-8"
                                />
                            </div>
                            <SearchForm disabled={!listing} onSearch={(query, contents) => void runSearch(query, contents)} />
                            <Button variant="ghost" size="sm" onClick={() => setShowHidden(!showHidden)}>
                                {showHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                {showHidden ? t('Hide hidden files') : t('Show hidden files (:count)', { count: hiddenCount })}
                            </Button>
                        </div>

                        {selectedEntries.length > 0 && (
                            <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
                                <span className="text-sm font-medium">{t(':count selected', { count: selectedEntries.length })}</span>
                                {canManage && (
                                    <>
                                        <Button variant="outline" size="sm" onClick={() => setPermissionsFor(selectedEntries)} disabled={busy}>
                                            <ShieldCheck className="size-3.5" />
                                            {t('Permissions')}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => compress(selectedEntries)} disabled={busy}>
                                            <Archive className="size-3.5" />
                                            {t('Pack')}
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => remove(selectedEntries)} disabled={busy}>
                                            <Trash2 className="size-3.5" />
                                            {t('Delete')}
                                        </Button>
                                    </>
                                )}
                                {selectedEntries.every((entry) => entry.type === 'file') && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => selectedEntries.forEach((entry) => void download(join(directory, entry.name)))}
                                    >
                                        <Download className="size-3.5" />
                                        {t('Download')}
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setChecked(new Set())}>
                                    <X className="size-3.5" />
                                    {t('Clear')}
                                </Button>
                            </div>
                        )}

                        {error && <LoadError message={error} onRetry={refresh} />}

                        <section
                            className={cn(
                                'relative overflow-hidden rounded-xl border bg-card',
                                dragging && 'ring-2 ring-primary ring-offset-2',
                            )}
                        >
                            {dragging && (
                                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/10 text-sm font-medium">
                                    {t('Drop the files to upload them to :path', { path: directory })}
                                </div>
                            )}
                            {loading && !listing ? (
                                <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                                    <Spinner className="size-4" />
                                    {t('Connecting to the server…')}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                                            <tr>
                                                <th className="w-8 px-3 py-2">
                                                    <Checkbox
                                                        checked={entries.length > 0 && checked.size === entries.length}
                                                        onCheckedChange={(v) =>
                                                            setChecked(v === true ? new Set(entries.map((entry) => entry.name)) : new Set())
                                                        }
                                                        aria-label={t('Select all')}
                                                    />
                                                </th>
                                                <SortHeader label={t('Name')} active={sort} sortKey="name" onSort={toggleSort} />
                                                <SortHeader label={t('Size')} active={sort} sortKey="size" onSort={toggleSort} className="text-right" />
                                                <th className="hidden px-3 py-2 font-medium md:table-cell">{t('Permissions')}</th>
                                                <SortHeader label={t('Owner')} active={sort} sortKey="owner" onSort={toggleSort} className="hidden md:table-cell" />
                                                <SortHeader label={t('Modified')} active={sort} sortKey="mtime" onSort={toggleSort} className="hidden sm:table-cell" />
                                                <th className="w-10 px-3 py-2" />
                                            </tr>
                                        </thead>
                                        <tbody className={cn('divide-y', loading && 'opacity-60')}>
                                            {directory !== '/' && (
                                                <tr className="cursor-pointer hover:bg-muted/30" onDoubleClick={() => void open(parent(directory))}>
                                                    <td />
                                                    <td className="px-3 py-1.5" colSpan={6}>
                                                        <button type="button" className="flex items-center gap-2 text-muted-foreground" onClick={() => void open(parent(directory))}>
                                                            <FolderOpen className="size-4" />
                                                            ..
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                            {entries.length === 0 && listing && (
                                                <tr>
                                                    <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                                                        {filter ? t('Nothing matches the filter.') : t('The directory is empty.')}
                                                    </td>
                                                </tr>
                                            )}
                                            {entries.map((entry) => {
                                                const path = join(directory, entry.name);
                                                const measured = sizes[entry.name];

                                                return (
                                                    <tr
                                                        key={entry.name}
                                                        className={cn('group hover:bg-muted/30', checked.has(entry.name) && 'bg-primary/5')}
                                                        onDoubleClick={() => openEntry(entry)}
                                                    >
                                                        <td className="px-3 py-1.5">
                                                            <Checkbox
                                                                checked={checked.has(entry.name)}
                                                                onCheckedChange={(v) => {
                                                                    const next = new Set(checked);

                                                                    if (v === true) {
                                                                        next.add(entry.name);
                                                                    } else {
                                                                        next.delete(entry.name);
                                                                    }

                                                                    setChecked(next);
                                                                }}
                                                                aria-label={t('Select :name', { name: entry.name })}
                                                            />
                                                        </td>
                                                        <td className="max-w-0 px-3 py-1.5">
                                                            <button
                                                                type="button"
                                                                className="flex max-w-full items-center gap-2 text-left hover:underline"
                                                                onClick={() => openEntry(entry)}
                                                            >
                                                                <EntryIcon entry={entry} />
                                                                <span className={cn('truncate', entry.name.startsWith('.') && 'text-muted-foreground')}>
                                                                    {entry.name}
                                                                </span>
                                                                {entry.link_target && (
                                                                    <span className="truncate text-xs text-muted-foreground">→ {entry.link_target}</span>
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                                                            {isDir(entry) ? (
                                                                measured === 'loading' ? (
                                                                    <Spinner className="ml-auto size-3.5" />
                                                                ) : measured !== undefined ? (
                                                                    formatBytes(measured)
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className="text-xs opacity-0 group-hover:opacity-100 hover:underline"
                                                                        onClick={() => void measure(entry)}
                                                                    >
                                                                        {t('Measure')}
                                                                    </button>
                                                                )
                                                            ) : (
                                                                formatBytes(entry.size)
                                                            )}
                                                        </td>
                                                        <td className="hidden px-3 py-1.5 font-mono text-xs text-muted-foreground md:table-cell">
                                                            {canManage ? (
                                                                <button type="button" className="hover:underline" onClick={() => setPermissionsFor([entry])}>
                                                                    {modeString(entry.mode)} <span className="opacity-60">{entry.mode}</span>
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    {modeString(entry.mode)} <span className="opacity-60">{entry.mode}</span>
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className="hidden px-3 py-1.5 text-xs text-muted-foreground md:table-cell">
                                                            {entry.owner}:{entry.group}
                                                        </td>
                                                        <td className="hidden px-3 py-1.5 text-xs whitespace-nowrap text-muted-foreground sm:table-cell">
                                                            {new Date(entry.mtime * 1000).toLocaleString(locale)}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="h-7" aria-label={t('Actions for :name', { name: entry.name })}>
                                                                        <MoreHorizontal className="size-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-52">
                                                                    <DropdownMenuItem onSelect={() => openEntry(entry)}>
                                                                        {isDir(entry) ? <FolderOpen className="size-3.5" /> : <FileText className="size-3.5" />}
                                                                        {isDir(entry) ? t('Open') : canManage ? t('Edit') : t('View')}
                                                                    </DropdownMenuItem>
                                                                    {entry.type === 'file' && (
                                                                        <DropdownMenuItem onSelect={() => void download(path)}>
                                                                            <Download className="size-3.5" />
                                                                            {t('Download')}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem onSelect={() => void copy(path).then(() => toast.success(t('Path copied.')))}>
                                                                        <ClipboardCopy className="size-3.5" />
                                                                        {t('Copy path')}
                                                                    </DropdownMenuItem>
                                                                    {isDir(entry) && (
                                                                        <DropdownMenuItem onSelect={() => void measure(entry)}>
                                                                            <HardDrive className="size-3.5" />
                                                                            {t('Measure size')}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {canManage && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onSelect={() => rename(entry)}>
                                                                                <Pencil className="size-3.5" />
                                                                                {t('Rename')}
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => moveOrCopy(entry, true)}>
                                                                                <Copy className="size-3.5" />
                                                                                {t('Copy to…')}
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => moveOrCopy(entry, false)}>
                                                                                <FolderInput className="size-3.5" />
                                                                                {t('Move to…')}
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => setPermissionsFor([entry])}>
                                                                                <ShieldCheck className="size-3.5" />
                                                                                {t('Permissions')}
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem onSelect={() => compress([entry])}>
                                                                                <Archive className="size-3.5" />
                                                                                {t('Pack')}
                                                                            </DropdownMenuItem>
                                                                            {entry.type === 'file' && ARCHIVE.test(entry.name) && (
                                                                                <DropdownMenuItem
                                                                                    onSelect={() => void act(FileManagerController.extract(serverId!), { path })}
                                                                                >
                                                                                    <PackageOpen className="size-3.5" />
                                                                                    {t('Unpack here')}
                                                                                </DropdownMenuItem>
                                                                            )}
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem variant="destructive" onSelect={() => remove([entry])}>
                                                                                <Trash2 className="size-3.5" />
                                                                                {t('Delete')}
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {listing && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                                    <span>
                                        {t(':dirs directories, :files files', {
                                            dirs: entries.filter(isDir).length,
                                            files: entries.filter((entry) => !isDir(entry)).length,
                                        })}
                                        {listing.truncated && ` · ${t('Only the first 3000 entries are shown.')}`}
                                    </span>
                                    {canManage && <span>{t('Drop files here to upload them.')}</span>}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {editing && serverId !== null && (
                <FileEditor
                    serverId={serverId}
                    path={editing}
                    canEdit={canManage}
                    onClose={() => setEditing(null)}
                    onSaved={() => void open(directory)}
                    onDownload={(path) => void download(path)}
                />
            )}

            {prompt && <PromptDialog request={prompt} onClose={() => setPrompt(null)} />}

            {permissionsFor && (
                <PermissionsDialog
                    names={permissionsFor.map((entry) => entry.name)}
                    mode={permissionsFor[0].mode}
                    owner={permissionsFor[0].owner}
                    group={permissionsFor[0].group}
                    hasDirectory={permissionsFor.some(isDir)}
                    onClose={() => setPermissionsFor(null)}
                    onSubmit={(change) => changePermissions(permissionsFor, change)}
                />
            )}

            {search && (
                <Dialog open onOpenChange={(value) => !value && setSearch(null)}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>
                                {search.contents ? t('Files containing “:query”', { query: search.query }) : t('Names containing “:query”', { query: search.query })}
                            </DialogTitle>
                            <DialogDescription className="font-mono">{directory}</DialogDescription>
                        </DialogHeader>
                        {search.loading ? (
                            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                                <Spinner className="size-4" />
                                {t('Searching…')}
                            </div>
                        ) : search.results && search.results.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">{t('Nothing was found.')}</p>
                        ) : (
                            <ul className="max-h-[60vh] divide-y overflow-auto rounded-md border">
                                {search.results?.map((result) => (
                                    <li key={result.path} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40">
                                        {result.type === 'dir' ? <Folder className="size-4 text-sky-600" /> : <File className="size-4 text-muted-foreground" />}
                                        <button
                                            type="button"
                                            className="min-w-0 flex-1 truncate text-left font-mono text-xs hover:underline"
                                            onClick={() => {
                                                setSearch(null);

                                                if (result.type === 'dir') {
                                                    void open(result.path);
                                                } else {
                                                    void open(parent(result.path));
                                                    setEditing(result.path);
                                                }
                                            }}
                                        >
                                            {result.path}
                                        </button>
                                        <span className="text-xs text-muted-foreground">{result.type !== 'dir' && formatBytes(result.size)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {search.truncated && <p className="text-xs text-muted-foreground">{t('Only the first 300 results are shown.')}</p>}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

function SearchForm({ disabled, onSearch }: { disabled: boolean; onSearch: (query: string, contents: boolean) => void }) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [contents, setContents] = useState(false);

    return (
        <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
                e.preventDefault();

                if (query.trim().length >= 2) {
                    onSearch(query.trim(), contents);
                }
            }}
        >
            <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={contents ? t('Text inside files') : t('Find by name below here')}
                className="h-8 w-52"
                disabled={disabled}
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <Checkbox checked={contents} onCheckedChange={(v) => setContents(v === true)} />
                {t('In contents')}
            </label>
            <Button type="submit" variant="outline" size="sm" disabled={disabled || query.trim().length < 2}>
                <Search className="size-3.5" />
                {t('Search')}
            </Button>
        </form>
    );
}

function SortHeader({
    label,
    sortKey,
    active,
    onSort,
    className,
}: {
    label: string;
    sortKey: SortKey;
    active: { key: SortKey; desc: boolean };
    onSort: (key: SortKey) => void;
    className?: string;
}) {
    return (
        <th className={cn('px-3 py-2 font-medium', className)}>
            <button type="button" className="hover:text-foreground" onClick={() => onSort(sortKey)}>
                {label}
                {active.key === sortKey && (active.desc ? ' ↓' : ' ↑')}
            </button>
        </th>
    );
}

function EntryIcon({ entry }: { entry: Entry }) {
    if (entry.type === 'dir') {
        return <Folder className="size-4 shrink-0 fill-sky-500/20 text-sky-600" />;
    }

    if (entry.type === 'link') {
        return entry.link_dir ? (
            <Folder className="size-4 shrink-0 text-sky-600" />
        ) : (
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
        );
    }

    if (ARCHIVE.test(entry.name)) {
        return <Archive className="size-4 shrink-0 text-amber-600" />;
    }

    return <FileText className="size-4 shrink-0 text-muted-foreground" />;
}

FilesPage.layout = {
    breadcrumbs: [{ title: 'Files', href: index() }],
};
