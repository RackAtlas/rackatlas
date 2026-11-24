<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\CurrentTeamController;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * An administrator works in the account of another user, to look at or set up their data. The id of the administrator
 * stays in the session, so the way back is always one click, and both steps are written to the activity log.
 */
class ImpersonationController extends Controller
{
    public const SESSION_KEY = 'impersonator_id';

    public function start(Request $request, User $user): RedirectResponse
    {
        $admin = $request->user();

        if ($request->session()->has(self::SESSION_KEY)) {
            return back()->withErrors(['impersonate' => __('Go back to your own account first.')]);
        }

        if ($user->is($admin) || $user->is_admin || $user->is_demo) {
            return back()->withErrors(['impersonate' => __('You cannot sign in as this user.')]);
        }

        activity('admin')->event('impersonation-started')->causedBy($admin)->performedOn($user)->log('impersonation-started');

        Auth::login($user);
        $request->session()->put(self::SESSION_KEY, $admin->id);
        $request->session()->forget([CurrentTeamController::SESSION_KEY, 'ra_device_id']);

        return redirect('/');
    }

    public function leave(Request $request): RedirectResponse
    {
        $adminId = $request->session()->pull(self::SESSION_KEY);
        $admin = $adminId === null ? null : User::query()->where('is_admin', true)->find($adminId);

        if ($admin === null) {
            return redirect('/');
        }

        $user = $request->user();

        Auth::login($admin);
        $request->session()->forget([CurrentTeamController::SESSION_KEY, 'ra_device_id']);

        activity('admin')->event('impersonation-ended')->causedBy($admin)->performedOn($user)->log('impersonation-ended');
        Inertia::flash('toast', ['type' => 'success', 'message' => __('You are back in your own account.')]);

        return $user === null ? redirect()->route('admin.users.index') : redirect()->route('admin.users.edit', $user);
    }
}
