import type { LucideIcon } from 'lucide-react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { SettingsSection } from '@/components/settings/section';
import type {
    Appearance as AppearanceMode,
    ResolvedAppearance,
    Theme,
} from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

const modes: {
    value: AppearanceMode;
    icon: LucideIcon;
    label: string;
    description: string;
}[] = [
    {
        value: 'light',
        icon: Sun,
        label: 'Light',
        description: 'Always use the day theme.',
    },
    {
        value: 'dark',
        icon: Moon,
        label: 'Dark',
        description: 'Always use the night theme.',
    },
    {
        value: 'system',
        icon: Monitor,
        label: 'Automatic',
        description:
            'Day theme by day, night theme by night, following your device.',
    },
];

/** Page, card and accent colours shown in the preview of each theme. */
const palettes: Record<
    Theme,
    { label: string; page: string; card: string; line: string; text: string }
> = {
    light: {
        label: 'White',
        page: '#f5f7f9',
        card: '#ffffff',
        line: '#dfe3e8',
        text: '#1a1f24',
    },
    sand: {
        label: 'Sand',
        page: '#f4efe6',
        card: '#fbf8f2',
        line: '#e1d8c6',
        text: '#2b2418',
    },
    mist: {
        label: 'Light grey',
        page: '#e4e5e7',
        card: '#f3f4f5',
        line: '#c9cbce',
        text: '#202225',
    },
    dark: {
        label: 'Black',
        page: '#0e1114',
        card: '#161a1e',
        line: '#262b31',
        text: '#f2f4f5',
    },
    graphite: {
        label: 'Grey',
        page: '#35373a',
        card: '#404246',
        line: '#56595d',
        text: '#f1f2f3',
    },
    midnight: {
        label: 'Midnight blue',
        page: '#0f1226',
        card: '#171b35',
        line: '#2a2f55',
        text: '#eef0fb',
    },
    forest: {
        label: 'Forest',
        page: '#0c1612',
        card: '#122019',
        line: '#223a2e',
        text: '#ecf6f1',
    },
};

const groups: { kind: ResolvedAppearance; title: string; themes: Theme[] }[] = [
    {
        kind: 'light',
        title: 'Day theme',
        themes: ['light', 'sand', 'mist'],
    },
    {
        kind: 'dark',
        title: 'Night theme',
        themes: ['dark', 'graphite', 'midnight', 'forest'],
    },
];

function Swatch({ theme }: { theme: Theme }) {
    const p = palettes[theme];

    return (
        <div
            className="flex h-16 flex-col gap-1.5 rounded-lg border p-2"
            style={{ background: p.page, borderColor: p.line }}
            aria-hidden
        >
            <div
                className="flex-1 rounded-md border p-1.5"
                style={{ background: p.card, borderColor: p.line }}
            >
                <div
                    className="h-1 w-8 rounded-full"
                    style={{ background: p.text, opacity: 0.7 }}
                />
                <div className="mt-1.5 h-1 w-5 rounded-full bg-emerald-500/80" />
            </div>
        </div>
    );
}

export default function AppearanceSection() {
    const { t } = useTranslation();
    const { appearance, dayTheme, nightTheme, updateAppearance, updateTheme } =
        useAppearance();

    return (
        <SettingsSection
            title={t('Appearance')}
            description={t(
                'Choose how the application looks. Pick a day and a night theme and let the app switch between them.',
            )}
        >
            <div className="space-y-6">
                <div
                    className="grid gap-3 sm:grid-cols-3"
                    role="radiogroup"
                    aria-label={t('Mode')}
                >
                    {modes.map(({ value, icon: Icon, label, description }) => {
                        const active = appearance === value;

                        return (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => updateAppearance(value)}
                                className={cn(
                                    'flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors',
                                    active
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'hover:bg-muted/50',
                                )}
                            >
                                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                                    <span className="flex items-center gap-2">
                                        <Icon className="size-4 text-muted-foreground" />
                                        {t(label)}
                                    </span>
                                    {active && (
                                        <Check className="size-4 text-primary" />
                                    )}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {t(description)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {groups.map(({ kind, title, themes }) => {
                    const selected = kind === 'light' ? dayTheme : nightTheme;
                    const Icon = kind === 'light' ? Sun : Moon;

                    return (
                        <div key={kind}>
                            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                                <Icon className="size-4 text-muted-foreground" />
                                {t(title)}
                            </p>
                            <div
                                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                                role="radiogroup"
                                aria-label={t(title)}
                            >
                                {themes.map((theme) => {
                                    const active = selected === theme;

                                    return (
                                        <button
                                            key={theme}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() =>
                                                updateTheme(kind, theme)
                                            }
                                            className={cn(
                                                'flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors',
                                                active
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                    : 'hover:bg-muted/50',
                                            )}
                                        >
                                            <Swatch theme={theme} />
                                            <span className="flex items-center justify-between gap-2 px-0.5 text-sm font-medium">
                                                {t(palettes[theme].label)}
                                                {active && (
                                                    <Check className="size-4 text-primary" />
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </SettingsSection>
    );
}
