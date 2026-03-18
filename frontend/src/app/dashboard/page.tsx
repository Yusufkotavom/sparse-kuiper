"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { videoApi, kdpApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, FolderOpen, Video, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DashboardProject = {
  name: string;
  type: "video" | "kdp";
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const ensureAuthAndLoad = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }

      setLoading(true);
      try {
        const [videoProjects, kdpProjects] = await Promise.all([
          videoApi.listProjects().catch(() => []),
          kdpApi.listProjects().catch(() => []),
        ]);
        const combined: DashboardProject[] = [
          ...videoProjects.map((name: string) => ({ name, type: "video" as const })),
          ...kdpProjects.map((name: string) => ({ name, type: "kdp" as const })),
        ];
        setProjects(combined);
      } finally {
        setLoading(false);
      }
    };

    ensureAuthAndLoad();
  }, [router]);

  const recent = projects.slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recent Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan cepat proyek Video dan Image Creation yang tersedia di workspace.
          </p>
        </div>
        <Link
          href="/project-manager"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open full Project Manager →
        </Link>
      </section>

      {loading && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-border bg-surface/60">
              <CardHeader className="pb-3 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {!loading && recent.length === 0 && (
        <section className="flex flex-col gap-6 rounded-xl border border-border bg-surface/60 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-lg bg-muted/70 p-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Belum ada project di workspace ini</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Ikuti alur singkat di bawah untuk membuat project pertama dan meneruskannya ke Publisher.
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-xs md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background/80 p-3">
              <p className="font-semibold text-foreground">1. Buat project</p>
              <p className="mt-1 text-muted-foreground">
                Mulai dari Creator Studio untuk video, atau Ideation untuk Image Creation.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href="/video/creator-studio"
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  New Video Project
                </Link>
                <Link
                  href="/kdp/ideation"
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  New Image Project
                </Link>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/80 p-3">
              <p className="font-semibold text-foreground">2. Kurasi assets</p>
              <p className="mt-1 text-muted-foreground">
                Gunakan Project Manager untuk memilih raw/final, generate metadata, dan siapkan queue.
              </p>
              <div className="mt-2">
                <Link
                  href="/project-manager"
                  className="inline-flex items-center rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  Buka Project Manager
                </Link>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/80 p-3">
              <p className="font-semibold text-foreground">3. Atur Runs</p>
              <p className="mt-1 text-muted-foreground">
                Dari Runs, atur status proses dan lanjutkan ke Publisher untuk jadwal/upload.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href="/runs"
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  Buka Runs
                </Link>
                <Link
                  href="/publisher"
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  Buka Publisher
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {!loading && recent.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((proj) => (
            <Link key={`${proj.type}-${proj.name}`} href={`/project-manager/${proj.name}`}>
              <Card className="h-full border-border bg-surface/60 hover:bg-surface hover:border-border-hover transition-colors">
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      {proj.type === "video" ? (
                        <Video className="h-4 w-4 text-primary" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-amber-500" />
                      )}
                    </span>
                    <CardTitle className="truncate text-base">{proj.name}</CardTitle>
                  </div>
                    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {proj.type === "video" ? "Video" : "Image Creation"}
                    </span>
                </CardHeader>
                <CardContent className="space-y-2">
                  <CardDescription className="text-xs">
                    {proj.type === "video"
                      ? "Video automation project (Grok Studio, muxing, publishing)."
                      : "Image creation prompt & pipeline untuk coloring books atau interior assets."}
                  </CardDescription>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Recently indexed
                    </span>
                    <span className="underline-offset-2 group-hover:underline">
                      Open overview
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
