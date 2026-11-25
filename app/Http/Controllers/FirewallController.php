<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\OperatesOverSsh;
use App\Models\Server;
use App\Services\Firewall\FirewallSsh;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The firewall (ufw) and fail2ban of the servers with an SSH login.
 */
class FirewallController extends Controller
{
    use OperatesOverSsh;

    private const IP_OR_NETWORK = '#^(?:\d{1,3}(?:\.\d{1,3}){3}(?:/\d{1,2})?|[0-9a-fA-F:]{2,39}(?:/\d{1,3})?)$#';

    public function index(Request $request): Response
    {
        $team = $request->user()->currentTeam();

        return Inertia::render('firewall/index', [
            'team' => $team?->only('id', 'name'),
            'servers' => $team ? $this->sshServers($team) : [],
            'canManage' => $team !== null && $request->user()->can('permit', [$team, 'firewall.edit']),
            'selected' => $request->integer('server') ?: null,
        ]);
    }

    public function show(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.view');

        return $this->remote(fn () => [...$firewall->overview($server), 'fetched_at' => now()->toIso8601String()]);
    }

    public function storeRule(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        $data = $request->validate([
            'action' => ['required', Rule::in(FirewallSsh::ACTIONS)],
            'direction' => ['required', Rule::in(['in', 'out'])],
            'port' => ['nullable', 'string', 'max:60', 'regex:/^\d{1,5}(?::\d{1,5})?(?:,\d{1,5}(?::\d{1,5})?)*$/', $this->validPorts(...)],
            'protocol' => ['required', Rule::in(['any', 'tcp', 'udp'])],
            'from' => ['nullable', 'string', 'max:43', 'regex:'.self::IP_OR_NETWORK, $this->validNetwork(...)],
            'interface' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_.:-]{1,15}$/'],
            'comment' => ['nullable', 'string', 'max:60', 'regex:/^[\pL\pN _.,:\/()#@+-]*$/u'],
            'first' => ['boolean'],
            'safety' => ['required', 'integer', Rule::in(FirewallSsh::SAFETY_SECONDS)],
            'confirmed' => ['boolean'],
        ]);

        if (empty($data['port']) && empty($data['from'])) {
            return response()->json(['message' => __('Give a port, an address or both. A rule for everything is not allowed here.')], 422);
        }

        $port = $data['port'] ?? null;

        if ($port !== null && (str_contains($port, ',') || str_contains($port, ':')) && $data['protocol'] === 'any') {
            return response()->json(['message' => __('Several ports or a range need TCP or UDP.')], 422);
        }

        return $this->remote(function () use ($request, $server, $firewall, $data, $port) {
            $result = $firewall->addRule($server, [
                'action' => $data['action'],
                'direction' => $data['direction'],
                'port' => $port,
                'protocol' => $data['protocol'],
                'from' => $data['from'] ?? null,
                'interface' => $data['interface'] ?? null,
                'comment' => $data['comment'] ?? null,
                'first' => (bool) ($data['first'] ?? false),
            ], (int) $data['safety'], (bool) ($data['confirmed'] ?? false));

            $this->audit($request, $server, 'firewall-rule-added', Arr::except($data, ['safety', 'confirmed']));

            return $result;
        });
    }

    public function destroyRule(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        $data = $request->validate([
            'spec' => ['required', 'string', 'max:300'],
            'safety' => ['required', 'integer', Rule::in(FirewallSsh::SAFETY_SECONDS)],
            'confirmed' => ['boolean'],
        ]);

        return $this->remote(function () use ($request, $server, $firewall, $data) {
            $result = $firewall->deleteRule($server, $data['spec'], (int) $data['safety'], (bool) ($data['confirmed'] ?? false));

            $this->audit($request, $server, 'firewall-rule-deleted', ['rule' => $data['spec']]);

            return $result;
        });
    }

    public function toggle(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'safety' => ['required', 'integer', Rule::in(FirewallSsh::SAFETY_SECONDS)],
        ]);

        return $this->remote(function () use ($request, $server, $firewall, $data) {
            $result = $firewall->setEnabled($server, (bool) $data['enabled'], (int) $data['safety']);

            $this->audit($request, $server, $data['enabled'] ? 'firewall-enabled' : 'firewall-disabled');

            return $result;
        });
    }

    public function defaults(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        $data = $request->validate([
            'direction' => ['required', Rule::in(['incoming', 'outgoing', 'routed'])],
            'policy' => ['required', Rule::in(FirewallSsh::POLICIES)],
            'safety' => ['required', 'integer', Rule::in(FirewallSsh::SAFETY_SECONDS)],
        ]);

        return $this->remote(function () use ($request, $server, $firewall, $data) {
            $result = $firewall->setDefault($server, $data['direction'], $data['policy'], (int) $data['safety']);

            $this->audit($request, $server, 'firewall-default-changed', ['direction' => $data['direction'], 'policy' => $data['policy']]);

            return $result;
        });
    }

    public function logging(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        $data = $request->validate(['level' => ['required', Rule::in(FirewallSsh::LOGGING)]]);

        return $this->remote(function () use ($request, $server, $firewall, $data) {
            $result = $firewall->setLogging($server, $data['level']);

            $this->audit($request, $server, 'firewall-logging-changed', ['level' => $data['level']]);

            return $result;
        });
    }

    public function reload(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        return $this->remote(fn () => $firewall->reload($server));
    }

    public function confirm(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        return $this->remote(function () use ($request, $server, $firewall) {
            $firewall->confirm($server);

            $this->audit($request, $server, 'firewall-change-confirmed');

            return ['message' => __('The change is kept.')];
        });
    }

    public function rollback(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        return $this->remote(function () use ($request, $server, $firewall) {
            $firewall->rollback($server);

            $this->audit($request, $server, 'firewall-change-rolled-back');

            return ['message' => __('The previous rules are back.')];
        });
    }

    public function fail2ban(Request $request, Server $server, FirewallSsh $firewall): JsonResponse
    {
        $this->authorizeServer($request, $server, 'firewall.edit');

        $data = $request->validate([
            'action' => ['required', Rule::in(['ban', 'unban', 'ignore'])],
            'jail' => [Rule::requiredIf(fn () => $request->input('action') !== 'unban'), 'nullable', 'string', 'regex:/^[A-Za-z0-9_.-]{1,64}$/'],
            'ip' => ['required', 'ip'],
        ]);

        return $this->remote(function () use ($request, $server, $firewall, $data) {
            $message = $firewall->fail2ban($server, $data['action'], $data['jail'] ?? null, $data['ip']);

            $this->audit($request, $server, 'fail2ban-'.$data['action'], ['jail' => $data['jail'] ?? null, 'ip' => $data['ip']]);

            return ['message' => $message];
        });
    }

    private function validPorts(string $attribute, mixed $value, \Closure $fail): void
    {
        foreach (explode(',', (string) $value) as $part) {
            $bounds = array_map('intval', explode(':', $part));

            if (min($bounds) < 1 || max($bounds) > 65535 || (count($bounds) === 2 && $bounds[0] >= $bounds[1])) {
                $fail(__('Ports are numbers from 1 to 65535, a range goes from the lower to the higher one.'));

                return;
            }
        }
    }

    private function validNetwork(string $attribute, mixed $value, \Closure $fail): void
    {
        [$address, $bits] = array_pad(explode('/', (string) $value, 2), 2, null);
        $isV6 = filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false;

        if (filter_var($address, FILTER_VALIDATE_IP) === false || ($bits !== null && (int) $bits > ($isV6 ? 128 : 32))) {
            $fail(__('Enter an IP address or a network such as 10.0.0.0/8.'));
        }
    }
}
