<?php

namespace App\Models;

use Database\Factories\ServerNetworkSampleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One report of the agent about the network of a server: TCP counters and connections.
 * The traffic of every interface is in {@see ServerNetworkInterface}.
 *
 * @property int $id
 * @property int $server_id
 * @property Carbon $collected_at
 * @property int|null $tcp_established
 * @property int|null $tcp_syn_recv
 * @property int|null $tcp_time_wait
 * @property int|null $tcp_close_wait
 * @property int|null $tcp_listen
 * @property float|null $tcp_in_segs
 * @property float|null $tcp_out_segs
 * @property float|null $tcp_retrans_segs
 * @property float|null $tcp_in_errs
 * @property float|null $tcp_attempt_fails
 * @property float|null $tcp_estab_resets
 * @property float|null $tcp_active_opens
 * @property float|null $tcp_passive_opens
 * @property int|null $conntrack_count
 * @property int|null $conntrack_max
 */
#[Fillable([
    'server_id', 'collected_at', 'tcp_established', 'tcp_syn_recv', 'tcp_time_wait', 'tcp_close_wait', 'tcp_listen',
    'tcp_in_segs', 'tcp_out_segs', 'tcp_retrans_segs', 'tcp_in_errs', 'tcp_attempt_fails', 'tcp_estab_resets',
    'tcp_active_opens', 'tcp_passive_opens', 'conntrack_count', 'conntrack_max',
])]
class ServerNetworkSample extends Model
{
    /** @use HasFactory<ServerNetworkSampleFactory> */
    use HasFactory, Prunable;

    public const RETENTION_DAYS = 30;

    public $timestamps = false;

    protected function casts(): array
    {
        return ['collected_at' => 'datetime'];
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function interfaces(): HasMany
    {
        return $this->hasMany(ServerNetworkInterface::class);
    }

    public function prunable(): Builder
    {
        return static::where('collected_at', '<', now()->subDays(self::RETENTION_DAYS));
    }
}
