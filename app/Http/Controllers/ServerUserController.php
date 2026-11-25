<?php

namespace App\Http\Controllers;

use App\Exceptions\RemoteCommandException;
use App\Http\Controllers\Concerns\OperatesOverSsh;
use App\Models\Server;
use App\Models\SshKey;
use App\Services\Users\UsersSsh;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Linux users, groups, SSH keys, logins and the sshd login settings of the servers with an SSH login.
 */
class ServerUserController extends Controller
{
    use OperatesOverSsh;

    private const NAME = ['required', 'string', 'regex:'.UsersSsh::NAME_PATTERN];

    public function index(Request $request): Response
    {
        $team = $request->user()->currentTeam();

        return Inertia::render('server-users/index', [
            'team' => $team?->only('id', 'name'),
            'servers' => $team ? $this->sshServers($team) : [],
            'canManage' => $team !== null && $request->user()->can('permit', [$team, 'server_users.edit']),
            'selected' => $request->integer('server') ?: null,
            'teamKeys' => $team
                ? SshKey::query()->whereBelongsTo($team)->orderBy('name')->get(['id', 'name', 'algorithm', 'fingerprint'])
                    ->map(fn (SshKey $key) => $key->only('id', 'name', 'algorithm', 'fingerprint'))->values()
                : [],
        ]);
    }

    public function show(Request $request, Server $server, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.view');

        return $this->remote(fn () => [...$users->overview($server), 'fetched_at' => now()->toIso8601String()]);
    }

    public function store(Request $request, Server $server, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');

        $data = $request->validate([
            'name' => self::NAME,
            'gecos' => ['nullable', 'string', 'max:100'],
            'shell' => ['required', 'string', 'regex:#^/[A-Za-z0-9/_.-]+$#'],
            'home' => ['boolean'],
            'groups' => ['array', 'max:50'],
            'groups.*' => self::NAME,
            'sudo' => ['boolean'],
            'password' => ['nullable', 'string', 'min:8', 'max:200', 'not_regex:/[\r\n]/'],
            'key' => ['nullable', 'string', 'max:16000'],
            'team_key_id' => ['nullable', 'integer'],
        ]);

        return $this->remote(function () use ($request, $server, $users, $data) {
            $users->create($server, [
                'name' => $data['name'],
                'gecos' => $data['gecos'] ?? null,
                'shell' => $data['shell'],
                'home' => (bool) ($data['home'] ?? true),
                'groups' => array_values($data['groups'] ?? []),
                'sudo' => (bool) ($data['sudo'] ?? false),
                'password' => $data['password'] ?? null,
                'key' => $this->publicKey($server, $data),
            ]);

            $this->audit($request, $server, 'server-user-created', [
                'user' => $data['name'],
                'sudo' => (bool) ($data['sudo'] ?? false),
                'groups' => $data['groups'] ?? [],
                'with_password' => ! empty($data['password']),
            ]);

            return ['message' => __('User :name created.', ['name' => $data['name']])];
        });
    }

    public function update(Request $request, Server $server, string $user, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');
        $this->validateName($user);

        $data = $request->validate([
            'gecos' => ['nullable', 'string', 'max:100'],
            'shell' => ['required', 'string', 'regex:#^/[A-Za-z0-9/_.-]+$#'],
            'groups' => ['array', 'max:50'],
            'groups.*' => self::NAME,
            'sudo' => ['boolean'],
        ]);

        return $this->remote(function () use ($request, $server, $users, $user, $data) {
            $users->update($server, $user, [
                'gecos' => $data['gecos'] ?? null,
                'shell' => $data['shell'],
                'groups' => array_values($data['groups'] ?? []),
                'sudo' => (bool) ($data['sudo'] ?? false),
            ]);

            $this->audit($request, $server, 'server-user-changed', ['user' => $user, ...$data]);

            return ['message' => __('Saved.')];
        });
    }

    public function destroy(Request $request, Server $server, string $user, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');
        $this->validateName($user);

        $data = $request->validate(['remove_home' => ['boolean'], 'kill_processes' => ['boolean']]);

        return $this->remote(function () use ($request, $server, $users, $user, $data) {
            $users->delete($server, $user, (bool) ($data['remove_home'] ?? false), (bool) ($data['kill_processes'] ?? false));

            $this->audit($request, $server, 'server-user-deleted', ['user' => $user, 'remove_home' => (bool) ($data['remove_home'] ?? false)]);

            return ['message' => __('User :name deleted.', ['name' => $user])];
        });
    }

    public function enabled(Request $request, Server $server, string $user, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');
        $this->validateName($user);

        $data = $request->validate(['enabled' => ['required', 'boolean']]);

        return $this->remote(function () use ($request, $server, $users, $user, $data) {
            $users->setEnabled($server, $user, (bool) $data['enabled']);

            $this->audit($request, $server, $data['enabled'] ? 'server-user-enabled' : 'server-user-disabled', ['user' => $user]);

            return ['message' => $data['enabled'] ? __('The account is on again.') : __('The account is off: no login is possible.')];
        });
    }

    public function password(Request $request, Server $server, string $user, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');
        $this->validateName($user);

        $data = $request->validate([
            'password' => ['nullable', 'string', 'min:8', 'max:200', 'not_regex:/[\r\n]/', 'confirmed'],
            'force_change' => ['boolean'],
            'remove' => ['boolean'],
        ]);

        return $this->remote(function () use ($request, $server, $users, $user, $data) {
            if ($data['remove'] ?? false) {
                $users->removePassword($server, $user);
                $this->audit($request, $server, 'server-user-password-removed', ['user' => $user]);

                return ['message' => __('The password was removed. The user can log in only with a key.')];
            }

            if (empty($data['password']) && ! ($data['force_change'] ?? false)) {
                throw new RemoteCommandException(__('Enter a new password.'));
            }

            $users->setPassword($server, $user, $data['password'] ?? null, (bool) ($data['force_change'] ?? false));
            $this->audit($request, $server, 'server-user-password-changed', ['user' => $user, 'force_change' => (bool) ($data['force_change'] ?? false)]);

            return ['message' => __('Password changed.')];
        });
    }

    public function storeKey(Request $request, Server $server, string $user, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');
        $this->validateName($user);

        $data = $request->validate([
            'key' => ['nullable', 'required_without:team_key_id', 'string', 'max:16000'],
            'team_key_id' => ['nullable', 'integer'],
        ]);

        return $this->remote(function () use ($request, $server, $users, $user, $data) {
            $users->addKey($server, $user, (string) $this->publicKey($server, $data));

            $this->audit($request, $server, 'server-user-key-added', ['user' => $user]);

            return ['message' => __('Key added.')];
        });
    }

    public function destroyKey(Request $request, Server $server, string $user, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');
        $this->validateName($user);

        $data = $request->validate(['fingerprint' => ['required', 'string', 'regex:/^SHA256:[A-Za-z0-9+\/]{43}$/']]);

        return $this->remote(function () use ($request, $server, $users, $user, $data) {
            $users->removeKey($server, $user, $data['fingerprint']);

            $this->audit($request, $server, 'server-user-key-removed', ['user' => $user, 'fingerprint' => $data['fingerprint']]);

            return ['message' => __('Key removed.')];
        });
    }

    public function storeGroup(Request $request, Server $server, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');

        $data = $request->validate(['name' => self::NAME]);

        return $this->remote(function () use ($request, $server, $users, $data) {
            $users->createGroup($server, $data['name']);
            $this->audit($request, $server, 'server-group-created', ['group' => $data['name']]);

            return ['message' => __('Group :name created.', ['name' => $data['name']])];
        });
    }

    public function destroyGroup(Request $request, Server $server, string $group, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');
        $this->validateName($group);

        return $this->remote(function () use ($request, $server, $users, $group) {
            $users->deleteGroup($server, $group);
            $this->audit($request, $server, 'server-group-deleted', ['group' => $group]);

            return ['message' => __('Group :name deleted.', ['name' => $group])];
        });
    }

    public function endSession(Request $request, Server $server, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');

        $data = $request->validate(['tty' => ['required', 'string', 'regex:'.UsersSsh::TTY_PATTERN]]);

        return $this->remote(function () use ($request, $server, $users, $data) {
            $users->endSession($server, $data['tty']);
            $this->audit($request, $server, 'server-session-ended', ['tty' => $data['tty']]);

            return ['message' => __('The session was ended.')];
        });
    }

    public function sshd(Request $request, Server $server, UsersSsh $users): JsonResponse
    {
        $this->authorizeServer($request, $server, 'server_users.edit');

        $data = $request->validate([
            'setting' => ['required', Rule::in(array_keys(UsersSsh::SSHD_SETTINGS))],
            'value' => ['required', 'string', 'max:30'],
        ]);

        return $this->remote(function () use ($request, $server, $users, $data) {
            $message = $users->setSshd($server, $data['setting'], $data['value']);
            $this->audit($request, $server, 'sshd-setting-changed', $data);

            return ['message' => $message];
        });
    }

    /**
     * A pasted public key, or the public half of one of the team's keys.
     *
     * @param  array<string, mixed>  $data
     */
    private function publicKey(Server $server, array $data): ?string
    {
        if (! empty($data['team_key_id'])) {
            $key = SshKey::query()->where('team_id', $server->team_id)->whereKey((int) $data['team_key_id'])->first();

            abort_if($key === null, 422, __('Unknown key.'));

            return $key->public_key;
        }

        return empty($data['key']) ? null : (string) $data['key'];
    }

    private function validateName(string $name): void
    {
        abort_unless(preg_match(UsersSsh::NAME_PATTERN, $name) === 1, 404);
    }
}
