<?php

namespace Tests\Feature;

use App\Enums\TeamRole;
use App\Exceptions\RemoteCommandException;
use App\Models\Server;
use App\Models\Team;
use App\Models\User;
use App\Services\Files\RemotePath;
use App\Services\Ssh\RemoteShell;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Spatie\Activitylog\Models\Activity;
use Tests\Feature\Services\Ssh\FakeRemoteShell;
use Tests\TestCase;

class FileManagerTest extends TestCase
{
    use LazilyRefreshDatabase;

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
            'name' => 'web', 'host' => '8.8.8.8', 'port' => 22, 'username' => 'deploy',
            'auth_type' => 'password', 'password' => 'secret',
        ]);
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

    public function test_a_directory_lists_its_entries(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->shell->answer('###ENTRIES', implode("\n", [
            '###PATH', '/var/www',
            '###WHO', 'sudo',
            '###WRITABLE', 'yes',
            '###ENTRIES',
            "d\td\t755\twww-data\twww-data\t4096\t1700000000.5\t\tsite",
            "f\tf\t644\troot\troot\t1234\t1700000100.0\t\tindex.php",
            "l\td\t777\troot\troot\t7\t1700000200.0\t/srv/current\tcurrent",
            "f\tf\t600\troot\troot\t10\t1700000300.0\t\tname\twith tab",
        ]));

        $this->actingAs($team->owner)
            ->postJson(route('files.list', $server), ['path' => '/var/www/../www/./'])
            ->assertOk()
            ->assertJsonPath('path', '/var/www')
            ->assertJsonPath('privilege', 'sudo')
            ->assertJsonPath('writable', true)
            ->assertJsonCount(4, 'entries')
            ->assertJsonPath('entries.0.type', 'dir')
            ->assertJsonPath('entries.1.size', 1234)
            ->assertJsonPath('entries.2.type', 'link')
            ->assertJsonPath('entries.2.link_dir', true)
            ->assertJsonPath('entries.2.link_target', '/srv/current')
            ->assertJsonPath('entries.3.name', "name\twith tab");

        $this->assertTrue($this->shell->ran("P='/var/www'"), 'The path is made plain before it reaches the shell.');
    }

    public function test_the_files_are_closed_for_a_member_until_someone_opens_them(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($this->member($team))->get(route('files.index'))->assertForbidden();
        $this->actingAs($this->member($team))->postJson(route('files.list', $server))->assertForbidden();

        $reader = $this->member($team, ['files' => 'view']);
        $this->actingAs($reader)->postJson(route('files.list', $server))->assertOk();
        $this->actingAs($reader)
            ->putJson(route('files.save', $server), ['path' => '/etc/hosts', 'content' => 'x'])
            ->assertForbidden();
    }

    public function test_a_text_file_opens_for_editing_and_a_binary_one_does_not(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->shell->answer("P='/etc/nginx/nginx.conf'", implode("\n", [
            '###STAT', "57\t644\troot\troot\t1700000000",
            '###HASH', 'd41d8cd98f00b204e9800998ecf8427e',
            '###CONTENT', base64_encode("user www-data;\nworker_processes auto;\n"),
        ]));
        $this->shell->answer("P='/usr/bin/ls'", implode("\n", [
            '###STAT', "4\t755\troot\troot\t1700000000",
            '###HASH', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            '###CONTENT', base64_encode("\x7FELF\0\0"),
        ]));

        $this->actingAs($team->owner)
            ->postJson(route('files.read', $server), ['path' => '/etc/nginx/nginx.conf'])
            ->assertOk()
            ->assertJsonPath('content', "user www-data;\nworker_processes auto;\n")
            ->assertJsonPath('editable', true)
            ->assertJsonPath('validator', 'nginx -t');

        $this->actingAs($team->owner)
            ->postJson(route('files.read', $server), ['path' => '/usr/bin/ls'])
            ->assertOk()
            ->assertJsonPath('binary', true)
            ->assertJsonPath('editable', false)
            ->assertJsonPath('content', null);
    }

    public function test_saving_keeps_a_backup_and_refuses_when_the_file_changed_meanwhile(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);
        $hash = str_repeat('a', 32);

        $this->shell->answer("H='".$hash."'", "###BACKUP\n/etc/hosts.bak-1\n###HASH\n".str_repeat('b', 32));

        $this->actingAs($team->owner)
            ->putJson(route('files.save', $server), ['path' => '/etc/hosts', 'content' => "127.0.0.1 localhost\n", 'hash' => $hash, 'backup' => true])
            ->assertOk()
            ->assertJsonPath('backup', '/etc/hosts.bak-1')
            ->assertJsonPath('hash', str_repeat('b', 32));

        $this->assertSame(["127.0.0.1 localhost\n"], $this->shell->uploads);
        $this->assertTrue(Activity::query()->where('event', 'file-saved')->exists());

        $stale = str_repeat('c', 32);
        $this->shell->answer("H='".$stale."'", '###CONFLICT', 9);

        $this->actingAs($team->owner)
            ->putJson(route('files.save', $server), ['path' => '/etc/hosts', 'content' => 'x', 'hash' => $stale])
            ->assertStatus(409);
    }

    public function test_system_directories_are_never_deleted(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($team->owner)
            ->deleteJson(route('files.destroy', $server), ['paths' => ['/var/www/site/old.txt', '/etc/']])
            ->assertUnprocessable();

        $this->actingAs($team->owner)
            ->deleteJson(route('files.destroy', $server), ['paths' => ['/var/www/../../usr']])
            ->assertUnprocessable();

        $this->assertSame([], $this->shell->scripts);

        $this->actingAs($team->owner)
            ->deleteJson(route('files.destroy', $server), ['paths' => ["/var/www/site/it's old.txt"]])
            ->assertOk();

        $this->assertTrue($this->shell->ran("\$S rm -rf -- '/var/www/site/it'\\''s old.txt'"));
    }

    public function test_permissions_and_owner_change_with_checked_values(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($team->owner)
            ->putJson(route('files.permissions', $server), ['paths' => ['/var/www/site'], 'mode' => '7777x'])
            ->assertUnprocessable();

        $this->actingAs($team->owner)
            ->putJson(route('files.permissions', $server), ['paths' => ['/var/www'], 'mode' => '755', 'recursive' => true])
            ->assertUnprocessable();

        $this->actingAs($team->owner)
            ->putJson(route('files.permissions', $server), [
                'paths' => ['/var/www/site'], 'mode' => '750', 'owner' => 'www-data', 'group' => 'www-data', 'recursive' => true,
            ])
            ->assertOk();

        $this->assertTrue($this->shell->ran("\$S chmod -R '750' -- '/var/www/site'"));
        $this->assertTrue($this->shell->ran("\$S chown -R 'www-data:www-data' -- '/var/www/site'"));
    }

    public function test_files_are_uploaded_and_downloaded(): void
    {
        $team = Team::factory()->create();
        $server = $this->sshServer($team);

        $this->actingAs($team->owner)
            ->post(route('files.upload', $server), [
                'directory' => '/var/www/site',
                'files' => [UploadedFile::fake()->createWithContent('robots.txt', "User-agent: *\n")],
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->assertSame(["User-agent: *\n"], $this->shell->uploads);
        $this->assertTrue($this->shell->ran("P='/var/www/site/robots.txt'"));

        $this->shell->answer('Only files can be downloaded.', base64_encode('hello'));

        $response = $this->actingAs($team->owner)
            ->postJson(route('files.download', $server), ['path' => '/var/www/site/robots.txt'])
            ->assertOk();

        $this->assertSame('hello', $response->streamedContent());
        $this->assertStringContainsString('robots.txt', (string) $response->headers->get('Content-Disposition'));
    }

    public function test_remote_paths_are_made_plain_and_checked(): void
    {
        $this->assertSame('/etc', RemotePath::normalize('/var/../etc/./'));
        $this->assertSame('/', RemotePath::normalize('/../..'));
        $this->assertSame('/', RemotePath::normalize(''));

        foreach (['relative/path', "/etc/\npasswd", "/a\0b"] as $invalid) {
            try {
                RemotePath::normalize($invalid);
                $this->fail("{$invalid} should be refused.");
            } catch (RemoteCommandException) {
                $this->addToAssertionCount(1);
            }
        }

        $this->expectException(RemoteCommandException::class);
        RemotePath::assertWritable('/proc/sys/kernel/hostname');
    }
}
