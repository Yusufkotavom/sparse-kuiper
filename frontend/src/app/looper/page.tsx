"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { settingsApi, looperApi, videoApi, LooperPreset, LooperJobStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { LooperConfig } from "@/components/studio/LooperConfig";
import { LooperRunProgress } from "@/components/studio/LooperRunProgress";
import { LooperPreviewPanel } from "@/components/studio/LooperPreviewPanel";
import { StudioAssetSelector } from "@/components/studio/StudioAssetSelector";
import { StudioRunBar } from "@/components/studio/StudioRunBar";
import { ChevronLeft, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LooperPage() {
    return (
        <Suspense>
            <LooperPageInner />
        </Suspense>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function LooperPageInner() {
    const router       = useRouter();
    const searchParams = useSearchParams();

    const projectName = searchParams.get("project") || "";
    const queryFile   = searchParams.get("file")    || "";

    const [rawVideos, setRawVideos] = useState<string[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
    const [search, setSearch] = useState("");

    // Preset state
    const [presets,        setPresets]        = useState<LooperPreset[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<string>("");
    const [looperConfig,   setLooperConfig]   = useState<LooperPreset | null>(null);
    const [outputSuffix,   setOutputSuffix]   = useState("_loop");

    // Save-as-preset dialog
    const [saveDialogOpen,  setSaveDialogOpen]  = useState(false);
    const [newPresetName,   setNewPresetName]   = useState("");
    const [isSavingPreset,  setIsSavingPreset]  = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeletingPreset, setIsDeletingPreset] = useState(false);

    // Job state
    const [jobId,      setJobId]      = useState<string | null>(null);
    const [jobStatus,  setJobStatus]  = useState<LooperJobStatus | null>(null);
    const [isRunning,  setIsRunning]  = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const normalizeFilePath = useCallback((path: string) => {
        const cleaned = path.replace(/\\/g, "/").replace(/^\/+/, "");
        if (cleaned.startsWith(`${projectName}/`)) {
            return cleaned.slice(projectName.length + 1);
        }
        return cleaned;
    }, [projectName]);

    const selectedFile = useMemo(() => {
        if (selectedVideos.length > 0) {
            return normalizeFilePath(selectedVideos[0]);
        }
        return queryFile;
    }, [selectedVideos, queryFile, normalizeFilePath]);
    const filename = useMemo(() => selectedFile.split("/").pop() || selectedFile, [selectedFile]);
    const filteredVideos = useMemo(
        () => rawVideos.filter((v) => v.split("/").pop()?.toLowerCase().includes(search.toLowerCase())),
        [rawVideos, search]
    );

    // Load presets on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await settingsApi.listLooperPresets();
                if (cancelled) return;
                setPresets(data);
                if (data.length > 0) {
                    setSelectedPreset((prev) => prev || data[0].name);
                    setLooperConfig((prev)   => prev || { ...data[0] });
                }
            } catch {
                toast.error("Gagal memuat preset looper");
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!projectName) return;
        let cancelled = false;
        setAssetsLoading(true);
        (async () => {
            try {
                const vids = await videoApi.listProjectVideos(projectName);
                if (cancelled) return;
                setRawVideos(vids.raw);
            } catch {
                if (!cancelled) toast.error("Gagal memuat raw videos project");
            } finally {
                if (!cancelled) setAssetsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [projectName]);

    useEffect(() => {
        if (!queryFile || rawVideos.length === 0) return;
        const matched = rawVideos.find((v) => normalizeFilePath(v) === queryFile);
        if (!matched) return;
        setSelectedVideos((prev) => (prev.length > 0 ? prev : [matched]));
    }, [queryFile, rawVideos, normalizeFilePath]);

    // Polling logic
    const startPolling = useCallback((id: string) => {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            try {
                const status = await looperApi.getStatus(id);
                setJobStatus(status);

                if (status.status === "done") {
                    setIsRunning(false);
                    clearInterval(pollRef.current!);
                    toast.success("🎉 Video berhasil dibuat!");
                } else if (status.status === "error") {
                    setIsRunning(false);
                    clearInterval(pollRef.current!);
                    toast.error(`Error: ${status.error || "Unknown error"}`);
                }
            } catch {
                // silence poll errors
            }
        }, 2000);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const handlePresetChange = (name: string) => {
        setSelectedPreset(name);
        const preset = presets.find((p) => p.name === name);
        if (preset) setLooperConfig({ ...preset });
    };

    const toggleVideo = (video: string) => {
        setSelectedVideos((prev) =>
            prev.includes(video) ? prev.filter((v) => v !== video) : [...prev, video]
        );
    };

    const toggleAll = () => {
        const allFilteredSelected =
            filteredVideos.length > 0 && filteredVideos.every((video) => selectedVideos.includes(video));
        if (allFilteredSelected) {
            setSelectedVideos((prev) => prev.filter((video) => !filteredVideos.includes(video)));
            return;
        }
        setSelectedVideos((prev) => Array.from(new Set([...prev, ...filteredVideos])));
    };

    const handleRun = async () => {
        const targets = selectedVideos.length > 0 ? selectedVideos : selectedFile ? [selectedFile] : [];
        if (targets.length === 0) {
            toast.error("Pilih minimal satu file raw video");
            return;
        }
        if (!looperConfig) {
            toast.error("Pilih atau buat preset looper terlebih dahulu");
            return;
        }

        const mixerPool = Array.from(
            new Set(
                (selectedVideos.length > 0 ? selectedVideos : selectedFile ? [selectedFile] : [])
                    .map((v) => normalizeFilePath(v))
                    .filter(Boolean)
            )
        ).slice(0, 24);
        const useSelectedMixerPool = (looperConfig.scene_mixer_source || "original") === "selected";

        setIsRunning(true);
        setJobStatus(null);

        try {
            const runResults = await Promise.allSettled(
                targets.map(async (videoPath) => {
                    const relative = normalizeFilePath(videoPath);
                    const result = await looperApi.run({
                        project:              projectName,
                        file:                 relative,
                        output_suffix:        outputSuffix,
                        mode:                 looperConfig.mode,
                        default_loops:        looperConfig.default_loops,
                        target_duration:      looperConfig.target_duration,
                        cut_start:            looperConfig.cut_start,
                        disable_crossfade:    looperConfig.disable_crossfade,
                        crossfade_duration:   looperConfig.crossfade_duration,
                        quality:              looperConfig.quality,
                        resolution:           looperConfig.resolution,
                        mute_original_audio:  looperConfig.mute_original_audio,
                        enable_audio_fade:    looperConfig.enable_audio_fade,
                        audio_fade_duration:  looperConfig.audio_fade_duration,
                        enable_looper:        looperConfig.enable_looper,
                        enable_scene_mixer:   looperConfig.enable_scene_mixer,
                        scene_mixer_source:   looperConfig.scene_mixer_source,
                        scene_mixer_selected_files: useSelectedMixerPool ? mixerPool : undefined,
                        scene_mixer_clip_count: looperConfig.scene_mixer_clip_count,
                        scene_mixer_order:    looperConfig.scene_mixer_order,
                        scene_mixer_full_duration: looperConfig.scene_mixer_full_duration,
                        scene_mixer_max_duration: looperConfig.scene_mixer_max_duration,
                        effect_zoom_crop:     looperConfig.effect_zoom_crop,
                        effect_zoom_mode:     looperConfig.effect_zoom_mode,
                        effect_zoom_percent:  looperConfig.effect_zoom_percent,
                        effect_mirror:        looperConfig.effect_mirror,
                        effect_speed_ramping: looperConfig.effect_speed_ramping,
                        effect_color_tweaking: looperConfig.effect_color_tweaking,
                        effect_film_grain:    looperConfig.effect_film_grain,
                        effect_pulsing_vignette: looperConfig.effect_pulsing_vignette,
                        transition_type:      looperConfig.transition_type,
                        watermark_url:        (looperConfig.watermark_url || "").trim() || undefined,
                        watermark_scale:      looperConfig.watermark_scale,
                        watermark_opacity:    looperConfig.watermark_opacity,
                        watermark_position:   looperConfig.watermark_position,
                        watermark_margin_x:   looperConfig.watermark_margin_x,
                        watermark_margin_y:   looperConfig.watermark_margin_y,
                        watermark_key_black:  looperConfig.watermark_key_black,
                        watermark_key_green:  looperConfig.watermark_key_green,
                    });
                    return { jobId: result.job_id, file: relative };
                })
            );

            const fulfilled = runResults.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ jobId: string; file: string }>[];
            const failed = runResults.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

            if (fulfilled.length === 0) {
                throw failed[0]?.reason ?? new Error("Gagal memulai job");
            }

            const primaryJob = fulfilled[0].value;
            setJobId(primaryJob.jobId);
            setJobStatus({
                job_id:      primaryJob.jobId,
                status:      "pending",
                progress:    0,
                stage:       0,
                stage_label: "Menunggu dimulai…",
            });
            startPolling(primaryJob.jobId);
            router.replace(`/looper?project=${encodeURIComponent(projectName)}&file=${encodeURIComponent(primaryJob.file)}`);

            if (fulfilled.length === 1) {
                toast.info("Job dimulai — memproses video…");
            } else {
                toast.info(`${fulfilled.length}/${targets.length} job dimulai. Menampilkan progress job pertama.`);
            }
            if (failed.length > 0) {
                const reason = failed[0]?.reason;
                toast.error(`${failed.length} job gagal: ${reason instanceof Error ? reason.message : "Unknown error"}`);
            }
        } catch (err: unknown) {
            setIsRunning(false);
            toast.error(err instanceof Error ? err.message : "Gagal memulai job");
        }
    };

    const handleCancel = async () => {
        if (!jobId) return;
        if (isCancelling) return;
        setIsCancelling(true);
        try {
            await looperApi.cancel(jobId);
            toast.info("Permintaan pembatalan dikirim");
        } catch {
            toast.error("Gagal membatalkan job");
        } finally {
            setIsCancelling(false);
        }
    };

    const handleReset = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setJobId(null);
        setJobStatus(null);
        setIsRunning(false);
    };

    // ── Save as Preset ────────────────────────────────────────────────────────
    const handleSavePreset = async () => {
        if (!newPresetName.trim() || !looperConfig) return;
        setIsSavingPreset(true);
        try {
            await settingsApi.createLooperPreset({ ...looperConfig, name: newPresetName.trim() });
            const updated = await settingsApi.listLooperPresets();
            setPresets(updated);
            setSelectedPreset(newPresetName.trim());
            setSaveDialogOpen(false);
            setNewPresetName("");
            toast.success(`Preset "${newPresetName.trim()}" disimpan!`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Gagal menyimpan preset");
        } finally {
            setIsSavingPreset(false);
        }
    };

    const handleDeletePreset = async () => {
        if (!selectedPreset) return;
        setIsDeletingPreset(true);
        try {
            await settingsApi.deleteLooperPreset(selectedPreset);
            const updated = await settingsApi.listLooperPresets();
            setPresets(updated);
            if (updated.length > 0) {
                setSelectedPreset(updated[0].name);
                setLooperConfig({ ...updated[0] });
            } else {
                setSelectedPreset("");
                setLooperConfig(null);
            }
            setDeleteDialogOpen(false);
            toast.success(`Preset "${selectedPreset}" dihapus`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Gagal menghapus preset");
        } finally {
            setIsDeletingPreset(false);
        }
    };

    return (
        <div className="p-6 max-w-[1100px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <RotateCcw className="w-6 h-6 text-primary" />
                        Looper Studio
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {projectName ? (
                            <>Project: <span className="text-primary font-medium">{projectName}</span></>
                        ) : (
                            "No project selected"
                        )}
                        {selectedFile && (
                            <>
                                <span className="mx-2">•</span>
                                File: <span className="font-mono text-xs">{filename}</span>
                            </>
                        )}
                        {selectedVideos.length > 1 && (
                            <>
                                <span className="mx-2">•</span>
                                <span className="font-mono text-xs">{selectedVideos.length} file dipilih</span>
                            </>
                        )}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
                <div className="space-y-6">
                    {projectName ? (
                        assetsLoading ? (
                            <Card className="bg-surface border-border">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Memuat daftar raw video...
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <StudioAssetSelector
                                assets={rawVideos}
                                search={search}
                                onSearch={setSearch}
                                selected={selectedVideos}
                                onToggle={toggleVideo}
                                onToggleAll={toggleAll}
                                title="Raw Videos"
                                description="Pilih satu atau banyak video untuk proses looper."
                            />
                        )
                    ) : (
                        <Card className="bg-surface border-border">
                            <CardContent className="p-4 text-xs text-muted-foreground">
                                Pilih project dari halaman Project Manager untuk mulai menggunakan Looper.
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border-border/50 bg-surface/50 shadow-sm backdrop-blur-xl">
                        <CardHeader className="border-b border-border/50 bg-muted/10 pb-4">
                            <CardTitle className="text-lg">Studio Config</CardTitle>
                            <CardDescription>Atur parameter mixing, looper, dan efek visual.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <LooperConfig
                                projectName={projectName}
                                presets={presets}
                                selectedPreset={selectedPreset}
                                onChangePreset={handlePresetChange}
                                config={looperConfig}
                                onChangeConfig={setLooperConfig}
                                onSavePreset={() => {
                                    setNewPresetName("");
                                    setSaveDialogOpen(true);
                                }}
                                onDeletePreset={() => setDeleteDialogOpen(true)}
                                disablePresetActions={isSavingPreset || isDeletingPreset || isRunning}
                            />
                        </CardContent>
                    </Card>

                    <StudioRunBar
                        selectedCount={selectedVideos.length || (selectedFile ? 1 : 0)}
                        selectedPreset={selectedPreset}
                        suffix={outputSuffix}
                        isRunning={isRunning}
                        onSuffixChange={setOutputSuffix}
                        onRun={handleRun}
                    />
                </div>

                <div className="space-y-4">
                    {!jobStatus && (
                        <LooperPreviewPanel
                            project={projectName}
                            file={selectedFile}
                            config={looperConfig}
                        />
                    )}

                    {jobStatus ? (
                        <>
                            <LooperRunProgress
                                job={jobStatus}
                                onCancel={handleCancel}
                                onReset={handleReset}
                                isCancelling={isCancelling}
                            />
                            {/* After done/error: show preview again below */}
                            {(jobStatus.status === "done" || jobStatus.status === "error") && (
                                <LooperPreviewPanel
                                    project={projectName}
                                    file={selectedFile}
                                    config={looperConfig}
                                />
                            )}
                        </>
                    ) : (
                        !selectedFile && (
                            <Card className="border-border/50 bg-surface/30 shadow-sm">
                                <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[120px]">
                                    <RotateCcw className="w-8 h-8 text-muted-foreground/30" />
                                    <p className="text-xs text-muted-foreground">
                                        Progress 6 tahap ditampilkan saat proses berjalan.
                                    </p>
                                </CardContent>
                            </Card>
                        )
                    )}
                </div>
            </div>

            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Simpan Preset Baru</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="preset-name">Nama Preset</Label>
                        <Input
                            id="preset-name"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            placeholder="contoh: viral_reel_fast_cut"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isSavingPreset && newPresetName.trim()) {
                                    e.preventDefault();
                                    handleSavePreset();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setSaveDialogOpen(false)}
                            disabled={isSavingPreset}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleSavePreset}
                            disabled={isSavingPreset || !newPresetName.trim()}
                        >
                            {isSavingPreset ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Menyimpan…
                                </>
                            ) : (
                                "Simpan Preset"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus preset ini?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Preset <span className="font-mono">{selectedPreset || "-"}</span> akan dihapus permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingPreset}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeletePreset}
                            disabled={isDeletingPreset || !selectedPreset}
                            className="bg-red-500 hover:bg-red-600 text-white"
                        >
                            {isDeletingPreset ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Menghapus…
                                </>
                            ) : (
                                "Hapus Preset"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
