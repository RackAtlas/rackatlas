<?php

namespace App\Services\Users;

use App\Enums\ServerAuthType;
use App\Exceptions\MetricsCollectionException;
use App\Exceptions\RemoteCommandException;
use App\Models\Server;
use App\Models\SshKey;
use App\Services\Ssh\RemoteResult;
use App\Services\Ssh\RemoteShell;

/**
 * The Linux users and groups of a server, their SSH keys, logins and sessions, and the sshd login settings,
 * over SSH. The user the app logs in with and root are protected from changes that would lock the app out,
 * and the key the app logs in with cannot be removed. Passwords go to the server in a file only the login
 * user can read and are never logged.
 *
 * @phpstan-import-type AuthorizedKey from UsersParser
 */
class UsersSsh
{
    public const NAME_PATTERN = '/^[a-z_][a-z0-9_-]{0,31}$/';

    public const TTY_PATTERN = '/^(?:pts\/\d{1,4}|tty\d{1,3})$/';

    /** The sshd settings that can be changed here, with their allowed values. */
    public const SSHD_SETTINGS = [
        'permitrootlogin' => ['yes', 'prohibit-password', 'no'],
        'passwordauthentication' => ['yes', 'no'],
    ];

    private const SSHD_DROP_IN = '/etc/ssh/sshd_config.d/00-rackatlas.conf';

    public function __construct(
        private readonly RemoteShell $shell,
        private readonly UsersParser $parser,
    ) {}

    /**
     * @return array<string, mixed>
     *
     * @throws MetricsCollectionException
     */
    public function overview(Server $server): array
    {
        $result = $this->shell->run($server, <<<'SH'
            echo "###WHO"; [ "$(id -u)" -eq 0 ] && echo root || { [ -n "$S" ] && echo sudo || echo none; }
            echo "###ME"; id -un
            echo "###PASSWD"; getent passwd
            echo "###GROUP"; getent group
            echo "###SHADOW"; $S awk -F: '{s="set"; if ($2=="") s="empty"; else if ($2 ~ /^[!*]+$/) s="none"; else if ($2 ~ /^!/) s="locked"; print $1":"s":"$3":"$5":"$8}' /etc/shadow 2>/dev/null
            echo "###SHELLS"; grep -v '^#' /etc/shells 2>/dev/null; echo /usr/sbin/nologin
            echo "###SESSIONS"; who -u 2>/dev/null
            echo "###LAST"; $S last -w -F -i -n 300 2>/dev/null
            echo "###FAILED"
            { $S journalctl -t sshd -t sshd-session --since "-7 days" -o short-iso --no-pager 2>/dev/null; $S cat /var/log/auth.log 2>/dev/null; } | grep -E 'Failed [a-z-]+ for|Invalid user' | tail -n 400
            echo "###SSHD"; $S sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|allowusers|allowgroups|denyusers|denygroups|maxauthtries) '
            echo "###DROPIN"; grep -qsE '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d' /etc/ssh/sshd_config && echo yes
            getent passwd | awk -F: '$3==0 || ($3>=1000 && $3<65534) {print $1":"$6}' | while IFS=: read -r U H; do
                echo "###KEYS $U"; $S cat "$H/.ssh/authorized_keys" 2>/dev/null | head -n 300
            done
            echo "###END"
            SH, 45);

        $sections = $result->sections();
        $groups = $this->parser->groups($sections['GROUP'] ?? '');
        $shadow = $this->parser->shadow($sections['SHADOW'] ?? '');
        $logins = $this->parser->logins($sections['LAST'] ?? '');
        $sessions = $this->parser->sessions($sections['SESSIONS'] ?? '');
        $sudoGroup = $this->sudoGroup($groups);
        $appKey = $this->appKeyFingerprint($server);

        $users = array_map(function (array $user) use ($groups, $shadow, $logins, $sessions, $sections, $sudoGroup, $server, $appKey) {
            $memberOf = array_values(array_map(
                fn (array $group) => $group['name'],
                array_filter($groups, fn (array $group) => in_array($user['name'], $group['members'], true)),
            ));
            $primary = collect($groups)->firstWhere('gid', $user['gid'])['name'] ?? (string) $user['gid'];
            $lastLogin = collect($logins)->firstWhere('user', $user['name']);
            $keys = $this->parser->authorizedKeys($sections['KEYS '.$user['name']] ?? '');
            $isLogin = $user['name'] === $server->username;

            return [
                ...$user,
                'system' => $user['uid'] !== 0 && ($user['uid'] < 1000 || $user['uid'] >= 65534),
                'primary_group' => $primary,
                'groups' => $memberOf,
                'sudo' => $user['uid'] === 0 || ($sudoGroup !== null && in_array($sudoGroup, $memberOf, true)),
                'can_login' => ! preg_match('#/(nologin|false)$#', $user['shell']),
                ...($shadow[$user['name']] ?? ['password' => 'none', 'changed_at' => null, 'max_days' => null, 'expires_at' => null]),
                'disabled' => isset($shadow[$user['name']]['expires_at']) && $shadow[$user['name']]['expires_at'] <= now()->toDateString(),
                'last_login' => $lastLogin === null ? null : ['at' => $lastLogin['at'], 'from' => $lastLogin['from']],
                'sessions' => count(array_filter($sessions, fn (array $session) => $session['user'] === $user['name'])),
                'keys' => array_map(fn (array $key) => [
                    ...$key,
                    'app_key' => $isLogin && $appKey !== null && $key['fingerprint'] === $appKey,
                ], $keys),
                'protected' => $isLogin || $user['uid'] === 0,
                'is_login' => $isLogin,
            ];
        }, $this->parser->passwd($sections['PASSWD'] ?? ''));

        usort($users, fn (array $a, array $b) => [$a['system'], $a['uid'] !== 0, $a['name']] <=> [$b['system'], $b['uid'] !== 0, $b['name']]);

        $sshd = $this->parser->sshd($sections['SSHD'] ?? '');

        return [
            'privilege' => trim($sections['WHO'] ?? 'none') ?: 'none',
            'login' => trim($sections['ME'] ?? ''),
            'users' => $users,
            'groups' => array_map(fn (array $group) => [
                ...$group,
                'system' => $group['gid'] < 1000 || $group['gid'] >= 65534,
                'primary_of' => array_column(array_filter($users, fn (array $user) => $user['gid'] === $group['gid']), 'name'),
            ], $groups),
            'sudo_group' => $sudoGroup,
            'shells' => array_values(array_unique(array_filter(array_map('trim', explode("\n", $sections['SHELLS'] ?? ''))))),
            'sessions' => $sessions,
            'logins' => array_slice($logins, 0, 200),
            'failures' => array_slice(array_reverse($this->parser->failures($sections['FAILED'] ?? '')), 0, 300),
            'sshd' => [
                'settings' => $sshd,
                'manageable' => trim($sections['DROPIN'] ?? '') === 'yes',
            ],
            'app' => [
                'username' => $server->username,
                'auth' => $server->auth_type->value,
                'key_fingerprint' => $appKey,
            ],
        ];
    }

    /**
     * Create a user, with a home directory, extra groups, sudo, a password and a first SSH key as asked.
     *
     * @param  array{name: string, gecos: string|null, shell: string, home: bool, groups: list<string>, sudo: bool, password: string|null, key: string|null}  $user
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function create(Server $server, array $user): void
    {
        $this->assertName($user['name']);
        $groups = $user['groups'];

        if ($user['sudo']) {
            $sudo = $this->runChecked($server, 'getent group sudo >/dev/null && echo sudo || { getent group wheel >/dev/null && echo wheel; }');
            $sudoGroup = trim($sudo->output);

            if ($sudoGroup === '') {
                throw new RemoteCommandException(__('There is no sudo or wheel group on this server.'));
            }

            $groups[] = $sudoGroup;
        }

        foreach ($groups as $group) {
            $this->assertName($group);
        }

        $this->runChecked($server, implode("\n", [
            'U='.escapeshellarg($user['name']),
            'SH='.escapeshellarg($user['shell']),
            'GE='.escapeshellarg($this->gecos($user['gecos'])),
            'G='.escapeshellarg(implode(',', array_unique($groups))),
            'getent passwd "$U" >/dev/null && { echo "A user with this name exists already." >&2; exit 9; }',
            '$S useradd '.($user['home'] ? '-m' : '-M').' -s "$SH" -c "$GE" ${G:+-G "$G"} -- "$U"',
        ]));

        if ($user['password']) {
            $this->setPassword($server, $user['name'], $user['password'], false);
        }

        if ($user['key']) {
            $this->addKey($server, $user['name'], $user['key']);
        }
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function delete(Server $server, string $name, bool $removeHome, bool $killProcesses): void
    {
        $this->assertName($name);
        $this->assertNotProtected($server, $name, __('The user the app logs in with and root cannot be deleted.'));
        $info = $this->user($server, $name);

        if ($info['uid'] < 1000) {
            throw new RemoteCommandException(__('System users cannot be deleted here.'));
        }

        $this->runChecked($server, implode("\n", [
            'U='.escapeshellarg($name),
            $killProcesses ? '$S pkill -KILL -u "$U" 2>/dev/null; sleep 1' : ':',
            'OUT=$($S userdel '.($removeHome ? '-r ' : '').'-- "$U" 2>&1); RC=$?',
            'getent passwd "$U" >/dev/null && { echo "The user still exists: $OUT" >&2; exit 8; }',
            '[ "$RC" -eq 0 ] || [ "$RC" -eq 12 ] || { echo "$OUT" >&2; exit "$RC"; }',
        ]), 60);
    }

    /**
     * Switch the whole account off (no password, no key, no login at all) or on again.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function setEnabled(Server $server, string $name, bool $enabled): void
    {
        $this->assertName($name);
        $this->assertNotProtected($server, $name, __('The user the app logs in with and root cannot be switched off here.'));

        $this->runChecked($server, 'U='.escapeshellarg($name)."\n".($enabled
            ? '$S usermod -e "" -- "$U" || exit 1; $S usermod -U -- "$U" 2>/dev/null || true'
            : '$S usermod -L -e 1 -- "$U"'));
    }

    /**
     * Set a new password and/or make the user choose a new one at the next login.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function setPassword(Server $server, string $name, ?string $password, bool $forceChange): void
    {
        $this->assertName($name);

        if ($password !== null) {
            $temp = $this->shell->upload($server, $name.':'.$password."\n");

            $this->runChecked($server, 'T='.escapeshellarg($temp)."\ntrap 'rm -f \"\$T\"' EXIT\n\$S chpasswd < \"\$T\"");
        }

        if ($forceChange) {
            $this->runChecked($server, '$S chage -d 0 -- '.escapeshellarg($name));
        }
    }

    /**
     * Remove the password: the user can then log in only with an SSH key.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function removePassword(Server $server, string $name): void
    {
        $this->assertName($name);

        if ($name === $server->username && $server->auth_type === ServerAuthType::Password) {
            throw new RemoteCommandException(__('The app logs in with the password of this user, so it cannot be removed.'));
        }

        $this->runChecked($server, '$S usermod -p "*" -- '.escapeshellarg($name));
    }

    /**
     * Change the name, the shell, the extra groups and sudo of a user.
     *
     * @param  array{gecos: string|null, shell: string, groups: list<string>, sudo: bool}  $changes
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function update(Server $server, string $name, array $changes): void
    {
        $this->assertName($name);
        $overview = $this->groupsOf($server, $name);
        $groups = array_values(array_diff($changes['groups'], array_filter([$overview['sudo_group']])));

        if ($changes['sudo'] && $overview['sudo_group'] !== null) {
            $groups[] = $overview['sudo_group'];
        }

        if ($name === $server->username && $overview['had_sudo'] && ! $changes['sudo'] && $server->username !== 'root') {
            throw new RemoteCommandException(__('The app needs sudo for this user, so it cannot be taken away here.'));
        }

        if (preg_match('#/(nologin|false)$#', $changes['shell']) === 1) {
            $this->assertNotProtected($server, $name, __('The user the app logs in with and root need a login shell.'));
        }

        foreach ($groups as $group) {
            $this->assertName($group);
        }

        $this->runChecked($server, implode("\n", [
            'U='.escapeshellarg($name),
            '$S usermod -s '.escapeshellarg($changes['shell']).' -c '.escapeshellarg($this->gecos($changes['gecos'])).' -G '.escapeshellarg(implode(',', array_unique($groups))).' -- "$U"',
        ]));
    }

    /**
     * Add a public key to the authorized_keys of a user. The .ssh directory is made with the right owner and modes.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function addKey(Server $server, string $name, string $publicKey): void
    {
        $key = $this->parser->key(str_replace(["\r", "\n"], ' ', $publicKey));

        if ($key === null || $key['fingerprint'] === null) {
            throw new RemoteCommandException(__('This is not a valid public SSH key.'));
        }

        $this->editKeys($server, $name, function (array $lines, array $keys) use ($key) {
            if (collect($keys)->contains('fingerprint', $key['fingerprint'])) {
                throw RemoteCommandException::conflict(__('This key is in the file already.'));
            }

            $lines[] = $key['raw'];

            return $lines;
        });
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function removeKey(Server $server, string $name, string $fingerprint): void
    {
        $appKey = $this->appKeyFingerprint($server);

        if ($name === $server->username && $appKey !== null && hash_equals($appKey, $fingerprint)) {
            throw new RemoteCommandException(__('The app logs in with this key. Remove it only after the server uses another one.'));
        }

        $this->editKeys($server, $name, function (array $lines, array $keys) use ($fingerprint) {
            $lineNumbers = array_column(array_filter($keys, fn (array $key) => $key['fingerprint'] === $fingerprint), 'line');

            if ($lineNumbers === []) {
                throw RemoteCommandException::conflict(__('The key is not there any more. Load the users again.'));
            }

            return array_values(array_diff_key($lines, array_flip($lineNumbers)));
        });
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function createGroup(Server $server, string $group): void
    {
        $this->assertName($group);

        $this->runChecked($server, 'G='.escapeshellarg($group)."\n".'getent group "$G" >/dev/null && { echo "A group with this name exists already." >&2; exit 9; }; $S groupadd -- "$G"');
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function deleteGroup(Server $server, string $group): void
    {
        $this->assertName($group);

        if (in_array($group, ['root', 'sudo', 'wheel', 'adm', 'ssh', 'docker', 'www-data'], true)) {
            throw new RemoteCommandException(__('This group is needed by the system.'));
        }

        $this->runChecked($server, 'G='.escapeshellarg($group)."\n".<<<'SH'
            GID=$(getent group "$G" | cut -d: -f3)
            [ -n "$GID" ] || { echo "The group does not exist." >&2; exit 2; }
            [ "$GID" -ge 1000 ] || { echo "System groups cannot be deleted here." >&2; exit 3; }
            $S groupdel -- "$G"
            SH);
    }

    /**
     * End one login session by its terminal.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function endSession(Server $server, string $tty): void
    {
        if (preg_match(self::TTY_PATTERN, $tty) !== 1) {
            throw new RemoteCommandException(__('Unknown session.'));
        }

        $this->runChecked($server, '$S pkill -KILL -t '.escapeshellarg($tty).' || { echo "No process runs on this terminal." >&2; exit 1; }');
    }

    /**
     * Change one sshd login setting in a drop-in file that comes first, test the config and reload sshd.
     * When the test fails, the previous file is put back and nothing is reloaded.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function setSshd(Server $server, string $setting, string $value): string
    {
        if (! in_array($value, self::SSHD_SETTINGS[$setting] ?? [], true)) {
            throw new RemoteCommandException(__('Unknown setting.'));
        }

        if ($setting === 'passwordauthentication' && $value === 'no' && $server->auth_type === ServerAuthType::Password) {
            throw new RemoteCommandException(__('The app logs in with a password. Switch the server to an SSH key first.'));
        }

        if ($setting === 'permitrootlogin' && $server->username === 'root'
            && ($value === 'no' || ($value === 'prohibit-password' && $server->auth_type === ServerAuthType::Password))) {
            throw new RemoteCommandException(__('The app logs in as root this way. Change the login of the server first.'));
        }

        $current = $this->shell->run($server, 'cat '.escapeshellarg(self::SSHD_DROP_IN).' 2>/dev/null; exit 0')->output;
        $names = ['permitrootlogin' => 'PermitRootLogin', 'passwordauthentication' => 'PasswordAuthentication'];

        $lines = array_values(array_filter(
            preg_split('/\r\n|\n|\r/', $current) ?: [],
            fn (string $line) => trim($line) !== '' && preg_match('/^\s*'.$names[$setting].'\s/i', $line) !== 1,
        ));

        if ($lines === [] || ! str_starts_with($lines[0], '#')) {
            array_unshift($lines, '# Managed by RackAtlas. The first value sshd reads wins, so this file comes first.');
        }

        $lines[] = $names[$setting].' '.$value;
        $file = self::SSHD_DROP_IN;

        $this->runChecked($server, implode("\n", [
            'F='.escapeshellarg($file),
            'grep -qsE \'^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d\' /etc/ssh/sshd_config || { echo "/etc/ssh/sshd_config does not include sshd_config.d, so the setting cannot be changed here." >&2; exit 3; }',
            '$S test -f "$F" && $S cp -p -- "$F" "$F.rackatlas-bak"',
            RemoteShell::writeFile($file, implode("\n", $lines)."\n"),
            'if ! OUT=$($S sshd -t 2>&1); then',
            '  if $S test -f "$F.rackatlas-bak"; then $S mv -f -- "$F.rackatlas-bak" "$F"; else $S rm -f -- "$F"; fi',
            '  echo "sshd rejected the configuration, nothing was changed: $OUT" >&2; exit 4',
            'fi',
            '$S rm -f -- "$F.rackatlas-bak"',
            '$S systemctl reload ssh 2>/dev/null || $S systemctl reload sshd',
        ]), 40);

        $effective = $this->parser->sshd($this->shell->run($server, '$S sshd -T 2>/dev/null | grep -i '.escapeshellarg('^'.$setting.' '))->output)[$setting] ?? null;

        return $effective !== null && $effective !== $value
            ? __('Saved, but sshd still uses :value. Another setting (for example a Match block) wins.', ['value' => $effective])
            : __('sshd uses the new setting.');
    }

    /**
     * Read authorized_keys, let $edit change its lines and write it back with the owner and modes sshd wants.
     * The previous file is kept as authorized_keys.rackatlas-bak.
     *
     * @param  \Closure(list<string>, list<AuthorizedKey>): array<int, string>  $edit
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    private function editKeys(Server $server, string $name, \Closure $edit): void
    {
        $this->assertName($name);
        $info = $this->user($server, $name);
        $file = rtrim($info['home'], '/').'/.ssh/authorized_keys';

        $current = $this->shell->run($server, '$S cat -- '.escapeshellarg($file).' 2>/dev/null; exit 0')->output;
        $lines = preg_split('/\r\n|\n|\r/', rtrim($current, "\n")) ?: [];
        $lines = $current === '' ? [] : $lines;

        $text = implode("\n", array_values($edit($lines, $this->parser->authorizedKeys($current))));
        $temp = $this->shell->upload($server, $text === '' ? '' : $text."\n");

        $this->runChecked($server, implode("\n", [
            'U='.escapeshellarg($name),
            'H='.escapeshellarg(rtrim($info['home'], '/')),
            'G='.escapeshellarg((string) $info['gid']),
            'T='.escapeshellarg($temp),
            <<<'SH'
            trap 'rm -f "$T"' EXIT
            $S test -d "$H" || { echo "The user has no home directory." >&2; exit 2; }
            $S install -d -m 700 -o "$U" -g "$G" -- "$H/.ssh"
            $S test -f "$H/.ssh/authorized_keys" && $S cp -p -- "$H/.ssh/authorized_keys" "$H/.ssh/authorized_keys.rackatlas-bak"
            $S install -m 600 -o "$U" -g "$G" -- "$T" "$H/.ssh/authorized_keys"
            SH,
        ]));
    }

    /**
     * @return array{name: string, uid: int, gid: int, gecos: string, home: string, shell: string}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    private function user(Server $server, string $name): array
    {
        $users = $this->parser->passwd($this->shell->run($server, 'getent passwd -- '.escapeshellarg($name))->output);

        if ($users === []) {
            throw RemoteCommandException::conflict(__('The user does not exist any more. Load the users again.'));
        }

        return $users[0];
    }

    /**
     * @return array{sudo_group: string|null, had_sudo: bool}
     *
     * @throws MetricsCollectionException
     */
    private function groupsOf(Server $server, string $name): array
    {
        $groups = $this->parser->groups($this->shell->run($server, 'getent group')->output);
        $sudoGroup = $this->sudoGroup($groups);

        return [
            'sudo_group' => $sudoGroup,
            'had_sudo' => $sudoGroup !== null && in_array($name, collect($groups)->firstWhere('name', $sudoGroup)['members'] ?? [], true),
        ];
    }

    /**
     * The fingerprint of the key the app logs in with, when it logs in with a key.
     */
    private function appKeyFingerprint(Server $server): ?string
    {
        if ($server->auth_type !== ServerAuthType::Key || $server->ssh_key_id === null) {
            return null;
        }

        return SshKey::query()->whereKey($server->ssh_key_id)->first()?->fingerprint;
    }

    /**
     * @param  list<array{name: string, gid: int, members: list<string>}>  $groups
     */
    private function sudoGroup(array $groups): ?string
    {
        $names = array_column($groups, 'name');

        return in_array('sudo', $names, true) ? 'sudo' : (in_array('wheel', $names, true) ? 'wheel' : null);
    }

    /**
     * @throws RemoteCommandException
     */
    private function assertNotProtected(Server $server, string $name, string $message): void
    {
        if ($name === 'root' || $name === $server->username) {
            throw new RemoteCommandException($message);
        }
    }

    /**
     * @throws RemoteCommandException
     */
    private function assertName(string $name): void
    {
        if (preg_match(self::NAME_PATTERN, $name) !== 1) {
            throw new RemoteCommandException(__('Names are lower case letters, digits, - and _, starting with a letter.'));
        }
    }

    private function gecos(?string $gecos): string
    {
        return trim(str_replace([':', ',', "\n", "\r"], ' ', (string) $gecos));
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    private function runChecked(Server $server, string $script, int $timeout = 30): RemoteResult
    {
        $result = $this->shell->run($server, $script, $timeout);

        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }

        return $result;
    }
}
