<?php

namespace Tests\Feature;

use App\Models\Server;
use App\Models\Team;
use App\Services\Scheduler\CrontabParser;
use App\Services\Ssh\RemoteShell;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Spatie\Activitylog\Models\Activity;
use Tests\Feature\Services\Ssh\FakeRemoteShell;
use Tests\TestCase;

class CronTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const CRONTAB = <<<'TXT'
        MAILTO=ops@example.com
        # Nightly backup
        0 3 * * * /usr/local/bin/backup.sh
        #RA-OFF */5 * * * * php /var/www/app/artisan queue:work --once
        # just a note

        @reboot /usr/local/bin/warmup
        TXT;

    private FakeRemoteShell $shell;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shell = new FakeRemoteShell;
        $this->app->instance(RemoteShell::class, $this->shell);
    }

    private function sshServer(Team $team): Server
    {
        return $team->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root',
            'auth_type' => 'password', 'password' => 'secret',
        ]);
    }

    public function test_the_overview_reads_crontabs_system_files_and_timers(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->shell->answer('###CRONTAB', implode("\n", [
            '###WHO', 'root',
            '###ME', 'root',
            '###TZ', 'Europe/Bratislava',
            '###DAEMON', 'active',
            '###CRONTAB root', self::CRONTAB,
            '###CRONTAB deploy',
            '###SYSTEM /etc/crontab', '17 * * * * root cd / && run-parts --report /etc/cron.hourly',
            '###PERIODIC', "daily\t/etc/cron.daily/logrotate",
            '###TIMER logrotate.timer',
            'Description=Daily rotation of log files',
            'ActiveState=active',
            'UnitFileState=enabled',
            'NextElapseUSecRealtime=Thu 2026-11-26 00:00:00 UTC',
            'LastTriggerUSec=Wed 2026-11-25 00:00:01 UTC',
            'Unit=logrotate.service',
            'TimersCalendar={ OnCalendar=daily ; next_elapse=Thu 2026-11-26 00:00:00 UTC }',
            'Persistent=yes',
            'ServiceResult=exit-code',
            'ServiceExecMainStatus=1',
            'ServiceActiveState=failed',
            '###END',
        ]));

        $response = $this->actingAs($team->owner)->postJson(route('cron.show', $server))->assertOk();

        $response->assertJsonPath('timezone', 'Europe/Bratislava')
            ->assertJsonPath('daemon', true)
            ->assertJsonPath('crontabs.0.user', 'root')
            ->assertJsonPath('crontabs.0.variables.MAILTO', 'ops@example.com')
            ->assertJsonCount(3, 'crontabs.0.jobs')
            ->assertJsonPath('crontabs.0.jobs.0.label', 'Nightly backup')
            ->assertJsonPath('crontabs.0.jobs.0.schedule', '0 3 * * *')
            ->assertJsonPath('crontabs.0.jobs.1.enabled', false)
            ->assertJsonPath('crontabs.0.jobs.1.command', 'php /var/www/app/artisan queue:work --once')
            ->assertJsonPath('crontabs.0.jobs.2.schedule', '@reboot')
            ->assertJsonPath('crontabs.0.jobs.2.label', null)
            ->assertJsonPath('crontabs.1.user', 'deploy')
            ->assertJsonPath('system.0.jobs.0.user', 'root')
            ->assertJsonPath('periodic.0.name', 'logrotate')
            ->assertJsonPath('timers.0.name', 'logrotate.timer')
            ->assertJsonPath('timers.0.schedule', 'OnCalendar=daily')
            ->assertJsonPath('timers.0.result', 'exit-code')
            ->assertJsonPath('timers.0.exit_status', 1)
            ->assertJsonPath('timers.0.persistent', true);

        $this->assertCount(3, $response->json('crontabs.0.jobs.0.next'));
    }

    public function test_a_job_is_added_with_its_name_and_the_rest_of_the_crontab_is_kept(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->shell->answer('$C -l', self::CRONTAB."\n");

        $this->actingAs($team->owner)
            ->postJson(route('cron.jobs.store', $server), [
                'user' => 'root', 'schedule' => '*/10 * * * *', 'command' => 'curl -fsS https://example.com/ping', 'label' => 'Ping',
            ])
            ->assertOk();

        $written = $this->shell->written('crontab');
        $this->assertNotNull($written);
        $this->assertStringStartsWith(self::CRONTAB, $written);
        $this->assertStringEndsWith("\n# Ping\n*/10 * * * * curl -fsS https://example.com/ping\n", $written);
        $this->assertTrue(Activity::query()->where('event', 'cron-job-added')->exists());
    }

    public function test_a_job_is_switched_off_and_on_with_a_marker(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $parser = new CrontabParser;
        $this->shell->answer('$C -l', self::CRONTAB."\n");

        $line = 2;
        $hash = $parser->hash($parser->lines(self::CRONTAB)[$line]);

        $this->actingAs($team->owner)
            ->putJson(route('cron.jobs.toggle', $server), ['user' => 'root', 'line' => $line, 'hash' => $hash, 'enabled' => false])
            ->assertOk();

        $this->assertStringContainsString("\n#RA-OFF 0 3 * * * /usr/local/bin/backup.sh\n", (string) $this->shell->written('crontab'));
    }

    public function test_deleting_removes_the_name_above_the_job_too(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $parser = new CrontabParser;
        $this->shell->answer('$C -l', self::CRONTAB."\n");

        $hash = $parser->hash('0 3 * * * /usr/local/bin/backup.sh');

        $this->actingAs($team->owner)
            ->deleteJson(route('cron.jobs.destroy', $server), ['user' => 'root', 'line' => 2, 'hash' => $hash])
            ->assertOk();

        $written = (string) $this->shell->written('crontab');
        $this->assertStringNotContainsString('backup.sh', $written);
        $this->assertStringNotContainsString('Nightly backup', $written);
        $this->assertStringContainsString('MAILTO=ops@example.com', $written);
    }

    public function test_a_change_to_a_line_that_changed_on_the_server_is_refused(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->shell->answer('$C -l', self::CRONTAB."\n");

        $this->actingAs($team->owner)
            ->putJson(route('cron.jobs.update', $server), [
                'user' => 'root', 'line' => 2, 'hash' => str_repeat('0', 16),
                'schedule' => '0 4 * * *', 'command' => '/usr/local/bin/backup.sh',
            ])
            ->assertStatus(409);

        $this->assertNull($this->shell->written('crontab'));
    }

    public function test_invalid_schedules_and_users_are_refused(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($team->owner)
            ->postJson(route('cron.jobs.store', $server), ['user' => 'root', 'schedule' => '61 * * * *', 'command' => 'true'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('schedule');

        $this->actingAs($team->owner)
            ->postJson(route('cron.jobs.store', $server), ['user' => 'root; rm -rf /', 'schedule' => '@daily', 'command' => 'true'])
            ->assertJsonValidationErrors('user');

        $this->actingAs($team->owner)
            ->postJson(route('cron.jobs.store', $server), ['user' => 'root', 'schedule' => '@daily', 'command' => "true\n* * * * * evil"])
            ->assertJsonValidationErrors('command');

        $this->assertSame([], $this->shell->scripts);
    }

    public function test_the_preview_lists_the_next_runs(): void
    {
        $team = Team::factory()->create();

        $this->actingAs($team->owner)
            ->postJson(route('cron.preview'), ['schedule' => '30 2 * * 1', 'timezone' => 'Europe/Bratislava'])
            ->assertOk()
            ->assertJsonPath('valid', true)
            ->assertJsonCount(5, 'next');

        $this->actingAs($team->owner)
            ->postJson(route('cron.preview'), ['schedule' => 'every day'])
            ->assertJsonPath('valid', false);
    }

    public function test_a_timer_is_run_and_unknown_names_are_refused(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($team->owner)
            ->postJson(route('cron.timers.act', ['server' => $server, 'action' => 'run']), ['timer' => 'certbot.timer'])
            ->assertOk();

        $this->assertTrue($this->shell->ran("T='certbot.timer'"));
        $this->assertTrue($this->shell->ran('systemctl start --no-block'));

        $this->actingAs($team->owner)
            ->postJson(route('cron.timers.act', ['server' => $server, 'action' => 'run']), ['timer' => 'evil;reboot.timer'])
            ->assertUnprocessable();
    }

    public function test_the_parser_reads_system_crontabs_with_a_user_column(): void
    {
        $parser = new CrontabParser;
        $jobs = $parser->jobs("SHELL=/bin/sh\n*/5 * * * * www-data php /var/www/cron.php\n@daily root /usr/bin/cleanup\nbroken line\n", true);

        $this->assertCount(2, $jobs);
        $this->assertSame('www-data', $jobs[0]['user']);
        $this->assertSame('php /var/www/cron.php', $jobs[0]['command']);
        $this->assertSame('@daily', $jobs[1]['schedule']);
        $this->assertSame('root', $jobs[1]['user']);
    }
}
