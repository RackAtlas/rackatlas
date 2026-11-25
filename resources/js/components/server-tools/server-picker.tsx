import { RefreshCw, ServerOff, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { timeAgo } from '@/lib/dashboard';

export type SshServer = {
    id: number;
    name: string;
    status: string;
    username: string;
};

const STORAGE_KEY = 'server-tools.server';

/**
 * The server a tool page works on: from ?server=, else the last one used, else the first. The choice is
 * written back to the address, so a reload or a shared link opens the same server.
 */
export function useSelectedServer(
    servers: SshServer[],
    selected: number | null,
): [SshServer | null, (id: number) => void] {
    const initial = (): number | null => {
        const ids = servers.map((s) => s.id);

        if (selected !== null && ids.includes(selected)) {
            return selected;
        }

        try {
            const remembered = Number(localStorage.getItem(STORAGE_KEY));

            if (ids.includes(remembered)) {
                return remembered;
            }
        } catch {
            // Storage is not available.
        }

        return ids[0] ?? null;
    };

    const [id, setId] = useState<number | null>(initial);

    useEffect(() => {
        if (id === null) {
            return;
        }

        try {
            localStorage.setItem(STORAGE_KEY, String(id));
        } catch {
            // Storage is not available.
        }

        const url = new URL(window.location.href);

        if (url.searchParams.get('server') !== String(id)) {
            url.searchParams.set('server', String(id));
            window.history.replaceState(window.history.state, '', url);
        }
    }, [id]);

    return [servers.find((s) => s.id === id) ?? null, setId];
}

export function ServerToolbar({
    servers,
    server,
    onChange,
    loading,
    fetchedAt,
    onRefresh,
    children,
}: {
    servers: SshServer[];
    server: SshServer | null;
    onChange: (id: number) => void;
    loading: boolean;
    fetchedAt?: string | null;
    onRefresh: () => void;
    children?: React.ReactNode;
}) {
    const { t, locale } = useTranslation();

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Select
                value={server ? String(server.id) : undefined}
                onValueChange={(value) => onChange(Number(value))}
            >
                <SelectTrigger className="w-56" aria-label={t('Server')}>
                    <SelectValue placeholder={t('Choose a server')} />
                </SelectTrigger>
                <SelectContent>
                    {servers.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading || server === null}
            >
                {loading ? (
                    <Spinner className="size-3.5" />
                ) : (
                    <RefreshCw className="size-3.5" />
                )}
                {t('Refresh')}
            </Button>

            {fetchedAt && !loading && (
                <span className="text-xs text-muted-foreground">
                    {t('Read :time', {
                        time: timeAgo(fetchedAt, new Date().toISOString(), locale),
                    })}
                </span>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
                {children}
            </div>
        </div>
    );
}

export function NoSshServers({ team }: { team: unknown }) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
            <ServerOff className="size-8 text-muted-foreground" />
            <p className="max-w-lg text-sm text-muted-foreground">
                {team === null
                    ? t('Choose a team first.')
                    : t(
                          'No server has an SSH login. These tools log into the server over SSH; servers that only report through the agent cannot be managed here.',
                      )}
            </p>
        </div>
    );
}

/** The login user is neither root nor allowed to use sudo without a password. */
export function PrivilegeNotice({
    privilege,
    username,
}: {
    privilege: string | null | undefined;
    username?: string;
}) {
    const { t } = useTranslation();

    if (privilege !== 'none') {
        return null;
    }

    return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
                {t(
                    'The SSH user :user is not root and cannot use sudo without a password, so most changes will fail. Log in as root or allow sudo for this user.',
                    { user: username ?? '' },
                )}
            </p>
        </div>
    );
}

export function LoadError({
    message,
    onRetry,
}: {
    message: string;
    onRetry: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
            <p className="font-mono text-xs break-all">{message}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
                {t('Try again')}
            </Button>
        </div>
    );
}

export function LoadingBlock() {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-center gap-2 rounded-xl border p-12 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {t('Connecting to the server…')}
        </div>
    );
}
