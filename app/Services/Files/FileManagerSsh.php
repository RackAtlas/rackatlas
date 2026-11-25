<?php

namespace App\Services\Files;

use App\Exceptions\MetricsCollectionException;
use App\Exceptions\RemoteCommandException;
use App\Models\Server;
use App\Services\Ssh\RemoteResult;
use App\Services\Ssh\RemoteShell;

/**
 * The files of a server over SSH. Everything runs as root when the login user may use sudo, so system
 * configuration can be edited too. Saving checks that nobody changed the file in the meantime and keeps
 * a copy of the previous version next to it.
 */
class FileManagerSsh
{
    /** Bigger files are shown read-only, as their last lines. */
    public const EDIT_LIMIT = 1024 * 1024;

    public const DOWNLOAD_LIMIT = 25 * 1024 * 1024;

    private const LIST_LIMIT = 3000;

    private const SEARCH_LIMIT = 300;

    private const TAIL_LINES = 1000;

    /**
     * The config test for files under these paths, run after saving when asked.
     *
     * @var array<string, array{label: string, command: string}>
     */
    public const VALIDATORS = [
        '/etc/nginx/' => ['label' => 'nginx -t', 'command' => 'nginx -t'],
        '/etc/apache2/' => ['label' => 'apache2ctl configtest', 'command' => 'apache2ctl configtest'],
        '/etc/httpd/' => ['label' => 'httpd -t', 'command' => 'httpd -t'],
        '/etc/haproxy/' => ['label' => 'haproxy -c', 'command' => 'haproxy -c -f /etc/haproxy/haproxy.cfg'],
        '/etc/ssh/sshd_config' => ['label' => 'sshd -t', 'command' => 'sshd -t'],
        '/etc/sudoers' => ['label' => 'visudo -c', 'command' => 'visudo -c'],
        '/etc/caddy/' => ['label' => 'caddy validate', 'command' => 'caddy validate --config /etc/caddy/Caddyfile'],
        '/etc/systemd/' => ['label' => 'systemd-analyze verify', 'command' => 'systemd-analyze verify %s'],
        '/etc/fstab' => ['label' => 'findmnt --verify', 'command' => 'findmnt --verify'],
        '/etc/php/' => ['label' => 'php-fpm -t', 'command' => 'for B in /usr/sbin/php-fpm*; do [ -x "$B" ] && "$B" -t; done'],
    ];

    public function __construct(private readonly RemoteShell $shell) {}

    /**
     * The entries of a directory. Without a path the home directory of the login user is listed.
     *
     * @return array{path: string, entries: list<array<string, mixed>>, truncated: bool, privilege: string, writable: bool}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function list(Server $server, ?string $path): array
    {
        $assign = $path === null ? 'P="$HOME"' : 'P='.RemotePath::quote(RemotePath::normalize($path));

        $result = $this->shell->run($server, $assign."\n".<<<'SH'
            [ -n "$P" ] || P=/
            $S test -d "$P" || { echo "The directory does not exist or cannot be opened." >&2; exit 2; }
            P=$(cd "$P" 2>/dev/null && pwd -P || echo "$P")
            echo "###PATH"; echo "$P"
            echo "###WHO"; [ "$(id -u)" -eq 0 ] && echo root || { [ -n "$S" ] && echo sudo || echo none; }
            echo "###WRITABLE"; $S test -w "$P" && echo yes
            echo "###ENTRIES"
            $S find -H "$P" -mindepth 1 -maxdepth 1 -printf '%y\t%Y\t%m\t%u\t%g\t%s\t%T@\t%l\t%f\n' 2>/dev/null | head -n 3001
            SH, 30);

        $this->assertOk($result);

        $sections = $result->sections();
        $entries = [];

        foreach (preg_split('/\n/', $sections['ENTRIES'] ?? '') ?: [] as $line) {
            $columns = explode("\t", $line, 9);

            if (count($columns) < 9) {
                continue;
            }

            [$type, $target, $mode, $owner, $group, $size, $mtime, $link, $name] = $columns;

            $entries[] = [
                'name' => $name,
                'type' => match ($type) {
                    'd' => 'dir',
                    'l' => 'link',
                    'f' => 'file',
                    default => 'other',
                },
                'link_target' => $type === 'l' ? $link : null,
                'link_dir' => $type === 'l' && $target === 'd',
                'mode' => str_pad($mode, 3, '0', STR_PAD_LEFT),
                'owner' => $owner,
                'group' => $group,
                'size' => (int) $size,
                'mtime' => (int) $mtime,
            ];
        }

        return [
            'path' => RemotePath::normalize(trim($sections['PATH'] ?? '/') ?: '/'),
            'entries' => array_slice($entries, 0, self::LIST_LIMIT),
            'truncated' => count($entries) > self::LIST_LIMIT,
            'privilege' => trim($sections['WHO'] ?? 'none') ?: 'none',
            'writable' => trim($sections['WRITABLE'] ?? '') === 'yes',
        ];
    }

    /**
     * A file for the editor: its content when it is text and small enough, otherwise the last lines.
     *
     * @return array{path: string, size: int, mode: string, owner: string, group: string, mtime: int, hash: string|null, content: string|null, binary: bool, tail: bool, editable: bool, validator: string|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function read(Server $server, string $path): array
    {
        $path = RemotePath::normalize($path);
        RemotePath::assertReadable($path);

        $result = $this->shell->run($server, 'P='.RemotePath::quote($path)."\nLIMIT=".self::EDIT_LIMIT."\nLINES=".self::TAIL_LINES."\n".<<<'SH'
            $S test -f "$P" || { echo "This is not a regular file." >&2; exit 2; }
            $S test -r "$P" || { echo "The file cannot be read." >&2; exit 13; }
            echo "###STAT"; $S stat --printf '%s\t%a\t%U\t%G\t%Y\n' -- "$P"
            SIZE=$($S stat -c %s -- "$P")
            echo "###HASH"; $S md5sum -- "$P" | cut -d' ' -f1
            if [ "$SIZE" -le "$LIMIT" ]; then
                echo "###CONTENT"; $S cat -- "$P" | base64 | tr -d '\n'; echo
            else
                echo "###TAIL"; $S tail -n "$LINES" -- "$P" | head -c "$LIMIT" | base64 | tr -d '\n'; echo
            fi
            SH, 40);

        $this->assertOk($result);

        $sections = $result->sections();
        [$size, $mode, $owner, $group, $mtime] = array_pad(explode("\t", trim($sections['STAT'] ?? '')), 5, '');

        $tail = array_key_exists('TAIL', $sections);
        $bytes = base64_decode(trim($sections[$tail ? 'TAIL' : 'CONTENT'] ?? ''), true);
        $bytes = $bytes === false ? '' : $bytes;
        $binary = str_contains($bytes, "\0") || ! mb_check_encoding($bytes, 'UTF-8');

        return [
            'path' => $path,
            'size' => (int) $size,
            'mode' => str_pad($mode, 3, '0', STR_PAD_LEFT),
            'owner' => $owner,
            'group' => $group,
            'mtime' => (int) $mtime,
            'hash' => trim($sections['HASH'] ?? '') ?: null,
            'content' => $binary ? null : $bytes,
            'binary' => $binary,
            'tail' => $tail,
            'editable' => ! $binary && ! $tail,
            'validator' => $this->validatorFor($path)['label'] ?? null,
        ];
    }

    /**
     * Save new content. When $expectedHash is given and the file changed since it was read, nothing is written.
     *
     * @return array{hash: string|null, backup: string|null}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function save(Server $server, string $path, string $content, ?string $expectedHash, bool $backup): array
    {
        $path = RemotePath::normalize($path);
        RemotePath::assertWritable($path);

        if (strlen($content) > self::EDIT_LIMIT) {
            throw new RemoteCommandException(__('The file is too big to be saved from the editor.'));
        }

        $temp = $this->shell->upload($server, $content);
        $backupPath = $backup ? $path.'.bak-'.now()->format('Ymd-His') : '';

        $result = $this->shell->run($server, implode("\n", [
            'P='.RemotePath::quote($path),
            'T='.RemotePath::quote($temp),
            'H='.escapeshellarg((string) $expectedHash),
            'B='.escapeshellarg($backupPath),
            <<<'SH'
            trap 'rm -f "$T"' EXIT
            if [ -n "$H" ] && $S test -e "$P"; then
                CUR=$($S md5sum -- "$P" | cut -d' ' -f1)
                [ "$CUR" = "$H" ] || { echo "###CONFLICT"; exit 9; }
            fi
            if [ -n "$B" ] && $S test -e "$P"; then $S cp -p -- "$P" "$B" || exit 1; echo "###BACKUP"; echo "$B"; fi
            if $S test -e "$P"; then $S cp -- "$T" "$P" || exit 1; else $S cp -- "$T" "$P" && $S chmod 644 -- "$P" || exit 1; fi
            echo "###HASH"; $S md5sum -- "$P" | cut -d' ' -f1
            SH,
        ]), 40);

        if (str_contains($result->output, '###CONFLICT')) {
            throw RemoteCommandException::conflict(__('The file was changed on the server after you opened it. Load it again or overwrite it.'));
        }

        $this->assertOk($result);
        $sections = $result->sections();

        return [
            'hash' => trim($sections['HASH'] ?? '') ?: null,
            'backup' => trim($sections['BACKUP'] ?? '') ?: null,
        ];
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function create(Server $server, string $directory, string $name, string $type): string
    {
        $path = RemotePath::join(RemotePath::normalize($directory), RemotePath::name($name));
        RemotePath::assertWritable($path);

        $command = $type === 'dir'
            ? '$S mkdir -- "$P"'
            : '$S sh -c \': > "$1"\' _ "$P"';

        $this->runChecked($server, 'P='.RemotePath::quote($path)."\n".'$S test -e "$P" && { echo "Something with this name exists already." >&2; exit 17; }'."\n".$command);

        return $path;
    }

    /**
     * Rename or move. An existing target is never overwritten.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function move(Server $server, string $from, string $to): string
    {
        $from = RemotePath::normalize($from);
        $to = RemotePath::normalize($to);
        RemotePath::assertChangeable($from);
        RemotePath::assertWritable($to);

        $this->runChecked($server, sprintf(
            "F=%s\nD=%s\n%s",
            RemotePath::quote($from),
            RemotePath::quote($to),
            '$S test -e "$D" && { echo "Something with this name exists already." >&2; exit 17; }; $S mv -n -- "$F" "$D"',
        ));

        return $to;
    }

    /**
     * Copy a file or a whole directory, keeping modes and owners.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function copy(Server $server, string $from, string $to): string
    {
        $from = RemotePath::normalize($from);
        $to = RemotePath::normalize($to);
        RemotePath::assertWritable($to);

        $this->runChecked($server, sprintf(
            "F=%s\nD=%s\n%s",
            RemotePath::quote($from),
            RemotePath::quote($to),
            '$S test -e "$D" && { echo "Something with this name exists already." >&2; exit 17; }; $S cp -a -- "$F" "$D"',
        ), 120);

        return $to;
    }

    /**
     * @param  list<string>  $paths
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function delete(Server $server, array $paths): void
    {
        $paths = $this->changeable($paths);

        $this->runChecked($server, '$S rm -rf -- '.implode(' ', array_map(RemotePath::quote(...), $paths)), 120);
    }

    /**
     * @param  list<string>  $paths
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function chmod(Server $server, array $paths, string $mode, bool $recursive): void
    {
        $paths = $recursive ? $this->changeable($paths) : $this->writable($paths);

        $this->runChecked($server, sprintf(
            '$S chmod %s%s -- %s',
            $recursive ? '-R ' : '',
            escapeshellarg($mode),
            implode(' ', array_map(RemotePath::quote(...), $paths)),
        ), 120);
    }

    /**
     * @param  list<string>  $paths
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function chown(Server $server, array $paths, string $owner, ?string $group, bool $recursive): void
    {
        $paths = $recursive ? $this->changeable($paths) : $this->writable($paths);

        $this->runChecked($server, sprintf(
            '$S chown %s%s -- %s',
            $recursive ? '-R ' : '',
            escapeshellarg($owner.($group ? ':'.$group : '')),
            implode(' ', array_map(RemotePath::quote(...), $paths)),
        ), 120);
    }

    /**
     * Pack entries of one directory into a .tar.gz or .zip next to them.
     *
     * @param  list<string>  $names
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function compress(Server $server, string $directory, array $names, string $archive): string
    {
        $directory = RemotePath::normalize($directory);
        $archive = RemotePath::name($archive);
        $names = array_map(RemotePath::name(...), $names);
        $target = RemotePath::join($directory, $archive);
        RemotePath::assertWritable($target);

        $zip = str_ends_with(strtolower($archive), '.zip');
        $list = implode(' ', array_map(fn (string $name) => escapeshellarg($name), $names));

        $this->runChecked($server, sprintf(
            "cd %s || exit 2\n\$S test -e %s && { echo \"Something with this name exists already.\" >&2; exit 17; }\n%s",
            RemotePath::quote($directory),
            escapeshellarg($archive),
            $zip
                ? 'command -v zip >/dev/null 2>&1 || { echo "zip is not installed on this server." >&2; exit 127; }; $S zip -qr '.escapeshellarg($archive).' -- '.$list
                : '$S tar -czf '.escapeshellarg($archive).' -- '.$list,
        ), 300);

        return $target;
    }

    /**
     * Unpack a .tar, .tar.gz, .tgz, .tar.bz2, .tar.xz or .zip into the directory it lies in.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function extract(Server $server, string $path): void
    {
        $path = RemotePath::normalize($path);
        $directory = RemotePath::parent($path);
        RemotePath::assertWritable($directory);

        $command = match (true) {
            str_ends_with(strtolower($path), '.zip') => 'command -v unzip >/dev/null 2>&1 || { echo "unzip is not installed on this server." >&2; exit 127; }; $S unzip -qn -- "$P" -d "$D"',
            preg_match('/\.(tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz)$/i', $path) === 1 => '$S tar -xf "$P" -C "$D" --no-same-owner --keep-old-files',
            default => throw new RemoteCommandException(__('This kind of archive cannot be unpacked here.')),
        };

        $this->runChecked($server, sprintf("P=%s\nD=%s\n%s", RemotePath::quote($path), RemotePath::quote($directory), $command), 300);
    }

    /**
     * Find files and directories whose name contains the text, at most a few levels deep.
     *
     * @return array{results: list<array{path: string, type: string, size: int, mtime: int}>, truncated: bool}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function search(Server $server, string $directory, string $query, bool $contents): array
    {
        $directory = RemotePath::normalize($directory);
        $pattern = '*'.str_replace(['\\', '*', '?', '['], ['\\\\', '\\*', '\\?', '\\['], $query).'*';

        $find = $contents
            ? '$S grep -rIl --exclude-dir=proc --exclude-dir=sys -F -- "$Q" "$P" 2>/dev/null | head -n '.(self::SEARCH_LIMIT + 1).' | while IFS= read -r F; do $S stat --printf "f\t%s\t%Y\t%n\n" -- "$F"; done'
            : '$S find "$P" -maxdepth 8 \( -path /proc -o -path /sys -o -path /dev \) -prune -o -iname "$N" -printf "%y\t%s\t%T@\t%p\n" 2>/dev/null | head -n '.(self::SEARCH_LIMIT + 1);

        $result = $this->shell->run($server, sprintf(
            "P=%s\nN=%s\nQ=%s\n%s",
            RemotePath::quote($directory),
            escapeshellarg($pattern),
            escapeshellarg($query),
            $find,
        ), 60);

        if ($result->exitCode === 124) {
            throw new RemoteCommandException(__('The search took too long. Search in a smaller directory.'));
        }

        $results = [];

        foreach (preg_split('/\n/', trim($result->output)) ?: [] as $line) {
            $columns = explode("\t", $line, 4);

            if (count($columns) === 4) {
                $results[] = [
                    'path' => $columns[3],
                    'type' => $columns[0] === 'd' ? 'dir' : ($columns[0] === 'l' ? 'link' : 'file'),
                    'size' => (int) $columns[1],
                    'mtime' => (int) $columns[2],
                ];
            }
        }

        return [
            'results' => array_slice($results, 0, self::SEARCH_LIMIT),
            'truncated' => count($results) > self::SEARCH_LIMIT,
        ];
    }

    /**
     * How much space a file or directory takes.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function size(Server $server, string $path): int
    {
        $result = $this->runChecked($server, '$S du -sb -- '.RemotePath::quote(RemotePath::normalize($path)).' 2>/dev/null | cut -f1', 90);

        return (int) trim($result->output);
    }

    /**
     * The bytes of a file for download.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function download(Server $server, string $path): string
    {
        $path = RemotePath::normalize($path);
        RemotePath::assertReadable($path);

        $result = $this->runChecked($server, sprintf(
            "P=%s\n%s",
            RemotePath::quote($path),
            '$S test -f "$P" || { echo "Only files can be downloaded." >&2; exit 2; }; '
            .'[ "$($S stat -c %s -- "$P")" -le '.self::DOWNLOAD_LIMIT.' ] || { echo "The file is bigger than 25 MB. Download it with scp or the terminal." >&2; exit 27; }; '
            .'$S cat -- "$P" | base64 | tr -d "\n"',
        ), 180);

        $bytes = base64_decode(trim($result->output), true);

        if ($bytes === false) {
            throw new RemoteCommandException(__('The file could not be read.'));
        }

        return $bytes;
    }

    /**
     * Upload one local file into a directory of the server.
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function upload(Server $server, string $directory, string $name, string $localPath, bool $overwrite): string
    {
        $target = RemotePath::join(RemotePath::normalize($directory), RemotePath::name($name));
        RemotePath::assertWritable($target);

        $temp = $this->shell->upload($server, $localPath, true);

        $this->runChecked($server, implode("\n", [
            'P='.RemotePath::quote($target),
            'T='.RemotePath::quote($temp),
            'O='.($overwrite ? '1' : ''),
            <<<'SH'
            trap 'rm -f "$T"' EXIT
            if $S test -e "$P"; then
                [ -n "$O" ] || { echo "A file with this name exists already." >&2; exit 17; }
                $S test -d "$P" && { echo "A directory with this name exists." >&2; exit 21; }
                $S cp -- "$T" "$P"
            else
                $S cp -- "$T" "$P" && $S chmod 644 -- "$P"
            fi
            SH,
        ]), 180);

        return $target;
    }

    /**
     * Run the config test that belongs to the file, as `nginx -t` for files under /etc/nginx.
     *
     * @return array{ok: bool, command: string, output: string}
     *
     * @throws MetricsCollectionException|RemoteCommandException
     */
    public function validate(Server $server, string $path): array
    {
        $path = RemotePath::normalize($path);
        $validator = $this->validatorFor($path);

        if ($validator === null) {
            throw new RemoteCommandException(__('There is no config test for this file.'));
        }

        $command = str_contains($validator['command'], '%s')
            ? sprintf($validator['command'], RemotePath::quote($path))
            : $validator['command'];

        $result = $this->shell->run($server, '$S sh -c '.escapeshellarg($command).' 2>&1', 60);

        return [
            'ok' => $result->ok(),
            'command' => $validator['label'],
            'output' => trim(mb_substr(trim($result->output."\n".$result->error), 0, 8000)),
        ];
    }

    /**
     * @return array{label: string, command: string}|null
     */
    public function validatorFor(string $path): ?array
    {
        foreach (self::VALIDATORS as $prefix => $validator) {
            if (str_ends_with($prefix, '/') ? str_starts_with($path, $prefix) : ($path === $prefix || str_starts_with($path, $prefix.'.d/'))) {
                return $validator;
            }
        }

        return null;
    }

    /**
     * @param  list<string>  $paths
     * @return list<string>
     *
     * @throws RemoteCommandException
     */
    private function changeable(array $paths): array
    {
        return array_map(function (string $path) {
            $path = RemotePath::normalize($path);
            RemotePath::assertChangeable($path);

            return $path;
        }, $paths);
    }

    /**
     * @param  list<string>  $paths
     * @return list<string>
     *
     * @throws RemoteCommandException
     */
    private function writable(array $paths): array
    {
        return array_map(function (string $path) {
            $path = RemotePath::normalize($path);
            RemotePath::assertWritable($path);

            return $path;
        }, $paths);
    }

    /**
     * @throws MetricsCollectionException|RemoteCommandException
     */
    private function runChecked(Server $server, string $script, int $timeout = 30): RemoteResult
    {
        $result = $this->shell->run($server, $script, $timeout);

        $this->assertOk($result);

        return $result;
    }

    /**
     * @throws RemoteCommandException
     */
    private function assertOk(RemoteResult $result): void
    {
        if (! $result->ok()) {
            throw new RemoteCommandException($result->message());
        }
    }
}
