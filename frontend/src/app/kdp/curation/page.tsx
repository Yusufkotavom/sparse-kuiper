"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { kdpApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCheck, Image as ImageIcon, Send, FileText, Wand2, Copy, RefreshCw } from "lucide-react";

import { getApiBase } from "@/lib/api";
const getStaticBase = () => `${getApiBase()}/projects_static/`;

export default function CurationPage() {
    const [projects, setProjects] = useState<string[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [images, setImages] = useState<{ raw: string[]; final: string[] }>({ raw: [], final: [] });
    const [isBotLoading, setIsBotLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
    const [editPrompts, setEditPrompts] = useState<string[]>([]);
    const [editMode, setEditMode] = useState(false);
    const [bulkText, setBulkText] = useState("");
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const list = await kdpApi.listProjects();
            setProjects(list);
        } catch (e) {
            console.error("Failed to load projects", e);
        }
    };

    const loadProjectImages = async (name: string) => {
        try {
            const data = await kdpApi.listProjectImages(name);
            setImages(data);
        } catch (e) {
            console.error("Failed to load images", e);
        }
    };

    const loadSavedPrompts = async (name: string) => {
        try {
            const res = await kdpApi.getPrompts(name);
            const data = Array.isArray(res.prompts) ? res.prompts : [];
            setSavedPrompts(data);
            setEditPrompts(data);
        } catch {
            setSavedPrompts([]);
            setEditPrompts([]);
        }
    };

    const handleProjectSelect = (name: string) => {
        setSelectedProject(name);
        loadProjectImages(name);
        loadSavedPrompts(name);
    };

    const handleMoveToFinal = async (filename: string) => {
        if (!selectedProject) return;
        try {
            await kdpApi.curateImage(selectedProject, filename);
            loadProjectImages(selectedProject);
        } catch (e) {
            console.error("Failed to curate image", e);
        }
    };

    const handleDeleteRaw = async (filename: string) => {
        if (!selectedProject) return;
        if (!confirm(`Hapus ${filename}?`)) return;
        try {
            await kdpApi.bulkDeleteProjectImages(selectedProject, [filename]);
            loadProjectImages(selectedProject);
        } catch (e) {
            console.error("Failed to delete image", e);
        }
    };

    const handleRemoveFromFinal = async (filename: string) => {
        if (!selectedProject) return;
        try {
            await kdpApi.archiveImage(selectedProject, filename);
            loadProjectImages(selectedProject);
        } catch (e) {
            console.error("Failed to remove from final", e);
        }
    };

    const handleLaunchBot = async () => {
        if (!selectedProject) return;
        setIsBotLoading(true);
        try {
            const res = await kdpApi.triggerBot(selectedProject);
            alert(res.message);
        } catch (e) {
            console.error("Failed to launch bot", e);
            alert(`Error: ${e instanceof Error ? e.message : "Failed to launch bot"}`);
        } finally {
            setIsBotLoading(false);
        }
    };

    const handleGeneratePdf = async () => {
        if (!selectedProject || images.final.length === 0) return;
        setIsLoading(true);
        try {
            await kdpApi.createPdf({ project_name: selectedProject, image_paths: images.final });
            alert("PDF Generated Successfully!");
        } catch (e) {
            alert(e instanceof Error ? e.message : "PDF creation failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleSaveEditedPrompts = async () => {
        if (!selectedProject) return;
        const cleaned = editPrompts.map(p => (p || "").trim()).filter(p => p.length > 0);
        try {
            await kdpApi.savePrompts(selectedProject, cleaned);
            setSavedPrompts(cleaned);
            setEditMode(false);
            alert(`Saved ${cleaned.length} prompts`);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to save prompts");
        }
    };

    const handleAddPrompt = () => {
        setEditPrompts(p => [...p, ""]);
    };

    const handleRemovePrompt = (idx: number) => {
        setEditPrompts(p => p.filter((_, i) => i !== idx));
    };

    const handleBulkAppend = () => {
        const lines = bulkText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (lines.length === 0) return;
        setEditPrompts(p => [...p, ...lines]);
        setBulkText("");
    };

    const handleBulkReplace = () => {
        const lines = bulkText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        setEditPrompts(lines);
        setBulkText("");
    };

    return (
        <div className="max-w-7xl mx-auto space-y-[var(--gap-base)]">
            <div className="mb-2">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                    <FileText className="w-6 h-6 text-primary" /> Image Curation
                </h2>
                <p className="text-muted-foreground text-sm mt-1">Select a project, launch the bot, curate images, and compile PDFs.</p>
                <div className="mt-3 rounded-xl border border-border bg-surface/80 p-2 sm:p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                            { label: "1. Brief", href: "/kdp/ideation" },
                            { label: "2. Generate", href: "/kdp/ideation" },
                            { label: "3. Review", href: selectedProject ? `/kdp/curation?project=${encodeURIComponent(selectedProject)}` : "/kdp/curation" },
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

            {/* --- Controls Bar --- */}
            <Card className="bg-surface border-border mb-2">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-4">
                    <div>
                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            Project Controls
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            Project: <span className="text-primary font-mono font-bold">{selectedProject || "None selected"}</span>
                            {savedPrompts.length > 0 && <span className="text-muted-foreground/60 ml-2">• {savedPrompts.length} prompts saved</span>}
                        </p>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-center md:w-auto">
                        <select
                            className="bg-background border-border text-xs text-foreground rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px] flex-1 md:flex-none"
                            onChange={(e) => handleProjectSelect(e.target.value)}
                            value={selectedProject || ""}
                        >
                            <option value="" disabled>Select Project</option>
                            {projects.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <Button
                            disabled={!selectedProject}
                            onClick={() => { if (selectedProject) { loadProjectImages(selectedProject); loadSavedPrompts(selectedProject); } }}
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs border-border hover:bg-accent text-muted-foreground w-full sm:w-auto"
                        >
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                        </Button>
                        <Button
                            disabled={!selectedProject || isBotLoading}
                            onClick={handleLaunchBot}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs font-bold w-full sm:w-auto px-4"
                        >
                            {isBotLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-2" />}
                            {isBotLoading ? "Starting..." : "Launch Bot"}
                        </Button>
                        <Button
                            disabled={!selectedProject || images.final.length === 0}
                            onClick={handleGeneratePdf}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs font-bold w-full sm:w-auto px-4"
                        >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-2" />}
                            Generate PDF ({images.final.length})
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* --- Main Content: 3 columns --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--gap-base)]">
                {/* --- SAVED PROMPTS --- */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-foreground">
                            <FileText className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-bold uppercase tracking-wider">Prompts ({savedPrompts.length})</h3>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-primary"
                            onClick={() => setEditMode(m => !m)}
                            disabled={!selectedProject}
                        >
                            {editMode ? "Cancel" : "Edit"}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {editMode && (
                            <div className="flex flex-col gap-2 p-3 bg-surface border border-border rounded-xl shadow-sm">
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1"
                                        onClick={handleSaveEditedPrompts}
                                        disabled={!selectedProject}
                                    >
                                        Save Changes
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-8 text-xs border-border hover:bg-accent font-bold"
                                        onClick={handleAddPrompt}
                                    >
                                        Add New
                                    </Button>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-border mt-1">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Bulk Import</label>
                                    <Textarea
                                        value={bulkText}
                                        onChange={(e) => setBulkText(e.target.value)}
                                        rows={3}
                                        className="bg-background border-border text-[11px] text-foreground font-mono"
                                        placeholder="Paste prompts here (one per line)..."
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
                                            Replace All
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
                            {savedPrompts.length === 0 ? (
                                <div className="py-12 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground italic text-xs px-6 text-center bg-surface/30">
                                    <FileText className="w-8 h-8 mb-2 opacity-20" />
                                    No prompts saved. Generate ideas in Ideation first.
                                </div>
                            ) : (
                                (editMode ? editPrompts : savedPrompts).map((p, i) => (
                                    <div key={i} className="group relative p-3 bg-surface border border-border rounded-xl hover:border-primary/50 transition-all">
                                        {editMode ? (
                                            <div className="flex gap-2 items-start">
                                                <Textarea
                                                    value={p}
                                                    onChange={(e) => {
                                                        const newP = [...editPrompts];
                                                        newP[i] = e.target.value;
                                                        setEditPrompts(newP);
                                                    }}
                                                    className="bg-background border-border text-xs min-h-[60px]"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-error hover:bg-error/10"
                                                    onClick={() => handleRemovePrompt(i)}
                                                >
                                                    <Loader2 className="w-4 h-4 rotate-45" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between gap-2">
                                                <p className="text-[11px] text-foreground leading-relaxed flex-1">{p}</p>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-primary opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleCopy(p, i)}
                                                >
                                                    {copiedIndex === i ? <CheckCheck className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* --- RAW DOWNLOADS --- */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground">
                        <RefreshCw className="w-4 h-4 text-sky-400" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Raw Images ({images.raw.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] sm:max-h-[75vh] overflow-y-auto pr-1 scrollbar-thin">
                        {images.raw.length === 0 ? (
                            <div className="col-span-full py-12 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground italic text-xs px-6 text-center bg-surface/30">
                                <RefreshCw className="w-8 h-8 mb-2 opacity-20" />
                                No images in raw folder. Launch bot to start generation!
                            </div>
                        ) : (
                            images.raw.map((v) => (
                                <Card key={v} className="bg-surface border-border overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all flex flex-col">
                                    <div className="relative aspect-square bg-black group-hover:scale-[1.02] transition-transform duration-300">
                                        <img
                                            src={getApiBase() + `/kdp/stream/${selectedProject}/raw/${v}`}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            alt={v}
                                        />
                                    </div>
                                    <div className="p-2 space-y-2 mt-auto">
                                        <p className="text-[9px] font-mono text-muted-foreground truncate" title={v}>{v}</p>
                                        <div className="flex gap-1">
                                            <Button
                                                onClick={() => handleMoveToFinal(v)}
                                                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] h-7 font-bold"
                                            >
                                                <CheckCheck className="w-3 h-3 mr-1" /> OK
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => handleDeleteRaw(v)}
                                                className="h-7 px-2 border-border hover:bg-error/10 hover:text-error hover:border-error/30"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* --- FINAL SEQUENCE --- */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCheck className="w-4 h-4" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Final PDF Selection ({images.final.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] sm:max-h-[75vh] overflow-y-auto pr-1 scrollbar-thin">
                        {images.final.length === 0 ? (
                            <div className="col-span-full py-12 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground italic text-xs px-6 text-center bg-surface/30">
                                <FileText className="w-8 h-8 mb-2 opacity-20" />
                                Curate raw images to build your final PDF.
                            </div>
                        ) : (
                            images.final.map((v) => (
                                <Card key={v} className="bg-surface border-border overflow-hidden relative group">
                                    <div className="relative aspect-square bg-black">
                                        <img
                                            src={getApiBase() + `/kdp/stream/${selectedProject}/final/${v}`}
                                            className="w-full h-full object-cover"
                                            alt={v}
                                        />
                                    </div>
                                    <div className="p-2 flex items-center justify-between gap-1">
                                        <p className="text-[9px] font-mono text-muted-foreground truncate flex-1">{v}</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveFromFinal(v)}
                                            className="h-6 px-1.5 text-[9px] font-bold text-error hover:bg-error/10"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
