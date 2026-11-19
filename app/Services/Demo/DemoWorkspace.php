<?php

namespace App\Services\Demo;

use App\Enums\AlertType;
use App\Enums\DocumentStatus;
use App\Enums\ServerAuthType;
use App\Enums\ServerStatus;
use App\Enums\ServerType;
use App\Models\Backup;
use App\Models\DockerContainer;
use App\Models\Document;
use App\Models\Server;
use App\Models\ServerAlert;
use App\Models\ServerCategory;
use App\Models\ServerLog;
use App\Models\ServerMetric;
use App\Models\ServerService;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The read-only workspace behind the demo button of the home page: one shared demo user with a team of
 * made-up servers. The metrics are generated, so the demo always looks alive. Nothing here talks to a real machine.
 */
class DemoWorkspace
{
    public const EMAIL = 'demo@rackatlas.invalid';

    private const GIB = 1073741824;

    /** How far back the history reaches and how often a point is stored when it is created. */
    private const HISTORY_HOURS = 24;

    private const HISTORY_STEP_MINUTES = 3;

    /**
     * The demo servers: name, provider, country, category, cores, RAM and disk in GiB, typical CPU and RAM use in percent.
     *
     * @var array<int, array<string, mixed>>
     */
    private const SERVERS = [
        ['name' => 'web-01.prod', 'provider' => 'Hetzner', 'country' => 'DE', 'category' => 'Production', 'cores' => 8, 'ram' => 32, 'disk' => 400, 'cpu' => 38, 'mem' => 62, 'docker' => true, 'host' => '203.0.113.11'],
        ['name' => 'web-02.prod', 'provider' => 'Hetzner', 'country' => 'DE', 'category' => 'Production', 'cores' => 8, 'ram' => 32, 'disk' => 400, 'cpu' => 34, 'mem' => 58, 'docker' => true, 'host' => '203.0.113.12'],
        ['name' => 'db-01.prod', 'provider' => 'OVHcloud', 'country' => 'FR', 'category' => 'Production', 'cores' => 16, 'ram' => 64, 'disk' => 1000, 'cpu' => 46, 'mem' => 81, 'docker' => false, 'host' => '203.0.113.21'],
        ['name' => 'worker-01', 'provider' => 'DigitalOcean', 'country' => 'NL', 'category' => 'Production', 'cores' => 4, 'ram' => 16, 'disk' => 200, 'cpu' => 71, 'mem' => 69, 'docker' => true, 'host' => '203.0.113.31'],
        ['name' => 'staging', 'provider' => 'DigitalOcean', 'country' => 'NL', 'category' => 'Staging', 'cores' => 2, 'ram' => 8, 'disk' => 100, 'cpu' => 12, 'mem' => 41, 'docker' => true, 'host' => '203.0.113.41'],
        ['name' => 'backup-01', 'provider' => 'Hetzner', 'country' => 'FI', 'category' => 'Internal', 'cores' => 2, 'ram' => 4, 'disk' => 2000, 'cpu' => 6, 'mem' => 28, 'docker' => false, 'host' => '203.0.113.51'],
    ];

    /**
     * The demo user, with the workspace created or topped up when it is missing or stale.
     */
    public function ensure(): User
    {
        $user = User::query()->where('is_demo', true)->first() ?? $this->createUser();

        $team = $user->teams()->first() ?? $this->createTeam($user);

        $stale = ! ServerMetric::query()
            ->whereIn('server_id', $team->servers()->select('id'))
            ->where('collected_at', '>=', now()->subMinutes(5))
            ->exists();

        if ($stale) {
            $this->refresh($team);
        }

        return $user;
    }

    /**
     * Add the newest metric point to every demo server and keep them online.
     */
    public function refresh(?Team $team = null): void
    {
        $team ??= User::query()->where('is_demo', true)->first()?->teams()->first();

        if ($team === null) {
            return;
        }

        $servers = $team->servers()->get();
        $hasHistory = ServerMetric::query()->whereIn('server_id', $servers->modelKeys())->exists();

        foreach ($servers as $server) {
            $profile = $this->profileOf($server);

            if (! $hasHistory) {
                $from = now()->subHours(self::HISTORY_HOURS);

                for ($at = $from; $at->lt(now()); $at = $at->addMinutes(self::HISTORY_STEP_MINUTES)) {
                    $this->storeMetric($server, $profile, $at);
                }
            } else {
                $latest = ServerMetric::query()->where('server_id', $server->id)->max('collected_at');

                // A long pause (a stopped scheduler) is bridged with sparse points instead of one row per minute.
                $at = Carbon::parse($latest ?? now()->subHour())->addMinutes(self::HISTORY_STEP_MINUTES);
                $at = $at->lt(now()->subHours(self::HISTORY_HOURS)) ? now()->subHours(self::HISTORY_HOURS) : $at;

                for (; $at->lt(now()); $at = $at->addMinutes(self::HISTORY_STEP_MINUTES)) {
                    $this->storeMetric($server, $profile, $at);
                }
            }

            $this->storeMetric($server, $profile, now());

            $server->forceFill([
                'status' => ServerStatus::Online,
                'last_seen_at' => now(),
                'last_checked_at' => now(),
            ])->save();
        }

        $this->refreshBackups($team);
    }

    private function createUser(): User
    {
        $user = User::query()->forceCreate([
            'name' => 'Demo',
            'email' => self::EMAIL,
            'password' => Str::random(64),
            'email_verified_at' => now(),
            'is_admin' => false,
            'is_demo' => true,
            'password_login_enabled' => false,
            'locale' => null,
        ]);

        return $user;
    }

    private function createTeam(User $user): Team
    {
        return DB::transaction(function () use ($user) {
            $team = Team::query()->create(['name' => 'Demo company', 'owner_id' => $user->id]);
            $team->members()->attach($user->id, ['role' => 'owner']);

            $categories = collect(['Production' => '#ef4444', 'Staging' => '#f59e0b', 'Internal' => '#3b82f6'])
                ->map(fn (string $color, string $name) => ServerCategory::query()->create(['team_id' => $team->id, 'name' => $name, 'color' => $color]));

            foreach (self::SERVERS as $spec) {
                $server = new Server([
                    'team_id' => $team->id,
                    'type' => ServerType::Server,
                    'server_category_id' => $categories[$spec['category']]->id,
                    'name' => $spec['name'],
                    'provider' => $spec['provider'],
                    'country' => $spec['country'],
                    'host' => $spec['host'],
                    'port' => 22,
                    'username' => 'root',
                    'auth_type' => ServerAuthType::Agent,
                    'has_docker' => $spec['docker'],
                    'watch_enabled' => false,
                ]);
                $server->forceFill([
                    'status' => ServerStatus::Online,
                    'agent_version' => '1.12.0',
                    'last_seen_at' => now(),
                    'last_checked_at' => now(),
                    'system_info' => [
                        'os' => 'Ubuntu 24.04.1 LTS',
                        'kernel' => '6.8.0-48-generic',
                        'cpu_model' => 'AMD EPYC 7543P',
                        'pending_updates' => $spec['name'] === 'web-02.prod' ? 7 : 0,
                    ],
                ])->save();

                $this->seedDetails($server);
            }

            $this->seedBackups($team);
            $this->seedDocuments($team);

            return $team;
        });
    }

    private function seedDetails(Server $server): void
    {
        $services = [
            ['nginx.service', 'A high performance web server and a reverse proxy server'],
            ['php8.4-fpm.service', 'The PHP 8.4 FastCGI Process Manager'],
            ['cron.service', 'Regular background program processing daemon'],
            ['ssh.service', 'OpenBSD Secure Shell server'],
            ['fail2ban.service', 'Fail2Ban Service'],
        ];

        foreach ($services as [$unit, $description]) {
            ServerService::query()->create([
                'server_id' => $server->id,
                'unit' => $unit,
                'description' => $description,
                'active_state' => 'active',
                'sub_state' => 'running',
                'unit_file_state' => 'enabled',
            ]);
        }

        if ($server->has_docker) {
            foreach ([['app', 'ghcr.io/acme/app:2.14.3', '0.0.0.0:8080->80/tcp'], ['redis', 'redis:7-alpine', '6379/tcp'], ['queue-worker', 'ghcr.io/acme/app:2.14.3', null]] as $index => [$name, $image, $ports]) {
                DockerContainer::query()->create([
                    'server_id' => $server->id,
                    'container_id' => substr(hash('sha256', $server->name.$name), 0, 12),
                    'name' => $name,
                    'image' => $image,
                    'state' => 'running',
                    'status' => 'Up '.(3 + $index * 4).' days (healthy)',
                    'ports' => $ports,
                    'cpu_percent' => 2.5 + $index * 3.1,
                    'memory_bytes' => (180 + $index * 140) * 1048576,
                    'memory_limit_bytes' => 2 * self::GIB,
                    'logs' => "[info] ready to accept connections\n[info] handled 1204 requests in the last minute",
                    'logs_updated_at' => now()->subMinutes(2),
                ]);
            }
        }

        match ($server->name) {
            'worker-01' => $this->seedWorkerProblems($server),
            'web-02.prod' => $this->seedWebProblems($server),
            default => null,
        };
    }

    private function seedWorkerProblems(Server $server): void
    {
        ServerLog::query()->create([
            'server_id' => $server->id,
            'level' => 'error',
            'source' => 'queue-worker',
            'message' => 'SQLSTATE[HY000] [2002] Connection timed out while processing job App\Jobs\SyncInvoices',
            'ai_summary' => 'Probably harmless: a single timeout while the database was busy with the nightly dump. The job was retried and finished a minute later.',
            'ai_model' => 'demo',
            'count' => 3,
            'occurred_at' => now()->subHours(5),
        ]);

        ServerAlert::query()->create([
            'server_id' => $server->id,
            'type' => AlertType::Resource,
            'key' => 'cpu',
            'context' => ['value' => 91, 'threshold' => 90],
            'opened_at' => now()->subMinutes(14),
        ]);
    }

    private function seedWebProblems(Server $server): void
    {
        ServerLog::query()->create([
            'server_id' => $server->id,
            'level' => 'critical',
            'source' => 'kernel',
            'message' => 'Out of memory: Killed process 24811 (php-fpm8.4) total-vm:1893204kB, anon-rss:1204512kB',
            'ai_summary' => 'Needs checking: the kernel stopped a PHP worker because memory ran out. If it repeats, lower pm.max_children or add RAM.',
            'ai_model' => 'demo',
            'count' => 1,
            'occurred_at' => now()->subHours(2),
        ]);
        ServerLog::query()->create([
            'server_id' => $server->id,
            'level' => 'error',
            'source' => 'nginx',
            'message' => 'upstream timed out (110: Connection timed out) while reading response header from upstream',
            'count' => 12,
            'occurred_at' => now()->subHours(9),
            'resolved_at' => now()->subHours(8),
        ]);
    }

    private function seedBackups(Team $team): void
    {
        $servers = $team->servers()->pluck('id', 'name');

        $rows = [
            ['Database dump (nightly)', 'db-01.prod', 24, 4, 'success', 18 * self::GIB],
            ['Uploads to S3', 'web-01.prod', 24, 6, 'success', 42 * self::GIB],
            ['Configuration backup', 'web-02.prod', 24, 30, 'failed', null],
            ['Staging snapshot', 'staging', 168, 50, 'success', 6 * self::GIB],
        ];

        foreach ($rows as [$name, $server, $every, $ago, $status, $size]) {
            Backup::query()->forceCreate([
                'team_id' => $team->id,
                'server_id' => $servers[$server] ?? null,
                'name' => $name,
                'is_active' => true,
                'expected_interval_hours' => $every,
                'last_run_at' => now()->subHours($ago),
                'last_status' => $status,
                'last_message' => $status === 'failed' ? 'rsync: connection unexpectedly closed (code 12)' : 'Finished without errors',
                'last_size_bytes' => $size,
                'alerted_at' => now(),
                'token' => Backup::newToken(),
            ]);
        }
    }

    /** The healthy demo backups report again, so they never turn overdue while the demo is in use. */
    private function refreshBackups(Team $team): void
    {
        Backup::query()
            ->where('team_id', $team->id)
            ->where('last_status', 'success')
            ->where('last_run_at', '<', now()->subHours(20))
            ->get()
            ->each(fn (Backup $backup) => $backup->forceFill(['last_run_at' => now()->subHours(3)])->save());
    }

    private function seedDocuments(Team $team): void
    {
        $server = $team->servers()->where('name', 'db-01.prod')->first();

        Document::query()->create([
            'team_id' => $team->id,
            'server_id' => $server?->id,
            'template' => 'blank',
            'title' => 'Restoring the database from a backup',
            'subject' => 'MySQL',
            'status' => DocumentStatus::Current,
            'fields' => [],
            'sections' => [
                ['title' => 'When to use it', 'body' => 'The production database is corrupted or was deleted by mistake.'],
                ['title' => 'Steps', 'body' => "1. Stop the application workers.\n2. Download the latest dump from the backup bucket.\n3. Restore it with `mysql < dump.sql` and start the workers again."],
            ],
            'reviewed_at' => now()->toDateString(),
        ]);
    }

    /**
     * @return array<string, float|int|string>
     */
    private function profileOf(Server $server): array
    {
        $spec = collect(self::SERVERS)->firstWhere('name', $server->name) ?? self::SERVERS[0];

        return $spec + ['seed' => crc32($server->name)];
    }

    /**
     * @param  array<string, float|int|string>  $profile
     */
    private function storeMetric(Server $server, array $profile, CarbonInterface $at): void
    {
        $seed = (int) $profile['seed'];
        $minutes = $at->timestamp / 60;

        // A slow daily wave, a faster one and a little noise that is the same for the same minute.
        $wave = sin(($minutes / 1440) * 2 * M_PI + $seed % 7) * 0.25 + sin($minutes / 37 + $seed % 5) * 0.1;
        $noise = (crc32($seed.'-'.(int) $minutes) % 1000) / 1000 - 0.5;

        $cpu = max(1.0, min(99.0, $profile['cpu'] * (1 + $wave) + $noise * 6));
        $memTotal = (int) $profile['ram'] * self::GIB;
        $memUsed = (int) ($memTotal * max(0.1, min(0.97, ($profile['mem'] / 100) * (1 + $wave * 0.15) + $noise * 0.01)));
        $cores = (int) $profile['cores'];

        $metric = ServerMetric::query()->create([
            'server_id' => $server->id,
            'collected_at' => $at,
            'cpu_percent' => round($cpu, 2),
            'cpu_cores' => $cores,
            'load_1' => round($cores * $cpu / 100, 2),
            'load_5' => round($cores * $cpu / 100 * 0.95, 2),
            'load_15' => round($cores * $cpu / 100 * 0.9, 2),
            'memory_total' => $memTotal,
            'memory_used' => $memUsed,
            'swap_total' => 2 * self::GIB,
            'swap_used' => (int) (0.03 * 2 * self::GIB),
            'uptime_seconds' => (int) ($at->timestamp - now()->subDays(23)->timestamp),
            'net_rx_bps' => (int) (900000 * (1 + $wave) + abs($noise) * 400000),
            'net_tx_bps' => (int) (2600000 * (1 + $wave) + abs($noise) * 900000),
            'top_processes' => [
                ['php-fpm8.4', 24, round($cpu * 0.5, 1), (int) ($memUsed * 0.28)],
                ['mysqld', 1, round($cpu * 0.25, 1), (int) ($memUsed * 0.35)],
                ['nginx', 9, round($cpu * 0.08, 1), (int) ($memUsed * 0.03)],
                ['redis-server', 1, round($cpu * 0.05, 1), (int) ($memUsed * 0.04)],
            ],
        ]);

        // The disks only grow a little each day and are the same for a whole day.
        $diskTotal = (int) $profile['disk'] * self::GIB;
        $dayShift = ($at->timestamp - now()->subDays(30)->timestamp) / 86400 * 0.002;
        $used = (int) ($diskTotal * min(0.93, ($seed % 30 + 40) / 100 + $dayShift));

        $metric->disks()->create([
            'device' => '/dev/sda1',
            'mount' => '/',
            'filesystem' => 'ext4',
            'total_bytes' => $diskTotal,
            'used_bytes' => $used,
        ]);
    }
}
