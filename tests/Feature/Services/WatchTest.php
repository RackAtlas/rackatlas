<?php

namespace Tests\Feature\Services;

use App\Enums\AlertType;
use App\Enums\ServerAuthType;
use App\Enums\ServerStatus;
use App\Jobs\ExplainAlert;
use App\Models\Server;
use App\Models\Team;
use App\Services\Alerts\AlertEvaluator;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WatchTest extends TestCase
{
    use LazilyRefreshDatabase;

    /**
     * A server that was calm (CPU 10 %) for a day and whose newest samples use the given CPU.
     */
    private function server(bool $watched, float $nowCpu = 60): Server
    {
        $server = Team::factory()->create()->servers()->create([
            'name' => 'web', 'host' => 'example.com', 'port' => 22, 'username' => 'root',
            'auth_type' => ServerAuthType::Password, 'password' => 'secret', 'watch_enabled' => $watched,
        ]);
        $server->forceFill(['status' => ServerStatus::Online, 'last_seen_at' => now()])->save();

        foreach (range(1, 200) as $minute) {
            $recent = $minute <= 3;
            $server->metrics()->create([
                'collected_at' => now()->subMinutes($minute),
                'cpu_percent' => $recent ? $nowCpu : 10 + ($minute % 3),
                'cpu_cores' => 4, 'load_1' => 0.5, 'load_5' => 0.5, 'load_15' => 0.5,
                'memory_total' => 1000, 'memory_used' => 400, 'swap_total' => 0, 'swap_used' => 0, 'uptime_seconds' => 1000,
            ]);
        }

        return $server;
    }

    /**
     * @return array<int, string>
     */
    private function openKeys(Server $server): array
    {
        app(AlertEvaluator::class)->evaluate($server);

        return $server->alerts()->whereNull('resolved_at')->pluck('key')->sort()->values()->all();
    }

    public function test_a_jump_that_is_unusual_for_the_server_raises_an_anomaly_on_a_watched_server(): void
    {
        Notification::fake();

        $server = $this->server(true);

        $this->assertSame(['anomaly:cpu'], $this->openKeys($server));
        $this->assertSame(AlertType::Anomaly, $server->alerts()->first()->type);
    }

    public function test_a_server_that_is_not_watched_raises_no_anomaly(): void
    {
        Notification::fake();

        $this->assertSame([], $this->openKeys($this->server(false)));
    }

    public function test_normal_wobble_is_not_an_anomaly(): void
    {
        Notification::fake();

        $this->assertSame([], $this->openKeys($this->server(true, 14)));
    }

    public function test_a_server_without_enough_history_is_not_judged(): void
    {
        Notification::fake();

        $server = $this->server(true);
        $server->metrics()->where('collected_at', '<', now()->subMinutes(60))->delete();

        $this->assertSame([], $this->openKeys($server));
    }

    public function test_the_anomaly_closes_when_the_server_calms_down(): void
    {
        Notification::fake();

        $server = $this->server(true);
        $this->openKeys($server);

        $server->metrics()->where('collected_at', '>', now()->subMinutes(4))->update(['cpu_percent' => 11]);

        $this->assertSame([], $this->openKeys($server));
        $this->assertNotNull($server->alerts()->first()->resolved_at);
    }

    public function test_a_disk_that_fills_up_fast_is_reported_before_it_is_full(): void
    {
        Notification::fake();

        $server = $this->server(true, 10);

        // Samples every 3 minutes over 10 hours, the disk grows from 50 % by 0.04 % a sample: about 19 % a day.
        foreach ($server->metrics()->orderBy('collected_at')->get() as $i => $metric) {
            $metric->update(['collected_at' => now()->subMinutes((200 - $i) * 3)]);
            $metric->disks()->create([
                'device' => '/dev/sda1', 'mount' => '/', 'filesystem' => 'ext4',
                'total_bytes' => 100 * 1073741824, 'used_bytes' => (int) ((50 + $i * 0.04) * 1073741824),
            ]);
        }

        $this->assertSame(['forecast:disk:/'], $this->openKeys($server));
    }

    public function test_a_stable_disk_is_not_reported(): void
    {
        Notification::fake();

        $server = $this->server(true, 10);

        foreach ($server->metrics()->get() as $metric) {
            $metric->disks()->create(['device' => '/dev/sda1', 'mount' => '/', 'filesystem' => 'ext4', 'total_bytes' => 100 * 1073741824, 'used_bytes' => 50 * 1073741824]);
        }

        $this->assertSame([], $this->openKeys($server));
    }

    public function test_a_new_alert_on_a_watched_server_is_explained_by_the_local_model(): void
    {
        Notification::fake();
        Queue::fake();
        config(['watch.llm.enabled' => true]);

        $this->openKeys($this->server(true));

        Queue::assertPushed(ExplainAlert::class);
    }

    public function test_nothing_is_sent_to_the_model_when_it_is_switched_off(): void
    {
        Notification::fake();
        Queue::fake();

        $this->openKeys($this->server(true));

        Queue::assertNotPushed(ExplainAlert::class);
    }

    public function test_the_explanation_is_stored_with_the_alert(): void
    {
        Notification::fake();
        config(['watch.llm.enabled' => true, 'watch.llm.url' => 'http://llm.test']);
        Http::fake(['llm.test/api/chat' => Http::response(['message' => ['content' => '<think>x</think>Proces php-fpm zaberá CPU.']])]);

        $server = $this->server(true);
        $this->openKeys($server);

        $alert = $server->alerts()->first();
        $this->assertSame('Proces php-fpm zaberá CPU.', $alert->fresh()->context['summary']);
        Http::assertSent(fn ($request) => $request['model'] === config('watch.llm.model') && $request['stream'] === false);
    }

    public function test_an_unreachable_model_does_not_break_the_alert(): void
    {
        Notification::fake();
        config(['watch.llm.enabled' => true, 'watch.llm.url' => 'http://llm.test']);
        Http::fake(['llm.test/*' => Http::response('down', 500)]);

        $server = $this->server(true);
        $this->openKeys($server);

        $this->assertArrayNotHasKey('summary', $server->alerts()->first()->fresh()->context);
        $this->assertSame(['anomaly:cpu'], $server->alerts()->whereNull('resolved_at')->pluck('key')->all());
    }

    public function test_the_watcher_judges_only_watched_servers(): void
    {
        Notification::fake();

        $watched = $this->server(true);
        $other = $this->server(false);
        $maintenance = $this->server(true);
        $maintenance->update(['in_maintenance' => true]);

        $this->artisan('watch:run', ['--once' => true])->expectsOutput('1 watched servers judged.')->assertSuccessful();

        $this->assertSame(1, $watched->alerts()->count());
        $this->assertSame(0, $other->alerts()->count());
        $this->assertSame(0, $maintenance->alerts()->count());
        $this->assertNotNull(cache('watch:heartbeat'));
    }

    public function test_the_switch_is_saved_with_the_server(): void
    {
        $server = $this->server(false);
        $payload = [
            'name' => 'web', 'host' => 'example.com', 'port' => 22, 'username' => 'root', 'auth_type' => 'password',
            'password' => '', 'watch_enabled' => true,
        ];

        $this->actingAs($server->team->owner)->put(route('servers.update', $server), $payload)->assertRedirect();
        $this->assertTrue($server->fresh()->watch_enabled);

        unset($payload['watch_enabled']);
        $this->actingAs($server->team->owner)->put(route('servers.update', $server), $payload)->assertRedirect();
        $this->assertFalse($server->fresh()->watch_enabled);
    }
}
