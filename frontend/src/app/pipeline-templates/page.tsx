"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/atoms/PageHeader";
import { SegmentedTabs } from "@/components/atoms/SegmentedTabs";
import { KpiCard } from "@/components/atoms/KpiCard";
import { Button } from "@/components/ui/button";
import { Copy, Sparkles } from "lucide-react";

type Channel = "all" | "video" | "kdp";

type PipelineTemplate = {
  id: string;
  name: string;
  channel: Exclude<Channel, "all">;
  description: string;
  stages: ["Ideation", "Curation", "Production"];
  recommendedRoute: string;
};

const templates: PipelineTemplate[] = [
  {
    id: "video-short-form",
    name: "Video Shorts Engine",
    channel: "video",
    description: "Template cepat untuk ide konten, scoring ide, lalu eksekusi produksi short-form.",
    stages: ["Ideation", "Curation", "Production"],
    recommendedRoute: "/video/ideation",
  },
  {
    id: "video-evergreen",
    name: "Video Evergreen Batch",
    channel: "video",
    description: "Template batch mingguan untuk konten evergreen dengan jalur review ringan.",
    stages: ["Ideation", "Curation", "Production"],
    recommendedRoute: "/video/curation",
  },
  {
    id: "kdp-coloring-book",
    name: "Image Creation Coloring Book",
    channel: "kdp",
    description: "Template untuk generate niche, validasi konsep, lalu siap produksi prompt & assets.",
    stages: ["Ideation", "Curation", "Production"],
    recommendedRoute: "/kdp/ideation",
  },
  {
    id: "kdp-interior-pack",
    name: "Image Creation Interior Pack",
    channel: "kdp",
    description: "Template untuk produksi interior pages dengan ritme ideation-to-production yang konsisten.",
    stages: ["Ideation", "Curation", "Production"],
    recommendedRoute: "/kdp/curation",
  },
];

export default function PipelineTemplatesPage() {
  const [channel, setChannel] = useState<Channel>("all");
  const [cloned, setCloned] = useState<string | null>(null);
  const router = useRouter();

  const visibleTemplates = useMemo(() => {
    if (channel === "all") return templates;
    return templates.filter((template) => template.channel === channel);
  }, [channel]);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Pipeline Templates"
        description="Kerangka lintas channel agar user tidak perlu belajar ulang alur Video vs Image Creation."
        badge="Phase 5"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Total Template" value={templates.length} size="sm" />
        <KpiCard label="Video" value={templates.filter((item) => item.channel === "video").length} size="sm" />
        <KpiCard label="Image Creation" value={templates.filter((item) => item.channel === "kdp").length} size="sm" />
        <KpiCard label="Model Stage" value="Ideation → Curation → Production" size="sm" />
      </div>

      <SegmentedTabs<Channel>
        items={[
          { value: "all", label: "All" },
          { value: "video", label: "Video" },
          { value: "kdp", label: "Image Creation" },
        ]}
        value={channel}
        onChange={setChannel}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {visibleTemplates.map((template) => (
          <article key={template.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{template.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
              </div>
              <span className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{template.channel === "kdp" ? "image creation" : template.channel}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {template.stages.map((stage) => (
                <span key={stage} className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
                  {stage}
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => router.push(template.recommendedRoute)}>
                <Sparkles className="mr-1 h-4 w-4" /> Gunakan Template
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCloned(template.id);
                  setTimeout(() => setCloned((current) => (current === template.id ? null : current)), 1600);
                }}
              >
                <Copy className="mr-1 h-4 w-4" />
                {cloned === template.id ? "Template Dicloning" : "Clone Template"}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
