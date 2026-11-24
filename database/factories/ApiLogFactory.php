<?php

namespace Database\Factories;

use App\Models\ApiLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApiLog>
 */
class ApiLogFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'source' => 'v1',
            'method' => 'GET',
            'path' => 'api/v1/servers',
            'status' => 200,
            'duration_ms' => fake()->numberBetween(5, 200),
            'ip' => fake()->ipv4(),
            'user_agent' => 'Grafana/10',
        ];
    }

    public function failed(int $status = 401, string $error = 'Unauthorized.'): static
    {
        return $this->state(['status' => $status, 'error' => $error]);
    }
}
