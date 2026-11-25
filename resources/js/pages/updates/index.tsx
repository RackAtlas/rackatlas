import { Head } from '@inertiajs/react';
import {
    ArrowUpCircle,
    CheckCircle2,
    Lock,
    LockOpen,
    PackageCheck,
    PackageX,
    RefreshCw,
    RotateCw,
    ShieldAlert,
    TriangleAlert,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import UpdateController from '@/actions/App/Http/Controllers/UpdateController';
import {
    LoadError,
    LoadingBlock,
    NoSshServers,
    PrivilegeNotice,
    ServerToolbar,
    useSelectedServer,
    type SshServer,
} from '@/components/server-tools/server-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { formatUptime, timeAgo } from '@/lib/dashboard';
import { errorMessage, serverRequest } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { index } from '@/routes/updates';

type Package = {
    name: string;
    sources: string[];
    version: string;
    current: string | null;
    arch: string;
    security: boolean;
    held: boolean;
};

type JobState = {
    state: 'none' | 'running' | 'done';
    exit: number | null;
    label: string | null;
    started_at: string | null;
};

type Overview = {
    privilege: string;
    apt: boolean;
    os: string | null;
    kernel: string | null;
    uptime_seconds: number;
    packages: Package[];
    security_count: number;
    held: string[];
    reboot_required: boolean;
    reboot_packages: string[];
    reboot_scheduled: string | null;
    refreshed_at: string | null;
    unattended: { installed: boolean; enabled: boolean };
    job: JobState;
    fetched_at: string;
};

type Props = {
    team: { id: number; name: string } | null;
    servers: SshServer[];
    canManage: boolean;
    selected: number | null;
};

type JobName = 'refresh' | 'upgrade' | 'full-upgrade' | 'security' | 'packages' | 'autoremove';

export default function UpdatesPage({ team, servers, canManage, selected }: Props) {
    const { t, locale } = useTranslation();
    const [server, setServer] = useSelectedServer(servers, selected);
    const { data, error, loading, reload } = useServerData<Overview>((id) => UpdateController.show(id), server?.id ?? null);
    const [busy, setBusy] = useState(false);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState('');
    const [onlySecurity, setOnlySecurity] = useState(false);
    const [job, setJob] = useState<(JobState & { log: string }) | null>(null);
    const [rebootMinutes, setRebootMinutes] = useState('5');
    const logRef = useRef<HTMLPreElement>(null);

    useEffect(() => setChecked(new Set()), [server?.id]);

    const pollJob = useCallback(async () => {
        if (!server) {
            return;
        }

        try {
            const answer = await serverRequest<JobState & { log: string }>(UpdateController.job(server.id));
            setJob(answer);

            return answer;
        } catch {
            return undefined;
        }
    }, [server]);

    // Follow a running job: read its log every three seconds, and the whole page once it ends.
    useEffect(() => {
        if (data?.job.state === 'running' || job?.state === 'running') {
            const timer = setInterval(async () => {
                const answer = await pollJob();

                if (answer && answer.state !== 'running') {
                    clearInterval(timer);
                    void reload(true);
                }
            }, 3000);

            return () => clearInterval(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.job.state, job?.state === 'running', pollJob]);

    useEffect(() => {
        if (data?.job.state && data.job.state !== 'none' && job === null) {
            void pollJob();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.job.state]);

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, [job?.log]);

    const start = async (name: JobName, packages: string[] = [], question?: string) => {
        if (!server || (question && !window.confirm(question))) {
            return;
        }

        setBusy(true);

        try {
            const answer = await serverRequest<{ message: string }>(UpdateController.start(server.id), { job: name, packages });
            toast.success(answer.message);
            setChecked(new Set());
            await pollJob();
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const act = async (route: { url: string; method: string }, payload: Record<string, unknown>) => {
        setBusy(true);

        try {
            const answer = await serverRequest<{ message: string }>(route, payload);
            toast.success(answer.message);
            await reload(true);
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const query = filter.trim().toLowerCase();
    const packages = useMemo(
        () => (data?.packages ?? []).filter((p) => (!onlySecurity || p.security) && (query === '' || p.name.includes(query))),
        [data, onlySecurity, query],
    );

    const running = job?.state === 'running' || data?.job.state === 'running';
    const manage = canManage && data?.apt === true;

    return (
        <>
            <Head title={t('Updates')} />

            <div className="mx-auto flex w-full max-w-[100rem] min-w-0 flex-col gap-5 p-4 md:p-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold">{t('Updates')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Packages that can be upgraded, security updates first. Upgrades run in the background on the server, so they finish even when you close the page.')}
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
                                <Button variant="outline" size="sm" disabled={busy || running} onClick={() => void start('refresh')}>
                                    <RefreshCw className="size-3.5" />
                                    {t('Check for updates')}
                                </Button>
                            )}
                        </ServerToolbar>

                        {error && !data && <LoadError message={error} onRetry={() => void reload()} />}
                        {!data && !error && <LoadingBlock />}

                        {data && server && (
                            <>
                                <PrivilegeNotice privilege={data.privilege} username={server.username} />

                                {!data.apt ? (
                                    <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                                        {t('Updates can be managed here on Debian and Ubuntu (apt). This server does not have apt.')}
                                    </p>
                                ) : (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-xl border bg-card p-4">
                                                <p className="text-xs text-muted-foreground">{t('System')}</p>
                                                <p className="mt-1 font-semibold">{data.os ?? '—'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('Kernel :kernel · up :uptime', {
                                                        kernel: data.kernel ?? '?',
                                                        uptime: formatUptime(data.uptime_seconds, t),
                                                    })}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border bg-card p-4">
                                                <p className="text-xs text-muted-foreground">{t('Available updates')}</p>
                                                <p className="mt-1 text-2xl font-semibold tabular-nums">{data.packages.length}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {data.refreshed_at
                                                        ? t('Package lists from :time', { time: timeAgo(data.refreshed_at, data.fetched_at, locale) })
                                                        : t('The package lists were never refreshed.')}
                                                </p>
                                            </div>
                                            <div
                                                className={cn(
                                                    'rounded-xl border p-4',
                                                    data.security_count > 0 ? 'border-red-500/40 bg-red-500/5' : 'bg-card',
                                                )}
                                            >
                                                <p className="text-xs text-muted-foreground">{t('Security updates')}</p>
                                                <p
                                                    className={cn(
                                                        'mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums',
                                                        data.security_count > 0 && 'text-red-600',
                                                    )}
                                                >
                                                    {data.security_count > 0 ? <ShieldAlert className="size-5" /> : <CheckCircle2 className="size-5 text-emerald-600" />}
                                                    {data.security_count}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {data.unattended.installed
                                                        ? data.unattended.enabled
                                                            ? t('Automatic security updates are on.')
                                                            : t('unattended-upgrades is installed but switched off.')
                                                        : t('Automatic security updates are not installed.')}
                                                </p>
                                            </div>
                                            <RebootCard
                                                data={data}
                                                canManage={manage}
                                                busy={busy}
                                                minutes={rebootMinutes}
                                                setMinutes={setRebootMinutes}
                                                locale={locale}
                                                onReboot={() => {
                                                    if (
                                                        window.confirm(
                                                            t('Restart :name in :minutes min? Everything on it stops for a while.', {
                                                                name: server.name,
                                                                minutes: rebootMinutes,
                                                            }),
                                                        )
                                                    ) {
                                                        void act(UpdateController.reboot(server.id), { minutes: Number(rebootMinutes) });
                                                    }
                                                }}
                                                onCancel={() => void act(UpdateController.reboot(server.id), { cancel: true })}
                                            />
                                        </div>

                                        {manage && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    disabled={busy || running || data.security_count === 0}
                                                    variant={data.security_count > 0 ? 'destructive' : 'outline'}
                                                    onClick={() =>
                                                        void start('security', [], t('Install :count security updates?', { count: data.security_count }))
                                                    }
                                                >
                                                    <ShieldAlert className="size-4" />
                                                    {t('Install security updates')}
                                                </Button>
                                                <Button
                                                    disabled={busy || running || data.packages.length === 0}
                                                    onClick={() =>
                                                        void start('upgrade', [], t('Upgrade all :count packages? Services may restart.', { count: data.packages.length }))
                                                    }
                                                >
                                                    <ArrowUpCircle className="size-4" />
                                                    {t('Upgrade all')}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    disabled={busy || running}
                                                    onClick={() =>
                                                        void start(
                                                            'full-upgrade',
                                                            [],
                                                            t('A full upgrade may also install new and remove old packages (for example a new kernel). Continue?'),
                                                        )
                                                    }
                                                >
                                                    {t('Full upgrade')}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    disabled={busy || running}
                                                    onClick={() => void start('autoremove', [], t('Remove packages that nothing needs any more?'))}
                                                >
                                                    <PackageX className="size-4" />
                                                    {t('Remove unused packages')}
                                                </Button>
                                            </div>
                                        )}

                                        {job && job.state !== 'none' && (
                                            <JobPanel job={job} generatedAt={data.fetched_at} locale={locale} logRef={logRef} onClose={() => setJob(null)} />
                                        )}

                                        <section className="overflow-hidden rounded-xl border bg-card">
                                            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                                                <h2 className="font-semibold">{t('Packages')}</h2>
                                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Checkbox checked={onlySecurity} onCheckedChange={(v) => setOnlySecurity(v === true)} />
                                                    {t('Only security updates')}
                                                </label>
                                                <div className="ml-auto flex flex-wrap items-center gap-2">
                                                    {manage && checked.size > 0 && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                disabled={busy || running}
                                                                onClick={() => void start('packages', Array.from(checked))}
                                                            >
                                                                <ArrowUpCircle className="size-3.5" />
                                                                {t('Upgrade :count selected', { count: checked.size })}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={busy}
                                                                onClick={() =>
                                                                    void act(UpdateController.hold(server.id), { packages: Array.from(checked), hold: true }).then(() =>
                                                                        setChecked(new Set()),
                                                                    )
                                                                }
                                                            >
                                                                <Lock className="size-3.5" />
                                                                {t('Hold')}
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Input
                                                        type="search"
                                                        value={filter}
                                                        onChange={(e) => setFilter(e.target.value)}
                                                        placeholder={t('Search packages')}
                                                        className="h-8 w-48"
                                                    />
                                                </div>
                                            </div>

                                            {packages.length === 0 ? (
                                                <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                                                    <PackageCheck className="size-4 text-emerald-600" />
                                                    {data.packages.length === 0 ? t('Everything is up to date.') : t('No package matches the filter.')}
                                                </p>
                                            ) : (
                                                <div className="max-h-[32rem] overflow-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                                                            <tr>
                                                                {manage && (
                                                                    <th className="w-8 px-3 py-2">
                                                                        <Checkbox
                                                                            checked={packages.length > 0 && packages.every((p) => checked.has(p.name))}
                                                                            onCheckedChange={(v) =>
                                                                                setChecked(v === true ? new Set(packages.filter((p) => !p.held).map((p) => p.name)) : new Set())
                                                                            }
                                                                            aria-label={t('Select all')}
                                                                        />
                                                                    </th>
                                                                )}
                                                                <th className="px-3 py-2 font-medium">{t('Package')}</th>
                                                                <th className="px-3 py-2 font-medium">{t('Installed')}</th>
                                                                <th className="px-3 py-2 font-medium">{t('New')}</th>
                                                                <th className="hidden px-3 py-2 font-medium md:table-cell">{t('Source')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {packages.map((p) => (
                                                                <tr key={`${p.name}-${p.arch}`} className="hover:bg-muted/30">
                                                                    {manage && (
                                                                        <td className="px-3 py-1.5">
                                                                            <Checkbox
                                                                                checked={checked.has(p.name)}
                                                                                disabled={p.held}
                                                                                onCheckedChange={(v) => {
                                                                                    const next = new Set(checked);

                                                                                    if (v === true) {
                                                                                        next.add(p.name);
                                                                                    } else {
                                                                                        next.delete(p.name);
                                                                                    }

                                                                                    setChecked(next);
                                                                                }}
                                                                                aria-label={p.name}
                                                                            />
                                                                        </td>
                                                                    )}
                                                                    <td className="px-3 py-1.5">
                                                                        <span className="font-mono text-xs font-medium">{p.name}</span>
                                                                        {p.security && (
                                                                            <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                                                                                {t('security')}
                                                                            </span>
                                                                        )}
                                                                        {p.held && (
                                                                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                                                {t('held')}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{p.current ?? '—'}</td>
                                                                    <td className="px-3 py-1.5 font-mono text-xs">{p.version}</td>
                                                                    <td className="hidden px-3 py-1.5 text-xs text-muted-foreground md:table-cell">
                                                                        {p.sources.join(', ')}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </section>

                                        {data.held.length > 0 && (
                                            <section className="rounded-xl border bg-card p-4">
                                                <h2 className="mb-2 flex items-center gap-2 font-semibold">
                                                    <Lock className="size-4 text-muted-foreground" />
                                                    {t('Held packages')}
                                                </h2>
                                                <p className="mb-3 text-xs text-muted-foreground">
                                                    {t('These packages stay at their version and are skipped by upgrades.')}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {data.held.map((name) => (
                                                        <span key={name} className="flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 font-mono text-xs">
                                                            {name}
                                                            {manage && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 px-1.5"
                                                                    disabled={busy}
                                                                    onClick={() => void act(UpdateController.hold(server.id), { packages: [name], hold: false })}
                                                                    aria-label={t('Release :name', { name })}
                                                                >
                                                                    <LockOpen className="size-3" />
                                                                </Button>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </section>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

function RebootCard({
    data,
    canManage,
    busy,
    minutes,
    setMinutes,
    locale,
    onReboot,
    onCancel,
}: {
    data: Overview;
    canManage: boolean;
    busy: boolean;
    minutes: string;
    setMinutes: (value: string) => void;
    locale: string;
    onReboot: () => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className={cn('rounded-xl border p-4', data.reboot_required ? 'border-amber-500/40 bg-amber-500/5' : 'bg-card')}>
            <p className="text-xs text-muted-foreground">{t('Restart')}</p>
            {data.reboot_scheduled ? (
                <>
                    <p className="mt-1 flex items-center gap-2 font-semibold text-sky-600">
                        <RotateCw className="size-4" />
                        {t('Planned for :time', { time: new Date(data.reboot_scheduled).toLocaleTimeString(locale) })}
                    </p>
                    {canManage && (
                        <Button variant="outline" size="sm" className="mt-2" disabled={busy} onClick={onCancel}>
                            {t('Cancel the restart')}
                        </Button>
                    )}
                </>
            ) : (
                <>
                    <p className={cn('mt-1 flex items-center gap-2 font-semibold', data.reboot_required ? 'text-amber-600' : 'text-emerald-600')}>
                        {data.reboot_required ? <TriangleAlert className="size-4" /> : <CheckCircle2 className="size-4" />}
                        {data.reboot_required ? t('Needed') : t('Not needed')}
                    </p>
                    {data.reboot_packages.length > 0 && (
                        <p className="truncate text-xs text-muted-foreground" title={data.reboot_packages.join(', ')}>
                            {t('Because of :packages', { packages: data.reboot_packages.join(', ') })}
                        </p>
                    )}
                    {canManage && (
                        <div className="mt-2 flex items-center gap-1.5">
                            <Select value={minutes} onValueChange={setMinutes}>
                                <SelectTrigger className="h-8 w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {['1', '5', '15', '30', '60'].map((value) => (
                                        <SelectItem key={value} value={value}>
                                            {t('in :minutes min', { minutes: value })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant={data.reboot_required ? 'default' : 'outline'} size="sm" disabled={busy} onClick={onReboot}>
                                <RotateCw className="size-3.5" />
                                {t('Restart')}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function JobPanel({
    job,
    generatedAt,
    locale,
    logRef,
    onClose,
}: {
    job: JobState & { log: string };
    generatedAt: string;
    locale: string;
    logRef: React.RefObject<HTMLPreElement | null>;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const failed = job.state === 'done' && job.exit !== 0;

    return (
        <section
            className={cn(
                'overflow-hidden rounded-xl border',
                job.state === 'running' ? 'border-sky-500/40' : failed ? 'border-red-500/40' : 'border-emerald-500/40',
            )}
        >
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
                {job.state === 'running' ? (
                    <Spinner className="size-4 text-sky-600" />
                ) : failed ? (
                    <XCircle className="size-4 text-red-600" />
                ) : (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                )}
                <span className="font-medium">{job.label ?? t('Update job')}</span>
                <span className="text-xs text-muted-foreground">
                    {job.state === 'running'
                        ? t('running')
                        : failed
                          ? t('failed with exit code :code', { code: job.exit ?? '?' })
                          : t('finished')}
                    {job.started_at && ` · ${t('started :time', { time: timeAgo(job.started_at, generatedAt, locale) })}`}
                </span>
                {job.state !== 'running' && (
                    <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={onClose}>
                        {t('Hide')}
                    </Button>
                )}
            </div>
            <pre ref={logRef} className="max-h-96 overflow-auto bg-zinc-950 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-100">
                {job.log || t('Waiting for output…')}
            </pre>
        </section>
    );
}

UpdatesPage.layout = {
    breadcrumbs: [{ title: 'Updates', href: index() }],
};
