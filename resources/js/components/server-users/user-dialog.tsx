import { KeyRound, Lock, Plus, ShieldCheck, Trash2, Unlock, UserX } from 'lucide-react';
import { useState } from 'react';
import ServerUserController from '@/actions/App/Http/Controllers/ServerUserController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

export type AuthorizedKey = {
    line: number;
    type: string;
    fingerprint: string | null;
    comment: string | null;
    options: string | null;
    raw: string;
    app_key: boolean;
};

export type ServerUser = {
    name: string;
    uid: number;
    gid: number;
    gecos: string;
    home: string;
    shell: string;
    system: boolean;
    primary_group: string;
    groups: string[];
    sudo: boolean;
    can_login: boolean;
    password: 'set' | 'locked' | 'none' | 'empty';
    changed_at: string | null;
    max_days: number | null;
    expires_at: string | null;
    disabled: boolean;
    last_login: { at: string | null; from: string | null } | null;
    sessions: number;
    keys: AuthorizedKey[];
    protected: boolean;
    is_login: boolean;
};

export type TeamKey = { id: number; name: string; algorithm: string; fingerprint: string };

type Route = { url: string; method: string };

type Tab = 'details' | 'password' | 'keys' | 'account';

/**
 * Everything about one user: name, shell, groups and sudo; password; SSH keys; switching off and deleting.
 */
export function UserDialog({
    serverId,
    user,
    groups,
    sudoGroup,
    shells,
    teamKeys,
    canManage,
    initialTab = 'details',
    act,
    onClose,
}: {
    serverId: number;
    user: ServerUser;
    groups: { name: string; system: boolean }[];
    sudoGroup: string | null;
    shells: string[];
    teamKeys: TeamKey[];
    canManage: boolean;
    initialTab?: Tab;
    act: (route: Route, payload: Record<string, unknown>) => Promise<boolean>;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>(initialTab);
    const [busy, setBusy] = useState(false);
    const [gecos, setGecos] = useState(user.gecos);
    const [shell, setShell] = useState(user.shell);
    const [memberOf, setMemberOf] = useState<Set<string>>(new Set(user.groups.filter((g) => g !== sudoGroup)));
    const [sudo, setSudo] = useState(user.sudo);
    const [showSystemGroups, setShowSystemGroups] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [forceChange, setForceChange] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [teamKey, setTeamKey] = useState<string>('');
    const [removeHome, setRemoveHome] = useState(false);
    const [killProcesses, setKillProcesses] = useState(user.sessions > 0);

    const run = async (route: Route, payload: Record<string, unknown>, close = false) => {
        setBusy(true);
        const ok = await act(route, payload);
        setBusy(false);

        if (ok && close) {
            onClose();
        }

        return ok;
    };

    const target = { server: serverId, user: user.name };
    const pickable = groups.filter(
        (g) => g.name !== sudoGroup && g.name !== user.primary_group && (showSystemGroups || !g.system || memberOf.has(g.name)),
    );
    const shellList = Array.from(new Set([...shells, user.shell]));
    const tabs: [Tab, string][] = [
        ['details', t('Details')],
        ['password', t('Password')],
        ['keys', t('SSH keys (:count)', { count: user.keys.length })],
        ['account', t('Account')],
    ];

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        {user.name}
                        {user.is_login && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-400">{t('used by the app')}</span>}
                        {user.sudo && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">sudo</span>}
                        {user.disabled && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">{t('switched off')}</span>}
                    </DialogTitle>
                    <DialogDescription className="font-mono text-xs">
                        uid {user.uid} · {user.home} · {user.shell}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-1.5" role="tablist">
                    {tabs.map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={tab === value}
                            onClick={() => setTab(value)}
                            className={cn(
                                'rounded-full border px-3 py-1 text-sm',
                                tab === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'details' && (
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void run(ServerUserController.update(target), { gecos, shell, groups: Array.from(memberOf), sudo });
                        }}
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="user-gecos">{t('Full name')}</Label>
                                <Input id="user-gecos" value={gecos} onChange={(e) => setGecos(e.target.value)} disabled={!canManage} maxLength={100} />
                            </div>
                            <div className="space-y-1">
                                <Label>{t('Shell')}</Label>
                                <Select value={shell} onValueChange={setShell} disabled={!canManage}>
                                    <SelectTrigger className="font-mono">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {shellList.map((s) => (
                                            <SelectItem key={s} value={s} className="font-mono">
                                                {s}
                                                {/(nologin|false)$/.test(s) && ` — ${t('no login')}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {sudoGroup && user.uid !== 0 && (
                            <label className="flex items-start gap-3 rounded-lg border p-3">
                                <Switch checked={sudo} onCheckedChange={setSudo} disabled={!canManage} />
                                <span>
                                    <span className="flex items-center gap-1.5 text-sm font-medium">
                                        <ShieldCheck className="size-4" />
                                        {t('Administrator (sudo)')}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {t('Member of the :group group: may run any command as root.', { group: sudoGroup })}
                                    </span>
                                </span>
                            </label>
                        )}

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>{t('Groups')}</Label>
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Checkbox checked={showSystemGroups} onCheckedChange={(v) => setShowSystemGroups(v === true)} />
                                    {t('Show system groups')}
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('Primary group: :group', { group: user.primary_group })}</p>
                            <div className="grid max-h-52 grid-cols-2 gap-1 overflow-auto rounded-md border p-2 sm:grid-cols-3">
                                {pickable.map((g) => (
                                    <label key={g.name} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                                        <Checkbox
                                            checked={memberOf.has(g.name)}
                                            disabled={!canManage}
                                            onCheckedChange={(v) => {
                                                const next = new Set(memberOf);

                                                if (v === true) {
                                                    next.add(g.name);
                                                } else {
                                                    next.delete(g.name);
                                                }

                                                setMemberOf(next);
                                            }}
                                        />
                                        <span className="truncate font-mono text-xs">{g.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {canManage && (
                            <div className="flex justify-end">
                                <Button type="submit" disabled={busy}>
                                    {busy && <Spinner className="size-3.5" />}
                                    {t('Save')}
                                </Button>
                            </div>
                        )}
                    </form>
                )}

                {tab === 'password' && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {
                                {
                                    set: t('The user has a password.'),
                                    locked: t('The password is locked.'),
                                    none: t('The user has no password and can log in only with an SSH key.'),
                                    empty: t('The password is empty: anyone can log in as this user!'),
                                }[user.password]
                            }
                            {user.changed_at && ` ${t('Last changed on :date.', { date: user.changed_at })}`}
                        </p>
                        {canManage && (
                            <form
                                className="space-y-3"
                                autoComplete="off"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void run(ServerUserController.password(target), {
                                        password: password || null,
                                        password_confirmation: confirmation || null,
                                        force_change: forceChange,
                                    }).then((ok) => {
                                        if (ok) {
                                            setPassword('');
                                            setConfirmation('');
                                        }
                                    });
                                }}
                            >
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="user-password">{t('New password')}</Label>
                                        <Input
                                            id="user-password"
                                            type="password"
                                            autoComplete="new-password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            minLength={8}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="user-password-confirmation">{t('Again')}</Label>
                                        <Input
                                            id="user-password-confirmation"
                                            type="password"
                                            autoComplete="new-password"
                                            value={confirmation}
                                            onChange={(e) => setConfirmation(e.target.value)}
                                        />
                                    </div>
                                </div>
                                {password !== '' && confirmation !== '' && password !== confirmation && (
                                    <p className="text-xs text-red-600">{t('The passwords do not match.')}</p>
                                )}
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox checked={forceChange} onCheckedChange={(v) => setForceChange(v === true)} />
                                    {t('Must choose a new password at the next login')}
                                </label>
                                <div className="flex flex-wrap justify-between gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={busy || user.password === 'none'}
                                        onClick={() => {
                                            if (window.confirm(t('Remove the password of :name? Only SSH keys will work.', { name: user.name }))) {
                                                void run(ServerUserController.password(target), { remove: true });
                                            }
                                        }}
                                    >
                                        {t('Remove password')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={busy || (password === '' && !forceChange) || (password !== '' && password !== confirmation)}
                                    >
                                        {busy && <Spinner className="size-3.5" />}
                                        {t('Change password')}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {tab === 'keys' && (
                    <div className="space-y-4">
                        {user.keys.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('No SSH key can log in as this user.')}</p>
                        ) : (
                            <ul className="divide-y rounded-md border">
                                {user.keys.map((key) => (
                                    <li key={`${key.line}-${key.fingerprint}`} className="flex items-center gap-3 px-3 py-2">
                                        <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm">
                                                {key.comment ?? t('without a comment')}
                                                {key.app_key && (
                                                    <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-400">
                                                        {t('the app logs in with it')}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                                                {key.type} · {key.fingerprint}
                                                {key.options && ` · ${key.options}`}
                                            </p>
                                        </div>
                                        {canManage && key.fingerprint && !key.app_key && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={busy}
                                                aria-label={t('Remove key')}
                                                onClick={() => {
                                                    if (window.confirm(t('Remove the key :name? It will not be able to log in any more.', { name: key.comment ?? key.fingerprint ?? '' }))) {
                                                        void run(ServerUserController.destroyKey(target), { fingerprint: key.fingerprint });
                                                    }
                                                }}
                                            >
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {canManage && (
                            <form
                                className="space-y-2 rounded-lg border p-3"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void run(
                                        ServerUserController.storeKey(target),
                                        teamKey ? { team_key_id: Number(teamKey) } : { key: newKey },
                                    ).then((ok) => {
                                        if (ok) {
                                            setNewKey('');
                                            setTeamKey('');
                                        }
                                    });
                                }}
                            >
                                <Label>{t('Add a key')}</Label>
                                {teamKeys.length > 0 && (
                                    <Select value={teamKey} onValueChange={(v) => setTeamKey(v === 'paste' ? '' : v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('One of the team keys…')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="paste">{t('Paste a public key below')}</SelectItem>
                                            {teamKeys.map((key) => (
                                                <SelectItem key={key.id} value={String(key.id)}>
                                                    {key.name} · {key.algorithm}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {!teamKey && (
                                    <textarea
                                        value={newKey}
                                        onChange={(e) => setNewKey(e.target.value)}
                                        rows={3}
                                        placeholder="ssh-ed25519 AAAAC3Nza… you@laptop"
                                        className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    />
                                )}
                                <div className="flex justify-end">
                                    <Button type="submit" size="sm" disabled={busy || (!teamKey && newKey.trim() === '')}>
                                        <Plus className="size-3.5" />
                                        {t('Add key')}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {tab === 'account' && (
                    <div className="space-y-4">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <dt className="text-muted-foreground">{t('Last login')}</dt>
                            <dd>
                                {user.last_login?.at ? new Date(user.last_login.at).toLocaleString() : t('never')}
                                {user.last_login?.from && ` · ${user.last_login.from}`}
                            </dd>
                            <dt className="text-muted-foreground">{t('Open sessions')}</dt>
                            <dd>{user.sessions}</dd>
                            <dt className="text-muted-foreground">{t('Account expires')}</dt>
                            <dd>{user.expires_at ?? t('never')}</dd>
                        </dl>

                        {user.protected ? (
                            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                                {t('The app logs in as this user (or it is root), so it cannot be switched off or deleted here.')}
                            </p>
                        ) : (
                            canManage && (
                                <>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                        <div>
                                            <p className="text-sm font-medium">{user.disabled ? t('The account is off') : t('Switch the account off')}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {t('A switched off account cannot log in at all, not even with a key. Its files stay.')}
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            disabled={busy}
                                            onClick={() => void run(ServerUserController.enabled(target), { enabled: user.disabled })}
                                        >
                                            {user.disabled ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                                            {user.disabled ? t('Switch on') : t('Switch off')}
                                        </Button>
                                    </div>

                                    {!user.system && (
                                        <div className="space-y-2 rounded-lg border border-red-500/40 p-3">
                                            <p className="text-sm font-medium text-red-600">{t('Delete the user')}</p>
                                            <label className="flex items-center gap-2 text-sm">
                                                <Checkbox checked={removeHome} onCheckedChange={(v) => setRemoveHome(v === true)} />
                                                {t('Also delete :home with all files', { home: user.home })}
                                            </label>
                                            <label className="flex items-center gap-2 text-sm">
                                                <Checkbox checked={killProcesses} onCheckedChange={(v) => setKillProcesses(v === true)} />
                                                {t('End its sessions and processes first')}
                                            </label>
                                            <div className="flex justify-end">
                                                <Button
                                                    variant="destructive"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        if (window.confirm(t('Delete the user :name? This cannot be undone.', { name: user.name }))) {
                                                            void run(
                                                                ServerUserController.destroy(target),
                                                                { remove_home: removeHome, kill_processes: killProcesses },
                                                                true,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <UserX className="size-3.5" />
                                                    {t('Delete user')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
