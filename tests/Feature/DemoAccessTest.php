<?php

namespace Tests\Feature;

use App\Models\Server;
use App\Models\User;
use App\Services\Demo\DemoWorkspace;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class DemoAccessTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_the_demo_link_signs_the_visitor_in_with_demo_servers(): void
    {
        $response = $this->get(route('demo'));

        $response->assertRedirect(route('dashboard'));

        $user = User::query()->where('is_demo', true)->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame(6, Server::query()->count());
        $this->assertDatabaseHas('server_metrics', ['server_id' => Server::query()->first()->id]);

        $this->get(route('dashboard'))->assertOk();
    }

    public function test_opening_the_demo_twice_does_not_duplicate_it(): void
    {
        $this->get(route('demo'));
        $this->post(route('logout'));
        $this->get(route('demo'));

        $this->assertSame(1, User::query()->where('is_demo', true)->count());
        $this->assertSame(6, Server::query()->count());
    }

    public function test_the_demo_user_cannot_change_anything(): void
    {
        $this->get(route('demo'));
        $server = Server::query()->firstOrFail();

        $this->from(route('dashboard'))
            ->delete(route('servers.destroy', $server))
            ->assertRedirect(route('dashboard'));

        $this->assertModelExists($server);

        $this->from(route('dashboard'))
            ->post(route('servers.store'), ['name' => 'x'])
            ->assertRedirect(route('dashboard'));

        $this->assertSame(6, Server::query()->count());
    }

    public function test_a_json_write_of_the_demo_user_is_answered_with_forbidden(): void
    {
        $this->get(route('demo'));

        $this->postJson(route('terminal.sessions.store'), [])->assertForbidden();
    }

    public function test_the_demo_user_may_read_and_sign_out(): void
    {
        $this->get(route('demo'));
        $server = Server::query()->firstOrFail();

        $this->get(route('servers.show', $server))->assertOk();
        $this->get(route('logs.index'))->assertOk();
        $this->get(route('backups.index'))->assertOk();
        $this->post(route('logout'))->assertRedirect();
        $this->assertGuest();
    }

    public function test_the_demo_user_has_no_terminal_even_as_owner(): void
    {
        $this->get(route('demo'));

        $this->get(route('terminal'))->assertForbidden();
    }

    public function test_a_real_user_is_not_signed_in_as_the_demo(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('demo'))->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($user);
        $this->assertSame(0, User::query()->where('is_demo', true)->count());
    }

    public function test_refreshing_moves_the_history_to_now_without_adding_rows(): void
    {
        app(DemoWorkspace::class)->ensure();
        $server = Server::query()->firstOrFail();
        $before = $server->metrics()->count();

        $this->travel(2)->minutes();
        $this->artisan('demo:refresh')->assertSuccessful();

        $this->assertSame($before, $server->metrics()->count());
        $this->assertTrue($server->metrics()->max('collected_at') >= now()->subMinute()->toDateTimeString());
        $this->assertTrue($server->fresh()->last_seen_at->isToday());
    }

    public function test_refresh_does_nothing_without_a_demo(): void
    {
        $this->artisan('demo:refresh')->assertSuccessful();

        $this->assertSame(0, Server::query()->count());
    }
}
