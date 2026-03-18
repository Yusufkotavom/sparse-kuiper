"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/atoms/PageHeader";
import { KpiCard } from "@/components/atoms/KpiCard";
import { SegmentedTabs } from "@/components/atoms/SegmentedTabs";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { EmptyState } from "@/components/atoms/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { publisherApi, type PublisherJob, type QueueItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CalendarClock, ExternalLink, History, Loader2, Pause, Play, RefreshCw, SquareX } from "lucide-react";

type RunsTab = "active" | "scheduled" | "history";
type RunsIntent = "all" | "publisher" | "jobs" | "manager";

type RunsQueueItem = QueueItem & {
  worker_state?: string;
  attempt_count?: number;
  last_error?: string | null;
  last_run_at?: string | null;
  options?: Record<string, unknown>;
};

type UnifiedRun = {
  id: string;
  filename: string;
  title: string;
  source: "queue" | "job";
  status: string;
  scheduledAt?: string | null;
  lastRunAt?: string | null;
  uploadedAt?: string | null;
  attempts?: number;
  workerState?: string;
  platforms?: Record<string, { status: string; message: string; timestamp: string }>;
  filePath?: string | null;
  projectDir?: string | null;
  canOpenPublisher: boolean;
  canOpenPublished: boolean;
  canRunNow: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
};

const VALID_TABS: RunsTab[] = ["active", "scheduled", "history"];

function normalizeStatus(status?: string | null) {
  return (status || "").toLowerCase();
}

function readProjectName(pathValue?: string | null) {
  if (!pathValue) return "";
  const normalized = pathValue.replace(/\\/g, "/");
  const markers = ["/video_projects/", "/projects/"];

  for (const marker of markers) {
    const index = normalized.indexOf(marker);
    if (index === -1) continue;
    const after = normalized.slice(index + marker.length);
    return after.split("/")[0] || "";
  }

  return "";
}

function buildSearchHref(basePath: string, params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function hasPublishedHistory(run: UnifiedRun) {
  const platformResults = Object.keys(run.platforms || {}).length > 0;
  return Boolean(
    run.uploadedAt ||
    run.lastRunAt ||
    (run.attempts || 0) > 0 ||
    platformResults ||
    ["completed", "completed_with_errors", "failed", "archived", "uploaded", "success"].includes(normalizeStatus(run.status)) ||
    (run.workerState && normalizeStatus(run.workerState) !== "pending")
  );
}

function RunsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryProject = searchParams.get("project")?.trim() || "";
  const queryFile = searchParams.get("file")?.trim() || "";
  const intentValue = searchParams.get("intent");
  const intent: RunsIntent =
    intentValue === "publisher" || intentValue === "jobs" || intentValue === "manager" ? intentValue : "all";
  const requestedTab = searchParams.get("tab");
  const initialTab = VALID_TABS.includes((requestedTab as RunsTab) || "active") ? (requestedTab as RunsTab) : "active";

  const [tab, setTab] = useState<RunsTab>(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [queue, setQueue] = useState<RunsQueueItem[]>([]);
  const [jobs, setJobs] = useState<PublisherJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  useEffect(() => {
    const nextTab = VALID_TABS.includes((requestedTab as RunsTab) || "active") ? (requestedTab as RunsTab) : "active";
    setTab(nextTab);
  }, [requestedTab]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [queueRes, jobsRes] = await Promise.all([publisherApi.getQueue(), publisherApi.getJobs()]);
      setQueue((queueRes.queue || []) as RunsQueueItem[]);
      setJobs(jobsRes.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data runs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const allRuns = useMemo<UnifiedRun[]>(() => {
    const queueRuns: UnifiedRun[] = queue.map((item) => {
      const title = item.metadata?.title?.trim() || item.filename;
      const workerState = item.worker_state || item.status;
      const normalized = normalizeStatus(workerState || item.status);
      const derivedProject = readProjectName(item.project_dir) || readProjectName(item.file_path);
      const platformResults = item.platforms || {};

      return {
        id: `queue:${item.filename}`,
        filename: item.filename,
        title,
        source: "queue",
        status: item.status,
        scheduledAt: item.scheduled_at,
        lastRunAt: item.last_run_at,
        uploadedAt: item.uploaded_at,
        attempts: item.attempt_count,
        workerState,
        platforms: platformResults,
        filePath: item.file_path,
        projectDir: item.project_dir || derivedProject || null,
        canOpenPublisher: true,
        canOpenPublished: hasPublishedHistory({
          id: `queue:${item.filename}`,
          filename: item.filename,
          title,
          source: "queue",
          status: item.status,
          scheduledAt: item.scheduled_at,
          lastRunAt: item.last_run_at,
          uploadedAt: item.uploaded_at,
          attempts: item.attempt_count,
          workerState,
          platforms: platformResults,
          filePath: item.file_path,
          projectDir: item.project_dir || derivedProject || null,
          canOpenPublisher: true,
          canOpenPublished: false,
          canRunNow: false,
          canPause: false,
          canResume: false,
          canCancel: false,
        }),
        canRunNow: false,
        canPause: false,
        canResume: false,
        canCancel: false,
      };
    });

    const jobRuns: UnifiedRun[] = jobs.map((job) => {
      const workerState = job.worker_state || job.status || "pending";
      const normalized = normalizeStatus(workerState);
      const platforms = job.platforms || {};

      return {
        id: `job:${job.filename}`,
        filename: job.filename,
        title: job.metadata?.title?.trim() || job.filename,
        source: "job",
        status: workerState,
        scheduledAt: job.scheduled_at,
        lastRunAt: job.last_run_at,
        uploadedAt: job.uploaded_at,
        attempts: job.attempt_count,
        workerState,
        platforms,
        filePath: null,
        projectDir: null,
        canOpenPublisher: false,
        canOpenPublished: hasPublishedHistory({
          id: `job:${job.filename}`,
          filename: job.filename,
          title: job.metadata?.title?.trim() || job.filename,
          source: "job",
          status: workerState,
          scheduledAt: job.scheduled_at,
          lastRunAt: job.last_run_at,
          uploadedAt: job.uploaded_at,
          attempts: job.attempt_count,
          workerState,
          platforms,
          filePath: null,
          projectDir: null,
          canOpenPublisher: false,
          canOpenPublished: false,
          canRunNow: false,
          canPause: false,
          canResume: false,
          canCancel: false,
        }),
        canRunNow: normalized !== "running" && normalized !== "processing" && normalized !== "uploading",
        canPause: normalized === "scheduled" || normalized === "running",
        canResume: normalized === "paused" || normalized === "canceled",
        canCancel: normalized !== "completed" && normalized !== "uploaded" && normalized !== "success",
      };
    });

    return [...queueRuns, ...jobRuns];
  }, [jobs, queue]);

  const filteredRuns = useMemo(() => {
    return allRuns.filter((run) => {
      if (intent === "publisher" && run.source !== "queue") return false;
      if (intent === "jobs" && run.source !== "job") return false;

      const haystack = [
        run.filename,
        run.title,
        run.projectDir || "",
        run.filePath || "",
      ]
        .join(" ")
        .toLowerCase();

      if (queryProject && !haystack.includes(queryProject.toLowerCase())) return false;
      if (queryFile && !haystack.includes(queryFile.toLowerCase())) return false;
      return true;
    });
  }, [allRuns, intent, queryFile, queryProject]);

  const activeStatuses = new Set(["running", "uploading", "processing", "active", "queued", "pending", "generating"]);
  const doneStatuses = new Set(["completed", "done", "uploaded", "success"]);
  const failedStatuses = new Set(["failed", "error", "completed_with_errors", "cancelled", "canceled"]);

  const activeRuns = filteredRuns.filter((run) => activeStatuses.has(normalizeStatus(run.status)));
  const scheduledRuns = filteredRuns.filter((run) => {
    const status = normalizeStatus(run.status);
    return status === "scheduled" || Boolean(run.scheduledAt);
  });
  const historyRuns = filteredRuns.filter((run) => {
    const status = normalizeStatus(run.status);
    return doneStatuses.has(status) || failedStatuses.has(status) || hasPublishedHistory(run);
  });

  const visibleRuns = tab === "active" ? activeRuns : tab === "scheduled" ? scheduledRuns : historyRuns;

  const publishedHref = buildSearchHref("/published", {
    project: queryProject || null,
    file: queryFile || null,
  });

  const mutateJob = async (run: UnifiedRun, action: "runNow" | "pause" | "resume" | "cancel") => {
    setActionKey(`${action}:${run.id}`);
    setError(null);
    try {
      if (action === "runNow") await publisherApi.runNowJob(run.filename);
      if (action === "pause") await publisherApi.pauseJob(run.filename);
      if (action === "resume") await publisherApi.resumeJob(run.filename);
      if (action === "cancel") await publisherApi.cancelJob(run.filename);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menjalankan aksi job.");
    } finally {
      setActionKey(null);
    }
  };

  const subtitleBits = [
    intent === "publisher" ? "Menampilkan queue-ready assets untuk lanjut ke Queue Builder." : null,
    intent === "jobs" ? "Fokus pada job scheduler dan kontrol eksekusi." : null,
    queryProject ? `Filter project: ${queryProject}` : null,
    queryFile ? `Filter file: ${queryFile}` : null,
  ].filter(Boolean);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Runs"
        description={subtitleBits.length > 0 ? subtitleBits.join(" ") : "Satu tampilan untuk monitor proses aktif, jadwal, dan histori gagal/selesai."}
        badge="Operational Hub"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={publishedHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <History className="mr-1 h-4 w-4" />
              Open Published
            </Link>
            <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              Refresh
            </Button>
            <span className="text-xs text-muted-foreground">Legacy routes `/queue`, `/jobs`, `/queue-manager` sekarang diteruskan ke Runs dengan intent yang sesuai.</span>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-surface/40 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Langkah 3: Monitor hasil job</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-background px-3 py-1 text-foreground">1. Assets</span>
              <span>→</span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-foreground">2. Queue Builder</span>
              <span>→</span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-foreground">3. Runs</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Semua job yang sudah dibuat akan tampil di sini untuk dipantau, dijalankan ulang, pause, resume, atau cancel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/project-manager" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Assets
            </Link>
            <Link href="/publisher" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Queue Builder
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Active" value={activeRuns.length} size="sm" />
        <KpiCard label="Scheduled" value={scheduledRuns.length} size="sm" />
        <KpiCard label="History" value={historyRuns.length} size="sm" />
        <KpiCard label="Total Runs" value={filteredRuns.length} size="sm" />
      </div>

      <SegmentedTabs<RunsTab>
        items={[
          { value: "active", label: "Active" },
          { value: "scheduled", label: "Scheduled" },
          { value: "history", label: "History / Failed" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <div className="rounded-lg border border-red-700/60 bg-red-900/20 p-3 text-sm text-red-200">{error}</div>
      ) : null}

      {isLoading && filteredRuns.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          Memuat data runs...
        </div>
      ) : null}

      {!isLoading && visibleRuns.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Belum ada data pada tab ini"
          description="Coba tab lain, ubah filter, atau refresh data dari backend."
          action={intent === "publisher" ? { label: "Open Queue Builder", onClick: () => router.push("/publisher") } : undefined}
        />
      ) : null}

      {visibleRuns.length > 0 && (
        <div className="space-y-2">
          {visibleRuns.map((run) => {
            const publisherHref = buildSearchHref("/publisher", { file: run.filename });
            const publishedRowHref = buildSearchHref("/published", {
              project: queryProject || null,
              file: run.filename,
            });

            return (
              <div key={run.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{run.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{run.source === "queue" ? "Source: Queue asset" : "Source: Job scheduler"}</span>
                      {run.projectDir ? <span>Project: {readProjectName(run.projectDir) || run.projectDir}</span> : null}
                      {run.filename ? <span className="truncate font-mono">{run.filename}</span> : null}
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {run.scheduledAt ? <span>Scheduled: {new Date(run.scheduledAt).toLocaleString()}</span> : null}
                  {run.lastRunAt ? <span>Last Run: {new Date(run.lastRunAt).toLocaleString()}</span> : null}
                  {run.uploadedAt ? <span>Uploaded: {new Date(run.uploadedAt).toLocaleString()}</span> : null}
                  {typeof run.attempts === "number" ? <span>Attempts: {run.attempts}</span> : null}
                  {run.workerState ? <span>Worker: {run.workerState}</span> : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {run.canOpenPublisher ? (
                    <Link href={publisherHref} className={buttonVariants({ size: "sm" })}>
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Open Queue Builder
                    </Link>
                  ) : null}

                  {run.canOpenPublished ? (
                    <Link href={publishedRowHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <History className="mr-1 h-4 w-4" />
                      Open Published
                    </Link>
                  ) : null}

                  {run.source === "job" && run.canRunNow ? (
                    <Button size="sm" variant="outline" onClick={() => void mutateJob(run, "runNow")} disabled={actionKey === `runNow:${run.id}`}>
                      {actionKey === `runNow:${run.id}` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                      Run Now
                    </Button>
                  ) : null}

                  {run.source === "job" && run.canPause ? (
                    <Button size="sm" variant="outline" onClick={() => void mutateJob(run, "pause")} disabled={actionKey === `pause:${run.id}`}>
                      {actionKey === `pause:${run.id}` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Pause className="mr-1 h-4 w-4" />}
                      Pause
                    </Button>
                  ) : null}

                  {run.source === "job" && run.canResume ? (
                    <Button size="sm" variant="outline" onClick={() => void mutateJob(run, "resume")} disabled={actionKey === `resume:${run.id}`}>
                      {actionKey === `resume:${run.id}` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                      Resume
                    </Button>
                  ) : null}

                  {run.source === "job" && run.canCancel ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn("text-rose-300 hover:text-rose-200")}
                      onClick={() => void mutateJob(run, "cancel")}
                      disabled={actionKey === `cancel:${run.id}`}
                    >
                      {actionKey === `cancel:${run.id}` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <SquareX className="mr-1 h-4 w-4" />}
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function RunsPage() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-muted-foreground">Loading runs...</div>}>
      <RunsContent />
    </Suspense>
  );
}
