<?php

namespace Tests\Feature\Http\Controllers;

use App\Models\Server;
use App\Models\ServerService;
use App\Models\Team;
use App\Models\User;
use App\Services\Ssh\ServiceSsh;
use App\Services\Ssh\ServiceSync;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class ApplicationTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function agentServer(Team $team): Server
    {
        return $team->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root',
            'auth_type' => 'agent',
        ]);
    }

    private function sshServer(Team $team): Server
    {
        return $team->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root',
            'auth_type' => 'password', 'uses_agent' => true,
        ]);
    }

    public function test_status_tells_running_stopped_disabled_and_failed_apart(): void
    {
        $status = fn (string $active, ?string $file) => (new ServerService(['active_state' => $active, 'unit_file_state' => $file]))->status();

        $this->assertSame('running', $status('active', 'enabled'));
        $this->assertSame('failed', $status('failed', 'enabled'));
        $this->assertSame('stopped', $status('inactive', 'enabled'));
        $this->assertSame('stopped', $status('inactive', 'static'));
        $this->assertSame('disabled', $status('inactive', 'disabled'));
        $this->assertSame('disabled', $status('inactive', 'masked'));
    }

    public function test_sync_replaces_the_list_and_keeps_the_journal_of_a_known_service(): void
    {
        $server = $this->agentServer(Team::factory()->create());
        $sync = app(ServiceSync::class);

        $sync->sync($server, "nginx.service|active|running|enabled|Web server\nold.service|inactive|dead|disabled|Old\n../evil|active|running|enabled|x\n");
        $server->services()->where('unit', 'nginx.service')->update(['journal' => 'kept']);
        $sync->sync($server, "nginx.service|failed|failed|enabled|Web server\n");

        $this->assertSame(['nginx.service'], $server->services()->pluck('unit')->all());
        $nginx = $server->services()->firstOrFail();
        $this->assertSame('failed', $nginx->active_state);
        $this->assertSame('kept', $nginx->journal);
    }

    public function test_an_empty_list_does_not_wipe_the_known_services(): void
    {
        $server = $this->agentServer(Team::factory()->create());
        ServerService::factory()->for($server)->create(['unit' => 'nginx.service']);

        app(ServiceSync::class)->sync($server, "\n");

        $this->assertSame(1, $server->services()->count());
    }

    public function test_page_lists_the_services_of_the_team(): void
    {
        $team = Team::factory()->create();
        $server = $this->agentServer($team);
        ServerService::factory()->for($server)->create(['unit' => 'nginx.service']);
        ServerService::factory()->for($server)->create(['unit' => 'bad.service', 'active_state' => 'failed']);

        $this->actingAs($team->owner)
            ->get(route('applications.index'))
            ->assertInertia(fn ($page) => $page
                ->component('applications/index')
                ->where('servers.0.services.0.unit', 'bad.service')
                ->where('servers.0.services.0.status', 'failed')
                ->where('servers.0.services.1.status', 'running'));
    }

    public function test_ingest_stores_the_services_section(): void
    {
        $server = $this->agentServer(Team::factory()->create());
        $token = $server->issueAgentToken();

        $report = "###CPU1\ncpu  100 0 100 800 0 0 0 0 0 0\n###CPU2\ncpu  150 0 150 900 0 0 0 0 0 0\n###LOAD\n0.1 0.1 0.1 1/1 1\n###CORES\n2\n###MEM\nMemTotal: 1000 kB\nMemAvailable: 500 kB\n###UPTIME\n10\n"
            ."###JOURNAL_CRITICAL\n###JOURNAL_ERROR\n###SERVICES\nssh.service|active|running|disabled|OpenBSD Secure Shell server\ngetty@tty1.service|active|running||Getty on tty1\n###FAILED_UNITS\n";

        $this->call('POST', route('agent.ingest'), [], [], [], ['HTTP_AUTHORIZATION' => 'Bearer '.$token], $report)->assertOk();

        $this->assertEqualsCanonicalizing(['ssh.service', 'getty@tty1.service'], $server->services()->pluck('unit')->all());
    }

    public function test_an_action_runs_over_ssh_at_once(): void
    {
        $team = Team::factory()->create();
        $service = ServerService::factory()->for($this->sshServer($team))->create(['unit' => 'nginx.service']);

        $this->mock(ServiceSsh::class, fn (MockInterface $mock) => $mock
            ->shouldReceive('act')->once()->withArgs(fn ($s, $action) => $s->is($service) && $action === 'restart')->andReturn(null));

        $this->actingAs($team->owner)
            ->post(route('applications.act', [$service, 'restart']))
            ->assertRedirect();

        $this->actingAs($team->owner)
            ->post('/app/applications/'.$service->id.'/delete')
            ->assertNotFound();
    }

    public function test_a_server_without_an_ssh_login_cannot_be_controlled(): void
    {
        $team = Team::factory()->create();
        $service = ServerService::factory()->for($this->agentServer($team))->create();

        $this->mock(ServiceSsh::class, fn (MockInterface $mock) => $mock->shouldNotReceive('act', 'status', 'journal'));

        $this->actingAs($team->owner)->post(route('applications.act', [$service, 'stop']))->assertRedirect();
        $this->actingAs($team->owner)->post(route('applications.status', $service))->assertStatus(422);
        $this->actingAs($team->owner)->post(route('applications.journal', $service))->assertStatus(422);
    }

    public function test_status_and_journal_come_over_ssh_now(): void
    {
        $team = Team::factory()->create();
        $service = ServerService::factory()->for($this->sshServer($team))->create(['unit' => 'nginx.service']);

        $this->mock(ServiceSsh::class, function (MockInterface $mock) {
            $mock->shouldReceive('status')->once()->andReturn('Active: active (running)');
            $mock->shouldReceive('journal')->once()->andReturn('line one');
        });

        $this->actingAs($team->owner)->post(route('applications.status', $service))
            ->assertOk()->assertJsonPath('output', 'Active: active (running)');
        $this->actingAs($team->owner)->post(route('applications.journal', $service))
            ->assertOk()->assertJsonPath('output', 'line one');
    }

    public function test_a_failing_connection_is_reported_as_a_bad_gateway(): void
    {
        $team = Team::factory()->create();
        $service = ServerService::factory()->for($this->sshServer($team))->create();

        $this->mock(ServiceSsh::class, fn (MockInterface $mock) => $mock->shouldReceive('journal')->andThrow(new RuntimeException('Could not connect')));

        $this->actingAs($team->owner)->post(route('applications.journal', $service))
            ->assertStatus(502)->assertJsonPath('message', 'Could not connect');
    }

    public function test_a_member_may_look_but_not_start_or_stop_without_the_edit_level(): void
    {
        $team = Team::factory()->create();
        $service = ServerService::factory()->for($this->sshServer($team))->create();
        $member = User::factory()->create();
        $team->members()->attach($member->id, ['role' => 'member', 'permissions' => null]);

        $this->mock(ServiceSsh::class, function (MockInterface $mock) {
            $mock->shouldReceive('status')->once()->andReturn('ok');
            $mock->shouldNotReceive('act');
        });

        $this->actingAs($member)->post(route('applications.status', $service))->assertOk();
        $this->actingAs($member)->post(route('applications.act', [$service, 'stop']))->assertForbidden();
    }

    public function test_another_team_cannot_reach_the_service(): void
    {
        $service = ServerService::factory()->for($this->sshServer(Team::factory()->create()))->create();
        $stranger = Team::factory()->create()->owner;

        $this->mock(ServiceSsh::class, fn (MockInterface $mock) => $mock->shouldNotReceive('act', 'status', 'journal'));

        $this->actingAs($stranger)->post(route('applications.status', $service))->assertForbidden();
        $this->actingAs($stranger)->post(route('applications.act', [$service, 'stop']))->assertForbidden();
    }

    public function test_the_page_tells_which_servers_can_be_controlled(): void
    {
        $team = Team::factory()->create();
        ServerService::factory()->for($this->sshServer($team))->create();

        $this->actingAs($team->owner)
            ->get(route('applications.index'))
            ->assertInertia(fn ($page) => $page->where('servers.0.ssh', true)->where('canManage', true));
    }
}
