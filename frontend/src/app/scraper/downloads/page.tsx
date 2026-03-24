"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSystemUi } from "@/components/system/SystemUiProvider";
import { getApiBase, queueBuilderApi } from "@/lib/api";
import {
    Loader2, ArrowLeft, Trash2, FolderOpen, Send, PlayCircle, Search, X,
    Pencil, Sparkles, Tag, AlignLeft, Type, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

interface DownloadedFile {
    filename: string;
    title: string;
    description: string;
    tags: string;
    duration: number;
    view_count: number;
    size_mb: number;
    uploader: string;
    channel: string;
    has_thumbnail?: boolean;
}

interface MetadataEdit {
    title: string;
    description: string;
    tags: string;
}

function DownloadsContent() {
    const { confirm } = useSystemUi();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [projects, setProjects] = useState<string[]>([]);
    const [activeProject, setActiveProject] = useState<string>(searchParams.get("project") || "");

    const [files, setFiles] = useState<DownloadedFile[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Preview modal
    const [previewFile, setPreviewFile] = useState<DownloadedFile | null>(null);

    // Metadata edit modal
    const [editFile, setEditFile] = useState<DownloadedFile | null>(null);
    const [metaEdit, setMetaEdit] = useState<MetadataEdit>({ title: "", description: "", tags: "" });
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [isSendingQueue, setIsSendingQueue] = useState(false);
    const [queueAction, setQueueAction] = useState<"copy" | "move">("copy");

    const fetchProjects = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/scraper-projects`);
            if (res.ok) {
                const data = await res.json();
                const list: string[] = data.projects || [];
                setProjects(list);
                setActiveProject(prev => {
                    const fromQuery = searchParams.get("project");
                    if (fromQuery && list.includes(fromQuery)) return fromQuery;
                    if (prev && list.includes(prev)) return prev;
                    return list[0] || "";
                });
            }
        } catch (e) {
            console.error(e);
        }
    }, [searchParams]);

    const fetchDownloads = useCallback(async (projName: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/scraper-projects/${encodeURIComponent(projName)}/downloads`);
            if (res.ok) {
                const data = await res.json();
                setFiles(data.files || []);
            } else {
                setFiles([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    useEffect(() => {
        if (activeProject) {
            fetchDownloads(activeProject);
            router.replace(`/scraper/downloads?project=${activeProject}`);
        }
    }, [activeProject, fetchDownloads, router]);

    const handleDelete = async (filename: string) => {
        const confirmed = await confirm({
            title: `Delete ${filename}?`,
            description: "This downloaded file will be removed from the scraper project.",
            confirmLabel: "Delete",
            destructive: true,
        });
        if (!confirmed) return;
        try {
            const res = await fetch(
                `${getApiBase()}/scraper-projects/${encodeURIComponent(activeProject)}/downloads/${encodeURIComponent(filename)}`,
                { method: "DELETE" }
            );
            if (res.ok) {
                setFiles(files.filter(f => f.filename !== filename));
            } else {
                toast.error("Failed to delete file.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Open edit/queue modal
    const openEditModal = (file: DownloadedFile) => {
        setEditFile(file);
        setMetaEdit({
            title: file.title || "",
            description: file.description || "",
            tags: file.tags || "",
        });
    };

    // Generate AI metadata
    const handleGenerateAI = async () => {
        if (!editFile) return;
        setIsGeneratingAI(true);
        try {
            const relFile = `${activeProject}/raw_videos/${editFile.filename}`;
            const contextualPrompt = [
                `source: scraped download`,
                `channel: ${editFile.channel || "-"}`,
                `uploader: ${editFile.uploader || "-"}`,
                `duration_seconds: ${editFile.duration || 0}`,
                `view_count: ${editFile.view_count || 0}`,
            ].join("\n");
            const data = await queueBuilderApi.generateAssetMetadata({
                project_type: "video",
                file: relFile,
                title: metaEdit.title || editFile.title || "",
                description: metaEdit.description || editFile.description || "",
                tags: metaEdit.tags || editFile.tags || "",
                prompt: contextualPrompt,
            });
            setMetaEdit({
                title: data.title || metaEdit.title,
                description: data.description || metaEdit.description,
                tags: data.tags || metaEdit.tags,
            });
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate AI metadata");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // Send to Queue with metadata
    const handleQueue = async () => {
        if (!editFile) return;
        setIsSendingQueue(true);
        try {
            const res = await fetch(
                `${getApiBase()}/scraper-projects/${encodeURIComponent(activeProject)}/downloads/${encodeURIComponent(editFile.filename)}/queue`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: queueAction,
                        title: metaEdit.title,
                        description: metaEdit.description,
                        tags: metaEdit.tags,
                    }),
                }
            );
            if (res.ok) {
                toast.success("Successfully sent to Queue Builder.");
                if (queueAction === "move") {
                    setFiles(files.filter(f => f.filename !== editFile.filename));
                }
                setEditFile(null);
            } else {
                const err = await res.json();
                toast.error(err.detail || "Failed to send to queue");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSendingQueue(false);
        }
    };

    const formatDuration = (sec: number) => {
        if (!sec) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const filteredFiles = files.filter(
        f =>
            f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (f.channel || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push("/scraper")}
                        className="bg-background border-border text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" /> Project Downloads
                        </h2>
                        <p className="text-muted-foreground text-xs md:text-sm mt-1">
                            Edit metadata, generate with AI, and send assets to Queue Builder.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="bg-background border border-border rounded-md text-sm text-foreground font-medium px-3 h-10 w-48 focus:outline-none focus:border-primary"
                        value={activeProject}
                        onChange={e => setActiveProject(e.target.value)}
                    >
                        {projects.length === 0 ? (
                            <option value="">No projects</option>
                        ) : (
                            projects.map(p => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center bg-background border border-border rounded-lg px-3 py-2 w-full max-w-md">
                <Search className="w-4 h-4 text-muted-foreground mr-2" />
                <Input
                    type="text"
                    placeholder="Filter by title, channel, or filename..."
                    className="bg-transparent border-none shadow-none focus-visible:ring-0 text-sm text-foreground w-full placeholder:text-muted-foreground h-auto p-0"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* File Grid */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="text-center py-20 border border-zinc-800 border-dashed rounded-xl bg-zinc-900/30">
                    <PlayCircle className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-400 font-medium">No downloaded videos found.</p>
                    <p className="text-zinc-600 text-sm mt-1">Check another project or change your search filter.</p>
                </div>
            ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                    {filteredFiles.map((file, idx) => (
                        <div
                            key={idx}
                            className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all flex flex-col"
                        >
                            {/* Thumbnail */}
                            <div
                                className="h-32 bg-zinc-950 flex flex-col items-center justify-center p-0 relative border-b border-zinc-800 cursor-pointer overflow-hidden group/thumb"
                                onClick={() => setPreviewFile(file)}
                            >
                                {file.has_thumbnail ? (
                                    <img
                                        src={`${getApiBase()}/scraper-projects/${encodeURIComponent(activeProject)}/downloads/${encodeURIComponent(file.filename)}/thumbnail`}
                                        alt={file.title}
                                        className="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-90 transition-opacity"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center w-full h-full p-4">
                                        <PlayCircle className="w-8 h-8 text-zinc-700 mb-2" />
                                        <span className="text-[10px] font-mono text-zinc-500 truncate w-full text-center px-2">
                                            {file.filename}
                                        </span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center z-10">
                                    <div className="bg-emerald-500/90 text-white rounded-full p-2 transform scale-75 group-hover/thumb:scale-100 transition-all shadow-lg">
                                        <PlayCircle className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 flex-1 flex flex-col">
                                <h3
                                    className="text-sm font-semibold text-zinc-200 line-clamp-2 mb-2 flex-1"
                                    title={file.title}
                                >
                                    {file.title}
                                </h3>

                                <div className="space-y-1.5 mb-3 border-t border-zinc-800/50 pt-3">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-zinc-500">Channel:</span>
                                        <span className="text-zinc-300 truncate max-w-[120px] font-medium">
                                            {file.channel !== "Unknown" ? file.channel : file.uploader}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-zinc-500">Size:</span>
                                        <span className="text-emerald-400 font-medium">{file.size_mb} MB</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-zinc-500">Duration:</span>
                                        <span className="text-zinc-300">{formatDuration(file.duration)}</span>
                                    </div>
                                    {file.tags && (
                                        <div className="flex items-start gap-1 text-xs mt-1">
                                            <Tag className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
                                            <span className="text-violet-300/70 truncate">{file.tags.split(" ").slice(0, 3).join(" ")}…</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500 hover:text-white transition-colors"
                                        onClick={() => openEditModal(file)}
                                    >
                                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit & Queue
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                        onClick={() => handleDelete(file.filename)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Video Preview Modal */}
            <Dialog open={!!previewFile} onOpenChange={open => !open && setPreviewFile(null)}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-background border-border">
                    <DialogHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
                        <DialogTitle className="text-sm font-medium text-foreground line-clamp-1 flex-1 pr-4">
                            {previewFile?.title || previewFile?.filename}
                        </DialogTitle>
                        <Button variant="ghost" size="icon-sm" onClick={() => setPreviewFile(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </Button>
                    </DialogHeader>
                    <div className="w-full bg-black aspect-video">
                        {previewFile && (
                            <video
                                src={`${getApiBase()}/scraper-projects/${encodeURIComponent(activeProject)}/downloads/${encodeURIComponent(previewFile.filename)}/play`}
                                controls
                                autoPlay
                                className="w-full h-full object-contain"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Metadata & Queue Modal */}
            <Dialog open={!!editFile} onOpenChange={open => !open && setEditFile(null)}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-[580px] bg-background border-border p-0 overflow-hidden flex flex-col max-h-[90vh]">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                                <Send className="w-4 h-4 text-emerald-400" />
                                Edit Metadata &amp; Send to Queue Builder
                            </DialogTitle>
                            <Button variant="ghost" size="icon-sm" onClick={() => setEditFile(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{editFile?.filename}</p>
                    </DialogHeader>

                    <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                        {/* AI Generate Button */}
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                onClick={handleGenerateAI}
                                disabled={isGeneratingAI}
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-violet-500/20 text-xs h-8 px-4"
                            >
                                {isGeneratingAI ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        Generating…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                        Generate with AI
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Title */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                                <Type className="w-3 h-3" /> Title
                            </Label>
                            <Input
                                value={metaEdit.title}
                                onChange={e => setMetaEdit(prev => ({ ...prev, title: e.target.value }))}
                                className="bg-background border-border text-foreground text-sm h-9"
                                placeholder="Video title..."
                                maxLength={100}
                            />
                            <p className="text-[10px] text-muted-foreground text-right">{metaEdit.title.length}/100</p>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                                <AlignLeft className="w-3 h-3" /> Description
                            </Label>
                            <Textarea
                                value={metaEdit.description}
                                onChange={e => setMetaEdit(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full bg-background border-border text-foreground text-sm h-28 resize-none placeholder:text-muted-foreground"
                                placeholder="Video description..."
                                maxLength={1000}
                            />
                            <p className="text-[10px] text-muted-foreground text-right">{metaEdit.description.length}/1000</p>
                        </div>

                        {/* Tags */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                                <Tag className="w-3 h-3" /> Tags
                                <span className="text-muted-foreground/80 font-normal normal-case">space-separated, e.g. #music #viral</span>
                            </Label>
                            <Input
                                value={metaEdit.tags}
                                onChange={e => setMetaEdit(prev => ({ ...prev, tags: e.target.value }))}
                                className="bg-background border-border text-foreground text-sm h-9"
                                placeholder="#hashtag1 #hashtag2 #hashtag3"
                            />
                        </div>

                        {/* Action selector + Send */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800/60">
                            <div className="flex bg-background border border-border rounded-lg p-0.5 gap-0.5">
                                <Button
                                    size="xs"
                                    variant={queueAction === "copy" ? "default" : "ghost"}
                                    onClick={() => setQueueAction("copy")}
                                    className={`rounded-md ${
                                        queueAction === "copy"
                                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Copy to Queue
                                </Button>
                                <Button
                                    size="xs"
                                    variant={queueAction === "move" ? "default" : "ghost"}
                                    onClick={() => setQueueAction("move")}
                                    className={`rounded-md ${
                                        queueAction === "move"
                                            ? "bg-amber-600 hover:bg-amber-500 text-white"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    Move to Queue
                                </Button>
                            </div>
                            <Button
                                onClick={handleQueue}
                                disabled={isSendingQueue || !metaEdit.title.trim()}
                                className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white h-9 px-5 text-sm shadow-lg shadow-emerald-500/20"
                            >
                                {isSendingQueue ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                )}
                                Send to Queue Builder
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function DownloadsPage() {
    return (
        <Suspense fallback={<div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>}>
            <DownloadsContent />
        </Suspense>
    );
}
