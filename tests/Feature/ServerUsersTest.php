<?php

namespace Tests\Feature;

use App\Enums\TeamRole;
use App\Models\Server;
use App\Models\SshKey;
use App\Models\Team;
use App\Models\User;
use App\Services\Ssh\RemoteShell;
use App\Services\Ssh\SshKeyService;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Spatie\Activitylog\Models\Activity;
use Tests\Feature\Services\Ssh\FakeRemoteShell;
use Tests\TestCase;

class ServerUsersTest extends TestCase
{
    use LazilyRefreshDatabase;

    private string $appKey;

    private string $otherKey;

    private string $appFingerprint;

    private string $otherFingerprint;

    private FakeRemoteShell $shell;

    protected function setUp(): void
    {
        parent::setUp();

        $keys = new SshKeyService;
        ['public_key' => $this->appKey, 'fingerprint' => $this->appFingerprint] = $keys->generate('rackatlas');
        ['public_key' => $this->otherKey, 'fingerprint' => $this->otherFingerprint] = $keys->generate('anna@laptop');

        $this->shell = new FakeRemoteShell;
        $this->app->instance(RemoteShell::class, $this->shell);
    }

    private function keyServer(Team $team): Server
    {
        $key = SshKey::query()->create([
            'team_id' => $team->id, 'name' => 'App', 'algorithm' => 'ed25519',
            'fingerprint' => $this->appFingerprint,
            'public_key' => $this->appKey, 'private_key' => 'private',
        ]);

        return $team->servers()->create([
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'deploy',
            'auth_type' => 'key', 'ssh_key_id' => $key->id,
        ]);
    }

    private function passwd(): string
    {
        return implode("\n", [
            'root:x:0:0:root:/root:/bin/bash',
            'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin',
            'deploy:x:1000:1000:Deploy,,,:/home/deploy:/bin/bash',
            'anna:x:1001:1001:Anna Nová:/home/anna:/bin/bash',
        ]);
    }

    private function overview(): string
    {
        return implode("\n", [
            '###WHO', 'sudo',
            '###ME', 'deploy',
            '###PASSWD', $this->passwd(),
            '###GROUP', "root:x:0:\nsudo:x:27:deploy\nwww-data:x:33:anna\ndeploy:x:1000:\nanna:x:1001:\ndevs:x:1002:anna",
            '###SHADOW', "root:none:19000:99999:\ndeploy:set:20000:99999:\nanna:empty:20000:90:",
            '###SHELLS', "/bin/sh\n/bin/bash\n/usr/sbin/nologin",
            '###SESSIONS', 'anna     pts/1        2026-11-25 10:01 00:05       12345 (203.0.113.5)',
            '###LAST',
            'anna     pts/1        203.0.113.5      Tue Nov 25 10:01:00 2026   still logged in',
            'deploy   pts/0        198.51.100.2     Mon Nov 24 09:00:00 2026 - Mon Nov 24 09:30:00 2026  (00:30)',
            'reboot   system boot  6.8.0-45-generic Sun Nov 23 08:00:00 2026   still running',
            '###FAILED',
            '2026-11-25T09:00:00+0000 web sshd[1]: Failed password for invalid user admin from 192.0.2.10 port 4000 ssh2',
            '2026-11-25T09:00:05+0000 web sshd[1]: Failed password for root from 192.0.2.10 port 4001 ssh2',
            '2026-11-25T09:01:00+0000 web sshd[1]: Invalid user test from 192.0.2.11 port 4002',
            '###SSHD', "port 22\npermitrootlogin yes\npasswordauthentication yes",
            '###DROPIN', 'yes',
            '###KEYS root',
            '###KEYS deploy', $this->appKey,
            '###KEYS anna', "# laptop\n".$this->otherKey,
            '###END',
        ]);
    }

    public function test_the_overview_lists_users_groups_logins_and_ssh_settings(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);
        $this->shell->answer('###SHADOW', $this->overview());

        $response = $this->actingAs($team->owner)->postJson(route('server-users.show', $server))->assertOk();

        $users = collect($response->json('users'))->keyBy('name');

        $this->assertSame(['root', 'anna', 'deploy', 'www-data'], $response->json('users.*.name'));
        $this->assertTrue($users['deploy']['sudo']);
        $this->assertTrue($users['deploy']['is_login']);
        $this->assertTrue($users['deploy']['protected']);
        $this->assertTrue($users['deploy']['keys'][0]['app_key']);
        $this->assertSame('Deploy', $users['deploy']['gecos']);
        $this->assertSame('empty', $users['anna']['password']);
        $this->assertSame(['www-data', 'devs'], $users['anna']['groups']);
        $this->assertSame('anna@laptop', $users['anna']['keys'][0]['comment']);
        $this->assertSame(1, $users['anna']['sessions']);
        $this->assertSame('203.0.113.5', $users['anna']['last_login']['from']);
        $this->assertTrue($users['www-data']['system']);
        $this->assertFalse($users['www-data']['can_login']);
        $this->assertArrayNotHasKey('hash', $users['anna'], 'Password hashes never reach the app.');

        $response->assertJsonPath('sudo_group', 'sudo')
            ->assertJsonCount(3, 'failures')
            ->assertJsonPath('sshd.settings.permitrootlogin', 'yes')
            ->assertJsonPath('sshd.manageable', true)
            ->assertJsonPath('sessions.0.from', '203.0.113.5')
            ->assertJsonCount(2, 'logins');
    }

    public function test_a_user_is_created_with_sudo_a_password_in_a_file_and_a_team_key(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);
        $this->shell->answer('getent group sudo', 'sudo');
        $this->shell->answer('getent passwd -- ', 'maria:x:1003:1003::/home/maria:/bin/bash');

        $this->actingAs($team->owner)
            ->postJson(route('server-users.store', $server), [
                'name' => 'maria', 'gecos' => 'Mária: Admin', 'shell' => '/bin/bash', 'home' => true,
                'groups' => ['www-data'], 'sudo' => true, 'password' => 'correct horse battery',
                'team_key_id' => $server->ssh_key_id,
            ])
            ->assertOk();

        $this->assertTrue($this->shell->ran("G='www-data,sudo'"));
        $this->assertTrue($this->shell->ran('$S useradd -m -s "$SH" -c "$GE" ${G:+-G "$G"} -- "$U"'));
        $this->assertTrue($this->shell->ran("GE='Mária  Admin'"), 'A colon would break /etc/passwd.');
        $this->assertTrue($this->shell->ran('$S chpasswd < "$T"'));
        $this->assertContains("maria:correct horse battery\n", $this->shell->uploads);
        $this->assertContains($this->appKey."\n", $this->shell->uploads);

        foreach ($this->shell->scripts as $script) {
            $this->assertStringNotContainsString('correct horse battery', $script, 'The password never appears in a command.');
        }

        $activity = Activity::query()->where('event', 'server-user-created')->firstOrFail();
        $this->assertStringNotContainsString('correct horse', (string) json_encode($activity->properties));
    }

    public function test_the_login_user_and_root_are_protected(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);

        $this->actingAs($team->owner)->deleteJson(route('server-users.destroy', ['server' => $server, 'user' => 'deploy']))->assertUnprocessable();
        $this->actingAs($team->owner)->deleteJson(route('server-users.destroy', ['server' => $server, 'user' => 'root']))->assertUnprocessable();
        $this->actingAs($team->owner)->putJson(route('server-users.enabled', ['server' => $server, 'user' => 'deploy']), ['enabled' => false])->assertUnprocessable();
        $this->actingAs($team->owner)
            ->putJson(route('server-users.update', ['server' => $server, 'user' => 'root']), ['shell' => '/usr/sbin/nologin'])
            ->assertUnprocessable();

        $this->assertFalse($this->shell->ran('userdel'));
        $this->assertFalse($this->shell->ran('usermod -L'));
    }

    public function test_sudo_cannot_be_taken_from_the_login_user(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);
        $this->shell->answer('getent group', "sudo:x:27:deploy\ndeploy:x:1000:");

        $this->actingAs($team->owner)
            ->putJson(route('server-users.update', ['server' => $server, 'user' => 'deploy']), ['shell' => '/bin/bash', 'sudo' => false])
            ->assertUnprocessable();

        $this->assertFalse($this->shell->ran('usermod -s'));
    }

    public function test_a_user_is_deleted_with_its_home(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);
        $this->shell->answer('getent passwd -- ', 'anna:x:1001:1001::/home/anna:/bin/bash');

        $this->actingAs($team->owner)
            ->deleteJson(route('server-users.destroy', ['server' => $server, 'user' => 'anna']), ['remove_home' => true, 'kill_processes' => true])
            ->assertOk();

        $this->assertTrue($this->shell->ran('$S pkill -KILL -u "$U"'));
        $this->assertTrue($this->shell->ran('$S userdel -r -- "$U"'));
    }

    public function test_the_key_the_app_logs_in_with_cannot_be_removed(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);

        $this->actingAs($team->owner)
            ->deleteJson(route('server-users.keys.destroy', ['server' => $server, 'user' => 'deploy']), ['fingerprint' => $this->appFingerprint])
            ->assertUnprocessable();

        $this->assertSame([], $this->shell->scripts);
    }

    public function test_a_key_is_removed_and_the_file_is_written_with_the_right_owner(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);
        $this->shell->answer('getent passwd -- ', 'anna:x:1001:1001::/home/anna:/bin/bash');
        $this->shell->answer("cat -- '/home/anna/.ssh/authorized_keys'", "# laptop\n".$this->otherKey."\n".$this->appKey."\n");

        $this->actingAs($team->owner)
            ->deleteJson(route('server-users.keys.destroy', ['server' => $server, 'user' => 'anna']), ['fingerprint' => $this->otherFingerprint])
            ->assertOk();

        $this->assertSame(["# laptop\n".$this->appKey."\n"], $this->shell->uploads);
        $this->assertTrue($this->shell->ran('$S install -m 600 -o "$U" -g "$G" -- "$T" "$H/.ssh/authorized_keys"'));
        $this->assertTrue($this->shell->ran('$S install -d -m 700'));
    }

    public function test_an_invalid_or_duplicate_key_is_refused(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);
        $this->shell->answer('getent passwd -- ', 'anna:x:1001:1001::/home/anna:/bin/bash');
        $this->shell->answer("cat -- '/home/anna/.ssh/authorized_keys'", $this->otherKey."\n");

        $this->actingAs($team->owner)
            ->postJson(route('server-users.keys.store', ['server' => $server, 'user' => 'anna']), ['key' => 'not a key'])
            ->assertUnprocessable();

        $this->actingAs($team->owner)
            ->postJson(route('server-users.keys.store', ['server' => $server, 'user' => 'anna']), ['key' => $this->otherKey])
            ->assertStatus(409);

        $this->assertSame([], $this->shell->uploads);
    }

    public function test_sshd_settings_that_would_lock_the_app_out_are_refused(): void
    {
        $team = Team::factory()->create();
        $passwordServer = $team->servers()->create([
            'name' => 'db', 'host' => '8.8.4.4', 'port' => 22, 'username' => 'root', 'auth_type' => 'password', 'password' => 'secret',
        ]);

        $this->actingAs($team->owner)
            ->putJson(route('server-users.sshd', $passwordServer), ['setting' => 'passwordauthentication', 'value' => 'no'])
            ->assertUnprocessable();

        $this->actingAs($team->owner)
            ->putJson(route('server-users.sshd', $passwordServer), ['setting' => 'permitrootlogin', 'value' => 'prohibit-password'])
            ->assertUnprocessable();

        $this->assertSame([], $this->shell->scripts);
    }

    public function test_an_sshd_setting_is_tested_before_sshd_is_reloaded(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);
        $this->shell->answer('sshd -T 2>/dev/null | grep', 'passwordauthentication no');

        $this->actingAs($team->owner)
            ->putJson(route('server-users.sshd', $server), ['setting' => 'passwordauthentication', 'value' => 'no'])
            ->assertOk()
            ->assertJsonPath('message', 'sshd uses the new setting.');

        $this->assertStringContainsString("PasswordAuthentication no\n", (string) $this->shell->written('/etc/ssh/sshd_config.d/00-rackatlas.conf'));

        $script = (string) $this->shell->script('systemctl reload ssh');
        $this->assertLessThan(strpos($script, 'systemctl reload ssh'), strpos($script, 'sshd -t'));
    }

    public function test_members_need_the_permission_to_change_users(): void
    {
        $team = Team::factory()->create();
        $server = $this->keyServer($team);
        $member = User::factory()->create();
        $team->members()->attach($member->id, ['role' => TeamRole::Member->value, 'permissions' => null]);

        $this->actingAs($member)->get(route('server-users.index'))->assertOk();
        $this->actingAs($member)
            ->postJson(route('server-users.store', $server), ['name' => 'eve', 'shell' => '/bin/bash'])
            ->assertForbidden();

        $this->actingAs($team->owner)
            ->postJson(route('server-users.store', $server), ['name' => 'Eve;rm', 'shell' => '/bin/bash'])
            ->assertJsonValidationErrors('name');
    }
}
