<?php

namespace App\Services\Scheduler;

use Cron\CronExpression;
use DateTimeZone;
use Throwable;

/**
 * Reads crontabs line by line. Jobs that are switched off here stay in the crontab as a comment with
 * a marker, so they can be switched on again. Everything else (variables, comments) is kept as it is.
 */
class CrontabParser
{
    public const DISABLED_MARKER = '#RA-OFF ';

    public const SPECIALS = ['@reboot', '@yearly', '@annually', '@monthly', '@weekly', '@daily', '@midnight', '@hourly'];

    /**
     * The jobs of one crontab. With $withUser the lines carry a user column (/etc/crontab, /etc/cron.d).
     *
     * @return list<array{line: int, hash: string, schedule: string, user: string|null, command: string, enabled: bool, label: string|null, next: list<string>}>
     */
    public function jobs(string $crontab, bool $withUser = false, ?string $timezone = null): array
    {
        $jobs = [];
        $lines = $this->lines($crontab);
        $previousComment = null;

        foreach ($lines as $index => $line) {
            $trimmed = trim($line);
            $enabled = true;
            $body = $trimmed;

            if (str_starts_with($trimmed, self::DISABLED_MARKER)) {
                $enabled = false;
                $body = trim(substr($trimmed, strlen(self::DISABLED_MARKER)));
            } elseif (str_starts_with($trimmed, '#')) {
                $previousComment = trim(ltrim($trimmed, '#')) ?: null;

                continue;
            }

            $job = $body === '' ? null : $this->job($body, $withUser);

            if ($job === null) {
                $previousComment = null;

                continue;
            }

            $jobs[] = [
                'line' => $index,
                'hash' => $this->hash($line),
                ...$job,
                'enabled' => $enabled,
                'label' => $previousComment,
                'next' => $enabled ? $this->nextRuns($job['schedule'], $timezone) : [],
            ];

            $previousComment = null;
        }

        return $jobs;
    }

    /**
     * Variables set at the top of the crontab, as MAILTO or PATH.
     *
     * @return array<string, string>
     */
    public function variables(string $crontab): array
    {
        $variables = [];

        foreach ($this->lines($crontab) as $line) {
            if (preg_match('/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/', $line, $match) === 1) {
                $variables[$match[1]] = trim($match[2], " \t\"'");
            }
        }

        return $variables;
    }

    /**
     * @return array{schedule: string, user: string|null, command: string}|null
     */
    public function job(string $line, bool $withUser = false): ?array
    {
        if (preg_match('/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/', $line) === 1) {
            return null;
        }

        $parts = preg_split('/\s+/', trim($line), $withUser ? 3 : 2) ?: [];

        if (in_array(strtolower($parts[0] ?? ''), self::SPECIALS, true)) {
            $schedule = strtolower($parts[0]);
            $rest = array_slice($parts, 1);
        } else {
            $parts = preg_split('/\s+/', trim($line), $withUser ? 7 : 6) ?: [];

            if (count($parts) < ($withUser ? 7 : 6)) {
                return null;
            }

            $schedule = implode(' ', array_slice($parts, 0, 5));
            $rest = array_slice($parts, 5);

            if (! $this->isValidSchedule($schedule)) {
                return null;
            }
        }

        $user = $withUser ? array_shift($rest) : null;
        $command = trim(implode(' ', $rest));

        return $command === '' ? null : ['schedule' => $schedule, 'user' => $user, 'command' => $command];
    }

    public function isValidSchedule(string $schedule): bool
    {
        $schedule = trim($schedule);

        if (in_array(strtolower($schedule), self::SPECIALS, true)) {
            return true;
        }

        if (count(preg_split('/\s+/', $schedule) ?: []) !== 5) {
            return false;
        }

        try {
            return CronExpression::isValidExpression($schedule);
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * The next three times the schedule fires, in the time zone of the server.
     *
     * @return list<string>
     */
    public function nextRuns(string $schedule, ?string $timezone = null, int $count = 3): array
    {
        if ($schedule === '@reboot') {
            return [];
        }

        $expression = match ($schedule) {
            '@yearly', '@annually' => '0 0 1 1 *',
            '@monthly' => '0 0 1 * *',
            '@weekly' => '0 0 * * 0',
            '@daily', '@midnight' => '0 0 * * *',
            '@hourly' => '0 * * * *',
            default => $schedule,
        };

        try {
            $zone = $this->zone($timezone);
            $cron = new CronExpression($expression);
            $now = now($zone);

            return array_values(array_map(
                fn (\DateTime $date) => $date->format(DATE_ATOM),
                $cron->getMultipleRunDates($count, $now, false, false, $zone->getName()),
            ));
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * The lines of a crontab, with the final empty line dropped.
     *
     * @return list<string>
     */
    public function lines(string $crontab): array
    {
        $lines = preg_split('/\r\n|\n|\r/', $crontab) ?: [];

        if ($lines !== [] && end($lines) === '') {
            array_pop($lines);
        }

        return $lines;
    }

    public function hash(string $line): string
    {
        return substr(hash('sha256', $line), 0, 16);
    }

    private function zone(?string $timezone): DateTimeZone
    {
        try {
            return new DateTimeZone($timezone ?: 'UTC');
        } catch (Throwable) {
            return new DateTimeZone('UTC');
        }
    }
}
