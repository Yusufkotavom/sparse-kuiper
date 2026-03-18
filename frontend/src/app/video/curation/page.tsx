"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { videoApi, getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Loader2,
    CheckCheck,
    Video as VideoIcon,
    Send,
    FileText,
    Wand2,
    Copy,
    RefreshCw,
    Maximize2,
    Trash2,
    Pencil,
    Table2,
    LayoutGrid,
} from "lucide-react";

const getStaticBase = () => `${getApiBase()}/video_projects_static/`;
const LAST_PROJECT_KEY = "video-curation-last-project";
const GENERATION_STEPS = [
    { label: "Kirim Request", sub: "Permintaan generate dikirim ke backend" },
    { label: "Antrian Proses", sub: "Menunggu worker memulai render" },
    { label: "Generate Video", sub: "Bot sedang membuat video baru" },
    { label: "Sinkronisasi File", sub: "Membaca file baru dari project" },
    { label: "Selesai", sub: "Data curation sudah terbarui" },
];

type PromptViewMode = "table" | "card";

export default function VideoCurationPage() {
    const [projects, setProjects] = useState<string[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [videos, setVideos] = useState<{ raw: string[]; final: string[]; archive: string[] }>({ raw: [], final: [], archive: [] });
    const [isBotLoading, setIsBotLoading] = useState(false);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
    const [isDeletingVideo, setIsDeletingVideo] = useState<string | null>(null);
    const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
    const [editPrompts, setEditPrompts] = useState<string[]>([]);
    const [editMode, setEditMode] = useState(false);
    const [promptViewMode, setPromptViewMode] = useState<PromptViewMode>("table");
    const [bulkText, setBulkText] = useState("");
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [previewVideo, setPreviewVideo] = useState<string | null>(null);
    const [useReference, setUseReference] = useState(true);
    const [headlessMode, setHeadlessMode] = useState(true);
    const [botProgress, setBotProgress] = useState(0);
    const [isGenerationMonitoring, setIsGenerationMonitoring] = useState(false);
    const [generationStep, setGenerationStep] = useState(0);
    const [generationMessage, setGenerationMessage] = useState("Siap dijalankan");
    const [expectedGenerateCount, setExpectedGenerateCount] = useState(1);
    const [generatedCount, setGeneratedCount] = useState(0);
    const generationMetaRef = useRef({
        baselineCount: 0,
        lastCount: 0,
        stableTicks: 0,
        startedAt: 0,
        foundNew: false,
        targetCount: 1,
    });
    const isGenerating = isBotLoading || isGenerationMonitoring;

    const curationProgress = useMemo(() => {
        const total = videos.raw.length + videos.final.length;
        if (total === 0) return 0;
        return Math.round((videos.final.length / total) * 100);
    }, [videos.raw.length, videos.final.length]);

    useEffect(() => {
        if (!isGenerationMonitoring || !selectedProject) return;
        let cancelled = false;

        const tick = async () => {
            try {
                const data = await videoApi.listProjectVideos(selectedProject);
                if (cancelled) return;
                setVideos(data);
                const totalCount = data.raw.length + data.final.length;
                const meta = generationMetaRef.current;
                const elapsed = (Date.now() - meta.startedAt) / 1000;
                const newCount = Math.max(0, totalCount - meta.baselineCount);
                const completionRatio = Math.min(1, newCount / Math.max(1, meta.targetCount));
                setGeneratedCount(newCount);

                let stepByTime = 1;
                if (elapsed > 30) stepByTime = 2;
                if (elapsed > 70) stepByTime = 3;
                if (elapsed > 110) stepByTime = 4;

                if (newCount > 0) {
                    meta.foundNew = true;
                    stepByTime = Math.max(stepByTime, 4);
                }

                if (completionRatio >= 0.35) stepByTime = Math.max(stepByTime, 3);
                if (completionRatio >= 0.7) stepByTime = Math.max(stepByTime, 4);
                if (completionRatio >= 1) stepByTime = Math.max(stepByTime, 5);

                if (totalCount !== meta.lastCount) {
                    meta.stableTicks = 0;
                    meta.lastCount = totalCount;
                } else {
                    meta.stableTicks += 1;
                }

                if (newCount >= meta.targetCount && meta.stableTicks >= 2) {
                    setGenerationStep(5);
                    setBotProgress(100);
                    setGenerationMessage(`Generate selesai (${newCount}/${meta.targetCount}).`);
                    setIsGenerationMonitoring(false);
                    loadSavedPrompts(selectedProject);
                    return;
                }

                if (elapsed > 240) {
                    setGenerationStep(5);
                    setBotProgress(100);
                    setGenerationMessage(`Monitoring selesai (${newCount}/${meta.targetCount}). Klik Refresh jika backend masih berjalan.`);
                    setIsGenerationMonitoring(false);
                    return;
                }

                const baseProgress = stepByTime === 1 ? 14 : stepByTime === 2 ? 34 : stepByTime === 3 ? 58 : 78;
                const ratioBonus = Math.round(completionRatio * 17);
                setGenerationStep(stepByTime);
                setBotProgress(Math.min(95, baseProgress + ratioBonus));
                setGenerationMessage(
                    newCount > 0
                        ? `Terdeteksi ${newCount}/${meta.targetCount} video baru.`
                        : GENERATION_STEPS[stepByTime - 1].sub
                );
            } catch {
                if (!cancelled) {
                    setGenerationMessage("Menunggu sinkronisasi data project...");
                }
            }
        };

        tick();
        const interval = setInterval(tick, 3000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [isGenerationMonitoring, selectedProject]);

    const loadProjects = useCallback(async () => {
        try {
            const list = await videoApi.listProjects();
            setProjects(list);
            if (!selectedProject) {
                let preferred = "";
                try {
                    if (typeof window !== "undefined") {
                        preferred = localStorage.getItem(LAST_PROJECT_KEY) || "";
                    }
                } catch {}
                const initial = preferred && list.includes(preferred) ? preferred : list[0];
                if (initial) {
                    setSelectedProject(initial);
                    loadProjectVideos(initial);
                    loadSavedPrompts(initial);
                }
            }
        } catch (e) {
            console.error("Failed to load projects", e);
        }
    }, [selectedProject]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const loadProjectVideos = async (name: string) => {
        try {
            const data = await videoApi.listProjectVideos(name);
            setVideos(data);
        } catch (e) {
            console.error("Failed to load videos", e);
        }
    };

    const loadSavedPrompts = async (name: string) => {
        try {
            const res = await videoApi.getPrompts(name);
            const data = Array.isArray(res.prompts) ? res.prompts : [];
            setSavedPrompts(data);
            setEditPrompts(data);
        } catch {
            setSavedPrompts([]);
            setEditPrompts([]);
        }
    };

    const handleProjectSelect = (name: string) => {
        if (!name) return;
        setSelectedProject(name);
        setEditMode(false);
        setBulkText("");
        try {
            if (typeof window !== "undefined") {
                localStorage.setItem(LAST_PROJECT_KEY, name);
            }
        } catch {}
        loadProjectVideos(name);
        loadSavedPrompts(name);
    };

    const handleCurate = async (filename: string) => {
        if (!selectedProject) return;
        try {
            await videoApi.curateVideo(selectedProject, filename);
            loadProjectVideos(selectedProject);
        } catch (e) {
            console.error("Failed to curate video", e);
        }
    };

    const handleDeleteVideo = async (filename: string) => {
        if (!selectedProject) return;
        const yes = window.confirm(`Hapus video "${filename}"?`);
        if (!yes) return;
        setIsDeletingVideo(filename);
        try {
            await videoApi.bulkDeleteProjectVideos(selectedProject, [filename]);
            await loadProjectVideos(selectedProject);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Gagal menghapus video");
        } finally {
            setIsDeletingVideo(null);
        }
    };

    const handleDeleteProject = async () => {
        if (!selectedProject) return;
        const yes = window.confirm(`Project "${selectedProject}" akan dihapus permanen. Lanjutkan?`);
        if (!yes) return;
        setIsDeletingProject(true);
        try {
            await videoApi.deleteProject(selectedProject);
            try {
                if (typeof window !== "undefined") {
                    localStorage.removeItem(LAST_PROJECT_KEY);
                }
            } catch {}
            setSelectedProject(null);
            setSavedPrompts([]);
            setEditPrompts([]);
            setVideos({ raw: [], final: [], archive: [] });
            await loadProjects();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Gagal menghapus project");
        } finally {
            setIsDeletingProject(false);
        }
    };

    const handleLaunchBot = async () => {
        if (!selectedProject) return;
        setIsBotLoading(true);
        setBotProgress(10);
        setGenerationStep(1);
        setGenerationMessage(GENERATION_STEPS[0].sub);
        const targetCount = Math.max(1, savedPrompts.length);
        setExpectedGenerateCount(targetCount);
        setGeneratedCount(0);
        const baselineCount = videos.raw.length + videos.final.length;
        generationMetaRef.current = {
            baselineCount,
            lastCount: baselineCount,
            stableTicks: 0,
            startedAt: Date.now(),
            foundNew: false,
            targetCount,
        };
        try {
            const res = await videoApi.triggerBot(selectedProject, useReference, headlessMode);
            alert(res.message);
            setIsGenerationMonitoring(true);
        } catch (e) {
            console.error("Failed to launch Grok bot", e);
            alert(`Error: ${e instanceof Error ? e.message : "Failed to launch bot"}`);
            setBotProgress(0);
            setGenerationStep(0);
            setGenerationMessage("Gagal memulai generate.");
        } finally {
            setIsBotLoading(false);
        }
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleSaveEditedPrompts = async () => {
        if (!selectedProject) return;
        const cleaned = editPrompts.map((p) => (p || "").trim()).filter((p) => p.length > 0);
        try {
            await videoApi.savePrompts(selectedProject, cleaned);
            setSavedPrompts(cleaned);
            setEditMode(false);
            alert(`Saved ${cleaned.length} prompts`);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to save prompts");
        }
    };

    const handleAddPrompt = () => {
        setEditPrompts((p) => [...p, ""]);
    };

    const handleRemovePrompt = (idx: number) => {
        setEditPrompts((p) => p.filter((_, i) => i !== idx));
    };

    const handleBulkAppend = () => {
        const lines = bulkText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        if (lines.length === 0) return;
        setEditPrompts((p) => [...p, ...lines]);
        setBulkText("");
    };

    const handleBulkReplace = () => {
        const lines = bulkText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        setEditPrompts(lines);
        setBulkText("");
    };

    const renderPromptRows = !editMode ? savedPrompts : editPrompts;

    return (
        <div className="max-w-7xl mx-auto space-y-[var(--gap-base)]">
            <div className="mb-2">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                    <VideoIcon className="w-6 h-6 text-primary" /> Video Curation
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                    Kelola project, edit prompt, jalankan bot, lalu kurasi hasil video.
                </p>
                <div className="mt-3 rounded-xl border border-border bg-surface/80 p-2 sm:p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                            { label: "1. Brief", href: "/video/ideation" },
                            { label: "2. Generate", href: "/video/ideation" },
                            { label: "3. Review", href: selectedProject ? `/video/curation?project=${encodeURIComponent(selectedProject)}` : "/video/curation" },
                            { label: "4. Run", href: "/runs" },
                        ].map((step) => {
                            const active = step.label.includes("Review");
                            return (
                                <Link
                                    key={step.label}
                                    href={step.href}
                                    className={`rounded-md border px-2 py-1.5 text-center text-[11px] font-semibold ${
                                        active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                                    }`}
                                >
                                    {step.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Card className="bg-surface border-border">
                <CardContent className="pt-5">
                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-center">
                        <select
                            className="bg-background border-border text-xs text-foreground rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px] flex-1 md:flex-none"
                            onChange={(e) => handleProjectSelect(e.target.value)}
                            value={selectedProject || ""}
                        >
                            <option value="" disabled>
                                Select Project
                            </option>
                            {projects.map((p) => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))}
                        </select>
                        <Button
                            disabled={!selectedProject}
                            onClick={() => {
                                if (!selectedProject) return;
                                loadProjectVideos(selectedProject);
                                loadSavedPrompts(selectedProject);
                            }}
                            variant="outline"
                            size="sm"
                            className="h-9 w-full text-xs border-border hover:bg-accent text-muted-foreground sm:w-auto"
                        >
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                        </Button>
                        <Button
                            disabled={!selectedProject || isDeletingProject}
                            onClick={handleDeleteProject}
                            variant="destructive"
                            size="sm"
                            className="h-9 w-full text-xs sm:w-auto"
                        >
                            {isDeletingProject ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                            Delete Project
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                        Project: <span className="text-primary font-mono font-bold">{selectedProject || "None selected"}</span>
                        <span className="ml-2">• Prompt: {savedPrompts.length}</span>
                        <span className="ml-2">• Raw: {videos.raw.length}</span>
                        <span className="ml-2">• Hasil Gen: {videos.final.length}</span>
                    </p>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-[var(--gap-base)]">
                <Card className="bg-surface border-border">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                Prompt ({savedPrompts.length})
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-1">
                                <Button
                                    variant={promptViewMode === "table" ? "default" : "outline"}
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setPromptViewMode("table")}
                                >
                                    <Table2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    variant={promptViewMode === "card" ? "default" : "outline"}
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setPromptViewMode("card")}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-primary"
                                    onClick={() => setEditMode((m) => !m)}
                                    disabled={!selectedProject}
                                >
                                    {editMode ? "Cancel" : "Edit"}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {editMode && (
                            <div className="flex flex-col gap-2 p-3 bg-background border border-border rounded-xl">
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1"
                                        onClick={handleSaveEditedPrompts}
                                        disabled={!selectedProject}
                                    >
                                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                        Simpan Edit Prompt
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-8 text-xs border-border hover:bg-accent font-bold"
                                        onClick={handleAddPrompt}
                                    >
                                        Tambah
                                    </Button>
                                </div>
                                <Textarea
                                    value={bulkText}
                                    onChange={(e) => setBulkText(e.target.value)}
                                    rows={3}
                                    className="bg-background border-border text-[11px] text-foreground font-mono"
                                    placeholder="Satu prompt per baris..."
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="secondary"
                                        className="h-7 text-[10px] font-bold"
                                        onClick={handleBulkAppend}
                                        disabled={bulkText.trim().length === 0}
                                    >
                                        Append
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        className="h-7 text-[10px] font-bold"
                                        onClick={handleBulkReplace}
                                        disabled={bulkText.trim().length === 0}
                                    >
                                        Replace
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="max-h-[58vh] overflow-y-auto pr-1 space-y-2">
                            {renderPromptRows.length === 0 ? (
                                <div className="py-10 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground italic text-xs px-6 text-center bg-surface/30">
                                    <FileText className="w-8 h-8 mb-2 opacity-20" />
                                    Belum ada prompt di project ini.
                                </div>
                            ) : promptViewMode === "table" ? (
                                <div className="border border-border rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-background/80 border-b border-border">
                                            <tr className="text-muted-foreground">
                                                <th className="text-left px-3 py-2 w-12">No</th>
                                                <th className="text-left px-3 py-2">Prompt</th>
                                                <th className="text-right px-3 py-2 w-24">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {renderPromptRows.map((p, i) => (
                                                <tr key={i} className="border-b last:border-b-0 border-border/60">
                                                    <td className="px-3 py-2 font-mono text-muted-foreground">#{i + 1}</td>
                                                    <td className="px-3 py-2">
                                                        {editMode ? (
                                                            <Textarea
                                                                value={p}
                                                                onChange={(e) => setEditPrompts((arr) => arr.map((v, idx) => (idx === i ? e.target.value : v)))}
                                                                className="bg-background border-border text-xs min-h-[70px]"
                                                            />
                                                        ) : (
                                                            <p className="leading-relaxed">{p}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex justify-end gap-1">
                                                            {!editMode && (
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(p, i)}>
                                                                    {copiedIndex === i ? <CheckCheck className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                                                                </Button>
                                                            )}
                                                            {editMode && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-muted-foreground hover:text-error hover:bg-error/10"
                                                                    onClick={() => handleRemovePrompt(i)}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                renderPromptRows.map((p, i) => (
                                    <div key={i} className="group p-3 bg-background border border-border rounded-xl">
                                        <div className="flex items-start gap-2">
                                            <span className="text-[10px] font-mono text-primary mt-0.5">#{i + 1}</span>
                                            <div className="flex-1">
                                                {editMode ? (
                                                    <Textarea
                                                        value={p}
                                                        onChange={(e) => setEditPrompts((arr) => arr.map((v, idx) => (idx === i ? e.target.value : v)))}
                                                        className="bg-background border-border text-xs min-h-[70px]"
                                                    />
                                                ) : (
                                                    <p className="text-[11px] text-foreground leading-relaxed">{p}</p>
                                                )}
                                            </div>
                                            {!editMode ? (
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(p, i)}>
                                                    {copiedIndex === i ? <CheckCheck className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-error hover:bg-error/10"
                                                    onClick={() => handleRemovePrompt(i)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-surface border-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Progress Loading</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-accent/30 rounded-lg px-3 py-2 border border-border/50 h-9">
                                    <input
                                        type="checkbox"
                                        id="useRefToggle"
                                        checked={useReference}
                                        onChange={(e) => setUseReference(e.target.checked)}
                                        className="w-3.5 h-3.5 accent-primary rounded bg-background border-border focus:ring-primary"
                                    />
                                    <label htmlFor="useRefToggle" className="text-xs text-muted-foreground ml-2 cursor-pointer whitespace-nowrap font-medium">
                                        Use Ref Image
                                    </label>
                                </div>
                                <div className="flex items-center bg-accent/30 rounded-lg px-3 py-2 border border-border/50 h-9">
                                    <input
                                        type="checkbox"
                                        id="headlessModeToggle"
                                        checked={headlessMode}
                                        onChange={(e) => setHeadlessMode(e.target.checked)}
                                        className="w-3.5 h-3.5 accent-primary rounded bg-background border-border focus:ring-primary"
                                    />
                                    <label htmlFor="headlessModeToggle" className="text-xs text-muted-foreground ml-2 cursor-pointer whitespace-nowrap font-medium">
                                        Headless Mode
                                    </label>
                                </div>
                            </div>
                            <Button
                                disabled={!selectedProject || isGenerating}
                                onClick={handleLaunchBot}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs font-bold px-4"
                            >
                                {isGenerating ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-2" />}
                                {isGenerating ? "Generating..." : "Launch Bot"}
                            </Button>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">Loading Bot</span>
                                <span className="font-mono text-primary">{botProgress}%</span>
                            </div>
                            <Progress value={botProgress} className="h-2" />
                            <p className="text-[10px] text-muted-foreground">
                                {generationMessage}
                            </p>
                            <p className="text-[10px] text-muted-foreground/80">
                                Target generate: {generatedCount}/{expectedGenerateCount} (berdasarkan jumlah prompt tersimpan)
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">Progress Curation</span>
                                <span className="font-mono text-emerald-400">{curationProgress}%</span>
                            </div>
                            <Progress value={curationProgress} className="h-2" />
                            <p className="text-[10px] text-muted-foreground">
                                Raw {videos.raw.length} • Hasil Gen {videos.final.length}
                            </p>
                        </div>

                        <Input
                            value={selectedProject || ""}
                            readOnly
                            className="bg-background border-border text-[11px] font-mono"
                            placeholder="Project belum dipilih"
                        />

                        {isGenerating && (
                            <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                                {GENERATION_STEPS.map((item, idx) => {
                                    const stepNo = idx + 1;
                                    const isDone = generationStep > stepNo;
                                    const isCurrent = generationStep === stepNo;
                                    return (
                                        <div key={item.label} className="flex items-center gap-2">
                                            <div className="w-5 text-[10px] font-mono text-muted-foreground">#{stepNo}</div>
                                            <div className="flex-1">
                                                <p className={`text-[11px] ${isCurrent ? "text-primary font-semibold" : isDone ? "text-emerald-400" : "text-muted-foreground"}`}>
                                                    {item.label}
                                                </p>
                                                {isCurrent && <Skeleton className="h-2 mt-1 w-2/3" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-[var(--gap-base)]">
                <Card className="bg-surface border-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                            <VideoIcon className="w-4 h-4 text-sky-400" />
                            Raw ({videos.raw.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                            {videos.raw.length === 0 ? (
                                <div className="col-span-full py-10 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground italic text-xs px-6 text-center bg-surface/30">
                                    <VideoIcon className="w-8 h-8 mb-2 opacity-20" />
                                    Raw kosong.
                                </div>
                            ) : (
                                videos.raw.map((vid, idx) => {
                                    const filename = vid.split("/").pop() || "";
                                    const src = getStaticBase() + vid;
                                    return (
                                        <div key={idx} className="border border-border rounded-lg bg-background overflow-hidden">
                                            <button
                                                type="button"
                                                className="block w-full"
                                                onClick={() => setPreviewVideo(src)}
                                            >
                                                <video src={src} className="w-full aspect-video object-cover" />
                                            </button>
                                            <div className="p-2 space-y-2">
                                                <p className="text-[10px] font-mono text-muted-foreground truncate" title={filename}>
                                                    {filename}
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                    <Button
                                                        onClick={() => handleCurate(filename)}
                                                        className="h-7 text-[10px] font-bold"
                                                    >
                                                        <Send className="w-3 h-3 mr-1" />
                                                        Select
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        className="h-7 text-[10px] font-bold"
                                                        onClick={() => handleDeleteVideo(filename)}
                                                        disabled={isDeletingVideo === filename}
                                                    >
                                                        {isDeletingVideo === filename ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-surface border-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-emerald-400">
                            <CheckCheck className="w-4 h-4" />
                            Hasil Gen / Final ({videos.final.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                            {videos.final.length === 0 ? (
                                <div className="col-span-full py-10 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground italic text-xs px-6 text-center bg-surface/30">
                                    <VideoIcon className="w-8 h-8 mb-2 opacity-20" />
                                    Final Sequence (0)
                                </div>
                            ) : (
                                videos.final.map((vid, idx) => {
                                    const filename = vid.split("/").pop() || "";
                                    const src = getStaticBase() + vid;
                                    return (
                                        <div key={idx} className="border border-border rounded-lg bg-background overflow-hidden">
                                            <button
                                                type="button"
                                                className="block w-full"
                                                onClick={() => setPreviewVideo(src)}
                                            >
                                                <video src={src} className="w-full aspect-video object-cover" />
                                            </button>
                                            <div className="p-2 space-y-2">
                                                <p className="text-[10px] font-mono text-emerald-400 truncate" title={filename}>
                                                    #{idx + 1} {filename}
                                                </p>
                                                <Button
                                                    variant="destructive"
                                                    className="h-7 w-full text-[10px] font-bold"
                                                    onClick={() => handleDeleteVideo(filename)}
                                                    disabled={isDeletingVideo === filename}
                                                >
                                                    {isDeletingVideo === filename ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {previewVideo && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setPreviewVideo(null)}
                >
                    <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-12 right-0 text-white hover:bg-white/10"
                            onClick={() => setPreviewVideo(null)}
                        >
                            <Maximize2 className="w-6 h-6 rotate-45" />
                        </Button>
                        <video
                            src={previewVideo}
                            className="w-full max-h-[85vh] rounded-2xl border border-white/10 shadow-2xl bg-black outline-none"
                            controls
                            autoPlay
                            loop
                        />
                        <div className="mt-4 flex items-center justify-between text-white/70 text-sm font-mono px-2">
                            <span>{previewVideo.split("/").pop()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
