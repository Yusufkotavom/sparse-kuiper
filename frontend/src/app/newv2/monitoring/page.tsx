"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { KpiCard } from "@/components/atoms/KpiCard";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { NEWV2_TASKS, statusToBadge, summarizeTasks } from "@/components/newv2/planData";
import { queueBuilderApi, type QueueBuilderJob } from "@/lib/api";

type RunsMetrics = {
  queued: number;
  scheduled: number;
  running: number;
  failed: number;
  total: number;
};

function normalizeStatus(status?: string | null) {
  return (status || "").toLowerCase();
}

export default function NewV2MonitoringPage() {
  const summary = useMemo(() => summarizeTasks(NEWV2_TASKS), []);
  const [metrics, setMetrics] = useState<RunsMetrics>({ queued: 0, scheduled: 0, running: 0, failed: 0, total: 0 });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const loadMetrics = async () => {
    setIsLoadingMetrics(true);
    setMetricsError(null);
    try {
      const [queueRes, jobsRes] = await Promise.all([queueBuilderApi.getQueue(), queueBuilderApi.getJobs()]);
      const queueItems = queueRes.queue || [];
      const jobs = jobsRes.jobs || [];
      const combined = [...queueItems, ...jobs];

      const nextMetrics = combined.reduce<RunsMetrics>(
        (acc, item) => {
          const status = normalizeStatus((item as QueueBuilderJob).worker_state || item.status);
          acc.total += 1;

          if (["running", "processing", "uploading"].includes(status)) {
            acc.running += 1;
          } else if (["scheduled"].includes(status)) {
            acc.scheduled += 1;
          } else if (["failed", "error", "completed_with_errors"].includes(status)) {
            acc.failed += 1;
          } else {
            acc.queued += 1;
          }
          return acc;
        },
        { queued: 0, scheduled: 0, running: 0, failed: 0, total: 0 }
      );

      setMetrics(nextMetrics);
      setLastSyncAt(new Date().toISOString());
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : "Gagal memuat metrics runs.");
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    void loadMetrics();
    const timer = setInterval(() => {
      void loadMetrics();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-1 pb-8">
      <PageHeader
        title="NewV2 · Monitoring"
        description="Monitoring board untuk checklist implementasi plan V2."
        badge="Plan monitor"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/newv2" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Back to NewV2</Link>
            <Link href="/runs" className={cn(buttonVariants({ size: "sm" }))}>Open Runs</Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Total" value={summary.total} size="sm" />
        <KpiCard label="Done" value={summary.done} size="sm" />
        <KpiCard label="In Progress" value={summary.inProgress} size="sm" />
        <KpiCard label="Blocked" value={summary.blocked} size="sm" />
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Realtime Runs Metrics</CardTitle>
          <CardDescription>Data dari API queue/jobs dengan auto refresh setiap 15 detik.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-5">
            <KpiCard label="Total Runs" value={metrics.total} size="sm" />
            <KpiCard label="Queued" value={metrics.queued} size="sm" />
            <KpiCard label="Scheduled" value={metrics.scheduled} size="sm" />
            <KpiCard label="Running" value={metrics.running} size="sm" />
            <KpiCard label="Failed" value={metrics.failed} size="sm" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Button variant="outline" size="sm" onClick={() => void loadMetrics()} disabled={isLoadingMetrics}>
              Refresh Metrics
            </Button>
            <span>{isLoadingMetrics ? "Syncing..." : "Idle"}</span>
            {lastSyncAt && <span>Last sync: {lastSyncAt}</span>}
          </div>
          {metricsError && <p className="text-xs text-destructive">{metricsError}</p>}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Task Board</CardTitle>
          <CardDescription>Status tugas plan: todo / in-progress / blocked / done.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {NEWV2_TASKS.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.id} · {task.priority} · {task.milestone}</p>
              </div>
              <StatusBadge status={statusToBadge(task.status)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
