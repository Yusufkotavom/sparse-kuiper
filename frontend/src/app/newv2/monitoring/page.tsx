"use client";

import Link from "next/link";
import { useMemo } from "react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { KpiCard } from "@/components/atoms/KpiCard";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NEWV2_TASKS, statusToBadge, summarizeTasks } from "@/components/newv2/planData";

export default function NewV2MonitoringPage() {
  const summary = useMemo(() => summarizeTasks(NEWV2_TASKS), []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-1 pb-8">
      <PageHeader
        title="NewV2 · Monitoring"
        description="Monitoring board untuk checklist implementasi plan V2."
        badge="Plan monitor"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/newv2" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Back to NewV2</Link>
            <Link href="/runs" className={cn(buttonVariants({ size: "sm" }))}>Open Runs</Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Total" value={summary.total} size="sm" />
        <KpiCard label="Done" value={summary.done} size="sm" />
        <KpiCard label="In Progress" value={summary.inProgress} size="sm" />
        <KpiCard label="Blocked" value={summary.blocked} size="sm" />
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Task Board</CardTitle>
          <CardDescription>Status tugas plan: todo / in-progress / blocked / done.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {NEWV2_TASKS.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.id} · {task.priority} · {task.milestone}</p>
              </div>
              <StatusBadge status={statusToBadge(task.status)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
