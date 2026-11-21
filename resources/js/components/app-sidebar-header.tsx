import { Link, usePage } from '@inertiajs/react';
import { ChevronLeft, Shield } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { TeamSwitcher } from '@/components/team-switcher';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { index as adminIndex } from '@/routes/admin';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

/** Title bar of the mobile shell: frosted glass under the status bar, a back button, the page title. */
function NativeTopBar({ breadcrumbs }: { breadcrumbs: BreadcrumbItemType[] }) {
    const { t } = useTranslation();
    const title = breadcrumbs.at(-1)?.title;
    const parent = breadcrumbs.length > 1 ? breadcrumbs.at(-2) : undefined;

    return (
        <header className="sticky top-0 z-20 hidden shrink-0 border-b border-border/40 bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-2xl backdrop-saturate-150 native:block">
            <div className="relative flex h-11 items-center justify-between px-2">
                <div className="flex min-w-0 basis-1/4 items-center">
                    {parent && (
                        <Link
                            href={parent.href}
                            data-native-press
                            className="-ml-1 flex min-w-0 items-center text-primary"
                        >
                            <ChevronLeft className="size-7 shrink-0" />
                            <span className="truncate text-[15px]">
                                {t(parent.title)}
                            </span>
                        </Link>
                    )}
                </div>
                <h1 className="pointer-events-none absolute inset-x-1/4 truncate text-center text-[17px] leading-none font-semibold">
                    {title ? t(title) : ''}
                </h1>
                <div className="flex min-w-0 basis-1/4 justify-end">
                    <TeamSwitcher />
                </div>
            </div>
        </header>
    );
}

function AdminLink() {
    const { t } = useTranslation();
    const { props, url } = usePage<{ auth: { user: { is_admin?: boolean } } }>();

    if (!props.auth.user.is_admin) {
        return null;
    }

    return (
        <Link
            href={adminIndex()}
            data-test="admin-link"
            className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                url.startsWith('/app/admin') && 'bg-accent text-accent-foreground',
            )}
        >
            <Shield className="size-4" />
            <span className="hidden sm:inline">{t('Administration')}</span>
        </Link>
    );
}

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    return (
        <>
            <NativeTopBar breadcrumbs={breadcrumbs} />
            <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border/50 bg-background/95 px-4 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 native:hidden md:h-16 md:px-4">
                <div className="flex min-w-0 shrink items-center gap-2">
                    <SidebarTrigger className="-ml-1" />
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
                <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
                    <FeedbackDialog />
                    <AdminLink />
                    <TeamSwitcher />
                </div>
            </header>
        </>
    );
}
