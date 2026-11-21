<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ServerStatus;
use App\Models\ServerAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WidgetController extends ApiController
{
    /** Open problems listed in the widget. */
    private const ALERT_LIMIT = 3;

    /**
     * A few numbers for the widget on the home screen of the phone: how the servers of the team are doing
     * and the newest open problems. The widget writes the texts itself, in the language of the phone.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $team = $this->team($request);
        $servers = $team->servers()->get(['id', 'name', 'status']);

        $open = ServerAlert::query()
            ->whereIn('server_id', $servers->modelKeys())
            ->whereNull('resolved_at')
            ->with('server:id,name')
            ->latest('opened_at')
            ->get();

        $withProblems = $open->pluck('server_id')->unique();
        $offline = $servers->where('status', ServerStatus::Offline);
        $online = $servers->where('status', ServerStatus::Online);

        return response()->json([
            'team' => $team->name,
            'servers' => [
                'total' => $servers->count(),
                'online' => $online->whereNotIn('id', $withProblems->all())->count(),
                'problems' => $online->whereIn('id', $withProblems->all())->count(),
                'offline' => $offline->count(),
            ],
            'alerts' => [
                'open' => $open->count(),
                'items' => $open->take(self::ALERT_LIMIT)->map(fn (ServerAlert $alert) => [
                    'server' => $alert->server?->name,
                    'type' => $alert->type->value,
                    'opened_at' => $alert->opened_at->toIso8601String(),
                ])->values(),
            ],
            'generated_at' => now()->toIso8601String(),
        ]);
    }
}
