<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * The demo account can look at everything and change nothing. Every request that would write,
 * and every action such as the terminal or a restart, is answered with an alert instead.
 */
class BlockDemoChanges
{
    /** Routes that are safe for the demo account although they are not reads. */
    private const ALLOWED = ['logout', 'language.update'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->is_demo || $request->isMethodSafe() || in_array($request->route()?->getName(), self::ALLOWED, true)) {
            return $next($request);
        }

        $message = __('This is only a demo, nothing can be added, changed or deleted. Create an account to try it for real.');

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $message], 403);
        }

        Inertia::flash('toast', ['type' => 'error', 'message' => $message]);

        return back();
    }
}
