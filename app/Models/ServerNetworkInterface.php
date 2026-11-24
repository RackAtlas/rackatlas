<?php

namespace App\Models;

use Database\Factories\ServerNetworkInterfaceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $server_network_sample_id
 * @property string $name
 * @property int $rx_bps
 * @property int $tx_bps
 * @property int $rx_pps
 * @property int $tx_pps
 * @property float $errors
 * @property float $drops
 */
#[Fillable(['server_network_sample_id', 'name', 'rx_bps', 'tx_bps', 'rx_pps', 'tx_pps', 'errors', 'drops'])]
class ServerNetworkInterface extends Model
{
    /** @use HasFactory<ServerNetworkInterfaceFactory> */
    use HasFactory;

    public $timestamps = false;

    public function sample(): BelongsTo
    {
        return $this->belongsTo(ServerNetworkSample::class, 'server_network_sample_id');
    }
}
