<?php

namespace App\Console\Commands;

use App\Services\Watch\LocalLlm;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

#[Signature('watch:model {--pull : Download the configured model if it is missing} {--ask= : Send one question to the model to try it}')]
#[Description('Check the local language model used to explain alerts')]
class WatchModelCommand extends Command
{
    public function handle(LocalLlm $llm): int
    {
        $model = (string) config('watch.llm.model');
        $url = (string) config('watch.llm.url');

        if (! $llm->enabled()) {
            $this->warn('WATCH_LLM_ENABLED is off, so alerts get no explanation. Set WATCH_LLM_ENABLED=true in .env.');
        }

        try {
            $installed = $llm->installedModels();
        } catch (Throwable $e) {
            $this->error("The model server at {$url} does not answer: ".$e->getMessage());

            return self::FAILURE;
        }

        $present = in_array($model, $installed, true) || in_array($model.':latest', $installed, true);

        if (! $present && $this->option('pull')) {
            $this->info("Downloading {$model}, this can take several minutes...");
            $llm->pull($model);
            $present = true;
        }

        if (! $present) {
            $this->error("The model {$model} is not installed. Run: php artisan watch:model --pull");

            return self::FAILURE;
        }

        $this->info("Model server {$url} is reachable, model {$model} is installed.");

        if ($question = $this->option('ask')) {
            $started = microtime(true);
            $this->line($llm->explain('Answer briefly.', (string) $question));
            $this->comment(round(microtime(true) - $started, 1).' s');
        }

        return self::SUCCESS;
    }
}
