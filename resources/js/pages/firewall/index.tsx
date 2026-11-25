import { Head } from '@inertiajs/react';
import {
    Ban,
    CheckCircle2,
    Clock,
    Lock,
    Plus,
    Power,
    RotateCcw,
    ShieldCheck,
    ShieldOff,
    Trash2,
    TriangleAlert,
    Unlock,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import FirewallController from '@/actions/App/Http/Controllers/FirewallController';
import {
    LoadError,
    LoadingBlock,
    NoSshServers,
    PrivilegeNotice,
    ServerToolbar,
    useSelectedServer,
    type SshServer,
} from '@/components/server-tools/server-picker';
import { Badge } from '@/components/ui/badge';
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
import { useServerData } from '@/hooks/use-server-data';
import { useTranslation } from '@/hooks/use-translation';
import { errorMessage, ServerApiError, serverRequest } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { index } from '@/routes/firewall';

type Rule = {
    spec: string;
    action: 'allow' | 'deny' | 'reject' | 'limit';
    direction: 'in' | 'out';
    port: string | null;
    protocol: string;
    from: string;
    to: string;
    interface: string | null;
    app: string | null;
    comment: string | null;
    route: boolean;
};

type Port = {
    protocol: string;
    address: string;
    port: number;
    process: string | null;
    public: boolean;
    state: 'local' | 'open' | 'allowed' | 'blocked';
};

type Jail = {
    name: string;
    currently_failed: number;
    total_failed: number;
    currently_banned: number;
    total_banned: number;
    banned: string[];
    files: string | null;
};

type Pending = {
    token: string;
    expires_at: string;
    summary: string;
    reachable: boolean;
};

type Overview = {
    privilege: string;
    backend: 'ufw' | 'firewalld' | 'nftables' | 'iptables' | null;
    active: boolean;
    logging: string | null;
    defaults: {
        incoming: string | null;
        outgoing: string | null;
        routed: string | null;
    };
    rules: Rule[];
    apps: string[];
    ports: Port[];
    ssh_port: number;
    ssh_allowed: boolean;
    raw: string | null;
    fail2ban: 'running' | 'stopped' | 'missing';
    jails: Jail[];
    pending: Pending | null;
    fetched_at: string;
};

type ChangeAnswer = { message: string; pending: Pending | null };

type Props = {
    team: { id: number; name: string } | null;
    servers: SshServer[];
    canManage: boolean;
    selected: number | null;
};

type RuleForm = {
    action: Rule['action'];
    direction: 'in' | 'out';
    port: string;
    protocol: 'any' | 'tcp' | 'udp';
    from: string;
    interface: string;
    comment: string;
    first: boolean;
};

const EMPTY_RULE: RuleForm = {
    action: 'allow',
    direction: 'in',
    port: '',
    protocol: 'tcp',
    from: '',
    interface: '',
    comment: '',
    first: false,
};

const PRESETS: { label: string; rule: Partial<RuleForm> }[] = [
    { label: 'SSH', rule: { port: '22', protocol: 'tcp', comment: 'SSH' } },
    { label: 'HTTP', rule: { port: '80', protocol: 'tcp', comment: 'HTTP' } },
    { label: 'HTTPS', rule: { port: '443', protocol: 'tcp', comment: 'HTTPS' } },
    { label: 'HTTP + HTTPS', rule: { port: '80,443', protocol: 'tcp', comment: 'Web' } },
    { label: 'MySQL', rule: { port: '3306', protocol: 'tcp', comment: 'MySQL' } },
    { label: 'PostgreSQL', rule: { port: '5432', protocol: 'tcp', comment: 'PostgreSQL' } },
    { label: 'Redis', rule: { port: '6379', protocol: 'tcp', comment: 'Redis' } },
    { label: 'DNS', rule: { port: '53', protocol: 'any', comment: 'DNS' } },
    { label: 'WireGuard', rule: { port: '51820', protocol: 'udp', comment: 'WireGuard' } },
    { label: 'SSH (rate limit)', rule: { action: 'limit', port: '22', protocol: 'tcp', comment: 'SSH' } },
];

const ACTION_STYLE: Record<Rule['action'], string> = {
    allow: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    limit: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    deny: 'bg-red-500/15 text-red-700 dark:text-red-400',
    reject: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
};

const PORT_STYLE: Record<Port['state'], string> = {
    local: 'bg-muted text-muted-foreground',
    open: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    allowed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    blocked: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

const SAFETY_STORAGE = 'firewall.safety';

export default function FirewallPage({ team, servers, canManage, selected }: Props) {
    const { t } = useTranslation();
    const [server, setServer] = useSelectedServer(servers, selected);
    const { data, setData, error, loading, reload } = useServerData<Overview>(
        (id) => FirewallController.show(id),
        server?.id ?? null,
    );
    const [busy, setBusy] = useState(false);
    const [ruleForm, setRuleForm] = useState<RuleForm | null>(null);
    const [safety, setSafety] = useState<number>(() => {
        try {
            const stored = Number(localStorage.getItem(SAFETY_STORAGE));

            return [0, 60, 120, 300].includes(stored) && localStorage.getItem(SAFETY_STORAGE) !== null ? stored : 120;
        } catch {
            return 120;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(SAFETY_STORAGE, String(safety));
        } catch {
            // Storage is not available.
        }
    }, [safety]);

    /**
     * Send a change. A 409 that asks for confirmation is asked here and sent again with `confirmed`.
     */
    const change = async (
        route: { url: string; method: string },
        payload: Record<string, unknown>,
        onDone?: () => void,
    ): Promise<boolean> => {
        setBusy(true);

        try {
            let answer: ChangeAnswer;

            try {
                answer = await serverRequest<ChangeAnswer>(route, payload);
            } catch (e) {
                if (e instanceof ServerApiError && e.confirm && window.confirm(`${e.message}\n\n${t('Do it anyway?')}`)) {
                    answer = await serverRequest<ChangeAnswer>(route, { ...payload, confirmed: true });
                } else {
                    throw e;
                }
            }

            toast.success(answer.message);

            if (answer.pending) {
                setData((current) => (current ? { ...current, pending: answer.pending } : current));
            }

            onDone?.();
            await reload(true);

            return true;
        } catch (e) {
            toast.error(errorMessage(e));

            return false;
        } finally {
            setBusy(false);
        }
    };

    const manage = canManage && data?.backend === 'ufw';

    return (
        <>
            <Head title={t('Firewall')} />

            <div className="mx-auto flex w-full max-w-[100rem] min-w-0 flex-col gap-5 p-4 md:p-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold">{t('Firewall')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Rules of ufw, the ports that listen and fail2ban. Risky changes are put back by the server itself unless you keep them.',
                        )}
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
                            {manage && (
                                <>
                                    <SafetySelect value={safety} onChange={setSafety} />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => void change(FirewallController.reload(server!.id), {})}
                                    >
                                        <RotateCcw className="size-3.5" />
                                        {t('Reload rules')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={data!.active ? 'destructive' : 'default'}
                                        disabled={busy}
                                        onClick={() => {
                                            if (
                                                data!.active &&
                                                !window.confirm(t('Switch the firewall off? Every port will be reachable.'))
                                            ) {
                                                return;
                                            }

                                            void change(FirewallController.toggle(server!.id), {
                                                enabled: !data!.active,
                                                safety,
                                            });
                                        }}
                                    >
                                        <Power className="size-3.5" />
                                        {data!.active ? t('Switch off') : t('Switch on')}
                                    </Button>
                                </>
                            )}
                        </ServerToolbar>

                        {error && !data && <LoadError message={error} onRetry={() => void reload()} />}
                        {!data && !error && <LoadingBlock />}

                        {data && server && (
                            <>
                                <PrivilegeNotice privilege={data.privilege} username={server.username} />

                                {data.pending && (
                                    <PendingBanner
                                        pending={data.pending}
                                        busy={busy}
                                        onKeep={() => void change(FirewallController.confirm(server.id), {})}
                                        onRollback={() => void change(FirewallController.rollback(server.id), {})}
                                        onExpired={() => void reload(true)}
                                    />
                                )}

                                {data.backend !== 'ufw' ? (
                                    <OtherBackend backend={data.backend} raw={data.raw} />
                                ) : (
                                    <>
                                        <StatusCards
                                            data={data}
                                            canManage={manage}
                                            busy={busy}
                                            onDefault={(direction, policy) =>
                                                void change(FirewallController.defaults(server.id), {
                                                    direction,
                                                    policy,
                                                    safety,
                                                })
                                            }
                                            onLogging={(level) =>
                                                void change(FirewallController.logging(server.id), { level })
                                            }
                                        />

                                        <RulesSection
                                            rules={data.rules}
                                            sshPort={data.ssh_port}
                                            canManage={manage}
                                            busy={busy}
                                            onAdd={() => setRuleForm({ ...EMPTY_RULE })}
                                            onDelete={(rule) => {
                                                if (!window.confirm(t('Delete the rule ":rule"?', { rule: rule.spec }))) {
                                                    return;
                                                }

                                                void change(FirewallController.destroyRule(server.id), {
                                                    spec: rule.spec,
                                                    safety,
                                                });
                                            }}
                                        />
                                    </>
                                )}

                                <PortsSection
                                    ports={data.ports}
                                    canManage={manage}
                                    onRule={(port, action) =>
                                        setRuleForm({
                                            ...EMPTY_RULE,
                                            action,
                                            port: String(port.port),
                                            protocol: port.protocol as 'tcp' | 'udp',
                                            comment: port.process ?? '',
                                        })
                                    }
                                />

                                <Fail2banSection
                                    state={data.fail2ban}
                                    jails={data.jails}
                                    canManage={canManage}
                                    busy={busy}
                                    onAction={(action, ip, jail) =>
                                        change(FirewallController.fail2ban(server.id), { action, ip, jail })
                                    }
                                />
                            </>
                        )}
                    </>
                )}
            </div>

            {ruleForm && server && data && (
                <RuleDialog
                    initial={ruleForm}
                    sshPort={data.ssh_port}
                    hasRules={data.rules.length > 0}
                    busy={busy}
                    onClose={() => setRuleForm(null)}
                    onSubmit={(form) =>
                        change(
                            FirewallController.storeRule(server.id),
                            {
                                ...form,
                                port: form.port.trim() || null,
                                from: form.from.trim() || null,
                                interface: form.interface.trim() || null,
                                comment: form.comment.trim() || null,
                                safety,
                            },
                            () => setRuleForm(null),
                        )
                    }
                />
            )}
        </>
    );
}

function SafetySelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
    const { t } = useTranslation();

    return (
        <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
            <SelectTrigger className="h-8 w-52" aria-label={t('Safety net')}>
                <span className="flex items-center gap-1.5 truncate">
                    {value > 0 ? (
                        <ShieldCheck className="size-3.5 text-emerald-600" />
                    ) : (
                        <ShieldOff className="size-3.5 text-amber-600" />
                    )}
                    <SelectValue />
                </span>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="60">{t('Safety net: 1 min')}</SelectItem>
                <SelectItem value="120">{t('Safety net: 2 min')}</SelectItem>
                <SelectItem value="300">{t('Safety net: 5 min')}</SelectItem>
                <SelectItem value="0">{t('No safety net')}</SelectItem>
            </SelectContent>
        </Select>
    );
}

function PendingBanner({
    pending,
    busy,
    onKeep,
    onRollback,
    onExpired,
}: {
    pending: Pending;
    busy: boolean;
    onKeep: () => void;
    onRollback: () => void;
    onExpired: () => void;
}) {
    const { t } = useTranslation();
    const [now, setNow] = useState(() => Date.now());
    const left = Math.max(0, Math.round((new Date(pending.expires_at).getTime() - now) / 1000));

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (left === 0) {
            const timer = setTimeout(onExpired, 4000);

            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [left === 0]);

    return (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 shadow-sm backdrop-blur">
            <Clock className="size-5 shrink-0 text-sky-600" />
            <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                    {left > 0
                        ? t(':change Keep it, or the previous rules come back in :seconds s.', {
                              change: pending.summary,
                              seconds: left,
                          })
                        : t('The time is up, the server puts the previous rules back.')}
                </p>
                <p className={cn('text-xs', pending.reachable ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>
                    {pending.reachable
                        ? t('A new SSH login worked after the change. Check that your own access works too, then keep it.')
                        : t('A new SSH login did not work after the change. Let it roll back.')}
                </p>
            </div>
            <div className="flex gap-2">
                <Button size="sm" disabled={busy || left === 0} onClick={onKeep}>
                    <CheckCircle2 className="size-3.5" />
                    {t('Keep the change')}
                </Button>
                <Button size="sm" variant="outline" disabled={busy || left === 0} onClick={onRollback}>
                    <RotateCcw className="size-3.5" />
                    {t('Roll back now')}
                </Button>
            </div>
        </div>
    );
}

function StatusCards({
    data,
    canManage,
    busy,
    onDefault,
    onLogging,
}: {
    data: Overview;
    canManage: boolean;
    busy: boolean;
    onDefault: (direction: 'incoming' | 'outgoing' | 'routed', policy: string) => void;
    onLogging: (level: string) => void;
}) {
    const { t } = useTranslation();
    const policies = ['allow', 'deny', 'reject'];
    const loggingLabel: Record<string, string> = {
        off: t('Off'),
        low: t('Low'),
        medium: t('Medium'),
        high: t('High'),
        full: t('Full'),
    };
    const policyLabel: Record<string, string> = {
        allow: t('Allow'),
        deny: t('Deny'),
        reject: t('Reject'),
        disabled: t('Disabled'),
    };

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{t('Status')}</p>
                <p className={cn('mt-1 flex items-center gap-2 text-lg font-semibold', data.active ? 'text-emerald-600' : 'text-amber-600')}>
                    {data.active ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                    {data.active ? t('Active') : t('Inactive')}
                </p>
                <p className={cn('mt-1 text-xs', data.ssh_allowed ? 'text-muted-foreground' : 'text-red-600')}>
                    {data.ssh_allowed
                        ? t('SSH port :port is allowed', { port: data.ssh_port })
                        : t('No rule allows the SSH port :port. It is added when the firewall is switched on.', {
                              port: data.ssh_port,
                          })}
                </p>
            </div>

            {(['incoming', 'outgoing', 'routed'] as const).map((direction) => (
                <div key={direction} className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground">
                        {
                            {
                                incoming: t('Incoming by default'),
                                outgoing: t('Outgoing by default'),
                                routed: t('Routed by default'),
                            }[direction]
                        }
                    </p>
                    {canManage ? (
                        <Select
                            value={data.defaults[direction] ?? undefined}
                            onValueChange={(policy) => {
                                if (
                                    direction === 'incoming' &&
                                    policy === 'allow' &&
                                    !window.confirm(t('Allow all incoming traffic by default? Only deny rules will protect the server.'))
                                ) {
                                    return;
                                }

                                onDefault(direction, policy);
                            }}
                            disabled={busy}
                        >
                            <SelectTrigger className="mt-1 h-9">
                                <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                                {policies.map((policy) => (
                                    <SelectItem key={policy} value={policy}>
                                        {policyLabel[policy]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <p className="mt-1 text-lg font-semibold">
                            {data.defaults[direction] ? (policyLabel[data.defaults[direction]!] ?? data.defaults[direction]) : '—'}
                        </p>
                    )}
                </div>
            ))}

            <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{t('Logging')}</p>
                {canManage ? (
                    <Select value={data.logging ?? undefined} onValueChange={onLogging} disabled={busy}>
                        <SelectTrigger className="mt-1 h-9">
                            <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                            {['off', 'low', 'medium', 'high', 'full'].map((level) => (
                                <SelectItem key={level} value={level}>
                                    {loggingLabel[level]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <p className="mt-1 text-lg font-semibold">{data.logging ? (loggingLabel[data.logging] ?? data.logging) : '—'}</p>
                )}
            </div>
        </div>
    );
}

function RulesSection({
    rules,
    sshPort,
    canManage,
    busy,
    onAdd,
    onDelete,
}: {
    rules: Rule[];
    sshPort: number;
    canManage: boolean;
    busy: boolean;
    onAdd: () => void;
    onDelete: (rule: Rule) => void;
}) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const query = search.trim().toLowerCase();
    const visible = rules.filter(
        (rule) => query === '' || rule.spec.toLowerCase().includes(query) || (rule.comment ?? '').toLowerCase().includes(query),
    );

    const actionLabel: Record<Rule['action'], string> = {
        allow: t('Allow'),
        deny: t('Deny'),
        reject: t('Reject'),
        limit: t('Limit'),
    };

    return (
        <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <h2 className="font-semibold">{t('Rules')}</h2>
                <span className="text-xs text-muted-foreground">{rules.length}</span>
                <div className="ml-auto flex items-center gap-2">
                    {rules.length > 6 && (
                        <Input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('Search rules')}
                            className="h-8 w-48"
                        />
                    )}
                    {canManage && (
                        <Button size="sm" onClick={onAdd} disabled={busy}>
                            <Plus className="size-3.5" />
                            {t('Add rule')}
                        </Button>
                    )}
                </div>
            </div>

            {visible.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {rules.length === 0 ? t('No rules yet.') : t('No rule matches the search.')}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 font-medium">{t('Action')}</th>
                                <th className="px-4 py-2 font-medium">{t('Direction')}</th>
                                <th className="px-4 py-2 font-medium">{t('Port')}</th>
                                <th className="px-4 py-2 font-medium">{t('From')}</th>
                                <th className="px-4 py-2 font-medium">{t('Comment')}</th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {visible.map((rule) => {
                                const isSsh =
                                    rule.port !== null &&
                                    rule.port.split(',').some((p) => Number(p) === sshPort) &&
                                    rule.direction === 'in';

                                return (
                                    <tr key={rule.spec} className="hover:bg-muted/30">
                                        <td className="px-4 py-2">
                                            <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', ACTION_STYLE[rule.action])}>
                                                {actionLabel[rule.action]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-muted-foreground">
                                            {rule.route ? t('routed') : rule.direction === 'in' ? t('in') : t('out')}
                                            {rule.interface && ` · ${rule.interface}`}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs">
                                            {rule.app ?? rule.port ?? t('all')}
                                            {rule.protocol !== 'any' && !rule.app && `/${rule.protocol}`}
                                            {isSsh && (
                                                <Badge variant="outline" className="ml-2">
                                                    SSH
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs">
                                            {rule.from === 'any' ? t('Anywhere') : rule.from}
                                        </td>
                                        <td className="px-4 py-2 text-muted-foreground">{rule.comment}</td>
                                        <td className="px-4 py-2 text-right">
                                            {canManage && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() => onDelete(rule)}
                                                    aria-label={t('Delete the rule')}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function PortsSection({
    ports,
    canManage,
    onRule,
}: {
    ports: Port[];
    canManage: boolean;
    onRule: (port: Port, action: 'allow' | 'deny') => void;
}) {
    const { t } = useTranslation();
    const [showLocal, setShowLocal] = useState(false);
    const visible = ports.filter((port) => showLocal || port.public);
    const exposed = ports.filter((port) => port.state === 'open').length;

    const stateLabel: Record<Port['state'], string> = {
        local: t('Only this machine'),
        open: t('Open, no rule'),
        allowed: t('Allowed'),
        blocked: t('Blocked'),
    };

    return (
        <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <h2 className="font-semibold">{t('Listening ports')}</h2>
                {exposed > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="size-3.5" />
                        {t(':count reachable from the internet without a rule', { count: exposed })}
                    </span>
                )}
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={showLocal} onCheckedChange={(v) => setShowLocal(v === true)} />
                    {t('Show local only ports')}
                </label>
            </div>

            {visible.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('No ports listen.')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 font-medium">{t('Port')}</th>
                                <th className="px-4 py-2 font-medium">{t('Address')}</th>
                                <th className="px-4 py-2 font-medium">{t('Process')}</th>
                                <th className="px-4 py-2 font-medium">{t('Reachable')}</th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {visible.map((port) => (
                                <tr key={`${port.protocol}-${port.address}-${port.port}`} className="hover:bg-muted/30">
                                    <td className="px-4 py-2 font-mono text-xs">
                                        {port.port}/{port.protocol}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{port.address}</td>
                                    <td className="px-4 py-2">{port.process ?? '—'}</td>
                                    <td className="px-4 py-2">
                                        <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', PORT_STYLE[port.state])}>
                                            {stateLabel[port.state]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-right whitespace-nowrap">
                                        {canManage && port.public && port.state !== 'allowed' && (
                                            <Button variant="ghost" size="sm" onClick={() => onRule(port, 'allow')}>
                                                <Unlock className="size-3.5" />
                                                {t('Allow')}
                                            </Button>
                                        )}
                                        {canManage && port.public && port.state !== 'blocked' && (
                                            <Button variant="ghost" size="sm" onClick={() => onRule(port, 'deny')}>
                                                <Lock className="size-3.5" />
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
    );
}

function Fail2banSection({
    state,
    jails,
    canManage,
    busy,
    onAction,
}: {
    state: Overview['fail2ban'];
    jails: Jail[];
    canManage: boolean;
    busy: boolean;
    onAction: (action: 'ban' | 'unban' | 'ignore', ip: string, jail: string | null) => Promise<boolean>;
}) {
    const { t } = useTranslation();
    const [ip, setIp] = useState('');
    const [jail, setJail] = useState<string>(jails[0]?.name ?? '');
    const [filter, setFilter] = useState('');

    useEffect(() => {
        if (!jails.some((j) => j.name === jail)) {
            setJail(jails[0]?.name ?? '');
        }
    }, [jails, jail]);

    const totalBanned = useMemo(() => jails.reduce((sum, j) => sum + j.currently_banned, 0), [jails]);
    const query = filter.trim();

    return (
        <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <h2 className="font-semibold">Fail2ban</h2>
                <span
                    className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        state === 'running' ? PORT_STYLE.allowed : state === 'stopped' ? PORT_STYLE.blocked : PORT_STYLE.local,
                    )}
                >
                    {state === 'running' ? t('Running') : state === 'stopped' ? t('Stopped') : t('Not installed')}
                </span>
                {state === 'running' && (
                    <span className="text-xs text-muted-foreground">
                        {t(':count addresses banned now', { count: totalBanned })}
                    </span>
                )}
                {jails.some((j) => j.banned.length > 5) && (
                    <Input
                        type="search"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder={t('Find an address')}
                        className="ml-auto h-8 w-48"
                    />
                )}
            </div>

            {state === 'missing' ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                    {t('Fail2ban bans addresses that try passwords again and again. Install it with: apt install fail2ban')}
                </p>
            ) : (
                <>
                    {canManage && jails.length > 0 && (
                        <form
                            className="flex flex-wrap items-end gap-2 border-b bg-muted/20 px-4 py-3"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void onAction('ban', ip.trim(), jail).then((ok) => ok && setIp(''));
                            }}
                        >
                            <div className="space-y-1">
                                <Label htmlFor="f2b-ip" className="text-xs">
                                    {t('IP address')}
                                </Label>
                                <Input
                                    id="f2b-ip"
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    placeholder="203.0.113.7"
                                    className="h-8 w-48 font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">{t('Jail')}</Label>
                                <Select value={jail} onValueChange={setJail}>
                                    <SelectTrigger className="h-8 w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {jails.map((j) => (
                                            <SelectItem key={j.name} value={j.name}>
                                                {j.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" size="sm" variant="destructive" disabled={busy || ip.trim() === ''}>
                                <Ban className="size-3.5" />
                                {t('Ban')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy || ip.trim() === ''}
                                onClick={() => void onAction('unban', ip.trim(), null).then((ok) => ok && setIp(''))}
                            >
                                {t('Unban everywhere')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy || ip.trim() === ''}
                                onClick={() => void onAction('ignore', ip.trim(), jail).then((ok) => ok && setIp(''))}
                                title={t('Never ban this address in the jail, until fail2ban restarts')}
                            >
                                {t('Never ban')}
                            </Button>
                        </form>
                    )}

                    {jails.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-muted-foreground">{t('No jails are active.')}</p>
                    ) : (
                        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                            {jails.map((j) => {
                                const banned = j.banned.filter((address) => query === '' || address.includes(query));

                                return (
                                    <div key={j.name} className="rounded-lg border p-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-medium">{j.name}</h3>
                                            <span className="text-xs text-muted-foreground">
                                                {t(':banned banned · :failed failed', {
                                                    banned: j.currently_banned,
                                                    failed: j.currently_failed,
                                                })}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {t('Since start: :banned bans, :failed failures', {
                                                banned: j.total_banned,
                                                failed: j.total_failed,
                                            })}
                                        </p>
                                        {banned.length > 0 && (
                                            <ul className="mt-2 max-h-56 divide-y overflow-auto rounded-md border">
                                                {banned.map((address) => (
                                                    <li key={address} className="flex items-center justify-between px-2 py-1">
                                                        <span className="font-mono text-xs">{address}</span>
                                                        {canManage && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7"
                                                                disabled={busy}
                                                                onClick={() => void onAction('unban', address, j.name)}
                                                            >
                                                                {t('Unban')}
                                                            </Button>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

function OtherBackend({ backend, raw }: { backend: Overview['backend']; raw: string | null }) {
    const { t } = useTranslation();

    return (
        <section className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                    {backend === null
                        ? t('No firewall was found on this server. Install ufw to manage it from here: apt install ufw')
                        : t(':backend is used on this server. Rules can be changed here only with ufw, so they are shown read-only.', {
                              backend,
                          })}
                </p>
            </div>
            {raw && (
                <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre">
                    {raw}
                </pre>
            )}
        </section>
    );
}

function RuleDialog({
    initial,
    sshPort,
    hasRules,
    busy,
    onClose,
    onSubmit,
}: {
    initial: RuleForm;
    sshPort: number;
    hasRules: boolean;
    busy: boolean;
    onClose: () => void;
    onSubmit: (form: RuleForm) => Promise<boolean>;
}) {
    const { t } = useTranslation();
    const [form, setForm] = useState<RuleForm>(initial);
    const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => setForm((f) => ({ ...f, [key]: value }));

    const blocksSsh =
        (form.action === 'deny' || form.action === 'reject') &&
        form.direction === 'in' &&
        form.from.trim() === '' &&
        form.port.split(',').some((p) => Number(p.trim()) === sshPort);

    const summary = [
        form.action,
        form.direction,
        form.interface && `on ${form.interface}`,
        `from ${form.from.trim() || 'any'}`,
        form.port.trim() && `port ${form.port.trim()}`,
        form.protocol !== 'any' && `proto ${form.protocol}`,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('Add rule')}</DialogTitle>
                    <DialogDescription>{t('Start from a common service or fill the fields.')}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                            onClick={() => setForm({ ...form, action: 'allow', from: '', ...preset.rule } as RuleForm)}
                        >
                            {preset.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-700 hover:bg-red-500/10 dark:text-red-400"
                        onClick={() => setForm({ ...EMPTY_RULE, action: 'deny', protocol: 'any', first: true, comment: 'Blocked' })}
                    >
                        {t('Block an address')}
                    </button>
                    <button
                        type="button"
                        className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                        onClick={() => setForm({ ...EMPTY_RULE, action: 'allow', protocol: 'any', comment: 'Trusted' })}
                    >
                        {t('Trust an address')}
                    </button>
                </div>

                <form
                    id="rule-form"
                    className="grid gap-3 sm:grid-cols-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void onSubmit(form);
                    }}
                >
                    <div className="space-y-1">
                        <Label>{t('Action')}</Label>
                        <Select value={form.action} onValueChange={(v) => set('action', v as RuleForm['action'])}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="allow">{t('Allow')}</SelectItem>
                                <SelectItem value="limit">{t('Limit (max. 6 connections in 30 s)')}</SelectItem>
                                <SelectItem value="deny">{t('Deny (drop silently)')}</SelectItem>
                                <SelectItem value="reject">{t('Reject (answer with an error)')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>{t('Direction')}</Label>
                        <Select value={form.direction} onValueChange={(v) => set('direction', v as 'in' | 'out')}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="in">{t('Incoming')}</SelectItem>
                                <SelectItem value="out">{t('Outgoing')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="rule-port">{t('Port')}</Label>
                        <Input
                            id="rule-port"
                            value={form.port}
                            onChange={(e) => set('port', e.target.value)}
                            placeholder={t('22, 80,443 or 6000:6007')}
                            className="font-mono"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>{t('Protocol')}</Label>
                        <Select value={form.protocol} onValueChange={(v) => set('protocol', v as RuleForm['protocol'])}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tcp">TCP</SelectItem>
                                <SelectItem value="udp">UDP</SelectItem>
                                <SelectItem value="any">{t('TCP and UDP')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="rule-from">{t('From address')}</Label>
                        <Input
                            id="rule-from"
                            value={form.from}
                            onChange={(e) => set('from', e.target.value)}
                            placeholder={t('Anywhere, or 203.0.113.7 or 10.0.0.0/8')}
                            className="font-mono"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="rule-interface">{t('Network interface')}</Label>
                        <Input
                            id="rule-interface"
                            value={form.interface}
                            onChange={(e) => set('interface', e.target.value)}
                            placeholder={t('All, or eth0')}
                            className="font-mono"
                        />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="rule-comment">{t('Comment')}</Label>
                        <Input
                            id="rule-comment"
                            value={form.comment}
                            onChange={(e) => set('comment', e.target.value)}
                            maxLength={60}
                        />
                    </div>
                    {hasRules && (
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                            <Checkbox checked={form.first} onCheckedChange={(v) => set('first', v === true)} />
                            {t('Put the rule first, before the rules that would otherwise match')}
                        </label>
                    )}
                </form>

                <p className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs">ufw {summary}</p>

                {blocksSsh && (
                    <p className="flex items-start gap-2 text-sm text-red-600">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                        {t('This rule blocks the SSH port :port. The app and you may lose access to the server.', {
                            port: sshPort,
                        })}
                    </p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button type="submit" form="rule-form" disabled={busy || (form.port.trim() === '' && form.from.trim() === '')}>
                        {busy && <Spinner className="size-3.5" />}
                        {t('Add rule')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

FirewallPage.layout = {
    breadcrumbs: [{ title: 'Firewall', href: index() }],
};
