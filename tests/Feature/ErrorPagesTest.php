<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ErrorPagesTest extends TestCase
{
    public function test_an_unknown_page_shows_the_branded_404(): void
    {
        $this->get('/no-such-page-anywhere')
            ->assertNotFound()
            ->assertSee('RackAtlas')
            ->assertSee('class="rack"', false);
    }

    public function test_the_maintenance_page_is_branded_and_follows_the_browser_language(): void
    {
        Route::get('/_deploying', fn () => abort(503));

        $this->withHeader('Accept-Language', 'sk')
            ->get('/_deploying')
            ->assertStatus(503)
            ->assertSee('Aktualizujeme RackAtlas')
            ->assertSee('http-equiv="refresh"', false);
    }

    public function test_server_errors_use_the_same_layout(): void
    {
        Route::get('/_boom', fn () => abort(500));
        Route::get('/_teapot', fn () => abort(418));

        $this->get('/_boom')->assertStatus(500)->assertSee('class="rack"', false);
        $this->get('/_teapot')->assertStatus(418)->assertSee('class="rack"', false);
    }

    public function test_json_requests_still_get_json(): void
    {
        $this->getJson('/no-such-page-anywhere')->assertNotFound()->assertJsonStructure(['message']);
    }
}
