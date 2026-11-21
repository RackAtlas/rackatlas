<?php

namespace App\Notifications\Channels;

use App\Models\FcmToken;
use App\Models\Server;
use App\Models\ServerAlert;
use App\Models\User;
use App\Services\Notifications\FcmClient;
use Illuminate\Notifications\Notification;
use Throwable;

/**
 * Sends a notification to the Android app through Firebase Cloud Messaging. The message has high
 * priority and uses the app's "alerts" channel, so the phone shows it right away with sound even
 * when the screen is off and the app is closed.
 */
class FcmChannel
{
    /** Loud: sound, heads-up, shown on the lock screen. For outages and other critical problems. */
    public const ANDROID_CHANNEL = 'alerts';

    /** Quiet: no heads-up. For high resource use, anomalies and "resolved" messages. */
    public const ANDROID_CHANNEL_QUIET = 'warnings';

    public static function configured(): bool
    {
        return FcmClient::configured();
    }

    /**
     * @param  User  $notifiable
     * @param  Notification&object{toWebPush: callable}  $notification
     */
    public function send(object $notifiable, Notification $notification): void
    {
        try {
            $this->push($notifiable, $notification);
        } catch (Throwable $e) {
            // A failing push service must not fail the whole notification, which would
            // make the queue send the email again.
            report($e);
        }
    }

    /**
     * Push to every phone of the user and say how it went for each one.
     *
     * @param  User  $notifiable
     * @param  Notification&object{toWebPush: callable}  $notification
     * @return array<int, array{device: string|null, host: string, ok: bool, status: int|null, reason: string, body: string}>
     */
    public function push(object $notifiable, Notification $notification): array
    {
        if (! self::configured()) {
            return [];
        }

        $query = $notifiable->fcmTokens();

        if (method_exists($notification, 'webPushDeviceIds')) {
            $query->whereIn('user_device_id', $notification->webPushDeviceIds());
        }

        $tokens = $query->get();

        if ($tokens->isEmpty()) {
            return [];
        }

        $payload = $notification->toWebPush($notifiable);
        $badge = $this->openAlerts($notifiable);
        $client = app(FcmClient::class);
        $results = [];

        /** @var FcmToken $token */
        foreach ($tokens as $token) {
            $answer = $client->send($this->message($token->token, $payload, $badge));

            if ($answer['unregistered']) {
                $token->delete();
            } else {
                $token->forceFill([
                    'last_attempted_at' => now(),
                    'last_used_at' => $answer['ok'] ? now() : $token->last_used_at,
                    'last_error' => $answer['ok'] ? null : mb_substr(trim($answer['status'].' '.$answer['reason']), 0, 300),
                ])->save();
            }

            $results[] = [
                'device' => $token->name,
                'host' => 'fcm.googleapis.com',
                'ok' => $answer['ok'],
                'status' => $answer['status'],
                'reason' => $answer['unregistered'] ? 'Token expired and was removed' : $answer['reason'],
                'body' => '',
            ];
        }

        return $results;
    }

    /**
     * The number on the icon of the app: the problems that are open on the servers of the user's teams.
     */
    private function openAlerts(User $user): int
    {
        return ServerAlert::query()
            ->whereNull('resolved_at')
            ->whereIn('server_id', Server::query()->whereIn('team_id', $user->teams()->select('teams.id'))->select('id'))
            ->count();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function message(string $token, array $payload, int $openAlerts = 0): array
    {
        $tag = (string) ($payload['tag'] ?? 'rackatlas');
        $critical = (bool) ($payload['critical'] ?? true);

        return [
            'token' => $token,
            'notification' => [
                'title' => (string) ($payload['title'] ?? config('app.name')),
                'body' => (string) ($payload['body'] ?? ''),
            ],
            'data' => ['url' => (string) ($payload['url'] ?? '/'), 'tag' => $tag],
            'android' => [
                'priority' => $critical ? 'HIGH' : 'NORMAL',
                'ttl' => '3600s',
                'notification' => [
                    'channel_id' => $critical ? self::ANDROID_CHANNEL : self::ANDROID_CHANNEL_QUIET,
                    'tag' => $tag,
                    'sound' => 'default',
                    'notification_priority' => $critical ? 'PRIORITY_MAX' : 'PRIORITY_DEFAULT',
                    'notification_count' => $openAlerts,
                    'visibility' => 'PUBLIC',
                    'default_vibrate_timings' => true,
                    'default_light_settings' => true,
                ],
            ],
        ];
    }
}
