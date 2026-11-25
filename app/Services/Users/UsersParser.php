<?php

namespace App\Services\Users;

use App\Services\Ssh\HostKeyVerifier;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Turns /etc/passwd, /etc/group, the state of /etc/shadow, `last`, `who` and authorized_keys into arrays.
 * Password hashes never leave the server: the script reports only whether a password is set or locked.
 *
 * @phpstan-type AuthorizedKey array{line: int, type: string, fingerprint: string|null, comment: string|null, options: string|null, raw: string}
 */
class UsersParser
{
    private const KEY_TYPES = [
        'ssh-ed25519', 'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521',
        'sk-ssh-ed25519@openssh.com', 'sk-ecdsa-sha2-nistp256@openssh.com',
    ];

    /**
     * @return list<array{name: string, uid: int, gid: int, gecos: string, home: string, shell: string}>
     */
    public function passwd(string $text): array
    {
        $users = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            $columns = explode(':', $line);

            if (count($columns) < 7 || $columns[0] === '') {
                continue;
            }

            $users[] = [
                'name' => $columns[0],
                'uid' => (int) $columns[2],
                'gid' => (int) $columns[3],
                'gecos' => explode(',', $columns[4])[0],
                'home' => $columns[5],
                'shell' => $columns[6],
            ];
        }

        return $users;
    }

    /**
     * @return list<array{name: string, gid: int, members: list<string>}>
     */
    public function groups(string $text): array
    {
        $groups = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            $columns = explode(':', $line);

            if (count($columns) < 4 || $columns[0] === '') {
                continue;
            }

            $groups[] = [
                'name' => $columns[0],
                'gid' => (int) $columns[2],
                'members' => array_values(array_filter(explode(',', trim($columns[3])))),
            ];
        }

        return $groups;
    }

    /**
     * "name:state:lastchange:max:expire" per line, state one of set, locked, none, empty.
     *
     * @return array<string, array{password: string, changed_at: string|null, max_days: int|null, expires_at: string|null}>
     */
    public function shadow(string $text): array
    {
        $states = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            $columns = explode(':', trim($line));

            if (count($columns) < 5 || $columns[0] === '') {
                continue;
            }

            $states[$columns[0]] = [
                'password' => in_array($columns[1], ['set', 'locked', 'none', 'empty'], true) ? $columns[1] : 'none',
                'changed_at' => $this->days($columns[2]),
                'max_days' => is_numeric($columns[3]) && (int) $columns[3] < 99999 ? (int) $columns[3] : null,
                'expires_at' => $this->days($columns[4]),
            ];
        }

        return $states;
    }

    /**
     * `last -w -F -i`: "root pts/0 203.0.113.5 Tue Nov 25 10:00:00 2026 - Tue Nov 25 11:00:00 2026 (01:00)".
     *
     * @return list<array{user: string, tty: string, from: string|null, at: string|null, until: string|null, active: bool}>
     */
    public function logins(string $text): array
    {
        $logins = [];
        $date = '[A-Z][a-z]{2} [A-Z][a-z]{2} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4}';

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            if (preg_match('/^(\S+)\s+(\S+)\s+(\S+)\s+('.$date.')\s*(?:-\s*('.$date.')|(still logged in)|.*)?/', $line, $match) !== 1) {
                continue;
            }

            if (in_array($match[1], ['reboot', 'shutdown', 'wtmp', 'btmp'], true)) {
                continue;
            }

            $logins[] = [
                'user' => $match[1],
                'tty' => $match[2],
                'from' => in_array($match[3], ['0.0.0.0', '-', ':0'], true) ? null : $match[3],
                'at' => $this->time($match[4]),
                'until' => isset($match[5]) && $match[5] !== '' ? $this->time($match[5]) : null,
                'active' => ($match[6] ?? '') === 'still logged in',
            ];
        }

        return $logins;
    }

    /**
     * Failed SSH logins from the journal: "Failed password for invalid user admin from 203.0.113.7 port 51234".
     *
     * @return list<array{user: string, from: string, at: string|null, invalid_user: bool}>
     */
    public function failures(string $text): array
    {
        $failures = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            if (preg_match('/^(\S+)\s.*(?:Failed \S+ for (invalid user )?(\S+)|Invalid user (\S*)) from ([0-9a-fA-F:.]+)/', $line, $match) !== 1) {
                continue;
            }

            $user = $match[3] !== '' ? $match[3] : $match[4];

            $failures[] = [
                'user' => $user === '' ? '?' : $user,
                'from' => $match[5],
                'at' => $this->time($match[1]),
                'invalid_user' => $match[2] !== '' || $match[4] !== '',
            ];
        }

        return $failures;
    }

    /**
     * `who -u`: "deploy pts/1 2026-11-25 10:01 00:05 12345 (203.0.113.5)".
     *
     * @return list<array{user: string, tty: string, since: string|null, idle: string|null, pid: int|null, from: string|null}>
     */
    public function sessions(string $text): array
    {
        $sessions = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            if (preg_match('/^(\S+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(\S+)\s+(\d+)(?:\s+\(([^)]*)\))?/', trim($line), $match) !== 1) {
                continue;
            }

            $sessions[] = [
                'user' => $match[1],
                'tty' => $match[2],
                'since' => $this->time($match[3]),
                'idle' => $match[4] === '.' ? null : $match[4],
                'pid' => (int) $match[5],
                'from' => ($match[6] ?? '') !== '' ? $match[6] : null,
            ];
        }

        return $sessions;
    }

    /**
     * The lines of an authorized_keys file that hold a key, with their fingerprint.
     *
     * @return list<AuthorizedKey>
     */
    public function authorizedKeys(string $text): array
    {
        $keys = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $index => $line) {
            $key = $this->key($line);

            if ($key !== null) {
                $keys[] = ['line' => $index, ...$key];
            }
        }

        return $keys;
    }

    /**
     * One public key line, possibly with options in front ("from=\"10.0.0.0/8\" ssh-ed25519 AAAA... me@laptop").
     *
     * @return array{type: string, fingerprint: string|null, comment: string|null, options: string|null, raw: string}|null
     */
    public function key(string $line): ?array
    {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            return null;
        }

        $types = implode('|', array_map(fn (string $type) => preg_quote($type, '/'), self::KEY_TYPES));

        if (preg_match('/^(?:(.*?)\s+)?('.$types.')\s+([A-Za-z0-9+\/=]+)(?:\s+(.*))?$/', $line, $match) !== 1) {
            return null;
        }

        try {
            $fingerprint = HostKeyVerifier::fingerprintOf($match[2].' '.$match[3]);
        } catch (Throwable) {
            $fingerprint = null;
        }

        return [
            'type' => $match[2],
            'fingerprint' => $fingerprint,
            'comment' => ($match[4] ?? '') !== '' ? trim($match[4]) : null,
            'options' => ($match[1] ?? '') !== '' ? $match[1] : null,
            'raw' => $line,
        ];
    }

    /**
     * `sshd -T`: the settings that decide who may log in.
     *
     * @return array<string, string>
     */
    public function sshd(string $text): array
    {
        $settings = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            [$key, $value] = array_pad(preg_split('/\s+/', trim($line), 2) ?: [], 2, '');

            if ($key !== '') {
                $settings[strtolower($key)] = $value;
            }
        }

        return $settings;
    }

    /** Days since 1970 as /etc/shadow writes them. */
    private function days(string $value): ?string
    {
        return is_numeric($value) && (int) $value > 0
            ? Carbon::createFromTimestamp((int) $value * 86400)->toDateString()
            : null;
    }

    private function time(string $value): ?string
    {
        try {
            return Carbon::parse($value)->toIso8601String();
        } catch (Throwable) {
            return null;
        }
    }
}
