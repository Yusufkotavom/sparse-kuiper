"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { publisherApi } from "@/lib/api";
import { PageHeader } from "@/components/atoms/PageHeader";
import { EmptyState } from "@/components/atoms/EmptyState";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";

type PlatformStatus = { status: string; message: string; timestamp: string };
type QueueItem = {
    filename: string;
    status: string;
    platforms: Record<string, PlatformStatus>;
    metadata?: { title?: string; description?: string; tags?: string };
    uploaded_at?: string | null;
    scheduled_at?: string | null;
    worker_state?: string;
    attempt_count?: number;
    last_error?: string;
    last_run_at?: string | null;
    options?: Record<string, unknown>;
    file_path?: string | null;
    project_dir?: string | null;
};

const LOG_STATUSES = new Set(["completed", "completed_with_errors", "failed"]);

function PublishedContent() {
    const searchParams = useSearchParams();
    const [items, setItems] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(false);
    const projectFilter = searchParams.get("project")?.trim().toLowerCase() || "";
    const fileFilter = searchParams.get("file")?.trim().toLowerCase() || "";

    const load = async () => {
        setLoading(true);
        try {
            const response = await publisherApi.getPublishedQueue();
            setItems(response.queue || []);
        } catch (error) {
            console.error("Failed to load published logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const logs = useMemo(() => {
        const withHistory = items.filter((item) => {
            const hasPublished = LOG_STATUSES.has(item.status);
            const hasJobHistory = (item.attempt_count || 0) > 0 || (item.worker_state && item.worker_state !== "pending");
            return hasPublished || hasJobHistory;
        });
        const filtered = withHistory.filter((item) => {
            const haystack = [
                item.filename,
                item.metadata?.title || "",
                item.file_path || "",
                item.project_dir || "",
            ]
                .join(" ")
                .toLowerCase();

            if (projectFilter && !haystack.includes(projectFilter)) return false;
            if (fileFilter && !haystack.includes(fileFilter)) return false;
            return true;
        });

        return filtered.sort((a, b) => {
            const at = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
            const bt = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
            return bt - at || b.filename.localeCompare(a.filename);
        });
    }, [fileFilter, items, projectFilter]);

    const exportCsv = () => {
        if (logs.length === 0) return;
        const rows = [
            ["filename", "status", "worker_state", "campaign_id", "platforms", "attempt_count", "uploaded_at", "last_run_at", "title", "last_error"],
            ...logs.map((item) => [
                item.filename,
                item.status,
                item.worker_state || "",
                item.options?.campaign_id || "",
                Object.keys(item.platforms || {}).join("|"),
                String(item.attempt_count || 0),
                item.uploaded_at || "",
                item.last_run_at || "",
                item.metadata?.title || "",
                item.last_error || "",
            ]),
        ];
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `published-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            <PageHeader
                title="Published & Job History"
                description="Riwayat publish dan history eksekusi job dalam satu halaman."
                badge={`${logs.length} records`}
                actions={(
                    <>
                        <Link href={projectFilter ? `/runs?project=${encodeURIComponent(searchParams.get("project") || "")}` : "/runs"} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Back to Runs
                        </Link>
                        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button size="sm" onClick={exportCsv} disabled={logs.length === 0}>
                            <Download className="mr-1.5 h-4 w-4" />
                            Export CSV
                        </Button>
                    </>
                )}
            />

            {logs.length === 0 ? (
                <EmptyState
                    icon={Download}
                    title="Belum ada history publish/job"
                    description="Setelah upload/job berjalan, hasilnya akan muncul di halaman ini."
                    action={{ label: "Buka Runs", onClick: () => (window.location.href = projectFilter ? `/runs?project=${encodeURIComponent(searchParams.get("project") || "")}` : "/runs") }}
                />
            ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                    <div className="hidden md:grid grid-cols-12 border-b border-border bg-elevated px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <div className="col-span-4">Asset</div>
                        <div className="col-span-2 text-center">Status</div>
                        <div className="col-span-2">Job</div>
                        <div className="col-span-2">Platforms</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>
                    {logs.map((item) => {
                        const campaignIdRaw = item.options ? item.options["campaign_id"] : undefined;
                        const campaignId = typeof campaignIdRaw === "string" ? campaignIdRaw : "";
                        const publishScheduleRaw = item.options ? item.options["platform_publish_schedule"] : undefined;
                        const publishScheduleLocal =
                            typeof publishScheduleRaw === "string" || typeof publishScheduleRaw === "number"
                                ? new Date(publishScheduleRaw).toLocaleString()
                                : "";
                        return (
                        <div key={item.filename} className="flex flex-col md:grid md:grid-cols-12 md:items-center border-b border-border/60 px-4 py-3 text-sm last:border-b-0 gap-3 md:gap-0">
                            <div className="col-span-4 min-w-0">
                                <p className="truncate font-mono text-xs text-foreground">{item.filename}</p>
                                {item.metadata?.title ? <p className="truncate text-xs text-muted-foreground">{item.metadata.title}</p> : null}
                                {(campaignId || item.scheduled_at || publishScheduleLocal) && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {campaignId && (
                                            <span className="rounded-full border border-sky-700 bg-sky-900/20 px-2 py-0.5 text-[10px] text-sky-300">
                                                Campaign: {campaignId}
                                            </span>
                                        )}
                                        {item.scheduled_at && (
                                            <span className="rounded-full border border-amber-700 bg-amber-900/20 px-2 py-0.5 text-[10px] text-amber-300">
                                                Job: {new Date(item.scheduled_at).toLocaleString()}
                                            </span>
                                        )}
                                        {publishScheduleLocal && (
                                            <span className="rounded-full border border-cyan-700 bg-cyan-900/20 px-2 py-0.5 text-[10px] text-cyan-300">
                                                Publish: {publishScheduleLocal}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="col-span-2 flex md:justify-center">
                                <StatusBadge status={item.status} />
                            </div>
                            <div className="col-span-2 space-y-1 text-[11px] text-muted-foreground">
                                <p className="flex justify-between md:block"><span className="md:hidden">Worker:</span> {item.worker_state || "pending"}</p>
                                {typeof item.attempt_count === "number" ? <p className="flex justify-between md:block"><span className="md:hidden">Attempts:</span> {item.attempt_count}</p> : null}
                                {item.last_run_at ? <p className="flex justify-between md:block"><span className="md:hidden">Run:</span> {new Date(item.last_run_at).toLocaleString()}</p> : null}
                                {item.uploaded_at ? <p className="flex justify-between md:block"><span className="md:hidden">Upload:</span> {new Date(item.uploaded_at).toLocaleString()}</p> : null}
                            </div>
                            <div className="col-span-2 flex flex-wrap gap-1">
                                {Object.entries(item.platforms || {}).map(([platform, p]) => (
                                    <span
                                        key={`${item.filename}-${platform}`}
                                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                                            p.status === "success"
                                                ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-300"
                                                : "border-red-600/40 bg-red-500/10 text-red-300"
                                        }`}
                                        title={p.message || ""}
                                    >
                                        {platform}:{p.status}
                                    </span>
                                ))}
                            </div>
                            <div className="col-span-2 flex justify-end gap-2">
                                <Link href="/publisher" className={buttonVariants({ variant: "outline", size: "sm", className: "w-full md:w-auto" })}>
                                    Retry
                                </Link>
                            </div>
                            {item.last_error ? (
                                <div className="col-span-12 mt-2 text-[11px] text-red-400 bg-red-950/20 p-2 rounded border border-red-900/30">
                                    Last error: {item.last_error}
                                </div>
                            ) : null}
                            {Object.entries(item.platforms || {}).some(([, p]) => Boolean(p.message)) ? (
                                <div className="col-span-12 mt-2 space-y-1 text-[11px]">
                                    {Object.entries(item.platforms || {}).map(([platform, p]) => (
                                        p.message ? (
                                            <div
                                                key={`${item.filename}-msg-${platform}`}
                                                className={`rounded border px-2 py-1 ${
                                                    p.status === "success"
                                                        ? "border-emerald-700/40 bg-emerald-900/15 text-emerald-300"
                                                        : "border-red-700/40 bg-red-900/15 text-red-300"
                                                }`}
                                            >
                                                {platform}: {p.message}
                                            </div>
                                        ) : null
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )})}
                </div>
            )}
        </div>
    );
}

export default function PublishedPage() {
    return (
        <Suspense fallback={<div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Loading published history...</div>}>
            <PublishedContent />
        </Suspense>
    );
}
