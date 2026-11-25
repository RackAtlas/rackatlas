<?php

namespace App\Services\Files;

use App\Exceptions\RemoteCommandException;

/**
 * Paths on a remote server: made absolute and plain before they reach a shell, and the places that are
 * never deleted, moved or changed recursively from the file manager.
 */
final class RemotePath
{
    /** Directories whose loss breaks the system. They can be opened, but not deleted, moved or changed recursively. */
    public const SYSTEM = [
        '/', '/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/lib32', '/lib64', '/libx32', '/media', '/mnt',
        '/opt', '/proc', '/root', '/run', '/sbin', '/srv', '/sys', '/tmp', '/usr', '/var', '/etc/ssh', '/etc/ufw',
        '/usr/bin', '/usr/lib', '/usr/local', '/usr/sbin', '/usr/share', '/var/lib', '/var/log', '/var/www',
        '/var/spool', '/var/cache', '/var/backups', '/var/mail', '/etc/systemd', '/etc/apt',
    ];

    /** Kernel and device trees: nothing in them is written, and devices are not read. */
    private const VIRTUAL = ['/proc', '/sys', '/dev'];

    /**
     * @throws RemoteCommandException
     */
    public static function normalize(?string $path): string
    {
        $path = trim((string) $path);

        if ($path === '') {
            return '/';
        }

        if (preg_match('/[\x00-\x1F\x7F]/', $path) === 1 || ! str_starts_with($path, '/') || mb_strlen($path) > 4096) {
            throw new RemoteCommandException(__('The path is not valid.'));
        }

        $parts = [];

        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.') {
                continue;
            }

            if ($part === '..') {
                array_pop($parts);

                continue;
            }

            $parts[] = $part;
        }

        return '/'.implode('/', $parts);
    }

    /**
     * A single file or directory name, without a slash.
     *
     * @throws RemoteCommandException
     */
    public static function name(string $name): string
    {
        $name = trim($name);

        if ($name === '' || $name === '.' || $name === '..' || str_contains($name, '/') || preg_match('/[\x00-\x1F\x7F]/', $name) === 1 || strlen($name) > 255) {
            throw new RemoteCommandException(__('The name is not valid.'));
        }

        return $name;
    }

    public static function join(string $directory, string $name): string
    {
        return rtrim($directory, '/').'/'.$name;
    }

    public static function parent(string $path): string
    {
        $parent = dirname($path);

        return $parent === '.' ? '/' : $parent;
    }

    /**
     * @throws RemoteCommandException
     */
    public static function assertChangeable(string $path): void
    {
        if (in_array($path, self::SYSTEM, true)) {
            throw new RemoteCommandException(__(':path is a system directory and cannot be deleted, moved or changed recursively here.', ['path' => $path]));
        }

        self::assertWritable($path);
    }

    /**
     * @throws RemoteCommandException
     */
    public static function assertWritable(string $path): void
    {
        foreach (self::VIRTUAL as $root) {
            if ($path === $root || str_starts_with($path, $root.'/')) {
                throw new RemoteCommandException(__('Nothing in :path can be changed from the file manager.', ['path' => $root]));
            }
        }
    }

    /**
     * @throws RemoteCommandException
     */
    public static function assertReadable(string $path): void
    {
        if ($path === '/dev' || str_starts_with($path, '/dev/')) {
            throw new RemoteCommandException(__('Devices cannot be opened in the file manager.'));
        }
    }

    public static function quote(string $path): string
    {
        return escapeshellarg($path);
    }
}
