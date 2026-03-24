"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Sparkles, Wand2 } from "lucide-react";

import { PageHeader } from "@/components/atoms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { videoApi } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlowStepWizard, type FlowStepItem } from "@/components/organisms/FlowStepWizard";

const STEPS: FlowStepItem[] = [
  { id: "ideation", title: "Ideation", description: "Brief + prompt direction", icon: Wand2, required: true, completed: true },
  { id: "generate", title: "Generate", description: "Produce draft assets", icon: Sparkles, required: true, completed: true },
  { id: "curation", title: "Curation", description: "Review raw/final quickly", icon: FolderOpen, required: true },
  { id: "finalize", title: "Finalize", description: "Mark ready for publish", icon: FolderOpen, required: true },
];

export default function NewV2AssetsPage() {
  const [projects, setProjects] = useState<string[]>([]);
  const [projectName, setProjectName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [targetStage, setTargetStage] = useState<"raw" | "final">("raw");
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canUpload = useMemo(() => Boolean(projectName.trim()) && files.length > 0, [files.length, projectName]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    setError(null);
    try {
      const result = await videoApi.listProjects();
      setProjects(result);
      if (!projectName && result.length > 0) {
        setProjectName(result[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar project.");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await videoApi.createProject(name);
      setSuccess(`Project "${name}" berhasil dibuat.`);
      setNewProjectName("");
      await loadProjects();
      setProjectName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpload = async () => {
    if (!canUpload) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await videoApi.uploadProjectVideos(projectName, files, { targetStage });
      setSuccess(`${files.length} file berhasil diupload ke ${projectName} (${targetStage}).`);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload asset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <PageHeader
        title="NewV2 · Asset Generator"
        description="Flow asset ringkas dengan wiring ke API project video: create project + upload file + lanjut ke Publisher Ops."
        badge="Assets v2"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/ideation" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Open Legacy Ideation</Link>
            <Link href="/newv2/publisher" className={cn(buttonVariants({ size: "sm" }))}>Continue to Publisher</Link>
          </div>
        }
      />

      <FlowStepWizard steps={STEPS} />

      <Card className="border-border bg-surface/70">
        <CardHeader>
          <CardTitle className="text-base">Asset Flow Actions</CardTitle>
          <CardDescription>Create project dan upload file langsung ke API existing (`/video/projects/*`).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-project-name">Create project (Required)</Label>
              <div className="flex gap-2">
                <Input
                  id="new-project-name"
                  placeholder="contoh: Ramadan-Shorts"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                />
                <Button type="button" variant="outline" onClick={handleCreateProject} disabled={isSubmitting || !newProjectName.trim()}>
                  Create
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-name">Target project (Required)</Label>
              <Input
                id="project-name"
                list="project-list"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder={isLoadingProjects ? "Loading projects..." : "Pilih atau ketik nama project"}
              />
              <datalist id="project-list">
                {projects.map((project) => (
                  <option key={project} value={project} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-files">Asset files (Required)</Label>
              <Input
                id="asset-files"
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <p className="text-xs text-muted-foreground">{files.length} file dipilih.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-stage">Target stage (Optional)</Label>
              <Select value={targetStage} onValueChange={(value) => setTargetStage(value === "final" ? "final" : "raw")}>
                <SelectTrigger id="target-stage">
                  <SelectValue placeholder="Pilih stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">raw</SelectItem>
                  <SelectItem value="final">final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleUpload} disabled={isSubmitting || !canUpload}>
              Upload Assets
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadProjects()} disabled={isLoadingProjects}>
              Refresh Projects
            </Button>
          </div>

          {!isLoadingProjects && projects.length === 0 && (
            <p className="text-xs text-muted-foreground">Belum ada project video. Buat project dulu sebelum upload.</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-emerald-600">{success}</p>}
        </CardContent>
      </Card>

      <Collapsible defaultOpen={false} className="rounded-xl border border-border bg-surface/70 p-4">
        <CollapsibleTrigger className="text-sm font-medium text-foreground">Advanced Options (Collapsed by default)</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 text-xs text-muted-foreground">
          Opsi lanjutan seperti preset generator, retry tuning, dan audit metadata ditaruh di sini supaya layar utama tetap clean.
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
