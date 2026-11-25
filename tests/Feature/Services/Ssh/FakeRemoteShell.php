<?php

namespace Tests\Feature\Services\Ssh;

use App\Models\Server;
use App\Services\Ssh\RemoteResult;
use App\Services\Ssh\RemoteShell;
use App\Services\Ssh\ServerMetricsCollector;
use Mockery;

/**
 * Stands in for the SSH connection: answers scripts by a piece of text they contain and remembers
 * every script, so a test can check what would have run on the server.
 */
class FakeRemoteShell extends RemoteShell
{
    /** @var list<string> */
    public array $scripts = [];

    /** @var list<string> */
    public array $uploads = [];

    public bool $isReachable = true;

    /** @var list<array{0: string, 1: RemoteResult}> */
    private array $answers = [];

    public function __construct()
    {
        parent::__construct(Mockery::mock(ServerMetricsCollector::class));
    }

    public function answer(string $needle, string $output, int $exitCode = 0, string $error = ''): self
    {
        $this->answers[] = [$needle, new RemoteResult($output, $exitCode, $error)];

        return $this;
    }

    public function run(Server $server, string $script, int $timeout = 25): RemoteResult
    {
        $this->scripts[] = $script;

        foreach ($this->answers as [$needle, $result]) {
            if (str_contains($script, $needle)) {
                return $result;
            }
        }

        return new RemoteResult('');
    }

    public function upload(Server $server, string $contents, bool $isLocalFile = false): string
    {
        $this->uploads[] = $isLocalFile ? (string) file_get_contents($contents) : $contents;

        return '/tmp/.rackatlas-test';
    }

    public function reachable(Server $server): bool
    {
        return $this->isReachable;
    }

    public function ran(string $needle): bool
    {
        foreach ($this->scripts as $script) {
            if (str_contains($script, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * The script that contains the text, for closer checks.
     */
    public function script(string $needle): ?string
    {
        foreach ($this->scripts as $script) {
            if (str_contains($script, $needle)) {
                return $script;
            }
        }

        return null;
    }

    /**
     * The contents a script writes through RemoteShell::writeFile() to the given path.
     */
    public function written(string $path): ?string
    {
        foreach ($this->scripts as $script) {
            if (preg_match("/printf %s '([A-Za-z0-9+\\/=]+)' \\| base64 -d \\| [^\\n]*tee -- '".preg_quote($path, '/')."'/", $script, $match) === 1) {
                return base64_decode($match[1]);
            }

            if (preg_match("/printf %s '([A-Za-z0-9+\\/=]*)' \\| base64 -d \\| \\\$C -/", $script, $match) === 1 && $path === 'crontab') {
                return base64_decode($match[1]);
            }
        }

        return null;
    }
}
