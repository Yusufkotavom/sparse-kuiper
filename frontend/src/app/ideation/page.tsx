"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Clapperboard,
  FolderOpen,
  Image as ImageIcon,
  Layers3,
  PlayCircle,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { FlowHubShell, type FlowHubBranch } from "@/components/organisms/FlowHubShell";
import { getSupabaseClient } from "@/lib/supabase";
import { kdpApi, videoApi } from "@/lib/api";

type IdeationMode = "video" | "image";

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
    if (queryMode === "video" || queryMode === "image") setMode(queryMode);
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

  const branches = useMemo<FlowHubBranch[]>(() => {
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
        setVideoProjects(await videoApi.listProjects().catch(() => []));
      } else {
        await kdpApi.createProject(projectName);
        setImageProjects(await kdpApi.listProjects().catch(() => []));
      }
      setSelectedProject(projectName);
      setProjectDraft(projectName);
      toast.success(`Project ${projectName} siap dipakai.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <FlowHubShell
      title="Ideation Hub"
      description="Satu pintu untuk mulai brief, pilih project, lalu bercabang ke prompt builder, generator, assets, dan operasi berikutnya."
      badge={`${modeLabel} Flow`}
      mode={mode}
      modeItems={[
        { value: "video", label: "Video Flow" },
        { value: "image", label: "Image Flow" },
      ]}
      onModeChange={setMode}
      videoProjectsCount={videoProjects.length}
      imageProjectsCount={imageProjects.length}
      modeMetricLabel="Bridge Mode"
      modeMetricValue={modeLabel}
      introTitle="Main Bridge"
      introDescription="Video dan image sekarang masuk dari pola yang sama: pilih mode, pilih project, lalu teruskan ke cabang kerja yang paling cocok."
      projectSectionTitle="Quick Project Setup"
      projectSectionDescription="Mobile-first: cukup pilih project yang ada atau buat project baru, lalu lanjut ke cabang berikutnya."
      selectedProject={selectedProject}
      currentProjects={currentProjects}
      loading={loading}
      projectDraft={projectDraft}
      onProjectDraftChange={(value) => {
        setProjectDraft(value);
        if (currentProjects.includes(value)) setSelectedProject(value);
      }}
      createButtonLabel="Create Project"
      onCreateProject={createProject}
      creating={creating}
      createDisabled={!projectDraft.trim()}
      projectDraftPlaceholder={`Create new ${modeLabel.toLowerCase()} project`}
      projectsEmptyText="Belum ada project untuk mode ini."
      currentContextTitle="Current Context"
      currentContextDescription={
        <>Project aktif: <span className="font-medium text-foreground">{selectedProject || "Belum dipilih"}</span></>
      }
      branches={branches}
      footerLinks={[
        {
          title: "Curation Hub",
          description: "Masuk ke pola review utama yang sama untuk video dan image.",
          href: curationHref,
          icon: ImageIcon,
        },
        {
          title: "Open Assets",
          description: "Masuk ke project manager untuk raw, final, archive, dan upload manual.",
          href: projectTargetHref,
          icon: FolderOpen,
        },
        {
          title: "Runs",
          description: "Pantau semua proses aktif, scheduled, retry, dan history hasil.",
          href: runsHref,
          icon: BookOpen,
        },
      ]}
    />
  );
}

export default function IdeationHubPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-1 py-6 text-sm text-muted-foreground">Loading ideation hub...</div>}>
      <IdeationHubContent />
    </Suspense>
  );
}
