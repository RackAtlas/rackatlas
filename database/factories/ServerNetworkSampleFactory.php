<?php

namespace Database\Factories;

use App\Models\ServerNetworkSample;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ServerNetworkSample>
 */
class ServerNetworkSampleFactory extends Factory
{
    /**
     * The server must be given: ServerNetworkSample::factory()->for($server).
     *
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'collected_at' => now(),
            'tcp_established' => fake()->numberBetween(5, 400),
            'tcp_syn_recv' => 0,
            'tcp_time_wait' => fake()->numberBetween(0, 200),
            'tcp_close_wait' => 0,
            'tcp_listen' => fake()->numberBetween(3, 15),
            'tcp_in_segs' => 800,
            'tcp_out_segs' => 1000,
            'tcp_retrans_segs' => 2,
            'tcp_in_errs' => 0,
            'tcp_attempt_fails' => 0,
            'tcp_estab_resets' => 0,
            'tcp_active_opens' => 1,
            'tcp_passive_opens' => 4,
            'conntrack_count' => null,
            'conntrack_max' => null,
        ];
    }
}
