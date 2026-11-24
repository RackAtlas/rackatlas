<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ApiLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ApiLogController extends Controller
{
    private const PER_PAGE = 50;

    private const RESULTS = ['ok', 'errors'];

    public function index(Request $request): Response
    {
        $source = in_array($request->query('source'), ApiLog::SOURCES, true) ? $request->query('source') : null;
        $result = in_array($request->query('result'), self::RESULTS, true) ? $request->query('result') : null;
        $search = trim((string) $request->query('search', ''));

        $logs = ApiLog::query()
            ->with(['token:id,name', 'server:id,name', 'team:id,name'])
            ->when($source !== null, fn ($query) => $query->where('source', $source))
            ->when($result === 'ok', fn ($query) => $query->where('status', '<', 400))
            ->when($result === 'errors', fn ($query) => $query->where('status', '>=', 400))
            ->when($search !== '', fn ($query) => $query->where(
                fn ($inner) => $inner->where('path', 'like', "%{$search}%")
                    ->orWhere('ip', 'like', "%{$search}%")
                    ->orWhere('error', 'like', "%{$search}%")
                    ->orWhere('user_agent', 'like', "%{$search}%")
                    ->orWhereHas('token', fn ($token) => $token->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('server', fn ($server) => $server->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('team', fn ($team) => $team->where('name', 'like', "%{$search}%"))
            ))
            ->latest('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (ApiLog $log) => [
                'id' => $log->id,
                'source' => $log->source,
                'method' => $log->method,
                'path' => $log->path,
                'status' => $log->status,
                'duration_ms' => $log->duration_ms,
                'ip' => $log->ip,
                'user_agent' => $log->user_agent,
                'error' => $log->error,
                'token' => $log->token?->name,
                'server' => $log->server?->name,
                'team' => $log->team?->name,
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        $day = now()->subDay();

        return Inertia::render('admin/api-logs', [
            'logs' => $logs,
            'filters' => ['source' => $source, 'result' => $result, 'search' => $search],
            'totals' => [
                'day' => ApiLog::where('created_at', '>=', $day)->count(),
                'errors' => ApiLog::where('created_at', '>=', $day)->where('status', '>=', 400)->count(),
            ],
            'retention' => ApiLog::RETENTION_DAYS,
        ]);
    }
}
