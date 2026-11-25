<?php

namespace App\Services\Firewall;

/**
 * Turns what ufw, ss and fail2ban print into arrays the page can show.
 *
 * @phpstan-type UfwRule array{spec: string, action: string, direction: string, port: string|null, protocol: string, from: string, to: string, interface: string|null, app: string|null, comment: string|null, route: bool}
 */
class FirewallParser
{
    /**
     * `ufw status verbose`: whether it runs, the default policies and the logging level.
     *
     * @return array{active: bool, logging: string|null, defaults: array{incoming: string|null, outgoing: string|null, routed: string|null}}
     */
    public function status(string $text): array
    {
        $defaults = ['incoming' => null, 'outgoing' => null, 'routed' => null];

        if (preg_match('/^Default:\s*(.+)$/m', $text, $match) === 1) {
            foreach (explode(',', $match[1]) as $part) {
                if (preg_match('/(\w+)\s*\((incoming|outgoing|routed)\)/', trim($part), $policy) === 1) {
                    $defaults[$policy[2]] = strtolower($policy[1]);
                }
            }
        }

        $logging = null;

        if (preg_match('/^Logging:\s*(\w+)(?:\s*\((\w+)\))?/m', $text, $match) === 1) {
            $logging = strtolower($match[1]) === 'off' ? 'off' : strtolower($match[2] ?? 'low');
        }

        return [
            'active' => preg_match('/^Status:\s*active/m', $text) === 1,
            'logging' => $logging,
            'defaults' => $defaults,
        ];
    }

    /**
     * `ufw show added`: the rules as the commands that made them. They are listed even while ufw is off,
     * and one rule covers IPv4 and IPv6 alike.
     *
     * @return list<UfwRule>
     */
    public function rules(string $text): array
    {
        $rules = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            $line = trim($line);

            if (! str_starts_with($line, 'ufw ')) {
                continue;
            }

            $rule = $this->rule(substr($line, 4));

            if ($rule !== null) {
                $rules[] = $rule;
            }
        }

        return $rules;
    }

    /**
     * One rule in the syntax of ufw, as "allow 22/tcp" or "deny from 1.2.3.4 to any port 3306 proto tcp comment 'x'".
     *
     * @return UfwRule|null
     */
    public function rule(string $spec): ?array
    {
        $comment = null;
        $body = $spec;

        if (preg_match("/\\s+comment\\s+'((?:[^'\\\\]|\\\\.)*)'\\s*$/", $spec, $match, PREG_OFFSET_CAPTURE) === 1) {
            $comment = stripslashes($match[1][0]);
            $body = substr($spec, 0, $match[0][1]);
        }

        $words = preg_split('/\s+/', trim($body)) ?: [];
        $route = false;

        if (($words[0] ?? null) === 'route') {
            $route = true;
            array_shift($words);
        }

        $action = array_shift($words);

        if (! in_array($action, ['allow', 'deny', 'reject', 'limit'], true)) {
            return null;
        }

        $rule = [
            'spec' => trim($body),
            'action' => $action,
            'direction' => 'in',
            'port' => null,
            'protocol' => 'any',
            'from' => 'any',
            'to' => 'any',
            'interface' => null,
            'app' => null,
            'comment' => $comment,
            'route' => $route,
        ];

        if (in_array($words[0] ?? null, ['in', 'out'], true)) {
            $rule['direction'] = array_shift($words);
        }

        if (($words[0] ?? null) === 'log' || ($words[0] ?? null) === 'log-all') {
            array_shift($words);
        }

        if (($words[0] ?? null) === 'on' && isset($words[1])) {
            array_shift($words);
            $rule['interface'] = array_shift($words);
        }

        if (! in_array($words[0] ?? null, ['from', 'to', 'proto'], true)) {
            // The short form: "22/tcp", "80,443/tcp" or the name of an app profile.
            $target = implode(' ', $words);

            if (preg_match('#^([0-9,:]+)(?:/(tcp|udp))?$#', $target, $match) === 1) {
                $rule['port'] = $match[1];
                $rule['protocol'] = $match[2] ?? 'any';
            } elseif ($target !== '') {
                $rule['app'] = trim($target, '\'"');
            }

            return $rule;
        }

        while ($words !== []) {
            $word = array_shift($words);
            $value = array_shift($words);

            if ($value === null) {
                break;
            }

            match ($word) {
                'from' => $rule['from'] = $value,
                'to' => $rule['to'] = $value,
                'port' => $rule['port'] = $value,
                'proto' => $rule['protocol'] = $value,
                'app' => $rule['app'] = trim($value, '\'"'),
                default => null,
            };
        }

        return $rule;
    }

    /**
     * `ss -H -tulpn`: the ports that listen, and whether only this machine can reach them.
     *
     * @return list<array{protocol: string, address: string, port: int, process: string|null, public: bool}>
     */
    public function ports(string $text): array
    {
        $ports = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            $columns = preg_split('/\s+/', trim($line)) ?: [];

            if (count($columns) < 5 || ! in_array($columns[0], ['tcp', 'udp'], true)) {
                continue;
            }

            $local = $columns[4];
            $colon = strrpos($local, ':');

            if ($colon === false) {
                continue;
            }

            $address = trim(substr($local, 0, $colon), '[]');
            $address = preg_replace('/%.*$/', '', $address) ?? $address;
            $port = (int) substr($local, $colon + 1);

            if ($port <= 0) {
                continue;
            }

            $process = preg_match('/users:\(\("([^"]+)"/', $line, $match) === 1 ? $match[1] : null;
            $key = $columns[0].'|'.$address.'|'.$port;

            $ports[$key] ??= [
                'protocol' => $columns[0],
                'address' => $address === '' ? '*' : $address,
                'port' => $port,
                'process' => $process,
                'public' => ! $this->isLoopback($address),
            ];
        }

        $ports = array_values($ports);
        usort($ports, fn (array $a, array $b) => [$a['port'], $a['protocol']] <=> [$b['port'], $b['protocol']]);

        return $ports;
    }

    /**
     * `fail2ban-client status <jail>`.
     *
     * @return array{name: string, currently_failed: int, total_failed: int, currently_banned: int, total_banned: int, banned: list<string>, files: string|null}
     */
    public function jail(string $name, string $text): array
    {
        $number = fn (string $label): int => preg_match('/'.preg_quote($label, '/').':\s*(\d+)/', $text, $match) === 1 ? (int) $match[1] : 0;

        $banned = preg_match('/Banned IP list:\s*(.*)$/m', $text, $match) === 1
            ? array_values(array_filter(preg_split('/\s+/', trim($match[1])) ?: [], fn (string $ip) => filter_var($ip, FILTER_VALIDATE_IP) !== false))
            : [];

        $files = preg_match('/(?:File list|Journal matches):\s*(.*)$/m', $text, $match) === 1 ? trim($match[1]) : null;

        return [
            'name' => $name,
            'currently_failed' => $number('Currently failed'),
            'total_failed' => $number('Total failed'),
            'currently_banned' => $number('Currently banned'),
            'total_banned' => $number('Total banned'),
            'banned' => $banned,
            'files' => $files ?: null,
        ];
    }

    /**
     * Whether a rule lets traffic in to the port: the SSH port must stay reachable.
     *
     * @param  array{action: string, direction: string, port: string|null, protocol: string, from: string, app: string|null, route: bool}  $rule
     */
    public function allowsPort(array $rule, int $port, string $protocol = 'tcp'): bool
    {
        if ($rule['route'] || $rule['direction'] !== 'in' || ! in_array($rule['action'], ['allow', 'limit'], true)) {
            return false;
        }

        if ($rule['app'] !== null) {
            return $port === 22 && in_array(strtolower($rule['app']), ['openssh', 'ssh'], true);
        }

        return $rule['port'] !== null
            && in_array($rule['protocol'], ['any', $protocol], true)
            && $this->portMatches($rule['port'], $port);
    }

    /**
     * Whether a rule shuts the port for everyone.
     *
     * @param  array{action: string, direction: string, port: string|null, protocol: string, from: string, app: string|null, route: bool}  $rule
     */
    public function blocksPort(array $rule, int $port, string $protocol = 'tcp'): bool
    {
        if ($rule['route'] || $rule['direction'] !== 'in' || ! in_array($rule['action'], ['deny', 'reject'], true)) {
            return false;
        }

        if ($rule['port'] === null) {
            return false;
        }

        return in_array($rule['protocol'], ['any', $protocol], true) && $this->portMatches($rule['port'], $port);
    }

    /** "22", "80,443" or "6000:6007". */
    public function portMatches(string $ports, int $port): bool
    {
        foreach (explode(',', $ports) as $part) {
            if (str_contains($part, ':')) {
                [$low, $high] = array_map('intval', explode(':', $part, 2));

                if ($port >= $low && $port <= $high) {
                    return true;
                }
            } elseif ((int) $part === $port) {
                return true;
            }
        }

        return false;
    }

    private function isLoopback(string $address): bool
    {
        return $address === '::1' || $address === 'localhost' || str_starts_with($address, '127.');
    }
}
