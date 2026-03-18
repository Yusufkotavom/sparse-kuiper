"use client";
 
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, Suspense } from "react";
import { publisherApi, accountsApi, Account } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Share2, Video as VideoIcon, RefreshCw, Youtube, Instagram, Facebook, CalendarClock, Package, User } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { cn } from "@/lib/utils";
import { supabase, subscribeToRealtimeStream, type RealtimeEventRecord } from "@/lib/supabase";

import { getApiBase } from "@/lib/api";
const STATIC_BASE = () => `${getApiBase()}/upload_queue_static/`;

type PlatformStatus = { status: string; message: string; timestamp: string };
type QueueItem = {
    filename: string;
    status: string;
    platforms: Record<string, PlatformStatus>;
    metadata?: { title?: string; description?: string; tags?: string };
};

function PublisherContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [platforms, setPlatforms] = useState({
        tiktok: false, youtube: false, instagram: false, facebook: false
    });

    const [tiktokAccountId, setTiktokAccountId] = useState("");
    const [youtubeAccountId, setYoutubeAccountId] = useState("");
    const [facebookAccountId, setFacebookAccountId] = useState("");
    const [instagramAccountId, setInstagramAccountId] = useState("");
    const [accounts, setAccounts] = useState<Account[]>([]);

    // YouTube specific state
    const [youtubePrivacy, setYoutubePrivacy] = useState("private");
    const [youtubeCategoryId, setYoutubeCategoryId] = useState("22");

    // Schedule & product
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
    const [postsPerDay, setPostsPerDay] = useState<number>(3);
    const [timeGapHours, setTimeGapHours] = useState<number>(4);
    const [productId, setProductId] = useState("");
    const [openBrowser, setOpenBrowser] = useState(false);
    const [pwDebug, setPwDebug] = useState(false);

    const [isUploading, setIsUploading] = useState(false);
    const filesFromQuery = useMemo(() => searchParams.getAll("file"), [searchParams]);
    const selectedQueueItems = useMemo(
        () => selectedFiles.map((filename) => queue.find((item) => item.filename === filename)).filter(Boolean) as QueueItem[],
        [queue, selectedFiles]
    );
    const activePlatformCount = useMemo(() => Object.values(platforms).filter(Boolean).length, [platforms]);

    useEffect(() => {
        const ensureAuthAndLoad = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                router.replace("/login");
                return;
            }
            await loadQueue();
            await loadAccounts();
        };
        ensureAuthAndLoad();
    }, [router]);

    useEffect(() => {
        const subscription = subscribeToRealtimeStream("upload_queue", (event: RealtimeEventRecord) => {
            const payload = event.payload as QueueItem;
            if (!payload?.filename) return;

            setQueue((prev) => {
                if (event.event_type === "deleted") {
                    return prev.filter((item) => item.filename !== payload.filename);
                }

                const next = [...prev];
                const index = next.findIndex((item) => item.filename === payload.filename);
                if (index >= 0) {
                    next[index] = { ...next[index], ...payload };
                } else {
                    next.unshift(payload);
                }
                return next;
            });
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        setSelectedFiles((prev) => {
            if (prev.length === filesFromQuery.length && prev.every((item, index) => item === filesFromQuery[index])) {
                return prev;
            }
            return filesFromQuery;
        });
    }, [filesFromQuery]);

    useEffect(() => {
        if (selectedFiles.length !== 1) return;
        const queueItem = queue.find((item) => item.filename === selectedFiles[0]);
        if (!queueItem?.metadata) return;
        setTitle((prev) => prev || queueItem.metadata?.title || "");
        setDescription((prev) => prev || queueItem.metadata?.description || "");
        setTags((prev) => prev || queueItem.metadata?.tags || "");
    }, [selectedFiles, queue]);

    const loadQueue = async () => {
        setIsLoading(true);
        try {
            const data = await publisherApi.getQueue();
            setQueue(data.queue);
        } catch (e) {
            console.error("Failed to load queue", e);
        } finally {
            setIsLoading(false);
        }
    };

    const loadAccounts = async () => {
        try {
            const data = await accountsApi.getAccounts();
            setAccounts(data.accounts || []);
        } catch (e) {
            console.error("Failed to load accounts", e);
        }
    };

    const tiktokAccounts = accounts.filter(a => a.platform === "tiktok");
    const youtubeAccounts = accounts.filter(a => a.platform === "youtube");
    const facebookAccounts = accounts.filter(a => a.platform === "facebook");
    const instagramAccounts = accounts.filter(a => a.platform === "instagram");

    const handlePlatformToggle = (platform: keyof typeof platforms) => {
        setPlatforms(prev => ({ ...prev, [platform]: !prev[platform] }));
    };

    const handlePublish = async () => {
        if (selectedFiles.length === 0) return;

        const selectedPlatforms = Object.entries(platforms)
            .filter(([, v]) => v)
            .map(([p]) => p as keyof typeof platforms);

        if (selectedPlatforms.length === 0) {
            alert("Please select at least one platform.");
            return;
        }
        if (platforms.tiktok && !tiktokAccountId) {
            alert("Please select a TikTok account.");
            return;
        }
        if (platforms.youtube && !youtubeAccountId) {
            alert("Please select a YouTube account.");
            return;
        }
        if (platforms.facebook && !facebookAccountId) {
            alert("Please select a Facebook account.");
            return;
        }
        if (platforms.instagram && !instagramAccountId) {
            alert("Please select an Instagram account.");
            return;
        }

        let scheduleIso = "";
        if (scheduleEnabled && scheduleDate) {
            const dt = new Date(scheduleDate);
            const minFuture = new Date(Date.now() + 20 * 60 * 1000); // 20 min from now
            const maxFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days
            if (dt < minFuture) {
                alert("Scheduled time must be at least 20 minutes in the future.");
                return;
            }
            if (dt > maxFuture) {
                alert("Scheduled time cannot be more than 10 days in the future.");
                return;
            }
            scheduleIso = scheduleDate.toISOString();
        }

        setIsUploading(true);
        try {
            if (selectedFiles.length === 1) {
                // Single Upload
                await publisherApi.triggerUpload(selectedFiles[0], {
                    title,
                    description,
                    tags,
                    platforms: selectedPlatforms,
                    account_id: platforms.tiktok ? tiktokAccountId
                        : (platforms.youtube ? youtubeAccountId
                        : (platforms.facebook ? facebookAccountId
                        : (platforms.instagram ? instagramAccountId : ""))),
                    schedule: scheduleIso,
                    product_id: productId,
                    youtube_privacy: youtubePrivacy,
                    youtube_category_id: youtubeCategoryId,
                    open_browser: openBrowser,
                    pw_debug: pwDebug,
                });
                alert(`✅ Upload started for 1 video.`);
            } else {
                // Batch Upload
                if (selectedPlatforms.length > 1) {
                    alert("Bulk upload is currently only supported when selecting exactly ONE platform.");
                    setIsUploading(false);
                    return;
                }
                
                const videos = selectedFiles.map((filename, idx) => {
                    let videoScheduleIso = scheduleIso;
                    
                    if (scheduleEnabled && scheduleDate) {
                        const baseDate = new Date(scheduleDate);
                        const daysToAdd = Math.floor(idx / postsPerDay);
                        const postsToday = idx % postsPerDay;
                        
                        const curDate = new Date(baseDate.getTime());
                        curDate.setDate(curDate.getDate() + daysToAdd);
                        curDate.setHours(curDate.getHours() + (postsToday * timeGapHours));
                        
                        videoScheduleIso = curDate.toISOString();
                    }

                    const qItem = queue.find(q => q.filename === filename);
                    let finalTitle = title;
                    let finalDesc = description;
                    let finalTags = tags;

                    if (selectedFiles.length > 1 && qItem?.metadata) {
                        finalTitle = qItem.metadata.title || title;
                        finalDesc = qItem.metadata.description || description;
                        
                        const itemTags = qItem.metadata.tags || "";
                        const combinedTags = [...itemTags.split(" "), ...tags.split(" ")]
                            .map(t => t.trim())
                            .filter(Boolean);
                        finalTags = Array.from(new Set(combinedTags)).join(" ");
                    }

                    return {
                        filename,
                        title: finalTitle,
                        description: finalDesc,
                        tags: finalTags,
                        schedule: videoScheduleIso,
                        product_id: productId,
                        youtube_privacy: youtubePrivacy,
                        youtube_category_id: youtubeCategoryId,
                        open_browser: openBrowser,
                    };
                });
                
                await publisherApi.triggerBatchUpload({
                    videos,
                    platforms: selectedPlatforms,
                    account_id: platforms.tiktok ? tiktokAccountId
                        : (platforms.youtube ? youtubeAccountId
                        : (platforms.facebook ? facebookAccountId
                        : (platforms.instagram ? instagramAccountId : ""))),
                    open_browser: openBrowser,
                    pw_debug: pwDebug
                });
                alert(`✅ Batch upload started for ${selectedFiles.length} videos!`);
            }
            setSelectedFiles([]);
            loadQueue();
        } catch (e) {
            console.error("Failed to trigger upload", e);
            alert("Failed to queue upload.");
        } finally {
            setIsUploading(false);
        }
    };

    const selectCls = "w-full bg-background border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary transition-colors";

    return (
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 sm:px-6 sm:py-6">
            <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
                    <Share2 className="w-6 h-6 text-violet-400" />
                    Social Media Publisher
                </h2>
                <p className="mt-1 text-sm text-zinc-400">Upload videos to TikTok and other platforms using your saved accounts.</p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <div className="text-xs text-zinc-400">
                    {isLoading ? "Loading queue source..." : `Loaded ${queue.length} queue items as source data`}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1">
                            Selected: <span className="font-semibold text-zinc-100">{selectedFiles.length}</span>
                        </span>
                        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1">
                            Platforms: <span className="font-semibold text-zinc-100">{activePlatformCount}</span>
                        </span>
                        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1">
                            Mode: <span className="font-semibold text-zinc-100">{selectedFiles.length > 1 ? "Bulk" : "Single"}</span>
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button variant="outline" size="sm" onClick={loadQueue} disabled={isLoading}>
                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh Queue Data
                    </Button>
                    <Link href="/runs?intent=publisher" className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Open Runs
                    </Link>
                </div>
            </div>

            {selectedFiles.length === 0 ? (
                <Card className="bg-zinc-900/50 border-zinc-800/50 h-full flex items-center justify-center min-h-[300px]">
                    <CardContent className="flex flex-col items-center justify-center text-zinc-500 space-y-4">
                        <VideoIcon className="w-12 h-12 opacity-20" />
                        <p className="text-sm text-center">Belum ada file dipilih untuk dipublish. Pilih dulu dari Runs untuk lanjut ke Publisher.</p>
                        <Link href="/runs?intent=publisher" className={cn(buttonVariants({ size: "sm" }))}>
                            Pilih dari Runs
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <Card className="overflow-hidden border-zinc-800 bg-zinc-900 shadow-xl">
                            {/* Preview */}
                            <div className="relative flex aspect-video w-full items-center justify-center border-b border-zinc-800 bg-black">
                                {selectedFiles.length === 1 ? (
                                    <video
                                        src={`${getApiBase()}/publisher/queue/video/${encodeURIComponent(selectedFiles[0])}`}
                                        className="w-full h-full object-contain"
                                        controls
                                        autoPlay
                                        loop
                                    />
                                ) : (
                                    <div className="flex flex-col items-center px-4 text-center text-zinc-500">
                                        <Package className="w-12 h-12 mb-3 opacity-40" />
                                        <p className="text-sm font-medium">Batch Publishing ({selectedFiles.length} videos)</p>
                                        <p className="mt-1 text-xs text-zinc-400">Metadata global akan dipakai sebagai fallback, lalu setiap item tetap mempertahankan metadata queue jika tersedia.</p>
                                    </div>
                                )}
                            </div>

                            <CardHeader className="pb-2">
                                <CardTitle className="text-base text-white font-mono break-all pb-1">
                                    {selectedFiles.length === 1 ? selectedFiles[0] : `${selectedFiles.length} Videos Selected`}
                                </CardTitle>
                                <CardDescription>Configure metadata, account, and publishing options.</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-5">
                                <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Selected Assets</p>
                                        <span className="text-[11px] text-zinc-400">{selectedFiles.length} selected</span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedFiles.slice(0, 8).map((file) => (
                                            <span key={file} className="max-w-full truncate rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300">
                                                {file}
                                            </span>
                                        ))}
                                        {selectedFiles.length > 8 ? (
                                            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400">
                                                +{selectedFiles.length - 8} more
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="mt-3 text-[11px] text-zinc-500">
                                        Queue metadata detected on <span className="font-semibold text-zinc-300">{selectedQueueItems.filter((item) => item.metadata?.title || item.metadata?.description || item.metadata?.tags).length}</span> of{" "}
                                        <span className="font-semibold text-zinc-300">{selectedFiles.length}</span> selected files.
                                    </p>
                                </div>

                                {/* Metadata */}
                                <div className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Metadata</p>
                                    <Input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="Video title..."
                                        className="bg-background border-border"
                                    />
                                    <Textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Description..."
                                        className="h-20 resize-none bg-background border-border"
                                    />
                                    <Input
                                        type="text"
                                        value={tags}
                                        onChange={e => setTags(e.target.value)}
                                        placeholder="#fyp #viral #trending"
                                        className="font-mono bg-background border-border"
                                    />
                                </div>

                                {/* Platform Selection */}
                                <div className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Platforms</p>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {[
                                            { key: 'tiktok', label: 'TikTok', color: 'border-cyan-400 text-cyan-400' },
                                            { key: 'youtube', label: 'YouTube', color: 'border-red-500 text-red-500' },
                                            { key: 'instagram', label: 'Reels', color: 'border-pink-500 text-pink-500' },
                                            { key: 'facebook', label: 'Facebook', color: 'border-blue-500 text-blue-500' },
                                        ].map(({ key, label, color }) => (
                                            <Button
                                                key={key}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePlatformToggle(key as keyof typeof platforms)}
                                                className={`h-auto min-h-11 rounded-xl py-3 text-sm font-bold transition-all ${platforms[key as keyof typeof platforms]
                                                    ? `bg-zinc-800/80 ${color}`
                                                    : 'bg-background border-border text-muted-foreground hover:border-border-hover'}`}
                                            >
                                                {label}
                                            </Button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-zinc-500">Tip: untuk bulk upload saat ini paling aman pilih satu platform dulu agar schedule dan retry lebih konsisten.</p>
                                </div>

                                {/* TikTok Account Selector — shown when TikTok is selected */}
                                {platforms.tiktok && (
                                    <div className="space-y-2 p-4 bg-cyan-950/20 border border-cyan-900/40 rounded-xl">
                                        <p className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5" /> TikTok Account
                                        </p>
                                        {tiktokAccounts.length === 0 ? (
                                            <p className="text-xs text-zinc-500 italic">No TikTok accounts found. Add one in <a href="/accounts" className="text-cyan-400 underline">Account Management</a>.</p>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {tiktokAccounts.map(acc => (
                                                    <button key={acc.id}
                                                        onClick={() => setTiktokAccountId(acc.id!)}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${tiktokAccountId === acc.id
                                                            ? 'bg-cyan-900/30 border-cyan-400 text-cyan-300'
                                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                                                    >
                                                        <span className="font-medium">@{acc.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${acc.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                                                            {acc.status === 'active' ? '● Active' : '○ Needs Login'}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* YouTube Account Selector — shown when YouTube is selected */}
                                {platforms.youtube && (
                                    <div className="space-y-4 p-4 bg-red-950/20 border border-red-900/40 rounded-xl">
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-red-300 flex items-center gap-1.5">
                                                <Youtube className="w-3.5 h-3.5" /> YouTube Channel
                                            </p>
                                            {youtubeAccounts.length === 0 ? (
                                                <p className="text-xs text-zinc-500 italic">No YouTube accounts found. Add one in <a href="/accounts" className="text-red-400 underline">Account Management</a>.</p>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {youtubeAccounts.map(acc => (
                                                        <button key={acc.id}
                                                            onClick={() => setYoutubeAccountId(acc.id!)}
                                                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${youtubeAccountId === acc.id
                                                                ? 'bg-red-900/30 border-red-400 text-red-300'
                                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                                                        >
                                                            <span className="font-medium">
                                                                {acc.channel_title || `@${acc.name}`}
                                                                <span className="ml-2 text-[10px] text-zinc-500 font-mono">({acc.auth_method})</span>
                                                            </span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${acc.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                                                                {acc.status === 'active' ? '● Active' : '○ Needs Login'}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 border-t border-red-900/20 pt-2 sm:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium text-muted-foreground">Privacy Status</Label>
                                                <select
                                                    value={youtubePrivacy}
                                                    onChange={e => setYoutubePrivacy(e.target.value)}
                                                    className={selectCls}
                                                >
                                                    <option value="private">Private</option>
                                                    <option value="unlisted">Unlisted</option>
                                                    <option value="public">Public</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                                                <select
                                                    value={youtubeCategoryId}
                                                    onChange={e => setYoutubeCategoryId(e.target.value)}
                                                    className={selectCls}
                                                >
                                                    <option value="1">Film & Animation</option>
                                                    <option value="10">Music</option>
                                                    <option value="20">Gaming</option>
                                                    <option value="22">People & Blogs</option>
                                                    <option value="23">Comedy</option>
                                                    <option value="24">Entertainment</option>
                                                    <option value="26">Howto & Style</option>
                                                    <option value="27">Education</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Facebook Account Selector — shown when Facebook is selected */}
                                {platforms.facebook && (
                                    <div className="space-y-4 p-4 bg-blue-950/20 border border-blue-900/40 rounded-xl">
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-blue-300 flex items-center gap-1.5">
                                                <Facebook className="w-3.5 h-3.5" /> Facebook Page
                                            </p>
                                            {facebookAccounts.length === 0 ? (
                                                <p className="text-xs text-zinc-500 italic">No Facebook accounts found. Connect one in <a href="/accounts" className="text-blue-400 underline">Account Management</a>.</p>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {facebookAccounts.map(acc => (
                                                        <button key={acc.id}
                                                            onClick={() => setFacebookAccountId(acc.id!)}
                                                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${facebookAccountId === acc.id
                                                                ? 'bg-blue-900/30 border-blue-400 text-blue-300'
                                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                                                        >
                                                            <span className="font-medium">{acc.channel_title || `@${acc.name}`}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${acc.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                                                                {acc.status === 'active' ? '● Connected' : '○ Needs Auth'}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Instagram Account Selector — shown when Instagram is selected */}
                                {platforms.instagram && (
                                    <div className="space-y-2 p-4 bg-pink-950/20 border border-pink-900/40 rounded-xl">
                                        <p className="text-xs font-medium text-pink-300 flex items-center gap-1.5">
                                            <Instagram className="w-3.5 h-3.5" /> Instagram Account
                                        </p>
                                        {instagramAccounts.length === 0 ? (
                                            <p className="text-xs text-zinc-500 italic">No Instagram accounts found. Add one in <a href="/accounts" className="text-pink-400 underline">Account Management</a>.</p>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {instagramAccounts.map(acc => (
                                                    <button key={acc.id}
                                                        onClick={() => setInstagramAccountId(acc.id!)}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${instagramAccountId === acc.id
                                                            ? 'bg-pink-900/30 border-pink-400 text-pink-300'
                                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                                                    >
                                                        <span className="font-medium">@{acc.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${acc.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                                                            {acc.status === 'active' ? '● Active' : '○ Needs Login'}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Schedule Toggle */}
                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setScheduleEnabled(v => !v)}
                                        className={`justify-start text-xs ${scheduleEnabled ? 'bg-amber-900/20 border-amber-600 text-amber-300 hover:bg-amber-900/30' : 'text-muted-foreground hover:bg-surface'}`}
                                    >
                                        <CalendarClock className="w-4 h-4" />
                                        {scheduleEnabled ? '⏰ Scheduled Post' : 'Schedule for Later (Optional)'}
                                    </Button>

                                    {scheduleEnabled && (
                                        <div className="space-y-3 pl-1">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground mb-1">Start Date (UTC+0) · Must be 20 min – 10 days in the future</p>
                                                <DatePicker
                                                    selected={scheduleDate}
                                                    onChange={(date: Date | null) => setScheduleDate(date)}
                                                showMonthDropdown
                                                showYearDropdown
                                                dropdownMode="select"
                                                    showTimeSelect
                                                    timeIntervals={15}
                                                    dateFormat="MM/dd/yyyy HH:mm"
                                                    placeholderText="mm/dd/yyyy --:--"
                                                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-amber-300 outline-none focus:border-primary"
                                                    wrapperClassName="w-full"
                                                    minDate={new Date()}
                                                popperClassName="datepicker-popper-high"
                                                />
                                            </div>
                                            
                                            {selectedFiles.length > 1 && (
                                                <div className="grid grid-cols-1 gap-3 border-t border-zinc-800/50 pt-2 sm:grid-cols-2">
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground mb-1 block">Posts Per Day</Label>
                                                        <Input
                                                            type="number" 
                                                            min="1" 
                                                            max="10" 
                                                            value={postsPerDay} 
                                                            onChange={e => setPostsPerDay(parseInt(e.target.value) || 1)}
                                                            className="h-8 bg-background border-border"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground mb-1 block">Time Gap (Hours)</Label>
                                                        <Input
                                                            type="number" 
                                                            min="1" 
                                                            max="24" 
                                                            value={timeGapHours} 
                                                            onChange={e => setTimeGapHours(parseInt(e.target.value) || 1)}
                                                            className="h-8 bg-background border-border"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Product ID */}
                                {platforms.tiktok && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5" /> Product Link ID
                                            <span className="text-muted-foreground/70 font-normal">(optional)</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            value={productId}
                                            onChange={e => setProductId(e.target.value)}
                                            placeholder="e.g. 1234567890123456789"
                                            className="font-mono bg-background border-border"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Get this from TikTok Creator Studio → Add Link → Product</p>
                                    </div>
                                )}

                                {(platforms.tiktok || platforms.youtube) && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 p-3 bg-cyan-950/20 border border-cyan-900/30 rounded-lg">
                                            <input
                                                id="tiktokDebugOpen"
                                                type="checkbox"
                                                checked={openBrowser}
                                                onChange={e => setOpenBrowser(e.target.checked)}
                                                className="accent-cyan-400 w-4 h-4"
                                            />
                                            <label htmlFor="tiktokDebugOpen" className="text-xs text-zinc-400 cursor-pointer select-none">
                                                Open browser window during upload (visible mode)
                                            </label>
                                        </div>
                                        {openBrowser && (
                                            <div className="ml-0 flex items-center gap-2 rounded-lg border border-amber-900/30 bg-amber-950/20 p-3 sm:ml-4">
                                                <input
                                                    id="pwDebugToggle"
                                                    type="checkbox"
                                                    checked={pwDebug}
                                                    onChange={e => setPwDebug(e.target.checked)}
                                                    className="accent-amber-400 w-4 h-4"
                                                />
                                                <label htmlFor="pwDebugToggle" className="text-xs text-zinc-400 cursor-pointer select-none">
                                                    🔍 Enable Playwright Inspector (step-by-step debugging)
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Publish Button */}
                                <div className="sticky bottom-0 -mx-3 rounded-t-xl border-t border-zinc-800 bg-zinc-950/95 px-3 pb-1 pt-3 backdrop-blur sm:static sm:mx-0 sm:rounded-none sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0">
                                    <div className="mb-3 grid gap-2 text-[11px] text-zinc-400 sm:grid-cols-3">
                                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                                            Files: <span className="font-semibold text-zinc-100">{selectedFiles.length}</span>
                                        </div>
                                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                                            Platforms: <span className="font-semibold text-zinc-100">{activePlatformCount}</span>
                                        </div>
                                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                                            Schedule: <span className="font-semibold text-zinc-100">{scheduleEnabled && scheduleDate ? new Date(scheduleDate).toLocaleString() : "None"}</span>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handlePublish}
                                        disabled={isUploading || Object.values(platforms).every(v => !v)}
                                        className="h-12 w-full bg-violet-600 font-bold text-white shadow-lg shadow-violet-900/20 hover:bg-violet-700"
                                    >
                                        {isUploading ? (
                                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</>
                                        ) : (
                                            <><Share2 className="w-5 h-5 mr-2" /> {scheduleEnabled ? 'Schedule Upload' : 'Publish Now'}</>
                                        )}
                                    </Button>

                                    {scheduleEnabled && scheduleDate && (
                                        <p className="mt-2 text-center text-xs text-amber-400/70">
                                            Will post at {new Date(scheduleDate).toLocaleString()} (your local time)
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function PublisherPage() {
    return (
        <Suspense fallback={<div className="p-6 max-w-7xl mx-auto text-zinc-400 text-sm">Loading...</div>}>
            <PublisherContent />
        </Suspense>
    );
}
