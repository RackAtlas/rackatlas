<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class RegistrationSwitchTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_sign_up_is_closed_unless_enable_register_is_true(): void
    {
        $this->assertFalse(Route::has('register'));

        $this->get('/register')->assertNotFound();
        $this->post('/register', ['name' => 'A', 'email' => 'a@example.com', 'password' => 'secret-password-1', 'password_confirmation' => 'secret-password-1'])
            ->assertStatus(404);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_the_pages_show_no_sign_up_buttons_while_it_is_closed(): void
    {
        $this->get(route('login'))->assertOk()->assertInertia(fn ($page) => $page->where('canRegister', false));
        $this->get('/')->assertOk()->assertInertia(fn ($page) => $page->where('canRegister', false));
    }
}
