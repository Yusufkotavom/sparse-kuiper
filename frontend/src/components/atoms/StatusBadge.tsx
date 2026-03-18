"use client";

import { cn } from "@/lib/utils";

export type Status =
    | "active"
    | "pending"
    | "uploading"
    | "completed"
    | "failed"
    | "scheduled"
    | "needs_login"
    | "generating"
    | "queued";

interface StatusBadgeProps {
    status: Status | string;
    className?: string;
}

const STATUS_MAP: Record<string, { label: string; dotClassName: string; pulse?: boolean }> = {
    active: { label: "Active", dotClassName: "bg-emerald-500" },
    pending: { label: "Pending", dotClassName: "bg-amber-500" },
    uploading: { label: "Uploading", dotClassName: "bg-sky-500", pulse: true },
    completed: { label: "Completed", dotClassName: "bg-emerald-500" },
    failed: { label: "Failed", dotClassName: "bg-red-500" },
    scheduled: { label: "Scheduled", dotClassName: "bg-violet-500" },
    needs_login: { label: "Needs Login", dotClassName: "bg-orange-500" },
    generating: { label: "Generating", dotClassName: "bg-cyan-500", pulse: true },
    queued: { label: "Queued", dotClassName: "bg-blue-500" },
    completed_with_errors: { label: "Failed", dotClassName: "bg-red-500" },
    unqueued: { label: "Not Queued", dotClassName: "bg-zinc-500" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const normalized = String(status).toLowerCase();
    const config = STATUS_MAP[normalized] ?? { label: status, dotClassName: "bg-zinc-500" };

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2 py-0.5 text-xs font-medium text-foreground",
                className
            )}
        >
            <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName, config.pulse && "animate-pulse")} />
            <span>{config.label}</span>
        </span>
    );
}
