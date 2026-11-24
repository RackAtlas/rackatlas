<?php

namespace Database\Factories;

use App\Models\ServerNetworkInterface;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ServerNetworkInterface>
 */
class ServerNetworkInterfaceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'eth0',
            'rx_bps' => fake()->numberBetween(1000, 5_000_000),
            'tx_bps' => fake()->numberBetween(1000, 5_000_000),
            'rx_pps' => fake()->numberBetween(10, 5000),
            'tx_pps' => fake()->numberBetween(10, 5000),
            'errors' => 0,
            'drops' => 0,
        ];
    }
}
