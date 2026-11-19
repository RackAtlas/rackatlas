<?php

namespace App\Services\Watch;

use App\Enums\AlertType;
use App\Models\Server;
use App\Models\ServerMetric;
use App\Models\ServerMetricDisk;
use App\Support\DashboardSettings;
use Illuminate\Support\Collection;

/**
 * Compares a server with its own normal behaviour, without any cloud service and without a model.
 *
 * The normal level of a value is the median of the last day and its spread is the median absolute
 * deviation, so a few earlier spikes do not hide a new one. A value is unusual when it is far above
 * its normal level for several samples in a row. The disks are judged by a straight line through
 * their growth, which tells days in advance that a disk will be full.
 */
class BaselineDetector
{
    /** Spread of a normal sample can never be below this, so a flat line does not make every wobble unusual. */
    private const FLOORS = ['cpu' => 3.0, 'ram' => 2.0, 'load' => 0.1, 'net_rx' => 100_000.0, 'net_tx' => 100_000.0];

    /** A change smaller than this is never reported, however unusual it is for this server. */
    private const MIN_JUMP = ['cpu' => 20.0, 'ram' => 10.0, 'load' => 0.5, 'net_rx' => 10_000_000.0, 'net_tx' => 10_000_000.0];

    /** Traffic comes in bursts (downloads, backups, deploys), so it must stay unusual for longer than the rest. */
    private const CONFIRM = ['net_rx' => 10, 'net_tx' => 10];

    /** The value must also be this many times the normal level, so a busy server is not flagged for being a bit busier. */
    private const MIN_RATIO = ['net_rx' => 3.0, 'net_tx' => 3.0];

    /** The newest samples (half an hour) are left out of the baseline, so a lasting rise does not become the normal level. */
    private const SKIP_NEWEST = 30;

    /** The value must beat the highest level of the baseline period (its 99th percentile) by this factor. */
    private const PEAK_MARGIN = 1.25;

    /**
     * @param  array<int, string>  $openKeys
     * @return array<string, array{0: AlertType, 1: array<string, mixed>}>
     */
    public function detect(Server $server, array $openKeys = []): array
    {
        return $this->detectJumps($server, $openKeys) + $this->forecastDisks($server, $openKeys);
    }

    /**
     * @param  array<int, string>  $openKeys
     * @return array<string, array{0: AlertType, 1: array<string, mixed>}>
     */
    private function detectJumps(Server $server, array $openKeys): array
    {
        $confirm = max((int) config('watch.baseline.confirm_samples'), ...array_values(self::CONFIRM));
        $samples = $server->metrics()
            ->where('collected_at', '>=', now()->subHours((int) config('watch.baseline.hours')))
            ->latest('collected_at')
            ->limit(2000)
            ->get(['cpu_percent', 'cpu_cores', 'load_1', 'memory_total', 'memory_used', 'net_rx_bps', 'net_tx_bps']);

        if ($samples->count() < (int) config('watch.baseline.min_samples') + $confirm) {
            return [];
        }

        $limits = DashboardSettings::defaults()['thresholds'];
        $series = [
            'cpu' => $samples->map(fn (ServerMetric $m) => (float) $m->cpu_percent),
            'ram' => $samples->map(fn (ServerMetric $m) => $m->memory_total > 0 ? $m->memory_used / $m->memory_total * 100 : 0.0),
            'load' => $samples->map(fn (ServerMetric $m) => (float) $m->load_1 / max(1, (int) $m->cpu_cores)),
            'net_rx' => $samples->map(fn (ServerMetric $m) => (float) ($m->net_rx_bps ?? 0)),
            'net_tx' => $samples->map(fn (ServerMetric $m) => (float) ($m->net_tx_bps ?? 0)),
        ];

        $found = [];

        foreach ($series as $metric => $values) {
            if ($server->ignoresAlert($this->source($metric))) {
                continue;
            }

            $key = 'anomaly:'.$metric;

            // One that was just closed does not come straight back; a lasting problem would have stayed open.
            if (! in_array($key, $openKeys, true) && $this->closedRecently($server, $key)) {
                continue;
            }

            $needed = self::CONFIRM[$metric] ?? (int) config('watch.baseline.confirm_samples');
            $recent = $values->take($needed)->values();
            $normal = $values->slice(max($confirm, self::SKIP_NEWEST))->values();
            [$median, $spread] = $this->normal($normal, self::FLOORS[$metric]);
            $peak = $this->percentile($normal, 0.99);
            $limit = (float) config('watch.baseline.z_limit') * (in_array($key, $openKeys, true) ? 0.5 : 1);
            $jump = self::MIN_JUMP[$metric] * (in_array($key, $openKeys, true) ? 0.5 : 1);

            $isOpen = in_array($key, $openKeys, true);
            $ratio = (self::MIN_RATIO[$metric] ?? 1.0) * ($isOpen ? 0.5 : 1);
            $beyondPeak = $isOpen ? 0.0 : $peak * self::PEAK_MARGIN;

            $unusual = $recent->count() >= $needed && $recent->every(fn (float $value) => ($value - $median) / $spread >= $limit
                && $value - $median >= $jump
                && $value >= $median * $ratio
                && $value >= $beyondPeak);

            // The plain limit of the settings already reports a value that high.
            if (! $unusual || (isset($limits[$metric]) && $recent->first() >= $limits[$metric]['critical'])) {
                continue;
            }

            $found[$key] = [AlertType::Anomaly, [
                'metric' => $metric,
                'value' => round($recent->first(), 2),
                'normal' => round($median, 2),
                'highest_in_baseline' => round($peak, 2),
                'samples_in_a_row' => $needed,
                'z' => round(($recent->first() - $median) / $spread, 1),
            ]];
        }

        return $found;
    }

    /**
     * A disk that is not full yet but grows so fast that it will be, judged from the growth of the last day.
     *
     * @param  array<int, string>  $openKeys
     * @return array<string, array{0: AlertType, 1: array<string, mixed>}>
     */
    private function forecastDisks(Server $server, array $openKeys): array
    {
        if ($server->ignoresAlert('disk')) {
            return [];
        }

        $days = (int) config('watch.baseline.disk_days');
        $rows = ServerMetricDisk::onlyMonitored(
            ServerMetricDisk::query()
                ->join('server_metrics', 'server_metrics.id', '=', 'server_metric_disks.server_metric_id')
                ->where('server_metrics.server_id', $server->id)
                ->where('server_metrics.collected_at', '>=', now()->subHours((int) config('watch.baseline.hours'))),
            'server_metric_disks.mount', 'server_metric_disks.device', 'server_metric_disks.total_bytes',
        )->get(['server_metric_disks.mount', 'server_metric_disks.total_bytes', 'server_metric_disks.used_bytes', 'server_metrics.collected_at']);

        $found = [];

        foreach ($rows->groupBy('mount') as $mount => $points) {
            $forecast = $this->daysUntilFull($points);
            $key = 'forecast:disk:'.$mount;
            $limit = $days * (in_array($key, $openKeys, true) ? 1.5 : 1);

            if ($forecast !== null && $forecast <= $limit) {
                $found[$key] = [AlertType::Anomaly, ['metric' => 'disk_forecast', 'mount' => (string) $mount, 'days' => round($forecast, 1)]];
            }
        }

        return $found;
    }

    /**
     * Days until the disk is full if it keeps growing at the pace of the last day, or null when it does not grow.
     *
     * @param  Collection<int, ServerMetricDisk>  $points
     */
    public function daysUntilFull(Collection $points): ?float
    {
        $points = $points->sortBy('collected_at')->values();

        if ($points->count() < (int) config('watch.baseline.min_samples')) {
            return null;
        }

        $start = strtotime((string) $points->first()->collected_at);
        $xs = $points->map(fn ($p) => (strtotime((string) $p->collected_at) - $start) / 86400);

        // Less than six hours of data is too little to see a trend.
        if ($xs->last() < 0.25) {
            return null;
        }

        $ys = $points->map(fn ($p) => (float) $p->used_bytes);
        $meanX = $xs->avg();
        $meanY = $ys->avg();
        $variance = $xs->sum(fn ($x) => ($x - $meanX) ** 2);

        if ($variance <= 0) {
            return null;
        }

        $slope = $xs->keys()->sum(fn ($i) => ($xs[$i] - $meanX) * ($ys[$i] - $meanY)) / $variance;
        $last = $points->last();
        $free = (float) $last->total_bytes - (float) $last->used_bytes;

        // A trend below 1 % of the disk a day is noise, not a leak.
        if ($slope <= $last->total_bytes * 0.01 || $free <= 0) {
            return $free <= 0 && $slope > 0 ? 0.0 : null;
        }

        return $free / $slope;
    }

    private function closedRecently(Server $server, string $key): bool
    {
        return $server->alerts()->where('key', $key)->where('resolved_at', '>=', now()->subMinutes((int) config('watch.baseline.cooldown_minutes')))->exists();
    }

    /**
     * @param  Collection<int, float>  $values
     */
    private function percentile(Collection $values, float $fraction): float
    {
        $sorted = $values->sort()->values();

        return $sorted->isEmpty() ? 0.0 : (float) $sorted[(int) min($sorted->count() - 1, floor($sorted->count() * $fraction))];
    }

    /**
     * The median and the spread of normal samples.
     *
     * @param  Collection<int, float>  $values
     * @return array{0: float, 1: float}
     */
    private function normal(Collection $values, float $floor): array
    {
        $median = $this->median($values);
        $mad = $this->median($values->map(fn (float $v) => abs($v - $median))) * 1.4826;

        return [$median, max($mad, $floor, abs($median) * 0.05)];
    }

    /**
     * @param  Collection<int, float>  $values
     */
    private function median(Collection $values): float
    {
        $sorted = $values->sort()->values();
        $count = $sorted->count();

        if ($count === 0) {
            return 0.0;
        }

        return $count % 2 === 1 ? $sorted[intdiv($count, 2)] : ($sorted[$count / 2 - 1] + $sorted[$count / 2]) / 2;
    }

    /**
     * The source of warnings (the same names as in the settings of the server) a metric belongs to.
     */
    private function source(string $metric): string
    {
        return match ($metric) {
            'cpu', 'load' => 'cpu',
            'ram' => 'ram',
            default => 'net',
        };
    }
}
