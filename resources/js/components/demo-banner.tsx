import { Link, usePage } from '@inertiajs/react';
import { FlaskConical } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { logout } from '@/routes';
import type { Auth } from '@/types';

/** A thin strip on top of every page while the shared demo account is signed in. */
export function DemoBanner() {
    const { t } = useTranslation();
    const { props } = usePage<{ auth: Auth }>();

    if (!props.auth.user?.is_demo) {
        return null;
    }

    return (
        <div
            data-test="demo-banner"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100"
        >
            <span className="inline-flex items-center gap-1.5 font-medium">
                <FlaskConical className="size-4" />
                {t('Demo mode')}
            </span>
            <span>{t('You are looking at made-up servers. Nothing can be changed.')}</span>
            <Link
                href={logout()}
                method="post"
                as="button"
                className="cursor-pointer font-medium underline"
                data-test="demo-exit"
            >
                {t('Exit demo')}
            </Link>
        </div>
    );
}
