<?php

namespace Tests\Feature;

use App\Enums\AlertType;
use App\Enums\ServerStatus;
use App\Models\ApiToken;
use App\Models\FcmToken;
use App\Models\NotificationPreference;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use App\Notifications\Channels\FcmChannel;
use App\Notifications\ServerAlertNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class MobileSupportTest extends TestCase
{
    use RefreshDatabase;

    private function server(Team $team, string $name, ServerStatus $status): Server
    {
        $server = $team->servers()->create([
            'name' => $name, 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root', 'auth_type' => 'agent',
        ]);
        $server->forceFill(['status' => $status])->save();

        return $server;
    }

    public function test_the_widget_endpoint_sums_up_the_team(): void
    {
        $team = Team::factory()->create();
        $this->server($team, 'ok', ServerStatus::Online);
        $slow = $this->server($team, 'slow', ServerStatus::Online);
        $down = $this->server($team, 'down', ServerStatus::Offline);
        $slow->alerts()->create(['type' => AlertType::Resource, 'key' => 'cpu', 'opened_at' => now()]);
        $down->alerts()->create(['type' => AlertType::Offline, 'key' => 'offline', 'opened_at' => now()]);
        [, $plain] = ApiToken::issue($team, $team->owner, 'Widget', [ApiToken::SCOPE_SERVERS]);

        $this->withToken($plain)->getJson('/api/v1/widget')
            ->assertOk()
            ->assertJsonPath('servers', ['total' => 3, 'online' => 1, 'problems' => 1, 'offline' => 1])
            ->assertJsonPath('alerts.open', 2)
            ->assertJsonCount(2, 'alerts.items');
    }

    public function test_the_widget_endpoint_needs_the_servers_scope(): void
    {
        $team = Team::factory()->create();
        [, $plain] = ApiToken::issue($team, $team->owner, 'Backups only', [ApiToken::SCOPE_BACKUPS]);

        $this->withToken($plain)->getJson('/api/v1/widget')->assertForbidden();
    }

    public function test_the_app_gets_a_widget_key_and_a_new_one_replaces_the_old_one(): void
    {
        $team = Team::factory()->create();
        $user = $team->owner;

        $first = $this->actingAs($user)->withHeader('User-Agent', 'RackAtlasApp')
            ->postJson(route('widget-token.store'))->assertCreated()->json('token');
        $second = $this->actingAs($user)->withHeader('User-Agent', 'RackAtlasApp')
            ->postJson(route('widget-token.store'))->assertCreated()->json('token');

        $this->assertNotSame($first, $second);
        $this->assertSame(1, $team->apiTokens()->where('name', 'Android widget')->count());
        $this->assertNull(ApiToken::findByPlainToken($first));
    }

    public function test_the_website_cannot_ask_for_a_widget_key(): void
    {
        $team = Team::factory()->create();

        $this->actingAs($team->owner)->postJson(route('widget-token.store'))->assertForbidden();
    }

    public function test_quiet_hours_cross_midnight_and_use_the_timezone_of_the_user(): void
    {
        $preference = new NotificationPreference([
            'quiet_hours_enabled' => true, 'quiet_from' => '22:00', 'quiet_until' => '07:00', 'timezone' => 'Europe/Bratislava',
        ]);

        // 21:30 UTC in November is 22:30 in Bratislava.
        $this->assertTrue($preference->inQuietHours(Carbon::parse('2026-11-21 21:30:00', 'UTC')));
        $this->assertFalse($preference->inQuietHours(Carbon::parse('2026-11-21 12:00:00', 'UTC')));

        $preference->quiet_hours_enabled = false;
        $this->assertFalse($preference->inQuietHours(Carbon::parse('2026-11-21 21:30:00', 'UTC')));
    }

    public function test_only_critical_alerts_are_pushed_in_the_quiet_hours(): void
    {
        openssl_pkey_export(openssl_pkey_new(['private_key_bits' => 2048]), $privateKey);
        config(['services.fcm.credentials_json' => json_encode([
            'project_id' => 'rackatlas-test',
            'client_email' => 'push@rackatlas-test.iam.gserviceaccount.com',
            'private_key' => $privateKey,
        ])]);

        $user = User::factory()->create();
        $user->fcmTokens()->create(['token' => 'abc', 'token_hash' => FcmToken::hashToken('abc')]);
        $user->notificationPreference()->create([
            ...array_fill_keys(NotificationPreference::FLAGS, true),
            'quiet_hours_enabled' => true, 'quiet_from' => '00:00', 'quiet_until' => '23:59', 'timezone' => 'UTC',
        ]);

        $outage = new ServerAlertNotification('web', AlertType::Offline, 'offline', []);
        $cpu = new ServerAlertNotification('web', AlertType::Resource, 'cpu', []);
        $recovered = new ServerAlertNotification('web', AlertType::Offline, 'offline', [], resolved: true);

        $this->assertContains(FcmChannel::class, $outage->via($user));
        $this->assertNotContains(FcmChannel::class, $cpu->via($user));
        $this->assertNotContains(FcmChannel::class, $recovered->via($user));
        $this->assertTrue($outage->toWebPush($user)['critical']);
        $this->assertFalse($cpu->toWebPush($user)['critical']);
    }

    public function test_a_quiet_alert_uses_the_quiet_channel_and_the_badge_counts_open_problems(): void
    {
        $channel = new FcmChannel;

        $loud = $channel->message('token', ['title' => 'x', 'critical' => true], 3);
        $quiet = $channel->message('token', ['title' => 'x', 'critical' => false], 3);

        $this->assertSame('alerts', $loud['android']['notification']['channel_id']);
        $this->assertSame('warnings', $quiet['android']['notification']['channel_id']);
        $this->assertSame('NORMAL', $quiet['android']['priority']);
        $this->assertSame(3, $quiet['android']['notification']['notification_count']);
    }

    public function test_the_quiet_hours_can_be_saved(): void
    {
        $user = User::factory()->create();
        $flags = array_fill_keys(NotificationPreference::FLAGS, true);

        $this->actingAs($user)->put(route('notifications.update'), [
            ...$flags,
            'quiet_hours_enabled' => true, 'quiet_from' => '23:00', 'quiet_until' => '06:30', 'timezone' => 'Europe/Prague',
        ])->assertSessionHasNoErrors();

        $this->assertSame('06:30', $user->fresh()->notificationPreference->quiet_until);
        $this->actingAs($user)->put(route('notifications.update'), [
            ...$flags, 'quiet_hours_enabled' => true, 'quiet_from' => '25:00', 'quiet_until' => '06:30',
        ])->assertSessionHasErrors('quiet_from');
    }
}
