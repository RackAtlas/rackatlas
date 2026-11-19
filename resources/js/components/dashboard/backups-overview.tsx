import { Link } from '@inertiajs/react';
import {
    CheckCircle2,
    ChevronDown,
    Clock,
    Hourglass,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { formatBytes, timeAgo } from '@/lib/dashboard';
import { cn } from '@/lib/utils';
import { index } from '@/routes/backups';
import type { DashboardBackup } from '@/types';

type State = 'failed' | 'overdue' | 'ok' | 'waiting';

const ORDER: State[] = ['failed', 'overdue', 'waiting', 'ok'];

/** How many healthy backups are listed before the rest is folded away. */
const VISIBLE_HEALTHY = 4;

const styles: Record<
    State,
    { icon: LucideIcon; text: string; bar: string; badge: string }
> = {
    failed: {
        icon: XCircle,
        text: 'text-red-600 dark:text-red-400',
        bar: 'bg-red-500',
        badge: 'bg-red-500/10 text-red-700 dark:text-red-300',
    },
    overdue: {
        icon: Clock,
        text: 'text-amber-600 dark:text-amber-400',
        bar: 'bg-amber-500',
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    },
    waiting: {
        icon: Hourglass,
        text: 'text-muted-foreground',
        bar: 'bg-muted-foreground/40',
        badge: 'bg-muted text-muted-foreground',
    },
    ok: {
        icon: CheckCircle2,
        text: 'text-emerald-600 dark:text-emerald-400',
        bar: 'bg-emerald-500',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
};

const stateOf = (backup: DashboardBackup): State => {
    if (backup.last_status === 'failed') {
        return 'failed';
    }

    if (backup.overdue) {
        return 'overdue';
    }

    return backup.last_run_at ? 'ok' : 'waiting';
};

export default function BackupsOverview({
    backups,
    generatedAt,
}: {
    backups: DashboardBackup[];
    generatedAt: string;
}) {
    const { t, locale } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    const labels: Record<State, string> = {
        failed: t('Failed'),
        overdue: t('Overdue'),
        ok: t('OK'),
        waiting: t('Waiting for first run'),
    };

    const rows = backups.map((backup) => ({ backup, state: stateOf(backup) }));
    const counts = ORDER.reduce(
        (sum, state) => ({
            ...sum,
            [state]: rows.filter((row) => row.state === state).length,
        }),
        {} as Record<State, number>,
    );

    const attention = rows.filter(
        (row) => row.state === 'failed' || row.state === 'overdue',
    );
    const rest = rows.filter(
        (row) => row.state !== 'failed' && row.state !== 'overdue',
    );
    const shown = expanded ? rest : rest.slice(0, VISIBLE_HEALTHY);
    const hidden = rest.length - shown.length;

    const meta = (backup: DashboardBackup) =>
        [
            backup.server_name,
            backup.last_run_at
                ? timeAgo(backup.last_run_at, generatedAt, locale)
                : null,
            backup.last_size_bytes !== null
                ? formatBytes(backup.last_size_bytes)
                : null,
        ]
            .filter(Boolean)
            .join(' · ');

    return (
        <section
            aria-label={t('Backups')}
            className="space-y-3 rounded-xl border bg-card p-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-medium">{t('Backups')}</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {backups.length}
                    </span>
                </div>
                <Link
                    href={index()}
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                    {t('Show all')}
                </Link>
            </div>

            {backups.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    {t('No backups yet')}
                </p>
            ) : (
                <>
                    <div className="space-y-2">
                        <div
                            className="flex h-1.5 overflow-hidden rounded-full bg-muted"
                            role="img"
                            aria-label={ORDER.filter((s) => counts[s] > 0)
                                .map((s) => `${counts[s]} ${labels[s]}`)
                                .join(', ')}
                        >
                            {ORDER.map(
                                (state) =>
                                    counts[state] > 0 && (
                                        <span
                                            key={state}
                                            className={styles[state].bar}
                                            style={{
                                                width: `${(counts[state] / backups.length) * 100}%`,
                                            }}
                                        />
                                    ),
                            )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {ORDER.map(
                                (state) =>
                                    counts[state] > 0 && (
                                        <span
                                            key={state}
                                            className="flex items-center gap-1.5"
                                        >
                                            <span
                                                className={cn(
                                                    'size-2 rounded-full',
                                                    styles[state].bar,
                                                )}
                                            />
                                            <span className="font-medium tabular-nums">
                                                {counts[state]}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {labels[state]}
                                            </span>
                                        </span>
                                    ),
                            )}
                        </div>
                    </div>

                    {attention.length > 0 && (
                        <ul className="space-y-2" data-test="backups-attention">
                            {attention.map(({ backup, state }) => {
                                const Icon = styles[state].icon;

                                return (
                                    <li
                                        key={backup.id}
                                        className={cn(
                                            'flex items-start gap-3 rounded-lg p-3',
                                            styles[state].badge,
                                        )}
                                    >
                                        <Icon className="mt-0.5 size-4 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium break-words">
                                                {backup.name}
                                                <span className="ml-2 text-[11px] tracking-wide uppercase opacity-80">
                                                    {labels[state]}
                                                </span>
                                            </p>
                                            <p className="text-xs break-words opacity-80">
                                                {meta(backup) || '—'}
                                            </p>
                                            {backup.last_message && (
                                                <p className="mt-1 line-clamp-2 text-xs break-words">
                                                    {backup.last_message}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {rest.length > 0 && (
                        <div>
                            <ul className="divide-y">
                                {shown.map(({ backup, state }) => {
                                    const Icon = styles[state].icon;

                                    return (
                                        <li
                                            key={backup.id}
                                            title={
                                                backup.last_message ?? undefined
                                            }
                                            className="flex items-center gap-2.5 py-2"
                                        >
                                            <Icon
                                                className={cn(
                                                    'size-4 shrink-0',
                                                    styles[state].text,
                                                )}
                                            />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                                {backup.name}
                                            </span>
                                            <span className="shrink-0 truncate text-xs text-muted-foreground">
                                                {state === 'waiting'
                                                    ? labels.waiting
                                                    : meta(backup) || '—'}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                            {(hidden > 0 || expanded) &&
                                rest.length > VISIBLE_HEALTHY && (
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(!expanded)}
                                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs text-muted-foreground hover:bg-muted"
                                    >
                                        {expanded
                                            ? t('Show less')
                                            : t('Show :count more', {
                                                  count: hidden,
                                              })}
                                        <ChevronDown
                                            className={cn(
                                                'size-3.5 transition-transform',
                                                expanded && 'rotate-180',
                                            )}
                                        />
                                    </button>
                                )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
