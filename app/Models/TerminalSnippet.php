<?php

namespace App\Models;

use Database\Factories\TerminalSnippetFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A command the team keeps ready to send into a terminal with one click.
 *
 * @property int $id
 * @property int $team_id
 * @property string $name
 * @property string $command
 * @property int|null $created_by
 */
#[Fillable(['team_id', 'name', 'command', 'created_by'])]
class TerminalSnippet extends Model
{
    /** @use HasFactory<TerminalSnippetFactory> */
    use HasFactory;

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }
}
