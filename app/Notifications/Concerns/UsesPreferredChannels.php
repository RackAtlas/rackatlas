<?php

namespace App\Notifications\Concerns;

use App\Models\NotificationPreference;
use App\Models\User;
use App\Notifications\Channels\FcmChannel;
use App\Notifications\Channels\WebPushChannel;

trait UsesPreferredChannels
{
    /**
     * The channels the user switched on. Mail only goes to a verified address, push only to a
     * user with at least one registered device.
     *
     * @return array<int, string>
     */
    public function via(User $notifiable): array
    {
        $preference = NotificationPreference::for($notifiable);
        $channels = [];

        // In the quiet hours only the critical ones may wake the phone up. Mail is read when the user wants to.
        $pushAllowed = $preference->push_enabled && ($this->isCritical() || ! $preference->inQuietHours());

        if ($preference->email_enabled && $notifiable->hasVerifiedEmail()) {
            $channels[] = 'mail';
        }

        if ($pushAllowed && WebPushChannel::configured() && $notifiable->pushSubscriptions()->exists()) {
            $channels[] = WebPushChannel::class;
        }

        if ($pushAllowed && FcmChannel::configured() && $notifiable->fcmTokens()->exists()) {
            $channels[] = FcmChannel::class;
        }

        return $channels;
    }

    /**
     * A critical notification uses the loud "alerts" channel of the phone and is pushed even in the quiet
     * hours. The others arrive silently and wait for the end of the quiet hours.
     */
    public function isCritical(): bool
    {
        return true;
    }
}
