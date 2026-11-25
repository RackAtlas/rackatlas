import { Head, Link } from '@inertiajs/react';
import {
    CalendarClock,
    ChevronDown,
    Clock,
    ExternalLink,
    FileText,
    Pencil,
    Play,
    Plus,
    Power,
    PowerOff,
    Timer,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import CronController from '@/actions/App/Http/Controllers/CronController';
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
import { useServerData } from '@/hooks/use-server-data';
import { useTranslation } from '@/hooks/use-translation';
import { describeSchedule, SCHEDULE_PRESETS } from '@/lib/cron';
import { timeAgo } from '@/lib/dashboard';
import { errorMessage, serverRequest } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { index } from '@/routes/cron';
import { index as filesIndex } from '@/routes/files';

type Job = {
    line: number;
    hash: string;
    schedule: string;
    user: string | null;
    command: string;
    enabled: boolean;
    label: string | null;
    next: string[];
};

type Crontab = { user: string; jobs: Job[]; variables: Record<string, string>; raw: string };

type TimerUnit = {
    name: string;
    description: string | null;
    active: boolean;
    enabled: string | null;
    next: string | null;
    last: string | null;
    service: string | null;
    schedule: string | null;
    persistent: boolean;
    result: string | null;
    exit_status: number | null;
    running: boolean;
};

type Overview = {
    privilege: string;
    login: string;
    timezone: string | null;
    daemon: boolean;
    crontabs: Crontab[];
    system: { path: string; jobs: Job[] }[];
    periodic: { period: string; path: string; name: string }[];
    timers: TimerUnit[];
    fetched_at: string;
};

type Props = {
    team: { id: number; name: string } | null;
    servers: SshServer[];
    canManage: boolean;
    selected: number | null;
};

type JobForm = {
    user: string;
    schedule: string;
    command: string;
    label: string;
    enabled: boolean;
    line?: number;
    hash?: string;
};

type Tab = 'jobs' | 'timers' | 'system';

export default function CronPage({ team, servers, canManage, selected }: Props) {
    const { t, locale } = useTranslation();
    const [server, setServer] = useSelectedServer(servers, selected);
    const { data, error, loading, reload } = useServerData<Overview>((id) => CronController.show(id), server?.id ?? null);
    const [tab, setTab] = useState<Tab>('jobs');
    const [form, setForm] = useState<JobForm | null>(null);
    const [busy, setBusy] = useState(false);
    const [output, setOutput] = useState<{ title: string; text: string | null; exit?: number; seconds?: number } | null>(null);
    const [search, setSearch] = useState('');
    const [showEmpty, setShowEmpty] = useState(false);

    const act = async (route: { url: string; method: string }, payload: Record<string, unknown>): Promise<boolean> => {
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

    const runJob = async (user: string, job: Job) => {
        if (!window.confirm(t('Run this job now as :user?\n\n:command', { user, command: job.command }))) {
            return;
        }

        setOutput({ title: job.label ?? job.command, text: null });

        try {
            const answer = await serverRequest<{ exit: number; output: string; seconds: number }>(CronController.run(server!.id), {
                user,
                command: job.command,
            });
            setOutput({ title: job.label ?? job.command, text: answer.output, exit: answer.exit, seconds: answer.seconds });
        } catch (e) {
            setOutput(null);
            toast.error(errorMessage(e));
        }
    };

    const journal = async (timer: TimerUnit) => {
        setOutput({ title: timer.service ?? timer.name, text: null });

        try {
            const answer = await serverRequest<{ output: string }>(CronController.journal(server!.id), { timer: timer.name });
            setOutput({ title: timer.service ?? timer.name, text: answer.output || t('The journal is empty.') });
        } catch (e) {
            setOutput(null);
            toast.error(errorMessage(e));
        }
    };

    const query = search.trim().toLowerCase();
    const matches = (job: Job) =>
        query === '' || job.command.toLowerCase().includes(query) || (job.label ?? '').toLowerCase().includes(query);

    const jobCount = data?.crontabs.reduce((sum, crontab) => sum + crontab.jobs.length, 0) ?? 0;
    const failedTimers = data?.timers.filter((timer) => timer.result && timer.result !== 'success').length ?? 0;
    const crontabs = (data?.crontabs ?? []).filter((crontab) => showEmpty || crontab.jobs.length > 0);

    const fileLink = (path: string) => filesIndex({ query: { server: server?.id, path: path.replace(/\/[^/]*$/, '') || '/' } });

    return (
        <>
            <Head title={t('Cron and timers')} />

            <div className="mx-auto flex w-full max-w-[100rem] min-w-0 flex-col gap-5 p-4 md:p-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold">{t('Cron and timers')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Jobs that run on a schedule: the crontabs of the users, the system cron files and the systemd timers.')}
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
                            {data?.timezone && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="size-3.5" />
                                    {data.timezone}
                                </span>
                            )}
                            {canManage && data && (
                                <Button
                                    size="sm"
                                    onClick={() =>
                                        setForm({
                                            user: data.crontabs.find((c) => c.user === data.login)?.user ?? data.crontabs[0]?.user ?? data.login,
                                            schedule: '0 3 * * *',
                                            command: '',
                                            label: '',
                                            enabled: true,
                                        })
                                    }
                                >
                                    <Plus className="size-3.5" />
                                    {t('Add job')}
                                </Button>
                            )}
                        </ServerToolbar>

                        {error && !data && <LoadError message={error} onRetry={() => void reload()} />}
                        {!data && !error && <LoadingBlock />}

                        {data && server && (
                            <>
                                <PrivilegeNotice privilege={data.privilege} username={server.username} />

                                {!data.daemon && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                                        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                        {t('The cron service does not seem to run, so the jobs below may not start.')}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                                    {(
                                        [
                                            ['jobs', t('Cron jobs'), jobCount],
                                            ['timers', t('Systemd timers'), data.timers.length],
                                            ['system', t('System cron'), data.system.reduce((s, f) => s + f.jobs.length, 0) + data.periodic.length],
                                        ] as [Tab, string, number][]
                                    ).map(([value, label, count]) => (
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
                                            {value === 'timers' && failedTimers > 0 && <span className="size-2 rounded-full bg-red-500" />}
                                        </button>
                                    ))}

                                    {tab !== 'timers' && (
                                        <Input
                                            type="search"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder={t('Search commands')}
                                            className="ml-auto h-8 w-56"
                                        />
                                    )}
                                </div>

                                {tab === 'jobs' && (
                                    <>
                                        {crontabs.length === 0 && (
                                            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                                                {t('No user has cron jobs yet.')}
                                            </p>
                                        )}

                                        {crontabs.map((crontab) => (
                                            <CrontabSection
                                                key={crontab.user}
                                                crontab={crontab}
                                                jobs={crontab.jobs.filter(matches)}
                                                canManage={canManage}
                                                busy={busy}
                                                generatedAt={data.fetched_at}
                                                locale={locale}
                                                onAdd={() =>
                                                    setForm({ user: crontab.user, schedule: '0 3 * * *', command: '', label: '', enabled: true })
                                                }
                                                onEdit={(job) =>
                                                    setForm({
                                                        user: crontab.user,
                                                        schedule: job.schedule,
                                                        command: job.command,
                                                        label: job.label ?? '',
                                                        enabled: job.enabled,
                                                        line: job.line,
                                                        hash: job.hash,
                                                    })
                                                }
                                                onToggle={(job) =>
                                                    void act(CronController.toggle(server.id), {
                                                        user: crontab.user,
                                                        line: job.line,
                                                        hash: job.hash,
                                                        enabled: !job.enabled,
                                                    })
                                                }
                                                onDelete={(job) => {
                                                    if (window.confirm(t('Delete this job?\n\n:command', { command: job.command }))) {
                                                        void act(CronController.destroy(server.id), {
                                                            user: crontab.user,
                                                            line: job.line,
                                                            hash: job.hash,
                                                            command: job.command,
                                                        });
                                                    }
                                                }}
                                                onRun={(job) => void runJob(crontab.user, job)}
                                            />
                                        ))}

                                        {data.crontabs.some((c) => c.jobs.length === 0) && (
                                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Checkbox checked={showEmpty} onCheckedChange={(v) => setShowEmpty(v === true)} />
                                                {t('Show users without jobs')}
                                            </label>
                                        )}
                                    </>
                                )}

                                {tab === 'timers' && (
                                    <TimersSection
                                        timers={data.timers}
                                        canManage={canManage}
                                        busy={busy}
                                        generatedAt={data.fetched_at}
                                        locale={locale}
                                        onAction={(timer, action) => {
                                            if (action === 'disable' && !window.confirm(t('Switch the timer :name off?', { name: timer.name }))) {
                                                return;
                                            }

                                            void act(CronController.timer({ server: server.id, action }), { timer: timer.name });
                                        }}
                                        onJournal={(timer) => void journal(timer)}
                                    />
                                )}

                                {tab === 'system' && (
                                    <div className="space-y-4">
                                        {data.system.map((file) => {
                                            const jobs = file.jobs.filter(matches);

                                            return jobs.length === 0 ? null : (
                                                <section key={file.path} className="overflow-hidden rounded-xl border bg-card">
                                                    <div className="flex items-center gap-2 border-b px-4 py-3">
                                                        <h2 className="font-mono text-sm font-semibold">{file.path}</h2>
                                                        <Link
                                                            href={fileLink(file.path)}
                                                            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                                        >
                                                            <ExternalLink className="size-3.5" />
                                                            {t('Open in Files')}
                                                        </Link>
                                                    </div>
                                                    <ul className="divide-y">
                                                        {jobs.map((job) => (
                                                            <li key={job.line} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                                                                <ScheduleCell job={job} generatedAt={data.fetched_at} locale={locale} />
                                                                <span className="text-xs text-muted-foreground">{job.user}</span>
                                                                <code className="min-w-0 flex-1 basis-64 truncate font-mono text-xs" title={job.command}>
                                                                    {job.command}
                                                                </code>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </section>
                                            );
                                        })}

                                        {data.periodic.length > 0 && (
                                            <section className="overflow-hidden rounded-xl border bg-card">
                                                <div className="border-b px-4 py-3">
                                                    <h2 className="font-semibold">{t('Scripts in cron.hourly, daily, weekly and monthly')}</h2>
                                                </div>
                                                <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
                                                    {['hourly', 'daily', 'weekly', 'monthly'].map((period) => (
                                                        <div key={period}>
                                                            <h3 className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                                                                {{ hourly: t('Hourly'), daily: t('Daily'), weekly: t('Weekly'), monthly: t('Monthly') }[period]}
                                                            </h3>
                                                            <ul className="space-y-0.5">
                                                                {data.periodic
                                                                    .filter((script) => script.period === period)
                                                                    .map((script) => (
                                                                        <li key={script.path}>
                                                                            <Link
                                                                                href={filesIndex({ query: { server: server.id, path: `/etc/cron.${period}` } })}
                                                                                className="font-mono text-xs hover:underline"
                                                                            >
                                                                                {script.name}
                                                                            </Link>
                                                                        </li>
                                                                    ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {form && server && data && (
                <JobDialog
                    initial={form}
                    users={data.crontabs.map((c) => c.user)}
                    timezone={data.timezone}
                    onClose={() => setForm(null)}
                    onSubmit={(job) =>
                        job.line === undefined
                            ? act(CronController.store(server.id), job)
                            : act(CronController.update(server.id), job)
                    }
                />
            )}

            {output && (
                <Dialog open onOpenChange={(open) => !open && setOutput(null)}>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle className="font-mono text-base break-all">{output.title}</DialogTitle>
                            {output.exit !== undefined && (
                                <DialogDescription className={output.exit === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}>
                                    {t('Exit code :code after :seconds s', { code: output.exit, seconds: output.seconds ?? 0 })}
                                    {output.exit === 124 && ` · ${t('stopped after 60 s')}`}
                                </DialogDescription>
                            )}
                        </DialogHeader>
                        <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs break-all whitespace-pre-wrap">
                            {output.text === null ? t('Running…') : output.text || t('No output.')}
                        </pre>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

function ScheduleCell({ job, generatedAt, locale }: { job: Job; generatedAt: string; locale: string }) {
    const { t } = useTranslation();

    return (
        <div className="w-56 shrink-0">
            <p className="text-sm">{describeSchedule(job.schedule, t)}</p>
            <p className="font-mono text-xs text-muted-foreground">
                {job.schedule}
                {job.next[0] && (
                    <span title={job.next.map((d) => new Date(d).toLocaleString(locale)).join('\n')}>
                        {' · '}
                        {t('next :time', { time: timeAgo(job.next[0], generatedAt, locale) })}
                    </span>
                )}
            </p>
        </div>
    );
}

function CrontabSection({
    crontab,
    jobs,
    canManage,
    busy,
    generatedAt,
    locale,
    onAdd,
    onEdit,
    onToggle,
    onDelete,
    onRun,
}: {
    crontab: Crontab;
    jobs: Job[];
    canManage: boolean;
    busy: boolean;
    generatedAt: string;
    locale: string;
    onAdd: () => void;
    onEdit: (job: Job) => void;
    onToggle: (job: Job) => void;
    onDelete: (job: Job) => void;
    onRun: (job: Job) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(true);
    const [raw, setRaw] = useState(false);
    const variables = Object.entries(crontab.variables);

    return (
        <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <button type="button" className="flex items-center gap-2" onClick={() => setOpen(!open)} aria-expanded={open}>
                    <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
                    <h2 className="font-semibold">{crontab.user}</h2>
                </button>
                <span className="text-xs text-muted-foreground">
                    {t(':on on, :off off', {
                        on: crontab.jobs.filter((j) => j.enabled).length,
                        off: crontab.jobs.filter((j) => !j.enabled).length,
                    })}
                </span>
                {variables.map(([name, value]) => (
                    <span key={name} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground" title={value}>
                        {name}={value.length > 30 ? `${value.slice(0, 30)}…` : value}
                    </span>
                ))}
                <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRaw(!raw)} aria-pressed={raw}>
                        <FileText className="size-3.5" />
                        {raw ? t('Show jobs') : t('Show crontab')}
                    </Button>
                    {canManage && (
                        <Button variant="ghost" size="sm" onClick={onAdd} disabled={busy}>
                            <Plus className="size-3.5" />
                            {t('Add')}
                        </Button>
                    )}
                </div>
            </div>

            {open &&
                (raw ? (
                    <pre className="max-h-96 overflow-auto bg-muted/30 p-4 font-mono text-xs whitespace-pre">{crontab.raw || '—'}</pre>
                ) : jobs.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('No jobs.')}</p>
                ) : (
                    <ul className="divide-y">
                        {jobs.map((job) => (
                            <li
                                key={`${job.line}-${job.hash}`}
                                className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2', !job.enabled && 'opacity-60')}
                            >
                                {canManage ? (
                                    <Switch
                                        checked={job.enabled}
                                        onCheckedChange={() => onToggle(job)}
                                        disabled={busy}
                                        aria-label={job.enabled ? t('Switch off') : t('Switch on')}
                                    />
                                ) : (
                                    <span className={cn('size-2 rounded-full', job.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                                )}
                                <ScheduleCell job={job} generatedAt={generatedAt} locale={locale} />
                                <div className="min-w-0 flex-1 basis-64">
                                    {job.label && <p className="truncate text-sm font-medium">{job.label}</p>}
                                    <code className="block truncate font-mono text-xs text-muted-foreground" title={job.command}>
                                        {job.command}
                                    </code>
                                </div>
                                {canManage && (
                                    <div className="flex shrink-0 items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => onRun(job)} disabled={busy} aria-label={t('Run now')}>
                                            <Play className="size-3.5" />
                                            <span className="hidden lg:inline">{t('Run now')}</span>
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => onEdit(job)} disabled={busy} aria-label={t('Edit')}>
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => onDelete(job)} disabled={busy} aria-label={t('Delete')}>
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                ))}
        </section>
    );
}

function TimersSection({
    timers,
    canManage,
    busy,
    generatedAt,
    locale,
    onAction,
    onJournal,
}: {
    timers: TimerUnit[];
    canManage: boolean;
    busy: boolean;
    generatedAt: string;
    locale: string;
    onAction: (timer: TimerUnit, action: 'run' | 'start' | 'stop' | 'enable' | 'disable') => void;
    onJournal: (timer: TimerUnit) => void;
}) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [onlyActive, setOnlyActive] = useState(true);
    const query = search.trim().toLowerCase();
    const visible = timers.filter(
        (timer) =>
            (!onlyActive || timer.active) &&
            (query === '' || timer.name.toLowerCase().includes(query) || (timer.description ?? '').toLowerCase().includes(query)),
    );

    return (
        <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <Timer className="size-4 text-muted-foreground" />
                <h2 className="font-semibold">{t('Systemd timers')}</h2>
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(v === true)} />
                    {t('Only active')}
                </label>
                <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('Search timers')}
                    className="h-8 w-48"
                />
            </div>

            {visible.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('No timers.')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 font-medium">{t('Timer')}</th>
                                <th className="px-4 py-2 font-medium">{t('Schedule')}</th>
                                <th className="px-4 py-2 font-medium">{t('Next')}</th>
                                <th className="px-4 py-2 font-medium">{t('Last')}</th>
                                <th className="px-4 py-2 font-medium">{t('Result')}</th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {visible.map((timer) => {
                                const failed = timer.result !== null && timer.result !== 'success';

                                return (
                                    <tr key={timer.name} className={cn('hover:bg-muted/30', !timer.active && 'opacity-60')}>
                                        <td className="max-w-xs px-4 py-2">
                                            <p className="truncate font-mono text-xs font-medium">{timer.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">{timer.description}</p>
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                                            {timer.schedule ?? '—'}
                                            {timer.persistent && (
                                                <span className="ml-1" title={t('Runs after a restart when a run was missed')}>
                                                    ⟲
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-xs whitespace-nowrap" title={timer.next ? new Date(timer.next).toLocaleString(locale) : ''}>
                                            {timer.next ? timeAgo(timer.next, generatedAt, locale) : '—'}
                                        </td>
                                        <td className="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground" title={timer.last ? new Date(timer.last).toLocaleString(locale) : ''}>
                                            {timer.last ? timeAgo(timer.last, generatedAt, locale) : '—'}
                                        </td>
                                        <td className="px-4 py-2">
                                            {timer.running ? (
                                                <span className="flex items-center gap-1 text-xs text-sky-600">
                                                    <Spinner className="size-3" />
                                                    {t('Running')}
                                                </span>
                                            ) : timer.result ? (
                                                <span
                                                    className={cn(
                                                        'rounded-md px-2 py-0.5 text-xs font-medium',
                                                        failed
                                                            ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                                                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                                                    )}
                                                >
                                                    {failed ? `${timer.result} (${timer.exit_status ?? '?'})` : t('OK')}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">
                                            <Button variant="ghost" size="sm" onClick={() => onJournal(timer)} aria-label={t('Journal')}>
                                                <FileText className="size-3.5" />
                                            </Button>
                                            {canManage && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onAction(timer, 'run')}
                                                        disabled={busy || timer.running}
                                                        aria-label={t('Run now')}
                                                    >
                                                        <Play className="size-3.5" />
                                                    </Button>
                                                    {timer.active ? (
                                                        <Button variant="ghost" size="sm" onClick={() => onAction(timer, 'disable')} disabled={busy} aria-label={t('Switch off')}>
                                                            <PowerOff className="size-3.5" />
                                                        </Button>
                                                    ) : (
                                                        <Button variant="ghost" size="sm" onClick={() => onAction(timer, 'enable')} disabled={busy} aria-label={t('Switch on')}>
                                                            <Power className="size-3.5" />
                                                        </Button>
                                                    )}
                                                </>
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

function JobDialog({
    initial,
    users,
    timezone,
    onClose,
    onSubmit,
}: {
    initial: JobForm;
    users: string[];
    timezone: string | null;
    onClose: () => void;
    onSubmit: (job: JobForm) => Promise<boolean>;
}) {
    const { t, locale } = useTranslation();
    const [form, setForm] = useState<JobForm>(initial);
    const [preview, setPreview] = useState<{ valid: boolean; next: string[] } | null>(null);
    const [busy, setBusy] = useState(false);
    const editing = initial.line !== undefined;
    const userList = useMemo(() => Array.from(new Set([...users, initial.user])).filter(Boolean), [users, initial.user]);

    useEffect(() => {
        const timer = setTimeout(() => {
            serverRequest<{ valid: boolean; next: string[] }>(CronController.preview(), { schedule: form.schedule, timezone })
                .then(setPreview)
                .catch(() => setPreview({ valid: false, next: [] }));
        }, 300);

        return () => clearTimeout(timer);
    }, [form.schedule, timezone]);

    const submit = async () => {
        setBusy(true);
        const ok = await onSubmit({ ...form, label: form.label.trim() });
        setBusy(false);

        if (ok) {
            onClose();
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{editing ? t('Edit job') : t('Add job')}</DialogTitle>
                    <DialogDescription>
                        {t('The job is written to the crontab of the user and runs in the time zone of the server (:zone).', {
                            zone: timezone ?? 'UTC',
                        })}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="job-form"
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label>{t('User')}</Label>
                            <Select value={form.user} onValueChange={(user) => setForm({ ...form, user })} disabled={editing}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {userList.map((user) => (
                                        <SelectItem key={user} value={user}>
                                            {user}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="job-label">{t('Name')}</Label>
                            <Input
                                id="job-label"
                                value={form.label}
                                onChange={(e) => setForm({ ...form, label: e.target.value })}
                                placeholder={t('Nightly database backup')}
                                maxLength={120}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="job-schedule">{t('Schedule')}</Label>
                        <div className="flex flex-wrap gap-1.5 pb-1">
                            {SCHEDULE_PRESETS.map((preset) => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => setForm({ ...form, schedule: preset.value })}
                                    className={cn(
                                        'rounded-full border px-2.5 py-0.5 text-xs',
                                        form.schedule === preset.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                                    )}
                                >
                                    {t(preset.label)}
                                </button>
                            ))}
                        </div>
                        <Input
                            id="job-schedule"
                            value={form.schedule}
                            onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                            className="font-mono"
                            placeholder="m h dom mon dow"
                        />
                        <p className="text-xs text-muted-foreground">{t('minute · hour · day of month · month · day of week')}</p>
                        {preview && (
                            <div className={cn('rounded-md px-3 py-2 text-xs', preview.valid ? 'bg-muted/50' : 'bg-red-500/10 text-red-600')}>
                                {preview.valid ? (
                                    <>
                                        <p className="flex items-center gap-1.5 font-medium">
                                            <CalendarClock className="size-3.5" />
                                            {describeSchedule(form.schedule.trim(), t)}
                                        </p>
                                        {preview.next.length > 0 && (
                                            <p className="mt-1 text-muted-foreground">
                                                {t('Next runs:')} {preview.next.map((d) => new Date(d).toLocaleString(locale)).join(' · ')}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    t('This is not a valid cron schedule.')
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="job-command">{t('Command')}</Label>
                        <textarea
                            id="job-command"
                            value={form.command}
                            onChange={(e) => setForm({ ...form, command: e.target.value.replace(/[\r\n]+/g, ' ') })}
                            rows={3}
                            className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            placeholder="cd /var/www/app && php artisan schedule:run >> /dev/null 2>&1"
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('Tip: add >> /var/log/my-job.log 2>&1 to keep the output, cron mails it otherwise.')}
                        </p>
                    </div>

                    {!editing && (
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v === true })} />
                            {t('Switched on')}
                        </label>
                    )}
                </form>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button
                        type="submit"
                        form="job-form"
                        disabled={busy || form.command.trim() === '' || preview?.valid === false}
                    >
                        {busy && <Spinner className="size-3.5" />}
                        {editing ? t('Save') : t('Add job')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

CronPage.layout = {
    breadcrumbs: [{ title: 'Cron and timers', href: index() }],
};
