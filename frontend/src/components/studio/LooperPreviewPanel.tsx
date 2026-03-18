"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { looperApi, LooperFileInfo, LooperPreset, getApiBase } from "@/lib/api"
import {
    Film,
    Clock,
    Monitor,
    Zap,
    HardDrive,
    RotateCcw,
    Calculator,
    ChevronRight,
    Loader2,
    AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
    if (!sec || sec <= 0) return "—"
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    return `${m}:${String(s).padStart(2, "0")}`
}

function fmtResolution(width: number, height: number): string {
    if (!width || !height) return "—"
    const ratio = width / height
    const orientation =
        ratio > 1.2 ? "🖥️ Landscape" : ratio < 0.85 ? "📱 Portrait" : "⬜ Square"
    return `${width}×${height} (${orientation})`
}

function estimateOutputDuration(info: LooperFileInfo, config: LooperPreset): number {
    const baseDur = info.duration - config.cut_start
    if (baseDur <= 0) return 0

    const loopDur = config.disable_crossfade
        ? baseDur
        : baseDur  // crossfade doesn't add duration, it overlaps

    if (config.enable_looper === false) return loopDur
    if (config.mode === "manual") return loopDur * config.default_loops
    if (config.mode === "target") return config.target_duration
    return config.target_duration // audio: approximate
}

function estimateOutputSize(info: LooperFileInfo, config: LooperPreset): number {
    const outDur = estimateOutputDuration(info, config)
    if (outDur <= 0 || info.duration <= 0) return 0
    // Rough approximation: quality & resolution affect bitrate
    const qualityFactor = { high: 1.2, medium: 0.85, low: 0.5 }[config.quality] ?? 1
    let resFactor = 1
    if (config.resolution !== "original") {
        const targetPixels: Record<string, number> = {
            "1080p": 1920 * 1080, "1080p_p": 1080 * 1920,
            "720p":  1280 * 720,  "720p_p":  720 * 1280,
            "480p":  854  * 480,  "480p_p":  480 * 854,
        }
        const origPixels = info.width * info.height || 1920 * 1080
        resFactor = (targetPixels[config.resolution] ?? origPixels) / origPixels
    }
    const sizePerSec = info.size_mb / info.duration
    return Math.round(sizePerSec * outDur * qualityFactor * resFactor * 10) / 10
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaRow({
    icon: Icon,
    label,
    value,
    highlight = false,
}: {
    icon: React.ElementType
    label: string
    value: string | number
    highlight?: boolean
}) {
    return (
        <div className="flex items-center justify-between gap-2 py-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{label}</span>
            </div>
            <span className={cn(
                "text-xs font-medium font-mono",
                highlight ? "text-primary" : "text-foreground",
            )}>
                {value}
            </span>
        </div>
    )
}

function SectionDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">{label}</span>
            <div className="h-px flex-1 bg-border/40" />
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LooperPreviewPanelProps {
    project: string
    file: string
    config: LooperPreset | null
}

export function LooperPreviewPanel({ project, file, config }: LooperPreviewPanelProps) {
    const [fileInfoState, setFileInfoState] = useState<{
        key: string
        info: LooperFileInfo | null
        error: string | null
    }>({
        key: "",
        info: null,
        error: null,
    })

    const filename = file.split("/").pop() || file
    const mediaPath = useMemo(() => {
        const normalized = file.replace(/^\/+/, "")
        if (!project || !normalized) return ""
        return normalized.startsWith(`${project}/`) ? normalized : `${project}/${normalized}`
    }, [project, file])
    const mediaUrl = useMemo(() => {
        if (!mediaPath) return ""
        const encodedPath = mediaPath
            .split("/")
            .filter(Boolean)
            .map((segment) => encodeURIComponent(segment))
            .join("/")
        return `${getApiBase()}/video_projects_static/${encodedPath}`
    }, [mediaPath])
    const requestKey = `${project}::${file}`
    const fileInfo = fileInfoState.key === requestKey ? fileInfoState.info : null
    const error = fileInfoState.key === requestKey ? fileInfoState.error : null
    const loading = Boolean(project && file) && fileInfoState.key !== requestKey

    // Fetch file metadata whenever project+file changes
    useEffect(() => {
        if (!project || !file) return
        let cancelled = false

        looperApi.getFileInfo(project, file)
            .then((info) => {
                if (!cancelled) {
                    setFileInfoState({
                        key: requestKey,
                        info,
                        error: null,
                    })
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setFileInfoState({
                        key: requestKey,
                        info: null,
                        error: e?.message ?? "Gagal membaca metadata",
                    })
                }
            })

        return () => { cancelled = true }
    }, [project, file, requestKey])

    // Live estimations — recalculate whenever config changes
    const estimation = useMemo(() => {
        if (!fileInfo || !config) return null
        const outDur  = estimateOutputDuration(fileInfo, config)
        const outSize = estimateOutputSize(fileInfo, config)
        const loops = config.enable_looper === false
            ? 1
            : config.mode === "manual"
                ? config.default_loops
                : Math.ceil(outDur / Math.max(fileInfo.duration - config.cut_start, 1))
        const mixerOn = config.enable_scene_mixer === true
        const looperOn = config.enable_looper !== false
        const workflow = mixerOn && looperOn
            ? "Mixer + Loop"
            : mixerOn
                ? "Mixer Only"
                : looperOn
                    ? "Loop Only"
                    : "Original"

        return { outDur, outSize, loops, workflow }
    }, [fileInfo, config])

    return (
        <Card className="border-border/50 bg-surface/50 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Film className="w-4 h-4 text-primary" />
                    Preview Sumber
                </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
                {/* File name bar */}
                <div className="px-4 py-2.5 bg-muted/20 border-b border-border/30 flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-[11px] font-mono text-foreground truncate flex-1" title={file}>
                        {filename}
                    </p>
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />}
                </div>

                {mediaUrl && (
                    <div className="p-3 border-b border-border/30 bg-background/30">
                        <div className="aspect-video rounded-md overflow-hidden border border-border/40 bg-black">
                            <video
                                src={mediaUrl}
                                className="w-full h-full object-contain"
                                controls
                                preload="metadata"
                            />
                        </div>
                    </div>
                )}

                {/* States */}
                {!project && (
                    <div className="p-6 flex flex-col items-center gap-2 text-center">
                        <Film className="w-8 h-8 text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground">Belum ada file dipilih</p>
                    </div>
                )}

                {error && (
                    <div className="mx-4 my-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300">{error}</p>
                    </div>
                )}

                {fileInfo && (
                    <div className="px-4 py-3 space-y-1 divide-y divide-border/20">
                        {/* Original file info */}
                        <div className="space-y-0 pb-2">
                            <MetaRow icon={Clock}    label="Durasi Asli"  value={fmtDuration(fileInfo.duration)} />
                            <MetaRow icon={Monitor}  label="Resolusi"     value={fmtResolution(fileInfo.width, fileInfo.height)} />
                            <MetaRow icon={Zap}      label="Frame Rate"   value={`${fileInfo.fps} fps`} />
                            <MetaRow icon={HardDrive} label="Ukuran File" value={`${fileInfo.size_mb} MB`} />
                        </div>

                        {/* Estimation */}
                        {config && estimation && (
                            <div className="space-y-0 pt-2">
                                <SectionDivider label="Estimasi Output" />
                                <MetaRow
                                    icon={RotateCcw}
                                    label="Jumlah Loop"
                                    value={`${estimation.loops}×`}
                                    highlight
                                />
                                <MetaRow
                                    icon={ChevronRight}
                                    label="Workflow"
                                    value={estimation.workflow}
                                    highlight
                                />
                                <MetaRow
                                    icon={Clock}
                                    label="Durasi Output"
                                    value={fmtDuration(estimation.outDur)}
                                    highlight
                                />
                                <MetaRow
                                    icon={HardDrive}
                                    label="Estimasi Ukuran"
                                    value={`~${estimation.outSize} MB`}
                                    highlight
                                />
                                <MetaRow
                                    icon={Calculator}
                                    label="Dipotong Awal"
                                    value={`−${config.cut_start}s`}
                                />
                                {!config.disable_crossfade && (
                                    <MetaRow
                                        icon={ChevronRight}
                                        label="Crossfade"
                                        value={`${config.crossfade_duration}s`}
                                    />
                                )}
                                {config.enable_scene_mixer && (
                                    <>
                                        <MetaRow
                                            icon={Film}
                                            label="Scene Mixer"
                                            value="Aktif"
                                        />
                                        <MetaRow
                                            icon={ChevronRight}
                                            label="Sumber Mixer"
                                            value={
                                                config.scene_mixer_source === "folder"
                                                    ? "Folder"
                                                    : config.scene_mixer_source === "selected"
                                                        ? "Pilihan"
                                                        : "Original"
                                            }
                                        />
                                        <MetaRow
                                            icon={Calculator}
                                            label="Klip Mixer"
                                            value={`${config.scene_mixer_clip_count ?? 10} klip`}
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        {/* Resolution target */}
                        {config && config.resolution !== "original" && (
                            <div className="pt-2">
                                <SectionDivider label="Scale Target" />
                                <MetaRow
                                    icon={Monitor}
                                    label="Target Res"
                                    value={config.resolution.replace("p_p", "p Portrait").replace(/^(\d+)p$/, "$1p Landscape")}
                                    highlight
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Skeleton while loading */}
                {loading && !fileInfo && (
                    <div className="px-4 py-3 space-y-2">
                        {[80, 60, 90, 50].map((w, i) => (
                            <div
                                key={i}
                                className="h-4 rounded bg-muted/40 animate-pulse"
                                style={{ width: `${w}%` }}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
