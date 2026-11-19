<?php

namespace App\Http\Controllers;

use App\Services\Demo\DemoWorkspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DemoController extends Controller
{
    /**
     * Sign the visitor in as the shared demo user. Everything in the app can be looked at, nothing can be changed.
     */
    public function __invoke(Request $request, DemoWorkspace $demo): RedirectResponse
    {
        if ($request->user() && ! $request->user()->is_demo) {
            return to_route('dashboard');
        }

        Auth::login($demo->ensure());
        $request->session()->regenerate();

        return to_route('dashboard');
    }
}
