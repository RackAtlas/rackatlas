import { Head, router, useHttp } from "@inertiajs/react";
import {
    Activity,
    ChevronDown,
    Download,
    FileText,
    Layers,
    Play,
    RefreshCw,
    RotateCw,
    Search,
    Square,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ApplicationController from "@/actions/App/Http/Controllers/ApplicationController";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/hooks/use-translation";
import { timeAgo } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { index } from "@/routes/applications";

type ServiceStatus = "failed" | "running" | "stopped" | "disabled";

type Service = {
    id: number;
    unit: string;
    description: string | null;
    status: ServiceStatus;
    active_state: string;
    sub_state: string | null;
    unit_file_state: string | null;
};

type ServiceAction = "start" | "stop" | "restart";

type OutputKind = "status" | "journal";

type Output = {
    output: string;
    fetched_at: string;
};

type ServerServices = {
    id: number;
    name: string;
    last_seen_at: string | null;
    ssh: boolean;
    services: Service[];
};

type Props = {
    team: { id: number; name: string } | null;
    canManage?: boolean;
    servers: ServerServices[];
    generated_at: string;
};

const STATUSES: ServiceStatus[] = ["failed", "running", "stopped", "disabled"];

const DOT: Record<ServiceStatus, string> = {
    failed: "bg-red-500",
    running: "bg-emerald-500",
    stopped: "bg-amber-500",
    disabled: "bg-muted-foreground/40",
};

const ALL = "all";

/** How many services of one server are shown before "Show all". */
const PAGE = 15;

const STORAGE_KEY = "applications.hide-system";

/**
 * Units the admin set up (enabled, disabled, masked) are applications. The rest (static, generated,
 * indirect, template instances without a unit file) belongs to the system itself and is mostly noise.
 */
function isSystemUnit(service: Service): boolean {
    return (
        service.status !== "failed" &&
        !["enabled", "disabled", "masked"].includes(
            service.unit_file_state ?? "",
        )
    );
}

function readHideSystem(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) !== "0";
    } catch {
        return true;
    }
}

function emptyCounts(): Record<ServiceStatus, number> {
    return { failed: 0, running: 0, stopped: 0, disabled: 0 };
}

export default function Applications({
    team,
    canManage = false,
    servers,
    generated_at,
}: Props) {
    const { t, locale } = useTranslation();
    const [status, setStatus] = useState<ServiceStatus | typeof ALL>(ALL);
    const [server, setServer] = useState<string>(ALL);
    const [search, setSearch] = useState("");
    const [hideSystem, setHideSystem] = useState(readHideSystem);
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const [acting, setActing] = useState<number | null>(null);
    const [outputOf, setOutputOf] = useState<{
        service: Service;
        serverName: string;
        kind: OutputKind;
    } | null>(null);

    // The services change by themselves, so look again now and then.
    useEffect(() => {
        const timer = setInterval(
            () => router.reload({ only: ["servers", "generated_at"] }),
            30000,
        );

        return () => clearInterval(timer);
    }, []);

    const act = (service: Service, action: ServiceAction) =>
        router.post(
            ApplicationController.act.url({ service: service.id, action }),
            {},
            {
                preserveScroll: true,
                only: ["servers", "generated_at"],
                onStart: () => setActing(service.id),
                onFinish: () => setActing(null),
            },
        );

    const toggleHideSystem = (value: boolean) => {
        setHideSystem(value);

        try {
            localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
        } catch {
            // The choice then only lasts until the page is closed.
        }
    };

    const toggle = (
        set: Set<number>,
        id: number,
        update: (next: Set<number>) => void,
    ) => {
        const next = new Set(set);

        if (!next.delete(id)) {
            next.add(id);
        }

        update(next);
    };

    const labels: Record<ServiceStatus, string> = {
        failed: t("Crashed"),
        running: t("Running"),
        stopped: t("Stopped"),
        disabled: t("Disabled"),
    };

    const query = search.trim().toLowerCase();
    const filtering = status !== ALL || query !== "";
    const dirty = filtering || server !== ALL;

    // Everything except the status chip, so the chips show what each one would give.
    const candidates = useMemo(
        () =>
            servers
                .filter((s) => server === ALL || String(s.id) === server)
                .map((s) => ({
                    ...s,
                    services: s.services.filter(
                        (service) =>
                            (!hideSystem || !isSystemUnit(service)) &&
                            (query === "" ||
                                service.unit.toLowerCase().includes(query) ||
                                (service.description ?? "")
                                    .toLowerCase()
                                    .includes(query)),
                    ),
                })),
        [servers, server, hideSystem, query],
    );

    const counts = useMemo(() => {
        const result = emptyCounts();

        candidates.forEach((s) =>
            s.services.forEach((service) => (result[service.status] += 1)),
        );

        return result;
    }, [candidates]);

    const hiddenSystem = useMemo(
        () =>
            servers
                .filter((s) => server === ALL || String(s.id) === server)
                .reduce(
                    (sum, s) => sum + s.services.filter(isSystemUnit).length,
                    0,
                ),
        [servers, server],
    );

    const visible = candidates
        .map((s) => ({
            ...s,
            summary: s.services.reduce((result, service) => {
                result[service.status] += 1;

                return result;
            }, emptyCounts()),
            services: s.services.filter(
                (service) => status === ALL || service.status === status,
            ),
        }))
        .filter((s) => s.services.length > 0);

    const total = visible.reduce((sum, s) => sum + s.services.length, 0);

    const clearFilters = () => {
        setStatus(ALL);
        setServer(ALL);
        setSearch("");
    };

    return (
        <>
            <Head title={t("Applications")} />

            <div className="mx-auto flex w-full max-w-[100rem] min-w-0 flex-col gap-5 p-4 md:p-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold">
                        {t("Applications")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            "The systemd services of the servers with the agent: what runs, what is stopped, switched off or crashed. The buttons act over SSH, right away: start, stop, restart, status and journal.",
                        )}
                    </p>
                </div>

                {team === null || servers.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
                        <Layers className="size-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            {t(
                                "No services yet. They appear once a server with the agent (version 1.6 or newer) sends its first report.",
                            )}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative min-w-48 flex-1 sm:max-w-sm">
                                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                        placeholder={t("Search services")}
                                        aria-label={t("Search services")}
                                        className="pl-8"
                                    />
                                </div>

                                <Select
                                    value={server}
                                    onValueChange={setServer}
                                >
                                    <SelectTrigger
                                        className="w-48"
                                        aria-label={t("Server")}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>
                                            {t("All servers")}
                                        </SelectItem>
                                        {servers.map((s) => (
                                            <SelectItem
                                                key={s.id}
                                                value={String(s.id)}
                                            >
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {dirty && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                    >
                                        <X className="size-3.5" />
                                        {t("Clear filters")}
                                    </Button>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div
                                    role="tablist"
                                    className="flex flex-wrap gap-1.5"
                                >
                                    {[ALL as typeof ALL, ...STATUSES].map(
                                        (value) => {
                                            const count =
                                                value === ALL
                                                    ? STATUSES.reduce(
                                                          (sum, key) =>
                                                              sum + counts[key],
                                                          0,
                                                      )
                                                    : counts[value];

                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={
                                                        status === value
                                                    }
                                                    onClick={() =>
                                                        setStatus(value)
                                                    }
                                                    className={cn(
                                                        "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                                                        status === value
                                                            ? "border-foreground/20 bg-muted font-medium"
                                                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                                        value === "failed" &&
                                                            count > 0 &&
                                                            "border-red-500/40",
                                                    )}
                                                >
                                                    {value !== ALL && (
                                                        <span
                                                            className={cn(
                                                                "size-2 rounded-full",
                                                                DOT[value],
                                                            )}
                                                            aria-hidden
                                                        />
                                                    )}
                                                    {value === ALL
                                                        ? t("All")
                                                        : labels[value]}
                                                    <span
                                                        className={cn(
                                                            "text-xs tabular-nums",
                                                            value ===
                                                                "failed" &&
                                                                count > 0
                                                                ? "font-semibold text-red-600 dark:text-red-400"
                                                                : "text-muted-foreground",
                                                        )}
                                                    >
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        },
                                    )}
                                </div>

                                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                                    <Checkbox
                                        checked={hideSystem}
                                        onCheckedChange={(value) =>
                                            toggleHideSystem(value === true)
                                        }
                                    />
                                    {t("Hide system units")}
                                    {hideSystem && hiddenSystem > 0 && (
                                        <span className="text-xs tabular-nums">
                                            ({hiddenSystem})
                                        </span>
                                    )}
                                </label>
                            </div>
                        </div>

                        {visible.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-12 text-center">
                                <p className="text-sm text-muted-foreground">
                                    {t("No service matches the filter.")}
                                </p>
                                {dirty && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={clearFilters}
                                    >
                                        {t("Clear filters")}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                        {t(
                                            ":count services on :servers servers",
                                            {
                                                count: String(total),
                                                servers: String(visible.length),
                                            },
                                        )}
                                    </span>
                                    {visible.length > 1 && (
                                        <button
                                            type="button"
                                            className="hover:text-foreground hover:underline"
                                            onClick={() =>
                                                setCollapsed(
                                                    collapsed.size === 0
                                                        ? new Set(
                                                              visible.map(
                                                                  (s) => s.id,
                                                              ),
                                                          )
                                                        : new Set(),
                                                )
                                            }
                                        >
                                            {collapsed.size === 0
                                                ? t("Collapse all")
                                                : t("Expand all")}
                                        </button>
                                    )}
                                </div>

                                {visible.map((s) => {
                                    // A search or a status filter looks at everything, so it opens the lists.
                                    const open =
                                        filtering || !collapsed.has(s.id);
                                    const all =
                                        filtering ||
                                        expanded.has(s.id) ||
                                        s.services.length <= PAGE;
                                    const shown = all
                                        ? s.services
                                        : s.services.slice(0, PAGE);

                                    return (
                                        <section
                                            key={s.id}
                                            className="overflow-hidden rounded-xl border bg-card"
                                        >
                                            <button
                                                type="button"
                                                aria-expanded={open}
                                                onClick={() =>
                                                    toggle(
                                                        collapsed,
                                                        s.id,
                                                        setCollapsed,
                                                    )
                                                }
                                                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-muted/40"
                                            >
                                                <ChevronDown
                                                    className={cn(
                                                        "size-4 shrink-0 text-muted-foreground transition-transform",
                                                        !open && "-rotate-90",
                                                    )}
                                                />
                                                <h2 className="font-semibold">
                                                    {s.name}
                                                </h2>
                                                <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                                                    {STATUSES.filter(
                                                        (key) =>
                                                            s.summary[key] > 0,
                                                    ).map((key) => (
                                                        <span
                                                            key={key}
                                                            className={cn(
                                                                "flex items-center gap-1",
                                                                key ===
                                                                    "failed" &&
                                                                    "font-medium text-red-600 dark:text-red-400",
                                                            )}
                                                            title={labels[key]}
                                                        >
                                                            <span
                                                                className={cn(
                                                                    "size-2 rounded-full",
                                                                    DOT[key],
                                                                )}
                                                                aria-hidden
                                                            />
                                                            <span className="tabular-nums">
                                                                {s.summary[key]}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </span>
                                                {s.last_seen_at && (
                                                    <span className="ml-auto text-xs text-muted-foreground">
                                                        {t("Reported :time", {
                                                            time: timeAgo(
                                                                s.last_seen_at,
                                                                generated_at,
                                                                locale,
                                                            ),
                                                        })}
                                                    </span>
                                                )}
                                            </button>

                                            {open && (
                                                <>
                                                    <ul className="divide-y border-t">
                                                        {shown.map(
                                                            (service) => (
                                                                <ServiceRow
                                                                    key={
                                                                        service.id
                                                                    }
                                                                    service={
                                                                        service
                                                                    }
                                                                    label={
                                                                        labels[
                                                                            service
                                                                                .status
                                                                        ]
                                                                    }
                                                                    canManage={
                                                                        canManage &&
                                                                        s.ssh
                                                                    }
                                                                    canRead={
                                                                        s.ssh
                                                                    }
                                                                    busy={
                                                                        acting ===
                                                                        service.id
                                                                    }
                                                                    onAct={act}
                                                                    onOutput={(
                                                                        kind,
                                                                    ) =>
                                                                        setOutputOf(
                                                                            {
                                                                                service,
                                                                                serverName:
                                                                                    s.name,
                                                                                kind,
                                                                            },
                                                                        )
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </ul>
                                                    {!all && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                toggle(
                                                                    expanded,
                                                                    s.id,
                                                                    setExpanded,
                                                                )
                                                            }
                                                            className="w-full border-t px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                                        >
                                                            {t(
                                                                "Show all :count",
                                                                {
                                                                    count: String(
                                                                        s
                                                                            .services
                                                                            .length,
                                                                    ),
                                                                },
                                                            )}
                                                        </button>
                                                    )}
                                                    {all &&
                                                        !filtering &&
                                                        s.services.length >
                                                            PAGE && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    toggle(
                                                                        expanded,
                                                                        s.id,
                                                                        setExpanded,
                                                                    )
                                                                }
                                                                className="w-full border-t px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                                            >
                                                                {t("Show less")}
                                                            </button>
                                                        )}
                                                </>
                                            )}
                                        </section>
                                    );
                                })}
                            </>
                        )}
                    </>
                )}
            </div>

            {outputOf && (
                <OutputDialog
                    service={outputOf.service}
                    serverName={outputOf.serverName}
                    kind={outputOf.kind}
                    onClose={() => setOutputOf(null)}
                />
            )}
        </>
    );
}

function ServiceRow({
    service,
    label,
    canManage,
    canRead,
    busy,
    onAct,
    onOutput,
}: {
    service: Service;
    label: string;
    canManage: boolean;
    canRead: boolean;
    busy: boolean;
    onAct: (service: Service, action: ServiceAction) => void;
    onOutput: (kind: OutputKind) => void;
}) {
    const { t } = useTranslation();
    const running = service.status === "running";
    const detail = [service.sub_state, service.unit_file_state]
        .filter(Boolean)
        .join(" · ");

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 hover:bg-muted/30">
            <span
                className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    DOT[service.status],
                )}
                title={label}
                aria-hidden
            />
            <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">
                    {service.unit.replace(/\.service$/, "")}
                </p>
                {service.description && (
                    <p className="truncate text-xs text-muted-foreground">
                        {service.description}
                    </p>
                )}
            </div>
            <div className="hidden w-36 shrink-0 text-right text-xs text-muted-foreground sm:block">
                <p
                    className={cn(
                        service.status === "failed" &&
                            "font-medium text-red-600 dark:text-red-400",
                    )}
                >
                    {label}
                </p>
                {detail && <p className="truncate">{detail}</p>}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1 md:w-96">
                {busy ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Spinner className="size-3.5" />
                        <span className="hidden md:inline">
                            {t("Working…")}
                        </span>
                    </span>
                ) : (
                    <>
                        {canManage && !running && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onAct(service, "start")}
                                aria-label={t("Start :name", {
                                    name: service.unit,
                                })}
                            >
                                <Play className="size-3.5" />
                                <span className="hidden md:inline">
                                    {t("Start")}
                                </span>
                            </Button>
                        )}
                        {canManage && running && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onAct(service, "restart")}
                                    aria-label={t("Restart :name", {
                                        name: service.unit,
                                    })}
                                >
                                    <RotateCw className="size-3.5" />
                                    <span className="hidden md:inline">
                                        {t("Restart")}
                                    </span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onAct(service, "stop")}
                                    aria-label={t("Stop :name", {
                                        name: service.unit,
                                    })}
                                >
                                    <Square className="size-3.5" />
                                    <span className="hidden md:inline">
                                        {t("Stop")}
                                    </span>
                                </Button>
                            </>
                        )}
                        {canRead && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOutput("status")}
                                    aria-label={t("Status of :name", {
                                        name: service.unit,
                                    })}
                                >
                                    <Activity className="size-3.5" />
                                    <span className="hidden md:inline">
                                        {t("Status")}
                                    </span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOutput("journal")}
                                    aria-label={t("Journal of :name", {
                                        name: service.unit,
                                    })}
                                >
                                    <FileText className="size-3.5" />
                                    <span className="hidden md:inline">
                                        {t("Journal")}
                                    </span>
                                </Button>
                            </>
                        )}
                    </>
                )}
            </div>
        </li>
    );
}

function OutputDialog({
    service,
    serverName,
    kind,
    onClose,
}: {
    service: Service;
    serverName: string;
    kind: OutputKind;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const http = useHttp<Record<string, never>, Output>({});
    const [state, setState] = useState<Output | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setError(null);

        const url =
            kind === "status"
                ? ApplicationController.status.url(service.id)
                : ApplicationController.journal.url(service.id);

        void http
            .post(url)
            .then(setState)
            .catch(() =>
                setError(
                    kind === "status"
                        ? t("The status could not be loaded.")
                        : t("The journal could not be loaded."),
                ),
            );
    };

    // Read over SSH right now.
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [service.id, kind]);

    const download = () => {
        if (!state) {
            return;
        }

        const url = URL.createObjectURL(
            new Blob([state.output + "\n"], { type: "text/plain" }),
        );
        const link = document.createElement("a");

        link.href = url;
        link.download = `${serverName}-${service.unit}-${kind}.txt`.replace(
            /[^A-Za-z0-9._@-]/g,
            "_",
        );
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>
                        {service.unit} · {serverName}
                    </DialogTitle>
                    <DialogDescription>
                        {kind === "status"
                            ? t("The output of systemctl status.")
                            : t("The last 500 lines of the journal.")}
                    </DialogDescription>
                </DialogHeader>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs break-all whitespace-pre-wrap">
                    {state?.output
                        ? state.output
                        : http.processing
                          ? t("Loading…")
                          : t("The output is empty.")}
                </pre>

                <div className="flex items-center justify-between gap-2">
                    {http.processing ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Spinner className="size-3.5" />
                            {t("Loading…")}
                        </span>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={download}
                            disabled={!state?.output}
                        >
                            <Download className="size-3.5" />
                            {t("Download")}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={load}
                            disabled={http.processing}
                        >
                            <RefreshCw className="size-3.5" />
                            {t("Refresh")}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

Applications.layout = {
    breadcrumbs: [{ title: "Applications", href: index() }],
};
