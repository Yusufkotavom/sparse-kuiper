"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { getApiBase, LooperJobStatus } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
    CheckCircle2,
    XCircle,
    Loader2,
    X,
    FolderOpen,
    ScissorsLineDashed,
    Calculator,
    Clapperboard,
    Zap,
    Music,
    RotateCcw,
    Clock,
} from "lucide-react"

// ─── Stage definitions ────────────────────────────────────────────────────────

const STAGES = [
    { icon: FolderOpen,         label: "Memuat & Validasi",    sub: "Baca metadata video" },
    { icon: ScissorsLineDashed, label: "Potong / Mixer",       sub: "Trim, transisi, atau scene mixer" },
    { icon: Calculator,         label: "Kalkulasi",            sub: "Hitung durasi output" },
    { icon: Clapperboard,       label: "Render Video",         sub: "Encode dengan MoviePy" },
    { icon: Zap,                label: "Finalisasi",           sub: "Concat/trim via FFmpeg" },
    { icon: Music,              label: "Postprocess",          sub: "Audio, watermark, & scale" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LooperRunProgressProps {
    job: LooperJobStatus
    onCancel: () => void
    onReset: () => void
    isCancelling?: boolean
}

function getPreviewUrl(outputPath?: string | null): string {
    if (!outputPath) return ""
    const normalized = outputPath.replace(/\\/g, "/")
    const marker = "/video_projects/"
    const idx = normalized.toLowerCase().indexOf(marker)
    if (idx < 0) return ""
    const rel = normalized.slice(idx + marker.length).split("/").filter(Boolean).map(encodeURIComponent).join("/")
    return rel ? `${getApiBase()}/video_projects_static/${rel}` : ""
}

export function LooperRunProgress({ job, onCancel, onReset, isCancelling = false }: LooperRunProgressProps) {
    const isRunning = job.status === "running" || job.status === "pending"
    const isDone    = job.status === "done"
    const isError   = job.status === "error"
    const previewUrl = getPreviewUrl(job.output_path)

    const startRef = useRef<number | null>(null)
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        if (!isRunning) return
        if (startRef.current === null) startRef.current = Date.now()
        const interval = setInterval(() => {
            const startedAt = startRef.current ?? Date.now()
            setElapsed(Math.floor((Date.now() - startedAt) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [isRunning])

    return (
        <Card className={cn(
            "border shadow-sm overflow-hidden transition-all duration-300",
            isDone  && "border-green-500/30 bg-green-500/5",
            isError && "border-red-500/30 bg-red-500/5",
            isRunning && "border-primary/30 bg-surface/50 backdrop-blur-xl",
            !isRunning && !isDone && !isError && "border-border/50 bg-surface/30",
        )}>
            {/* Header */}
            <CardHeader className={cn(
                "border-b pb-3 px-4 pt-4",
                isDone  && "border-green-500/20",
                isError && "border-red-500/20",
                isRunning && "border-primary/20",
                !isRunning && !isDone && !isError && "border-border/30",
            )}>
                {isDone && previewUrl && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-green-500/20 bg-black/30">
                        <video
                            src={previewUrl}
                            className="w-full max-h-[220px] object-contain"
                            controls
                            preload="metadata"
                        />
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        {isRunning && (
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                            </span>
                        )}
                        {isDone    && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        {isError   && <XCircle      className="w-4 h-4 text-red-400" />}

                        <span className={cn(
                            isDone  && "text-green-400",
                            isError && "text-red-400",
                            isRunning && "text-foreground",
                        )}>
                            {isRunning ? "Memproses…"   :
                             isDone    ? "Selesai! 🎉"  :
                             isError   ? "Proses Gagal" :
                             "Menunggu…"}
                        </span>
                    </CardTitle>

                    <div className="flex items-center gap-2">
                        {/* Elapsed timer */}
                        {(isRunning || isDone) && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3" />
                                {formatElapsed(elapsed)}
                            </span>
                        )}
                        {/* Cancel / Reset button */}
                        {isRunning && (
                            <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                onClick={onCancel}
                                title="Batalkan job"
                                disabled={isCancelling}
                            >
                                {isCancelling ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <X className="w-3 h-3" />
                                )}
                            </Button>
                        )}
                        {(isDone || isError) && (
                            <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 rounded text-muted-foreground hover:text-foreground"
                                onClick={onReset}
                                title="Proses ulang"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
                {/* Progress bar */}
                <div className="space-y-1.5">
                    <Progress
                        value={job.progress}
                        className={cn(
                            "h-1.5 transition-all",
                            isDone  && "[&>div]:bg-green-500",
                            isError && "[&>div]:bg-red-500",
                        )}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                        <span>{job.stage_label || "Menginisialisasi…"}</span>
                        <span>{job.progress}%</span>
                    </div>
                </div>

                {/* Stage steps */}
                <div className="space-y-1">
                    {STAGES.map((stage, i) => {
                        const stageNum  = i + 1
                        const isPast    = job.stage > stageNum
                        const isCurrent = job.stage === stageNum && isRunning
                        const isDoneStage = isDone // all stages done on "done"
                        const Icon      = stage.icon

                        return (
                            <div
                                key={stageNum}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-all duration-200",
                                    isCurrent && "bg-primary/10 border border-primary/20",
                                    isPast    && "opacity-50",
                                    !isCurrent && !isPast && !isDoneStage && "opacity-25",
                                    isDoneStage && "opacity-80",
                                )}
                            >
                                {/* Icon slot */}
                                <div className={cn(
                                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                                    isCurrent  && "bg-primary/20 text-primary",
                                    isPast     && "bg-green-500/20 text-green-400",
                                    isDoneStage && "bg-green-500/20 text-green-400",
                                    !isCurrent && !isPast && !isDoneStage && "bg-muted/30 text-muted-foreground/40",
                                )}>
                                    {isCurrent ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : isPast || isDoneStage ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    ) : (
                                        <Icon className="w-3.5 h-3.5" />
                                    )}
                                </div>

                                {/* Label */}
                                <div className="min-w-0 flex-1">
                                    <p className={cn(
                                        "font-medium leading-tight",
                                        isCurrent && "text-primary",
                                        (isPast || isDoneStage) && "text-green-400",
                                    )}>
                                        {stage.label}
                                    </p>
                                    {isCurrent && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5 animate-in fade-in">
                                            {stage.sub}
                                        </p>
                                    )}
                                </div>

                                {/* Stage number badge */}
                                <span className="text-[9px] text-muted-foreground/40 font-mono ml-auto flex-shrink-0">
                                    {stageNum}/6
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Error message */}
                {isError && job.error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                        <p className="text-xs text-red-400 font-medium mb-1">Error Detail:</p>
                        <p className="text-[11px] text-red-300/80 font-mono break-all">{job.error}</p>
                    </div>
                )}

                {/* Success output */}
                {isDone && job.output_path && (
                    <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 space-y-2">
                        <p className="text-xs text-green-400 font-medium">File Output:</p>
                        <p className="text-[11px] text-green-300/80 font-mono break-all">
                            {job.output_path.split(/[\\/]/).pop()}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                            {job.output_path.replace(/[\\/][^\\/]+$/, "")}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
