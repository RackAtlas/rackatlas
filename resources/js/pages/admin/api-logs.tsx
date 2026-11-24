import { Head, router } from "@inertiajs/react";
import { Search } from "lucide-react";
import { useState } from "react";
import ApiLogController from "@/actions/App/Http/Controllers/Admin/ApiLogController";
import Pagination from "@/components/admin/pagination";
import type { Paginated } from "@/components/admin/pagination";
import { SettingsSection } from "@/components/settings/section";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

type ApiLog = {
    id: number;
    source: "v1" | "agent";
    method: string;
    path: string;
    status: number;
    duration_ms: number;
    ip: string | null;
    user_agent: string | null;
    error: string | null;
    token: string | null;
    server: string | null;
    team: string | null;
    created_at: string | null;
};

type Filters = {
    source: string | null;
    result: string | null;
    search: string;
};

type Props = {
    logs: Paginated<ApiLog>;
    filters: Filters;
    totals: { day: number; errors: number };
    retention: number;
};

const sources = [
    { value: null, label: "All" },
    { value: "v1", label: "External API" },
    { value: "agent", label: "Agent failures" },
];

const results = [
    { value: null, label: "Any result" },
    { value: "ok", label: "Successful" },
    { value: "errors", label: "Errors" },
];

export default function AdminApiLogs({
    logs,
    filters,
    totals,
    retention,
}: Props) {
    const { t, locale } = useTranslation();
    const [search, setSearch] = useState(filters.search);

    const visit = (next: Partial<Filters>) =>
        router.get(
            ApiLogController.index.url(),
            { ...filters, ...next },
            { preserveState: true, replace: true },
        );

    const chip = (active: boolean) =>
        cn(
            "rounded-full px-3 py-1.5 text-sm transition-colors",
            active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted",
        );

    return (
        <>
            <Head title={t("API log")} />

            <SettingsSection
                flush
                title={t("API log")}
                description={t(
                    "Requests to the external API and failed reports of agents. Records are deleted after :days days. Last 24 hours: :day requests, :errors errors.",
                    {
                        days: retention,
                        day: totals.day,
                        errors: totals.errors,
                    },
                )}
            >
                <div className="flex flex-wrap items-center gap-3 border-b p-4 sm:px-6">
                    <form
                        className="relative min-w-56 flex-1"
                        onSubmit={(event) => {
                            event.preventDefault();
                            visit({ search });
                        }}
                    >
                        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t(
                                "Search by path, address, key, server or team",
                            )}
                            className="pl-9"
                        />
                    </form>
                    <div className="flex flex-wrap gap-1.5">
                        {sources.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => visit({ source: item.value })}
                                className={chip(filters.source === item.value)}
                            >
                                {t(item.label)}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {results.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => visit({ result: item.value })}
                                className={chip(filters.result === item.value)}
                            >
                                {t(item.label)}
                            </button>
                        ))}
                    </div>
                </div>

                {logs.data.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                        {t("No requests yet")}
                    </p>
                ) : (
                    <ul className="divide-y">
                        {logs.data.map((log) => (
                            <li key={log.id} className="space-y-1 p-4 sm:px-6">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <Badge
                                        variant={
                                            log.status >= 400
                                                ? "destructive"
                                                : "secondary"
                                        }
                                    >
                                        {log.status}
                                    </Badge>
                                    <span className="font-mono text-sm">
                                        {log.method} /{log.path}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {log.duration_ms} ms
                                    </span>
                                    <time className="ml-auto text-xs text-muted-foreground">
                                        {log.created_at &&
                                            new Date(
                                                log.created_at,
                                            ).toLocaleString(locale)}
                                    </time>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {[
                                        log.team,
                                        log.token &&
                                            `${t("Key")}: ${log.token}`,
                                        log.server &&
                                            `${t("Server")}: ${log.server}`,
                                        log.ip,
                                        log.user_agent,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ") || "—"}
                                </p>
                                {log.error && (
                                    <p className="text-sm text-destructive">
                                        {log.error}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <Pagination page={logs} />
            </SettingsSection>
        </>
    );
}
