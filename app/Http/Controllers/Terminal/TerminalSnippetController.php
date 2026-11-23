<?php

namespace App\Http\Controllers\Terminal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Terminal\TerminalSnippetRequest;
use App\Models\TerminalSnippet;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class TerminalSnippetController extends Controller
{
    public function store(TerminalSnippetRequest $request): RedirectResponse
    {
        $request->user()->currentTeam()->terminalSnippets()->create([
            ...$request->validated(),
            'created_by' => $request->user()->id,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Snippet saved.')]);

        return back();
    }

    public function update(TerminalSnippetRequest $request, TerminalSnippet $snippet): RedirectResponse
    {
        abort_unless($snippet->team_id === $request->user()->currentTeam()->id, 404);

        $snippet->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Snippet saved.')]);

        return back();
    }

    public function destroy(TerminalSnippetRequest $request, TerminalSnippet $snippet): RedirectResponse
    {
        abort_unless($snippet->team_id === $request->user()->currentTeam()->id, 404);

        $snippet->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Snippet deleted.')]);

        return back();
    }
}
