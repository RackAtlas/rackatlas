<?php

namespace App\Services\Network;

use App\Models\Server;
use App\Models\ServerNetworkSample;
use App\Services\Metrics\MetricsReport;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The network of all servers of a team side by side: one row per server with the current state,
 * what looks wrong and a short history. Built from a handful of queries for the whole fleet.
 */
class NetworkFleetReport
{
    /** A sample is the average of about one minute, so a sum of speeds times this is the bytes. */
    private const SAMPLE_SECONDS = 60;

    /**
     * @param  Collection<int, Server>  $servers
     */
    public function __construct(private readonly Collection $servers, private readonly string $range) {}

    /**
     * @return array<string, mixed>
     */
    public function build(): array
    {
        [$length, $bucket] = MetricsReport::RANGES[$this->range];
        $since = now()->subSeconds($length)->toDateTimeString();

        $tcp = $this->tcpHistory($since, $bucket);
        $traffic = $this->trafficHistory($since, $bucket);
        $totals = $this->totals($since);
        $latest = $this->latest();

        return [
            'range' => $this->range,
            'bucket_seconds' => $bucket,
            'generated_at' => now()->toIso8601String(),
            'servers' => $this->servers->map(fn (Server $server) => $this->row(
                $server,
                $tcp[$server->id] ?? [],
                $traffic[$server->id] ?? [],
                $totals[$server->id] ?? [],
                $latest[$server->id] ?? null,
            ))->values()->all(),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $tcp
     * @param  array<int, array<string, mixed>>  $traffic
     * @param  array<string, array<string, int>>  $totals
     * @return array<string, mixed>
     */
    private function row(Server $server, array $tcp, array $traffic, array $totals, ?ServerNetworkSample $latest): array
    {
        $links = $server->network_info['links'] ?? [];
        $listen = $server->network_info['listen'] ?? [];

        $sent = array_sum(array_column($tcp, 'out_sum'));
        $retransmitted = array_sum(array_column($tcp, 'retrans_sum'));
        // Few segments tell nothing: one lost segment out of ten is not a sick network.
        $retransmitPercent = $sent * self::SAMPLE_SECONDS >= 1000 ? $retransmitted / $sent * 100 : null;

        $highest = fn (string $column): float => (float) max(array_filter(array_column($tcp, $column), fn ($value) => $value !== null) ?: [0]);

        $findings = $latest === null ? [] : NetworkFindings::evaluate(
            $retransmitPercent,
            $totals,
            $links,
            $highest('conntrack_pct'),
            (int) $highest('syn_recv_max'),
            (int) ($latest->tcp_close_wait ?? 0),
        );

        $lost = array_sum(array_column($totals, 'errors')) + array_sum(array_column($totals, 'drops'));
        $linkSpeed = max([0, ...array_filter(array_column($links, 'speed'))]);
        $peak = max([0, ...array_map(fn (array $item) => max($item['rx_peak'], $item['tx_peak']), $totals)]);

        $trafficByTime = array_column($traffic, null, 't');
        $tcpByTime = array_column($tcp, null, 't');

        return [
            'id' => $server->id,
            'name' => $server->name,
            'status' => $server->status->value,
            'agent_version' => $server->agent_version,
            'last_seen_at' => $server->last_seen_at?->toIso8601String(),
            'has_data' => $latest !== null,
            'current' => $latest === null ? null : [
                'collected_at' => $latest->collected_at->toIso8601String(),
                'rx_bps' => (int) $latest->interfaces->sum('rx_bps'),
                'tx_bps' => (int) $latest->interfaces->sum('tx_bps'),
                'established' => $latest->tcp_established,
                'time_wait' => $latest->tcp_time_wait,
                'close_wait' => $latest->tcp_close_wait,
                'conntrack_pct' => $latest->conntrack_max ? round($latest->conntrack_count / $latest->conntrack_max * 100, 1) : null,
            ],
            'retrans_pct' => $retransmitPercent === null ? null : round($retransmitPercent, 2),
            'lost' => $lost,
            'packets' => array_sum(array_column($totals, 'packets')),
            'link_use' => $linkSpeed > 0 && $peak > 0 ? round($peak * 8 / ($linkSpeed * 1_000_000) * 100, 1) : null,
            'findings' => $findings,
            'exposed' => NetworkFindings::exposed($listen),
            'points' => array_map(fn (int $time) => [
                't' => $time,
                'traffic' => $trafficByTime[$time]['traffic'] ?? null,
                'lost' => $trafficByTime[$time]['lost'] ?? null,
                'retrans_pct' => $tcpByTime[$time]['retrans_pct'] ?? null,
                'established' => $tcpByTime[$time]['established'] ?? null,
            ], array_values(array_unique([...array_keys($trafficByTime), ...array_keys($tcpByTime)]))),
        ];
    }

    /**
     * TCP counters per server and bucket.
     *
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function tcpHistory(string $since, int $bucket): array
    {
        $epoch = MetricsReport::epoch('collected_at');

        return DB::table('server_network_samples')
            ->whereIn('server_id', $this->servers->modelKeys())
            ->where('collected_at', '>=', $since)
            ->selectRaw('server_id')
            ->selectRaw("({$epoch}) - (({$epoch}) % {$bucket}) AS bucket")
            ->selectRaw('AVG(tcp_established) AS established')
            ->selectRaw('SUM(tcp_retrans_segs) AS retrans_sum, SUM(tcp_out_segs) AS out_sum')
            ->selectRaw('MAX(tcp_syn_recv) AS syn_recv_max')
            ->selectRaw('MAX(conntrack_count * 100.0 / NULLIF(conntrack_max, 0)) AS conntrack_pct')
            ->groupByRaw('server_id, bucket')
            ->orderBy('bucket')
            ->get()
            ->groupBy('server_id')
            ->map(fn ($rows) => $rows->map(fn ($row) => [
                't' => (int) $row->bucket + MetricsReport::offset((int) $row->bucket),
                'established' => $row->established === null ? null : (int) round((float) $row->established),
                'retrans_sum' => (float) $row->retrans_sum,
                'out_sum' => (float) $row->out_sum,
                'retrans_pct' => $row->out_sum > 0 ? round((float) $row->retrans_sum * 100 / (float) $row->out_sum, 2) : null,
                'syn_recv_max' => $row->syn_recv_max === null ? null : (int) $row->syn_recv_max,
                'conntrack_pct' => $row->conntrack_pct === null ? null : round((float) $row->conntrack_pct, 1),
            ])->values()->all())
            ->all();
    }

    /**
     * Traffic of all interfaces of a server together per bucket.
     *
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function trafficHistory(string $since, int $bucket): array
    {
        $epoch = MetricsReport::epoch('s.collected_at');

        return DB::table('server_network_interfaces as i')
            ->join('server_network_samples as s', 's.id', '=', 'i.server_network_sample_id')
            ->whereIn('s.server_id', $this->servers->modelKeys())
            ->where('s.collected_at', '>=', $since)
            ->selectRaw('s.server_id AS server_id')
            ->selectRaw("({$epoch}) - (({$epoch}) % {$bucket}) AS bucket")
            ->selectRaw('SUM(i.rx_bps + i.tx_bps) * 1.0 / COUNT(DISTINCT s.id) AS traffic')
            ->selectRaw('SUM(i.errors + i.drops) * 1.0 / COUNT(DISTINCT s.id) AS lost')
            ->groupByRaw('s.server_id, bucket')
            ->orderBy('bucket')
            ->get()
            ->groupBy('server_id')
            ->map(fn ($rows) => $rows->map(fn ($row) => [
                't' => (int) $row->bucket + MetricsReport::offset((int) $row->bucket),
                'traffic' => (int) round((float) $row->traffic),
                'lost' => round((float) $row->lost, 3),
            ])->values()->all())
            ->all();
    }

    /**
     * What every interface of every server carried in the whole range.
     *
     * @return array<int, array<string, array<string, int>>>
     */
    private function totals(string $since): array
    {
        return DB::table('server_network_interfaces as i')
            ->join('server_network_samples as s', 's.id', '=', 'i.server_network_sample_id')
            ->whereIn('s.server_id', $this->servers->modelKeys())
            ->where('s.collected_at', '>=', $since)
            ->groupBy('s.server_id', 'i.name')
            ->selectRaw('s.server_id AS server_id, i.name AS name, MAX(i.rx_bps) AS rx_peak, MAX(i.tx_bps) AS tx_peak')
            ->selectRaw('SUM(i.rx_pps + i.tx_pps) AS pps_sum, SUM(i.errors) AS errors_sum, SUM(i.drops) AS drops_sum')
            ->get()
            ->groupBy('server_id')
            ->map(fn ($rows) => $rows->mapWithKeys(fn ($row) => [$row->name => [
                'rx_peak' => (int) $row->rx_peak,
                'tx_peak' => (int) $row->tx_peak,
                'packets' => (int) $row->pps_sum * self::SAMPLE_SECONDS,
                'errors' => (int) round((float) $row->errors_sum * self::SAMPLE_SECONDS),
                'drops' => (int) round((float) $row->drops_sum * self::SAMPLE_SECONDS),
            ]])->all())
            ->all();
    }

    /**
     * The newest sample of every server with its interfaces.
     *
     * @return array<int, ServerNetworkSample>
     */
    private function latest(): array
    {
        $newest = DB::table('server_network_samples')
            ->whereIn('server_id', $this->servers->modelKeys())
            ->groupBy('server_id')
            ->selectRaw('MAX(id)');

        return ServerNetworkSample::query()
            ->whereIn('id', $newest)
            ->with('interfaces')
            ->get()
            ->keyBy('server_id')
            ->all();
    }
}
