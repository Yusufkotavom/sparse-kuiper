"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { internalPlaywrightApi, PlaywrightProbeResult, PlaywrightRunResult } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Bug, PlayCircle, Rocket } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

export default function PlaywrightLabPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [grokProject, setGrokProject] = useState("");
  const [grokUseReference, setGrokUseReference] = useState(true);
  const [grokHeadless, setGrokHeadless] = useState(true);
  const [whiskProject, setWhiskProject] = useState("");
  const [probeUrl, setProbeUrl] = useState("https://x.com/i/grok");
  const [probeSelectorsText, setProbeSelectorsText] = useState("textarea\nbutton:has-text('Download')");
  const [probeHeadless, setProbeHeadless] = useState(true);
  const [probeWaitMs, setProbeWaitMs] = useState("1200");
  const [running, setRunning] = useState<"none" | "grok" | "whisk" | "probe">("none");
  const [lastRunResult, setLastRunResult] = useState<PlaywrightRunResult | null>(null);
  const [probeResult, setProbeResult] = useState<PlaywrightProbeResult | null>(null);

  useEffect(() => {
    const ensureAuthed = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setAuthLoading(false);
    };
    ensureAuthed();
  }, [router]);

  const selectors = useMemo(
    () => probeSelectorsText.split("\n").map((s) => s.trim()).filter(Boolean),
    [probeSelectorsText]
  );

  const runGrok = async () => {
    const project = grokProject.trim();
    if (!project) {
      toast.error("Project Grok wajib diisi");
      return;
    }
    setRunning("grok");
    try {
      const res = await internalPlaywrightApi.runGrokProject({
        project_name: project,
        use_reference: grokUseReference,
        headless_mode: grokHeadless,
      });
      setLastRunResult(res);
      toast.success(`Grok worker queued (PID ${res.pid})`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal trigger Grok";
      toast.error(msg);
    } finally {
      setRunning("none");
    }
  };

  const runWhisk = async () => {
    const project = whiskProject.trim();
    if (!project) {
      toast.error("Project Whisk wajib diisi");
      return;
    }
    setRunning("whisk");
    try {
      const res = await internalPlaywrightApi.runWhiskProject({ project_name: project });
      setLastRunResult(res);
      toast.success(`Whisk worker queued (PID ${res.pid})`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal trigger Whisk";
      toast.error(msg);
    } finally {
      setRunning("none");
    }
  };

  const runProbe = async () => {
    const url = probeUrl.trim();
    if (!url) {
      toast.error("URL probe wajib diisi");
      return;
    }
    const waitMs = Number(probeWaitMs);
    if (!Number.isFinite(waitMs) || waitMs < 0) {
      toast.error("wait_ms harus angka >= 0");
      return;
    }
    setRunning("probe");
    try {
      const res = await internalPlaywrightApi.probe({
        url,
        selectors,
        wait_ms: Math.floor(waitMs),
        headless: probeHeadless,
      });
      setProbeResult(res);
      toast.success("Probe selesai");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Probe gagal";
      toast.error(msg);
    } finally {
      setRunning("none");
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Playwright Internal Lab</h1>
        <p className="text-sm text-muted-foreground">
          Tool internal untuk debug dan penyempurnaan alur Grok/Whisk berbasis backend yang sama.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="h-4 w-4" />
              Trigger Grok Project
            </CardTitle>
            <CardDescription>Menjalankan worker video Playwright untuk project video.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grok-project">Nama project video</Label>
              <Input
                id="grok-project"
                value={grokProject}
                onChange={(e) => setGrokProject(e.target.value)}
                placeholder="misal: my-video-project"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Use reference image antar prompt</Label>
              <Switch checked={grokUseReference} onCheckedChange={setGrokUseReference} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Headless mode</Label>
              <Switch checked={grokHeadless} onCheckedChange={setGrokHeadless} />
            </div>
            <Button onClick={runGrok} disabled={running !== "none"} className="w-full">
              {running === "grok" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Jalankan Grok Worker
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="h-4 w-4" />
              Trigger Whisk Project
            </CardTitle>
            <CardDescription>Menjalankan worker image Playwright untuk project KDP/Whisk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whisk-project">Nama project KDP</Label>
              <Input
                id="whisk-project"
                value={whiskProject}
                onChange={(e) => setWhiskProject(e.target.value)}
                placeholder="misal: my-kdp-project"
              />
            </div>
            <Button onClick={runWhisk} disabled={running !== "none"} className="w-full">
              {running === "whisk" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Jalankan Whisk Worker
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug className="h-4 w-4" />
            Playwright Probe
          </CardTitle>
          <CardDescription>Uji selector dan visibilitas elemen langsung ke halaman target.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="probe-url">URL target</Label>
              <Input id="probe-url" value={probeUrl} onChange={(e) => setProbeUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probe-selectors">Selector (1 baris 1 selector)</Label>
              <Textarea
                id="probe-selectors"
                value={probeSelectorsText}
                onChange={(e) => setProbeSelectorsText(e.target.value)}
                rows={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probe-wait-ms">wait_ms</Label>
              <Input
                id="probe-wait-ms"
                inputMode="numeric"
                value={probeWaitMs}
                onChange={(e) => setProbeWaitMs(e.target.value)}
                placeholder="1200"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Headless mode</Label>
              <Switch checked={probeHeadless} onCheckedChange={setProbeHeadless} />
            </div>
            <Button onClick={runProbe} disabled={running !== "none"} className="w-full">
              {running === "probe" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Jalankan Probe
            </Button>
          </div>
          <div className="space-y-3">
            <Label>Hasil terakhir</Label>
            <pre className="max-h-[420px] overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
{JSON.stringify({ lastRunResult, probeResult }, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
