<?php

namespace App\Models;

use App\Jobs\ExplainLog;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $server_id
 * @property string $level
 * @property string $source
 * @property string $message
 * @property string|null $ai_summary What the local model found in the entry, empty until it answered
 * @property string|null $ai_model
 * @property int $count
 * @property Carbon $occurred_at
 * @property Carbon|null $resolved_at
 * @property int|null $resolved_by The user who resolved it, null when it was resolved automatically
 */
#[Fillable(['server_id', 'level', 'source', 'message', 'ai_summary', 'ai_model', 'count', 'occurred_at', 'resolved_at', 'resolved_by'])]
class ServerLog extends Model
{
    use Prunable;

    public const RETENTION_DAYS = 14;

    public const LEVELS = ['critical', 'error'];

    public $timestamps = false;

    /**
     * A new entry on a watched server is looked at by the local model.
     */
    protected static function booted(): void
    {
        static::created(function (ServerLog $log): void {
            if (config('watch.llm.enabled') && config('watch.llm.logs') && $log->server?->watch_enabled) {
                ExplainLog::dispatch($log->id)->afterCommit();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    /**
     * Entries nobody has marked as resolved yet.
     *
     * @param  Builder<ServerLog>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereNull('resolved_at');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function prunable(): Builder
    {
        return static::where('occurred_at', '<', now()->subDays(self::RETENTION_DAYS));
    }
}
