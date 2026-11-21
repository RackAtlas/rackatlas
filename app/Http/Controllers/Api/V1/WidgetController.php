<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ServerStatus;
use App\Models\DatabaseMetric;
use App\Models\RedisMetric;
use App\Models\Server;
use App\Models\ServerAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class WidgetController extends ApiController
{
    /** Open problems listed in the widget. */
    private const ALERT_LIMIT = 3;

    /**
     * A few numbers for the widget on the home screen of the phone: how the servers of the team are doing
     * and the newest open problems. The widget writes the texts itself, in the language of the phone.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $team = $this->team($request);
        $servers = $team->servers()->with(['latestDatabaseMetric', 'latestRedisMetric'])->get();

        $open = ServerAlert::query()
            ->whereIn('server_id', $servers->modelKeys())
            ->whereNull('resolved_at')
            ->with('server:id,name')
            ->latest('opened_at')
            ->get();

        $withProblems = $open->pluck('server_id')->unique();
        $offline = $servers->where('status', ServerStatus::Offline);
        $online = $servers->where('status', ServerStatus::Online);

        return response()->json([
            'team' => $team->name,
            'servers' => [
                'total' => $servers->count(),
                'online' => $online->whereNotIn('id', $withProblems->all())->count(),
                'problems' => $online->whereIn('id', $withProblems->all())->count(),
                'offline' => $offline->count(),
            ],
            'database' => $this->database($servers),
            'redis' => $this->redis($servers),
            'alerts' => [
                'open' => $open->count(),
                'items' => $open->take(self::ALERT_LIMIT)->map(fn (ServerAlert $alert) => [
                    'server' => $alert->server?->name,
                    'type' => $alert->type->value,
                    'opened_at' => $alert->opened_at->toIso8601String(),
                ])->values(),
            ],
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Readings older than this are not shown, the server stopped reporting.
     */
    private const FRESH_MINUTES = 10;

    /**
     * @param  Collection<int, Server>  $servers
     * @return array<string, mixed>
     */
    private function database(Collection $servers): array
    {
        $readings = $servers->pluck('latestDatabaseMetric')->filter(fn (?DatabaseMetric $metric) => $metric?->collected_at->gt(now()->subMinutes(self::FRESH_MINUTES)));

        return [
            'count' => $readings->count(),
            'connections_percent' => $readings->isEmpty() ? null : round($readings->max(fn (DatabaseMetric $metric) => $metric->connectionsPercent())),
            'queries_per_second' => $readings->isEmpty() ? null : round((float) $readings->sum(fn (DatabaseMetric $metric) => (float) $metric->queries_per_second), 1),
            'replica_problems' => $readings->filter(fn (DatabaseMetric $metric) => $metric->replica_io_running === false || $metric->replica_sql_running === false)->count(),
        ];
    }

    /**
     * @param  Collection<int, Server>  $servers
     * @return array<string, mixed>
     */
    private function redis(Collection $servers): array
    {
        $readings = $servers->pluck('latestRedisMetric')->filter(fn (?RedisMetric $metric) => $metric?->collected_at->gt(now()->subMinutes(self::FRESH_MINUTES)));
        $hitRates = $readings->map(fn (RedisMetric $metric) => $metric->hitRatePercent())->filter(fn (?float $rate) => $rate !== null);
        $memory = $readings->map(fn (RedisMetric $metric) => $metric->memoryPercent())->filter(fn (?float $percent) => $percent !== null);

        return [
            'count' => $readings->count(),
            'memory_bytes' => $readings->isEmpty() ? null : (int) $readings->sum('used_memory'),
            'memory_percent' => $memory->isEmpty() ? null : round($memory->max()),
            'commands_per_second' => $readings->isEmpty() ? null : round((float) $readings->sum(fn (RedisMetric $metric) => (float) $metric->commands_per_second)),
            'hit_rate' => $hitRates->isEmpty() ? null : round($hitRates->avg()),
        ];
    }
}
