import { preferencesAllowed } from '@/hooks/use-privacy-choices';
import { useSyncExternalStore } from 'react';

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

export type Theme =
    'light' | 'sand' | 'mist' | 'dark' | 'graphite' | 'midnight' | 'forest';

export const THEMES: Record<Theme, ResolvedAppearance> = {
    light: 'light',
    sand: 'light',
    mist: 'light',
    dark: 'dark',
    graphite: 'dark',
    midnight: 'dark',
    forest: 'dark',
};

export type UseAppearanceReturn = {
    readonly appearance: Appearance;
    readonly resolvedAppearance: ResolvedAppearance;
    readonly dayTheme: Theme;
    readonly nightTheme: Theme;
    readonly theme: Theme;
    readonly updateAppearance: (mode: Appearance) => void;
    readonly updateTheme: (kind: ResolvedAppearance, theme: Theme) => void;
};

const listeners = new Set<() => void>();
let currentAppearance: Appearance = 'system';
let dayTheme: Theme = 'light';
let nightTheme: Theme = 'dark';
let snapshot = '';

const readTheme = (
    key: string,
    kind: ResolvedAppearance,
    fallback: Theme,
): Theme => {
    const value = localStorage.getItem(key) as Theme | null;

    return value && THEMES[value] === kind ? value : fallback;
};

const pickTheme = (appearance: Appearance): Theme =>
    isDarkMode(appearance) ? nightTheme : dayTheme;

const prefersDark = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') {
        return;
    }

    // Without consent to preference cookies the cookie only lives until the browser is closed.
    const lifetime = preferencesAllowed()
        ? `;max-age=${days * 24 * 60 * 60}`
        : '';
    document.cookie = `${name}=${value};path=/${lifetime};SameSite=Lax`;
};

const getStoredAppearance = (): Appearance => {
    if (typeof window === 'undefined') {
        return 'system';
    }

    return (localStorage.getItem('appearance') as Appearance) || 'system';
};

const isDarkMode = (appearance: Appearance): boolean => {
    return appearance === 'dark' || (appearance === 'system' && prefersDark());
};

const applyTheme = (appearance: Appearance): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const theme = pickTheme(appearance);
    const isDark = THEMES[theme] === 'dark';
    const root = document.documentElement;

    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';

    if (theme === 'light' || theme === 'dark') {
        delete root.dataset.theme;
    } else {
        root.dataset.theme = theme;
    }
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

const mediaQuery = (): MediaQueryList | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
};

const handleSystemThemeChange = (): void => applyTheme(currentAppearance);

export function initializeTheme(): void {
    if (typeof window === 'undefined') {
        return;
    }

    if (!localStorage.getItem('appearance')) {
        localStorage.setItem('appearance', 'system');
        setCookie('appearance', 'system');
    }

    currentAppearance = getStoredAppearance();
    dayTheme = readTheme('theme-day', 'light', 'light');
    nightTheme = readTheme('theme-night', 'dark', 'dark');
    snapshot = `${currentAppearance}|${dayTheme}|${nightTheme}`;
    applyTheme(currentAppearance);

    // Set up system theme change listener
    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
}

export function useAppearance(): UseAppearanceReturn {
    // The React compiler only re-renders on values it sees, so the state is read from the snapshot.
    const state = useSyncExternalStore(
        subscribe,
        () => snapshot,
        () => '',
    );
    const [storedAppearance, storedDay, storedNight] = state.split('|') as [
        Appearance?,
        Theme?,
        Theme?,
    ];

    const appearance: Appearance = storedAppearance ?? currentAppearance;
    const day: Theme = storedDay ?? dayTheme;
    const night: Theme = storedNight ?? nightTheme;

    const resolvedAppearance: ResolvedAppearance = isDarkMode(appearance)
        ? 'dark'
        : 'light';

    const refresh = (): void => {
        snapshot = `${currentAppearance}|${dayTheme}|${nightTheme}`;
        applyTheme(currentAppearance);
        notify();
    };

    const updateTheme = (kind: ResolvedAppearance, theme: Theme): void => {
        if (THEMES[theme] !== kind) {
            return;
        }

        if (kind === 'light') {
            dayTheme = theme;
            localStorage.setItem('theme-day', theme);
        } else {
            nightTheme = theme;
            localStorage.setItem('theme-night', theme);
        }

        setCookie(kind === 'light' ? 'theme_day' : 'theme_night', theme);
        refresh();
    };

    const updateAppearance = (mode: Appearance): void => {
        currentAppearance = mode;

        // Store in localStorage for client-side persistence...
        localStorage.setItem('appearance', mode);

        // Store in cookie for SSR...
        setCookie('appearance', mode);

        refresh();
    };

    return {
        appearance,
        resolvedAppearance,
        dayTheme: day,
        nightTheme: night,
        theme: resolvedAppearance === 'dark' ? night : day,
        updateAppearance,
        updateTheme,
    } as const;
}
