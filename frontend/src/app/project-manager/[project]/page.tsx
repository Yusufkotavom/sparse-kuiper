"use client";
 
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { videoApi, kdpApi, publisherApi } from "@/lib/api";
import { PageHeader } from "@/components/atoms/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/atoms/EmptyState";
import { ViewToggle } from "@/components/atoms/ViewToggle";
import { SegmentedTabs } from "@/components/atoms/SegmentedTabs";
import { FolderOpen, RefreshCw, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LazyProjectManagerCard, type ProjectType } from "@/components/organisms/ProjectManagerCard";
import { supabase } from "@/lib/supabase";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { QueueItem } from "@/lib/api";

export default function ProjectOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const name = typeof params?.project === "string" ? params.project : Array.isArray(params?.project) ? params.project[0] : "";
  const [projectType, setProjectType] = useState<ProjectType>("video");
  const [items, setItems] = useState<{ raw: string[]; final: string[]; archive: string[]; queue: string[] }>({ raw: [], final: [], archive: [], queue: [] });
  const [queueStatuses, setQueueStatuses] = useState<Record<string, QueueItem>>({});
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [metaByFile, setMetaByFile] = useState<Record<string, { title: string; description: string; tags: string }>>({});
  const [filterTab, setFilterTab] = useState<"all" | "final" | "raw" | "queue" | "archive">("all");
  const [assetViewMode, setAssetViewMode] = useState<"list" | "grid">("list");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recentRuns, setRecentRuns] = useState<Array<{ id: string; title: string; status: string; source: "queue" | "job"; at?: string | null }>>([]);

  const allFiles = useMemo(() => [...items.final, ...items.raw, ...(items.queue || []), ...(items.archive || [])], [items]);
  const filtered = useMemo(() => {
    if (filterTab === "all") return allFiles;
    if (filterTab === "final") return items.final;
    if (filterTab === "archive") return items.archive || [];
    if (filterTab === "queue") return items.queue || [];
    return items.raw;
  }, [filterTab, allFiles, items]);

  const finalCount = items.final.length;
  const rawCount = items.raw.length;
  const queueCount = (items.queue || []).length;
  const archiveCount = (items.archive || []).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vids, promptsData, qData, jobsData] = await Promise.all([
        projectType === "video" ? videoApi.listProjectVideos(name) : kdpApi.listProjectImages(name),
        projectType === "video"
          ? videoApi.getPrompts(name).catch(() => ({ prompts: [] }))
          : kdpApi.getPrompts(name).catch(() => ({ prompts: [] })),
        publisherApi.getQueue().catch(() => ({ queue: [] })),
        publisherApi.getJobs().catch(() => ({ jobs: [] })),
      ]);
      let queueFiles: string[] = [];
      const statusMap: Record<string, QueueItem> = {};
      (qData.queue || []).forEach((q: QueueItem) => { statusMap[q.filename] = q; });
      if (projectType === "video") {
        const queueList = (qData.queue || []) as Array<{ filename: string; project_dir?: string | null; file_path?: string | null }>;
        queueFiles = queueList
          .filter(it => {
            const dir = (it.project_dir || "").replace(/\\/g, "/");
            const fp = (it.file_path || "").replace(/\\/g, "/");
            return dir.includes(`/${name}/`) || fp.includes(`/video_projects/${name}/`);
          })
          .map(it => {
            const fp = (it.file_path || "").replace(/\\/g, "/");
            const marker = "/video_projects/";
            if (fp.includes(marker)) {
              const rel = fp.split(marker)[1] || "";
              if (rel.startsWith(`${name}/`)) return rel;
            }
            return `${name}/queue/${it.filename}`;
          });
      }
      setQueueStatuses(statusMap);
      const nextItems =
        projectType === "video"
          ? (() => {
            const v = vids as { raw: string[]; final: string[]; archive: string[] };
            return { raw: v.raw, final: v.final, archive: v.archive, queue: queueFiles };
          })()
          : (() => {
            const v = vids as { raw: string[]; final: string[] };
            return { raw: v.raw, final: v.final, archive: [], queue: [] };
          })();
      setItems(nextItems);
      setPrompts(promptsData.prompts || []);

      const normalizedProject = name.toLowerCase();
      const queueRuns = (qData.queue || [])
        .filter((item) => [item.filename || "", item.file_path || "", item.project_dir || "", item.metadata?.title || ""].some((value) => value.toLowerCase().includes(normalizedProject)))
        .map((item) => ({
          id: `queue:${item.filename}`,
          title: item.metadata?.title?.trim() || item.filename,
          status: item.status,
          source: "queue" as const,
          at: item.scheduled_at || item.uploaded_at || null,
        }));
      const jobRuns = (jobsData.jobs || [])
        .filter((job) => [job.filename || "", job.metadata?.title || ""].some((value) => value.toLowerCase().includes(normalizedProject)))
        .map((job) => ({
          id: `job:${job.filename}`,
          title: job.metadata?.title?.trim() || job.filename,
          status: job.worker_state || job.status || "pending",
          source: "job" as const,
          at: job.scheduled_at || job.last_run_at || null,
        }));
      setRecentRuns([...queueRuns, ...jobRuns].slice(0, 5));

      const metaFiles = [
        ...nextItems.final,
        ...nextItems.raw,
        ...(nextItems.queue || []),
        ...(nextItems.archive || []),
      ];
      if (metaFiles.length > 0) {
        const batch = await publisherApi.getAssetsMetadataBatch(projectType, metaFiles).catch(() => ({ items: [] }));
        const map: Record<string, { title: string; description: string; tags: string }> = {};
        (batch.items || []).forEach((it) => {
          map[it.file] = { title: it.title || "", description: it.description || "", tags: it.tags || "" };
        });
        setMetaByFile(map);
      } else {
        setMetaByFile({});
      }
    } finally {
      setLoading(false);
    }
  }, [projectType, name]);

  useEffect(() => {
    const ensureAuthAndLoad = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      await load();
    };
    ensureAuthAndLoad();
  }, [router, load]);

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-4 px-1 pb-4 sm:space-y-6">
      <PageHeader
        title={`Project: ${name}`}
        description={(
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <span>
                Assets <span className="font-mono text-foreground">{allFiles.length}</span>
              </span>
              <span>
                Final <span className="font-mono text-foreground">{finalCount}</span>
              </span>
              <span>
                Queue <span className="font-mono text-foreground">{queueCount}</span>
              </span>
              <span>
                Archived <span className="font-mono text-foreground">{archiveCount}</span>
              </span>
            </div>
            <div>Fokus halaman ini khusus untuk asset & operasi project terpilih agar tidak tumpang tindih dengan landing Project Manager.</div>
          </div>
        )}
        badge={`${filtered.length} items`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {!selectMode && (
              <Button 
                onClick={() => setSelectMode(true)} 
                size="sm" 
                variant="outline" 
                className="border-border hover:bg-elevated"
              >
                Enable Select
              </Button>
            )}
            {selectMode && (
              <>
                <Button 
                  onClick={() => { const s = new Set<string>(); filtered.forEach(f => s.add(f)); setSelected(s); }} 
                  size="sm" 
                  variant="outline" 
                  className="border-border hover:bg-elevated"
                >
                  Select All
                </Button>
                <Button 
                  onClick={() => setSelected(new Set())} 
                  size="sm" 
                  variant="outline" 
                  className="border-border hover:bg-elevated"
                >
                  Clear
                </Button>
                <span className="text-[11px] text-muted-foreground">Selected: <span className="font-mono text-foreground">{selected.size}</span></span>
                <Button 
                  onClick={() => setSelectMode(false)} 
                  size="sm" 
                  variant="ghost" 
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10"
                >
                  Exit
                </Button>
              </>
            )}
            <Button 
              onClick={() => router.push(`/looper?project=${encodeURIComponent(name)}`)} 
              size="sm" 
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold border-none"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" /> Looper Studio
            </Button>
            <Button onClick={load} size="sm" variant="outline" disabled={loading} className="border-border hover:bg-elevated">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <ViewToggle value={assetViewMode} onChange={(m) => setAssetViewMode(m)} storageKey={`project-page-assets-view-${name}`} />
          </div>
        )}
      />
      <SegmentedTabs
        className="w-fit"
        value={projectType}
        onChange={setProjectType}
        items={[
          { value: "video", label: "Video" },
          { value: "kdp", label: "Image Creation" },
        ]}
      />
      {recentRuns.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">Recent Runs for this project</p>
            <Button size="xs" variant="outline" onClick={() => router.push(`/runs?project=${encodeURIComponent(name)}`)}>Buka Runs</Button>
          </div>
          <div className="space-y-1">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-[11px]">
                <p className="min-w-0 flex-1 truncate text-foreground">{run.title}</p>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">{run.source}</span>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">{run.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <SegmentedTabs
          size="xs"
          className="w-fit"
          value={filterTab}
          onChange={setFilterTab}
          items={[
            { value: "all", label: `All (${allFiles.length})` },
            { value: "final", label: `✨ Final (${finalCount})` },
            { value: "raw", label: `🎬 Raw (${rawCount})` },
            { value: "queue", label: `🧺 Queue (${queueCount})` },
            { value: "archive", label: `📦 Archive (${archiveCount})` },
          ]}
        />
        {filterTab === "raw" && rawCount > 0 && (
          <Button 
            size="xs" 
            variant="ghost" 
            onClick={() => router.push(`/looper?project=${encodeURIComponent(name)}`)}
            className="text-sky-400 hover:text-sky-300 hover:bg-sky-400/10 h-7 text-[10px] font-bold uppercase tracking-wider"
          >
            Bulk Loop Selected <RotateCcw className="w-3 h-3 ml-1.5" />
          </Button>
        )}
      </div>
      {selectMode && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/40 p-3">
          <Label className="text-xs text-muted-foreground">Bulk Actions</Label>
          <Button
            size="sm"
            variant="outline"
            className="border-border hover:bg-elevated"
            onClick={async () => {
              const names = Array.from(selected).map(f => (f.split("/").pop() || f));
              try {
                if (projectType === "video") {
                  const res = await videoApi.bulkDeleteProjectVideos(name, names);
                  toast.success(res.message);
                } else {
                  const res = await kdpApi.bulkDeleteProjectImages(name, names);
                  toast.success(res.message);
                }
                setSelected(new Set());
                await load();
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "";
                toast.error(msg || "Failed to delete selected");
              }
            }}
          >
            Delete Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-border hover:bg-elevated"
            onClick={async () => {
              const names = Array.from(selected).map(f => (f.split("/").pop() || f));
              try {
                for (const fn of names) {
                  if (projectType === "video") await videoApi.moveVideoStage(name, fn, "final");
                  else await kdpApi.moveImageStage(name, fn, "final");
                }
                toast.success(`Moved ${names.length} to final`);
                setSelected(new Set());
                await load();
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "";
                toast.error(msg || "Failed to move to final");
              }
            }}
          >
            Move to Final
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-border hover:bg-elevated"
            onClick={async () => {
              const names = Array.from(selected).map(f => (f.split("/").pop() || f));
              try {
                for (const fn of names) {
                  if (projectType === "video") await videoApi.moveVideoStage(name, fn, "archive");
                  else await kdpApi.moveImageStage(name, fn, "archive");
                }
                toast.success(`Archived ${names.length}`);
                setSelected(new Set());
                await load();
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "";
                toast.error(msg || "Failed to archive selected");
              }
            }}
          >
            Archive
          </Button>
          {projectType === "video" && (
            <Button
              size="sm"
              variant="outline"
              className="border-border hover:bg-elevated"
              onClick={async () => {
                try {
                  const files = Array.from(selected);
                  let added = 0;
                  for (const rel of files) {
                    const meta = await publisherApi.getAssetMetadata("video", rel).catch(() => ({ title: "", description: "", tags: "" }));
                    const title = meta.title || (rel.split("/").pop() || "").replace(/\.[^\.]+$/, "");
                    const description = meta.description || `Uploaded from project ${name}`;
                    const tags = meta.tags || "#video";
                    await publisherApi.addToQueue({ project_type: "video", relative_path: rel, title, description, tags });
                    added++;
                  }
                  toast.success(`Queued ${added} video(s)`);
                  setSelected(new Set());
                  await load();
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "";
                  toast.error(msg || "Failed to add to queue");
                }
              }}
            >
              Add to Queue
            </Button>
          )}
          {projectType === "video" && (
            <Button
              size="sm"
              variant="outline"
              className="border-border hover:bg-elevated"
              onClick={async () => {
                try {
                  const files = Array.from(selected);
                  let updated = 0;
                  for (const rel of files) {
                    const base = (rel.split("/").pop() || "").replace(/\.[^\.]+$/, "");
                    const prompt = `Project: ${name}\nFilename: ${base}\nTask: Generate a compelling, viral, clickbait, title add 2 tags in title, SEO description (1-2 paragraphs), and 5-10 hashtags.\nStyle: viral,shortform video, friendly tone, english`;
                    const gen = await publisherApi.generateMetadata(prompt).catch(() => ({ title: base, description: `Video from project ${name}`, tags: "#video" }));
                    await publisherApi.setAssetMetadata("video", rel, { title: gen.title, description: gen.description, tags: gen.tags });
                    updated++;
                  }
                  toast.success(`Generated metadata for ${updated} video(s)`);
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "";
                  toast.error(msg || "Failed to generate metadata");
                }
              }}
            >
              Generate Metadata
            </Button>
          )}
        </div>
      )}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-border bg-surface/40 p-3 flex gap-4">
              <Skeleton className="w-24 h-24 rounded-lg shrink-0" />
              <div className="flex-1 space-y-3 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <EmptyState icon={FolderOpen} title="No assets found" description="Change tab or refresh project." action={{ label: "Refresh", onClick: load }} />
      )}
      {!loading && filtered.length > 0 && (
        assetViewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((file) => {
              const checked = selected.has(file);
              return (
                <div key={file} className="relative">
                  {selectMode && (
                    <label className="absolute top-2 left-2 z-10 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border-hover cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(file);
                          else next.delete(file);
                          setSelected(next);
                        }}
                        className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary"
                      />
                      Select
                    </label>
                  )}
                  <LazyProjectManagerCard
                    file={file}
                    projectType={projectType}
                    projectName={name}
                    queueStatus={queueStatuses[file.split("/").pop() || file]}
                    onDeleted={load}
                    onQueued={load}
                    prompts={prompts}
                    prefetchedMeta={metaByFile[file]}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface/30">
            <div className="grid grid-cols-[auto_88px_minmax(0,1.6fr)_120px_120px_minmax(260px,1fr)] gap-3 border-b border-border bg-elevated px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <div>{selectMode ? "Select" : "#"}</div>
              <div>Preview</div>
              <div>Asset</div>
              <div>Stage</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>
            {filtered.map((file, index) => {
              const checked = selected.has(file);
              const fileKey = file.split("/").pop() || file;
              return (
                <LazyProjectManagerCard
                  key={file}
                  variant="row"
                  leadingSlot={
                    selectMode ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(file);
                          else next.delete(file);
                          setSelected(next);
                        }}
                        className="h-3.5 w-3.5 rounded border-border bg-background text-primary focus:ring-primary"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{index + 1}</span>
                    )
                  }
                  file={file}
                  projectType={projectType}
                  projectName={name}
                  queueStatus={queueStatuses[fileKey]}
                  onDeleted={load}
                  onQueued={load}
                  prompts={prompts}
                  prefetchedMeta={metaByFile[file]}
                />
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
