import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, serverRequest } from '@/lib/server-api';

type Route = { url: string; method: string };

/**
 * Data a tool page reads from a server over SSH: loaded when the server changes, and again on reload().
 * An answer for a server that is no longer selected is dropped.
 */
export function useServerData<T>(route: ((id: number) => Route) | null, serverId: number | null) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const current = useRef<number | null>(null);

    const load = useCallback(
        async (quiet = false) => {
            if (serverId === null || route === null) {
                return;
            }

            const id = serverId;
            current.current = id;

            setLoading(true);

            if (!quiet) {
                setError(null);
            }

            try {
                const answer = await serverRequest<T>(route(id));

                if (current.current === id) {
                    setData(answer);
                    setError(null);
                }
            } catch (e) {
                if (current.current === id) {
                    setError(errorMessage(e));
                }
            } finally {
                if (current.current === id) {
                    setLoading(false);
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [serverId],
    );

    useEffect(() => {
        setData(null);
        void load();
    }, [load]);

    return { data, setData, error, loading, reload: load };
}
