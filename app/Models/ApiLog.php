<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One request to the API: the external API of a team (`v1`) or a report of an agent (`agent`, failures only).
 *
 * @property int $id
 * @property string $source
 * @property int|null $api_token_id
 * @property int|null $server_id
 * @property int|null $team_id
 * @property string $method
 * @property string $path
 * @property int $status
 * @property int $duration_ms
 * @property string|null $ip
 * @property string|null $user_agent
 * @property string|null $error
 * @property Carbon $created_at
 */
#[Fillable(['source', 'api_token_id', 'server_id', 'team_id', 'method', 'path', 'status', 'duration_ms', 'ip', 'user_agent', 'error'])]
class ApiLog extends Model
{
    use HasFactory;
    use Prunable;

    public const RETENTION_DAYS = 30;

    public const SOURCES = ['v1', 'agent'];

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function token(): BelongsTo
    {
        return $this->belongsTo(ApiToken::class, 'api_token_id');
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function prunable(): Builder
    {
        return static::where('created_at', '<', now()->subDays(self::RETENTION_DAYS));
    }
}
