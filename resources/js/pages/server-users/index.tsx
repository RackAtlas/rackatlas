import { Head } from '@inertiajs/react';
import { Ban, KeyRound, LogOut, Plus, ShieldAlert, ShieldCheck, Trash2, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import FirewallController from '@/actions/App/Http/Controllers/FirewallController';
import ServerUserController from '@/actions/App/Http/Controllers/ServerUserController';
import { PromptDialog, type PromptRequest } from '@/components/server-tools/prompt-dialog';
import {
    LoadError,
    LoadingBlock,
    NoSshServers,
    PrivilegeNotice,
    ServerToolbar,
    useSelectedServer,
    type SshServer,
} from '@/components/server-tools/server-picker';
import { UserDialog, type ServerUser, type TeamKey } from '@/components/server-users/user-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/use-permissions';
import { useServerData } from '@/hooks/use-server-data';
import { useTranslation } from '@/hooks/use-translation';
import { timeAgo } from '@/lib/dashboard';
import { errorMessage, serverRequest } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { index } from '@/routes/server-users';

type Group = { name: string; gid: number; members: string[]; system: boolean; primary_of: string[] };
type Session = { user: string; tty: string; since: string | null; idle: string | null; pid: number | null; from: string | null };
type Login = { user: string; tty: string; from: string | null; at: string | null; until: string | null; active: boolean };
type Failure = { user: string; from: string; at: string | null; invalid_user: boolean };

type Overview = {
    privilege: string;
    login: string;
    users: ServerUser[];
    groups: Group[];
    sudo_group: string | null;
    shells: string[];
    sessions: Session[];
    logins: Login[];
    failures: Failure[];
    sshd: { settings: Record<string, string>; manageable: boolean };
    app: { username: string; auth: string; key_fingerprint: string | null };
    fetched_at: string;
};

type Props = {
    team: { id: number; name: string } | null;
    servers: SshServer[];
    canManage: boolean;
    selected: number | null;
    teamKeys: TeamKey[];
};

type Tab = 'users' | 'groups' | 'logins' | 'ssh';

type Route = { url: string; method: string };

const PASSWORD_STYLE: Record<ServerUser['password'], string> = {
    set: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    locked: 'bg-muted text-muted-foreground',
    none: 'bg-muted text-muted-foreground',
    empty: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

export default function ServerUsersPage({ team, servers, canManage, selected, teamKeys }: Props) {
    const { t, locale } = useTranslation();
    const { can } = usePermissions();
    const [server, setServer] = useSelectedServer(servers, selected);
    const { data, error, loading, reload } = useServerData<Overview>((id) => ServerUserController.show(id), server?.id ?? null);
    const [tab, setTab] = useState<Tab>('users');
    const [showSystem, setShowSystem] = useState(false);
    const [search, setSearch] = useState('');
    const [opened, setOpened] = useState<{ name: string; tab?: 'details' | 'password' | 'keys' | 'account' } | null>(null);
    const [creating, setCreating] = useState(false);
    const [prompt, setPrompt] = useState<PromptRequest | null>(null);
    const [busy, setBusy] = useState(false);

    const act = async (route: Route, payload: Record<string, unknown>): Promise<boolean> => {
        setBusy(true);

        try {
            const answer = await serverRequest<{ message: string }>(route, payload);
            toast.success(answer.message);
            await reload(true);

            return true;
        } catch (e) {
            toast.error(errorMessage(e));

            return false;
        } finally {
            setBusy(false);
        }
    };

    const query = search.trim().toLowerCase();
    const users = (data?.users ?? []).filter(
        (u) => (showSystem || !u.system) && (query === '' || u.name.includes(query) || u.gecos.toLowerCase().includes(query)),
    );
    const groups = (data?.groups ?? []).filter((g) => (showSystem || !g.system) && (query === '' || g.name.includes(query)));
    const openedUser = data?.users.find((u) => u.name === opened?.name) ?? null;

    const failuresByAddress = useMemo(() => {
        const byAddress = new Map<string, { from: string; count: number; users: Set<string>; last: string | null }>();

        (data?.failures ?? []).forEach((failure) => {
            const entry = byAddress.get(failure.from) ?? { from: failure.from, count: 0, users: new Set<string>(), last: null };
            entry.count += 1;
            entry.users.add(failure.user);
            entry.last = entry.last && failure.at && entry.last > failure.at ? entry.last : (failure.at ?? entry.last);
            byAddress.set(failure.from, entry);
        });

        return Array.from(byAddress.values()).sort((a, b) => b.count - a.count);
    }, [data]);

    const warnings = useMemo(() => {
        if (!data) {
            return [];
        }

        const list: string[] = [];
        const empty = data.users.filter((u) => u.password === 'empty');

        if (empty.length > 0) {
            list.push(t('Users with an empty password: :names. Anyone can log in as them.', { names: empty.map((u) => u.name).join(', ') }));
        }

        if (data.sshd.settings.permitrootlogin === 'yes') {
            list.push(t('root may log in over SSH with a password.'));
        }

        if (data.sshd.settings.passwordauthentication === 'yes' && failuresByAddress.length > 20) {
            list.push(t('Password logins are on and :count addresses tried to guess passwords in the last days.', { count: failuresByAddress.length }));
        }

        const uidZero = data.users.filter((u) => u.uid === 0 && u.name !== 'root');

        if (uidZero.length > 0) {
            list.push(t('These users have uid 0 and are root as well: :names', { names: uidZero.map((u) => u.name).join(', ') }));
        }

        return list;
    }, [data, failuresByAddress, t]);

    const blockAddress = (address: string) => {
        if (!server || !window.confirm(t('Block every connection from :ip in the firewall?', { ip: address }))) {
            return;
        }

        void act(FirewallController.storeRule(server.id), {
            action: 'deny',
            direction: 'in',
            protocol: 'any',
            from: address,
            comment: 'Blocked from Users',
            first: true,
            safety: 0,
        });
    };

    const tabs: [Tab, string, number][] = data
        ? [
              ['users', t('Users'), data.users.filter((u) => !u.system).length],
              ['groups', t('Groups'), data.groups.filter((g) => !g.system).length],
              ['logins', t('Logins'), data.sessions.length],
              ['ssh', t('SSH access'), warnings.length],
          ]
        : [];

    return (
        <>
            <Head title={t('Server users')} />

            <div className="mx-auto flex w-full max-w-[100rem] min-w-0 flex-col gap-5 p-4 md:p-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold">{t('Server users')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Linux users and groups, their SSH keys and passwords, who is logged in, failed logins and the SSH login settings.')}
                    </p>
                </div>

                {servers.length === 0 ? (
                    <NoSshServers team={team} />
                ) : (
                    <>
                        <ServerToolbar
                            servers={servers}
                            server={server}
                            onChange={setServer}
                            loading={loading}
                            fetchedAt={data?.fetched_at}
                            onRefresh={() => void reload()}
                        >
                            {canManage && data && (
                                <Button size="sm" onClick={() => setCreating(true)}>
                                    <UserPlus className="size-3.5" />
                                    {t('New user')}
                                </Button>
                            )}
                        </ServerToolbar>

                        {error && !data && <LoadError message={error} onRetry={() => void reload()} />}
                        {!data && !error && <LoadingBlock />}

                        {data && server && (
                            <>
                                <PrivilegeNotice privilege={data.privilege} username={server.username} />

                                {warnings.length > 0 && (
                                    <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                                        {warnings.map((warning) => (
                                            <p key={warning} className="flex items-start gap-2">
                                                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                                {warning}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                                    {tabs.map(([value, label, count]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            role="tab"
                                            aria-selected={tab === value}
                                            onClick={() => setTab(value)}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                                                tab === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                                            )}
                                        >
                                            {label}
                                            <span className="text-xs opacity-70">{count}</span>
                                        </button>
                                    ))}

                                    {(tab === 'users' || tab === 'groups') && (
                                        <div className="ml-auto flex items-center gap-2">
                                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Checkbox checked={showSystem} onCheckedChange={(v) => setShowSystem(v === true)} />
                                                {t('Show system accounts')}
                                            </label>
                                            <Input
                                                type="search"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder={t('Search')}
                                                className="h-8 w-48"
                                            />
                                            {tab === 'groups' && canManage && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setPrompt({
                                                            title: t('New group'),
                                                            value: '',
                                                            confirm: t('Create'),
                                                            onSubmit: (name) => act(ServerUserController.storeGroup(server.id), { name }),
                                                        })
                                                    }
                                                >
                                                    <Plus className="size-3.5" />
                                                    {t('New group')}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {tab === 'users' && (
                                    <section className="overflow-hidden rounded-xl border bg-card">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                                                    <tr>
                                                        <th className="px-4 py-2 font-medium">{t('User')}</th>
                                                        <th className="px-4 py-2 font-medium">{t('Groups')}</th>
                                                        <th className="px-4 py-2 font-medium">{t('Password')}</th>
                                                        <th className="px-4 py-2 font-medium">{t('SSH keys')}</th>
                                                        <th className="hidden px-4 py-2 font-medium lg:table-cell">{t('Last login')}</th>
                                                        <th className="hidden px-4 py-2 font-medium md:table-cell">{t('Shell')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {users.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                                                {t('No user matches.')}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {users.map((u) => (
                                                        <tr
                                                            key={u.name}
                                                            className={cn('cursor-pointer hover:bg-muted/30', (u.disabled || u.system) && 'opacity-60')}
                                                            onClick={() => setOpened({ name: u.name })}
                                                        >
                                                            <td className="px-4 py-2">
                                                                <p className="flex flex-wrap items-center gap-1.5 font-medium">
                                                                    <span className={cn('size-2 rounded-full', u.sessions > 0 ? 'bg-emerald-500' : 'bg-transparent')} title={u.sessions > 0 ? t('Logged in now') : undefined} />
                                                                    {u.name}
                                                                    {u.sudo && <span className="rounded bg-amber-500/15 px-1.5 text-[10px] text-amber-700 dark:text-amber-400">sudo</span>}
                                                                    {u.is_login && <span className="rounded bg-sky-500/15 px-1.5 text-[10px] text-sky-700 dark:text-sky-400">{t('app')}</span>}
                                                                    {u.disabled && <span className="rounded bg-red-500/15 px-1.5 text-[10px] text-red-700 dark:text-red-400">{t('off')}</span>}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {u.gecos || '—'} · uid {u.uid}
                                                                </p>
                                                            </td>
                                                            <td className="max-w-xs px-4 py-2">
                                                                <p className="truncate text-xs text-muted-foreground">{[u.primary_group, ...u.groups.filter((g) => g !== u.primary_group)].join(', ')}</p>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', PASSWORD_STYLE[u.password])}>
                                                                    {{ set: t('set'), locked: t('locked'), none: t('none'), empty: t('empty!') }[u.password]}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <button
                                                                    type="button"
                                                                    className="flex items-center gap-1 text-xs hover:underline"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpened({ name: u.name, tab: 'keys' });
                                                                    }}
                                                                >
                                                                    <KeyRound className="size-3.5 text-muted-foreground" />
                                                                    {u.keys.length}
                                                                </button>
                                                            </td>
                                                            <td className="hidden px-4 py-2 text-xs text-muted-foreground lg:table-cell">
                                                                {u.last_login?.at ? timeAgo(u.last_login.at, data.fetched_at, locale) : t('never')}
                                                                {u.last_login?.from && <span className="font-mono"> · {u.last_login.from}</span>}
                                                            </td>
                                                            <td className="hidden px-4 py-2 font-mono text-xs text-muted-foreground md:table-cell">{u.shell}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                )}

                                {tab === 'groups' && (
                                    <section className="overflow-hidden rounded-xl border bg-card">
                                        <ul className="divide-y">
                                            {groups.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t('No group matches.')}</li>}
                                            {groups.map((g) => {
                                                const members = Array.from(new Set([...g.primary_of, ...g.members]));

                                                return (
                                                    <li key={g.name} className={cn('flex flex-wrap items-center gap-3 px-4 py-2', g.system && 'opacity-60')}>
                                                        <Users className="size-4 text-muted-foreground" />
                                                        <span className="w-40 font-mono text-sm font-medium">{g.name}</span>
                                                        <span className="text-xs text-muted-foreground">gid {g.gid}</span>
                                                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                                            {members.length > 0 ? members.join(', ') : t('no members')}
                                                        </span>
                                                        {canManage && !g.system && g.primary_of.length === 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={busy}
                                                                aria-label={t('Delete group')}
                                                                onClick={() => {
                                                                    if (window.confirm(t('Delete the group :name?', { name: g.name }))) {
                                                                        void act(ServerUserController.destroyGroup({ server: server.id, group: g.name }), {});
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </Button>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                )}

                                {tab === 'logins' && (
                                    <div className="space-y-4">
                                        <section className="overflow-hidden rounded-xl border bg-card">
                                            <h2 className="border-b px-4 py-3 font-semibold">{t('Logged in now')}</h2>
                                            {data.sessions.length === 0 ? (
                                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('Nobody is logged in.')}</p>
                                            ) : (
                                                <ul className="divide-y">
                                                    {data.sessions.map((session) => (
                                                        <li key={`${session.tty}-${session.pid}`} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                                                            <span className="size-2 rounded-full bg-emerald-500" />
                                                            <span className="w-32 font-medium">{session.user}</span>
                                                            <span className="font-mono text-xs text-muted-foreground">{session.tty}</span>
                                                            <span className="font-mono text-xs">{session.from ?? t('local')}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {session.since && t('since :time', { time: timeAgo(session.since, data.fetched_at, locale) })}
                                                                {session.idle && ` · ${t('idle :idle', { idle: session.idle })}`}
                                                            </span>
                                                            {canManage && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="ml-auto"
                                                                    disabled={busy}
                                                                    onClick={() => {
                                                                        if (window.confirm(t('End the session of :user on :tty?', { user: session.user, tty: session.tty }))) {
                                                                            void act(ServerUserController.endSession(server.id), { tty: session.tty });
                                                                        }
                                                                    }}
                                                                >
                                                                    <LogOut className="size-3.5" />
                                                                    {t('End session')}
                                                                </Button>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </section>

                                        <section className="overflow-hidden rounded-xl border bg-card">
                                            <div className="flex items-center gap-2 border-b px-4 py-3">
                                                <ShieldAlert className="size-4 text-red-600" />
                                                <h2 className="font-semibold">{t('Failed logins in the last 7 days')}</h2>
                                                <span className="text-xs text-muted-foreground">{data.failures.length}</span>
                                            </div>
                                            {failuresByAddress.length === 0 ? (
                                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('No failed logins.')}</p>
                                            ) : (
                                                <div className="max-h-96 overflow-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                                                            <tr>
                                                                <th className="px-4 py-2 font-medium">{t('Address')}</th>
                                                                <th className="px-4 py-2 font-medium">{t('Attempts')}</th>
                                                                <th className="px-4 py-2 font-medium">{t('Users tried')}</th>
                                                                <th className="px-4 py-2 font-medium">{t('Last')}</th>
                                                                <th className="px-4 py-2" />
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {failuresByAddress.map((entry) => (
                                                                <tr key={entry.from}>
                                                                    <td className="px-4 py-1.5 font-mono text-xs">{entry.from}</td>
                                                                    <td className="px-4 py-1.5 tabular-nums">{entry.count}</td>
                                                                    <td className="max-w-xs truncate px-4 py-1.5 text-xs text-muted-foreground">{Array.from(entry.users).join(', ')}</td>
                                                                    <td className="px-4 py-1.5 text-xs text-muted-foreground">{entry.last ? timeAgo(entry.last, data.fetched_at, locale) : '—'}</td>
                                                                    <td className="px-4 py-1.5 text-right">
                                                                        {can('firewall.edit') && (
                                                                            <Button variant="ghost" size="sm" disabled={busy} onClick={() => blockAddress(entry.from)}>
                                                                                <Ban className="size-3.5" />
                                                                                {t('Block')}
                                                                            </Button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </section>

                                        <section className="overflow-hidden rounded-xl border bg-card">
                                            <h2 className="border-b px-4 py-3 font-semibold">{t('Recent logins')}</h2>
                                            {data.logins.length === 0 ? (
                                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('No logins are recorded.')}</p>
                                            ) : (
                                                <ul className="max-h-96 divide-y overflow-auto">
                                                    {data.logins.map((login, i) => (
                                                        <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-1.5 text-sm">
                                                            <span className="w-32 font-medium">{login.user}</span>
                                                            <span className="font-mono text-xs">{login.from ?? t('local')}</span>
                                                            <span className="text-xs text-muted-foreground">{login.at ? new Date(login.at).toLocaleString(locale) : '—'}</span>
                                                            {login.active && <span className="text-xs text-emerald-600">{t('still logged in')}</span>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </section>
                                    </div>
                                )}

                                {tab === 'ssh' && (
                                    <SshSettings
                                        overview={data}
                                        canManage={canManage}
                                        busy={busy}
                                        onChange={(setting, value) => {
                                            if (window.confirm(t('Change :setting to :value and reload sshd? The configuration is tested first.', { setting, value }))) {
                                                void act(ServerUserController.sshd(server.id), { setting, value });
                                            }
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {openedUser && data && server && (
                <UserDialog
                    key={openedUser.name}
                    serverId={server.id}
                    user={openedUser}
                    groups={data.groups}
                    sudoGroup={data.sudo_group}
                    shells={data.shells}
                    teamKeys={teamKeys}
                    canManage={canManage}
                    initialTab={opened?.tab}
                    act={act}
                    onClose={() => setOpened(null)}
                />
            )}

            {creating && data && server && (
                <CreateUserDialog
                    overview={data}
                    teamKeys={teamKeys}
                    onClose={() => setCreating(false)}
                    onSubmit={(payload) => act(ServerUserController.store(server.id), payload)}
                />
            )}

            {prompt && <PromptDialog request={prompt} onClose={() => setPrompt(null)} />}
        </>
    );
}

function SshSettings({
    overview,
    canManage,
    busy,
    onChange,
}: {
    overview: Overview;
    canManage: boolean;
    busy: boolean;
    onChange: (setting: string, value: string) => void;
}) {
    const { t } = useTranslation();
    const settings = overview.sshd.settings;
    const editable = canManage && overview.sshd.manageable;

    const rows: { key: string; label: string; hint: string; values?: string[] }[] = [
        { key: 'port', label: t('Port'), hint: t('The port sshd listens on.') },
        {
            key: 'permitrootlogin',
            label: t('root login'),
            hint: t('prohibit-password lets root in only with a key, no turns root login off.'),
            values: ['yes', 'prohibit-password', 'no'],
        },
        {
            key: 'passwordauthentication',
            label: t('Password login'),
            hint: t('With no, only SSH keys can log in. Passwords cannot be guessed any more.'),
            values: ['yes', 'no'],
        },
        { key: 'pubkeyauthentication', label: t('Key login'), hint: t('Logging in with SSH keys.') },
        { key: 'maxauthtries', label: t('Attempts per connection'), hint: t('How many wrong tries before the connection is closed.') },
        { key: 'allowusers', label: 'AllowUsers', hint: t('Only these users may log in, when set.') },
        { key: 'allowgroups', label: 'AllowGroups', hint: t('Only members of these groups may log in, when set.') },
    ];

    return (
        <section className="space-y-4 rounded-xl border bg-card p-4">
            {Object.keys(settings).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('The sshd settings could not be read (sshd -T needs root).')}</p>
            ) : (
                <ul className="divide-y">
                    {rows.map((row) => (
                        <li key={row.key} className="flex flex-wrap items-center gap-3 py-2.5">
                            <div className="min-w-0 flex-1 basis-64">
                                <p className="text-sm font-medium">{row.label}</p>
                                <p className="text-xs text-muted-foreground">{row.hint}</p>
                            </div>
                            {row.values && editable ? (
                                <Select value={settings[row.key]} onValueChange={(value) => onChange(row.key, value)} disabled={busy}>
                                    <SelectTrigger className="w-52 font-mono">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {row.values.map((value) => (
                                            <SelectItem key={value} value={value} className="font-mono">
                                                {value}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <span className="font-mono text-sm">{settings[row.key] ?? '—'}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                {overview.sshd.manageable
                    ? t('Changes go to /etc/ssh/sshd_config.d/00-rackatlas.conf, are tested with sshd -t and only then loaded. The app logs in as :user with :auth, so settings that would lock it out are refused.', {
                          user: overview.app.username,
                          auth: overview.app.auth === 'key' ? t('an SSH key') : t('a password'),
                      })
                    : t('This sshd_config does not include sshd_config.d, so the settings are shown read-only.')}
            </p>
        </section>
    );
}

function CreateUserDialog({
    overview,
    teamKeys,
    onClose,
    onSubmit,
}: {
    overview: Overview;
    teamKeys: TeamKey[];
    onClose: () => void;
    onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
    const { t } = useTranslation();
    const defaultShell = overview.shells.find((s) => s.endsWith('/bash')) ?? overview.shells[0] ?? '/bin/sh';
    const [name, setName] = useState('');
    const [gecos, setGecos] = useState('');
    const [shell, setShell] = useState(defaultShell);
    const [home, setHome] = useState(true);
    const [sudo, setSudo] = useState(false);
    const [groups, setGroups] = useState<Set<string>>(new Set());
    const [password, setPassword] = useState('');
    const [key, setKey] = useState('');
    const [teamKey, setTeamKey] = useState('');
    const [busy, setBusy] = useState(false);

    const validName = /^[a-z_][a-z0-9_-]{0,31}$/.test(name);
    const taken = overview.users.some((u) => u.name === name);
    const choosable = overview.groups.filter((g) => g.name !== overview.sudo_group && (!g.system || ['docker', 'www-data', 'adm', 'systemd-journal'].includes(g.name)));

    const submit = async () => {
        setBusy(true);
        const ok = await onSubmit({
            name,
            gecos: gecos || null,
            shell,
            home,
            sudo,
            groups: Array.from(groups),
            password: password || null,
            key: teamKey ? null : key || null,
            team_key_id: teamKey ? Number(teamKey) : null,
        });
        setBusy(false);

        if (ok) {
            onClose();
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('New user')}</DialogTitle>
                    <DialogDescription>{t('Give a password, an SSH key or both, so the user can log in.')}</DialogDescription>
                </DialogHeader>

                <form
                    id="create-user"
                    className="space-y-4"
                    autoComplete="off"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="new-user-name">{t('Username')}</Label>
                            <Input id="new-user-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} className="font-mono" autoFocus />
                            {name !== '' && !validName && <p className="text-xs text-red-600">{t('Names are lower case letters, digits, - and _, starting with a letter.')}</p>}
                            {taken && <p className="text-xs text-red-600">{t('A user with this name exists already.')}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="new-user-gecos">{t('Full name')}</Label>
                            <Input id="new-user-gecos" value={gecos} onChange={(e) => setGecos(e.target.value)} maxLength={100} />
                        </div>
                        <div className="space-y-1">
                            <Label>{t('Shell')}</Label>
                            <Select value={shell} onValueChange={setShell}>
                                <SelectTrigger className="font-mono">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {overview.shells.map((s) => (
                                        <SelectItem key={s} value={s} className="font-mono">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="new-user-password">{t('Password')}</Label>
                            <Input
                                id="new-user-password"
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('Optional, at least 8 characters')}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={home} onCheckedChange={(v) => setHome(v === true)} />
                            {t('Create the home directory')}
                        </label>
                        {overview.sudo_group && (
                            <label className="flex items-center gap-2 text-sm">
                                <Switch checked={sudo} onCheckedChange={setSudo} />
                                {t('Administrator (sudo)')}
                            </label>
                        )}
                    </div>

                    {choosable.length > 0 && (
                        <div className="space-y-1">
                            <Label>{t('Groups')}</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {choosable.map((g) => (
                                    <button
                                        key={g.name}
                                        type="button"
                                        onClick={() => {
                                            const next = new Set(groups);

                                            if (!next.delete(g.name)) {
                                                next.add(g.name);
                                            }

                                            setGroups(next);
                                        }}
                                        className={cn(
                                            'rounded-full border px-2.5 py-0.5 font-mono text-xs',
                                            groups.has(g.name) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                                        )}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label>{t('SSH key')}</Label>
                        {teamKeys.length > 0 && (
                            <Select value={teamKey} onValueChange={(v) => setTeamKey(v === 'paste' ? '' : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('One of the team keys…')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="paste">{t('Paste a public key below')}</SelectItem>
                                    {teamKeys.map((k) => (
                                        <SelectItem key={k.id} value={String(k.id)}>
                                            {k.name} · {k.algorithm}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {!teamKey && (
                            <textarea
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                rows={3}
                                placeholder="ssh-ed25519 AAAAC3Nza… you@laptop"
                                className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                        )}
                    </div>
                </form>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button type="submit" form="create-user" disabled={busy || !validName || taken || (password !== '' && password.length < 8)}>
                        {busy && <Spinner className="size-3.5" />}
                        {t('Create user')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

ServerUsersPage.layout = {
    breadcrumbs: [{ title: 'Server users', href: index() }],
};
