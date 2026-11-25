<?php

namespace App\Services\Firewall;

use App\Exceptions\MetricsCollectionException;
use App\Exceptions\RemoteCommandException;
use App\Models\Server;
use App\Services\Ssh\RemoteResult;
use App\Services\Ssh\RemoteShell;
use Illuminate\Support\Facades\Cache;

/**
 * The firewall of a server, over SSH: ufw rules, default policies and logging, the listening ports and fail2ban.
 *
 * Every change that could lock the app out (switching ufw on, a stricter default, a deny rule, deleting a rule)
 * runs with a safety net: the old configuration is copied aside first and the server puts it back by itself
 * after a few minutes, unless the change is confirmed. The SSH port is always allowed before ufw is switched on.
 *
 * @phpstan-import-type UfwRule from FirewallParser
 *
 * @phpstan-type Pending array{token: string, expires_at: string, summary: string, reachable: bool}
 */
class FirewallSsh
{
    public const ACTIONS = ['allow', 'deny', 'reject', 'limit'];

    public const POLICIES = ['allow', 'deny', 'reject'];

    public const LOGGING = ['off', 'low', 'medium', 'high', 'full'];

    public const SAFETY_SECONDS = [0, 60, 120, 300];

    private const TOKEN_PATTERN = '/^[a-f0-9]{16}$/';

    public function __construct(
        private readonly RemoteShell $shell,
        private readonly FirewallParser $parser,
    ) {}

    /**
     * Everything the page shows, read in one go.
     *
     * @return array<string, mixed>
     *
     * @throws MetricsCollectionException
     */
    public function overview(Server $server): array
    {
        $result = $this->shell->run($server, <<<'SH'
            echo "###WHO"; [ "$(id -u)" -eq 0 ] && echo root || { [ -n "$S" ] && echo sudo || echo none; }
            UFW=""; command -v ufw >/dev/null 2>&1 && UFW=yes
            echo "###UFW"; echo "$UFW"
            if [ -n "$UFW" ]; then
                echo "###STATUS"; $S ufw status verbose 2>&1
                echo "###ADDED"; $S ufw show added 2>&1
                echo "###APPS"; $S ufw app list 2>/dev/null | sed -n 's/^  *//p'
            else
                echo "###FIREWALLD"; command -v firewall-cmd >/dev/null 2>&1 && { $S firewall-cmd --state 2>&1; $S firewall-cmd --list-all 2>&1; }
                echo "###NFT"; command -v nft >/dev/null 2>&1 && $S nft list ruleset 2>/dev/null | head -n 300
                echo "###IPTABLES"; command -v iptables-save >/dev/null 2>&1 && $S iptables-save 2>/dev/null | head -n 300
            fi
            echo "###PORTS"; $S ss -H -tulpn 2>/dev/null
            echo "###F2B"; command -v fail2ban-client >/dev/null 2>&1 && { $S fail2ban-client ping >/dev/null 2>&1 && echo running || echo stopped; }
            for J in $($S fail2ban-client status 2>/dev/null | sed -n 's/.*Jail list:[[:space:]]*//p' | tr ',' ' '); do
                echo "###JAIL $J"; $S fail2ban-client status "$J" 2>&1
            done
            $S find /var/tmp -maxdepth 1 -name 'rackatlas-firewall-*' -mmin +60 -exec rm -rf {} + 2>/dev/null
            echo "###ARMED"; for D in /var/tmp/rackatlas-firewall-*; do [ -f "$D/armed" ] && basename "$D"; done
            echo "###END"
            SH);

        $sections = $result->sections();
        $hasUfw = trim($sections['UFW'] ?? '') === 'yes';
        $status = $this->parser->status($sections['STATUS'] ?? '');
        $rules = $hasUfw ? $this->parser->rules($sections['ADDED'] ?? '') : [];
        $ports = $this->parser->ports($sections['PORTS'] ?? '');

        $jails = [];

        foreach ($sections as $key => $text) {
            if (str_starts_with($key, 'JAIL ')) {
                $name = trim(substr($key, 5));

                if (preg_match('/^[A-Za-z0-9_.-]+$/', $name) === 1) {
                    $jails[] = $this->parser->jail($name, $text);
                }
            }
        }

        $armed = array_values(array_filter(array_map(
            fn (string $name) => substr(trim($name), strlen('rackatlas-firewall-')),
            explode("\n", $sections['ARMED'] ?? ''),
        ), fn (string $token) => preg_match(self::TOKEN_PATTERN, $token) === 1));

        $pending = $this->pending($server);

        if ($pending !== null && ! in_array($pending['token'], $armed, true)) {
            // The server already put the old rules back (or the change was confirmed elsewhere).
            Cache::forget($this->pendingKey($server));
            $pending = null;
        }

        return [
            'privilege' => trim($sections['WHO'] ?? 'none') ?: 'none',
            'backend' => $hasUfw ? 'ufw' : $this->otherBackend($sections),
            'active' => $status['active'],
            'logging' => $status['logging'],
            'defaults' => $status['defaults'],
            'rules' => $rules,
            'apps' => array_values(array_filter(array_map('trim', explode("\n", $sections['APPS'] ?? '')))),
            'ports' => $this->exposure($ports, $rules, $status),
            'ssh_port' => $server->port,
            'ssh_allowed' => $this->sshAllowed($server, $rules),
            'raw' => $hasUfw ? null : (trim(($sections['FIREWALLD'] ?? '')."\n".($sections['NFT'] ?? '')."\n".($sections['IPTABLES'] ?? '')) ?: null),
            'fail2ban' => match (trim($sections['F2B'] ?? '')) {
                'running' => 'running',
                'stopped' => 'stopped',
                default => 'missing',
            },
            'jails' => $jails,
            'pending' => $pending,
        ];
    }

    /**
     * Add one rule. A deny or reject for the SSH port from anywhere needs confirmation.
     *
     * @param  array{action: string, direction: string, port: string|null, protocol: string, from: string|null, interface: string|null, comment: string|null, first: bool}  $rule
     * @return array{message: string, pending: Pending|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function addRule(Server $server, array $rule, int $safetySeconds, bool $confirmed): array
    {
        $state = $this->state($server);
        $from = $rule['from'] ?: 'any';

        $candidate = [
            'action' => $rule['action'], 'direction' => $rule['direction'], 'port' => $rule['port'],
            'protocol' => $rule['protocol'], 'from' => $from, 'app' => null, 'route' => false,
        ];

        if (! $confirmed && $from === 'any' && $this->parser->blocksPort($candidate, $server->port)) {
            throw RemoteCommandException::confirm(__('This rule blocks the SSH port :port. The app and you may lose access to the server.', ['port' => $server->port]));
        }

        $words = ['ufw'];

        if ($rule['first'] && $state['rules'] !== []) {
            array_push($words, 'insert', '1');
        }

        array_push($words, $rule['action'], $rule['direction']);

        if ($rule['interface']) {
            array_push($words, 'on', $rule['interface']);
        }

        array_push($words, 'from', $from, 'to', 'any');

        if ($rule['port']) {
            array_push($words, 'port', $rule['port']);
        }

        if ($rule['protocol'] !== 'any') {
            array_push($words, 'proto', $rule['protocol']);
        }

        if ($rule['comment']) {
            array_push($words, 'comment', $rule['comment']);
        }

        // An allow rule cannot lock anyone out, so it needs no safety net.
        $risky = $rule['action'] !== 'allow' && $state['active'];

        return $this->apply($server, $this->command($words), $risky ? $safetySeconds : 0, __('Rule added.'));
    }

    /**
     * Delete one rule, given as the text ufw lists it with ("allow 22/tcp").
     *
     * @return array{message: string, pending: Pending|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function deleteRule(Server $server, string $spec, int $safetySeconds, bool $confirmed): array
    {
        $state = $this->state($server);
        $rule = null;

        foreach ($state['rules'] as $candidate) {
            if ($candidate['spec'] === trim($spec)) {
                $rule = $candidate;

                break;
            }
        }

        if ($rule === null) {
            throw RemoteCommandException::conflict(__('The rule is not there any more. Load the rules again.'));
        }

        $others = array_values(array_filter($state['rules'], fn (array $other) => $other['spec'] !== $rule['spec']));

        if (! $confirmed
            && $state['active']
            && $state['defaults']['incoming'] !== 'allow'
            && $this->parser->allowsPort($rule, $server->port)
            && ! $this->sshAllowed($server, $others)) {
            throw RemoteCommandException::confirm(__('This is the only rule that allows the SSH port :port. Without it the app and you may lose access to the server.', ['port' => $server->port]));
        }

        $command = $this->command(['ufw', '--force', 'delete', ...$this->words($rule['spec'])]);

        return $this->apply($server, $command, $state['active'] ? $safetySeconds : 0, __('Rule deleted.'));
    }

    /**
     * Switch ufw on (the SSH port is allowed first) or off.
     *
     * @return array{message: string, pending: Pending|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function setEnabled(Server $server, bool $enabled, int $safetySeconds): array
    {
        if (! $enabled) {
            return $this->apply($server, '$S ufw --force disable', 0, __('The firewall is off.'));
        }

        $state = $this->state($server);

        return $this->apply(
            $server,
            $this->keepSsh($server, $state['rules'])."\n".'$S ufw --force enable',
            $safetySeconds,
            __('The firewall is on.'),
        );
    }

    /**
     * The default policy for incoming, outgoing or routed traffic.
     *
     * @return array{message: string, pending: Pending|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function setDefault(Server $server, string $direction, string $policy, int $safetySeconds): array
    {
        $state = $this->state($server);
        $strict = $policy !== 'allow';
        $script = ($strict && $direction === 'incoming' ? $this->keepSsh($server, $state['rules'])."\n" : '')
            .$this->command(['ufw', 'default', $policy, $direction]);

        return $this->apply($server, $script, $strict && $state['active'] ? $safetySeconds : 0, __('Default policy changed.'));
    }

    /**
     * @return array{message: string, pending: Pending|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function setLogging(Server $server, string $level): array
    {
        return $this->apply($server, $this->command(['ufw', 'logging', $level]), 0, __('Logging changed.'));
    }

    /**
     * @return array{message: string, pending: Pending|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function reload(Server $server): array
    {
        return $this->apply($server, '$S ufw reload', 0, __('The rules were loaded again.'));
    }

    /**
     * Keep the change: the server forgets the copy of the old rules and will not put them back.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function confirm(Server $server): void
    {
        $token = $this->pendingToken($server);
        $dir = $this->backupDir($token);

        $this->shell->run($server, sprintf(
            '$S rm -f %1$s/armed; $S systemctl stop %2$s.timer >/dev/null 2>&1; $S rm -rf %1$s',
            escapeshellarg($dir),
            escapeshellarg('rackatlas-firewall-'.$token),
        ));

        Cache::forget($this->pendingKey($server));
    }

    /**
     * Put the old rules back right now.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function rollback(Server $server): void
    {
        $token = $this->pendingToken($server);
        $dir = $this->backupDir($token);

        $result = $this->shell->run($server, sprintf(
            '$S sh %1$s/restore.sh; RC=$?; $S systemctl stop %2$s.timer >/dev/null 2>&1; $S rm -rf %1$s; exit $RC',
            escapeshellarg($dir),
            escapeshellarg('rackatlas-firewall-'.$token),
        ), 60);

        Cache::forget($this->pendingKey($server));

        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }
    }

    /**
     * Ban or unban an address in a fail2ban jail, or unban it everywhere ($jail null), or never ban it ("ignore").
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function fail2ban(Server $server, string $action, ?string $jail, string $ip): string
    {
        $words = match ($action) {
            'ban' => ['fail2ban-client', 'set', (string) $jail, 'banip', $ip],
            'unban' => $jail === null ? ['fail2ban-client', 'unban', $ip] : ['fail2ban-client', 'set', $jail, 'unbanip', $ip],
            'ignore' => ['fail2ban-client', 'set', (string) $jail, 'addignoreip', $ip],
            default => throw new RemoteCommandException('Unknown action.'),
        };

        $result = $this->shell->run($server, $this->command($words));

        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }

        return match ($action) {
            'ban' => __(':ip is banned.', ['ip' => $ip]),
            'unban' => __(':ip is unbanned.', ['ip' => $ip]),
            default => __(':ip will not be banned until fail2ban restarts.', ['ip' => $ip]),
        };
    }

    /**
     * The change that waits for confirmation, if any.
     *
     * @return Pending|null
     */
    public function pending(Server $server): ?array
    {
        $pending = Cache::get($this->pendingKey($server));

        if (! is_array($pending)
            || ! is_string($pending['token'] ?? null)
            || ! is_string($pending['expires_at'] ?? null)
            || ! is_string($pending['summary'] ?? null)
            || ! is_bool($pending['reachable'] ?? null)) {
            return null;
        }

        return [
            'token' => $pending['token'],
            'expires_at' => $pending['expires_at'],
            'summary' => $pending['summary'],
            'reachable' => $pending['reachable'],
        ];
    }

    /**
     * Run the change, behind the safety net when $safetySeconds > 0, and check that a new login still works.
     *
     * @return array{message: string, pending: Pending|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    private function apply(Server $server, string $command, int $safetySeconds, string $done): array
    {
        $token = null;
        $script = $command;

        if ($safetySeconds > 0) {
            if ($this->pending($server) !== null) {
                throw RemoteCommandException::conflict(__('Another change waits for confirmation. Keep it or roll it back first.'));
            }

            $token = substr(bin2hex(random_bytes(8)), 0, 16);
            $script = $this->armScript($token, $safetySeconds)."\n".$command;
        }

        $result = $this->shell->run($server, $script, 60);

        if (! $result->ok()) {
            if ($token !== null) {
                // The change failed: nothing to protect, so do not roll back to the copy later.
                $this->disarm($server, $token);
            }

            throw new RemoteCommandException($this->clean($result));
        }

        if ($token === null) {
            return ['message' => $done, 'pending' => null];
        }

        $pending = [
            'token' => $token,
            'expires_at' => now()->addSeconds($safetySeconds)->toIso8601String(),
            'summary' => $done,
            'reachable' => $this->shell->reachable($server),
        ];

        Cache::put($this->pendingKey($server), $pending, now()->addSeconds($safetySeconds + 60));

        return ['message' => $done, 'pending' => $pending];
    }

    /**
     * Copy /etc/ufw aside, write the script that puts it back and start it with a delay.
     */
    private function armScript(string $token, int $seconds): string
    {
        $dir = $this->backupDir($token);
        $restore = <<<SH
            #!/bin/sh
            D={$dir}
            [ -f "\$D/armed" ] || exit 0
            rm -f "\$D/armed"
            cp -a "\$D/ufw/." /etc/ufw/
            if grep -q '^ENABLED=yes' /etc/ufw/ufw.conf; then ufw --force enable; else ufw --force disable; fi
            echo rolled-back > "\$D/result"
            SH;

        $unit = escapeshellarg('rackatlas-firewall-'.$token);
        $quoted = escapeshellarg($dir);

        return implode("\n", [
            '$S mkdir -p '.$quoted.' && $S chmod 700 '.$quoted.' && $S cp -a /etc/ufw '.$quoted.'/ufw || { echo "The firewall configuration could not be backed up." >&2; exit 70; }',
            RemoteShell::writeFile($dir.'/restore.sh', $restore."\n"),
            '$S touch '.$quoted.'/armed',
            'if command -v systemd-run >/dev/null 2>&1 && $S systemd-run --quiet --unit='.$unit.' --on-active='.$seconds.' /bin/sh '.$quoted.'/restore.sh >/dev/null 2>&1; then :; else',
            '  $S setsid nohup sh -c '.escapeshellarg('sleep '.$seconds.'; sh '.$quoted.'/restore.sh').' >/dev/null 2>&1 </dev/null &',
            'fi',
        ]);
    }

    private function disarm(Server $server, string $token): void
    {
        try {
            $this->shell->run($server, sprintf(
                '$S rm -rf %s; $S systemctl stop %s.timer >/dev/null 2>&1; true',
                escapeshellarg($this->backupDir($token)),
                escapeshellarg('rackatlas-firewall-'.$token),
            ));
        } catch (\Throwable) {
            // The timer finds no "armed" file and does nothing.
        }
    }

    /**
     * Rules, defaults and whether ufw runs: what a change has to look at first.
     *
     * @return array{active: bool, defaults: array{incoming: string|null, outgoing: string|null, routed: string|null}, rules: list<UfwRule>}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    private function state(Server $server): array
    {
        $result = $this->shell->run($server, <<<'SH'
            command -v ufw >/dev/null 2>&1 || { echo "ufw is not installed on this server." >&2; exit 127; }
            [ "$(id -u)" -eq 0 ] || [ -n "$S" ] || { echo "The SSH user needs root or sudo without a password to change the firewall." >&2; exit 77; }
            echo "###STATUS"; $S ufw status verbose 2>&1
            echo "###ADDED"; $S ufw show added 2>&1
            SH);

        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }

        $sections = $result->sections();

        return [
            ...$this->parser->status($sections['STATUS'] ?? ''),
            'rules' => $this->parser->rules($sections['ADDED'] ?? ''),
        ];
    }

    /**
     * The command that allows the SSH port, unless a rule allows it already.
     *
     * @param  list<UfwRule>  $rules
     */
    private function keepSsh(Server $server, array $rules): string
    {
        if ($this->sshAllowed($server, $rules)) {
            return ':';
        }

        return $this->command(['ufw', 'allow', $server->port.'/tcp', 'comment', 'RackAtlas SSH']);
    }

    /**
     * @param  list<UfwRule>  $rules
     */
    private function sshAllowed(Server $server, array $rules): bool
    {
        foreach ($rules as $rule) {
            if ($rule['from'] === 'any' && $this->parser->allowsPort($rule, $server->port)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Mark each listening port: reachable only from the machine, open, or closed by the firewall.
     *
     * @param  list<array{protocol: string, address: string, port: int, process: string|null, public: bool}>  $ports
     * @param  list<UfwRule>  $rules
     * @param  array{active: bool, defaults: array{incoming: string|null}}  $status
     * @return list<array{protocol: string, address: string, port: int, process: string|null, public: bool, state: string}>
     */
    private function exposure(array $ports, array $rules, array $status): array
    {
        return array_map(function (array $port) use ($rules, $status) {
            if (! $port['public']) {
                $state = 'local';
            } elseif (! $status['active']) {
                $state = 'open';
            } else {
                $allowed = collect($rules)->contains(fn (array $rule) => $this->parser->allowsPort($rule, $port['port'], $port['protocol']));
                $blocked = collect($rules)->contains(fn (array $rule) => $rule['from'] === 'any' && $this->parser->blocksPort($rule, $port['port'], $port['protocol']));

                $state = match (true) {
                    $blocked => 'blocked',
                    $allowed => 'allowed',
                    $status['defaults']['incoming'] === 'allow' => 'open',
                    default => 'blocked',
                };
            }

            return [...$port, 'state' => $state];
        }, $ports);
    }

    /**
     * @param  array<string, string>  $sections
     */
    private function otherBackend(array $sections): ?string
    {
        return match (true) {
            trim($sections['FIREWALLD'] ?? '') !== '' => 'firewalld',
            trim($sections['NFT'] ?? '') !== '' => 'nftables',
            trim($sections['IPTABLES'] ?? '') !== '' => 'iptables',
            default => null,
        };
    }

    /**
     * Words of a ufw rule, quoted names of app profiles kept together.
     *
     * @return list<string>
     */
    private function words(string $spec): array
    {
        preg_match_all("/'([^']*)'|(\\S+)/", $spec, $matches, PREG_SET_ORDER);

        return array_map(fn (array $match) => ($match[2] ?? '') !== '' ? $match[2] : ($match[1] ?? ''), $matches);
    }

    /**
     * A command with every word quoted for the shell, run as root.
     *
     * @param  list<string>  $words
     */
    private function command(array $words): string
    {
        return '$S '.implode(' ', array_map('escapeshellarg', $words));
    }

    private function clean(RemoteResult $result): string
    {
        $message = trim(implode("\n", array_filter(
            preg_split('/\r\n|\n|\r/', $result->message()) ?: [],
            fn (string $line) => ! str_contains($line, 'WARN: ') && trim($line) !== '',
        )));

        return $message !== '' ? $message : $result->message();
    }

    /**
     * @throws RemoteCommandException
     */
    private function pendingToken(Server $server): string
    {
        $token = $this->pending($server)['token'] ?? null;

        if (! is_string($token) || preg_match(self::TOKEN_PATTERN, $token) !== 1) {
            throw RemoteCommandException::conflict(__('No change waits for confirmation.'));
        }

        return $token;
    }

    private function backupDir(string $token): string
    {
        return '/var/tmp/rackatlas-firewall-'.$token;
    }

    private function pendingKey(Server $server): string
    {
        return 'firewall-pending:'.$server->id;
    }
}
