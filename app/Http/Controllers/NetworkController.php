<?php

namespace App\Http\Controllers;

use App\Models\Server;
use App\Services\Metrics\MetricsReport;
use App\Services\Network\NetworkReport;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NetworkController extends Controller
{
    /**
     * The network of one server of the current team: traffic per interface, TCP health,
     * connections and listening ports. Only servers with the agent send this detail.
     */
    public function index(Request $request): Response
    {
        $team = $request->user()->currentTeam();

        if ($team === null) {
            return Inertia::render('network', ['team' => null]);
        }

        $validated = $request->validate([
            'server' => ['nullable', 'integer'],
            'range' => ['nullable', 'in:'.implode(',', array_keys(MetricsReport::RANGES))],
        ]);

        $servers = $team->machines()->orderBy('name')->get(['id', 'name', 'status', 'agent_version', 'last_seen_at']);
        $range = $validated['range'] ?? '24h';

        /** @var Server|null $server */
        $server = $servers->firstWhere('id', (int) ($validated['server'] ?? 0)) ?? $servers->first(fn (Server $s) => $s->agent_version !== null) ?? $servers->first();

        return Inertia::render('network', [
            'team' => $team->only('id', 'name'),
            'servers' => $servers->map(fn (Server $s) => ['id' => $s->id, 'name' => $s->name])->values(),
            'server' => $server ? [
                'id' => $server->id,
                'name' => $server->name,
                'status' => $server->status->value,
                'agent_version' => $server->agent_version,
                'last_seen_at' => $server->last_seen_at?->toIso8601String(),
            ] : null,
            'range' => $range,
            'ranges' => array_keys(MetricsReport::RANGES),
            'report' => $server ? (new NetworkReport($server, $range))->build() : null,
        ]);
    }
}
