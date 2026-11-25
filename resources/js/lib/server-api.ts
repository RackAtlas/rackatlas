/**
 * JSON requests to the pages that work on a server over SSH (firewall, files, cron, updates).
 * A refused change answers with a message; a 409 with `confirm` asks the user before it is sent again.
 */

type Route = { url: string; method: string };

export class ServerApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public confirm = false,
    ) {
        super(message);
    }
}

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

function firstError(errors: unknown): string | null {
    if (!errors || typeof errors !== 'object') {
        return null;
    }

    const first = Object.values(errors as Record<string, string[]>)[0];

    return Array.isArray(first) ? (first[0] ?? null) : null;
}

async function send(route: Route, body?: BodyInit, json = true): Promise<Response> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': xsrfToken(),
    };

    if (json && body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(route.url, {
        method: route.method.toUpperCase(),
        headers,
        body,
        credentials: 'same-origin',
    });

    if (!response.ok) {
        let message = `Error ${response.status}`;
        let confirm = false;

        try {
            const data = await response.json();
            message = firstError(data.errors) ?? data.message ?? message;
            confirm = Boolean(data.confirm);
        } catch {
            // Not JSON: keep the status.
        }

        throw new ServerApiError(message, response.status, confirm);
    }

    return response;
}

export async function serverRequest<T = Record<string, unknown>>(
    route: Route,
    data?: Record<string, unknown>,
): Promise<T> {
    const response = await send(
        route,
        data === undefined ? undefined : JSON.stringify(data),
    );

    return (await response.json()) as T;
}

export async function serverUpload<T = Record<string, unknown>>(
    route: Route,
    form: FormData,
): Promise<T> {
    const response = await send(route, form, false);

    return (await response.json()) as T;
}

/** Fetch a file and hand it to the browser as a download. */
export async function serverDownload(
    route: Route,
    data: Record<string, unknown>,
    filename: string,
): Promise<void> {
    const response = await send(route, JSON.stringify(data));
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
