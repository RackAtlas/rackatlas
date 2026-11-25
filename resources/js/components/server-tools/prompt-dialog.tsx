import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';

export type PromptRequest = {
    title: string;
    description?: string;
    label?: string;
    value: string;
    confirm: string;
    /** Select only the name before the extension, as a file manager does when renaming. */
    selectName?: boolean;
    onSubmit: (value: string) => Promise<boolean>;
};

/**
 * Ask for one line of text: a name, a path or an archive name.
 */
export function PromptDialog({ request, onClose }: { request: PromptRequest; onClose: () => void }) {
    const { t } = useTranslation();
    const [value, setValue] = useState(request.value);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (value.trim() === '') {
            return;
        }

        setBusy(true);
        const ok = await request.onSubmit(value.trim());
        setBusy(false);

        if (ok) {
            onClose();
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{request.title}</DialogTitle>
                    {request.description && <DialogDescription>{request.description}</DialogDescription>}
                </DialogHeader>

                <form
                    id="prompt-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    <Input
                        autoFocus
                        aria-label={request.label ?? request.title}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="font-mono"
                        onFocus={(e) => {
                            if (request.selectName) {
                                const dot = e.target.value.lastIndexOf('.');
                                e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
                            }
                        }}
                    />
                </form>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button type="submit" form="prompt-form" disabled={busy || value.trim() === ''}>
                        {busy && <Spinner className="size-3.5" />}
                        {request.confirm}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
