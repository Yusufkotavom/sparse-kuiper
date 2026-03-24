"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, LayoutGrid, ListChecks, Rocket, SplitSquareVertical } from "lucide-react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { KpiCard } from "@/components/atoms/KpiCard";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { NEWV2_TASKS, summarizeTasks, statusToBadge, type PlanTask } from "@/components/newv2/planData";

export default function NewV2Page() {
  const [tasks, setTasks] = useState<PlanTask[]>(NEWV2_TASKS);

  const summary = useMemo(() => summarizeTasks(tasks), [tasks]);

  const toggleDone = (id: string, checked: boolean) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status: checked ? "done" : "todo" } : task)));
  };

  return (
    <section className="space-y-4">
      <PageHeader
        title="NewV2 Workspace"
        description="Playground UI baru tanpa menghapus flow lama. Fokus: pemisahan Asset Generator vs Publisher Ops + monitoring checklist implementasi."
        badge="Experimental v2"
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

      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Total Task" value={summary.total} size="sm" />
        <KpiCard label="Done" value={summary.done} size="sm" />
        <KpiCard label="In Progress" value={summary.inProgress} size="sm" />
        <KpiCard label="Blocked" value={summary.blocked} size="sm" />
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Implementation Progress</CardTitle>
          <CardDescription>Checklist ini jadi monitoring board harian untuk mengeksekusi plan V2.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{summary.done}/{summary.total} task selesai</span>
            <span>{summary.progress}%</span>
          </div>
          <Progress value={summary.progress} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-surface/70">
          <CardHeader>
            <CardTitle className="text-base">Domain Split Plan</CardTitle>
            <CardDescription>Entry V2 dipisah tegas agar user tidak overload informasi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link href="/newv2/assets" className="block rounded-lg border border-border bg-background/70 p-3 hover:bg-background">
              <div className="flex items-center gap-2 font-medium text-foreground"><SplitSquareVertical className="h-4 w-4" /> Asset Generator</div>
              <p className="mt-1 text-xs text-muted-foreground">V2 asset flow: ideation, generate, curation, finalize.</p>
            </Link>
            <Link href="/newv2/publisher" className="block rounded-lg border border-border bg-background/70 p-3 hover:bg-background">
              <div className="flex items-center gap-2 font-medium text-foreground"><Rocket className="h-4 w-4" /> Publisher Ops</div>
              <p className="mt-1 text-xs text-muted-foreground">V2 publisher wizard: select, configure, schedule, review.</p>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface/70">
          <CardHeader>
            <CardTitle className="text-base">Milestone Checklist</CardTitle>
            <CardDescription>Update status task sebagai board monitoring eksekusi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-border bg-background/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={task.id}
                      checked={task.status === "done"}
                      onCheckedChange={(checked) => toggleDone(task.id, Boolean(checked))}
                      className="mt-0.5"
                    />
                    <div>
                      <label htmlFor={task.id} className="cursor-pointer text-sm font-medium text-foreground">{task.title}</label>
                      <p className="mt-1 text-xs text-muted-foreground">{task.id} · {task.priority} · owner: {task.owner}</p>
                    </div>
                  </div>
                  <StatusBadge status={statusToBadge(task.status)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Daily Monitoring Checklist</CardTitle>
          <CardDescription>Template ringkas untuk daily standup/async update.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/70 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground"><ListChecks className="h-4 w-4" /> Today Focus</p>
            <p className="mt-1 text-xs text-muted-foreground">Pilih 1 task P0/P1 dan tandai in-progress.</p>
          </div>
          <div className="rounded-lg border border-border bg-background/70 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground"><LayoutGrid className="h-4 w-4" /> Blocker Log</p>
            <p className="mt-1 text-xs text-muted-foreground">Catat blocker + next action sebelum end-of-day.</p>
          </div>
          <div className="rounded-lg border border-border bg-background/70 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground"><CheckCircle2 className="h-4 w-4" /> Done Evidence</p>
            <p className="mt-1 text-xs text-muted-foreground">Task done wajib ada evidence command/PR/screenshot.</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
