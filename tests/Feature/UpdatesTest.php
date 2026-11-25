<?php

namespace Tests\Feature;

use App\Models\Server;
use App\Models\Team;
use App\Services\Ssh\RemoteShell;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\Feature\Services\Ssh\FakeRemoteShell;
use Tests\TestCase;

class UpdatesTest extends TestCase
{
    use LazilyRefreshDatabase;

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

    private function overview(): string
    {
        return implode("\n", [
            '###WHO', 'root',
            '###APT', 'yes',
            '###OS', 'Ubuntu 24.04.1 LTS',
            '###KERNEL', '6.8.0-45-generic',
            '###UPTIME', '86400.12',
            '###UPGRADABLE',
            'curl/noble-updates 8.5.0-2ubuntu10.5 amd64 [upgradable from: 8.5.0-2ubuntu10.4]',
            'openssl/noble-updates,noble-security 3.0.13-0ubuntu3.4 amd64 [upgradable from: 3.0.13-0ubuntu3.3]',
            'linux-image-generic/noble-security 6.8.0.48.48 amd64 [upgradable from: 6.8.0.45.45]',
            '###HELD', 'linux-image-generic',
            '###REBOOT', 'yes', 'linux-base',
            '###SHUTDOWN',
            '###REFRESHED', '1732500000',
            '###UNATTENDED', 'installed', 'APT::Periodic::Unattended-Upgrade "1";',
            '###JOB',
        ]);
    }

    public function test_the_overview_lists_security_updates_first(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->shell->answer('###UPGRADABLE', $this->overview());

        $this->actingAs($team->owner)
            ->postJson(route('updates.show', $server))
            ->assertOk()
            ->assertJsonPath('os', 'Ubuntu 24.04.1 LTS')
            ->assertJsonPath('uptime_seconds', 86400)
            ->assertJsonCount(3, 'packages')
            ->assertJsonPath('packages.0.name', 'linux-image-generic')
            ->assertJsonPath('packages.0.held', true)
            ->assertJsonPath('packages.1.name', 'openssl')
            ->assertJsonPath('packages.1.current', '3.0.13-0ubuntu3.3')
            ->assertJsonPath('packages.2.security', false)
            ->assertJsonPath('security_count', 2)
            ->assertJsonPath('reboot_required', true)
            ->assertJsonPath('reboot_packages', ['linux-base'])
            ->assertJsonPath('unattended.enabled', true)
            ->assertJsonPath('job.state', 'none');
    }

    public function test_security_updates_install_only_the_security_packages_that_are_not_held(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->shell->answer('###UPGRADABLE', $this->overview());

        $this->actingAs($team->owner)
            ->postJson(route('updates.start', $server), ['job' => 'security'])
            ->assertOk();

        $job = (string) $this->shell->written('/var/tmp/rackatlas-apt/job.sh');
        $this->assertStringContainsString("install --only-upgrade 'openssl'", $job);
        $this->assertStringNotContainsString('linux-image-generic', $job);
        $this->assertStringNotContainsString('curl', $job);
        $this->assertTrue($this->shell->ran('setsid nohup sh "$D/job.sh"'));
    }

    public function test_a_second_job_is_refused_while_one_runs(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->shell->answer('Another update job is still running.', '', 16, 'Another update job is still running.');

        $this->actingAs($team->owner)
            ->postJson(route('updates.start', $server), ['job' => 'upgrade'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Another update job is still running.');
    }

    public function test_package_names_are_checked(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($team->owner)
            ->postJson(route('updates.start', $server), ['job' => 'packages', 'packages' => ['curl; reboot']])
            ->assertJsonValidationErrors('packages.0');

        $this->actingAs($team->owner)
            ->putJson(route('updates.hold', $server), ['packages' => ['nginx', 'libssl3:amd64'], 'hold' => true])
            ->assertOk();

        $this->assertTrue($this->shell->ran("\$S apt-mark hold 'nginx' 'libssl3:amd64'"));
    }

    public function test_a_restart_is_planned_and_can_be_cancelled(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($team->owner)->postJson(route('updates.reboot', $server), ['minutes' => 5])->assertOk();
        $this->assertTrue($this->shell->ran('$S shutdown -r +5'));

        $this->actingAs($team->owner)->postJson(route('updates.reboot', $server), ['cancel' => true])->assertOk();
        $this->assertTrue($this->shell->ran('$S shutdown -c'));

        $this->actingAs($team->owner)->postJson(route('updates.reboot', $server), ['minutes' => 500])->assertUnprocessable();
    }

    public function test_the_log_of_a_running_job_is_followed(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->shell->answer('###LOG', "###JOB\nrunning\n###JOBLABEL\nUpgrade all packages\n###JOBSTARTED\n1732500000\n###LOG\nUnpacking openssl ...");

        $this->actingAs($team->owner)
            ->postJson(route('updates.job', $server))
            ->assertOk()
            ->assertJsonPath('state', 'running')
            ->assertJsonPath('label', 'Upgrade all packages')
            ->assertJsonPath('log', 'Unpacking openssl ...');
    }
}
