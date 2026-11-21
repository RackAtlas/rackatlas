<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationDiagnosticsAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_regular_user_cannot_open_the_diagnostics(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson(route('notification-diagnostics.show'))
            ->assertForbidden();
    }

    public function test_an_admin_can_open_the_diagnostics(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]))
            ->getJson(route('notification-diagnostics.show'))
            ->assertOk();
    }
}
