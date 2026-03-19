"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  FileText,
  FolderOpen,
  Layers3,
  PlayCircle,
  RefreshCw,
  Wand2,
} from "lucide-react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { KpiCard } from "@/components/atoms/KpiCard";
import { SegmentedTabs } from "@/components/atoms/SegmentedTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase";
import { kdpApi, videoApi } from "@/lib/api";

type CurationMode = "video" | "image";

type BranchCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

function CurationHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryMode = searchParams.get("mode");
  const [mode, setMode] = useState<CurationMode>(queryMode === "image" ? "image" : "video");
  const [videoProjects, setVideoProjects] = useState<string[]>([]);
  const [imageProjects, setImageProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (queryMode === "video" || queryMode === "image") {
      setMode(queryMode);
    }
  }, [queryMode]);

  useEffect(() => {
    const projectFromQuery = searchParams.get("project");
    if (projectFromQuery) {
      setSelectedProject(projectFromQuery);
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
        if (!selectedProject) {
          const defaultProject = queryMode === "image" ? imageList[0] : videoList[0];
          if (defaultProject) setSelectedProject(defaultProject);
        }
      } finally {
        setLoading(false);
      }
    };

    ensureAuthAndLoad();
  }, [queryMode, router, selectedProject]);

  const currentProjects = mode === "video" ? videoProjects : imageProjects;
  const modeLabel = mode === "video" ? "Video" : "Image";
  const curationWorkspaceHref =
    mode === "video"
      ? selectedProject
        ? `/video/curation?project=${encodeURIComponent(selectedProject)}`
        : "/video/curation"
      : selectedProject
        ? `/kdp/curation?project=${encodeURIComponent(selectedProject)}`
        : "/kdp/curation";
  const promptBuilderHref = mode === "video" ? "/video/ideation" : "/kdp/ideation";
  const projectManagerHref = selectedProject ? `/project-manager/${encodeURIComponent(selectedProject)}` : "/project-manager";
  const runsHref = selectedProject ? `/runs?project=${encodeURIComponent(selectedProject)}` : "/runs";

  const branches = useMemo<BranchCard[]>(() => {
    if (mode === "video") {
      return [
        {
          title: "Review Workspace",
          description: "Masuk ke layar curation video untuk review raw/final dan monitor generate baru.",
          href: curationWorkspaceHref,
          icon: Eye,
          accent: "border-primary/30 bg-primary/10 text-primary",
        },
        {
          title: "Prompt Builder",
          description: "Balik ke prompt builder bila brief atau prompt batch masih perlu diperbaiki.",
          href: promptBuilderHref,
          icon: Wand2,
          accent: "border-sky-500/30 bg-sky-500/10 text-sky-200",
        },
        {
          title: "Project Assets",
          description: "Buka project manager untuk upload manual, metadata, queue, dan asset review cepat.",
          href: projectManagerHref,
          icon: FolderOpen,
          accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        },
        {
          title: "Runs",
          description: "Lanjutkan monitoring proses operasional dan publish setelah review selesai.",
          href: runsHref,
          icon: PlayCircle,
          accent: "border-amber-500/30 bg-amber-500/10 text-amber-200",
        },
      ];
    }

    return [
      {
        title: "Review Workspace",
        description: "Masuk ke layar curation image untuk pilih raw/final dan lanjut ke PDF atau output lain.",
        href: curationWorkspaceHref,
        icon: Eye,
        accent: "border-primary/30 bg-primary/10 text-primary",
      },
      {
        title: "Prompt Builder",
        description: "Balik ke prompt builder image bila masih perlu revisi niche atau prompt batch.",
        href: promptBuilderHref,
        icon: Wand2,
        accent: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
      },
      {
        title: "Project Assets",
        description: "Masuk ke project manager untuk review asset, metadata, dan struktur project.",
        href: projectManagerHref,
        icon: FolderOpen,
        accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      },
      {
        title: "Pipeline Routes",
        description: "Gunakan template atau route lain setelah curation untuk lanjut ke generator berikutnya.",
        href: "/pipeline-templates",
        icon: Layers3,
        accent: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      },
    ];
  }, [curationWorkspaceHref, mode, projectManagerHref, promptBuilderHref, runsHref]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 pb-6 sm:gap-6">
      <PageHeader
        title="Curation Hub"
        description="Satu pintu review untuk video dan image sebelum lanjut ke asset management, queue, runs, atau cabang generator berikutnya."
        badge={`${modeLabel} Review`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Video Projects" value={videoProjects.length} size="sm" />
        <KpiCard label="Image Projects" value={imageProjects.length} size="sm" />
        <KpiCard label="Review Mode" value={modeLabel} size="sm" />
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader className="space-y-3">
          <div className="space-y-2">
            <CardTitle className="text-base sm:text-lg">Main Review Bridge</CardTitle>
            <CardDescription>
              Setelah ideation, user masuk ke pola review yang sama dulu sebelum masuk operasi atau generator lain.
            </CardDescription>
          </div>
          <SegmentedTabs
            className="w-full sm:w-fit"
            value={mode}
            onChange={(value) => setMode(value as CurationMode)}
            items={[
              { value: "video", label: "Video Review" },
              { value: "image", label: "Image Review" },
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">Choose Project</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pilih project aktif dulu supaya semua shortcut berikutnya langsung relevan.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {loading ? (
                <span className="text-xs text-muted-foreground">Loading projects...</span>
              ) : currentProjects.length > 0 ? (
                currentProjects.slice(0, 12).map((project) => (
                  <button
                    key={project}
                    type="button"
                    onClick={() => setSelectedProject(project)}
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
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Review Branches</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Project aktif: <span className="font-medium text-foreground">{selectedProject || "Belum dipilih"}</span>
                </p>
              </div>
              <Link
                href={curationWorkspaceHref}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Open Workspace
              </Link>
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
            <Link href={projectManagerHref} className="rounded-xl border border-border bg-background/70 p-4 hover:bg-background">
              <div className="inline-flex rounded-lg border border-border px-2 py-2 text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">Project Manager</p>
              <p className="mt-1 text-xs text-muted-foreground">Asset review cepat, metadata, queue, dan upload manual.</p>
            </Link>
            <Link href="/queue-builder" className="rounded-xl border border-border bg-background/70 p-4 hover:bg-background">
              <div className="inline-flex rounded-lg border border-border px-2 py-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">Queue Builder</p>
              <p className="mt-1 text-xs text-muted-foreground">Lanjut ke distribusi setelah review asset dan job config siap.</p>
            </Link>
            <Link href={runsHref} className="rounded-xl border border-border bg-background/70 p-4 hover:bg-background">
              <div className="inline-flex rounded-lg border border-border px-2 py-2 text-muted-foreground">
                <PlayCircle className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">Runs</p>
              <p className="mt-1 text-xs text-muted-foreground">Pantau proses aktif, scheduled, retry, dan riwayat hasil.</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CurationHubPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-1 py-6 text-sm text-muted-foreground">Loading curation hub...</div>}>
      <CurationHubContent />
    </Suspense>
  );
}
