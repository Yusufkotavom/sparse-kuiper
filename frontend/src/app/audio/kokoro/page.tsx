"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Info, Play, Square, Loader2, Volume2 } from "lucide-react";

const KOKORO_URL = process.env.NEXT_PUBLIC_KOKORO_URL || "http://localhost:7860";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function KokoroPage() {
    const [iframeSrc, setIframeSrc] = useState(KOKORO_URL);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [key, setKey] = useState(0);
    const [status, setStatus] = useState<"running" | "stopped" | "starting" | "stopping" | "unknown">("unknown");
    const [isActionLoading, setIsActionLoading] = useState(false);

    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/services/status/kokoro`);
            const data = await res.json();
            setStatus(data.status);
        } catch (error) {
            console.error("Failed to check status:", error);
            setStatus("unknown");
        }
    }, []);

    const handleStart = useCallback(async () => {
        setIsActionLoading(true);
        setStatus("starting");
        try {
            const res = await fetch(`${API_URL}/services/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "kokoro" }),
            });
            if (res.ok) {
                setTimeout(() => {
                    checkStatus();
                    setKey((k) => k + 1);
                    setIframeSrc(KOKORO_URL);
                }, 5000);
            } else {
                setStatus("stopped");
            }
        } catch (error) {
            console.error("Failed to start service:", error);
            setStatus("stopped");
        } finally {
            setIsActionLoading(false);
        }
    }, [checkStatus]);

    const handleStop = async () => {
        setIsActionLoading(true);
        setStatus("stopping");
        try {
            const res = await fetch(`${API_URL}/services/stop`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "kokoro" }),
            });
            if (res.ok) {
                setTimeout(checkStatus, 1000);
            }
        } catch (error) {
            console.error("Failed to stop service:", error);
        } finally {
            setIsActionLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
        // Auto-start if stopped (optional, keeping it consistent with muxing for now)
        const autoStart = async () => {
            const res = await fetch(`${API_URL}/services/status/kokoro`);
            const data = await res.json();
            if (data.status === "stopped") {
                handleStart();
            }
        };
        autoStart();

        const interval = setInterval(checkStatus, 15000);
        return () => clearInterval(interval);
    }, [checkStatus, handleStart]);

    const handleRefresh = () => {
        setKey((k) => k + 1);
        setIframeSrc(KOKORO_URL);
    };

    return (
        <div className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-background" : "h-[calc(100vh-0px)]"}`}>
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${status === "running" ? "bg-green-500 animate-pulse" : status === "starting" ? "bg-yellow-500 animate-spin" : "bg-red-500"}`} />
                    <h2 className="text-sm font-semibold text-foreground">🎙️ Kokoro TTS Studio (GPU)</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
                        Gradio → {KOKORO_URL}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        status === "running" ? "text-green-400 bg-green-400/10" : 
                        status === "starting" ? "text-yellow-400 bg-yellow-400/10" : 
                        "text-muted-foreground bg-muted"
                    }`}>
                        {status}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Controls */}
                    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border mr-2">
                        <button
                            onClick={handleStart}
                            disabled={status === "running" || status === "starting" || isActionLoading}
                            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                                status === "running" 
                                ? "text-muted-foreground cursor-not-allowed" 
                                : "text-emerald-400 hover:bg-emerald-400/10"
                            }`}
                        >
                            {status === "starting" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Start
                        </button>
                        <div className="w-px h-3 bg-border" />
                        <button
                            onClick={handleStop}
                            disabled={status === "stopped" || status === "stopping" || isActionLoading}
                            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                                status === "stopped" 
                                ? "text-muted-foreground cursor-not-allowed" 
                                : "text-rose-400 hover:bg-rose-400/10"
                            }`}
                        >
                            {status === "stopping" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                            Stop
                        </button>
                    </div>

                    {/* Info */}
                    <div className="group relative">
                        <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
                            <Info className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute right-0 top-8 w-64 bg-popover border border-border rounded-lg p-3 text-[11px] text-muted-foreground leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                            <p className="font-semibold text-foreground mb-1">Kokoro TTS Local</p>
                            <ul className="space-y-0.5">
                                <li>🚀 NVIDIA GPU Accelerated</li>
                                <li>🌍 9 Languages Supported</li>
                                <li>🗣️ High Fidelity Voice Gen</li>
                                <li>⚡ Low Latency Inference</li>
                            </ul>
                            <p className="mt-2 text-muted-foreground">Layanan dikelola secara otomatis:<br /><code className="text-primary">Services API</code></p>
                        </div>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={handleRefresh}
                        title="Refresh Page"
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Open in new tab */}
                    <a
                        href={KOKORO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in new tab"
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {/* Fullscreen toggle */}
                    <button
                        onClick={() => setIsFullscreen((f) => !f)}
                        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* iframe container */}
            <div className="flex-1 relative bg-background overflow-hidden">
                {status === "running" ? (
                    <iframe
                        key={key}
                        src={iframeSrc}
                        className="w-full h-full border-0"
                        title="Kokoro TTS Studio"
                        allow="camera; microphone; autoplay; clipboard-write; fullscreen"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
                        <div className="relative">
                            <Volume2 className="w-16 h-16 text-primary/40" />
                            {(status === "starting" || status === "stopping") && (
                                <div className="absolute -inset-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                            )}
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-foreground text-lg">
                                {status === "starting" ? "Memulai Kokoro TTS..." : 
                                 status === "stopping" ? "Menghentikan Layanan..." :
                                 "Kokoro TTS Tidak Aktif"}
                            </p>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                {status === "starting" ? "Menyiapkan model NVIDIA GPU, mohon tunggu sebentar." :
                                 status === "stopped" ? "Klik tombol 'Start' di atas untuk menjalankan studio audio." :
                                 "Menghubungkan ke backend services..."}
                            </p>
                        </div>
                        {status === "stopped" && (
                            <button 
                                onClick={handleStart}
                                className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-full text-sm font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                            >
                                <Play className="w-4 h-4" /> Jalankan Sekarang
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
