import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Send, ExternalLink } from "lucide-react";
import { publisherApi } from "@/lib/api";

interface ProjectDrawerProps {
    open: boolean;
    onClose: () => void;
    projectType: "video" | "kdp";
    file: string;
    titleHint?: string;
    previewUrl?: string;
    onEnqueue?: () => Promise<void>;
}

export function ProjectDrawer({ open, onClose, projectType, file, titleHint, previewUrl, onEnqueue }: ProjectDrawerProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [saving, setSaving] = useState(false);
    const [enqueueing, setEnqueueing] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            try {
                const db = await publisherApi.getAssetMetadata(projectType, file);
                if (!cancelled) {
                    setTitle(db.title || "");
                    setDescription(db.description || "");
                    setTags(db.tags || "");
                }
            } catch {
                if (!cancelled) {
                    setTitle(titleHint || "");
                }
            }
        })();
        return () => { cancelled = true; };
    }, [open, projectType, file, titleHint]);

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => {
            const hasAny = (title && title.trim()) || (description && description.trim()) || (tags && tags.trim());
            if (!hasAny) return;
            setSaving(true);
            publisherApi.setAssetMetadata(projectType, file, { title, description, tags })
                .finally(() => setSaving(false));
        }, 800);
        return () => clearTimeout(t);
    }, [title, description, tags, open, projectType, file]);

    if (!open) return null;

    const isImageFile = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file);
    const isVideoFile = /\.(mp4|mov|webm|m4v|avi)$/i.test(file);

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="absolute right-0 top-0 h-full w-full max-w-[1200px] bg-surface border-l border-border shadow-2xl flex flex-col">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{projectType}</p>
                        <h3 className="truncate text-lg font-semibold text-foreground">{file}</h3>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                        <div className="xl:col-span-3 space-y-3">
                            {previewUrl ? (
                                <>
                                    <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-black">
                                        {projectType === "kdp" || isImageFile ? (
                                            <img src={previewUrl} alt={file} className="h-full w-full object-contain" />
                                        ) : isVideoFile ? (
                                            <video src={previewUrl} controls className="h-full w-full object-contain" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                                                Preview not available
                                            </div>
                                        )}
                                    </div>
                                    <a
                                        href={previewUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center text-xs text-primary hover:underline"
                                    >
                                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                        Open Preview in New Tab
                                    </a>
                                </>
                            ) : (
                                <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-elevated flex items-center justify-center text-sm text-muted-foreground">
                                    Preview not available
                                </div>
                            )}
                        </div>

                        <div className="xl:col-span-2 space-y-3">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
                                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={7} placeholder="Description" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</label>
                                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#tags" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    <div className="text-xs text-muted-foreground">{saving ? "Saving..." : "Saved"}</div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                            setSaving(true);
                            publisherApi.setAssetMetadata(projectType, file, { title, description, tags })
                                .finally(() => setSaving(false));
                        }}>
                            <Save className="mr-1.5 h-4 w-4" /> Save
                        </Button>
                        {onEnqueue ? (
                            <Button size="sm" onClick={async () => {
                                if (!title) return;
                                setEnqueueing(true);
                                try {
                                    await publisherApi.setAssetMetadata(projectType, file, { title, description, tags });
                                    await onEnqueue();
                                } finally {
                                    setEnqueueing(false);
                                }
                            }} disabled={!title || enqueueing}>
                                <Send className="mr-1.5 h-4 w-4" /> Add to Queue
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
