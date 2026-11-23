<?php

namespace Database\Factories;

use App\Models\Team;
use App\Models\TerminalSnippet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TerminalSnippet>
 */
class TerminalSnippetFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => fake()->words(2, true),
            'command' => 'df -h',
        ];
    }
}
