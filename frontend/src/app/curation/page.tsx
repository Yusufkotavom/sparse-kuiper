"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  FileText,
  FolderOpen,
  Layers3,
  PlayCircle,
  RefreshCw,
  Wand2,
} from "lucide-react";

import { FlowHubShell, type FlowHubBranch } from "@/components/organisms/FlowHubShell";
import { getSupabaseClient } from "@/lib/supabase";
import { kdpApi, videoApi } from "@/lib/api";

type CurationMode = "video" | "image";

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
    if (queryMode === "video" || queryMode === "image") setMode(queryMode);
  }, [queryMode]);

  useEffect(() => {
    const projectFromQuery = searchParams.get("project");
    if (projectFromQuery) setSelectedProject(projectFromQuery);
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

  const branches = useMemo<FlowHubBranch[]>(() => {
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
    <FlowHubShell
      title="Curation Hub"
      description="Satu pintu review untuk video dan image sebelum lanjut ke asset management, queue, runs, atau cabang generator berikutnya."
      badge={`${modeLabel} Review`}
      mode={mode}
      modeItems={[
        { value: "video", label: "Video Review" },
        { value: "image", label: "Image Review" },
      ]}
      onModeChange={setMode}
      videoProjectsCount={videoProjects.length}
      imageProjectsCount={imageProjects.length}
      modeMetricLabel="Review Mode"
      modeMetricValue={modeLabel}
      introTitle="Main Review Bridge"
      introDescription="Setelah ideation, user masuk ke pola review yang sama dulu sebelum masuk operasi atau generator lain."
      projectSectionTitle="Choose Project"
      projectSectionDescription="Pilih project aktif dulu supaya semua shortcut berikutnya langsung relevan."
      selectedProject={selectedProject}
      currentProjects={currentProjects}
      loading={loading}
      onProjectDraftChange={setSelectedProject}
      projectsEmptyText="Belum ada project untuk mode ini."
      currentContextTitle="Review Branches"
      currentContextDescription={
        <>Project aktif: <span className="font-medium text-foreground">{selectedProject || "Belum dipilih"}</span></>
      }
      rightAction={(
        <Link
          href={curationWorkspaceHref}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Open Workspace
        </Link>
      )}
      branches={branches}
      footerLinks={[
        {
          title: "Project Manager",
          description: "Asset review cepat, metadata, queue, dan upload manual.",
          href: projectManagerHref,
          icon: FolderOpen,
        },
        {
          title: "Queue Builder",
          description: "Lanjut ke distribusi setelah review asset dan job config siap.",
          href: "/queue-builder",
          icon: FileText,
        },
        {
          title: "Runs",
          description: "Pantau proses aktif, scheduled, retry, dan riwayat hasil.",
          href: runsHref,
          icon: PlayCircle,
        },
      ]}
    />
  );
}

export default function CurationHubPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-1 py-6 text-sm text-muted-foreground">Loading curation hub...</div>}>
      <CurationHubContent />
    </Suspense>
  );
}
