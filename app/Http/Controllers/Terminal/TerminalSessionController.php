<?php

namespace App\Http\Controllers\Terminal;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class TerminalSessionController extends Controller
{
    public const TICKET_PREFIX = 'terminal-ticket:';

    /**
     * Prepare a session: a one-time ticket the browser hands to the terminal Node app.
     * The Node app exchanges it for the login details, which never reach the browser.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'server_id' => ['required', 'integer'],
            'session' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{16,32}$/'],
            'persist' => ['nullable', 'boolean'],
        ]);

        if (blank(config('terminal.secret'))) {
            return response()->json(['message' => __('The terminal is not set up on this installation.')], 503);
        }

        $team = $request->user()->currentTeam();
        $server = $team?->machines()->find($data['server_id']);

        abort_if($server === null, 404);
        $this->authorize('permit', [$team, 'terminal.edit']);

        if (! $server->hasSshAccess()) {
            return response()->json(['message' => __('This server has no SSH login details. Fill them in to use the terminal.')], 422);
        }

        $token = Str::random(48);

        Cache::put(self::TICKET_PREFIX.hash('sha256', $token), [
            'server_id' => $server->id,
            'user_id' => $request->user()->id,
            // A shell the bridge keeps running (tmux) under this name, so a reconnect finds it again.
            'session' => ($data['persist'] ?? false) ? ($data['session'] ?? null) : null,
        ], now()->addSeconds((int) config('terminal.ticket_ttl')));

        return response()->json([
            'token' => $token,
            'url' => config('terminal.url'),
        ]);
    }
}
