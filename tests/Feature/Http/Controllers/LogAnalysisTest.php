<?php

namespace Tests\Feature\Http\Controllers;

use App\Enums\ServerAuthType;
use App\Jobs\ExplainLog;
use App\Models\ServerLog;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class LogAnalysisTest extends TestCase
{
    use LazilyRefreshDatabase;

    /**
     * @return array{0: Team, 1: ServerLog}
     */
    private function resolvedLog(bool $watched = false): array
    {
        $team = Team::factory()->create();
        $server = $team->servers()->create([
            'name' => 'web', 'host' => 'example.com', 'port' => 22, 'username' => 'root',
            'auth_type' => ServerAuthType::Password, 'password' => 'secret', 'watch_enabled' => $watched,
        ]);
        $log = $server->logs()->create([
            'level' => 'error', 'source' => 'nginx', 'message' => 'upstream timed out', 'count' => 3,
            'occurred_at' => now()->subDay(), 'resolved_at' => now()->subHours(2),
        ]);

        return [$team, $log];
    }

    public function test_an_old_entry_can_be_analysed_on_request(): void
    {
        Queue::fake();
        config(['watch.llm.enabled' => true]);
        [$team, $log] = $this->resolvedLog();

        $this->actingAs($team->owner)->post(route('logs.analyze', $log))->assertRedirect();

        Queue::assertPushed(ExplainLog::class, fn (ExplainLog $job) => $job->logId === $log->id && $job->force);
    }

    public function test_the_page_says_that_an_analysis_is_running_and_asking_again_does_not_queue_a_second_one(): void
    {
        Queue::fake();
        config(['watch.llm.enabled' => true]);
        [$team, $log] = $this->resolvedLog();

        $this->actingAs($team->owner)->post(route('logs.analyze', $log));
        $this->actingAs($team->owner)->post(route('logs.analyze', $log));

        Queue::assertPushed(ExplainLog::class, 1);
        $this->actingAs($team->owner)->get(route('logs.index', ['status' => 'all']))
            ->assertInertia(fn ($page) => $page->where('logs.data.0.ai_pending', true)->where('ai_enabled', true));
    }

    public function test_nothing_is_queued_when_the_model_is_switched_off(): void
    {
        Queue::fake();
        [$team, $log] = $this->resolvedLog();

        $this->actingAs($team->owner)->post(route('logs.analyze', $log));

        Queue::assertNothingPushed();
    }

    public function test_an_entry_of_another_team_cannot_be_analysed(): void
    {
        Queue::fake();
        config(['watch.llm.enabled' => true]);
        [, $log] = $this->resolvedLog();

        $this->actingAs(Team::factory()->create()->owner)->post(route('logs.analyze', $log))->assertForbidden();

        Queue::assertNothingPushed();
    }

    public function test_the_forced_job_stores_the_answer_for_a_resolved_entry_and_clears_the_waiting_mark(): void
    {
        config(['watch.llm.enabled' => true, 'watch.llm.model' => 'test-model']);
        Http::fake(['*/api/chat' => Http::response(['message' => ['content' => 'Treba skontrolovať. Nginx nestíha.']])]);
        [, $log] = $this->resolvedLog();

        app()->call([new ExplainLog($log->id, true), 'handle']);

        $this->assertSame('Treba skontrolovať. Nginx nestíha.', $log->fresh()->ai_summary);
        $this->assertFalse(cache()->has(ExplainLog::pendingKey($log->id)));
    }

    public function test_the_automatic_job_leaves_a_resolved_entry_alone(): void
    {
        config(['watch.llm.enabled' => true]);
        Http::fake();
        [, $log] = $this->resolvedLog();

        app()->call([new ExplainLog($log->id), 'handle']);

        Http::assertNothingSent();
    }
}
