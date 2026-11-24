<?php

namespace App\Services\Network;

use App\Models\Server;
use App\Models\ServerNetworkSample;
use App\Services\Metrics\MetricsReport;
use Illuminate\Support\Facades\DB;

/**
 * The numbers behind the network page of one server: history reduced to a fixed number of points
 * (like {@see MetricsReport}), the current state, the interfaces and what looks wrong.
 */
class NetworkReport
{
    /** A sample is the average of about one minute, so a sum of speeds times this is the bytes. */
    private const SAMPLE_SECONDS = 60;

    public function __construct(private readonly Server $server, private readonly string $range) {}

    /**
     * @return array<string, mixed>
     */
    public function build(): array
    {
        [$length, $bucket] = MetricsReport::RANGES[$this->range];
        $since = now()->subSeconds($length)->toDateTimeString();

        $points = $this->points($since, $bucket);
        $interfaces = $this->interfaceSeries($since, $bucket);
        $totals = $this->totals($since);
        $current = $this->current();

        return [
            'range' => $this->range,
            'bucket_seconds' => $bucket,
            'points' => $points,
            'interfaces' => $interfaces,
            'totals' => $totals,
            'current' => $current,
            'links' => $this->server->network_info['links'] ?? [],
            'listen' => $this->listen(),
            'findings' => $this->findings($points, $totals, $current),
            'has_data' => $points !== [],
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * TCP counters and connection counts per bucket.
     *
     * @return array<int, array<string, int|float|null>>
     */
    private function points(string $since, int $bucket): array
    {
        $epoch = MetricsReport::epoch('collected_at');

        return DB::table('server_network_samples')
            ->where('server_id', $this->server->id)
            ->where('collected_at', '>=', $since)
            ->selectRaw("({$epoch}) - (({$epoch}) % {$bucket}) AS bucket")
            ->selectRaw('COUNT(*) AS samples')
            ->selectRaw('AVG(tcp_established) AS established_avg, MAX(tcp_established) AS established_max')
            ->selectRaw('AVG(tcp_time_wait) AS time_wait_avg, MAX(tcp_time_wait) AS time_wait_max')
            ->selectRaw('MAX(tcp_close_wait) AS close_wait_max, MAX(tcp_syn_recv) AS syn_recv_max')
            ->selectRaw('SUM(tcp_retrans_segs) AS retrans_sum, SUM(tcp_out_segs) AS out_sum')
            ->selectRaw('MAX(tcp_retrans_segs * 100.0 / NULLIF(tcp_out_segs, 0)) AS retrans_pct_max')
            ->selectRaw('AVG(tcp_attempt_fails) AS attempt_fails, AVG(tcp_estab_resets) AS estab_resets')
            ->selectRaw('AVG(tcp_active_opens) AS active_opens, AVG(tcp_passive_opens) AS passive_opens')
            ->selectRaw('MAX(conntrack_count * 100.0 / NULLIF(conntrack_max, 0)) AS conntrack_pct')
            ->groupByRaw('bucket')
            ->orderBy('bucket')
            ->get()
            ->map(fn ($row) => [
                't' => (int) $row->bucket + MetricsReport::offset((int) $row->bucket),
                'samples' => (int) $row->samples,
                'established_avg' => $this->round($row->established_avg, 0),
                'established_max' => $this->round($row->established_max, 0),
                'time_wait_avg' => $this->round($row->time_wait_avg, 0),
                'time_wait_max' => $this->round($row->time_wait_max, 0),
                'close_wait_max' => $this->round($row->close_wait_max, 0),
                'syn_recv_max' => $this->round($row->syn_recv_max, 0),
                'retrans_pct' => $row->out_sum > 0 ? round((float) $row->retrans_sum * 100 / (float) $row->out_sum, 2) : null,
                'retrans_pct_max' => $this->round($row->retrans_pct_max, 2),
                'attempt_fails' => $this->round($row->attempt_fails, 2),
                'estab_resets' => $this->round($row->estab_resets, 2),
                'active_opens' => $this->round($row->active_opens, 2),
                'passive_opens' => $this->round($row->passive_opens, 2),
                'conntrack_pct' => $this->round($row->conntrack_pct),
            ])
            ->all();
    }

    /**
     * Speed, packets, errors and drops of every interface per bucket.
     *
     * @return array<string, array<int, array<string, int|float|null>>>
     */
    private function interfaceSeries(string $since, int $bucket): array
    {
        $epoch = MetricsReport::epoch('s.collected_at');

        return DB::table('server_network_interfaces as i')
            ->join('server_network_samples as s', 's.id', '=', 'i.server_network_sample_id')
            ->where('s.server_id', $this->server->id)
            ->where('s.collected_at', '>=', $since)
            ->selectRaw("({$epoch}) - (({$epoch}) % {$bucket}) AS bucket, i.name AS name")
            ->selectRaw('AVG(i.rx_bps) AS rx_avg, MAX(i.rx_bps) AS rx_max, AVG(i.tx_bps) AS tx_avg, MAX(i.tx_bps) AS tx_max')
            ->selectRaw('AVG(i.rx_pps) AS rx_pps, AVG(i.tx_pps) AS tx_pps')
            ->selectRaw('AVG(i.errors) AS errors, AVG(i.drops) AS drops')
            ->groupByRaw('bucket, i.name')
            ->orderBy('bucket')
            ->get()
            ->groupBy('name')
            ->map(fn ($rows) => $rows->map(fn ($row) => [
                't' => (int) $row->bucket + MetricsReport::offset((int) $row->bucket),
                'rx_avg' => $this->round($row->rx_avg, 0),
                'rx_max' => $this->round($row->rx_max, 0),
                'tx_avg' => $this->round($row->tx_avg, 0),
                'tx_max' => $this->round($row->tx_max, 0),
                'rx_pps' => $this->round($row->rx_pps, 0),
                'tx_pps' => $this->round($row->tx_pps, 0),
                'errors' => $this->round($row->errors, 3),
                'drops' => $this->round($row->drops, 3),
            ])->values()->all())
            ->all();
    }

    /**
     * What every interface carried in the whole range. Every sample is an average speed of one
     * minute, so the speeds are summed and multiplied by 60.
     *
     * @return array<string, array{rx_bytes: int, tx_bytes: int, rx_peak: int, tx_peak: int, packets: int, errors: int, drops: int}>
     */
    private function totals(string $since): array
    {
        return DB::table('server_network_interfaces as i')
            ->join('server_network_samples as s', 's.id', '=', 'i.server_network_sample_id')
            ->where('s.server_id', $this->server->id)
            ->where('s.collected_at', '>=', $since)
            ->groupBy('i.name')
            ->selectRaw('i.name AS name, SUM(i.rx_bps) AS rx_sum, SUM(i.tx_bps) AS tx_sum, MAX(i.rx_bps) AS rx_peak, MAX(i.tx_bps) AS tx_peak')
            ->selectRaw('SUM(i.rx_pps + i.tx_pps) AS pps_sum, SUM(i.errors) AS errors_sum, SUM(i.drops) AS drops_sum')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->name => [
                'rx_bytes' => (int) $row->rx_sum * self::SAMPLE_SECONDS,
                'tx_bytes' => (int) $row->tx_sum * self::SAMPLE_SECONDS,
                'rx_peak' => (int) $row->rx_peak,
                'tx_peak' => (int) $row->tx_peak,
                'packets' => (int) $row->pps_sum * self::SAMPLE_SECONDS,
                'errors' => (int) round((float) $row->errors_sum * self::SAMPLE_SECONDS),
                'drops' => (int) round((float) $row->drops_sum * self::SAMPLE_SECONDS),
            ]])
            ->all();
    }

    /**
     * The newest sample with the speed of every interface, for the tiles at the top of the page.
     *
     * @return array<string, mixed>|null
     */
    private function current(): ?array
    {
        /** @var ServerNetworkSample|null $sample */
        $sample = $this->server->networkSamples()->with('interfaces')->latest('collected_at')->first();

        if ($sample === null) {
            return null;
        }

        return [
            'collected_at' => $sample->collected_at->toIso8601String(),
            'tcp_established' => $sample->tcp_established,
            'tcp_syn_recv' => $sample->tcp_syn_recv,
            'tcp_time_wait' => $sample->tcp_time_wait,
            'tcp_close_wait' => $sample->tcp_close_wait,
            'tcp_listen' => $sample->tcp_listen,
            'retrans_pct' => $sample->tcp_out_segs !== null && $sample->tcp_out_segs > 0
                ? round($sample->tcp_retrans_segs / $sample->tcp_out_segs * 100, 2)
                : null,
            'conntrack_count' => $sample->conntrack_count,
            'conntrack_max' => $sample->conntrack_max,
            'interfaces' => $sample->interfaces->map(fn ($interface) => [
                'name' => $interface->name,
                'rx_bps' => $interface->rx_bps,
                'tx_bps' => $interface->tx_bps,
                'rx_pps' => $interface->rx_pps,
                'tx_pps' => $interface->tx_pps,
                'errors' => $interface->errors,
                'drops' => $interface->drops,
            ])->values()->all(),
        ];
    }

    /**
     * Ports with a listener, the ones open to the whole network first.
     *
     * @return array<int, array{scope: string, port: int}>
     */
    private function listen(): array
    {
        $order = ['any' => 0, 'bound' => 1, 'loopback' => 2];
        $ports = $this->server->network_info['listen'] ?? [];

        usort($ports, fn (array $a, array $b) => [$order[$a['scope']] ?? 3, $a['port']] <=> [$order[$b['scope']] ?? 3, $b['port']]);

        return $ports;
    }

    /**
     * What looks wrong in the range. A finding is only raised when the numbers back it up, so an
     * empty list means the network is healthy as far as the agent can tell.
     *
     * @param  array<int, array<string, int|float|null>>  $points
     * @param  array<string, array<string, int>>  $totals
     * @param  array<string, mixed>|null  $current
     * @return array<int, array{key: string, level: string, context: array<string, string|int|float>}>
     */
    private function findings(array $points, array $totals, ?array $current): array
    {
        $findings = [];

        $retrans = $this->weightedRetransmits();

        if ($retrans !== null && $retrans >= 1) {
            $findings[] = ['key' => 'retransmits', 'level' => $retrans >= 3 ? 'critical' : 'warning', 'context' => ['percent' => round($retrans, 2)]];
        }

        $lost = array_sum(array_column($totals, 'errors')) + array_sum(array_column($totals, 'drops'));
        $packets = array_sum(array_column($totals, 'packets'));

        if ($lost > 0) {
            $findings[] = [
                'key' => 'lost_packets',
                'level' => $packets > 0 && $lost / $packets >= 0.01 ? 'critical' : 'warning',
                'context' => ['count' => $lost],
            ];
        }

        foreach ($this->server->network_info['links'] ?? [] as $link) {
            $total = $totals[$link['name']] ?? null;

            if ($total === null || ($link['speed'] ?? null) === null) {
                continue;
            }

            $used = max($total['rx_peak'], $total['tx_peak']) * 8 / ($link['speed'] * 1_000_000) * 100;

            if ($used >= 80) {
                $findings[] = ['key' => 'link_saturated', 'level' => $used >= 95 ? 'critical' : 'warning', 'context' => ['interface' => $link['name'], 'percent' => round($used)]];
            }
        }

        $conntrack = max(array_filter(array_column($points, 'conntrack_pct'), fn ($value) => $value !== null) ?: [0]);

        if ($conntrack >= 80) {
            $findings[] = ['key' => 'conntrack_full', 'level' => $conntrack >= 95 ? 'critical' : 'warning', 'context' => ['percent' => round($conntrack)]];
        }

        $synRecv = max(array_filter(array_column($points, 'syn_recv_max'), fn ($value) => $value !== null) ?: [0]);

        if ($synRecv >= 200) {
            $findings[] = ['key' => 'syn_backlog', 'level' => 'warning', 'context' => ['count' => (int) $synRecv]];
        }

        if (($current['tcp_close_wait'] ?? 0) >= 100) {
            $findings[] = ['key' => 'close_wait', 'level' => 'warning', 'context' => ['count' => (int) $current['tcp_close_wait']]];
        }

        return $findings;
    }

    /**
     * Retransmitted share of all sent segments in the range. Weighted by the traffic, so a quiet
     * minute with one lost segment does not count as much as a busy minute.
     */
    private function weightedRetransmits(): ?float
    {
        [$length] = MetricsReport::RANGES[$this->range];

        $row = DB::table('server_network_samples')
            ->where('server_id', $this->server->id)
            ->where('collected_at', '>=', now()->subSeconds($length)->toDateTimeString())
            ->selectRaw('SUM(tcp_retrans_segs) AS retrans, SUM(tcp_out_segs) AS sent')
            ->first();

        // Few segments tell nothing: one lost segment out of ten is not a sick network.
        return $row !== null && $row->sent !== null && $row->sent * self::SAMPLE_SECONDS >= 1000
            ? (float) $row->retrans / (float) $row->sent * 100
            : null;
    }

    private function round(mixed $value, int $precision = 1): int|float|null
    {
        if ($value === null) {
            return null;
        }

        return $precision === 0 ? (int) round((float) $value) : round((float) $value, $precision);
    }
}
