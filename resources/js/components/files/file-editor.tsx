import { CheckCircle2, Download, FileWarning, RefreshCw, Save, ShieldCheck, WrapText, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import FileManagerController from '@/actions/App/Http/Controllers/FileManagerController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { formatBytes } from '@/lib/dashboard';
import { errorMessage, ServerApiError, serverRequest } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import { modeString } from './permissions-dialog';

type OpenedFile = {
    path: string;
    size: number;
    mode: string;
    owner: string;
    group: string;
    mtime: number;
    hash: string | null;
    content: string | null;
    binary: boolean;
    tail: boolean;
    editable: boolean;
    validator: string | null;
};

type Check = { ok: boolean; command: string; output: string };

type SaveAnswer = { hash: string | null; backup: string | null; check: Check | null; message: string };

const BACKUP_STORAGE = 'files.backup';

export function FileEditor({
    serverId,
    path,
    canEdit,
    onClose,
    onSaved,
    onDownload,
}: {
    serverId: number;
    path: string;
    canEdit: boolean;
    onClose: () => void;
    onSaved: () => void;
    onDownload: (path: string) => void;
}) {
    const { t } = useTranslation();
    const [file, setFile] = useState<OpenedFile | null>(null);
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [wrap, setWrap] = useState(false);
    const [check, setCheck] = useState<Check | null>(null);
    const [checking, setChecking] = useState(false);
    const [backup, setBackup] = useState(() => {
        try {
            return localStorage.getItem(BACKUP_STORAGE) !== '0';
        } catch {
            return true;
        }
    });
    const [validateAfterSave, setValidateAfterSave] = useState(true);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const gutter = useRef<HTMLDivElement>(null);

    const dirty = file?.editable === true && content !== (file.content ?? '');
    const lines = content.split('\n').length;

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const opened = await serverRequest<OpenedFile>(FileManagerController.read(serverId), { path });
            setFile(opened);
            setContent(opened.content ?? '');
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [serverId, path]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        try {
            localStorage.setItem(BACKUP_STORAGE, backup ? '1' : '0');
        } catch {
            // Storage is not available.
        }
    }, [backup]);

    const save = async (overwrite = false) => {
        if (!file || !canEdit || !file.editable) {
            return;
        }

        setSaving(true);

        try {
            const answer = await serverRequest<SaveAnswer>(FileManagerController.save(serverId), {
                path: file.path,
                content,
                hash: overwrite ? null : file.hash,
                backup,
                validate: validateAfterSave && file.validator !== null,
            });

            setFile({ ...file, content, hash: answer.hash, size: new Blob([content]).size });
            setCheck(answer.check);

            toast.success(answer.backup ? t('Saved. The previous version is in :path', { path: answer.backup }) : answer.message);

            if (answer.check && !answer.check.ok) {
                toast.error(t('The config test failed. Fix the file before you reload the service.'));
            }

            onSaved();
        } catch (e) {
            if (e instanceof ServerApiError && e.status === 409) {
                if (window.confirm(`${e.message}\n\n${t('Overwrite the version on the server with yours?')}`)) {
                    setSaving(false);
                    await save(true);

                    return;
                }
            } else {
                toast.error(errorMessage(e));
            }
        } finally {
            setSaving(false);
        }
    };

    const runCheck = async () => {
        setChecking(true);

        try {
            setCheck(await serverRequest<Check>(FileManagerController.validateConfig(serverId), { path }));
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setChecking(false);
        }
    };

    const close = () => {
        if (dirty && !window.confirm(t('Discard the changes you did not save?'))) {
            return;
        }

        onClose();
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            void save();
        }

        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const target = e.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const next = content.slice(0, start) + '    ' + content.slice(end);
            setContent(next);
            requestAnimationFrame(() => target.setSelectionRange(start + 4, start + 4));
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && close()}>
            <DialogContent
                className="flex h-[92vh] max-w-[min(96vw,90rem)] flex-col gap-3 sm:max-w-[min(96vw,90rem)]"
                onEscapeKeyDown={(e) => {
                    if (dirty) {
                        e.preventDefault();
                        close();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 pr-8 font-mono text-base break-all">
                        {path}
                        {dirty && <span className="size-2 shrink-0 rounded-full bg-amber-500" title={t('Not saved')} />}
                    </DialogTitle>
                    <DialogDescription>
                        {file
                            ? `${formatBytes(file.size)} · ${modeString(file.mode)} (${file.mode}) · ${file.owner}:${file.group} · ${new Date(file.mtime * 1000).toLocaleString()}`
                            : ' '}
                    </DialogDescription>
                </DialogHeader>

                {loading && !file ? (
                    <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="size-4" />
                        {t('Loading…')}
                    </div>
                ) : error ? (
                    <p className="text-sm text-red-600">{error}</p>
                ) : file?.binary ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                        <FileWarning className="size-8" />
                        <p>{t('This is not a text file, so it cannot be shown here.')}</p>
                        <Button variant="outline" size="sm" onClick={() => onDownload(path)}>
                            <Download className="size-3.5" />
                            {t('Download')}
                        </Button>
                    </div>
                ) : (
                    <>
                        {file?.tail && (
                            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs">
                                {t('The file is bigger than 1 MB, so only its last 1000 lines are shown, read-only.')}
                            </p>
                        )}
                        {!canEdit && file?.editable && (
                            <p className="rounded-md bg-muted px-3 py-2 text-xs">{t('You can view this file, not change it.')}</p>
                        )}

                        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30 font-mono text-xs leading-5">
                            {!wrap && (
                                <div
                                    ref={gutter}
                                    aria-hidden
                                    className="overflow-hidden border-r bg-muted/50 px-2 py-2 text-right text-muted-foreground select-none"
                                >
                                    {Array.from({ length: lines }, (_, i) => (
                                        <div key={i}>{i + 1}</div>
                                    ))}
                                </div>
                            )}
                            <textarea
                                ref={textarea}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onKeyDown={onKeyDown}
                                onScroll={(e) => {
                                    if (gutter.current) {
                                        gutter.current.scrollTop = e.currentTarget.scrollTop;
                                    }
                                }}
                                readOnly={!canEdit || !file?.editable}
                                spellCheck={false}
                                wrap={wrap ? 'soft' : 'off'}
                                className={cn(
                                    'h-full w-full flex-1 resize-none bg-transparent p-2 outline-none',
                                    !wrap && 'whitespace-pre',
                                )}
                                aria-label={t('Content of :path', { path })}
                            />
                        </div>

                        {check && (
                            <div
                                className={cn(
                                    'max-h-40 overflow-auto rounded-md border px-3 py-2 text-xs',
                                    check.ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10',
                                )}
                            >
                                <p className="mb-1 flex items-center gap-1.5 font-medium">
                                    {check.ok ? (
                                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                                    ) : (
                                        <XCircle className="size-3.5 text-red-600" />
                                    )}
                                    {check.command}: {check.ok ? t('OK') : t('failed')}
                                </p>
                                <pre className="font-mono whitespace-pre-wrap">{check.output}</pre>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            {canEdit && file?.editable && (
                                <>
                                    <Button size="sm" onClick={() => void save()} disabled={saving || !dirty}>
                                        {saving ? <Spinner className="size-3.5" /> : <Save className="size-3.5" />}
                                        {t('Save')}
                                        <kbd className="ml-1 hidden text-[10px] opacity-70 sm:inline">⌘S</kbd>
                                    </Button>
                                    <label className="flex items-center gap-1.5 text-xs">
                                        <Checkbox checked={backup} onCheckedChange={(v) => setBackup(v === true)} />
                                        {t('Keep a backup copy')}
                                    </label>
                                    {file.validator && (
                                        <label className="flex items-center gap-1.5 text-xs">
                                            <Checkbox
                                                checked={validateAfterSave}
                                                onCheckedChange={(v) => setValidateAfterSave(v === true)}
                                            />
                                            {t('Test with :command after saving', { command: file.validator })}
                                        </label>
                                    )}
                                </>
                            )}

                            <div className="ml-auto flex flex-wrap items-center gap-1">
                                {file?.validator && (
                                    <Button variant="outline" size="sm" onClick={() => void runCheck()} disabled={checking}>
                                        {checking ? <Spinner className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                                        {file.validator}
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => setWrap(!wrap)} aria-pressed={wrap}>
                                    <WrapText className="size-3.5" />
                                    {t('Wrap lines')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (!dirty || window.confirm(t('Discard the changes you did not save?'))) {
                                            void load();
                                        }
                                    }}
                                    disabled={loading}
                                >
                                    <RefreshCw className="size-3.5" />
                                    {file?.tail ? t('Show new lines') : t('Load again')}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => onDownload(path)}>
                                    <Download className="size-3.5" />
                                    {t('Download')}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
