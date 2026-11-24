import { Head, Link, router, usePoll } from '@inertiajs/react';
import { CheckCircle2, Network as NetworkIcon, TriangleAlert } from 'lucide-react';
import { ChartCard, Tile } from '@/components/metrics/cards';
import FleetOverview from '@/components/network/fleet-overview';
import LineChart from '@/components/metrics/line-chart';
import type { ChartSeries } from '@/components/metrics/line-chart';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import { formatBytes, timeAgo } from '@/lib/dashboard';
import { findingText, SENSITIVE_PORTS } from '@/lib/network';
import { cn } from '@/lib/utils';
import { index } from '@/routes/network';
import { show as agentShow } from '@/routes/servers/agent';
import { index as teamsIndex } from '@/routes/teams';
import type {
    MetricsRange,
    NetworkFleetReport,
    NetworkListener,
    NetworkReport,
    NetworkServer,
} from '@/types';

type Props = {
    team: { id: number; name: string } | null;
    servers?: { id: number; name: string }[];
    server?: NetworkServer | null;
    range?: MetricsRange;
    ranges?: MetricsRange[];
    report?: NetworkReport | null;
    fleet?: NetworkFleetReport | null;
};

const RANGE_SECONDS: Record<MetricsRange, number> = {
    '1h': 3600,
    '6h': 21600,
    '24h': 86400,
    '7d': 604800,
    '30d': 2592000,
};

const COLOR = {
    blue: '#3b82f6',
    amber: '#f59e0b',
    emerald: '#10b981',
    violet: '#8b5cf6',
    rose: '#f43f5e',
    red: '#ef4444',
};

const KNOWN_PORTS: Record<number, string> = {
    22: 'SSH',
    25: 'SMTP',
    53: 'DNS',
    80: 'HTTP',
    143: 'IMAP',
    443: 'HTTPS',
    465: 'SMTPS',
    587: 'SMTP',
    993: 'IMAPS',
    ...SENSITIVE_PORTS,
};

const sum = (values: (number | null | undefined)[]): number | null => {
    const present = values.filter(
        (value): value is number => value !== null && value !== undefined,
    );

    return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

const peakOf = (values: (number | null)[]): number | null => {
    const present = values.filter((value): value is number => value !== null);

    return present.length ? Math.max(...present) : null;
};

export default function Network({
    team,
    servers = [],
    server = null,
    range = '24h',
    ranges = [],
    report = null,
    fleet = null,
}: Props) {
    const { t, locale } = useTranslation();

    usePoll(60000, { only: ['server', 'report', 'fleet'] });

    if (!team) {
        return (
            <>
                <Head title={t('Network')} />
                <div className="mx-auto max-w-md space-y-4 p-8 text-center">
                    <h1 className="text-xl font-semibold">
                        {t('Create a team first')}
                    </h1>
                    <Button asChild>
                        <Link href={teamsIndex()}>{t('Create team')}</Link>
                    </Button>
                </div>
            </>
        );
    }

    const go = (next: { server?: number | 'all'; range?: MetricsRange }) =>
        router.get(
            index(),
            {
                server: next.server ?? (fleet ? 'all' : server?.id),
                range: next.range ?? range,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['server', 'range', 'report', 'fleet'],
            },
        );

    const controls = (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select
                value={fleet ? 'all' : server ? String(server.id) : undefined}
                onValueChange={(value) =>
                    go({ server: value === 'all' ? 'all' : Number(value) })
                }
            >
                <SelectTrigger
                    className="w-full sm:w-56"
                    aria-label={t('Server')}
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('All servers')}</SelectItem>
                    {servers.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div
                className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1"
                role="group"
                aria-label={t('Time range')}
            >
                {ranges.map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => go({ range: item })}
                        aria-pressed={item === range}
                        className={cn(
                            'flex-1 rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors',
                            item === range
                                ? 'bg-background font-medium shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );

    const header = (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
                <h1 className="text-2xl font-semibold">{t('Network')}</h1>
                <p className="text-sm text-muted-foreground">
                    {fleet
                        ? t(
                              'Traffic and health of all servers of the team :team side by side',
                              { team: team.name },
                          )
                        : t(
                              'Traffic, connections and open ports of one server of the team :team',
                              { team: team.name },
                          )}
                </p>
            </div>
            {(server || fleet) && controls}
        </div>
    );

    if (fleet) {
        return (
            <>
                <Head title={t('Network')} />
                <div className="mx-auto w-full max-w-[100rem] min-w-0 space-y-6 p-4 md:p-6">
                    {header}
                    <FleetOverview
                        fleet={fleet}
                        onOpen={(id) => go({ server: id })}
                    />
                </div>
            </>
        );
    }

    if (!server || !report) {
        return (
            <>
                <Head title={t('Network')} />
                <div className="mx-auto max-w-md space-y-4 p-8 text-center">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted">
                        <NetworkIcon className="size-7 text-muted-foreground" />
                    </div>
                    <h1 className="text-xl font-semibold">
                        {t('No servers yet')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Add a server with the RackAtlas agent and its network appears here within a minute.',
                        )}
                    </p>
                </div>
            </>
        );
    }

    if (!report.has_data) {
        return (
            <>
                <Head title={t('Network')} />
                <div className="mx-auto w-full max-w-[100rem] min-w-0 space-y-6 p-4 md:p-6">
                    {header}
                    <div className="mx-auto max-w-lg space-y-4 rounded-xl border bg-card p-6 text-center">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted">
                            <NetworkIcon className="size-7 text-muted-foreground" />
                        </div>
                        <h2 className="text-lg font-semibold">
                            {t('No network data from :server yet', {
                                server: server.name,
                            })}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {server.agent_version
                                ? t(
                                      'The agent :version does not send the network detail. Update it to 1.12 or newer with: sudo apt update && sudo apt upgrade',
                                      { version: server.agent_version },
                                  )
                                : t(
                                      'The network detail is sent by the RackAtlas agent. Install it on this server first.',
                                  )}
                        </p>
                        {!server.agent_version && (
                            <Button asChild>
                                <Link href={agentShow(server.id)}>
                                    {t('Install the agent')}
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            </>
        );
    }

    const interfaceNames = Object.keys(report.interfaces);
    const allTimes = Array.from(
        new Set([
            ...report.points.map((point) => point.t),
            ...Object.values(report.interfaces).flatMap((rows) =>
                rows.map((row) => row.t),
            ),
        ]),
    ).sort((a, b) => a - b);

    const to = Math.floor(new Date(report.generated_at).getTime() / 1000);
    const from = to - RANGE_SECONDS[range];
    const gap = report.bucket_seconds * 2.5;
    const chartBase = { times: allTimes, from, to, gap, locale };

    const pointBy = new Map(report.points.map((point) => [point.t, point]));
    const fromPoints = (
        pick: (point: NetworkReport['points'][number]) => number | null,
    ) => allTimes.map((time) => {
        const point = pointBy.get(time);

        return point ? pick(point) : null;
    });

    const fromInterfaces = (
        pick: (row: NetworkReport['interfaces'][string][number]) => number | null,
    ) => {
        const byTime = new Map<number, number | null>();

        for (const rows of Object.values(report.interfaces)) {
            for (const row of rows) {
                const value = pick(row);

                if (value !== null) {
                    byTime.set(row.t, (byTime.get(row.t) ?? 0) + value);
                }
            }
        }

        return allTimes.map((time) => byTime.get(time) ?? null);
    };

    const rate = (value: number) => `${formatBytes(value)}/s`;
    const count = (value: number) => Math.round(value).toLocaleString(locale);
    const perSecond = (value: number) =>
        `${(Math.round(value * 100) / 100).toLocaleString(locale)}/s`;
    const pct = (value: number, digits = 1) =>
        `${(Math.round(value * 10 ** digits) / 10 ** digits).toLocaleString(locale)} %`;

    const rxAvg = fromInterfaces((row) => row.rx_avg);
    const txAvg = fromInterfaces((row) => row.tx_avg);
    const errorsPerSecond = fromInterfaces((row) => row.errors);
    const dropsPerSecond = fromInterfaces((row) => row.drops);
    const lostPerSecond = allTimes.map((_, i) =>
        errorsPerSecond[i] === null && dropsPerSecond[i] === null
            ? null
            : (errorsPerSecond[i] ?? 0) + (dropsPerSecond[i] ?? 0),
    );

    const current = report.current;
    const currentRx = current ? sum(current.interfaces.map((i) => i.rx_bps)) : null;
    const currentTx = current ? sum(current.interfaces.map((i) => i.tx_bps)) : null;

    // Share of the fastest known link the busiest direction uses.
    const linkSpeed = report.links.reduce(
        (best, link) => Math.max(best, link.speed ?? 0),
        0,
    );
    const busiest = Math.max(currentRx ?? 0, currentTx ?? 0);
    const linkUse =
        linkSpeed > 0 && current ? (busiest * 8) / (linkSpeed * 1e6) * 100 : null;

    const totals = Object.values(report.totals);
    const lostTotal = totals.reduce(
        (all, item) => all + item.errors + item.drops,
        0,
    );
    const packetsTotal = totals.reduce((all, item) => all + item.packets, 0);

    const retrans = current?.retrans_pct ?? null;
    const conntrackPct =
        current?.conntrack_count != null && current.conntrack_max
            ? (current.conntrack_count / current.conntrack_max) * 100
            : null;
    const hasConntrack = report.points.some(
        (point) => point.conntrack_pct !== null,
    );

    const exposure = (listener: NetworkListener) => {
        const sensitive = SENSITIVE_PORTS[listener.port];

        if (listener.scope === 'any') {
            return sensitive
                ? {
                      label: t('Open to everyone'),
                      note: t(
                          ':service should not listen on all addresses. Check the firewall.',
                          { service: sensitive },
                      ),
                      className:
                          'bg-red-500/10 text-red-700 dark:text-red-300',
                  }
                : {
                      label: t('Open to everyone'),
                      note: null,
                      className:
                          'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  };
        }

        return listener.scope === 'bound'
            ? {
                  label: t('One address'),
                  note: null,
                  className: 'bg-muted text-muted-foreground',
              }
            : {
                  label: t('Only this server'),
                  note: null,
                  className:
                      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              };
    };

    const series = (...items: ChartSeries[]) => items;

    return (
        <>
            <Head title={t('Network')} />

            <div className="mx-auto w-full max-w-[100rem] min-w-0 space-y-6 p-4 md:p-6">
                {header}

                {report.findings.length === 0 ? (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <p>
                            {t(
                                'No network problem found in this period: no lost packets, no retransmits and no saturated link.',
                            )}
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {report.findings.map((finding) => (
                            <li
                                key={finding.key + String(finding.context.interface ?? '')}
                                className={cn(
                                    'flex items-start gap-2 rounded-xl border p-3 text-sm',
                                    finding.level === 'critical'
                                        ? 'border-red-500/30 bg-red-500/5'
                                        : 'border-amber-500/30 bg-amber-500/5',
                                )}
                            >
                                <TriangleAlert
                                    className={cn(
                                        'mt-0.5 size-4 shrink-0',
                                        finding.level === 'critical'
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-amber-600 dark:text-amber-400',
                                    )}
                                />
                                <p>{findingText(finding, t, locale)}</p>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
                    <Tile
                        title={t('Incoming now')}
                        value={currentRx === null ? '–' : rate(currentRx)}
                        detail={
                            current
                                ? t(':count packets/s', {
                                      count: count(
                                          sum(current.interfaces.map((i) => i.rx_pps)) ?? 0,
                                      ),
                                  })
                                : undefined
                        }
                    />
                    <Tile
                        title={t('Outgoing now')}
                        value={currentTx === null ? '–' : rate(currentTx)}
                        detail={
                            linkUse !== null
                                ? t(':percent of the link speed', {
                                      percent: pct(linkUse),
                                  })
                                : undefined
                        }
                        level={
                            linkUse === null
                                ? 'ok'
                                : linkUse >= 95
                                  ? 'critical'
                                  : linkUse >= 80
                                    ? 'warning'
                                    : 'ok'
                        }
                    />
                    <Tile
                        title={t('Retransmits')}
                        value={retrans === null ? '–' : pct(retrans, 2)}
                        detail={t('of the sent TCP segments')}
                        level={
                            retrans === null
                                ? 'ok'
                                : retrans >= 3
                                  ? 'critical'
                                  : retrans >= 1
                                    ? 'warning'
                                    : 'ok'
                        }
                    />
                    <Tile
                        title={t('Connections')}
                        value={
                            current?.tcp_established == null
                                ? '–'
                                : count(current.tcp_established)
                        }
                        detail={
                            current?.tcp_time_wait != null
                                ? t(':count in TIME_WAIT', {
                                      count: count(current.tcp_time_wait),
                                  })
                                : undefined
                        }
                    />
                    <Tile
                        title={t('Lost packets')}
                        value={count(lostTotal)}
                        detail={
                            packetsTotal > 0
                                ? t(':percent of :range traffic', {
                                      percent: pct((lostTotal / packetsTotal) * 100, 3),
                                      range,
                                  })
                                : t('in :range', { range })
                        }
                        level={
                            lostTotal === 0
                                ? 'ok'
                                : packetsTotal > 0 && lostTotal / packetsTotal >= 0.01
                                  ? 'critical'
                                  : 'warning'
                        }
                    />
                    <Tile
                        title={t('Last data')}
                        value={
                            current
                                ? timeAgo(
                                      current.collected_at,
                                      report.generated_at,
                                      locale,
                                  )
                                : '–'
                        }
                        detail={
                            conntrackPct !== null
                                ? t('Firewall table :percent full', {
                                      percent: pct(conntrackPct, 0),
                                  })
                                : server.agent_version
                                  ? `${t('Agent')} ${server.agent_version}`
                                  : undefined
                        }
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <ChartCard
                        title={t('Traffic')}
                        summary={`↓ ${rate(peakOf(fromInterfaces((row) => row.rx_max)) ?? 0)} · ↑ ${rate(peakOf(fromInterfaces((row) => row.tx_max)) ?? 0)} ${t('peak')}`}
                        legend={[
                            { label: t('Incoming'), color: COLOR.blue },
                            { label: t('Outgoing'), color: COLOR.emerald },
                        ]}
                    >
                        <LineChart
                            {...chartBase}
                            label={t('Traffic')}
                            formatValue={rate}
                            series={series(
                                {
                                    key: 'rx',
                                    label: t('Incoming'),
                                    color: COLOR.blue,
                                    area: true,
                                    values: rxAvg,
                                },
                                {
                                    key: 'tx',
                                    label: t('Outgoing'),
                                    color: COLOR.emerald,
                                    values: txAvg,
                                },
                            )}
                        />
                    </ChartCard>

                    <ChartCard
                        title={t('TCP retransmits')}
                        summary={t('Share of segments sent again. Above 1 % the connection is lossy.')}
                        legend={[
                            { label: t('Average'), color: COLOR.violet },
                            { label: t('Worst minute'), color: COLOR.rose },
                        ]}
                    >
                        <LineChart
                            {...chartBase}
                            label={t('TCP retransmits')}
                            min={0}
                            formatValue={(value) => pct(value, 2)}
                            thresholds={[
                                { value: 1, color: COLOR.amber, label: t('Warning') },
                                { value: 3, color: COLOR.red, label: t('Critical') },
                            ]}
                            series={series(
                                {
                                    key: 'retrans',
                                    label: t('Average'),
                                    color: COLOR.violet,
                                    area: true,
                                    values: fromPoints((p) => p.retrans_pct),
                                },
                                {
                                    key: 'retrans_max',
                                    label: t('Worst minute'),
                                    color: COLOR.rose,
                                    dashed: true,
                                    values: fromPoints((p) => p.retrans_pct_max),
                                },
                            )}
                        />
                    </ChartCard>

                    <ChartCard
                        title={t('TCP connections')}
                        legend={[
                            { label: t('Established'), color: COLOR.blue },
                            { label: 'TIME_WAIT', color: COLOR.amber },
                            { label: 'CLOSE_WAIT', color: COLOR.rose },
                        ]}
                    >
                        <LineChart
                            {...chartBase}
                            label={t('TCP connections')}
                            min={0}
                            formatValue={count}
                            series={series(
                                {
                                    key: 'established',
                                    label: t('Established'),
                                    color: COLOR.blue,
                                    area: true,
                                    values: fromPoints((p) => p.established_avg),
                                },
                                {
                                    key: 'time_wait',
                                    label: 'TIME_WAIT',
                                    color: COLOR.amber,
                                    values: fromPoints((p) => p.time_wait_avg),
                                },
                                {
                                    key: 'close_wait',
                                    label: 'CLOSE_WAIT',
                                    color: COLOR.rose,
                                    values: fromPoints((p) => p.close_wait_max),
                                },
                            )}
                        />
                    </ChartCard>

                    <ChartCard
                        title={t('Failed connections')}
                        summary={t('Connection attempts that failed and connections reset by the other side')}
                        legend={[
                            { label: t('Failed attempts'), color: COLOR.amber },
                            { label: t('Resets'), color: COLOR.rose },
                        ]}
                    >
                        <LineChart
                            {...chartBase}
                            label={t('Failed connections')}
                            min={0}
                            formatValue={perSecond}
                            series={series(
                                {
                                    key: 'attempt_fails',
                                    label: t('Failed attempts'),
                                    color: COLOR.amber,
                                    area: true,
                                    values: fromPoints((p) => p.attempt_fails),
                                },
                                {
                                    key: 'estab_resets',
                                    label: t('Resets'),
                                    color: COLOR.rose,
                                    values: fromPoints((p) => p.estab_resets),
                                },
                            )}
                        />
                    </ChartCard>

                    <ChartCard
                        title={t('Lost packets')}
                        summary={t('Errors and dropped packets per second on the network cards')}
                        legend={[{ label: t('Errors and drops'), color: COLOR.rose }]}
                    >
                        <LineChart
                            {...chartBase}
                            label={t('Lost packets')}
                            min={0}
                            formatValue={perSecond}
                            series={series({
                                key: 'lost',
                                label: t('Errors and drops'),
                                color: COLOR.rose,
                                area: true,
                                values: lostPerSecond,
                            })}
                        />
                    </ChartCard>

                    {hasConntrack ? (
                        <ChartCard
                            title={t('Firewall connection table')}
                            summary={t('Share of the connection tracking table in use')}
                            legend={[{ label: t('Used'), color: COLOR.violet }]}
                        >
                            <LineChart
                                {...chartBase}
                                label={t('Firewall connection table')}
                                min={0}
                                max={100}
                                formatValue={(value) => pct(value, 0)}
                                thresholds={[
                                    { value: 80, color: COLOR.amber, label: t('Warning') },
                                    { value: 95, color: COLOR.red, label: t('Critical') },
                                ]}
                                series={series({
                                    key: 'conntrack',
                                    label: t('Used'),
                                    color: COLOR.violet,
                                    area: true,
                                    values: fromPoints((p) => p.conntrack_pct),
                                })}
                            />
                        </ChartCard>
                    ) : (
                        <ChartCard
                            title={t('Packets')}
                            legend={[
                                { label: t('Incoming'), color: COLOR.blue },
                                { label: t('Outgoing'), color: COLOR.emerald },
                            ]}
                        >
                            <LineChart
                                {...chartBase}
                                label={t('Packets')}
                                min={0}
                                formatValue={(value) => `${count(value)}/s`}
                                series={series(
                                    {
                                        key: 'rx_pps',
                                        label: t('Incoming'),
                                        color: COLOR.blue,
                                        area: true,
                                        values: fromInterfaces((row) => row.rx_pps),
                                    },
                                    {
                                        key: 'tx_pps',
                                        label: t('Outgoing'),
                                        color: COLOR.emerald,
                                        values: fromInterfaces((row) => row.tx_pps),
                                    },
                                )}
                            />
                        </ChartCard>
                    )}
                </div>

                <section className="min-w-0 space-y-3 rounded-xl border bg-card p-3 sm:p-4">
                    <h2 className="text-sm font-medium">
                        {t('Network interfaces')}
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[40rem] text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th className="py-2 pr-3 font-normal">{t('Interface')}</th>
                                    <th className="py-2 pr-3 font-normal">{t('Link')}</th>
                                    <th className="py-2 pr-3 text-right font-normal">{t('Received')}</th>
                                    <th className="py-2 pr-3 text-right font-normal">{t('Sent')}</th>
                                    <th className="py-2 pr-3 text-right font-normal">{t('Peak in / out')}</th>
                                    <th className="py-2 text-right font-normal">{t('Errors / drops')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(interfaceNames.length
                                    ? interfaceNames
                                    : report.links.map((link) => link.name)
                                ).map((name) => {
                                    const link = report.links.find((item) => item.name === name);
                                    const total = report.totals[name];

                                    return (
                                        <tr key={name} className="border-b last:border-0">
                                            <td className="py-2 pr-3 font-mono">{name}</td>
                                            <td className="py-2 pr-3">
                                                <span
                                                    className={cn(
                                                        'mr-2 inline-block size-2 rounded-full',
                                                        link?.state === 'up'
                                                            ? 'bg-emerald-500'
                                                            : 'bg-red-500',
                                                    )}
                                                />
                                                {link
                                                    ? `${link.state}${link.speed ? ` · ${link.speed >= 1000 ? `${link.speed / 1000} Gbit/s` : `${link.speed} Mbit/s`}` : ''}${link.mtu ? ` · MTU ${link.mtu}` : ''}`
                                                    : '–'}
                                            </td>
                                            <td className="py-2 pr-3 text-right tabular-nums">
                                                {total ? formatBytes(total.rx_bytes) : '–'}
                                            </td>
                                            <td className="py-2 pr-3 text-right tabular-nums">
                                                {total ? formatBytes(total.tx_bytes) : '–'}
                                            </td>
                                            <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                                                {total
                                                    ? `${rate(total.rx_peak)} / ${rate(total.tx_peak)}`
                                                    : '–'}
                                            </td>
                                            <td
                                                className={cn(
                                                    'py-2 text-right tabular-nums',
                                                    total && total.errors + total.drops > 0
                                                        ? 'text-amber-600 dark:text-amber-400'
                                                        : '',
                                                )}
                                            >
                                                {total
                                                    ? `${count(total.errors)} / ${count(total.drops)}`
                                                    : '–'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t(
                            'Totals are for the selected period. Virtual interfaces (Docker, bridges, loopback) are not counted.',
                        )}
                    </p>
                </section>

                <section className="min-w-0 space-y-3 rounded-xl border bg-card p-3 sm:p-4">
                    <h2 className="text-sm font-medium">{t('Listening ports')}</h2>
                    {report.listen.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('The agent has not reported any listening port yet.')}
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {report.listen.map((listener) => {
                                const info = exposure(listener);

                                return (
                                    <li
                                        key={`${listener.scope}-${listener.port}`}
                                        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                                    >
                                        <span className="w-16 font-mono tabular-nums">
                                            {listener.port}
                                        </span>
                                        <span className="w-28 text-muted-foreground">
                                            {KNOWN_PORTS[listener.port] ?? ''}
                                        </span>
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 text-xs',
                                                info.className,
                                            )}
                                        >
                                            {info.label}
                                        </span>
                                        {info.note && (
                                            <span className="text-xs text-red-600 dark:text-red-400">
                                                {info.note}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {t(
                            '“Open to everyone” means the program accepts connections on all addresses. Whether it can be reached from the internet depends on the firewall. Only TCP is listed.',
                        )}
                    </p>
                </section>
            </div>
        </>
    );
}
