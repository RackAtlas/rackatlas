<?php

namespace App\Http\Controllers\Concerns;

use App\Exceptions\RemoteCommandException;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Throwable;

/**
 * The shared part of the pages that work on a server over SSH (firewall, files, cron, updates):
 * who may, which servers, and how a failure on the server becomes a JSON answer.
 */
trait OperatesOverSsh
{
    /**
     * The servers of the team that the app can log into over SSH.
     *
     * @return list<array{id: int, name: string, status: string, username: string}>
     */
    protected function sshServers(Team $team): array
    {
        $servers = Server::query()
            ->whereBelongsTo($team)
            ->machines()
            ->where('auth_type', '!=', 'agent')
            ->orderBy('name')
            ->get(['id', 'team_id', 'name', 'type', 'auth_type', 'status', 'username'])
            ->filter(fn (Server $server) => $server->hasSshAccess())
            ->map(fn (Server $server) => [
                'id' => $server->id,
                'name' => $server->name,
                'status' => $server->status->value,
                'username' => $server->username,
            ]);

        return array_values($servers->all());
    }

    /**
     * The member needs the permission in the team of the server, and the server an SSH login.
     */
    protected function authorizeServer(Request $request, Server $server, string $permission): void
    {
        Gate::forUser($request->user())->authorize('permit', [$server->team, $permission]);

        abort_unless($server->hasSshAccess(), 422, __('This server has no SSH login, so it cannot be controlled from here.'));
    }

    /**
     * Run the work and answer with its result as JSON. A refused change keeps its own status (409 asks
     * for confirmation), a server that cannot be reached answers 502.
     *
     * @param  Closure(): array<string, mixed>  $work
     */
    protected function remote(Closure $work): JsonResponse
    {
        try {
            return response()->json($work());
        } catch (RemoteCommandException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'confirm' => $e->needsConfirmation,
            ], $e->status);
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => mb_substr($e->getMessage(), 0, 500)], 502);
        }
    }

    /**
     * Write what was done on the server to the activity log of the server.
     *
     * @param  array<string, mixed>  $properties
     */
    protected function audit(Request $request, Server $server, string $event, array $properties = []): void
    {
        /** @var User $user */
        $user = $request->user();

        activity('server')
            ->event($event)
            ->causedBy($user)
            ->performedOn($server)
            ->withProperties(['name' => $server->name, ...$properties])
            ->log($event);
    }
}
