"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { KpiCard } from "@/components/atoms/KpiCard";
import { SegmentedTabs } from "@/components/atoms/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type HubMode = "video" | "image";

export type FlowHubBranch = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

type FlowHubShellProps = {
  title: string;
  description: string;
  badge: string;
  mode: HubMode;
  modeItems: Array<{ value: HubMode; label: string }>;
  onModeChange: (value: HubMode) => void;
  videoProjectsCount: number;
  imageProjectsCount: number;
  modeMetricLabel: string;
  modeMetricValue: string;
  introTitle: string;
  introDescription: string;
  projectSectionTitle: string;
  projectSectionDescription: string;
  selectedProject: string;
  currentProjects: string[];
  loading: boolean;
  projectDraft?: string;
  onProjectDraftChange?: (value: string) => void;
  createButtonLabel?: string;
  onCreateProject?: () => void | Promise<void>;
  creating?: boolean;
  createDisabled?: boolean;
  projectDraftPlaceholder?: string;
  projectsEmptyText: string;
  currentContextTitle: string;
  currentContextDescription?: ReactNode;
  branches: FlowHubBranch[];
  rightAction?: ReactNode;
  footerLinks: Array<{
    title: string;
    description: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  footerColumns?: string;
};

export function FlowHubShell({
  title,
  description,
  badge,
  mode,
  modeItems,
  onModeChange,
  videoProjectsCount,
  imageProjectsCount,
  modeMetricLabel,
  modeMetricValue,
  introTitle,
  introDescription,
  projectSectionTitle,
  projectSectionDescription,
  selectedProject,
  currentProjects,
  loading,
  projectDraft,
  onProjectDraftChange,
  createButtonLabel,
  onCreateProject,
  creating = false,
  createDisabled = false,
  projectDraftPlaceholder,
  projectsEmptyText,
  currentContextTitle,
  currentContextDescription,
  branches,
  rightAction,
  footerLinks,
  footerColumns = "sm:grid-cols-3",
}: FlowHubShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 pb-6 sm:gap-6">
      <PageHeader title={title} description={description} badge={badge} />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Video Projects" value={videoProjectsCount} size="sm" />
        <KpiCard label="Image Projects" value={imageProjectsCount} size="sm" />
        <KpiCard label={modeMetricLabel} value={modeMetricValue} size="sm" />
      </div>

      <Card className="border-border bg-surface/70">
        <CardHeader className="space-y-3">
          <div className="space-y-2">
            <CardTitle className="text-base sm:text-lg">{introTitle}</CardTitle>
            <CardDescription>{introDescription}</CardDescription>
          </div>
          <SegmentedTabs className="w-full sm:w-fit" value={mode} onChange={(value) => onModeChange(value as HubMode)} items={modeItems} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <p className="text-sm font-semibold text-foreground">{projectSectionTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{projectSectionDescription}</p>

            {typeof projectDraft === "string" && onProjectDraftChange && onCreateProject && createButtonLabel ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={projectDraft}
                  onChange={(event) => onProjectDraftChange(event.target.value)}
                  placeholder={projectDraftPlaceholder}
                  className="bg-background"
                />
                <Button onClick={() => void onCreateProject()} disabled={creating || createDisabled} className="sm:min-w-40">
                  {creating ? "Creating..." : createButtonLabel}
                </Button>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {loading ? (
                <span className="text-xs text-muted-foreground">Loading projects...</span>
              ) : currentProjects.length > 0 ? (
                currentProjects.slice(0, 12).map((project) => (
                  <button
                    key={project}
                    type="button"
                    onClick={() => onProjectDraftChange?.(project)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      selectedProject === project
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {project}
                  </button>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">{projectsEmptyText}</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{currentContextTitle}</p>
                {currentContextDescription ? (
                  <div className="mt-1 text-xs text-muted-foreground">{currentContextDescription}</div>
                ) : null}
              </div>
              {rightAction}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {branches.map((branch) => {
                const Icon = branch.icon;
                return (
                  <Link
                    key={branch.title}
                    href={branch.href}
                    className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-card/90"
                  >
                    <div className={`inline-flex rounded-lg border px-2 py-2 ${branch.accent}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{branch.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{branch.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className={`grid gap-3 ${footerColumns}`}>
            {footerLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href} className="rounded-xl border border-border bg-background/70 p-4 hover:bg-background">
                  <div className="inline-flex rounded-lg border border-border px-2 py-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
