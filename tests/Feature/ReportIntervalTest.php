<?php

namespace Tests\Feature;

use App\Jobs\CollectServerMetrics;
use App\Models\Server;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ReportIntervalTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function agentServer(int $interval = 60): Server
    {
        return Team::factory()->create()->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root',
            'auth_type' => 'agent', 'report_interval' => $interval,
        ]);
    }

    private function report(): string
    {
        return "###CPU1\ncpu  100 0 100 800 0 0 0 0 0 0\n###CPU2\ncpu  150 0 150 900 0 0 0 0 0 0\n###LOAD\n0.1 0.1 0.1 1/1 1\n###CORES\n2\n###MEM\nMemTotal: 1000 kB\nMemAvailable: 500 kB\n###UPTIME\n10\n";
    }

    public function test_a_new_server_reports_every_minute_by_default(): void
    {
        $server = Team::factory()->create()->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root', 'auth_type' => 'agent',
        ])->refresh();

        $this->assertSame(60, $server->report_interval);
        $this->assertSame(60, $server->reportEvery());
    }

    public function test_the_answer_to_the_agent_carries_the_interval_of_its_server(): void
    {
        $server = $this->agentServer(15);

        $this->call('POST', route('agent.ingest'), [], [], [], ['HTTP_AUTHORIZATION' => 'Bearer '.$server->issueAgentToken()], $this->report())
            ->assertOk()
            ->assertJsonPath('interval', 15);
    }

    public function test_a_server_read_over_ssh_is_never_polled_faster_than_a_minute(): void
    {
        $server = Team::factory()->create()->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root',
            'auth_type' => 'password', 'password' => 'x', 'report_interval' => 10,
        ]);

        $this->assertSame(60, $server->reportEvery());
    }

    public function test_an_unknown_stored_value_falls_back_to_a_minute(): void
    {
        $this->assertSame(60, $this->agentServer(77)->reportEvery());
    }

    public function test_the_offline_limit_grows_with_the_interval(): void
    {
        $this->assertSame(3, $this->agentServer(15)->silentAfterMinutes());
        $this->assertSame(3, $this->agentServer(60)->silentAfterMinutes());
        $this->assertSame(15, $this->agentServer(300)->silentAfterMinutes());
        $this->assertSame(180, $this->agentServer(3600)->silentAfterMinutes());
    }

    public function test_a_slow_reporter_is_not_marked_offline_too_early(): void
    {
        $slow = $this->agentServer(900);
        $fast = $this->agentServer(60);

        foreach ([$slow, $fast] as $server) {
            $server->forceFill(['status' => 'online', 'last_seen_at' => now()->subMinutes(10)])->save();
        }

        $this->artisan('servers:check-agents')->assertSuccessful();

        $this->assertSame('online', $slow->refresh()->status->value);
        $this->assertSame('offline', $fast->refresh()->status->value);
    }

    public function test_the_interval_is_saved_with_the_server_and_only_known_choices_are_accepted(): void
    {
        $team = Team::factory()->create();

        $this->actingAs($team->owner)
            ->post(route('servers.store'), ['name' => 'web', 'auth_type' => 'agent', 'report_interval' => 15])
            ->assertSessionHasNoErrors();

        $this->assertSame(15, $team->servers()->firstOrFail()->report_interval);

        $this->actingAs($team->owner)
            ->post(route('servers.store'), ['name' => 'db', 'auth_type' => 'agent', 'report_interval' => 7])
            ->assertSessionHasErrors('report_interval');
    }

    public function test_a_server_not_yet_due_is_skipped_by_the_ssh_collection(): void
    {
        $team = Team::factory()->create();
        $due = $team->servers()->create(['name' => 'due', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root', 'auth_type' => 'password', 'password' => 'x', 'report_interval' => 300]);
        $due->forceFill(['last_checked_at' => now()->subMinutes(6)])->save();
        $waiting = $team->servers()->create(['name' => 'waiting', 'host' => '8.8.8.9', 'port' => 22, 'username' => 'root', 'auth_type' => 'password', 'password' => 'x', 'report_interval' => 300]);
        $waiting->forceFill(['last_checked_at' => now()->subMinutes(2)])->save();

        Queue::fake();
        $this->artisan('servers:collect-metrics')->expectsOutput('1 jobs queued.')->assertSuccessful();
        Queue::assertPushed(CollectServerMetrics::class, 1);
    }
}
