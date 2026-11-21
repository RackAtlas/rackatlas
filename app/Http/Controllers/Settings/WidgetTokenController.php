<?php

namespace App\Http\Controllers\Settings;

use App\Enums\PermissionLevel;
use App\Enums\TeamPermission;
use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Models\Team;
use App\Support\NativeApp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WidgetTokenController extends Controller
{
    public const NAME = 'Android widget';

    /**
     * Give the Android app a read-only key for the widgets on the home screen, one for every team the user may
     * look at servers of, so each widget can be set to its own team. The widget cannot use the session of the
     * web view, so it keeps these keys. Earlier keys of the user are replaced.
     */
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless(NativeApp::isRequest($request), 403);

        $user = $request->user();

        ApiToken::query()->where('created_by', $user->id)->where('name', self::NAME)->delete();

        $teams = $user->teams()->orderBy('name')->get()
            ->filter(fn (Team $team) => $team->permissionsOf($user)[TeamPermission::Servers->value]->atLeast(PermissionLevel::View))
            ->map(function (Team $team) use ($user) {
                [, $plain] = ApiToken::issue($team, $user, self::NAME, [ApiToken::SCOPE_SERVERS, ApiToken::SCOPE_ALERTS]);

                return ['id' => $team->id, 'name' => $team->name, 'token' => $plain];
            })
            ->values();

        abort_if($teams->isEmpty(), 422);

        return response()->json([
            'url' => route('api.v1.widget', [], true),
            'teams' => $teams,
        ], 201);
    }
}
