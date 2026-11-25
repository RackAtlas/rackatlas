<?php

namespace App\Services\Scheduler;

use App\Exceptions\MetricsCollectionException;
use App\Exceptions\RemoteCommandException;
use App\Models\Server;
use App\Services\Ssh\RemoteResult;
use App\Services\Ssh\RemoteShell;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Cron jobs and systemd timers of a server, over SSH. The crontabs of the users can be changed here;
 * /etc/crontab, /etc/cron.d and the cron.daily scripts are shown and opened in the file manager.
 *
 * A change names the line it changes together with a hash of it. When the crontab was edited on the
 * server in the meantime and the line differs, nothing is written.
 */
class CronSsh
{
    public const USER_PATTERN = '/^[a-z_][a-z0-9_.-]{0,31}$/i';

    public const TIMER_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9:_.@\\\\-]*\.timer$/';

    public const TIMER_ACTIONS = ['run', 'start', 'stop', 'enable', 'disable'];

    public function __construct(
        private readonly RemoteShell $shell,
        private readonly CrontabParser $parser,
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
            echo "###TZ"; timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null
            echo "###DAEMON"; for D in cron crond cronie; do systemctl is-active "$D" 2>/dev/null | grep -qx active && { echo active; break; }; done
            ME=$(id -un)
            USERS=$( { getent passwd | awk -F: '$3==0 || ($3>=1000 && $3<65534) {print $1}'; $S ls /var/spool/cron/crontabs 2>/dev/null; } | sort -u )
            for U in $USERS; do
                echo "###CRONTAB $U"
                if [ "$U" = "$ME" ] && [ -z "$S" ]; then crontab -l 2>/dev/null; else $S crontab -l -u "$U" 2>/dev/null; fi
            done
            echo "###SYSTEM /etc/crontab"; $S cat /etc/crontab 2>/dev/null
            for F in /etc/cron.d/*; do [ -f "$F" ] && { echo "###SYSTEM $F"; $S cat "$F" 2>/dev/null | head -n 200; }; done
            echo "###PERIODIC"; for P in hourly daily weekly monthly; do for F in /etc/cron.$P/*; do [ -f "$F" ] && [ -x "$F" ] && printf '%s\t%s\n' "$P" "$F"; done; done
            for T in $( { systemctl list-units --all --type=timer --plain --no-legend --no-pager 2>/dev/null | awk '{print $1}'; systemctl list-unit-files --type=timer --no-legend --no-pager 2>/dev/null | awk '{print $1}'; } | grep '\.timer$' | grep -v '@\.timer$' | sort -u | head -n 150 ); do
                echo "###TIMER $T"
                systemctl show -p Description -p ActiveState -p UnitFileState -p NextElapseUSecRealtime -p LastTriggerUSec -p Unit -p TimersCalendar -p TimersMonotonic -p Persistent --no-pager -- "$T" 2>/dev/null
                SV=$(systemctl show -p Unit --value -- "$T" 2>/dev/null)
                [ -n "$SV" ] && systemctl show -p Result -p ExecMainStatus -p ActiveState --no-pager -- "$SV" 2>/dev/null | sed 's/^/Service/'
            done
            echo "###END"
            SH, 45);

        $sections = $result->sections();
        $timezone = trim($sections['TZ'] ?? '') ?: null;

        $crontabs = [];
        $system = [];
        $timers = [];

        foreach ($sections as $key => $text) {
            if (str_starts_with($key, 'CRONTAB ')) {
                $user = trim(substr($key, 8));

                if (preg_match(self::USER_PATTERN, $user) === 1) {
                    $crontabs[] = [
                        'user' => $user,
                        'jobs' => $this->parser->jobs($text, false, $timezone),
                        'variables' => $this->parser->variables($text),
                        'raw' => $text,
                    ];
                }
            } elseif (str_starts_with($key, 'SYSTEM ')) {
                $system[] = [
                    'path' => trim(substr($key, 7)),
                    'jobs' => $this->parser->jobs($text, true, $timezone),
                ];
            } elseif (str_starts_with($key, 'TIMER ')) {
                $timers[] = $this->timer(trim(substr($key, 6)), $text);
            }
        }

        $periodic = [];

        foreach (preg_split('/\n/', trim($sections['PERIODIC'] ?? '')) ?: [] as $line) {
            [$period, $path] = array_pad(explode("\t", $line, 2), 2, null);

            if ($period !== null && $path !== null && $path !== '') {
                $periodic[] = ['period' => $period, 'path' => $path, 'name' => basename($path)];
            }
        }

        // Users with jobs first, then the rest by name.
        usort($crontabs, fn (array $a, array $b) => [$a['jobs'] === [], $a['user'] !== 'root', $a['user']] <=> [$b['jobs'] === [], $b['user'] !== 'root', $b['user']]);
        usort($timers, fn (array $a, array $b) => [$a['next'] === null, $a['next'] ?? '', $a['name']] <=> [$b['next'] === null, $b['next'] ?? '', $b['name']]);

        return [
            'privilege' => trim($sections['WHO'] ?? 'none') ?: 'none',
            'login' => trim($sections['ME'] ?? ''),
            'timezone' => $timezone,
            'daemon' => trim($sections['DAEMON'] ?? '') === 'active',
            'crontabs' => $crontabs,
            'system' => array_values(array_filter($system, fn (array $file) => $file['jobs'] !== [])),
            'periodic' => $periodic,
            'timers' => $timers,
        ];
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function add(Server $server, string $user, string $schedule, string $command, ?string $label, bool $enabled): void
    {
        $this->change($server, $user, function (array $lines) use ($schedule, $command, $label, $enabled) {
            if ($lines !== [] && trim((string) end($lines)) !== '') {
                $lines[] = '';
            }

            if ($label) {
                $lines[] = '# '.$label;
            }

            $lines[] = $this->line($schedule, $command, $enabled);

            return $lines;
        });
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function update(Server $server, string $user, int $line, string $hash, string $schedule, string $command, ?string $label): void
    {
        $this->change($server, $user, function (array $lines) use ($line, $hash, $schedule, $command, $label) {
            $this->assertLine($lines, $line, $hash);
            $enabled = ! str_starts_with(trim($lines[$line]), CrontabParser::DISABLED_MARKER);
            $hasLabel = $this->labelLine($lines, $line);

            $lines[$line] = $this->line($schedule, $command, $enabled);

            if ($hasLabel && $label) {
                $lines[$line - 1] = '# '.$label;
            } elseif ($hasLabel) {
                array_splice($lines, $line - 1, 1);
            } elseif ($label) {
                array_splice($lines, $line, 0, ['# '.$label]);
            }

            return $lines;
        });
    }

    /**
     * Switch a job on or off. A job that is off stays in the crontab behind the marker.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function toggle(Server $server, string $user, int $line, string $hash, bool $enabled): void
    {
        $this->change($server, $user, function (array $lines) use ($line, $hash, $enabled) {
            $this->assertLine($lines, $line, $hash);
            $body = trim($lines[$line]);

            if (str_starts_with($body, CrontabParser::DISABLED_MARKER)) {
                $body = trim(substr($body, strlen(CrontabParser::DISABLED_MARKER)));
            }

            $lines[$line] = $enabled ? $body : CrontabParser::DISABLED_MARKER.$body;

            return $lines;
        });
    }

    /**
     * Delete a job, with the comment above it that names it.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function delete(Server $server, string $user, int $line, string $hash): void
    {
        $this->change($server, $user, function (array $lines) use ($line, $hash) {
            $this->assertLine($lines, $line, $hash);

            $start = $this->labelLine($lines, $line) ? $line - 1 : $line;
            array_splice($lines, $start, $line - $start + 1);

            return $lines;
        });
    }

    /**
     * Run the command of a job right now as its user, for at most 60 seconds, and return what it printed.
     *
     * @return array{exit: int, output: string, seconds: float}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function run(Server $server, string $user, string $command): array
    {
        $this->assertUser($user);
        $started = microtime(true);

        $result = $this->shell->run($server, sprintf(
            "U=%s\nC=%s\n%s",
            escapeshellarg($user),
            escapeshellarg($command),
            <<<'SH'
            cd / 2>/dev/null
            if [ "$U" = "$(id -un)" ]; then
                timeout 60 sh -c "$C" 2>&1 </dev/null
            elif [ "$(id -u)" -eq 0 ] && command -v runuser >/dev/null 2>&1; then
                runuser -u "$U" -- timeout 60 sh -c "$C" 2>&1 </dev/null
            elif [ -n "$S" ]; then
                sudo -n -H -u "$U" -- timeout 60 sh -c "$C" 2>&1 </dev/null
            else
                echo "Running a job of another user needs root or sudo without a password." >&2; exit 77
            fi
            SH,
        ), 75);

        if ($result->exitCode === 77) {
            throw new RemoteCommandException($result->message());
        }

        return [
            'exit' => $result->exitCode,
            'output' => mb_substr(trim(mb_convert_encoding($result->output."\n".$result->error, 'UTF-8', 'UTF-8')), -20000),
            'seconds' => round(microtime(true) - $started, 1),
        ];
    }

    /**
     * Run the service of a timer now, or start, stop, enable or disable the timer.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function timerAction(Server $server, string $timer, string $action): void
    {
        $this->assertTimer($timer);

        $command = match ($action) {
            'run' => 'SV=$(systemctl show -p Unit --value -- "$T"); [ -n "$SV" ] || exit 3; $S systemctl start --no-block -- "$SV"',
            'start', 'stop' => '$S systemctl '.$action.' -- "$T"',
            'enable', 'disable' => '$S systemctl '.$action.' --now -- "$T"',
            default => throw new RemoteCommandException('Unknown action.'),
        };

        $result = $this->shell->run($server, 'T='.escapeshellarg($timer)."\n".$command);

        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }
    }

    /**
     * The end of the journal of the service a timer starts.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function timerJournal(Server $server, string $timer): string
    {
        $this->assertTimer($timer);

        $result = $this->shell->run($server, 'T='.escapeshellarg($timer)."\n".<<<'SH'
            SV=$(systemctl show -p Unit --value -- "$T")
            $S journalctl -u "$SV" -n 300 -o short-iso --no-pager 2>&1 | cut -c1-500 | tail -c 200000
            SH, 30);

        return trim(mb_convert_encoding($result->output, 'UTF-8', 'UTF-8'));
    }

    /**
     * Read the crontab, let $edit change its lines and write it back.
     *
     * @param  \Closure(list<string>): array<int, string>  $edit
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    private function change(Server $server, string $user, \Closure $edit): void
    {
        $this->assertUser($user);

        $current = $this->shell->run($server, 'U='.escapeshellarg($user)."\n".$this->crontabCommand()."\n".'$C -l 2>/dev/null; exit 0');
        $lines = array_values($edit($this->parser->lines($current->output)));

        $text = implode("\n", $lines);
        $text = trim($text) === '' ? '' : rtrim($text, "\n")."\n";

        if (strlen($text) > 64 * 1024) {
            throw new RemoteCommandException(__('The crontab is too big.'));
        }

        $result = $this->shell->run($server, sprintf(
            "U=%s\n%s\nprintf %%s %s | base64 -d | \$C -",
            escapeshellarg($user),
            $this->crontabCommand(),
            escapeshellarg(base64_encode($text)),
        ));

        if (! $result->ok()) {
            throw new RemoteCommandException($this->cleanCrontabError($result));
        }
    }

    /**
     * Sets $C to `crontab` for the user in $U: with -u through sudo, or plain for the login user without sudo.
     */
    private function crontabCommand(): string
    {
        return 'if [ "$U" = "$(id -un)" ] && [ -z "$S" ]; then C="crontab"; else C="$S crontab -u $U"; fi';
    }

    private function line(string $schedule, string $command, bool $enabled): string
    {
        $line = trim($schedule).' '.trim($command);

        return $enabled ? $line : CrontabParser::DISABLED_MARKER.$line;
    }

    /**
     * Whether the line above the job is the comment that names it.
     *
     * @param  list<string>  $lines
     */
    private function labelLine(array $lines, int $line): bool
    {
        if ($line === 0) {
            return false;
        }

        $above = trim($lines[$line - 1] ?? '');

        return str_starts_with($above, '#') && ! str_starts_with($above, CrontabParser::DISABLED_MARKER)
            && ($line < 2 || ! str_starts_with(trim($lines[$line - 2] ?? ''), '#'));
    }

    /**
     * @param  list<string>  $lines
     *
     * @throws RemoteCommandException
     */
    private function assertLine(array $lines, int $line, string $hash): void
    {
        if (! isset($lines[$line]) || ! hash_equals($this->parser->hash($lines[$line]), $hash)) {
            throw RemoteCommandException::conflict(__('The crontab was changed on the server in the meantime. Load it again.'));
        }
    }

    /**
     * @throws RemoteCommandException
     */
    private function assertUser(string $user): void
    {
        if (preg_match(self::USER_PATTERN, $user) !== 1) {
            throw new RemoteCommandException(__('Unknown user.'));
        }
    }

    /**
     * @throws RemoteCommandException
     */
    private function assertTimer(string $timer): void
    {
        if (preg_match(self::TIMER_PATTERN, $timer) !== 1) {
            throw new RemoteCommandException(__('Unknown timer.'));
        }
    }

    private function cleanCrontabError(RemoteResult $result): string
    {
        $message = $result->message();

        if (str_contains($message, 'must be privileged')) {
            return __('Changing the crontab of another user needs root or sudo without a password.');
        }

        return $message;
    }

    /**
     * @return array{name: string, description: string|null, active: bool, enabled: string|null, next: string|null, last: string|null, service: string|null, schedule: string|null, persistent: bool, result: string|null, exit_status: int|null, running: bool}
     */
    private function timer(string $name, string $text): array
    {
        $values = [];

        foreach (preg_split('/\n/', $text) ?: [] as $line) {
            if (preg_match('/^([A-Za-z]+)=(.*)$/', $line, $match) === 1) {
                $values[$match[1]] = trim($match[2]);
            }
        }

        $schedule = null;

        foreach (['TimersCalendar', 'TimersMonotonic'] as $key) {
            if (preg_match('/\{\s*([A-Za-z]+)=([^;]+?)\s*;/', $values[$key] ?? '', $match) === 1) {
                $schedule = $match[1].'='.trim($match[2]);

                break;
            }
        }

        return [
            'name' => $name,
            'description' => $values['Description'] ?? null,
            'active' => ($values['ActiveState'] ?? '') === 'active',
            'enabled' => $values['UnitFileState'] ?? null,
            'next' => $this->timestamp($values['NextElapseUSecRealtime'] ?? null),
            'last' => $this->timestamp($values['LastTriggerUSec'] ?? null),
            'service' => $values['Unit'] ?? null,
            'schedule' => $schedule,
            'persistent' => ($values['Persistent'] ?? '') === 'yes',
            'result' => $values['ServiceResult'] ?? null,
            'exit_status' => isset($values['ServiceExecMainStatus']) ? (int) $values['ServiceExecMainStatus'] : null,
            'running' => in_array($values['ServiceActiveState'] ?? '', ['active', 'activating'], true),
        ];
    }

    private function timestamp(?string $value): ?string
    {
        if ($value === null || $value === '' || $value === 'n/a' || $value === '0') {
            return null;
        }

        try {
            return Carbon::parse(preg_replace('/^[A-Za-z]{3}\s+/', '', $value))->toIso8601String();
        } catch (Throwable) {
            return null;
        }
    }
}
