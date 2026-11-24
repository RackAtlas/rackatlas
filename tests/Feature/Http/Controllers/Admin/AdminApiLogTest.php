<?php

namespace Tests\Feature\Http\Controllers\Admin;

use App\Models\ApiLog;
use App\Models\ApiToken;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class AdminApiLogTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_requests_to_the_external_api_are_logged_with_their_key(): void
    {
        $team = Team::factory()->create();
        [$token, $plain] = ApiToken::issue($team, $team->owner, 'Grafana', ApiToken::SCOPES);

        $this->getJson('/api/v1/servers?secret=1', ['Authorization' => 'Bearer '.$plain])->assertOk();
        $this->getJson('/api/v1/servers', ['Authorization' => 'Bearer wrong'])->assertUnauthorized();

        $good = ApiLog::query()->where('status', 200)->firstOrFail();
        $this->assertSame($token->id, $good->api_token_id);
        $this->assertSame($team->id, $good->team_id);
        $this->assertSame('api/v1/servers', $good->path);

        $bad = ApiLog::query()->where('status', 401)->firstOrFail();
        $this->assertNull($bad->api_token_id);
        $this->assertSame('Unauthorized.', $bad->error);
    }

    public function test_agent_reports_are_logged_only_when_they_fail(): void
    {
        $this->postJson(route('agent.ingest'), [], ['Authorization' => 'Bearer ra_'.str_repeat('a', 40)])->assertUnauthorized();

        $this->assertSame(1, ApiLog::query()->where('source', 'agent')->count());
    }

    public function test_the_log_is_only_for_administrators_and_can_be_filtered(): void
    {
        ApiLog::factory()->create(['path' => 'api/v1/alerts']);
        ApiLog::factory()->failed()->create(['path' => 'api/v1/servers']);

        $this->actingAs(User::factory()->create())->get(route('admin.api-logs.index'))->assertForbidden();

        $this->actingAs(User::factory()->admin()->create())
            ->get(route('admin.api-logs.index', ['result' => 'errors']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/api-logs')
                ->has('logs.data', 1)
                ->where('logs.data.0.status', 401)
                ->where('totals.day', 2));
    }

    public function test_old_records_are_pruned(): void
    {
        ApiLog::factory()->create(['created_at' => now()->subDays(ApiLog::RETENTION_DAYS + 1)]);
        $fresh = ApiLog::factory()->create();

        $this->artisan('model:prune', ['--model' => ApiLog::class])->assertSuccessful();

        $this->assertSame([$fresh->id], ApiLog::query()->pluck('id')->all());
    }
}
