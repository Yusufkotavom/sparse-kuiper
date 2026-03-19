"use client";

import { useState, useEffect, useRef } from "react";
import { getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Download, Search, Globe, Play, CheckSquare, Square, Trash2, FolderPlus, FolderOpen, Terminal as TerminalIcon } from "lucide-react";
import { toast } from "sonner";

interface ScrapedVideo {
    title: string;
    url: string;
    duration: number;
    view_count: number;
    thumbnail: string;
}

interface DownloadedFile {
    filename: string;
    title: string;
    duration: number;
    view_count: number;
    size_mb: number;
    uploader: string;
}

export default function ScraperPage() {
    // Project State
    const [projects, setProjects] = useState<string[]>([]);
    const [activeProject, setActiveProject] = useState<string>("");
    const [newProjectName, setNewProjectName] = useState("");
    
    // Scraper State
    const [scrapeUrl, setScrapeUrl] = useState("");
    const [platform, setPlatform] = useState("youtube");
    const [mediaType, setMediaType] = useState("all");
    const [scrapeLimit, setScrapeLimit] = useState(50);
    const [minViews, setMinViews] = useState<number>(0);
    const [dateAfter, setDateAfter] = useState<string>("");
    const [isScraping, setIsScraping] = useState(false);
    
    // Results State
    const [results, setResults] = useState<ScrapedVideo[]>([]);
    const [channelName, setChannelName] = useState<string>("");
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
    
    // Direct Downloader State
    const [directUrl, setDirectUrl] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadThumbnail, setDownloadThumbnail] = useState(false);

    // Initial load
    useEffect(() => {
        fetchProjects();
    }, []);

    // Load project data when active project changes
    useEffect(() => {
        loadProjectData(activeProject);
    }, [activeProject]);

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${getApiBase()}/scraper-projects`);
            if (res.ok) {
                const data = await res.json();
                const list: string[] = data.projects || [];
                setProjects(list);
                if (list.length > 0) {
                    setActiveProject(prev => prev && list.includes(prev) ? prev : list[0]);
                } else {
                    setActiveProject("");
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadProjectData = async (projName: string) => {
        if (!projName) return;
        try {
            const res = await fetch(`${getApiBase()}/scraper-projects/${encodeURIComponent(projName)}/scraped-data`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.videos || []);
                setChannelName(data.channel || "");
                setSelectedUrls(new Set());
            } else {
                setResults([]);
                setChannelName("");
            }
        } catch (e) {
             console.error(e);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        try {
            const res = await fetch(`${getApiBase()}/scraper-projects`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newProjectName.trim() })
            });
            if (res.ok) {
                setNewProjectName("");
                await fetchProjects();
                setActiveProject(newProjectName.trim());
            }
        } catch (e) {
            console.error(e);
        }
    };

    const saveScrapedData = async (videos: ScrapedVideo[], channel: string) => {
        try {
            await fetch(`${getApiBase()}/scraper-projects/${encodeURIComponent(activeProject)}/scraped-data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ videos, channel })
            });
        } catch (e) {
            console.error(e);
        }
    };

    const formatDuration = (sec: number) => {
        if (!sec) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleScrape = async () => {
        if (!scrapeUrl.trim()) return;
        setIsScraping(true);
        try {
            const res = await fetch(`${getApiBase()}/scraper/extract-info`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: scrapeUrl.trim(),
                    platform,
                    media_type: mediaType,
                    limit: scrapeLimit,
                    min_views: minViews,
                    date_after: dateAfter
                })
            });
            const data = await res.json();
            if (res.ok) {
                const newVids = data.videos || [];
                const parsedChannel = data.channel || "";
                setResults(newVids);
                setChannelName(parsedChannel);
                setSelectedUrls(new Set()); // reset selection
                await saveScrapedData(newVids, parsedChannel);
            } else {
                toast.error(data.detail || data.message || "Failed to scrape");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to connect to backend");
        } finally {
            setIsScraping(false);
        }
    };

    const toggleSelection = (url: string) => {
        const next = new Set(selectedUrls);
        if (next.has(url)) next.delete(url);
        else next.add(url);
        setSelectedUrls(next);
    };

    const toggleAll = () => {
        if (selectedUrls.size === results.length) setSelectedUrls(new Set());
        else setSelectedUrls(new Set(results.map(v => v.url)));
    };

    const handleBatchDownload = async () => {
        if (selectedUrls.size === 0) return;
        setIsDownloading(true);
        try {
            const res = await fetch(`${getApiBase()}/scraper/download-batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    urls: Array.from(selectedUrls),
                    project_name: activeProject || "Scraped_Downloads",
                    download_thumbnail: downloadThumbnail
                })
            });
            if (res.ok) {
                toast.success(`Started downloading ${selectedUrls.size} videos to video_projects/${activeProject || "Scraped_Downloads"}.`);
            } else {
                toast.error("Failed to start batch download");
            }
        } catch (e) {
            console.error(e);
        } finally {
             setIsDownloading(false);
        }
    };

    const handleDirectDownload = async () => {
        if (!directUrl.trim()) return;
        setIsDownloading(true);
        try {
             const res = await fetch(`${getApiBase()}/scraper/download`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: directUrl.trim(),
                    project_name: activeProject || "Scraped_Downloads",
                    download_thumbnail: downloadThumbnail
                })
            });
            if (res.ok) {
                 toast.success(`Started downloading video to video_projects/${activeProject || "Scraped_Downloads"}.`);
                 setDirectUrl("");
            } else {
                 toast.error("Failed to start download");
            }
        } catch (e) {
             console.error(e);
        } finally {
             setIsDownloading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Globe className="w-6 h-6 text-violet-400" /> Web Scraper & Downloader
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">Extract links, playlists, and bulk download videos mapped straight to video_projects.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Project Selector */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
                            <FolderOpen className="w-4 h-4 text-muted-foreground ml-2" />
                            <select 
                                className="bg-transparent text-sm text-foreground font-medium focus:outline-none w-40 h-8"
                                value={activeProject}
                                onChange={(e) => setActiveProject(e.target.value)}
                            >
                                {projects.length === 0 ? (
                                    <option value="" className="bg-surface">No projects</option>
                                ) : (
                                    projects.map(p => (
                                        <option key={p} value={p} className="bg-surface">{p}</option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div className="flex items-center gap-1">
                            <Input 
                                placeholder="New Project..." 
                                className="h-10 w-32 bg-background border-border text-xs"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                            />
                            <Button variant="outline" size="sm" className="h-10 bg-background border-border hover:text-violet-400 hover:border-violet-500/50" onClick={handleCreateProject}>
                                <FolderPlus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    
                    <Button 
                        onClick={() => window.location.href = `/scraper/downloads?project=${activeProject}`}
                        className="bg-success/15 text-success border border-success/30 hover:bg-success hover:text-white transition-colors h-10 w-full sm:w-auto"
                    >
                        <FolderOpen className="w-4 h-4 mr-2" /> Manage Downloaded Files
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Direct Downloader Card (Left column - useful for quick tasks) */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-surface border-border">
                        <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-base text-violet-400 flex items-center gap-2">
                                <Download className="w-4 h-4" /> Quick Download
                            </CardTitle>
                            <CardDescription className="text-xs">Download any single video URL instantly without scraping.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Video URL</Label>
                                <Input 
                                    placeholder="https://www.tiktok.com/@user/video/..." 
                                    className="bg-background border-border"
                                    value={directUrl}
                                    onChange={e => setDirectUrl(e.target.value)}
                                    disabled={isDownloading}
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <input type="checkbox" id="direct-thumb" checked={downloadThumbnail} onChange={e => setDownloadThumbnail(e.target.checked)} className="rounded border-border bg-background"/>
                                <label htmlFor="direct-thumb" className="text-xs text-muted-foreground">Download High-Res Thumbnail</label>
                            </div>
                            <Button 
                                onClick={handleDirectDownload}
                                disabled={isDownloading || !directUrl.trim()}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                            >
                                {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                Download Instantly
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Scraper Card (Middle & Right columns) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-surface border-border">
                        <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-start justify-between">
                            <div>
                                <CardTitle className="text-base text-foreground flex items-center gap-2">
                                    <Search className="w-4 h-4 text-violet-400" /> Channel & Playlist Scraper
                                </CardTitle>
                                <CardDescription className="text-xs">Extract links first, then select what to download.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex-1 space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Target URL</Label>
                                    <Input 
                                        placeholder="Channel or Playlist URL..." 
                                        className="bg-background border-border"
                                        value={scrapeUrl}
                                        onChange={e => setScrapeUrl(e.target.value)}
                                    />
                                </div>
                                <div className="w-full md:w-32 space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Platform</Label>
                                    <select 
                                        className="w-full h-9 rounded-md bg-background border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary"
                                        value={platform}
                                        onChange={e => setPlatform(e.target.value)}
                                    >
                                        <option value="youtube">YouTube</option>
                                        <option value="tiktok">TikTok</option>
                                        <option value="instagram">Instagram</option>
                                        <option value="facebook">Facebook</option>
                                        <option value="custom">Other/Auto</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-3">
                                {platform === "youtube" && (
                                    <div className="flex-1 space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Media Type (YT Filter)</Label>
                                        <select 
                                            className="w-full h-9 rounded-md bg-background border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary"
                                            value={mediaType}
                                            onChange={e => setMediaType(e.target.value)}
                                        >
                                            <option value="all">All Items</option>
                                            <option value="shorts">Shorts Only</option>
                                            <option value="videos">Long-form Videos Only</option>
                                        </select>
                                    </div>
                                )}
                                <div className="w-full md:w-32 space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Max Items</Label>
                                    <Input 
                                        type="number"
                                        className="bg-background border-border"
                                        value={scrapeLimit}
                                        onChange={e => setScrapeLimit(parseInt(e.target.value) || 50)}
                                    />
                                </div>
                                <div className="w-full md:w-32 space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Min Views</Label>
                                    <Input 
                                        type="number"
                                        className="bg-background border-border"
                                        value={minViews || ""}
                                        placeholder="0"
                                        onChange={e => setMinViews(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="w-full md:w-40 space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Uploaded After</Label>
                                    <Input 
                                        type="date"
                                        className="bg-background border-border"
                                        value={dateAfter}
                                        onChange={e => setDateAfter(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <Button 
                                onClick={handleScrape} 
                                disabled={isScraping || !scrapeUrl}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                            >
                                {isScraping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                                Extract Links
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Results Table */}
                    {results.length > 0 && (
                        <div className="border border-border rounded-xl overflow-hidden bg-surface/50">
                            <div className="p-3 border-b border-border bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Target Folder:</span>
                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">{activeProject}</span>
                                    {channelName && <span className="text-xs text-muted-foreground ml-1 sm:ml-2">Channel: {channelName}</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                    <div className="flex items-center gap-2 mr-2">
                                        <input type="checkbox" id="batch-thumb" checked={downloadThumbnail} onChange={e => setDownloadThumbnail(e.target.checked)} className="rounded border-border bg-background accent-violet-600"/>
                                        <label htmlFor="batch-thumb" className="text-xs text-muted-foreground">Include Thumbnail</label>
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">{selectedUrls.size}/{results.length} selected</span>
                                    <div className="flex gap-2 w-full sm:w-auto ml-auto">
                                        <Button size="sm" variant="outline" onClick={toggleAll} className="h-7 text-xs border-border bg-background flex-1 sm:flex-none">
                                            Select All
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            onClick={handleBatchDownload}
                                            disabled={selectedUrls.size === 0 || isDownloading}
                                            className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white flex-1 sm:flex-none"
                                        >
                                            <Download className="w-3.5 h-3.5 mr-1.5" /> Start Download
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto">
                                {results.map((vid, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`flex items-center gap-4 p-3 border-b border-border hover:bg-elevated/60 cursor-pointer transition-colors ${selectedUrls.has(vid.url) ? 'bg-violet-500/5 border-l-2 border-l-violet-500' : 'border-l-2 border-l-transparent'}`}
                                        onClick={() => toggleSelection(vid.url)}
                                    >
                                        <div className="text-muted-foreground">
                                            {selectedUrls.has(vid.url) ? <CheckSquare className="w-5 h-5 text-violet-500" /> : <Square className="w-5 h-5" />}
                                        </div>
                                        <div className="w-20 h-12 bg-elevated rounded flex-shrink-0 overflow-hidden relative">
                                            {vid.thumbnail ? (
                                                <img src={vid.thumbnail} alt="thumb" className="w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><Play className="w-4 h-4 text-muted-foreground" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-foreground truncate font-medium">{vid.title || "Untitled Video"}</p>
                                            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                                <span>Duration: {formatDuration(vid.duration)}</span>
                                                {vid.view_count > 0 && <span>Views: {vid.view_count.toLocaleString()}</span>}
                                                <a href={vid.url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline inline-block truncate max-w-[150px] sm:max-w-[200px]" onClick={e => e.stopPropagation()}>{vid.url}</a>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
