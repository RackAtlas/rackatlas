import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';
import { useTranslation } from '@/hooks/use-translation';

export function NavMain({
    items,
    label = 'Platform',
}: {
    items: NavItem[];
    label?: string;
}) {
    const { t } = useTranslation();
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="px-3 py-0 not-first:mt-2">
            <SidebarGroupLabel className="mb-0.5 h-6 px-2.5 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
                {t(label)}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            className="h-8 gap-2.5 rounded-lg px-2.5 font-medium text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary dark:data-[active=true]:bg-primary/15 [&>svg]:size-4"
                            isActive={item.isActive ?? isCurrentUrl(item.href)}
                            tooltip={{ children: t(item.title) }}
                        >
                            <Link href={item.href} prefetch>
                                {item.icon && <item.icon />}
                                <span>{t(item.title)}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
