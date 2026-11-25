<?php

namespace App\Services\Ssh;

use App\Exceptions\MetricsCollectionException;
use App\Models\Server;
use Illuminate\Support\Str;
use phpseclib4\Net\SFTP;

/**
 * Runs shell scripts on a server the app logs into over SSH, and moves files up to it. The firewall,
 * the file manager, cron and the updates all go through here, never through the agent.
 */
class RemoteShell
{
    /**
     * Sets $S to "sudo -n" when the login user is not root but may use sudo without a password, otherwise to
     * nothing. Every script starts with it and writes `$S command` where root is needed.
     */
    public const PRIVILEGE = 'if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then S="sudo -n"; else S=""; fi';

    /** Prints "root", "sudo" or "none": how much the login user may do. */
    public const WHO = 'if [ "$(id -u)" -eq 0 ]; then echo root; elif [ -n "$S" ]; then echo sudo; else echo none; fi';

    public function __construct(private readonly ServerMetricsCollector $ssh) {}

    /**
     * Run one script with `sh`. stdout and stderr are kept apart.
     *
     * @throws MetricsCollectionException when the server cannot be reached
     */
    public function run(Server $server, string $script, int $timeout = 25): RemoteResult
    {
        $ssh = $this->ssh->connect($server);

        try {
            $ssh->setTimeout($timeout);
            $ssh->enableQuietMode();

            $output = $ssh->exec('sh -c '.escapeshellarg(self::PRIVILEGE."\n".$script));
            $error = $ssh->getStdError();
            $exit = $ssh->getExitStatus();
            $timedOut = $ssh->isTimeout();
        } finally {
            $ssh->disconnect();
        }

        if ($timedOut) {
            return new RemoteResult($output, 124, 'The command did not finish within '.$timeout.' seconds.');
        }

        return new RemoteResult(
            $output,
            $exit ?? (trim($error) === '' ? 0 : 1),
            $error,
        );
    }

    /**
     * Put content into a new file in /tmp that only the login user can read, and return its path.
     * The script that uses it moves it into place (with sudo where needed) and removes it.
     *
     * @param  string  $contents  the bytes, or the path of a local file when $isLocalFile is true
     *
     * @throws MetricsCollectionException
     */
    public function upload(Server $server, string $contents, bool $isLocalFile = false): string
    {
        $path = '/tmp/.rackatlas-'.Str::lower(Str::random(24));
        $sftp = $this->ssh->connectSftp($server);

        try {
            $sftp->setTimeout(120);
            $sftp->put($path, '', SFTP::SOURCE_STRING);
            $sftp->chmod($path, 0600);
            $sftp->put($path, $contents, $isLocalFile ? SFTP::SOURCE_LOCAL_FILE : SFTP::SOURCE_STRING);
        } finally {
            $sftp->disconnect();
        }

        return $path;
    }

    /**
     * Whether a fresh login works. Used after a firewall change to see that the server can still be reached.
     */
    public function reachable(Server $server): bool
    {
        try {
            return $this->run($server, 'echo ok', 10)->output !== '';
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * A file the script writes on the server: base64 through printf, so no quoting can break it.
     * Fine for scripts and crontabs; anything big goes through upload().
     */
    public static function writeFile(string $path, string $contents, bool $privileged = true): string
    {
        return sprintf(
            'printf %%s %s | base64 -d | %stee -- %s >/dev/null',
            escapeshellarg(base64_encode($contents)),
            $privileged ? '$S ' : '',
            escapeshellarg($path),
        );
    }
}
