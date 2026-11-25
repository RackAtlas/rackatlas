<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\OperatesOverSsh;
use App\Models\Server;
use App\Services\Scheduler\CronSsh;
use App\Services\Scheduler\CrontabParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Cron jobs and systemd timers of the servers with an SSH login.
 */
class CronController extends Controller
{
    use OperatesOverSsh;

    public function index(Request $request): Response
    {
        $team = $request->user()->currentTeam();

        return Inertia::render('cron/index', [
            'team' => $team?->only('id', 'name'),
            'servers' => $team ? $this->sshServers($team) : [],
            'canManage' => $team !== null && $request->user()->can('permit', [$team, 'cron.edit']),
            'selected' => $request->integer('server') ?: null,
        ]);
    }

    public function show(Request $request, Server $server, CronSsh $cron): JsonResponse
    {
        $this->authorizeServer($request, $server, 'cron.view');

        return $this->remote(fn () => [...$cron->overview($server), 'fetched_at' => now()->toIso8601String()]);
    }

    /**
     * The next runs of a schedule, for the form while it is typed.
     */
    public function preview(Request $request, CrontabParser $parser): JsonResponse
    {
        $data = $request->validate([
            'schedule' => ['required', 'string', 'max:100'],
            'timezone' => ['nullable', 'string', 'max:64'],
        ]);

        $valid = $parser->isValidSchedule($data['schedule']);

        return response()->json([
            'valid' => $valid,
            'next' => $valid ? $parser->nextRuns(trim($data['schedule']), $data['timezone'] ?? null, 5) : [],
        ]);
    }

    public function store(Request $request, Server $server, CronSsh $cron, CrontabParser $parser): JsonResponse
    {
        $this->authorizeServer($request, $server, 'cron.edit');

        $data = $this->validateJob($request, $parser) + $request->validate(['enabled' => ['boolean']]);

        return $this->remote(function () use ($request, $server, $cron, $data) {
            $cron->add($server, $data['user'], trim($data['schedule']), $data['command'], $data['label'] ?? null, (bool) ($data['enabled'] ?? true));

            $this->audit($request, $server, 'cron-job-added', Arr::only($data, ['user', 'schedule', 'command', 'label']));

            return ['message' => __('Job added.')];
        });
    }

    public function update(Request $request, Server $server, CronSsh $cron, CrontabParser $parser): JsonResponse
    {
        $this->authorizeServer($request, $server, 'cron.edit');

        $data = $this->validateJob($request, $parser) + $this->validateLine($request);

        return $this->remote(function () use ($request, $server, $cron, $data) {
            $cron->update($server, $data['user'], (int) $data['line'], $data['hash'], trim($data['schedule']), $data['command'], $data['label'] ?? null);

            $this->audit($request, $server, 'cron-job-changed', Arr::only($data, ['user', 'schedule', 'command', 'label']));

            return ['message' => __('Job saved.')];
        });
    }

    public function toggle(Request $request, Server $server, CronSsh $cron): JsonResponse
    {
        $this->authorizeServer($request, $server, 'cron.edit');

        $data = $this->validateLine($request) + $request->validate([
            'user' => ['required', 'string', 'regex:'.CronSsh::USER_PATTERN],
            'enabled' => ['required', 'boolean'],
        ]);

        return $this->remote(function () use ($request, $server, $cron, $data) {
            $cron->toggle($server, $data['user'], (int) $data['line'], $data['hash'], (bool) $data['enabled']);

            $this->audit($request, $server, $data['enabled'] ? 'cron-job-enabled' : 'cron-job-disabled', ['user' => $data['user'], 'line' => $data['line']]);

            return ['message' => $data['enabled'] ? __('The job is on.') : __('The job is off.')];
        });
    }

    public function destroy(Request $request, Server $server, CronSsh $cron): JsonResponse
    {
        $this->authorizeServer($request, $server, 'cron.edit');

        $data = $this->validateLine($request) + $request->validate([
            'user' => ['required', 'string', 'regex:'.CronSsh::USER_PATTERN],
            'command' => ['nullable', 'string', 'max:1000'],
        ]);

        return $this->remote(function () use ($request, $server, $cron, $data) {
            $cron->delete($server, $data['user'], (int) $data['line'], $data['hash']);

            $this->audit($request, $server, 'cron-job-deleted', ['user' => $data['user'], 'command' => $data['command'] ?? null]);

            return ['message' => __('Job deleted.')];
        });
    }

    public function run(Request $request, Server $server, CronSsh $cron): JsonResponse
    {
        $this->authorizeServer($request, $server, 'cron.edit');

        $data = $request->validate([
            'user' => ['required', 'string', 'regex:'.CronSsh::USER_PATTERN],
            'command' => ['required', 'string', 'max:1000', 'not_regex:/[\r\n]/'],
        ]);

        return $this->remote(function () use ($request, $server, $cron, $data) {
            $result = $cron->run($server, $data['user'], $data['command']);

            $this->audit($request, $server, 'cron-job-run', ['user' => $data['user'], 'command' => $data['command'], 'exit' => $result['exit']]);

            return $result;
        });
    }

    public function timer(Request $request, Server $server, string $action, CronSsh $cron): JsonResponse
    {
        $this->authorizeServer($request, $server, 'cron.edit');

        abort_unless(in_array($action, CronSsh::TIMER_ACTIONS, true), 404);

        $data = $request->validate(['timer' => ['required', 'string', 'max:200', 'regex:'.CronSsh::TIMER_PATTERN]]);

        return $this->remote(function () use ($request, $server, $cron, $data, $action) {
            $cron->timerAction($server, $data['timer'], $action);

            $this->audit($request, $server, 'timer-'.$action, ['timer' => $data['timer']]);

            return ['message' => $action === 'run' ? __('The service was started.') : __('Done.')];
        });
    }

    public function journal(Request $request, Server $server, CronSsh $cron): JsonResponse
    {
        $this->authorizeServer($request, $server, 'cron.view');

        $data = $request->validate(['timer' => ['required', 'string', 'max:200', 'regex:'.CronSsh::TIMER_PATTERN]]);

        return $this->remote(fn () => ['output' => $cron->timerJournal($server, $data['timer']), 'fetched_at' => now()->toIso8601String()]);
    }

    /**
     * @return array{user: string, schedule: string, command: string, label?: string|null}
     */
    private function validateJob(Request $request, CrontabParser $parser): array
    {
        return $request->validate([
            'user' => ['required', 'string', 'regex:'.CronSsh::USER_PATTERN],
            'schedule' => ['required', 'string', 'max:100', function (string $attribute, mixed $value, \Closure $fail) use ($parser) {
                if (! $parser->isValidSchedule((string) $value)) {
                    $fail(__('This is not a valid cron schedule.'));
                }
            }],
            'command' => ['required', 'string', 'max:1000', 'not_regex:/[\r\n]/'],
            'label' => ['nullable', 'string', 'max:120', 'not_regex:/[\r\n]/'],
        ]);
    }

    /**
     * @return array{line: int, hash: string}
     */
    private function validateLine(Request $request): array
    {
        return $request->validate([
            'line' => ['required', 'integer', 'min:0', 'max:10000'],
            'hash' => ['required', 'string', 'regex:/^[a-f0-9]{16}$/'],
        ]);
    }
}
