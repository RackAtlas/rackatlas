<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\OperatesOverSsh;
use App\Models\Server;
use App\Services\Updates\UpdatesSsh;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Package updates of the servers with an SSH login.
 */
class UpdateController extends Controller
{
    use OperatesOverSsh;

    public function index(Request $request): Response
    {
        $team = $request->user()->currentTeam();

        return Inertia::render('updates/index', [
            'team' => $team?->only('id', 'name'),
            'servers' => $team ? $this->sshServers($team) : [],
            'canManage' => $team !== null && $request->user()->can('permit', [$team, 'updates.edit']),
            'selected' => $request->integer('server') ?: null,
        ]);
    }

    public function show(Request $request, Server $server, UpdatesSsh $updates): JsonResponse
    {
        $this->authorizeServer($request, $server, 'updates.view');

        return $this->remote(fn () => [...$updates->overview($server), 'fetched_at' => now()->toIso8601String()]);
    }

    public function start(Request $request, Server $server, UpdatesSsh $updates): JsonResponse
    {
        $this->authorizeServer($request, $server, 'updates.edit');

        $data = $request->validate([
            'job' => ['required', Rule::in(UpdatesSsh::JOBS)],
            'packages' => ['array', 'max:500', Rule::requiredIf(fn () => $request->input('job') === 'packages')],
            'packages.*' => ['string', 'regex:'.UpdatesSsh::PACKAGE_PATTERN],
        ]);

        return $this->remote(function () use ($request, $server, $updates, $data) {
            $updates->start($server, $data['job'], array_values($data['packages'] ?? []));

            $this->audit($request, $server, 'updates-'.$data['job'], ['packages' => $data['packages'] ?? []]);

            return ['message' => __('Started. The log follows below.')];
        });
    }

    public function job(Request $request, Server $server, UpdatesSsh $updates): JsonResponse
    {
        $this->authorizeServer($request, $server, 'updates.view');

        return $this->remote(fn () => $updates->job($server));
    }

    public function hold(Request $request, Server $server, UpdatesSsh $updates): JsonResponse
    {
        $this->authorizeServer($request, $server, 'updates.edit');

        $data = $request->validate([
            'packages' => ['required', 'array', 'min:1', 'max:100'],
            'packages.*' => ['string', 'regex:'.UpdatesSsh::PACKAGE_PATTERN],
            'hold' => ['required', 'boolean'],
        ]);

        return $this->remote(function () use ($request, $server, $updates, $data) {
            $updates->hold($server, array_values($data['packages']), (bool) $data['hold']);

            $this->audit($request, $server, $data['hold'] ? 'packages-held' : 'packages-unheld', ['packages' => $data['packages']]);

            return ['message' => $data['hold'] ? __('The packages stay at their version.') : __('The packages can be upgraded again.')];
        });
    }

    public function reboot(Request $request, Server $server, UpdatesSsh $updates): JsonResponse
    {
        $this->authorizeServer($request, $server, 'updates.edit');

        $data = $request->validate([
            'cancel' => ['boolean'],
            'minutes' => ['required_unless:cancel,true', 'nullable', 'integer', 'min:1', 'max:60'],
        ]);

        $cancel = (bool) ($data['cancel'] ?? false);

        return $this->remote(function () use ($request, $server, $updates, $data, $cancel) {
            $updates->reboot($server, $cancel ? null : (int) $data['minutes']);

            $this->audit($request, $server, $cancel ? 'reboot-cancelled' : 'reboot-scheduled', ['minutes' => $data['minutes'] ?? null]);

            return ['message' => $cancel
                ? __('The restart was cancelled.')
                : __('The server restarts in :minutes min.', ['minutes' => $data['minutes']])];
        });
    }
}
