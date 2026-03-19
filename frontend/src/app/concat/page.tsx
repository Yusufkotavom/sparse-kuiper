"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { settingsApi, concatApi, videoApi, ConcatPreset, ConcatJobStatus, TrimPoint } from "@/lib/api";
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
import { StudioAssetSelector } from "@/components/studio/StudioAssetSelector";
import { StudioRunBar } from "@/components/studio/StudioRunBar";
import { ChevronLeft, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ConcatPage() {
    return (
        <Suspense>
            <ConcatPageInner />
        </Suspense>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ConcatPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const projectName = searchParams.get("project") || "";

    const [rawVideos, setRawVideos] = useState<string[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
    const [search, setSearch] = useState("");

    // Trim settings (per video)
    const [trimSettings, setTrimSettings] = useState<Record<string, TrimPoint>>({});

    // Concat configuration
    const [concatConfig, setConcatConfig] = useState({
        transition_type: "cut" as "cut" | "crossfade" | "dip_to_black" | "glitch",
        transition_duration: 1.0,
        resolution: "original" as "original" | "1080p" | "720p" | "480p",
        quality: "high" as "high" | "medium" | "low",
        output_suffix: "_concat",
        mute_original_audio: false,
        enable_audio_fade: true,
        audio_fade_duration: 2.0,
        background_music_file: null as string | null,
        background_music_volume: 50,
    });

    // Preset state
    const [presets, setPresets] = useState<ConcatPreset[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<string>("");

    // Save-as-preset dialog
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [newPresetName, setNewPresetName] = useState("");
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeletingPreset, setIsDeletingPreset] = useState(false);

    // Job state
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<ConcatJobStatus | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const normalizeFilePath = useCallback((path: string) => {
        const cleaned = path.replace(/\\/g, "/").replace(/^\/+/, "");
        if (cleaned.startsWith(`${projectName}/`)) {
            return cleaned.slice(projectName.length + 1);
        }
        return cleaned;
    }, [projectName]);

    const filteredVideos = useMemo(
        () => rawVideos.filter((v) => v.split("/").pop()?.toLowerCase().includes(search.toLowerCase())),
        [rawVideos, search]
    );

    // Load presets on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await settingsApi.listConcatPresets();
                if (cancelled) return;
                setPresets(data);
                if (data.length > 0) {
                    setSelectedPreset((prev) => prev || data[0].name);
                    setConcatConfig((prev) => ({
                        ...prev,
                        transition_type: data[0].transition_type,
                        transition_duration: data[0].transition_duration,
                        resolution: data[0].resolution,
                        quality: data[0].quality,
                        mute_original_audio: data[0].mute_original_audio,
                        enable_audio_fade: data[0].enable_audio_fade,
                        audio_fade_duration: data[0].audio_fade_duration,
                        background_music_volume: data[0].background_music_volume,
                    }));
                }
            } catch {
                toast.error("Gagal memuat preset concat");
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

    // Polling logic
    const startPolling = useCallback((id: string) => {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            try {
                const status = await concatApi.getStatus(id);
                setJobStatus(status);

                if (status.status === "done") {
                    setIsRunning(false);
                    clearInterval(pollRef.current!);
                    toast.success("🎉 Video concat berhasil!");
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
        if (preset) {
            setConcatConfig((prev) => ({
                ...prev,
                transition_type: preset.transition_type,
                transition_duration: preset.transition_duration,
                resolution: preset.resolution,
                quality: preset.quality,
                mute_original_audio: preset.mute_original_audio,
                enable_audio_fade: preset.enable_audio_fade,
                audio_fade_duration: preset.audio_fade_duration,
                background_music_volume: preset.background_music_volume,
            }));
        }
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
        if (selectedVideos.length < 2) {
            toast.error("Pilih minimal 2 video untuk concat");
            return;
        }

        const normalizedFiles = selectedVideos.map((v) => normalizeFilePath(v));

        setIsRunning(true);
        setJobStatus(null);

        try {
            const result = await concatApi.run({
                project: projectName,
                files: normalizedFiles,
                trim_settings: Object.keys(trimSettings).length > 0 ? trimSettings : undefined,
                output_suffix: concatConfig.output_suffix,
                transition_type: concatConfig.transition_type,
                transition_duration: concatConfig.transition_duration,
                resolution: concatConfig.resolution,
                quality: concatConfig.quality,
                mute_original_audio: concatConfig.mute_original_audio,
                enable_audio_fade: concatConfig.enable_audio_fade,
                audio_fade_duration: concatConfig.audio_fade_duration,
                background_music_file: concatConfig.background_music_file,
                background_music_volume: concatConfig.background_music_volume,
            });

            setJobId(result.job_id);
            setJobStatus({
                job_id: result.job_id,
                status: "pending",
                progress: 0,
                stage: 0,
                stage_label: "Menunggu dimulai…",
            });
            startPolling(result.job_id);
            toast.info("Job concat dimulai — memproses video…");
        } catch (err: unknown) {
            setIsRunning(false);
            toast.error(err instanceof Error ? err.message : "Gagal memulai job concat");
        }
    };

    const handleCancel = async () => {
        if (!jobId) return;
        if (isCancelling) return;
        setIsCancelling(true);
        try {
            await concatApi.cancel(jobId);
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
        if (!newPresetName.trim()) return;
        setIsSavingPreset(true);
        try {
            await settingsApi.createConcatPreset({
                name: newPresetName.trim(),
                transition_type: concatConfig.transition_type,
                transition_duration: concatConfig.transition_duration,
                resolution: concatConfig.resolution,
                quality: concatConfig.quality,
                mute_original_audio: concatConfig.mute_original_audio,
                enable_audio_fade: concatConfig.enable_audio_fade,
                audio_fade_duration: concatConfig.audio_fade_duration,
                background_music_volume: concatConfig.background_music_volume,
            });
            const updated = await settingsApi.listConcatPresets();
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
            await settingsApi.deleteConcatPreset(selectedPreset);
            const updated = await settingsApi.listConcatPresets();
            setPresets(updated);
            if (updated.length > 0) {
                setSelectedPreset(updated[0].name);
                handlePresetChange(updated[0].name);
            } else {
                setSelectedPreset("");
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
                        <Link2 className="w-6 h-6 text-primary" />
                        Video Concat
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {projectName ? (
                            <>Project: <span className="text-primary font-medium">{projectName}</span></>
                        ) : (
                            "No project selected"
                        )}
                        {selectedVideos.length > 0 && (
                            <>
                                <span className="mx-2">•</span>
                                <span className="font-mono text-xs">{selectedVideos.length} video dipilih</span>
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
                                description="Pilih minimal 2 video untuk concat."
                            />
                        )
                    ) : (
                        <Card className="bg-surface border-border">
                            <CardContent className="p-4 text-xs text-muted-foreground">
                                Pilih project dari halaman Project Manager untuk mulai menggunakan Concat.
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border-border/50 bg-surface/50 shadow-sm backdrop-blur-xl">
                        <CardHeader className="border-b border-border/50 bg-muted/10 pb-4">
                            <CardTitle className="text-lg">Concat Config</CardTitle>
                            <CardDescription>Atur transisi, output, dan audio settings.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="output-suffix">Output Suffix</Label>
                                <Input
                                    id="output-suffix"
                                    value={concatConfig.output_suffix}
                                    onChange={(e) => setConcatConfig((prev) => ({ ...prev, output_suffix: e.target.value }))}
                                    placeholder="_concat"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <StudioRunBar
                        selectedCount={selectedVideos.length}
                        selectedPreset={selectedPreset}
                        suffix={concatConfig.output_suffix}
                        isRunning={isRunning}
                        onSuffixChange={(val) => setConcatConfig((prev) => ({ ...prev, output_suffix: val }))}
                        onRun={handleRun}
                    />
                </div>

                <div className="space-y-4">
                    {jobStatus ? (
                        <Card className="border-border/50 bg-surface/50 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base">Progress</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">{jobStatus.stage_label}</span>
                                        <span className="font-mono">{jobStatus.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${jobStatus.progress}%` }}
                                        />
                                    </div>
                                </div>

                                {jobStatus.current_video && (
                                    <p className="text-xs text-muted-foreground">
                                        Processing: <span className="font-mono">{jobStatus.current_video}</span>
                                    </p>
                                )}

                                {jobStatus.status === "done" && jobStatus.output_path && (
                                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                            ✓ Concat selesai!
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                                            {jobStatus.output_path}
                                        </p>
                                    </div>
                                )}

                                {jobStatus.status === "error" && jobStatus.error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                            ✗ Error
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {jobStatus.error}
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    {jobStatus.status === "running" && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleCancel}
                                            disabled={isCancelling}
                                            className="flex-1"
                                        >
                                            {isCancelling ? "Cancelling..." : "Cancel"}
                                        </Button>
                                    )}
                                    {(jobStatus.status === "done" || jobStatus.status === "error") && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleReset}
                                            className="flex-1"
                                        >
                                            Reset
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-border/50 bg-surface/30 shadow-sm">
                            <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[120px]">
                                <Link2 className="w-8 h-8 text-muted-foreground/30" />
                                <p className="text-xs text-muted-foreground">
                                    Progress concat ditampilkan saat proses berjalan.
                                </p>
                            </CardContent>
                        </Card>
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
                            placeholder="contoh: crossfade_1080p"
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
