import { CheckCircle2, ArrowDown, ArrowUp, ArrowUpDown, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ChartCard, Tile } from '@/components/metrics/cards';
import LineChart from '@/components/metrics/line-chart';
import type { ChartSeries } from '@/components/metrics/line-chart';
import { useTranslation } from '@/hooks/use-translation';
import { formatBytes, timeAgo } from '@/lib/dashboard';
import { findingText } from '@/lib/network';
import { cn } from '@/lib/utils';
import type { MetricsRange, NetworkFleetReport, NetworkFleetServer } from '@/types';

const RANGE_SECONDS: Record<MetricsRange, number> = {
    '1h': 3600,
    '6h': 21600,
    '24h': 86400,
    '7d': 604800,
    '30d': 2592000,
};

const PALETTE = [
    '#3b82f6',
    '#f59e0b',
    '#10b981',
    '#8b5cf6',
    '#f43f5e',
    '#06b6d4',
    '#84cc16',
    '#ec4899',
    '#f97316',
    '#14b8a6',
    '#6366f1',
    '#a16207',
];

const THRESHOLD = { amber: '#f59e0b', red: '#ef4444' };

type Level = 'ok' | 'warning' | 'critical';

const levelText: Record<Level, string> = {
    ok: '',
    warning: 'text-amber-600 dark:text-amber-400',
    critical: 'text-red-600 dark:text-red-400',
};

const levelRank: Record<Level, number> = { ok: 0, warning: 1, critical: 2 };

type SortKey = 'attention' | 'name' | 'traffic' | 'retrans' | 'connections' | 'lost';

type Row = {
    server: NetworkFleetServer;
    color: string;
    level: Level;
    traffic: number | null;
    attention: number;
};

/** A line that shows the shape of the traffic, scaled to its own peak. */
function Trend({ values, label }: { values: number[]; label: string }) {
    if (values.length < 2) {
        return null;
    }

    const peak = Math.max(...values, 1);
    const step = 100 / (values.length - 1);
    const points = values
        .map((value, i) => `${(i * step).toFixed(1)},${(24 - (value / peak) * 22 - 1).toFixed(1)}`)
        .join(' ');

    return (
        <svg
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className="h-6 w-20 text-muted-foreground/60"
            role="img"
            aria-label={label}
        >
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

export default function FleetOverview({
    fleet,
    onOpen,
}: {
    fleet: NetworkFleetReport;
    onOpen: (serverId: number) => void;
}) {
    const { t, locale } = useTranslation();
    const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
        key: 'attention',
        desc: true,
    });

    const rate = (value: number) => `${formatBytes(value)}/s`;
    const count = (value: number) => Math.round(value).toLocaleString(locale);
    const pct = (value: number, digits = 1) =>
        `${(Math.round(value * 10 ** digits) / 10 ** digits).toLocaleString(locale)} %`;

    const rows = useMemo<Row[]>(() => {
        const built = fleet.servers.map((server, i): Row => {
            const levels: Level[] = server.findings.map((finding) => finding.level);

            if (server.exposed.length > 0) {
                levels.push('warning');
            }

            const level = levels.reduce<Level>(
                (top, next) => (levelRank[next] > levelRank[top] ? next : top),
                'ok',
            );
            const critical = server.findings.filter((f) => f.level === 'critical').length;

            return {
                server,
                color: PALETTE[i % PALETTE.length],
                level,
                traffic: server.current ? server.current.rx_bps + server.current.tx_bps : null,
                attention:
                    critical * 100 +
                    (server.findings.length - critical) * 10 +
                    server.exposed.length,
            };
        });

        const pick = (row: Row): number | string => {
            switch (sort.key) {
                case 'name':
                    return row.server.name.toLowerCase();
                case 'traffic':
                    return row.traffic ?? -1;
                case 'retrans':
                    return row.server.retrans_pct ?? -1;
                case 'connections':
                    return row.server.current?.established ?? -1;
                case 'lost':
                    return row.server.lost;
                default:
                    return row.server.has_data ? row.attention : -1;
            }
        };

        return [...built].sort((a, b) => {
            const x = pick(a);
            const y = pick(b);
            const order = x < y ? -1 : x > y ? 1 : 0;

            return (sort.desc ? -order : order) || a.server.name.localeCompare(b.server.name);
        });
    }, [fleet.servers, sort]);

    const withData = rows.filter((row) => row.server.has_data);
    const problems = withData.filter((row) => row.level !== 'ok');
    const rx = withData.reduce((all, row) => all + (row.server.current?.rx_bps ?? 0), 0);
    const tx = withData.reduce((all, row) => all + (row.server.current?.tx_bps ?? 0), 0);
    const connections = withData.reduce((all, row) => all + (row.server.current?.established ?? 0), 0);
    const lost = withData.reduce((all, row) => all + row.server.lost, 0);
    const packets = withData.reduce((all, row) => all + row.server.packets, 0);
    const exposed = withData.flatMap((row) => row.server.exposed);
    const exposedNames = [...new Set(exposed.map((item) => item.service))];

    const issues = problems.flatMap((row) =>
        row.server.findings.map((finding) => ({ row, finding })),
    );
    const shownIssues = issues
        .sort((a, b) => levelRank[b.finding.level] - levelRank[a.finding.level])
        .slice(0, 8);

    const to = Math.floor(new Date(fleet.generated_at).getTime() / 1000);
    const from = to - RANGE_SECONDS[fleet.range];
    const times = useMemo(
        () =>
            [...new Set(fleet.servers.flatMap((server) => server.points.map((point) => point.t)))].sort(
                (a, b) => a - b,
            ),
        [fleet.servers],
    );

    const series = (pick: (point: NetworkFleetServer['points'][number]) => number | null): ChartSeries[] =>
        withData.map((row) => {
            const byTime = new Map(row.server.points.map((point) => [point.t, pick(point)]));

            return {
                key: String(row.server.id),
                label: row.server.name,
                color: row.color,
                values: times.map((time) => byTime.get(time) ?? null),
            };
        });

    const chartBase = {
        times,
        from,
        to,
        gap: fleet.bucket_seconds * 2.5,
        locale,
        min: 0,
    };

    const toggle = (key: SortKey) =>
        setSort((previous) =>
            previous.key === key
                ? { key, desc: !previous.desc }
                : { key, desc: key !== 'name' },
        );

    const header = (key: SortKey, label: string, className?: string) => (
        <th className={cn('px-3 py-2 font-medium', className)}>
            <button
                type="button"
                onClick={() => toggle(key)}
                className="inline-flex items-center gap-1 hover:text-foreground"
            >
                {label}
                {sort.key === key ? (
                    sort.desc ? (
                        <ArrowDown className="size-3" />
                    ) : (
                        <ArrowUp className="size-3" />
                    )
                ) : (
                    <ArrowUpDown className="size-3 opacity-40" />
                )}
            </button>
        </th>
    );

    const findingLabel: Record<string, string> = {
        retransmits: t('Retransmits'),
        lost_packets: t('Lost packets'),
        link_saturated: t('Saturated link'),
        conntrack_full: t('Firewall table full'),
        syn_backlog: 'SYN_RECV',
        close_wait: 'CLOSE_WAIT',
    };

    const legend = (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {withData.map((row) => (
                <li key={row.server.id} className="flex items-center gap-1.5">
                    <span
                        className="inline-block h-0.5 w-3 rounded-full"
                        style={{ backgroundColor: row.color }}
                    />
                    {row.server.name}
                </li>
            ))}
        </ul>
    );

    return (
        <div className="space-y-6">
            {issues.length === 0 && exposed.length === 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p>
                        {withData.length === 0
                            ? t('No server sends network data yet. Update the agent to 1.12 or newer.')
                            : t('No network problem found on any server in this period.')}
                    </p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {shownIssues.map(({ row, finding }) => (
                        <li
                            key={`${row.server.id}-${finding.key}-${String(finding.context.interface ?? '')}`}
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
                            <p>
                                <button
                                    type="button"
                                    onClick={() => onOpen(row.server.id)}
                                    className="font-medium hover:underline"
                                >
                                    {row.server.name}
                                </button>
                                {': '}
                                {findingText(finding, t, locale)}
                            </p>
                        </li>
                    ))}
                    {issues.length > shownIssues.length && (
                        <li className="px-1 text-xs text-muted-foreground">
                            {t('and :count more', { count: issues.length - shownIssues.length })}
                        </li>
                    )}
                    {exposed.length > 0 && (
                        <li className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <p>
                                {t(':count services that should not be public listen on all addresses (:services). Check the firewall.', {
                                    count: exposed.length,
                                    services: exposedNames.join(', '),
                                })}
                            </p>
                        </li>
                    )}
                </ul>
            )}

            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
                <Tile
                    title={t('Servers with a problem')}
                    value={`${problems.length} / ${withData.length}`}
                    detail={
                        rows.length > withData.length
                            ? t(':count without network data', { count: rows.length - withData.length })
                            : undefined
                    }
                    level={problems.some((row) => row.level === 'critical') ? 'critical' : problems.length > 0 ? 'warning' : 'ok'}
                />
                <Tile title={t('Traffic now')} value={`↓ ${rate(rx)}`} detail={`↑ ${rate(tx)}`} />
                <Tile title={t('Connections')} value={count(connections)} detail={t('Established')} />
                <Tile
                    title={t('Lost packets')}
                    value={count(lost)}
                    detail={
                        packets > 0
                            ? t(':percent of :range traffic', {
                                  percent: pct((lost / packets) * 100, 3),
                                  range: fleet.range,
                              })
                            : t('in :range', { range: fleet.range })
                    }
                    level={lost === 0 ? 'ok' : packets > 0 && lost / packets >= 0.01 ? 'critical' : 'warning'}
                />
                <Tile
                    title={t('Exposed services')}
                    value={exposed.length}
                    detail={exposedNames.length ? exposedNames.join(', ') : t('Databases open to everyone')}
                    level={exposed.length > 0 ? 'warning' : 'ok'}
                />
            </div>

            <section className="overflow-hidden rounded-xl border bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[60rem] text-sm">
                        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                            <tr>
                                {header('name', t('Server'))}
                                {header('traffic', t('Traffic now'))}
                                <th className="px-3 py-2 font-medium">{t('Link use')}</th>
                                {header('retrans', t('Retransmits'))}
                                {header('connections', t('Connections'))}
                                {header('lost', t('Lost packets'))}
                                <th className="px-3 py-2 font-medium">{t('Firewall table')}</th>
                                {header('attention', t('Problems'))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map((row) => {
                                const { server } = row;
                                const current = server.current;

                                return (
                                    <tr
                                        key={server.id}
                                        onClick={() => onOpen(server.id)}
                                        className="cursor-pointer hover:bg-muted/40"
                                    >
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 text-left font-medium"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onOpen(server.id);
                                                }}
                                            >
                                                <span
                                                    className={cn(
                                                        'size-2 shrink-0 rounded-full',
                                                        server.status === 'offline'
                                                            ? 'bg-red-500'
                                                            : server.status === 'online'
                                                              ? 'bg-emerald-500'
                                                              : 'bg-muted-foreground/40',
                                                    )}
                                                />
                                                <span
                                                    className="size-2 shrink-0 rounded-sm"
                                                    style={{ backgroundColor: row.color }}
                                                />
                                                <span className="truncate">{server.name}</span>
                                            </button>
                                            {current && (
                                                <p className="pl-8 text-xs text-muted-foreground">
                                                    {timeAgo(current.collected_at, fleet.generated_at, locale)}
                                                </p>
                                            )}
                                        </td>
                                        {!server.has_data || !current ? (
                                            <td colSpan={6} className="px-3 py-2 text-xs text-muted-foreground">
                                                {server.agent_version
                                                    ? t('No network data yet. The agent :version does not send it, update it to 1.12 or newer.', {
                                                          version: server.agent_version,
                                                      })
                                                    : t('No network data: the RackAtlas agent is not installed.')}
                                            </td>
                                        ) : (
                                            <>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-28 text-xs whitespace-nowrap tabular-nums">
                                                            ↓ {rate(current.rx_bps)}
                                                            <br />↑ {rate(current.tx_bps)}
                                                        </span>
                                                        <Trend
                                                            label={`${t('Traffic')} ${server.name}`}
                                                            values={server.points
                                                                .map((point) => point.traffic)
                                                                .filter((value): value is number => value !== null)}
                                                        />
                                                    </div>
                                                </td>
                                                <td
                                                    className={cn(
                                                        'px-3 py-2 tabular-nums',
                                                        server.link_use !== null && server.link_use >= 95
                                                            ? levelText.critical
                                                            : server.link_use !== null && server.link_use >= 80
                                                              ? levelText.warning
                                                              : '',
                                                    )}
                                                >
                                                    {server.link_use === null ? '–' : pct(server.link_use, 0)}
                                                </td>
                                                <td
                                                    className={cn(
                                                        'px-3 py-2 tabular-nums',
                                                        server.retrans_pct !== null && server.retrans_pct >= 3
                                                            ? levelText.critical
                                                            : server.retrans_pct !== null && server.retrans_pct >= 1
                                                              ? levelText.warning
                                                              : '',
                                                    )}
                                                >
                                                    {server.retrans_pct === null ? '–' : pct(server.retrans_pct, 2)}
                                                </td>
                                                <td className="px-3 py-2 tabular-nums">
                                                    {current.established === null ? '–' : count(current.established)}
                                                </td>
                                                <td
                                                    className={cn(
                                                        'px-3 py-2 tabular-nums',
                                                        server.lost > 0 ? levelText.warning : '',
                                                    )}
                                                >
                                                    {count(server.lost)}
                                                </td>
                                                <td
                                                    className={cn(
                                                        'px-3 py-2 tabular-nums',
                                                        current.conntrack_pct !== null && current.conntrack_pct >= 95
                                                            ? levelText.critical
                                                            : current.conntrack_pct !== null && current.conntrack_pct >= 80
                                                              ? levelText.warning
                                                              : '',
                                                    )}
                                                >
                                                    {current.conntrack_pct === null ? '–' : pct(current.conntrack_pct, 0)}
                                                </td>
                                            </>
                                        )}
                                        <td className="px-3 py-2">
                                            <div className="flex flex-wrap gap-1">
                                                {server.findings.map((finding) => (
                                                    <span
                                                        key={finding.key + String(finding.context.interface ?? '')}
                                                        title={findingText(finding, t, locale)}
                                                        className={cn(
                                                            'rounded-full px-2 py-0.5 text-xs',
                                                            finding.level === 'critical'
                                                                ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                                                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                                                        )}
                                                    >
                                                        {findingLabel[finding.key]}
                                                    </span>
                                                ))}
                                                {server.exposed.map((item) => (
                                                    <span
                                                        key={item.port}
                                                        title={t(':service should not listen on all addresses. Check the firewall.', {
                                                            service: item.service,
                                                        })}
                                                        className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-300"
                                                    >
                                                        {item.service} :{item.port}
                                                    </span>
                                                ))}
                                                {server.has_data &&
                                                    server.findings.length === 0 &&
                                                    server.exposed.length === 0 && (
                                                        <span className="text-muted-foreground">–</span>
                                                    )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
            <p className="-mt-4 text-xs text-muted-foreground">
                {t('Click a server to see its network in detail. Retransmits and lost packets are for the selected period.')}
            </p>

            {times.length > 0 && withData.length > 0 && (
                <div className="grid gap-4 xl:grid-cols-2">
                    <ChartCard
                        title={t('Traffic')}
                        summary={t('Incoming and outgoing together')}
                    >
                        <LineChart
                            {...chartBase}
                            label={t('Traffic')}
                            formatValue={rate}
                            series={series((point) => point.traffic)}
                        />
                        {legend}
                    </ChartCard>

                    <ChartCard
                        title={t('TCP retransmits')}
                        summary={t('Share of segments sent again. Above 1 % the connection is lossy.')}
                    >
                        <LineChart
                            {...chartBase}
                            label={t('TCP retransmits')}
                            formatValue={(value) => pct(value, 2)}
                            thresholds={[
                                { value: 1, color: THRESHOLD.amber, label: t('Warning') },
                                { value: 3, color: THRESHOLD.red, label: t('Critical') },
                            ]}
                            series={series((point) => point.retrans_pct)}
                        />
                        {legend}
                    </ChartCard>

                    <ChartCard title={t('TCP connections')} summary={t('Established')}>
                        <LineChart
                            {...chartBase}
                            label={t('TCP connections')}
                            formatValue={count}
                            series={series((point) => point.established)}
                        />
                        {legend}
                    </ChartCard>

                    <ChartCard
                        title={t('Lost packets')}
                        summary={t('Errors and dropped packets per second on the network cards')}
                    >
                        <LineChart
                            {...chartBase}
                            label={t('Lost packets')}
                            formatValue={(value) => `${(Math.round(value * 100) / 100).toLocaleString(locale)}/s`}
                            series={series((point) => point.lost)}
                        />
                        {legend}
                    </ChartCard>
                </div>
            )}
        </div>
    );
}
