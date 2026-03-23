"use client";

import Link from "next/link";
import { FolderOpen, Sparkles, Wand2 } from "lucide-react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function NewV2AssetsPage() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-1 pb-8">
      <PageHeader
        title="NewV2 · Asset Generator"
        description="Skeleton flow untuk produksi asset yang lebih ringkas sebelum masuk Publisher Ops."
        badge="Assets v2"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/ideation" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Open Legacy Ideation</Link>
            <Link href="/newv2/publisher" className={cn(buttonVariants({ size: "sm" }))}>Continue to Publisher</Link>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { title: "Ideation", desc: "Brief + prompt direction", icon: Wand2 },
          { title: "Generate", desc: "Produce draft assets", icon: Sparkles },
          { title: "Curation", desc: "Review raw/final quickly", icon: FolderOpen },
          { title: "Finalize", desc: "Mark ready for publish", icon: FolderOpen },
        ].map((step, index) => {
          const Icon = step.icon;
          return (
            <Card key={step.title} className="border-border bg-surface/70">
              <CardHeader className="pb-2">
                <CardDescription>Step {index + 1}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" /> {step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Collapsible defaultOpen={false} className="rounded-xl border border-border bg-surface/70 p-4">
        <CollapsibleTrigger className="text-sm font-medium text-foreground">Advanced Options (Collapsed by default)</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 text-xs text-muted-foreground">
          Opsi lanjutan seperti preset generator, retry tuning, dan audit metadata ditaruh di sini supaya layar utama tetap clean.
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
