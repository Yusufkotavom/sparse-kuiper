"use client";

import { useState, useEffect } from "react";
import { Terminal, RefreshCw, Download } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function LogsPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await fetchApi<{ logs: string[] }>("/logs/");
            setLogs(data.logs || []);
        } catch (e) {
            console.error("Failed to load logs:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
        let interval: NodeJS.Timeout;
        if (autoRefresh) {
            interval = setInterval(loadLogs, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh]);

    const handleDownload = () => {
        const textToSave = logs.join('\n');
        const blob = new Blob([textToSave], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aio-backend-logs-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Terminal className="w-6 h-6 text-primary" /> System Logs
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">Real-time backend application logs and system events.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer bg-surface px-3 py-1.5 rounded-lg border border-border hover:border-border-hover transition-colors">
                        <input 
                            type="checkbox" 
                            checked={autoRefresh} 
                            onChange={(e) => setAutoRefresh(e.target.checked)} 
                            className="rounded border-border bg-background text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        Auto-refresh (5s)
                    </label>
                    <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 border-border hover:bg-elevated text-xs">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                    </Button>
                    <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading} className="h-8 border-border hover:bg-elevated text-xs">
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading && !autoRefresh ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Terminal Window */}
            <div className="flex-1 bg-zinc-950 border border-border rounded-xl overflow-hidden flex flex-col font-mono text-xs relative shadow-2xl">
                <div className="h-9 bg-zinc-900 border-b border-border flex items-center px-4 gap-2 shrink-0">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="text-[10px] text-zinc-500 ml-4 font-bold uppercase tracking-widest">Backend Console</span>
                    {loading && (
                        <div className="ml-auto flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] text-primary/60 uppercase font-bold">Streaming...</span>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-zinc-950/50 backdrop-blur-sm">
                    {logs.length === 0 ? (
                        <div className="text-zinc-600 italic flex items-center justify-center h-full">
                            <Terminal className="w-8 h-8 mr-3 opacity-20" /> No logs available.
                        </div>
                    ) : (
                        logs.map((log, index) => {
                            // Syntax highlighting logic for logs
                            let colorClass = "text-zinc-400";
                            let linePrefix = "";
                            
                            if (log.includes(" ERROR ")) {
                                colorClass = "text-red-400 bg-red-500/5 px-1 rounded";
                                linePrefix = "🔴 ";
                            }
                            else if (log.includes(" WARNING ")) {
                                colorClass = "text-yellow-400 bg-yellow-500/5 px-1 rounded";
                                linePrefix = "🟠 ";
                            }
                            else if (log.includes(" INFO ")) {
                                colorClass = "text-emerald-400";
                                linePrefix = "🟢 ";
                            }
                            else if (log.includes(" DEBUG ")) {
                                colorClass = "text-blue-400 opacity-80";
                                linePrefix = "🔵 ";
                            }

                            return (
                                <div key={index} className={`py-0.5 whitespace-pre-wrap break-all transition-colors hover:bg-white/5 ${colorClass}`}>
                                    <span className="opacity-40 mr-2 text-[10px]">{index + 1}</span>
                                    {linePrefix}{log}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
