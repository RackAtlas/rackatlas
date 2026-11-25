<?php

namespace App\Services\Updates;

use App\Exceptions\MetricsCollectionException;
use App\Exceptions\RemoteCommandException;
use App\Models\Server;
use App\Services\Ssh\RemoteShell;
use Illuminate\Support\Carbon;

/**
 * Package updates of Debian and Ubuntu servers, over SSH. Refreshing the lists, upgrading and removing
 * packages runs in the background on the server, so a long upgrade survives the SSH session; the page
 * follows its log. Only one such job runs at a time.
 */
class UpdatesSsh
{
    public const JOBS = ['refresh', 'upgrade', 'full-upgrade', 'security', 'packages', 'autoremove'];

    public const PACKAGE_PATTERN = '/^[a-z0-9][a-z0-9+.-]{0,99}(?::[a-z0-9]+)?$/';

    private const JOB_DIR = '/var/tmp/rackatlas-apt';

    private const APT = 'DEBIAN_FRONTEND=noninteractive apt-get -y -q -o DPkg::Lock::Timeout=180 -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold';

    public function __construct(private readonly RemoteShell $shell) {}

    /**
     * @return array<string, mixed>
     *
     * @throws MetricsCollectionException
     */
    public function overview(Server $server): array
    {
        $result = $this->shell->run($server, 'D='.escapeshellarg(self::JOB_DIR)."\n".<<<'SH'
            echo "###WHO"; [ "$(id -u)" -eq 0 ] && echo root || { [ -n "$S" ] && echo sudo || echo none; }
            echo "###APT"; command -v apt-get >/dev/null 2>&1 && echo yes
            echo "###OS"; ( . /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-}" )
            echo "###KERNEL"; uname -r
            echo "###UPTIME"; cut -d' ' -f1 /proc/uptime 2>/dev/null
            echo "###UPGRADABLE"; LC_ALL=C apt list --upgradable 2>/dev/null | grep -v '^Listing'
            echo "###HELD"; apt-mark showhold 2>/dev/null
            echo "###REBOOT"; [ -f /var/run/reboot-required ] && { echo yes; cat /var/run/reboot-required.pkgs 2>/dev/null | sort -u; }
            echo "###SHUTDOWN"; [ -f /run/systemd/shutdown/scheduled ] && cat /run/systemd/shutdown/scheduled 2>/dev/null
            echo "###REFRESHED"; stat -c %Y /var/lib/apt/periodic/update-success-stamp 2>/dev/null || stat -c %Y /var/cache/apt/pkgcache.bin 2>/dev/null
            echo "###UNATTENDED"; dpkg-query -W -f='${Status}\n' unattended-upgrades 2>/dev/null | grep -q 'install ok installed' && echo installed; grep -h 'Unattended-Upgrade' /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null
            echo "###JOB"
            if [ -f "$D/pid" ]; then
                if [ -f "$D/exit" ]; then echo "done $(cat "$D/exit")"; elif kill -0 "$(cat "$D/pid")" 2>/dev/null; then echo running; else echo "done 1"; fi
                echo "###JOBLABEL"; cat "$D/label" 2>/dev/null
                echo "###JOBSTARTED"; stat -c %Y "$D/pid" 2>/dev/null
            fi
            SH, 40);

        $sections = $result->sections();
        $packages = $this->packages($sections['UPGRADABLE'] ?? '');
        $held = array_values(array_filter(array_map('trim', explode("\n", $sections['HELD'] ?? ''))));
        $reboot = array_values(array_filter(array_map('trim', explode("\n", $sections['REBOOT'] ?? ''))));
        $unattended = array_filter(array_map('trim', explode("\n", $sections['UNATTENDED'] ?? '')));

        foreach ($packages as &$package) {
            $package['held'] = in_array($package['name'], $held, true);
        }

        unset($package);

        $refreshed = (int) trim($sections['REFRESHED'] ?? '');

        return [
            'privilege' => trim($sections['WHO'] ?? 'none') ?: 'none',
            'apt' => trim($sections['APT'] ?? '') === 'yes',
            'os' => trim($sections['OS'] ?? '') ?: null,
            'kernel' => trim($sections['KERNEL'] ?? '') ?: null,
            'uptime_seconds' => (int) (float) trim($sections['UPTIME'] ?? '0'),
            'packages' => $packages,
            'security_count' => count(array_filter($packages, fn (array $package) => $package['security'])),
            'held' => $held,
            'reboot_required' => ($reboot[0] ?? null) === 'yes',
            'reboot_packages' => array_slice($reboot, 1),
            'reboot_scheduled' => $this->scheduledShutdown($sections['SHUTDOWN'] ?? ''),
            'refreshed_at' => $refreshed > 0 ? Carbon::createFromTimestamp($refreshed)->toIso8601String() : null,
            'unattended' => [
                'installed' => in_array('installed', $unattended, true),
                'enabled' => collect($unattended)->contains(fn (string $line) => preg_match('/Unattended-Upgrade\s+"1"/', $line) === 1),
            ],
            'job' => $this->jobState($sections),
        ];
    }

    /**
     * Start a background job. "packages" upgrades only the named ones, "security" the ones from security sources.
     *
     * @param  list<string>  $packages
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function start(Server $server, string $job, array $packages = []): void
    {
        foreach ($packages as $package) {
            if (preg_match(self::PACKAGE_PATTERN, $package) !== 1) {
                throw new RemoteCommandException(__('Unknown package :name.', ['name' => $package]));
            }
        }

        if ($job === 'security') {
            $packages = array_column(array_filter($this->overview($server)['packages'], fn (array $package) => $package['security'] && ! $package['held']), 'name');

            if ($packages === []) {
                throw new RemoteCommandException(__('There are no security updates.'));
            }
        }

        $list = implode(' ', array_map('escapeshellarg', $packages));

        [$label, $command] = match ($job) {
            'refresh' => ['Refresh package lists', 'apt-get -q -o DPkg::Lock::Timeout=180 update'],
            'upgrade' => ['Upgrade all packages', 'apt-get -q -o DPkg::Lock::Timeout=180 update && '.self::APT.' upgrade'],
            'full-upgrade' => ['Full upgrade', 'apt-get -q -o DPkg::Lock::Timeout=180 update && '.self::APT.' full-upgrade'],
            'security', 'packages' => [
                $job === 'security' ? 'Security updates' : 'Upgrade selected packages',
                $packages === [] ? throw new RemoteCommandException(__('Choose the packages.')) : self::APT.' install --only-upgrade '.$list,
            ],
            'autoremove' => ['Remove unused packages', self::APT.' autoremove --purge'],
            default => throw new RemoteCommandException('Unknown job.'),
        };

        $dir = self::JOB_DIR;
        $script = <<<SH
            #!/bin/sh
            D={$dir}
            echo \$\$ > "\$D/pid"
            export DEBIAN_FRONTEND=noninteractive LC_ALL=C
            { echo "### {$label} – \$(date '+%Y-%m-%d %H:%M:%S')"; echo; {$command}; } > "\$D/log" 2>&1
            echo \$? > "\$D/exit"
            SH;

        $result = $this->shell->run($server, implode("\n", [
            'D='.escapeshellarg($dir),
            '[ "$(id -u)" -eq 0 ] || [ -n "$S" ] || { echo "The SSH user needs root or sudo without a password to install updates." >&2; exit 77; }',
            'if [ -f "$D/pid" ] && [ ! -f "$D/exit" ] && kill -0 "$(cat "$D/pid")" 2>/dev/null; then echo "Another update job is still running." >&2; exit 16; fi',
            '$S mkdir -p "$D" && $S chmod 755 "$D" && $S rm -f "$D/exit" "$D/pid" "$D/log"',
            RemoteShell::writeFile($dir.'/job.sh', $script."\n"),
            RemoteShell::writeFile($dir.'/label', $label."\n"),
            '$S setsid nohup sh "$D/job.sh" >/dev/null 2>&1 </dev/null &',
            'sleep 1',
        ]));

        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }
    }

    /**
     * The state and the end of the log of the background job.
     *
     * @return array{state: string, exit: int|null, label: string|null, started_at: string|null, log: string}
     *
     * @throws MetricsCollectionException
     */
    public function job(Server $server): array
    {
        $result = $this->shell->run($server, 'D='.escapeshellarg(self::JOB_DIR)."\n".<<<'SH'
            echo "###JOB"
            if [ -f "$D/pid" ]; then
                if [ -f "$D/exit" ]; then echo "done $(cat "$D/exit")"; elif kill -0 "$(cat "$D/pid")" 2>/dev/null; then echo running; else echo "done 1"; fi
                echo "###JOBLABEL"; cat "$D/label" 2>/dev/null
                echo "###JOBSTARTED"; stat -c %Y "$D/pid" 2>/dev/null
                echo "###LOG"; tail -c 60000 "$D/log" 2>/dev/null
            fi
            SH);

        $sections = $result->sections();

        return [...$this->jobState($sections), 'log' => trim(mb_convert_encoding($sections['LOG'] ?? '', 'UTF-8', 'UTF-8'))];
    }

    /**
     * Keep packages at their version (hold) or let them be upgraded again.
     *
     * @param  list<string>  $packages
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function hold(Server $server, array $packages, bool $hold): void
    {
        foreach ($packages as $package) {
            if (preg_match(self::PACKAGE_PATTERN, $package) !== 1) {
                throw new RemoteCommandException(__('Unknown package :name.', ['name' => $package]));
            }
        }

        $result = $this->shell->run($server, '$S apt-mark '.($hold ? 'hold' : 'unhold').' '.implode(' ', array_map('escapeshellarg', $packages)));

        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }
    }

    /**
     * Restart the server in a few minutes (so it can still be cancelled), or cancel a planned restart.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function reboot(Server $server, ?int $minutes): void
    {
        $command = $minutes === null
            ? '$S shutdown -c 2>&1'
            : '$S shutdown -r +'.max(1, min(60, $minutes)).' '.escapeshellarg('Restart requested in RackAtlas').' 2>&1';

        $result = $this->shell->run($server, $command);

        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }
    }

    /**
     * `apt list --upgradable`: "openssl/jammy-updates,jammy-security 3.0.2-0ubuntu1.15 amd64 [upgradable from: 3.0.2-0ubuntu1.14]".
     *
     * @return list<array{name: string, sources: list<string>, version: string, current: string|null, arch: string, security: bool}>
     */
    public function packages(string $text): array
    {
        $packages = [];

        foreach (preg_split('/\r\n|\n|\r/', $text) ?: [] as $line) {
            if (preg_match('#^([^/\s]+)/(\S+)\s+(\S+)\s+(\S+)(?:\s+\[upgradable from:\s*([^\]]+)\])?#', trim($line), $match) !== 1) {
                continue;
            }

            $sources = explode(',', $match[2]);

            $packages[] = [
                'name' => $match[1],
                'sources' => $sources,
                'version' => $match[3],
                'current' => isset($match[5]) ? trim($match[5]) : null,
                'arch' => $match[4],
                'security' => collect($sources)->contains(fn (string $source) => str_contains($source, 'security')),
            ];
        }

        usort($packages, fn (array $a, array $b) => [! $a['security'], $a['name']] <=> [! $b['security'], $b['name']]);

        return $packages;
    }

    /**
     * @param  array<string, string>  $sections
     * @return array{state: string, exit: int|null, label: string|null, started_at: string|null}
     */
    private function jobState(array $sections): array
    {
        $state = trim($sections['JOB'] ?? '');
        $started = (int) trim($sections['JOBSTARTED'] ?? '');

        return [
            'state' => $state === 'running' ? 'running' : (str_starts_with($state, 'done') ? 'done' : 'none'),
            'exit' => str_starts_with($state, 'done') ? (int) trim(substr($state, 4)) : null,
            'label' => trim($sections['JOBLABEL'] ?? '') ?: null,
            'started_at' => $started > 0 ? Carbon::createFromTimestamp($started)->toIso8601String() : null,
        ];
    }

    /**
     * /run/systemd/shutdown/scheduled holds USEC= (microseconds) and MODE=.
     */
    private function scheduledShutdown(string $text): ?string
    {
        if (preg_match('/^USEC=(\d+)/m', $text, $match) !== 1) {
            return null;
        }

        return Carbon::createFromTimestamp(intdiv((int) $match[1], 1_000_000))->toIso8601String();
    }
}
