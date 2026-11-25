<?php

namespace App\Http\Controllers;

use App\Exceptions\RemoteCommandException;
use App\Http\Controllers\Concerns\OperatesOverSsh;
use App\Models\Server;
use App\Services\Files\FileManagerSsh;
use App\Services\Files\RemotePath;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;
use Throwable;

/**
 * Browse, edit, upload and download the files of the servers with an SSH login.
 */
class FileManagerController extends Controller
{
    use OperatesOverSsh;

    private const PATH = ['required', 'string', 'max:4096'];

    public function index(Request $request): Response
    {
        $team = $request->user()->currentTeam();

        return Inertia::render('files/index', [
            'team' => $team?->only('id', 'name'),
            'servers' => $team ? $this->sshServers($team) : [],
            'canManage' => $team !== null && $request->user()->can('permit', [$team, 'files.edit']),
            'selected' => $request->integer('server') ?: null,
            'initialPath' => is_string($request->query('path')) ? $request->query('path') : null,
            'limits' => [
                'edit' => FileManagerSsh::EDIT_LIMIT,
                'download' => FileManagerSsh::DOWNLOAD_LIMIT,
                'upload' => $this->uploadLimit(),
            ],
        ]);
    }

    public function list(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.view');

        $data = $request->validate(['path' => ['nullable', 'string', 'max:4096']]);

        return $this->remote(fn () => $files->list($server, $data['path'] ?? null));
    }

    public function read(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.view');

        $data = $request->validate(['path' => self::PATH]);

        return $this->remote(fn () => $files->read($server, $data['path']));
    }

    public function save(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.edit');

        $data = $request->validate([
            'path' => self::PATH,
            'content' => ['present', 'nullable', 'string', 'max:'.FileManagerSsh::EDIT_LIMIT],
            'hash' => ['nullable', 'string', 'regex:/^[a-f0-9]{32}$/'],
            'backup' => ['boolean'],
            'validate' => ['boolean'],
        ]);

        return $this->remote(function () use ($request, $server, $files, $data) {
            $saved = $files->save($server, $data['path'], (string) ($data['content'] ?? ''), $data['hash'] ?? null, (bool) ($data['backup'] ?? false));

            $this->audit($request, $server, 'file-saved', ['path' => $data['path'], 'backup' => $saved['backup']]);

            $check = ($data['validate'] ?? false) && $files->validatorFor(RemotePath::normalize($data['path'])) !== null
                ? $files->validate($server, $data['path'])
                : null;

            return [...$saved, 'check' => $check, 'message' => __('Saved.')];
        });
    }

    public function create(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.edit');

        $data = $request->validate([
            'directory' => self::PATH,
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['file', 'dir'])],
        ]);

        return $this->remote(function () use ($request, $server, $files, $data) {
            $path = $files->create($server, $data['directory'], $data['name'], $data['type']);

            $this->audit($request, $server, $data['type'] === 'dir' ? 'directory-created' : 'file-created', ['path' => $path]);

            return ['path' => $path, 'message' => __('Created.')];
        });
    }

    public function move(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.edit');

        $data = $request->validate(['from' => self::PATH, 'to' => self::PATH, 'copy' => ['boolean']]);

        return $this->remote(function () use ($request, $server, $files, $data) {
            $copy = (bool) ($data['copy'] ?? false);
            $path = $copy
                ? $files->copy($server, $data['from'], $data['to'])
                : $files->move($server, $data['from'], $data['to']);

            $this->audit($request, $server, $copy ? 'file-copied' : 'file-moved', ['from' => $data['from'], 'to' => $path]);

            return ['path' => $path, 'message' => $copy ? __('Copied.') : __('Moved.')];
        });
    }

    public function destroy(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.edit');

        $data = $request->validate(['paths' => ['required', 'array', 'min:1', 'max:200'], 'paths.*' => self::PATH]);

        return $this->remote(function () use ($request, $server, $files, $data) {
            $files->delete($server, array_values($data['paths']));

            $this->audit($request, $server, 'files-deleted', ['paths' => array_values($data['paths'])]);

            return ['message' => trans_choice(':count item deleted.|:count items deleted.', count($data['paths']), ['count' => count($data['paths'])])];
        });
    }

    public function permissions(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.edit');

        $data = $request->validate([
            'paths' => ['required', 'array', 'min:1', 'max:200'],
            'paths.*' => self::PATH,
            'mode' => ['nullable', 'string', 'regex:/^[0-7]{3,4}$/'],
            'owner' => ['nullable', 'string', 'regex:/^[a-z_][a-z0-9_.-]{0,31}\$?$/i'],
            'group' => ['nullable', 'string', 'regex:/^[a-z_][a-z0-9_.-]{0,31}$/i'],
            'recursive' => ['boolean'],
        ]);

        if (empty($data['mode']) && empty($data['owner'])) {
            return response()->json(['message' => __('Choose the permissions or the owner.')], 422);
        }

        return $this->remote(function () use ($request, $server, $files, $data) {
            $paths = array_values($data['paths']);
            $recursive = (bool) ($data['recursive'] ?? false);

            if (! empty($data['mode'])) {
                $files->chmod($server, $paths, $data['mode'], $recursive);
            }

            if (! empty($data['owner'])) {
                $files->chown($server, $paths, $data['owner'], $data['group'] ?? null, $recursive);
            }

            $this->audit($request, $server, 'file-permissions-changed', Arr::only($data, ['paths', 'mode', 'owner', 'group', 'recursive']));

            return ['message' => __('Permissions changed.')];
        });
    }

    public function compress(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.edit');

        $data = $request->validate([
            'directory' => self::PATH,
            'names' => ['required', 'array', 'min:1', 'max:200'],
            'names.*' => ['required', 'string', 'max:255'],
            'archive' => ['required', 'string', 'max:255', 'regex:/\.(tar\.gz|zip)$/i'],
        ]);

        return $this->remote(function () use ($request, $server, $files, $data) {
            $path = $files->compress($server, $data['directory'], array_values($data['names']), $data['archive']);

            $this->audit($request, $server, 'files-compressed', ['archive' => $path, 'names' => $data['names']]);

            return ['path' => $path, 'message' => __('Archive created.')];
        });
    }

    public function extract(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.edit');

        $data = $request->validate(['path' => self::PATH]);

        return $this->remote(function () use ($request, $server, $files, $data) {
            $files->extract($server, $data['path']);

            $this->audit($request, $server, 'archive-extracted', ['path' => $data['path']]);

            return ['message' => __('Unpacked. Files that existed already were kept.')];
        });
    }

    public function search(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.view');

        $data = $request->validate([
            'directory' => self::PATH,
            'query' => ['required', 'string', 'min:2', 'max:100'],
            'contents' => ['boolean'],
        ]);

        return $this->remote(fn () => $files->search($server, $data['directory'], $data['query'], (bool) ($data['contents'] ?? false)));
    }

    public function size(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.view');

        $data = $request->validate(['path' => self::PATH]);

        return $this->remote(fn () => ['path' => $data['path'], 'bytes' => $files->size($server, $data['path'])]);
    }

    public function validateConfig(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.view');

        $data = $request->validate(['path' => self::PATH]);

        return $this->remote(fn () => $files->validate($server, $data['path']));
    }

    public function download(Request $request, Server $server, FileManagerSsh $files): HttpResponse
    {
        $this->authorizeServer($request, $server, 'files.view');

        $data = $request->validate(['path' => self::PATH]);

        try {
            $bytes = $files->download($server, $data['path']);
        } catch (RemoteCommandException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => mb_substr($e->getMessage(), 0, 500)], 502);
        }

        $this->audit($request, $server, 'file-downloaded', ['path' => $data['path']]);

        return response()->streamDownload(fn () => print ($bytes), basename(RemotePath::normalize($data['path'])) ?: 'download', [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => (string) strlen($bytes),
        ]);
    }

    public function upload(Request $request, Server $server, FileManagerSsh $files): JsonResponse
    {
        $this->authorizeServer($request, $server, 'files.edit');

        $data = $request->validate([
            'directory' => self::PATH,
            'files' => ['required', 'array', 'min:1', 'max:20'],
            'files.*' => ['required', 'file', 'max:'.intdiv($this->uploadLimit(), 1024)],
            'overwrite' => ['boolean'],
        ]);

        return $this->remote(function () use ($request, $server, $files, $data) {
            $uploaded = [];

            /** @var UploadedFile $file */
            foreach ($data['files'] as $file) {
                $uploaded[] = $files->upload(
                    $server,
                    $data['directory'],
                    $file->getClientOriginalName(),
                    $file->getRealPath(),
                    (bool) ($data['overwrite'] ?? false),
                );
            }

            $this->audit($request, $server, 'files-uploaded', ['paths' => $uploaded]);

            return [
                'paths' => $uploaded,
                'message' => trans_choice(':count file uploaded.|:count files uploaded.', count($uploaded), ['count' => count($uploaded)]),
            ];
        });
    }

    /**
     * The biggest upload PHP accepts, but never more than 50 MB.
     */
    private function uploadLimit(): int
    {
        $bytes = fn (string $value): int => (int) $value * match (strtolower(substr(trim($value), -1))) {
            'g' => 1024 ** 3,
            'm' => 1024 ** 2,
            'k' => 1024,
            default => 1,
        };

        $limits = array_filter([
            $bytes((string) ini_get('upload_max_filesize')),
            $bytes((string) ini_get('post_max_size')),
        ]);

        return min([50 * 1024 * 1024, ...$limits]);
    }
}
