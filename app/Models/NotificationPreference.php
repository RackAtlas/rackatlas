<?php

namespace App\Models;

use App\Enums\AlertType;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property bool $email_enabled
 * @property bool $push_enabled
 * @property bool $notify_offline
 * @property bool $notify_resources
 * @property bool $notify_services
 * @property bool $notify_logs
 * @property bool $notify_database
 * @property bool $notify_redis
 * @property bool $notify_recovery
 * @property bool $quiet_hours_enabled
 * @property string $quiet_from
 * @property string $quiet_until
 * @property string|null $timezone
 */
#[Fillable([
    'user_id', 'email_enabled', 'push_enabled', 'notify_offline', 'notify_resources',
    'notify_services', 'notify_logs', 'notify_database', 'notify_redis', 'notify_recovery',
    'quiet_hours_enabled', 'quiet_from', 'quiet_until', 'timezone',
])]
class NotificationPreference extends Model
{
    public const FLAGS = [
        'email_enabled', 'push_enabled', 'notify_offline', 'notify_resources',
        'notify_services', 'notify_logs', 'notify_database', 'notify_redis', 'notify_recovery',
    ];

    /** The quiet hours: during this time of the day only critical alerts are pushed to the phone. */
    public const QUIET_FIELDS = ['quiet_hours_enabled', 'quiet_from', 'quiet_until'];

    protected function casts(): array
    {
        return [...array_fill_keys(self::FLAGS, 'boolean'), 'quiet_hours_enabled' => 'boolean'];
    }

    /**
     * Until a user saves their choices everything is on, so nobody misses an outage.
     */
    public static function defaults(): self
    {
        return new self(array_fill_keys(self::FLAGS, true));
    }

    public static function for(User $user): self
    {
        return $user->notificationPreference ?? self::defaults();
    }

    /**
     * Whether it is quiet time for this user right now. The window may cross midnight (22:00 to 07:00).
     */
    public function inQuietHours(?CarbonInterface $now = null): bool
    {
        if (! $this->quiet_hours_enabled) {
            return false;
        }

        $timezone = in_array($this->timezone, timezone_identifiers_list(), true) ? $this->timezone : config('app.timezone');
        $minutes = fn (CarbonInterface $time): int => $time->hour * 60 + $time->minute;
        $parse = fn (string $value): int => (int) substr($value, 0, 2) * 60 + (int) substr($value, 3, 2);

        $current = $minutes(($now ?? now())->copy()->setTimezone($timezone));
        $from = $parse($this->quiet_from);
        $until = $parse($this->quiet_until);

        if ($from === $until) {
            return false;
        }

        return $from < $until
            ? $current >= $from && $current < $until
            : $current >= $from || $current < $until;
    }

    /**
     * Whether this user wants to hear about an alert of the given kind.
     */
    public function wants(AlertType $type, bool $resolved): bool
    {
        return (bool) $this->{$type->preference()} && (! $resolved || $this->notify_recovery);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
