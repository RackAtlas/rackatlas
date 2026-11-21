<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Support\NativeApp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WidgetTokenController extends Controller
{
    public const NAME = 'Android widget';

    /**
     * Give the Android app a read-only key for the widget on the home screen. The widget cannot use the
     * session of the web view, so it keeps this key. An earlier key of the same user is replaced.
     */
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless(NativeApp::isRequest($request), 403);

        $user = $request->user();
        $team = $user->currentTeam();

        abort_if($team === null, 422);

        $team->apiTokens()->where('created_by', $user->id)->where('name', self::NAME)->delete();

        [, $plain] = ApiToken::issue($team, $user, self::NAME, [ApiToken::SCOPE_SERVERS, ApiToken::SCOPE_ALERTS]);

        return response()->json([
            'token' => $plain,
            'url' => route('api.v1.widget', [], true),
            'team' => $team->name,
        ], 201);
    }
}
