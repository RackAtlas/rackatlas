<?php

namespace App\Http\Middleware;

use App\Models\ApiLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Writes the requests to the API into the log the administrator reads. The external API (`v1`) is logged completely;
 * the agents report every minute, so only their failures are (`agent`). The query string is never stored.
 */
class LogApiRequest
{
    public function handle(Request $request, Closure $next, string $source = 'v1'): Response
    {
        $start = hrtime(true);
        $response = $next($request);

        if ($source === 'agent' && $response->getStatusCode() < 400) {
            return $response;
        }

        try {
            $token = $request->attributes->get('api_token');
            $server = $request->attributes->get('agent_server');
            $failed = $response->getStatusCode() >= 400;

            ApiLog::create([
                'source' => $source,
                'api_token_id' => $token?->id,
                'server_id' => $server?->id,
                'team_id' => $token?->team_id ?? $server?->team_id,
                'method' => $request->method(),
                'path' => Str::limit($request->path(), 250, ''),
                'status' => $response->getStatusCode(),
                'duration_ms' => (int) ((hrtime(true) - $start) / 1_000_000),
                'ip' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 250, '') ?: null,
                'error' => $failed ? $this->error($response) : null,
            ]);
        } catch (Throwable $e) {
            report($e);
        }

        return $response;
    }

    private function error(Response $response): ?string
    {
        $message = json_decode((string) $response->getContent(), true)['message'] ?? null;

        return is_string($message) ? Str::limit($message, 480, '') : null;
    }
}
