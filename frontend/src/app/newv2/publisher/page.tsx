"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Send, UserRound, Video } from "lucide-react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { accountsApi, queueBuilderApi, videoApi, type Account } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlowStepWizard, type FlowStepItem } from "@/components/organisms/FlowStepWizard";
import { getNewV2CopyVariant, trackNewV2CopyExposure, trackNewV2PublisherAction } from "@/lib/newv2Telemetry";

const PLATFORM_OPTIONS = ["youtube", "tiktok", "instagram", "facebook"] as const;
type PlatformOption = typeof PLATFORM_OPTIONS[number];
const PUBLISHER_STEPS: FlowStepItem[] = [
  { id: "select-assets", title: "Select Assets", description: "Pick or add asset into queue", icon: Video, hint: "Required", required: true, completed: true },
  { id: "platforms", title: "Platforms & Accounts", description: "Select target platform list", icon: UserRound, hint: "Required", required: true },
  { id: "schedule", title: "Schedule", description: "Set run time for publish job", icon: CalendarClock, hint: "Optional" },
  { id: "review", title: "Review & Create", description: "Save metadata + queue job config", icon: Send, hint: "Required", required: true },
];

export default function NewV2PublisherPage() {
  const [projectType, setProjectType] = useState<"video" | "kdp">("video");
  const [relativePath, setRelativePath] = useState("");
  const [videoProjects, setVideoProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedStage, setSelectedStage] = useState<"raw" | "final">("final");
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [assetFilename, setAssetFilename] = useState("");
  const [queueAssets, setQueueAssets] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<PlatformOption[]>(["youtube"]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountMapDraft, setAccountMapDraft] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingProjectFiles, setIsLoadingProjectFiles] = useState(false);
  const [copyVariant, setCopyVariant] = useState<"short" | "long">("short");

  const canSubmit = useMemo(() => Boolean(assetFilename.trim()) && platforms.length > 0, [assetFilename, platforms.length]);
  const canAddToQueue = useMemo(() => Boolean(relativePath.trim()), [relativePath]);

  const loadQueueAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    setError(null);
    try {
      const result = await queueBuilderApi.getQueue();
      const filenames = (result.queue || []).map((item) => item.filename).filter(Boolean);
      setQueueAssets(filenames);
      setAssetFilename((prev) => prev || filenames[0] || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat queue assets.");
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    void loadQueueAssets();
  }, [loadQueueAssets]);

  const loadVideoProjects = useCallback(async () => {
    try {
      const projects = await videoApi.listProjects();
      setVideoProjects(projects);
      setSelectedProject((prev) => prev || projects[0] || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat project video.");
    }
  }, []);

  const loadAccounts = async () => {
    try {
      const result = await accountsApi.getAccounts();
      setAccounts(result.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat accounts.");
    }
  };

  const loadProjectFiles = useCallback(async (projectName: string, stage: "raw" | "final") => {
    if (!projectName) return;
    setIsLoadingProjectFiles(true);
    try {
      const result = await videoApi.listProjectVideos(projectName);
      const files = stage === "final" ? result.final || [] : result.raw || [];
      setProjectFiles(files);
      if (files.length > 0) {
        setSelectedFile(files[0]);
      } else {
        setSelectedFile("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat file project.");
    } finally {
      setIsLoadingProjectFiles(false);
    }
  }, []);

  useEffect(() => {
    void loadVideoProjects();
    void loadAccounts();
    const variant = getNewV2CopyVariant();
    setCopyVariant(variant);
    trackNewV2CopyExposure(variant, "publisher");
  }, [loadVideoProjects]);

  useEffect(() => {
    if (projectType === "video" && selectedProject) {
      void loadProjectFiles(selectedProject, selectedStage);
    }
  }, [projectType, selectedProject, selectedStage, loadProjectFiles]);

  const togglePlatform = (platform: PlatformOption, checked: boolean) => {
    setPlatforms((prev) => {
      if (checked) {
        return prev.includes(platform) ? prev : [...prev, platform];
      }
      return prev.filter((value) => value !== platform);
    });
  };

  const handleCreateJob = async () => {
    if (!canSubmit) return;
    trackNewV2PublisherAction();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedSchedule = schedule.trim() ? new Date(schedule) : null;
      if (parsedSchedule && Number.isNaN(parsedSchedule.getTime())) {
        throw new Error("Format schedule tidak valid.");
      }
      const scheduleIso = parsedSchedule ? parsedSchedule.toISOString() : undefined;
      if (title.trim() || description.trim() || tags.trim()) {
        await queueBuilderApi.updateQueueMetadata(assetFilename, {
          title: title.trim(),
          description: description.trim(),
          tags: tags.trim(),
        });
      }

      const accountMap = platforms.reduce<Record<string, string>>((acc, platform) => {
        const selected = accountMapDraft[platform]?.trim();
        if (selected) {
          acc[platform] = selected;
        }
        return acc;
      }, {});

      await queueBuilderApi.updateQueueConfig({
        filename: assetFilename,
        platforms: [...platforms],
        account_map: accountMap,
        schedule: scheduleIso,
      });
      trackNewV2PublisherAction({ completedJob: true, countClick: false, variant: copyVariant });
      setSuccess(`Job untuk "${assetFilename}" berhasil dibuat/diperbarui di queue.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat job publisher.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccountChange = (platform: PlatformOption, value: string) => {
    setAccountMapDraft((prev) => ({ ...prev, [platform]: value }));
  };

  const handleAddToQueue = async () => {
    if (!canAddToQueue) return;
    trackNewV2PublisherAction();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await queueBuilderApi.addToQueue({
        project_type: projectType,
        relative_path: relativePath.trim(),
        title: title.trim(),
        description: description.trim(),
        tags: tags.trim(),
      });
      setAssetFilename(result.filename);
      setSuccess(`Asset "${result.filename}" berhasil ditambahkan ke queue.`);
      setRelativePath("");
      await loadQueueAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah asset ke queue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const useSelectedProjectFile = () => {
    if (!selectedProject || !selectedFile) return;
    setRelativePath(`${selectedProject}/${selectedStage}/${selectedFile}`);
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-1 pb-8">
      <PageHeader
        title="NewV2 · Publisher Ops"
        description={
          copyVariant === "short"
            ? "Add queue item, set platform/account, lalu create job."
            : "Wizard publisher dengan wiring ke queue API untuk konfigurasi metadata, platform, dan schedule."
        }
        badge="Publisher v2"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/queue-builder" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Open Legacy Queue Builder</Link>
            <Link href="/newv2/monitoring" className={cn(buttonVariants({ size: "sm" }))}>Open Monitoring</Link>
          </div>
        }
      />

      <FlowStepWizard steps={PUBLISHER_STEPS} />

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Publisher Job Setup</CardTitle>
          <CardDescription>
            Tambah asset ke queue dulu, lalu simpan konfigurasi job via endpoint `/publisher/queue/*`.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background/70 p-3">
            <p className="text-sm font-medium text-foreground">Step 1 · Add Asset to Queue (Required)</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-type">Project type (Required)</Label>
                <Select value={projectType} onValueChange={(value) => setProjectType(value === "kdp" ? "kdp" : "video")}>
                  <SelectTrigger id="project-type">
                    <SelectValue placeholder="Pilih project type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">video</SelectItem>
                    <SelectItem value="kdp">kdp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="relative-path">Relative path asset (Required)</Label>
                <Input
                  id="relative-path"
                  value={relativePath}
                  onChange={(event) => setRelativePath(event.target.value)}
                  placeholder="contoh: my-project/final/video_001.mp4"
                />
              </div>
            </div>
            {projectType === "video" && (
              <div className="mt-3 rounded-lg border border-border bg-background/70 p-3">
                <p className="text-xs font-medium text-foreground">Quick Pick dari Video Project</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <Input
                    list="video-project-list"
                    value={selectedProject}
                    onChange={(event) => setSelectedProject(event.target.value)}
                    placeholder="Pilih project video"
                  />
                  <datalist id="video-project-list">
                    {videoProjects.map((project) => (
                      <option key={project} value={project} />
                    ))}
                  </datalist>
                  <Select value={selectedStage} onValueChange={(value) => setSelectedStage(value === "raw" ? "raw" : "final")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="final">final</SelectItem>
                      <SelectItem value="raw">raw</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    list="video-file-list"
                    value={selectedFile}
                    onChange={(event) => setSelectedFile(event.target.value)}
                    placeholder={isLoadingProjectFiles ? "Loading files..." : "Pilih file"}
                  />
                  <datalist id="video-file-list">
                    {projectFiles.map((file) => (
                      <option key={file} value={file} />
                    ))}
                  </datalist>
                  <Button type="button" variant="outline" onClick={useSelectedProjectFile} disabled={!selectedProject || !selectedFile}>
                    Use Selected Asset
                  </Button>
                </div>
              </div>
            )}
            <div className="mt-3">
              <Button type="button" variant="outline" onClick={handleAddToQueue} disabled={isSubmitting || !canAddToQueue}>
                Add to Queue
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-filename">Select queued asset (Required)</Label>
              <Input
                id="asset-filename"
                list="queue-assets"
                value={assetFilename}
                onChange={(event) => setAssetFilename(event.target.value)}
                placeholder={isLoadingAssets ? "Loading queue..." : "Pilih filename di queue"}
              />
              <datalist id="queue-assets">
                {queueAssets.map((filename) => (
                  <option key={filename} value={filename} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">{queueAssets.length} asset tersedia di queue.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule UTC (Optional)</Label>
              <Input
                id="schedule"
                type="datetime-local"
                value={schedule}
                onChange={(event) => setSchedule(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Platforms (Required)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLATFORM_OPTIONS.map((platform) => (
                <label key={platform} className="flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2 text-sm">
                  <Checkbox
                    checked={platforms.includes(platform)}
                    onCheckedChange={(checked) => togglePlatform(platform, Boolean(checked))}
                  />
                  <span className="capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Account map per platform (Optional)</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {platforms.map((platform) => {
                const options = accounts.filter((account) => account.platform.toLowerCase() === platform);
                return (
                  <div key={platform} className="space-y-1">
                    <p className="text-xs font-medium capitalize text-foreground">{platform}</p>
                    <Input
                      list={`account-list-${platform}`}
                      value={accountMapDraft[platform] || ""}
                      onChange={(event) => handleAccountChange(platform, event.target.value)}
                      placeholder={options.length > 0 ? "Pilih account id" : "Belum ada account"}
                    />
                    <datalist id={`account-list-${platform}`}>
                      {options.map((account) => (
                        <option key={`${platform}-${account.id || account.name}`} value={account.id || account.name}>
                          {account.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="meta-title">Title (Optional)</Label>
              <Input id="meta-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-description">Description (Optional)</Label>
              <Input id="meta-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-tags">Tags (Optional)</Label>
              <Input id="meta-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tag1,tag2" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleCreateJob} disabled={!canSubmit || isSubmitting}>
              Save Job Config (Step 2)
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadQueueAssets()} disabled={isLoadingAssets}>
              Refresh Queue
            </Button>
            <StatusBadge status={canSubmit ? "active" : "pending"} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-emerald-600">{success}</p>}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Advanced</CardTitle>
          <CardDescription>Tampilkan setelah user menyelesaikan field Required.</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Contoh: schedule per platform, retry policy, dan metadata override detail.
          <p className="mt-3 flex items-center gap-2 text-foreground"><CheckCircle2 className="h-4 w-4" /> Target UX: 1 CTA utama per panel.</p>
        </CardContent>
      </Card>
    </section>
  );
}
