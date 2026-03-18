"use client";

import { useMemo, useState } from "react";
import type { QueueItem } from "@/lib/api";
import { getApiBase, kdpApi, publisherApi, videoApi } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectDrawer } from "@/components/organisms/ProjectDrawer";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronDown, Eye, Sparkles, Send, Trash2, FolderSync } from "lucide-react";

export type ProjectType = "video" | "kdp";

type ProjectManagerCardProps = {
  file: string;
  projectType: ProjectType;
  projectName: string;
  queueStatus?: QueueItem;
  variant?: "card" | "row";
  density?: "compact" | "comfortable";
  leadingSlot?: React.ReactNode;
  onDeleted?: () => void;
  onQueued?: () => void;
  prompts?: string[];
  prefetchedMeta?: {
    title?: string;
    description?: string;
    tags?: string;
  };
};

export function LazyProjectManagerCard({
  file,
  projectType,
  projectName,
  queueStatus,
  variant = "card",
  density = "comfortable",
  leadingSlot,
  onDeleted,
  onQueued,
  prefetchedMeta,
}: ProjectManagerCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const fileName = file.split("/").pop() || file;
  const title = prefetchedMeta?.title || queueStatus?.metadata?.title || fileName;
  const currentStage = useMemo(() => {
    const normalized = file.replace(/\\/g, "/").toLowerCase();
    if (normalized.includes("/raw/") || normalized.includes("/raw_videos/")) return "raw";
    if (normalized.includes("/final/")) return "final";
    if (normalized.includes("/archive/")) return "archive";
    if (normalized.includes("/queue/")) return "queue";
    return "unknown";
  }, [file]);

  const previewUrl = useMemo(() => {
    if (projectType === "kdp") {
      return `${getApiBase()}/projects_static/${file}`;
    }
    if (/\.(png|jpe?g|webp)$/i.test(file)) {
      return `${getApiBase()}/video_projects_static/${file}`;
    }
    if (/\.(mp4|mov|webm|m4v|avi)$/i.test(file)) {
      return `${getApiBase()}/video_projects_static/${file}`;
    }
    return undefined;
  }, [file, projectType]);

  const thumbnailUrl = useMemo(() => {
    if (projectType === "kdp") {
      return `${getApiBase()}/projects_static/${file}`;
    }
    if (/\.(png|jpe?g|webp)$/i.test(file)) {
      return `${getApiBase()}/video_projects_static/${file}`;
    }
    if (/\.(mp4|mov|webm|m4v|avi)$/i.test(file)) {
      return `${getApiBase()}/video/thumbnail?file=${encodeURIComponent(file)}`;
    }
    return undefined;
  }, [file, projectType]);

  const refreshParent = async () => {
    if (onDeleted) await onDeleted();
    if (onQueued && onQueued !== onDeleted) await onQueued();
  };

  const runAction = async (key: string, action: () => Promise<void>, successMessage: string) => {
    setBusyKey(key);
    try {
      await action();
      toast.success(successMessage);
      await refreshParent();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      toast.error(message);
    } finally {
      setBusyKey(null);
    }
  };

  const generateSingleMetadata = async () => {
    const base = fileName.replace(/\.[^\.]+$/, "");
    const prompt = `Project: ${projectName}\nFilename: ${base}\nTask: Generate a compelling, viral, clickbait, title add 2 tags in title, SEO description (1-2 paragraphs), and 5-10 hashtags.\nStyle: viral,shortform video, friendly tone, english`;
    await runAction(
      "generate",
      async () => {
        const gen = await publisherApi.generateMetadata(prompt).catch(() => ({ title: base, description: `Asset from project ${projectName}`, tags: "#content" }));
        await publisherApi.setAssetMetadata(projectType, file, { title: gen.title, description: gen.description, tags: gen.tags });
      },
      "Metadata generated"
    );
  };

  const enqueueCurrentAsset = async () => {
    await runAction(
      "enqueue",
      async () => {
        const meta = await publisherApi.getAssetMetadata(projectType, file).catch(() => ({ title: "", description: "", tags: "" }));
        await publisherApi.addToQueue({
          project_type: projectType,
          relative_path: file,
          title: meta.title || fileName.replace(/\.[^\.]+$/, ""),
          description: meta.description || `Uploaded from project ${projectName}`,
          tags: meta.tags || (projectType === "video" ? "#video" : "#image"),
        });
      },
      "Added to queue"
    );
  };

  const moveAsset = async (targetStage: "raw" | "final" | "archive") => {
    await runAction(
      `move:${targetStage}`,
      async () => {
        if (projectType === "video") await videoApi.moveVideoStage(projectName, fileName, targetStage);
        else await kdpApi.moveImageStage(projectName, fileName, targetStage);
      },
      `Moved to ${targetStage}`
    );
  };

  const deleteAsset = async () => {
    await runAction(
      "delete",
      async () => {
        if (projectType === "video") await videoApi.bulkDeleteProjectVideos(projectName, [fileName]);
        else await kdpApi.bulkDeleteProjectImages(projectName, [fileName]);
      },
      "Asset deleted"
    );
  };

  const actions = (
    <>
      <Button size="sm" variant="outline" onClick={() => setDrawerOpen(true)}>
        <Eye className="mr-1.5 h-4 w-4" /> Preview
      </Button>
      <Button size="sm" variant="outline" onClick={() => void generateSingleMetadata()} disabled={busyKey === "generate"}>
        <Sparkles className="mr-1.5 h-4 w-4" /> Gen Metadata
      </Button>
      {projectType === "video" && (
        <Button size="sm" onClick={() => void enqueueCurrentAsset()} disabled={busyKey === "enqueue"}>
          <Send className="mr-1.5 h-4 w-4" /> Add to Queue
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline"><FolderSync className="mr-1.5 h-4 w-4" /> Move <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>} />
        <DropdownMenuContent align="end" className="bg-surface border-border">
          {currentStage !== "raw" ? <DropdownMenuItem onClick={() => void moveAsset("raw")}>Move to Raw</DropdownMenuItem> : null}
          {currentStage !== "final" ? <DropdownMenuItem onClick={() => void moveAsset("final")}>Move to Final</DropdownMenuItem> : null}
          {currentStage !== "archive" ? <DropdownMenuItem onClick={() => void moveAsset("archive")}>Move to Archive</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {projectType === "video" && queueStatus?.status ? (
        <Link href={`/publisher?file=${encodeURIComponent(fileName)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open in Publisher
        </Link>
      ) : null}
      <Button size="sm" variant="outline" className="text-rose-300 hover:text-rose-200" onClick={() => void deleteAsset()} disabled={busyKey === "delete"}>
        <Trash2 className="mr-1.5 h-4 w-4" /> Delete
      </Button>
    </>
  );

  return (
    <>
      {variant === "row" ? (
        <div className={`border-b border-border/60 px-3 text-sm last:border-b-0 ${density === "compact" ? "py-2" : "py-3"}`}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex items-center justify-center pt-1">{leadingSlot}</div>
              <button type="button" onClick={() => setDrawerOpen(true)} className="overflow-hidden rounded-md border border-border bg-muted text-left">
                <div className="aspect-video w-[88px]">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">No preview</div>
                  )}
                </div>
              </button>
              <div className="min-w-0 space-y-1.5">
                <p className="truncate text-sm font-medium text-foreground">{title}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{file}</p>
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-0.5">{currentStage}</span>
                  <span className="rounded-md bg-muted px-2 py-0.5">{projectType}</span>
                  <span className="rounded-md bg-muted px-2 py-0.5">{projectName}</span>
                  {queueStatus?.status ? <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">{queueStatus.status}</span> : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 xl:max-w-[55%] xl:justify-end">
              {actions}
            </div>
          </div>
        </div>
      ) : (
        <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <button type="button" onClick={() => setDrawerOpen(true)} className="block w-full text-left">
            <div className="relative aspect-video overflow-hidden border-b border-border bg-muted">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No preview</div>
              )}
            </div>
          </button>
          <div className="space-y-3 p-3">
            <div>
              <p className="truncate text-sm font-medium text-foreground">{title}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{file}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-0.5">{projectType}</span>
              <span className="rounded-md bg-muted px-2 py-0.5">{projectName}</span>
              <span className="rounded-md bg-muted px-2 py-0.5">{currentStage}</span>
              {queueStatus?.status ? <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">{queueStatus.status}</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {actions}
            </div>
          </div>
        </article>
      )}

      <ProjectDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projectType={projectType}
        file={file}
        titleHint={title}
        previewUrl={previewUrl}
        onEnqueue={projectType === "video" ? enqueueCurrentAsset : undefined}
      />
    </>
  );
}
