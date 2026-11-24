<?php

namespace Tests\Feature\Http\Controllers\Admin;

use App\Http\Controllers\Admin\ImpersonationController;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

class AdminImpersonationTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_an_administrator_works_in_the_account_of_a_user_and_returns(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();

        $this->actingAs($admin)->post(route('admin.users.impersonate', $user))->assertRedirect('/');

        $this->assertAuthenticatedAs($user);
        $this->assertSame($admin->id, session(ImpersonationController::SESSION_KEY));
        $this->assertTrue(Activity::query()->where('event', 'impersonation-started')->where('causer_id', $admin->id)->exists());

        $this->get(route('profile.edit'))->assertOk()->assertInertia(fn ($page) => $page
            ->where('impersonating.email', $user->email)
            ->where('auth.user.id', $user->id));

        $this->post(route('impersonation.leave'))->assertRedirect(route('admin.users.edit', $user));

        $this->assertAuthenticatedAs($admin);
        $this->assertNull(session(ImpersonationController::SESSION_KEY));
        $this->assertTrue(Activity::query()->where('event', 'impersonation-ended')->exists());
    }

    public function test_only_administrators_can_start_and_not_for_administrators_or_themselves(): void
    {
        $normal = User::factory()->create();
        $other = User::factory()->admin()->create();
        $admin = User::factory()->admin()->create();

        $this->actingAs($normal)->post(route('admin.users.impersonate', $other))->assertForbidden();
        $this->actingAs($admin)->post(route('admin.users.impersonate', $other))->assertSessionHasErrors('impersonate');
        $this->actingAs($admin)->post(route('admin.users.impersonate', $admin))->assertSessionHasErrors('impersonate');

        $this->assertAuthenticatedAs($admin);
    }

    public function test_leaving_without_having_started_does_nothing(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('impersonation.leave'))->assertRedirect('/');

        $this->assertAuthenticatedAs($user);
    }

    public function test_account_protection_cannot_be_changed_while_impersonating(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();

        $this->actingAs($admin)->post(route('admin.users.impersonate', $user));

        $this->delete(route('profile.destroy'), ['password' => 'password'])->assertForbidden();
        $this->put(route('user-password.update'), ['current_password' => 'password', 'password' => 'x', 'password_confirmation' => 'x'])->assertForbidden();
        $this->assertModelExists($user);
    }
}
