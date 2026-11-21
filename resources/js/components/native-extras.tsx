import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import WidgetTokenController from '@/actions/App/Http/Controllers/Settings/WidgetTokenController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/use-translation';
import {
    appVersion,
    isNativeApp,
    refreshWidget,
    setScreenSecure,
    setWidgetToken,
    widgetState,
} from '@/lib/native';

const APK_URL = '/apps/app-release.apk';

const olderThan = (current: string, minimum: string): boolean => {
    const a = current.split('.').map((part) => parseInt(part, 10) || 0);
    const b = minimum.split('.').map((part) => parseInt(part, 10) || 0);

    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] ?? 0) !== (b[i] ?? 0)) {
            return (a[i] ?? 0) < (b[i] ?? 0);
        }
    }

    return false;
};

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Inside the Android app only, and only when the installed build supports it: hides the app in the recent
 * screen while biometrics are on, keeps the home-screen widget supplied with a key, and an app that is too old is asked to update.
 */
export function NativeExtras() {
    const { t } = useTranslation();
    const { biometrics, minAppVersion } = usePage<{
        biometrics: boolean;
        minAppVersion: string | null;
    }>().props;
    const [outdated, setOutdated] = useState(false);

    useEffect(() => {
        if (isNativeApp()) {
            setScreenSecure(Boolean(biometrics));
        }
    }, [biometrics]);

    useEffect(() => {
        if (!isNativeApp()) {
            return;
        }

        void (async () => {
            const state = await widgetState();

            if (!state.available) {
                return;
            }

            if (state.configured) {
                refreshWidget();

                return;
            }

            try {
                const response = await fetch(
                    WidgetTokenController.url(),
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': xsrfToken(),
                        },
                    },
                );

                if (response.ok) {
                    const data = (await response.json()) as {
                        token: string;
                        url: string;
                    };

                    await setWidgetToken(data.token, data.url);
                    refreshWidget();
                }
            } catch {
                // The widget stays unconfigured until the next start.
            }
        })();
    }, []);

    useEffect(() => {
        if (!isNativeApp() || !minAppVersion) {
            return;
        }

        void appVersion().then((version) => {
            if (version && olderThan(version, minAppVersion)) {
                setOutdated(true);
            }
        });
    }, [minAppVersion]);

    return (
        <Dialog open={outdated} onOpenChange={setOutdated}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('A newer app is available')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'This version of the app is out of date. Install the new one to get all features and alerts working.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOutdated(false)}>
                        {t('Later')}
                    </Button>
                    <Button asChild>
                        <a href={APK_URL}>{t('Update')}</a>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
