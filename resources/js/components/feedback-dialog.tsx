import { Form, usePage } from '@inertiajs/react';
import { MessageSquareText } from 'lucide-react';
import AppFeedbackController from '@/actions/App/Http/Controllers/AppFeedbackController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import type { Auth } from '@/types';

/** A button for the header that opens a form; the message is mailed to the owner of RackAtlas. */
export function FeedbackDialog() {
    const { t } = useTranslation();
    const { props } = usePage<{ auth: Auth }>();

    if (props.auth.user?.is_demo) {
        return null;
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    data-test="feedback-button"
                    className="gap-1.5 text-muted-foreground"
                >
                    <MessageSquareText className="size-4" />
                    <span className="hidden sm:inline">{t('Feedback')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>{t('Tell us what to improve')}</DialogTitle>
                <DialogDescription>
                    {t(
                        'What do you like, what is missing or what annoys you?',
                    )}
                </DialogDescription>

                <Form
                    {...AppFeedbackController.form()}
                    options={{ preserveScroll: true }}
                    resetOnSuccess
                    className="space-y-4"
                >
                    {({ processing, errors, wasSuccessful, recentlySuccessful }) =>
                        wasSuccessful && recentlySuccessful ? (
                            <div
                                className="flex flex-col items-center gap-2 py-6 text-center"
                                role="status"
                            >
                                <p className="text-base font-semibold">
                                    {t('Thank you for your opinion!')}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t('Every message is read by a real person.')}
                                </p>
                                <DialogClose asChild>
                                    <Button variant="secondary" className="mt-2">
                                        {t('Close')}
                                    </Button>
                                </DialogClose>
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="app-feedback-message">
                                        {t('Your opinion')}
                                    </Label>
                                    <textarea
                                        id="app-feedback-message"
                                        name="message"
                                        rows={6}
                                        required
                                        minLength={10}
                                        maxLength={2000}
                                        className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    />
                                    <InputError message={errors.message} />
                                </div>

                                <DialogFooter className="gap-2">
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            {t('Cancel')}
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        disabled={processing}
                                        data-test="feedback-submit"
                                    >
                                        {t('Send opinion')}
                                    </Button>
                                </DialogFooter>
                            </>
                        )
                    }
                </Form>
            </DialogContent>
        </Dialog>
    );
}
