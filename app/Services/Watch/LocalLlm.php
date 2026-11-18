<?php

namespace App\Services\Watch;

use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

/**
 * A language model that runs on this machine or in the same network (Ollama, API of llama.cpp is the same shape).
 * Nothing leaves the infrastructure. The model only explains, it never decides whether something is an alert.
 */
class LocalLlm
{
    public function enabled(): bool
    {
        return (bool) config('watch.llm.enabled');
    }

    /**
     * @throws RuntimeException when the model cannot be reached or answers nothing
     */
    public function explain(string $system, string $prompt): string
    {
        try {
            $response = Http::baseUrl((string) config('watch.llm.url'))
                ->timeout((int) config('watch.llm.timeout'))
                ->acceptJson()
                ->post('/api/chat', [
                    'model' => config('watch.llm.model'),
                    'stream' => false,
                    'think' => false,
                    'keep_alive' => config('watch.llm.keep_alive'),
                    'options' => ['temperature' => 0.2, 'num_predict' => 400],
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                ])
                ->throw();
        } catch (Throwable $e) {
            throw new RuntimeException('The local model is not reachable: '.$e->getMessage(), previous: $e);
        }

        $text = trim((string) preg_replace('/<think>.*?<\/think>/s', '', (string) $response->json('message.content')));

        if ($text === '') {
            throw new RuntimeException('The local model returned an empty answer.');
        }

        return $text;
    }

    /**
     * Names of the models that are downloaded on the machine of the model server.
     *
     * @return array<int, string>
     */
    public function installedModels(): array
    {
        return collect(Http::baseUrl((string) config('watch.llm.url'))->timeout(10)->get('/api/tags')->throw()->json('models', []))
            ->pluck('name')->all();
    }

    /**
     * Download a model, which takes minutes for the first time.
     */
    public function pull(string $model): void
    {
        Http::baseUrl((string) config('watch.llm.url'))->timeout(3600)->post('/api/pull', ['model' => $model, 'stream' => false])->throw();
    }
}
