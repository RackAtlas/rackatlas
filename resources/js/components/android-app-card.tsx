import { Download, Smartphone } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import { isNativeApp } from '@/lib/native';

const APK_URL = '/apps/app-release.apk';

/**
 * Sidebar card offering the Android app. Hidden inside the mobile app itself; collapses to an icon
 * button when the sidebar is collapsed.
 */
export function AndroidAppCard() {
    const { t } = useTranslation();
    const { state } = useSidebar();

    if (isNativeApp()) {
        return null;
    }

    if (state === 'collapsed') {
        return (
            <a
                href={APK_URL}
                download
                title={t('Download Android app')}
                aria-label={t('Download Android app')}
                className="mx-auto flex size-8 items-center [@media(max-height:760px)]:hidden justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
            >
                <Smartphone className="size-4" />
            </a>
        );
    }

    return (
        <a
            href={APK_URL}
            download
            className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-2 transition-all hover:border-emerald-500/40 hover:from-emerald-500/15 [@media(max-height:760px)]:hidden"
        >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
                <Smartphone className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-medium">
                    {t('Android app')}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                    {t('Download APK')}
                </span>
            </span>
            <Download className="size-4 shrink-0 text-emerald-600 transition-transform group-hover:translate-y-0.5 dark:text-emerald-400" />
        </a>
    );
}
