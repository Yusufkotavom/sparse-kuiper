"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { videoApi, kdpApi } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import { PageHeader } from "@/components/atoms/PageHeader";
import { KpiCard } from "@/components/atoms/KpiCard";
import { SegmentedTabs } from "@/components/atoms/SegmentedTabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/atoms/EmptyState";
import { FolderOpen, ImageIcon, Search, Video } from "lucide-react";

type ProjectItem = { name: string; type: "video" | "kdp" };
type FilterType = "all" | "video" | "kdp";

export default function ProjectManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

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
        const [videoProjects, imageProjects] = await Promise.all([
          videoApi.listProjects().catch(() => []),
          kdpApi.listProjects().catch(() => []),
        ]);
        setProjects([
          ...videoProjects.map((name) => ({ name, type: "video" as const })),
          ...imageProjects.map((name) => ({ name, type: "kdp" as const })),
        ]);
      } finally {
        setLoading(false);
      }
    };

    void ensureAuthAndLoad();
  }, [router]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((project) => {
      const typeOk = filterType === "all" || project.type === filterType;
      const queryOk = !q || project.name.toLowerCase().includes(q);
      return typeOk && queryOk;
    });
  }, [projects, query, filterType]);

  return (
    <section className="mx-auto max-w-7xl space-y-4 px-1 pb-4">
      <PageHeader
        title="Project Manager"
        description="Landing terpusat untuk pilih project. Halaman ini hanya untuk discovery, sedangkan detail asset ada di halaman project individual."
        badge={`${projects.length} projects`}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Total Projects" value={projects.length} size="sm" />
        <KpiCard label="Video Projects" value={projects.filter((item) => item.type === "video").length} size="sm" />
        <KpiCard label="Image Creation Projects" value={projects.filter((item) => item.type === "kdp").length} size="sm" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/40 p-3 md:flex-row md:items-center md:justify-between">
        <SegmentedTabs<FilterType>
          value={filterType}
          onChange={setFilterType}
          size="xs"
          items={[
            { value: "all", label: "All" },
            { value: "video", label: "Video" },
            { value: "kdp", label: "Image Creation" },
          ]}
        />
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari project..." className="pl-8" />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-surface/40 p-4 text-sm text-muted-foreground">Loading projects...</div>
      ) : null}

      {!loading && filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Project tidak ditemukan"
          description="Coba ubah filter atau kata kunci pencarian."
          action={{ label: "Reset Filter", onClick: () => { setFilterType("all"); setQuery(""); } }}
        />
      ) : null}

      {!loading && filteredProjects.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <article key={`${project.type}-${project.name}`} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    {project.type === "video" ? <Video className="h-4 w-4 text-primary" /> : <ImageIcon className="h-4 w-4 text-amber-500" />}
                  </span>
                  <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
                </div>
                <span className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  {project.type === "video" ? "Video" : "Image Creation"}
                </span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {project.type === "video" ? "Workflow video automation, curation, metadata, dan publish prep." : "Workflow image creation, curation, dan persiapan publish asset."}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => router.push(`/project-manager/${project.name}`)}>Open Project</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    router.push(
                      project.type === "video"
                        ? `/video/curation?project=${encodeURIComponent(project.name)}`
                        : `/kdp/curation?project=${encodeURIComponent(project.name)}`
                    )
                  }
                >
                  Open Curation
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
