<?php

namespace App\Http\Middleware;

use App\Http\Controllers\Admin\ImpersonationController;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An administrator who works in the account of a user may not change what protects that account.
 */
class BlockWhileImpersonating
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_if($request->session()->has(ImpersonationController::SESSION_KEY), 403, __('This is not possible while you are signed in as another user.'));

        return $next($request);
    }
}
