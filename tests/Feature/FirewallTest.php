<?php

namespace Tests\Feature;

use App\Enums\TeamRole;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use App\Services\Ssh\RemoteShell;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Spatie\Activitylog\Models\Activity;
use Tests\Feature\Services\Ssh\FakeRemoteShell;
use Tests\TestCase;

class FirewallTest extends TestCase
{
    use LazilyRefreshDatabase;

    private const STATUS = <<<'TXT'
        Status: active
        Logging: on (low)
        Default: deny (incoming), allow (outgoing), disabled (routed)
        New profiles: skip
        TXT;

    private const ADDED = <<<'TXT'
        Added user rules (see 'ufw status' for running firewall):
        ufw allow 22/tcp comment 'SSH'
        ufw allow 80,443/tcp
        ufw deny from 203.0.113.9
        TXT;

    private FakeRemoteShell $shell;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shell = new FakeRemoteShell;
        $this->app->instance(RemoteShell::class, $this->shell);
    }

    private function sshServer(Team $team): Server
    {
        return $team->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'root',
            'auth_type' => 'password', 'password' => 'secret',
        ]);
    }

    private function state(string $added = self::ADDED, string $status = self::STATUS): void
    {
        $this->shell->answer('ufw is not installed on this server.', "###STATUS\n{$status}\n###ADDED\n{$added}");
    }

    private function member(Team $team, ?array $permissions = null): User
    {
        $user = User::factory()->create();
        $team->members()->attach($user->id, [
            'role' => TeamRole::Member->value,
            'permissions' => $permissions === null ? null : json_encode($permissions),
        ]);

        return $user;
    }

    public function test_the_page_lists_only_servers_with_an_ssh_login(): void
    {
        $team = Team::factory()->create();
        $this->sshServer($team);
        $team->servers()->create(['name' => 'agent', 'host' => '8.8.4.4', 'port' => 22, 'username' => 'root', 'auth_type' => 'agent']);

        $this->actingAs($team->owner)
            ->get(route('firewall.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('firewall/index')
                ->has('servers', 1)
                ->where('servers.0.name', 'web')
                ->where('canManage', true));
    }

    public function test_the_overview_shows_rules_ports_and_banned_addresses(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->shell->answer('echo "###UFW"', implode("\n", [
            '###WHO', 'root',
            '###UFW', 'yes',
            '###STATUS', self::STATUS,
            '###ADDED', self::ADDED,
            '###APPS', 'OpenSSH',
            '###PORTS',
            'tcp   LISTEN 0      4096         0.0.0.0:22        0.0.0.0:*    users:(("sshd",pid=1,fd=3))',
            'tcp   LISTEN 0      511          0.0.0.0:443       0.0.0.0:*    users:(("nginx",pid=2,fd=6))',
            'tcp   LISTEN 0      151        127.0.0.1:3306      0.0.0.0:*    users:(("mysqld",pid=3,fd=20))',
            'tcp   LISTEN 0      511             [::]:6379         [::]:*    users:(("redis-server",pid=4,fd=7))',
            '###F2B', 'running',
            '###JAIL sshd',
            'Status for the jail: sshd',
            '|- Filter',
            "|  |- Currently failed:\t3",
            "|  |- Total failed:\t120",
            '`- Actions',
            "   |- Currently banned:\t2",
            "   |- Total banned:\t15",
            "   `- Banned IP list:\t198.51.100.4 198.51.100.5",
            '###ARMED',
            '###END',
        ]));

        $response = $this->actingAs($team->owner)->postJson(route('firewall.show', $server))->assertOk();

        $response->assertJsonPath('backend', 'ufw')
            ->assertJsonPath('active', true)
            ->assertJsonPath('defaults.incoming', 'deny')
            ->assertJsonPath('logging', 'low')
            ->assertJsonPath('ssh_allowed', true)
            ->assertJsonCount(3, 'rules')
            ->assertJsonPath('rules.0.comment', 'SSH')
            ->assertJsonPath('rules.1.port', '80,443')
            ->assertJsonPath('rules.2.action', 'deny')
            ->assertJsonPath('rules.2.from', '203.0.113.9')
            ->assertJsonPath('jails.0.name', 'sshd')
            ->assertJsonPath('jails.0.currently_banned', 2)
            ->assertJsonPath('jails.0.banned', ['198.51.100.4', '198.51.100.5']);

        $ports = collect($response->json('ports'))->keyBy('port');
        $this->assertSame('allowed', $ports[22]['state']);
        $this->assertSame('allowed', $ports[443]['state']);
        $this->assertSame('local', $ports[3306]['state']);
        $this->assertSame('blocked', $ports[6379]['state']);
        $this->assertSame('redis-server', $ports[6379]['process']);
    }

    public function test_an_allow_rule_runs_ufw_with_every_word_quoted_and_is_logged(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->state();

        $this->actingAs($team->owner)
            ->postJson(route('firewall.rules.store', $server), [
                'action' => 'allow', 'direction' => 'in', 'port' => '443', 'protocol' => 'tcp',
                'from' => '10.0.0.0/8', 'comment' => 'Web; rm -rf /', 'safety' => 120,
            ])
            ->assertUnprocessable();

        $this->actingAs($team->owner)
            ->postJson(route('firewall.rules.store', $server), [
                'action' => 'allow', 'direction' => 'in', 'port' => '443', 'protocol' => 'tcp',
                'from' => '10.0.0.0/8', 'comment' => 'Web', 'safety' => 120,
            ])
            ->assertOk()
            ->assertJsonPath('pending', null);

        $this->assertTrue($this->shell->ran("\$S 'ufw' 'allow' 'in' 'from' '10.0.0.0/8' 'to' 'any' 'port' '443' 'proto' 'tcp' 'comment' 'Web'"));
        $this->assertFalse($this->shell->ran('rackatlas-firewall-'), 'An allow rule needs no safety net.');
        $this->assertTrue(Activity::query()->where('event', 'firewall-rule-added')->where('subject_id', $server->id)->exists());
    }

    public function test_a_rule_that_blocks_ssh_asks_first_and_then_runs_behind_the_safety_net(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->state();

        $payload = ['action' => 'deny', 'direction' => 'in', 'port' => '22', 'protocol' => 'tcp', 'safety' => 120];

        $this->actingAs($team->owner)
            ->postJson(route('firewall.rules.store', $server), $payload)
            ->assertStatus(409)
            ->assertJsonPath('confirm', true);

        $this->assertFalse($this->shell->ran("'ufw' 'deny'"));

        $this->actingAs($team->owner)
            ->postJson(route('firewall.rules.store', $server), [...$payload, 'confirmed' => true])
            ->assertOk()
            ->assertJsonPath('pending.reachable', true);

        $script = $this->shell->script("'ufw' 'deny'");
        $this->assertNotNull($script);
        $this->assertStringContainsString("cp -a /etc/ufw '/var/tmp/rackatlas-firewall-", $script);
        $this->assertStringContainsString('--on-active=120', $script);
        $this->assertLessThan(strpos($script, "'ufw' 'deny'"), strpos($script, 'systemd-run'), 'The safety net is armed before the change.');
        $this->assertNotNull(Cache::get('firewall-pending:'.$server->id));
    }

    public function test_switching_the_firewall_on_allows_the_ssh_port_first(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->state("Added user rules (see 'ufw status' for running firewall):\nufw allow 80/tcp", 'Status: inactive');

        $this->actingAs($team->owner)
            ->putJson(route('firewall.toggle', $server), ['enabled' => true, 'safety' => 60])
            ->assertOk();

        $script = $this->shell->script('ufw --force enable');
        $this->assertNotNull($script);
        $this->assertStringContainsString("'ufw' 'allow' '22/tcp' 'comment' 'RackAtlas SSH'", $script);
        $this->assertLessThan(strpos($script, 'ufw --force enable'), strpos($script, "'22/tcp'"));
    }

    public function test_deleting_the_only_rule_that_allows_ssh_needs_confirmation(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $this->state();

        $this->actingAs($team->owner)
            ->deleteJson(route('firewall.rules.destroy', $server), ['spec' => 'allow 22/tcp', 'safety' => 120])
            ->assertStatus(409)
            ->assertJsonPath('confirm', true);

        $this->actingAs($team->owner)
            ->deleteJson(route('firewall.rules.destroy', $server), ['spec' => 'allow 80,443/tcp', 'safety' => 0])
            ->assertOk();

        $this->assertTrue($this->shell->ran("\$S 'ufw' '--force' 'delete' 'allow' '80,443/tcp'"));

        $this->actingAs($team->owner)
            ->deleteJson(route('firewall.rules.destroy', $server), ['spec' => 'allow 8080/tcp', 'safety' => 0])
            ->assertStatus(409)
            ->assertJsonPath('confirm', false);
    }

    public function test_keeping_a_change_disarms_the_rollback(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        Cache::put('firewall-pending:'.$server->id, ['token' => 'a1b2c3d4e5f60718', 'expires_at' => now()->addMinute()->toIso8601String(), 'summary' => 'x', 'reachable' => true]);

        $this->actingAs($team->owner)->postJson(route('firewall.confirm', $server))->assertOk();

        $this->assertTrue($this->shell->ran("rm -f '/var/tmp/rackatlas-firewall-a1b2c3d4e5f60718'/armed"));
        $this->assertNull(Cache::get('firewall-pending:'.$server->id));

        $this->actingAs($team->owner)->postJson(route('firewall.confirm', $server))->assertStatus(409);
    }

    public function test_a_member_who_may_only_look_cannot_change_the_firewall(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $member = $this->member($team);

        $this->actingAs($member)->postJson(route('firewall.show', $server))->assertOk();
        $this->actingAs($member)
            ->putJson(route('firewall.toggle', $server), ['enabled' => false, 'safety' => 0])
            ->assertForbidden();

        $closed = $this->member($team, ['firewall' => 'none']);
        $this->actingAs($closed)->get(route('firewall.index'))->assertForbidden();

        $this->actingAs(User::factory()->create())->postJson(route('firewall.show', $server))->assertForbidden();
    }

    public function test_a_rule_needs_a_port_or_an_address_and_valid_values(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $base = ['action' => 'allow', 'direction' => 'in', 'protocol' => 'tcp', 'safety' => 0];

        $this->actingAs($team->owner)->postJson(route('firewall.rules.store', $server), $base)->assertUnprocessable();
        $this->actingAs($team->owner)->postJson(route('firewall.rules.store', $server), [...$base, 'port' => '70000'])->assertUnprocessable();
        $this->actingAs($team->owner)->postJson(route('firewall.rules.store', $server), [...$base, 'port' => '90:80'])->assertUnprocessable();
        $this->actingAs($team->owner)->postJson(route('firewall.rules.store', $server), [...$base, 'from' => '999.1.1.1'])->assertUnprocessable();
        $this->actingAs($team->owner)->postJson(route('firewall.rules.store', $server), [...$base, 'port' => '80,443', 'protocol' => 'any'])->assertUnprocessable();

        $this->assertSame([], $this->shell->scripts);
    }

    public function test_fail2ban_unbans_an_address_everywhere(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($team->owner)
            ->postJson(route('firewall.fail2ban', $server), ['action' => 'unban', 'ip' => '198.51.100.4'])
            ->assertOk();

        $this->assertTrue($this->shell->ran("\$S 'fail2ban-client' 'unban' '198.51.100.4'"));

        $this->actingAs($team->owner)
            ->postJson(route('firewall.fail2ban', $server), ['action' => 'ban', 'ip' => '198.51.100.4'])
            ->assertUnprocessable();
    }

    public function test_a_server_without_ssh_cannot_be_managed(): void
    {
        $team = Team::factory()->create();
        $server = $team->servers()->create(['name' => 'agent', 'host' => '8.8.4.4', 'port' => 22, 'username' => 'root', 'auth_type' => 'agent']);

        $this->actingAs($team->owner)->postJson(route('firewall.show', $server))->assertUnprocessable();
        $this->assertSame([], $this->shell->scripts);
    }
}
