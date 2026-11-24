<?php

namespace App\Http\Controllers;

use App\Models\DockerContainer;
use App\Models\Server;
use App\Services\Docker\DockerSsh;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class DockerController extends Controller
{
    /**
     * The containers of all servers that have Docker, with their state and use of CPU and memory.
     */
    public function index(Request $request): Response
    {
        $team = $request->user()->currentTeam();

        if ($team === null) {
            return Inertia::render('docker/index', ['team' => null]);
        }

        $servers = $team->servers()
            ->machines()
            ->where('has_docker', true)
            ->orderBy('name')
            ->with(['dockerContainers' => fn ($query) => $query->orderBy('name')])
            ->get();

        return Inertia::render('docker/index', [
            'team' => $team->only('id', 'name'),
            'canManage' => $request->user()->can('permit', [$team, 'docker.edit']),
            'servers' => $servers->map(fn (Server $server) => [
                'id' => $server->id,
                'name' => $server->name,
                'status' => $server->status->value,
                'via_agent' => $server->collectsViaAgent(),
                'ssh' => $server->hasSshAccess(),
                'error' => $server->docker_error,
                'checked_at' => $server->docker_checked_at?->toIso8601String(),
                'containers' => $server->dockerContainers->map(fn (DockerContainer $container) => [
                    'id' => $container->id,
                    'container_id' => $container->container_id,
                    'name' => $container->name,
                    'image' => $container->image,
                    'state' => $container->state,
                    'status' => $container->status,
                    'ports' => $container->ports,
                    'cpu_percent' => $container->cpu_percent,
                    'memory_bytes' => $container->memory_bytes,
                    'memory_limit_bytes' => $container->memory_limit_bytes,
                    'action_result' => $container->action_result,
                ])->values(),
            ])->values(),
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Start, stop or restart one container, over SSH and at once.
     */
    public function act(Request $request, DockerContainer $container, string $action, DockerSsh $docker): RedirectResponse
    {
        $this->authorizeFor($request, $container, 'docker.edit');

        abort_unless(in_array($action, DockerContainer::ACTIONS, true), 404);

        $server = $container->server;

        if (! $server->hasSshAccess()) {
            $error = __('This server has no SSH login, so it cannot be controlled from here.');
        } else {
            $error = $docker->act($container, $action);
            $docker->collect($server);

            $container->forceFill(['action_result' => $error])->save();
        }

        Inertia::flash('toast', $error === null
            ? ['type' => 'success', 'message' => __('Done.')]
            : ['type' => 'error', 'message' => $error]);

        return back();
    }

    /**
     * The end of the log of one container, fetched over SSH now.
     */
    public function logs(Request $request, DockerContainer $container, DockerSsh $docker): JsonResponse
    {
        $this->authorizeFor($request, $container, 'docker.view');

        if (! $container->server->hasSshAccess()) {
            return response()->json(['message' => __('This server has no SSH login, so it cannot be controlled from here.')], 422);
        }

        try {
            $container->forceFill([
                'logs' => $docker->logs($container),
                'logs_updated_at' => now(),
            ])->save();
        } catch (Throwable $e) {
            return response()->json(['message' => mb_substr($e->getMessage(), 0, 300)], 502);
        }

        return response()->json([
            'logs' => $container->logs,
            'updated_at' => $container->logs_updated_at?->toIso8601String(),
        ]);
    }

    private function authorizeFor(Request $request, DockerContainer $container, string $permission): void
    {
        Gate::forUser($request->user())->authorize('permit', [$container->server->team, $permission]);

        abort_unless($container->server->has_docker, 404);
    }
}
