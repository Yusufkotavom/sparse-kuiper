"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw, Maximize2, Minimize2, Info, Play, Square, Loader2, Zap } from "lucide-react";

const SERVICE_URL = process.env.NEXT_PUBLIC_STUDIO_TEST_URL || "http://localhost:8503";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SERVICE_NAME = "studio-test";

export default function StudioTestPage() {
    const [iframeSrc, setIframeSrc] = useState(SERVICE_URL);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [key, setKey] = useState(0);
    const [status, setStatus] = useState<"running" | "stopped" | "starting" | "stopping" | "unknown">("unknown");
    const [isActionLoading, setIsActionLoading] = useState(false);

    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/services/status/${SERVICE_NAME}`);
            if (!res.ok) throw new Error("API call failed");
            const data = await res.json();
            setStatus(data.status);
        } catch (error) {
            console.error("Failed to check status:", error);
            setStatus("unknown");
        }
    }, []);

    const handleStart = async () => {
        setIsActionLoading(true);
        setStatus("starting");
        try {
            const res = await fetch(`${API_URL}/services/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: SERVICE_NAME }),
            });
            if (res.ok) {
                setTimeout(() => {
                    checkStatus();
                    handleRefresh();
                }, 3000);
            } else {
                setStatus("stopped");
            }
        } catch (error) {
            console.error("Failed to start service:", error);
            setStatus("stopped");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleStop = async () => {
        setIsActionLoading(true);
        setStatus("stopping");
        try {
            const res = await fetch(`${API_URL}/services/stop`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: SERVICE_NAME }),
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
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, [checkStatus]);

    const handleRefresh = () => {
        setKey((k) => k + 1);
        setIframeSrc(SERVICE_URL);
    };

    return (
        <div className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-background" : "h-[calc(100vh-0px)]"}`}>
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${status === "running" ? "bg-green-500 animate-pulse" : status === "starting" ? "bg-yellow-500 animate-spin" : "bg-red-500"}`} />
                    <h2 className="text-sm font-semibold text-foreground">⚡ Studio Test Lab</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
                        Port 8503
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        status === "running" ? "text-blue-400 bg-blue-400/10" : 
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
                                : "text-blue-400 hover:bg-blue-400/10"
                            }`}
                        >
                            {status === "starting" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Start Lab
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

                    <button onClick={handleRefresh} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <a href={SERVICE_URL} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button onClick={() => setIsFullscreen((f) => !f)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
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
                        title="Studio Test Lab"
                        allow="autoplay; clipboard-write; fullscreen"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
                        <div className="relative">
                            <Zap className="w-16 h-16 text-blue-500/40" />
                            {(status === "starting" || status === "stopping") && (
                                <div className="absolute -inset-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                            )}
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-foreground text-lg">
                                {status === "starting" ? "Initializing Experimental Lab..." : 
                                 status === "stopping" ? "Cleaning up..." :
                                 "Studio Test Lab Offline"}
                            </p>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                Testing area untuk fitur video gen baru dan eksperimen bulk manipulation.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
