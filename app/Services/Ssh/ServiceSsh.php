<?php

namespace App\Services\Ssh;

use App\Exceptions\MetricsCollectionException;
use App\Models\Server;
use App\Models\ServerService;
use InvalidArgumentException;
use Throwable;

/**
 * The systemd services of a server the app logs into over SSH: start, stop and restart a unit, read its status and
 * its journal, all at once. Everything the user presses goes through here, never through the agent.
 */
class ServiceSsh
{
    public const ACTIONS = ['start', 'stop', 'restart'];

    private const UNIT_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9:_.@-]*\.service$/';

    private const SHOW_STATE = 'systemctl show -p ActiveState -p SubState -p UnitFileState -- %s 2>/dev/null';

    public function __construct(private readonly ServerMetricsCollector $ssh) {}

    /**
     * Start, stop or restart one unit. Returns the error text, or null when it worked. The state of the unit
     * is read again right after, so the page shows what it is now.
     */
    public function act(ServerService $service, string $action): ?string
    {
        if (! in_array($action, self::ACTIONS, true)) {
            throw new InvalidArgumentException('Unknown action.');
        }

        $unit = $this->unit($service);

        try {
            $output = $this->exec($service->server, sprintf(
                '%s %s %s -- %s 2>&1; echo "###EXIT $?"; echo "###STATE"; %s',
                $this->privilege(),
                'systemctl',
                $action,
                $unit,
                sprintf(self::SHOW_STATE, $unit),
            ));
        } catch (Throwable $e) {
            return mb_substr($e->getMessage(), 0, 500);
        }

        [$result, $state] = array_pad(explode('###STATE', $output, 2), 2, '');

        $this->applyState($service, $state);

        if (preg_match('/###EXIT (\d+)\s*$/', trim($result), $match) === 1 && $match[1] === '0') {
            return null;
        }

        return mb_substr(trim(preg_replace('/###EXIT \d+\s*$/', '', trim($result)) ?? ''), 0, 500) ?: 'The command failed.';
    }

    /**
     * The output of `systemctl status`. The state of the unit is refreshed from the same call.
     *
     * @throws MetricsCollectionException
     */
    public function status(ServerService $service): string
    {
        $unit = $this->unit($service);

        $output = $this->exec($service->server, sprintf(
            'systemctl status --no-pager -l -n 20 -- %s 2>&1 | head -c 100000; echo; echo "###STATE"; %s',
            $unit,
            sprintf(self::SHOW_STATE, $unit),
        ));

        [$text, $state] = array_pad(explode('###STATE', $output, 2), 2, '');

        $this->applyState($service, $state);

        return $this->text($text);
    }

    /**
     * The end of the journal of one unit.
     *
     * @throws MetricsCollectionException
     */
    public function journal(ServerService $service): string
    {
        $output = $this->exec($service->server, sprintf(
            'journalctl -u %s -n 500 -o short-iso --no-pager 2>&1 | cut -c1-500 | tail -c 400000',
            $this->unit($service),
        ));

        return $this->text($output);
    }

    /**
     * The unit name as a shell argument. The names the agent sends are checked already; this is the second look.
     */
    private function unit(ServerService $service): string
    {
        if (preg_match(self::UNIT_PATTERN, $service->unit) !== 1) {
            throw new InvalidArgumentException('Unknown unit.');
        }

        return escapeshellarg($service->unit);
    }

    /**
     * Root runs systemctl itself, any other login user needs sudo without a password.
     */
    private function privilege(): string
    {
        return '[ "$(id -u)" -eq 0 ] || S="sudo -n"; ${S:-}';
    }

    private function applyState(ServerService $service, string $state): void
    {
        $values = [];

        foreach (preg_split('/\r\n|\n|\r/', $state) as $line) {
            if (preg_match('/^(ActiveState|SubState|UnitFileState)=(.*)$/', trim($line), $match) === 1) {
                $values[$match[1]] = $match[2];
            }
        }

        if (! isset($values['ActiveState']) || $values['ActiveState'] === '') {
            return;
        }

        $service->forceFill([
            'active_state' => mb_substr($values['ActiveState'], 0, 20),
            'sub_state' => mb_substr($values['SubState'] ?? '', 0, 30) ?: null,
            'unit_file_state' => mb_substr($values['UnitFileState'] ?? '', 0, 30) ?: null,
        ])->save();
    }

    private function text(string $output): string
    {
        return trim(mb_convert_encoding($output, 'UTF-8', 'UTF-8'));
    }

    /**
     * @throws MetricsCollectionException
     */
    private function exec(Server $server, string $command): string
    {
        $ssh = $this->ssh->connect($server);

        try {
            $output = $ssh->exec('sh -c '.escapeshellarg($command));
        } finally {
            $ssh->disconnect();
        }

        return is_string($output) ? $output : '';
    }
}
