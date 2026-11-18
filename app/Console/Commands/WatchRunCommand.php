<?php

namespace App\Console\Commands;

use App\Models\Server;
use App\Services\Alerts\AlertEvaluator;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Throwable;

#[Signature('watch:run {--once : Judge every watched server one time and exit}')]
#[Description('Watch the servers marked for continuous watching, around the clock, until stopped')]
class WatchRunCommand extends Command
{
    /** Cache key with the time of the last finished round, so a stopped watcher can be noticed. */
    public const HEARTBEAT = 'watch:heartbeat';

    private bool $stopping = false;

    public function handle(AlertEvaluator $alerts): int
    {
        if (function_exists('pcntl_async_signals')) {
            pcntl_async_signals(true);
            pcntl_signal(SIGTERM, fn () => $this->stopping = true);
            pcntl_signal(SIGINT, fn () => $this->stopping = true);
        }

        do {
            $started = microtime(true);
            $count = $this->round($alerts);

            Cache::put(self::HEARTBEAT, now()->toIso8601String(), now()->addMinutes(10));

            if ($this->option('once')) {
                $this->info("{$count} watched servers judged.");

                return self::SUCCESS;
            }

            if (memory_get_usage(true) > (int) config('watch.memory_limit_mb') * 1048576) {
                $this->warn('Memory limit reached, exiting so the supervisor starts a clean process.');

                return self::SUCCESS;
            }

            // Sleep in short steps so a stop signal is honoured within a second.
            $until = $started + max(1, (int) config('watch.interval'));

            while (! $this->stopping && microtime(true) < $until) {
                usleep(250_000);
            }
        } while (! $this->stopping);

        $this->info('Watcher stopped.');

        return self::SUCCESS;
    }

    /**
     * Judge every watched server once. One broken server never stops the others.
     */
    private function round(AlertEvaluator $alerts): int
    {
        $count = 0;

        Server::query()->watched()->with('team')->chunkById(100, function ($servers) use ($alerts, &$count) {
            foreach ($servers as $server) {
                try {
                    $alerts->evaluate($server);
                    $count++;
                } catch (Throwable $e) {
                    report($e);
                }
            }
        });

        return $count;
    }
}
