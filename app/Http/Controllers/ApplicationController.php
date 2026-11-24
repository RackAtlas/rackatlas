<?php

namespace App\Http\Controllers;

use App\Models\Server;
use App\Models\ServerService;
use App\Services\Ssh\ServiceSsh;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ApplicationController extends Controller
{
    /**
     * The systemd services of the servers with the agent: what runs, what is stopped, switched off or crashed.
     * The list comes from the agent, the buttons act over SSH.
     */
    public function index(Request $request): Response
    {
        $team = $request->user()->currentTeam();

        if ($team === null) {
            return Inertia::render('applications/index', ['team' => null]);
        }

        $servers = $team->servers()
            ->viaAgent()
            ->orderBy('name')
            ->with(['services' => fn ($query) => $query
                ->select(['id', 'server_id', 'unit', 'description', 'active_state', 'sub_state', 'unit_file_state'])
                ->orderBy('unit')])
            ->get(['id', 'name', 'type', 'auth_type', 'status', 'last_seen_at']);

        return Inertia::render('applications/index', [
            'team' => $team->only('id', 'name'),
            'canManage' => $request->user()->can('permit', [$team, 'applications.edit']),
            'servers' => $servers->map(fn (Server $server) => [
                'id' => $server->id,
                'name' => $server->name,
                'status' => $server->status,
                'last_seen_at' => $server->last_seen_at?->toIso8601String(),
                'ssh' => $server->hasSshAccess(),
                'services' => $server->services
                    ->map(fn (ServerService $service) => [
                        'id' => $service->id,
                        'unit' => $service->unit,
                        'description' => $service->description,
                        'status' => $service->status(),
                        'active_state' => $service->active_state,
                        'sub_state' => $service->sub_state,
                        'unit_file_state' => $service->unit_file_state,
                    ])
                    ->sortBy(fn (array $service) => array_search($service['status'], ServerService::STATUSES, true))
                    ->values(),
            ])->values(),
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Start, stop or restart one service, over SSH and at once.
     */
    public function act(Request $request, ServerService $service, string $action, ServiceSsh $ssh): RedirectResponse
    {
        $this->authorizeFor($request, $service, 'applications.edit');

        abort_unless(in_array($action, ServiceSsh::ACTIONS, true), 404);

        $error = $service->server->hasSshAccess()
            ? $ssh->act($service, $action)
            : __('This server has no SSH login, so it cannot be controlled from here.');

        Inertia::flash('toast', $error === null
            ? ['type' => 'success', 'message' => __('Done.')]
            : ['type' => 'error', 'message' => $error]);

        return back();
    }

    /**
     * The output of `systemctl status` for one service.
     */
    public function status(Request $request, ServerService $service, ServiceSsh $ssh): JsonResponse
    {
        return $this->output($request, $service, fn () => $ssh->status($service));
    }

    /**
     * The end of the journal of one service.
     */
    public function journal(Request $request, ServerService $service, ServiceSsh $ssh): JsonResponse
    {
        return $this->output($request, $service, fn () => $ssh->journal($service));
    }

    /**
     * @param  Closure(): string  $read
     */
    private function output(Request $request, ServerService $service, Closure $read): JsonResponse
    {
        $this->authorizeFor($request, $service, 'applications.view');

        if (! $service->server->hasSshAccess()) {
            return response()->json(['message' => __('This server has no SSH login, so it cannot be controlled from here.')], 422);
        }

        try {
            $output = $read();
        } catch (Throwable $e) {
            return response()->json(['message' => mb_substr($e->getMessage(), 0, 300)], 502);
        }

        return response()->json(['output' => $output, 'fetched_at' => now()->toIso8601String()]);
    }

    private function authorizeFor(Request $request, ServerService $service, string $permission): void
    {
        Gate::forUser($request->user())->authorize('permit', [$service->server->team, $permission]);
    }
}
