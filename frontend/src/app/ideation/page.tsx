"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Clapperboard,
  FolderOpen,
  Image as ImageIcon,
  Layers3,
  PlayCircle,
  Wand2,
} from "lucide-react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { KpiCard } from "@/components/atoms/KpiCard";
import { SegmentedTabs } from "@/components/atoms/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/lib/supabase";
import { kdpApi, videoApi } from "@/lib/api";
import { toast } from "sonner";

type IdeationMode = "video" | "image";

type BranchCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

function IdeationHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryMode = searchParams.get("mode");
  const [mode, setMode] = useState<IdeationMode>(queryMode === "image" ? "image" : "video");
  const [videoProjects, setVideoProjects] = useState<string[]>([]);
  const [imageProjects, setImageProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (queryMode === "video" || queryMode === "image") {
      setMode(queryMode);
    }
  }, [queryMode]);

  useEffect(() => {
    const projectFromQuery = searchParams.get("project");
    if (projectFromQuery) {
      setSelectedProject(projectFromQuery);
      setProjectDraft(projectFromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    const ensureAuthAndLoad = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }

      setLoading(true);
      try {
        const [videoList, imageList] = await Promise.all([
          videoApi.listProjects().catch(() => []),
          kdpApi.listProjects().catch(() => []),
        ]);
        setVideoProjects(videoList);
        setImageProjects(imageList);
      } finally {
        setLoading(false);
      }
    };

    ensureAuthAndLoad();
  }, [router]);

  const currentProjects = mode === "video" ? videoProjects : imageProjects;
  const modeLabel = mode === "video" ? "Video" : "Image";
  const projectTargetHref = selectedProject ? `/project-manager/${encodeURIComponent(selectedProject)}` : "/project-manager";
  const runsHref = selectedProject ? `/runs?project=${encodeURIComponent(selectedProject)}` : "/runs";
  const curationHref = selectedProject ? `/curation?mode=${mode}&project=${encodeURIComponent(selectedProject)}` : `/curation?mode=${mode}`;

  const promptBuilderHref = mode === "video" ? "/video/ideation" : "/kdp/ideation";
  const generatorHref = mode === "video" ? "/video/creator-studio" : "/pipeline-templates";

  const branches = useMemo<BranchCard[]>(() => {
    if (mode === "video") {
      return [
        {
          title: "Prompt Builder",
          description: "Generate brief dan prompt batch untuk video sebelum lanjut produksi.",
          href: promptBuilderHref,
          icon: Wand2,
          accent: "border-sky-500/30 bg-sky-500/10 text-sky-200",
        },
        {
          title: "Creator Studio",
          description: "Masuk ke generator video utama dan lanjutkan produksi asset.",
          href: generatorHref,
          icon: Clapperboard,
          accent: "border-primary/30 bg-primary/10 text-primary",
        },
        {
          title: "Project Assets",
          description: "Buka project manager untuk review raw, final, queue, dan upload manual.",
          href: projectTargetHref,
          icon: FolderOpen,
          accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        },
        {
          title: "Runs",
          description: "Pantau job aktif, scheduled, dan history publish dari satu tempat.",
          href: runsHref,
          icon: PlayCircle,
          accent: "border-amber-500/30 bg-amber-500/10 text-amber-200",
        },
      ];
    }

    return [
      {
        title: "Prompt Builder",
        description: "Siapkan brief dan prompt image yang nanti bisa dipakai banyak generator.",
        href: promptBuilderHref,
        icon: Wand2,
        accent: "border-primary/30 bg-primary/10 text-primary",
      },
      {
        title: "Generator Routes",
        description: "Gunakan pipeline templates sebagai percabangan ke generator image berikutnya.",
        href: generatorHref,
        icon: Layers3,
        accent: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
      },
      {
        title: "Project Assets",
        description: "Masuk ke project manager untuk cek raw, final, archive, dan metadata.",
        href: projectTargetHref,
        icon: FolderOpen,
        accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      },
      {
        title: "Curation Hub",
        description: "Lanjutkan ke pola review bersama sebelum masuk operasi harian atau generator berikutnya.",
        href: curationHref,
        icon: ImageIcon,
        accent: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      },
    ];
  }, [curationHref, generatorHref, mode, projectTargetHref, promptBuilderHref, runsHref]);

  const createProject = async () => {
    const projectName = projectDraft.trim();
    if (!projectName) return;
    setCreating(true);
    try {
      if (mode === "video") {
        await videoApi.createProject(projectName);
        const next = await videoApi.listProjects().catch(() => []);
        setVideoProjects(next);
      } else {
        await kdpApi.createProject(projectName);
        const next = await kdpApi.listProjects().catch(() => []);
        setImageProjects(next);
      }
      setSelectedProject(projectName);
      toast.success(`Project ${projectName} siap dipakai.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 pb-6 sm:gap-6">
      <PageHeader
        title="Ideation Hub"
        description="Satu pintu untuk mulai brief, pilih project, lalu bercabang ke prompt builder, generator, assets, dan operasi berikutnya."
        badge={`${modeLabel} Flow`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Video Projects" value={videoProjects.length} size="sm" />
        <KpiCard label="Image Projects" value={imageProjects.length} size="sm" />
        <KpiCard label="Bridge Mode" value={modeLabel} size="sm" />
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader className="space-y-3">
          <div className="space-y-2">
            <CardTitle className="text-base sm:text-lg">Main Bridge</CardTitle>
            <CardDescription>
              Video dan image sekarang masuk dari pola yang sama: pilih mode, pilih project, lalu teruskan ke cabang kerja yang paling cocok.
            </CardDescription>
          </div>
          <SegmentedTabs
            className="w-full sm:w-fit"
            value={mode}
            onChange={(value) => setMode(value as IdeationMode)}
            items={[
              { value: "video", label: "Video Flow" },
              { value: "image", label: "Image Flow" },
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">Quick Project Setup</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mobile-first: cukup pilih project yang ada atau buat project baru, lalu lanjut ke cabang berikutnya.
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={projectDraft}
                onChange={(event) => setProjectDraft(event.target.value)}
                placeholder={`Create new ${modeLabel.toLowerCase()} project`}
                className="bg-background"
              />
              <Button onClick={() => void createProject()} disabled={creating || !projectDraft.trim()} className="sm:min-w-40">
                {creating ? "Creating..." : "Create Project"}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {loading ? (
                <span className="text-xs text-muted-foreground">Loading projects...</span>
              ) : currentProjects.length > 0 ? (
                currentProjects.slice(0, 10).map((project) => (
                  <button
                    key={project}
                    type="button"
                    onClick={() => {
                      setSelectedProject(project);
                      setProjectDraft(project);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      selectedProject === project
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {project}
                  </button>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Belum ada project untuk mode ini.</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">Current Context</p>
              <p className="text-xs text-muted-foreground">
                Project aktif: <span className="font-medium text-foreground">{selectedProject || "Belum dipilih"}</span>
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {branches.map((branch) => {
                const Icon = branch.icon;
                return (
                  <Link
                    key={branch.title}
                    href={branch.href}
                    className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-card/90"
                  >
                    <div className={`inline-flex rounded-lg border px-2 py-2 ${branch.accent}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{branch.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{branch.description}</p>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link href={curationHref} className="rounded-xl border border-border bg-background/70 p-4 hover:bg-background">
              <div className="inline-flex rounded-lg border border-border px-2 py-2 text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">Curation Hub</p>
              <p className="mt-1 text-xs text-muted-foreground">Masuk ke pola review utama yang sama untuk video dan image.</p>
            </Link>
            <Link href={projectTargetHref} className="rounded-xl border border-border bg-background/70 p-4 hover:bg-background">
              <div className="inline-flex rounded-lg border border-border px-2 py-2 text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">Open Assets</p>
              <p className="mt-1 text-xs text-muted-foreground">Masuk ke project manager untuk raw, final, archive, dan upload manual.</p>
            </Link>
            <Link href={runsHref} className="rounded-xl border border-border bg-background/70 p-4 hover:bg-background">
              <div className="inline-flex rounded-lg border border-border px-2 py-2 text-muted-foreground">
                <BookOpen className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">Runs</p>
              <p className="mt-1 text-xs text-muted-foreground">Pantau semua proses aktif, scheduled, retry, dan history hasil.</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function IdeationHubPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-1 py-6 text-sm text-muted-foreground">Loading ideation hub...</div>}>
      <IdeationHubContent />
    </Suspense>
  );
}
