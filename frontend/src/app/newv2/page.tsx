"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Rocket, SplitSquareVertical } from "lucide-react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NEWV2_TASKS, summarizeTasks, statusToBadge } from "@/components/newv2/planData";

export default function NewV2Page() {
  const summary = useMemo(() => summarizeTasks(NEWV2_TASKS), []);

  return (
    <section className="space-y-4">
      <PageHeader
        title="NewV2 Workspace"
        description="Entry point ringkas untuk flow NewV2."
        badge="NewV2"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/queue-builder" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              Open Legacy Queue Builder
            </Link>
            <Link href="/runs" className={cn(buttonVariants({ size: "sm" }))}>
              Open Runs
            </Link>
            <Link href="/newv2/monitoring" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              Open Monitoring
            </Link>
          </div>
        }
      />

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Pilih Flow</CardTitle>
          <CardDescription>Gunakan menu paling relevan untuk action saat ini.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Link href="/newv2/assets" className="block rounded-lg border border-border bg-background/70 p-3 hover:bg-background">
            <div className="flex items-center gap-2 font-medium text-foreground"><SplitSquareVertical className="h-4 w-4" /> Asset Generator</div>
          </Link>
          <Link href="/newv2/publisher" className="block rounded-lg border border-border bg-background/70 p-3 hover:bg-background">
            <div className="flex items-center gap-2 font-medium text-foreground"><Rocket className="h-4 w-4" /> Publisher Ops</div>
          </Link>
        </CardContent>
      </Card>

      <Collapsible defaultOpen={false} className="rounded-xl border border-border bg-surface/70 p-4">
        <CollapsibleTrigger className="text-sm font-medium text-foreground">
          Tampilkan Status Implementasi ({summary.progress}%)
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-2">
          {NEWV2_TASKS.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
              <p className="text-xs text-foreground">{task.title}</p>
              <StatusBadge status={statusToBadge(task.status)} />
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
