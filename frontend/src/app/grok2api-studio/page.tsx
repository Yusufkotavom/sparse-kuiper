"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clapperboard,
  ExternalLink,
  ImageIcon,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Square,
  Sparkles,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SERVICE_URL = process.env.NEXT_PUBLIC_GROK2API_STUDIO_URL || "http://localhost:7861";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SERVICE_NAME = "grok2api-studio";

type StudioMode = "image" | "video";

export default function Grok2ApiStudioPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-1 py-6 text-sm text-muted-foreground">Loading Grok2API Studio...</div>}>
      <Grok2ApiStudioContent />
    </Suspense>
  );
}

function Grok2ApiStudioContent() {
  const searchParams = useSearchParams();
  const queryMode = searchParams.get("mode");
  const mode: StudioMode = queryMode === "video" ? "video" : "image";
  const [iframeSrc, setIframeSrc] = useState(SERVICE_URL);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);
  const [status, setStatus] = useState<"running" | "stopped" | "starting" | "stopping" | "unknown">("unknown");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const modeCopy = useMemo(() => {
    if (mode === "video") {
      return {
        title: "Grok2API Video Studio",
        subtitle: "Image-to-video dan text-to-video via Grok2API.",
        badge: "Video Mode",
        icon: Clapperboard,
        backHref: "/ideation?mode=video",
        backLabel: "Back to Video Ideation",
      };
    }

    return {
      title: "Grok2API Image Studio",
      subtitle: "Generate image set dari prompt project memakai UI Grok2API.",
      badge: "Image Mode",
      icon: ImageIcon,
      backHref: "/ideation?mode=image",
      backLabel: "Back to Image Ideation",
    };
  }, [mode]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/services/status/${SERVICE_NAME}`);
      if (!res.ok) throw new Error("API call failed");
      const data = await res.json();
      setStatus(data.status);
    } catch (error) {
      console.error("Failed to check status:", error);
      setStatus("unknown");
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setKey((prev) => prev + 1);
    setIframeSrc(SERVICE_URL);
  }, []);

  const handleStart = async () => {
    setIsActionLoading(true);
    setStatus("starting");
    try {
      const res = await fetch(`${API_URL}/services/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: SERVICE_NAME }),
      });
      if (res.ok) {
        setTimeout(() => {
          void checkStatus();
          handleRefresh();
        }, 2500);
      } else {
        setStatus("stopped");
      }
    } catch (error) {
      console.error("Failed to start service:", error);
      setStatus("stopped");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStop = async () => {
    setIsActionLoading(true);
    setStatus("stopping");
    try {
      await fetch(`${API_URL}/services/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: SERVICE_NAME }),
      });
      setTimeout(() => {
        void checkStatus();
      }, 1000);
    } catch (error) {
      console.error("Failed to stop service:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    void checkStatus();
    const interval = setInterval(() => {
      void checkStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const ModeIcon = modeCopy.icon;

  return (
    <div className={cn("flex flex-col", isFullscreen ? "fixed inset-0 z-50 bg-background" : "h-[calc(100vh-0px)]")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              status === "running" ? "bg-green-500 animate-pulse" : status === "starting" ? "bg-amber-500 animate-pulse" : "bg-rose-500"
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ModeIcon className="h-4 w-4 text-primary" />
                {modeCopy.title}
              </h2>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                Port 7861
              </span>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {modeCopy.badge}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{modeCopy.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={modeCopy.backHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {modeCopy.backLabel}
          </Link>
          <button
            type="button"
            onClick={handleStart}
            disabled={status === "running" || status === "starting" || isActionLoading}
            className={buttonVariants({ variant: "outline", size: "sm", className: "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" })}
          >
            {status === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={status === "stopped" || status === "stopping" || isActionLoading}
            className={buttonVariants({ variant: "outline", size: "sm", className: "border-rose-500/30 text-rose-300 hover:bg-rose-500/10" })}
          >
            {status === "stopping" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            Stop
          </button>
          <button type="button" onClick={handleRefresh} className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
            <RefreshCw className="h-4 w-4" />
          </button>
          <a href={SERVICE_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
            <ExternalLink className="h-4 w-4" />
          </a>
          <button type="button" onClick={() => setIsFullscreen((prev) => !prev)} className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="border-b border-border bg-surface/70 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-md bg-muted px-2 py-1">1. Save prompts ke project</span>
          <span>→</span>
          <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">2. Start Grok2API Studio</span>
          <span>→</span>
          <span className="rounded-md bg-muted px-2 py-1">3. Generate image/video</span>
          <span>→</span>
          <span className="rounded-md bg-muted px-2 py-1">4. Review hasil di project assets</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-background">
        {status === "running" ? (
          <iframe
            key={key}
            src={iframeSrc}
            className="h-full w-full border-0"
            title="Grok2API Studio"
            allow="autoplay; clipboard-write; fullscreen"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="relative">
              <Sparkles className="h-16 w-16 text-primary/40" />
              {(status === "starting" || status === "stopping") ? (
                <div className="absolute -inset-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                {status === "starting" ? "Menyalakan Grok2API Studio..." : status === "stopping" ? "Mematikan Grok2API Studio..." : "Grok2API Studio standby"}
              </p>
              <p className="max-w-xl text-sm text-muted-foreground">
                Studio ini memakai UI dari folder `grok2api/gradio` agar flow image dan video bisa diakses dari dalam app tanpa keluar ke tool terpisah.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface/70 p-4 text-left text-xs text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                <Info className="h-4 w-4 text-primary" />
                Quick notes
              </div>
              <p>Pastikan server Grok2API target sudah hidup di base URL yang dipakai UI Gradio.</p>
              <p className="mt-1">Hasil media dari studio akan tetap mengikuti perilaku UI Grok2API yang aktif saat ini.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
