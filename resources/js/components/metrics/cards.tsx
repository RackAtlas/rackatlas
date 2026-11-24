import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const levelText = {
    ok: '',
    warning: 'text-amber-600 dark:text-amber-400',
    critical: 'text-red-600 dark:text-red-400',
} as const;

export function Tile({
    title,
    value,
    detail,
    level = 'ok',
}: {
    title: string;
    value: ReactNode;
    detail?: ReactNode;
    level?: 'ok' | 'warning' | 'critical';
}) {
    return (
        <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
            <p className="truncate text-xs text-muted-foreground">{title}</p>
            <p
                className={cn(
                    'mt-1 text-xl font-semibold tracking-tight sm:text-2xl',
                    levelText[level],
                )}
            >
                {value}
            </p>
            {detail && (
                <p className="mt-0.5 line-clamp-2 text-xs break-words text-muted-foreground">
                    {detail}
                </p>
            )}
        </div>
    );
}

export function ChartCard({
    title,
    summary,
    legend,
    children,
    className,
}: {
    title: string;
    summary?: ReactNode;
    legend?: { label: string; color: string }[];
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'min-w-0 space-y-3 rounded-xl border bg-card p-3 sm:p-4',
                className,
            )}
        >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-sm font-medium">{title}</h2>
                {summary && (
                    <p className="text-xs text-muted-foreground">{summary}</p>
                )}
            </div>
            {children}
            {legend && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {legend.map((item) => (
                        <li
                            key={item.label}
                            className="flex items-center gap-1.5"
                        >
                            <span
                                className="inline-block h-0.5 w-3 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            {item.label}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
