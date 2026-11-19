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

        $system = 'You are an operations assistant for a Linux administrator. Write in '.config('watch.llm.language')
            .', in at most three short sentences, plain and natural, no markdown. '
            .'Sentence 1 starts with a verdict: either "Pravdepodobne neškodné" (harmless) or "Treba skontrolovať" (needs a look), then says why in a few words. '
            .'Sentence 2 says what you see in the numbers (use MB/s for network, name the server). Sentence 3, only if needed, says the one thing to check first. '
            .'Judge it honestly: a short rise of network traffic while CPU, memory, load and logs are all normal is usually harmless (a download, a backup, a deploy, a crawler). '
            .'It is worth a look when it lasts, when CPU, memory, load or logs change at the same time, or when a service has failed. '
            .'Use only the data given and never invent numbers, processes or commands. If the data is not enough, say so.';

        try {
            $summary = $llm->explain($system, $prompt);
        } catch (Throwable $e) {
            Log::warning('Local model could not explain an alert', ['alert' => $alert->id, 'error' => $e->getMessage()]);

            return;
        }

        $alert->update(['context' => [...($alert->context ?? []), 'summary' => mb_substr($summary, 0, 1500), 'model' => config('watch.llm.model')]]);
    }
}
