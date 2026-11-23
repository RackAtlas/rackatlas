<?php

namespace Tests\Feature;

use App\Models\Server;
use App\Models\Team;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WindowsAgentTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function agentServer(Team $team): Server
    {
        return $team->servers()->create([
            'name' => 'win', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root', 'auth_type' => 'agent',
        ]);
    }

    /** The report of the Windows agent, as rackatlas-agent.exe writes it. */
    private function windowsReport(): string
    {
        return implode("\n", [
            '###CPU1', 'cpu 1000 0 500 8000 0 0 0 0',
            '###CPU2', 'cpu 1500 0 800 8700 0 0 0 0',
            '###LOAD', '0.55 0.40 0.30 0/0 0',
            '###CORES', '4',
            '###MEM', "MemTotal: 8388608 kB\nMemFree: 4194304 kB\nMemAvailable: 4194304 kB\nBuffers: 0 kB\nCached: 0 kB\nSwapTotal: 2097152 kB\nSwapFree: 2000000 kB",
            '###UPTIME', '86400.50',
            '###DISK', 'C: NTFS 107374182400 53687091200 53687091200 50% C:\\',
            '###PROCESSES', "sqlservr 1 12.50 1048576\nchrome 9 3.00 524288",
            '###SYSTEM', "hostname=SRV01\nos=Windows Server 2022 Standard 21H2\nkernel=10.0.20348.2700\narch=x86_64\ncpu_model=Intel(R) Xeon(R) CPU\nreboot_required=1",
            '###NETWORK', '1000 2000',
            '###JOURNAL_ERROR', '2026-01-02T03:04:05+01:00 SRV01 Service_Control_Manager[7034]: The Print Spooler service terminated unexpectedly.',
            '###SERVICES', "Spooler.service|failed|failed|enabled|Print Spooler\nW32Time.service|active|running|enabled|Windows Time",
            '###FAILED_UNITS', 'Spooler.service loaded failed failed Print Spooler',
            '',
        ]);
    }

    public function test_the_report_of_the_windows_agent_is_accepted_and_stored(): void
    {
        $team = Team::factory()->create();
        $server = $this->agentServer($team);

        $this->call('POST', route('agent.ingest'), [], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$server->issueAgentToken(),
            'HTTP_X_AGENT_VERSION' => 'windows-1.0.0',
        ], $this->windowsReport())->assertOk();

        $server->refresh();

        $this->assertSame('windows-1.0.0', $server->agent_version);
        $this->assertNotNull($server->last_seen_at);
        $this->assertEqualsCanonicalizing(['Spooler.service', 'W32Time.service'], $server->services()->pluck('unit')->all());
    }

    public function test_the_install_page_shows_the_powershell_command_with_the_token(): void
    {
        $team = Team::factory()->create();
        $server = $this->agentServer($team);
        $token = 'ra_'.str_repeat('a', 40);

        $this->actingAs($team->owner)
            ->withSession(['agent_token' => $token])
            ->get(route('servers.agent.show', $server))
            ->assertInertia(fn (Assert $page) => $page
                ->component('servers/agent')
                ->where('windows_command', fn (string $command) => str_contains($command, "RACKATLAS_TOKEN='{$token}'")
                    && str_contains($command, '/agent/install.ps1')));
    }

    public function test_without_a_fresh_token_no_windows_command_is_shown(): void
    {
        $team = Team::factory()->create();
        $server = $this->agentServer($team);

        $this->actingAs($team->owner)
            ->get(route('servers.agent.show', $server))
            ->assertInertia(fn (Assert $page) => $page->where('windows_command', null));
    }

    public function test_a_windows_server_added_with_the_wizard_goes_to_the_install_page(): void
    {
        $team = Team::factory()->create();

        $this->actingAs($team->owner)
            ->post(route('servers.store'), [
                'type' => 'server', 'name' => 'win', 'provider' => '', 'country' => '', 'host' => '', 'port' => '22',
                'username' => 'root', 'server_category_id' => '', 'new_category' => '', 'auth_type' => 'agent',
                'uses_agent' => false, 'password' => '', 'ssh_key_id' => '',
                'ignored_alerts' => [], 'in_maintenance' => false, 'watch_enabled' => false, 'has_docker' => false,
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('servers.agent.show', $team->servers()->firstOrFail()));
    }
}
