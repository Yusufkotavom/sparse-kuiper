"use client";

import Link from "next/link";
import { CalendarClock, CheckCircle2, Send, UserRound, Video } from "lucide-react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NewV2PublisherPage() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-1 pb-8">
      <PageHeader
        title="NewV2 · Publisher Ops"
        description="Wizard skeleton untuk publish flow: fokus keputusan inti, detail lanjutan belakangan."
        badge="Publisher v2"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/queue-builder" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Open Legacy Queue Builder</Link>
            <Link href="/newv2/monitoring" className={cn(buttonVariants({ size: "sm" }))}>Open Monitoring</Link>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { title: "Select Assets", icon: Video, hint: "Required" },
          { title: "Platforms & Accounts", icon: UserRound, hint: "Required" },
          { title: "Schedule", icon: CalendarClock, hint: "Optional" },
          { title: "Review & Create", icon: Send, hint: "Required" },
        ].map((step, index) => {
          const Icon = step.icon;
          return (
            <Card key={step.title} className="border-border bg-surface/70">
              <CardHeader className="pb-2">
                <CardDescription>Step {index + 1}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" /> {step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Field label: <span className="font-medium text-foreground">{step.hint}</span></p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Advanced</CardTitle>
          <CardDescription>Tampilkan setelah user menyelesaikan field Required.</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Contoh: schedule per platform, retry policy, dan metadata override detail.
          <p className="mt-3 flex items-center gap-2 text-foreground"><CheckCircle2 className="h-4 w-4" /> Target UX: 1 CTA utama per panel.</p>
        </CardContent>
      </Card>
    </section>
  );
}
