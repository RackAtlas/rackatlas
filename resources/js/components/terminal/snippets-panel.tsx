import { router } from '@inertiajs/react';
import {
    CornerDownLeft,
    Pencil,
    Play,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import TerminalSnippetController from '@/actions/App/Http/Controllers/Terminal/TerminalSnippetController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

export type Snippet = {
    id: number;
    name: string;
    command: string;
};

type Props = {
    snippets: Snippet[];
    /** How many terminals get the command: more than one while broadcasting. */
    targets: number;
    onSend: (command: string, run: boolean) => void;
    onClose: () => void;
};

type Draft = { id: number | null; name: string; command: string };

const emptyDraft: Draft = { id: null, name: '', command: '' };

/**
 * The commands a team keeps ready. Run types the command and presses Enter, Insert only types it so it can
 * be changed first. With several terminals receiving, running asks for a second click.
 */
export default function SnippetsPanel({
    snippets,
    targets,
    onSend,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState<number | null>(null);

    const shown = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return snippets.filter(
            (snippet) =>
                needle === '' ||
                snippet.name.toLowerCase().includes(needle) ||
                snippet.command.toLowerCase().includes(needle),
        );
    }, [snippets, search]);

    const save = (event: FormEvent) => {
        event.preventDefault();

        if (draft === null) {
            return;
        }

        const body = { name: draft.name, command: draft.command };
        const options = {
            preserveScroll: true,
            preserveState: true,
            only: ['snippets'],
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onError: (bag: Record<string, string>) => setErrors(bag),
            onSuccess: () => {
                setDraft(null);
                setErrors({});
            },
        };

        if (draft.id === null) {
            router.post(TerminalSnippetController.store.url(), body, options);
        } else {
            router.put(
                TerminalSnippetController.update.url(draft.id),
                body,
                options,
            );
        }
    };

    const remove = (snippet: Snippet) => {
        if (
            !window.confirm(
                t('Delete the snippet ":name"?', { name: snippet.name }),
            )
        ) {
            return;
        }

        router.delete(TerminalSnippetController.destroy.url(snippet.id), {
            preserveScroll: true,
            preserveState: true,
            only: ['snippets'],
        });
    };

    const send = (snippet: Snippet, run: boolean) => {
        if (run && targets > 1 && confirming !== snippet.id) {
            setConfirming(snippet.id);

            return;
        }

        setConfirming(null);
        onSend(snippet.command, run);
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
                <h2 className="text-sm font-semibold">{t('Snippets')}</h2>
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setErrors({});
                            setDraft({ ...emptyDraft });
                        }}
                    >
                        <Plus className="size-3.5" />
                        {t('New')}
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={t('Close')}
                        onClick={onClose}
                    >
                        <X className="size-4" />
                    </Button>
                </div>
            </div>

            {targets > 1 && (
                <p className="shrink-0 border-b bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                    {t('Commands go to :count terminals at once.', {
                        count: targets,
                    })}
                </p>
            )}

            {draft !== null && (
                <form
                    onSubmit={save}
                    className="shrink-0 space-y-2 border-b bg-muted/30 p-3"
                >
                    <Input
                        value={draft.name}
                        onChange={(event) =>
                            setDraft({ ...draft, name: event.target.value })
                        }
                        placeholder={t('Name, e.g. Disk usage')}
                        maxLength={80}
                        autoFocus
                        aria-label={t('Name')}
                    />
                    {errors.name && (
                        <p className="text-xs text-destructive">
                            {errors.name}
                        </p>
                    )}
                    <textarea
                        value={draft.command}
                        onChange={(event) =>
                            setDraft({ ...draft, command: event.target.value })
                        }
                        placeholder={t('Command, e.g. df -h')}
                        rows={3}
                        maxLength={4000}
                        spellCheck={false}
                        aria-label={t('Command')}
                        className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                    {errors.command && (
                        <p className="text-xs text-destructive">
                            {errors.command}
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {t(
                            'Every line is sent with Enter. Do not store passwords or keys here, the whole team can read snippets.',
                        )}
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setDraft(null)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={
                                saving ||
                                draft.name.trim() === '' ||
                                draft.command.trim() === ''
                            }
                        >
                            {t('Save')}
                        </Button>
                    </div>
                </form>
            )}

            {snippets.length > 0 && (
                <div className="relative shrink-0 border-b p-2">
                    <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('Search snippets…')}
                        className="h-8 pl-8"
                        aria-label={t('Search snippets…')}
                    />
                </div>
            )}

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {snippets.length === 0 && draft === null && (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">
                            {t('No snippets yet')}
                        </p>
                        <p className="mt-1">
                            {t(
                                'Save the commands you type often, like checking the disk or following a log, and send them with one click.',
                            )}
                        </p>
                    </div>
                )}

                {snippets.length > 0 && shown.length === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {t('No snippet matches your search.')}
                    </p>
                )}

                {shown.map((snippet) => {
                    const multiline = snippet.command.includes('\n');
                    const asking = confirming === snippet.id;

                    return (
                        <div
                            key={snippet.id}
                            className="group rounded-lg border bg-background p-2.5"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 truncate text-sm font-medium">
                                    {snippet.name}
                                </span>
                                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
                                    <button
                                        type="button"
                                        aria-label={t('Edit')}
                                        onClick={() => {
                                            setErrors({});
                                            setDraft({
                                                id: snippet.id,
                                                name: snippet.name,
                                                command: snippet.command,
                                            });
                                        }}
                                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    >
                                        <Pencil className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={t('Delete')}
                                        onClick={() => remove(snippet)}
                                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>
                            </div>
                            <pre className="mt-1.5 max-h-20 overflow-hidden rounded bg-muted/60 px-2 py-1.5 font-mono text-xs break-all whitespace-pre-wrap text-muted-foreground">
                                {snippet.command}
                            </pre>
                            <div className="mt-2 flex gap-1.5">
                                <Button
                                    size="sm"
                                    variant={asking ? 'destructive' : 'default'}
                                    className="h-7 flex-1 text-xs"
                                    onClick={() => send(snippet, true)}
                                    onBlur={() => setConfirming(null)}
                                >
                                    <Play className="size-3" />
                                    {asking
                                        ? t('Run on :count terminals?', {
                                              count: targets,
                                          })
                                        : t('Run')}
                                </Button>
                                {!multiline && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className={cn('h-7 text-xs')}
                                        onClick={() => send(snippet, false)}
                                        title={t(
                                            'Type it without pressing Enter',
                                        )}
                                    >
                                        <CornerDownLeft className="size-3" />
                                        {t('Insert')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
