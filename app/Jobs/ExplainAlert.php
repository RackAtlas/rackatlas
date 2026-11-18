<?php

namespace App\Jobs;

use App\Models\ServerAlert;
use App\Services\Watch\LocalLlm;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Asks the local model for a short explanation of an alert and stores it with the alert.
 * It runs on its own queue (one worker), so a slow model never delays the collection of metrics.
 */
class ExplainAlert implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 300;

    public function __construct(public readonly int $alertId)
    {
        $this->onQueue((string) config('watch.llm.queue'));
    }

    public function handle(LocalLlm $llm): void
    {
        $alert = ServerAlert::query()->with('server')->find($this->alertId);

        if ($alert === null || ! $llm->enabled() || $alert->resolved_at !== null || isset($alert->context['summary'])) {
            return;
        }

        $server = $alert->server;
        $metrics = $server->metrics()->latest('collected_at')->limit(30)->get()->reverse();
        $latest = $metrics->last();

        $lines = $metrics->filter(fn ($m, $i) => $i % 3 === 0)->map(fn ($m) => sprintf(
            '%s cpu=%s%% ram=%s%% load1=%s net_rx=%sB/s net_tx=%sB/s',
            $m->collected_at->format('H:i'),
            round((float) $m->cpu_percent),
            $m->memory_total > 0 ? round($m->memory_used / $m->memory_total * 100) : '?',
            $m->load_1,
            $m->net_rx_bps ?? '?',
            $m->net_tx_bps ?? '?',
        ))->implode("\n");

        $processes = collect($latest?->top_processes ?? [])->take(5)
            ->map(fn ($p) => sprintf('%s (cpu %s%%)', $p[0] ?? '?', $p[2] ?? '?'))->implode(', ');

        $logs = $server->logs()->open()->latest('occurred_at')->limit(5)->get()
            ->map(fn ($log) => '['.$log->level.'] '.mb_substr($log->message, 0, 200))->implode("\n");

        $prompt = implode("\n\n", array_filter([
            "Server: {$server->name} ({$server->type->value})",
            'Alert: '.$alert->key.' '.json_encode($alert->context, JSON_UNESCAPED_UNICODE),
            "Last measurements (oldest first):\n".$lines,
            $processes !== '' ? 'Busiest processes now: '.$processes : null,
            $logs !== '' ? "Open log entries:\n".$logs : null,
        ]));

        $system = 'You are an operations assistant for a Linux administrator. Explain in at most four short sentences, in '
            .config('watch.llm.language').', what probably happens on the server and what to check first. '
            .'Use only the data given. If the data is not enough to say, say so. Never invent numbers or commands you are not sure about.';

        try {
            $summary = $llm->explain($system, $prompt);
        } catch (Throwable $e) {
            Log::warning('Local model could not explain an alert', ['alert' => $alert->id, 'error' => $e->getMessage()]);

            return;
        }

        $alert->update(['context' => [...($alert->context ?? []), 'summary' => mb_substr($summary, 0, 1500), 'model' => config('watch.llm.model')]]);
    }
}
