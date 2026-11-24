<?php

namespace Tests\Feature;

use App\Models\DockerContainer;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use App\Services\Docker\DockerSsh;
use App\Services\Docker\DockerSync;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class DockerTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function agentServer(Team $team, bool $docker = true): Server
    {
        return $team->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root',
            'auth_type' => 'agent', 'has_docker' => $docker,
        ]);
    }

    private function sshServer(Team $team): Server
    {
        return $team->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root',
            'auth_type' => 'password', 'has_docker' => true,
        ]);
    }

    private function report(string $extra = ''): string
    {
        return "###CPU1\ncpu  100 0 100 800 0 0 0 0 0 0\n###CPU2\ncpu  150 0 150 900 0 0 0 0 0 0\n###LOAD\n0.1 0.1 0.1 1/1 1\n###CORES\n2\n###MEM\nMemTotal: 1000 kB\nMemAvailable: 500 kB\n###UPTIME\n10\n".$extra;
    }

    public function test_the_docker_switch_is_saved_with_a_server(): void
    {
        $team = Team::factory()->create();

        $this->actingAs($team->owner)
            ->post(route('servers.store'), ['name' => 'web', 'auth_type' => 'agent', 'has_docker' => true])
            ->assertSessionHasNoErrors();

        $server = $team->servers()->firstOrFail();
        $this->assertTrue($server->has_docker);

        $this->actingAs($team->owner)
            ->put(route('servers.update', $server), ['name' => 'web', 'auth_type' => 'agent'])
            ->assertSessionHasNoErrors();

        $this->assertFalse($server->fresh()->has_docker);
    }

    public function test_sync_reads_containers_with_their_use_of_resources(): void
    {
        $server = $this->agentServer(Team::factory()->create());

        app(DockerSync::class)->sync($server, [
            'DOCKER' => "abcdef123456|web|nginx:1|running|Up 2 hours (healthy)|0.0.0.0:80->80/tcp, :::80->80/tcp\n123456abcdef|job|alpine|exited|Exited (0) 1 hour ago|\nnot an id|x|x|running|x|\n",
            'DOCKER_STATS' => "abcdef123456|1.50%|12.5MiB / 1GiB\n",
        ]);

        $web = $server->dockerContainers()->where('name', 'web')->firstOrFail();
        $this->assertSame('running', $web->state);
        $this->assertSame(1.5, $web->cpu_percent);
        $this->assertSame(13107200, $web->memory_bytes);
        $this->assertSame(1073741824, $web->memory_limit_bytes);
        $this->assertSame(2, $server->dockerContainers()->count());
        $this->assertNull($server->fresh()->docker_error);
    }

    public function test_sync_removes_containers_that_are_gone_and_keeps_all_on_an_error(): void
    {
        $server = $this->agentServer(Team::factory()->create());
        DockerContainer::factory()->for($server)->create(['container_id' => 'aaaaaaaaaaaa']);
        DockerContainer::factory()->for($server)->create(['container_id' => 'bbbbbbbbbbbb']);

        app(DockerSync::class)->sync($server, ['DOCKER_ERROR' => "permission denied while trying to connect\n"]);

        $this->assertSame(2, $server->dockerContainers()->count());
        $this->assertStringContainsString('permission denied', $server->fresh()->docker_error);

        app(DockerSync::class)->sync($server, ['DOCKER' => "aaaaaaaaaaaa|web|nginx|running|Up|\n"]);

        $this->assertSame(['aaaaaaaaaaaa'], $server->dockerContainers()->pluck('container_id')->all());
        $this->assertNull($server->fresh()->docker_error);
    }

    public function test_the_agent_report_is_stored_only_when_docker_is_switched_on(): void
    {
        $team = Team::factory()->create();
        $on = $this->agentServer($team);
        $off = $this->agentServer($team, false);

        foreach ([$on, $off] as $server) {
            $this->call('POST', route('agent.ingest'), [], [], [], ['HTTP_AUTHORIZATION' => 'Bearer '.$server->issueAgentToken()], $this->report("###DOCKER\nabcdef123456|web|nginx|running|Up|\n"))->assertOk();
        }

        $this->assertSame(1, $on->dockerContainers()->count());
        $this->assertSame(0, $off->dockerContainers()->count());
    }

    public function test_the_agent_is_told_whether_docker_is_on_and_gets_nothing_to_do(): void
    {
        $server = $this->agentServer(Team::factory()->create());
        $token = $server->issueAgentToken();
        DockerContainer::factory()->for($server)->create([
            'container_id' => 'abcdef123456',
            'logs_requested_at' => now(),
        ]);
        $ingest = fn () => $this->call('POST', route('agent.ingest'), [], [], [], ['HTTP_AUTHORIZATION' => 'Bearer '.$token], $this->report());

        $ingest()->assertOk()->assertExactJson(['ok' => true, 'docker' => true]);

        $server->update(['has_docker' => false]);
        $ingest()->assertOk()->assertExactJson(['ok' => true, 'docker' => false]);
    }

    public function test_a_failure_the_agent_reports_is_shown_on_the_container(): void
    {
        $server = $this->agentServer(Team::factory()->create());
        DockerContainer::factory()->for($server)->create(['container_id' => 'abcdef123456']);

        app(DockerSync::class)->sync($server, [
            'DOCKER' => "abcdef123456|web|nginx|exited|Exited (1)|\n",
            'DOCKER_RESULT' => "abcdef123456|start|fail|Error response from daemon: port is already allocated\n",
        ]);

        $container = $server->dockerContainers()->firstOrFail();
        $this->assertStringContainsString('port is already allocated', $container->action_result);
    }

    public function test_page_lists_the_containers_of_servers_with_docker(): void
    {
        $team = Team::factory()->create();
        $server = $this->agentServer($team);
        DockerContainer::factory()->for($server)->create(['name' => 'web']);
        DockerContainer::factory()->for($this->agentServer($team, false))->create(['name' => 'hidden']);

        $this->actingAs($team->owner)
            ->get(route('docker.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('docker/index')
                ->has('servers', 1)
                ->where('servers.0.containers.0.name', 'web'));
    }

    public function test_an_action_runs_over_ssh_at_once(): void
    {
        $team = Team::factory()->create();
        $container = DockerContainer::factory()->for($this->sshServer($team))->create();

        $this->mock(DockerSsh::class, function (MockInterface $mock) use ($container) {
            $mock->shouldReceive('act')->once()->withArgs(fn ($c, $action) => $c->is($container) && $action === 'restart')->andReturn(null);
            $mock->shouldReceive('collect')->once();
        });

        $this->actingAs($team->owner)
            ->post(route('docker.containers.act', [$container, 'restart']))
            ->assertRedirect();

        $this->assertNull($container->fresh()->action_result);

        $this->actingAs($team->owner)
            ->post('/app/docker/containers/'.$container->id.'/delete')
            ->assertNotFound();
    }

    public function test_a_failed_action_is_kept_on_the_container(): void
    {
        $team = Team::factory()->create();
        $container = DockerContainer::factory()->for($this->sshServer($team))->create();

        $this->mock(DockerSsh::class, function (MockInterface $mock) {
            $mock->shouldReceive('act')->once()->andReturn('port is already allocated');
            $mock->shouldReceive('collect')->once();
        });

        $this->actingAs($team->owner)->post(route('docker.containers.act', [$container, 'start']))->assertRedirect();

        $this->assertSame('port is already allocated', $container->fresh()->action_result);
    }

    public function test_a_server_without_an_ssh_login_cannot_be_controlled(): void
    {
        $team = Team::factory()->create();
        $container = DockerContainer::factory()->for($this->agentServer($team))->create();

        $this->mock(DockerSsh::class, fn (MockInterface $mock) => $mock->shouldNotReceive('act'));

        $this->actingAs($team->owner)->post(route('docker.containers.act', [$container, 'stop']))->assertRedirect();
        $this->actingAs($team->owner)->post(route('docker.containers.logs', $container))->assertStatus(422);
    }

    public function test_the_log_is_fetched_over_ssh_now(): void
    {
        $team = Team::factory()->create();
        $container = DockerContainer::factory()->for($this->sshServer($team))->create();

        $this->mock(DockerSsh::class, fn (MockInterface $mock) => $mock->shouldReceive('logs')->once()->andReturn('line one'));

        $this->actingAs($team->owner)
            ->post(route('docker.containers.logs', $container))
            ->assertOk()
            ->assertJsonPath('logs', 'line one');

        $this->assertSame('line one', $container->fresh()->logs);
    }

    public function test_a_member_may_look_but_not_start_or_stop_without_the_edit_level(): void
    {
        $team = Team::factory()->create();
        $container = DockerContainer::factory()->for($this->sshServer($team))->create();
        $member = User::factory()->create();
        $team->members()->attach($member->id, ['role' => 'member', 'permissions' => null]);

        $this->mock(DockerSsh::class, function (MockInterface $mock) {
            $mock->shouldReceive('logs')->once()->andReturn('x');
            $mock->shouldNotReceive('act');
        });

        $this->actingAs($member)->get(route('docker.index'))->assertOk();
        $this->actingAs($member)->post(route('docker.containers.logs', $container))->assertOk();
        $this->actingAs($member)->post(route('docker.containers.act', [$container, 'stop']))->assertForbidden();
    }

    public function test_another_team_cannot_reach_the_container(): void
    {
        $container = DockerContainer::factory()->for($this->sshServer(Team::factory()->create()))->create();
        $stranger = Team::factory()->create()->owner;

        $this->mock(DockerSsh::class, fn (MockInterface $mock) => $mock->shouldNotReceive('logs', 'act'));

        $this->actingAs($stranger)->post(route('docker.containers.logs', $container))->assertForbidden();
        $this->actingAs($stranger)->post(route('docker.containers.act', [$container, 'stop']))->assertForbidden();
    }
}
