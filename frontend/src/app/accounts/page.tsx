"use client";

import { useState, useEffect, useMemo } from "react";
import { accountsApi, Account, DEFAULT_API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Loader2, Globe, Trash2, Plus, LogIn, RefreshCw,
    Youtube, Facebook, Link2, Link2Off, CheckCircle2, ExternalLink, Copy, Check, Edit2, Play, Tag, FileText, Search, Instagram, Music
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ViewToggle } from "@/components/atoms/ViewToggle";
import { Download, Upload } from "lucide-react";
import { subscribeToRealtimeStream, type RealtimeEventRecord } from "@/lib/supabase";

// ─── YouTube Connect Modal ────────────────────────────────────────
function YouTubeConnectModal({ account, onConnected }: { account: Account; onConnected: () => void }) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"idle" | "url" | "code" | "loading" | "done">("idle");
    const [authUrl, setAuthUrl] = useState("");
    const [code, setCode] = useState("");
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");

    const handleGetUrl = async () => {
        setStep("loading");
        setError("");
        try {
            const res = await accountsApi.getYoutubeAuthUrl(account.id!);
            setAuthUrl(res.auth_url);
            setStep("url");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || "Failed to get auth URL");
            setStep("idle");
        }
    };

    const handleConnect = async () => {
        if (!code.trim()) return;
        setStep("loading");
        setError("");
        try {
            const res = await accountsApi.connectYoutube(account.id!, code.trim());
            setStep("done");
            setTimeout(() => {
                setOpen(false);
                setStep("idle");
                setCode("");
                setAuthUrl("");
                onConnected();
            }, 1500);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || "Invalid code. Please try again.");
            setStep("url");
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(authUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenInBrowser = () => {
        window.open(authUrl, "_blank");
        setStep("code");
    };

    return (
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setStep("idle"); setCode(""); setError(""); } }}>
            <DialogTrigger render={<Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white border-0 gap-2" />}>
                <Youtube className="w-4 h-4" /> Connect YouTube
            </DialogTrigger>
            <DialogContent className="bg-background border border-border text-foreground max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-400">
                        <Youtube className="w-5 h-5" /> Connect YouTube Account
                    </DialogTitle>
                </DialogHeader>

                {step === "done" && (
                    <div className="flex flex-col items-center py-8 gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                        </div>
                        <p className="text-emerald-400 font-medium">YouTube Connected!</p>
                    </div>
                )}

                {step === "idle" && (
                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-surface rounded-lg border border-border text-sm text-muted-foreground space-y-2">
                            <p className="font-medium text-foreground">How it works:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Click the button below to get a Google authorization link</li>
                                <li>Open the link and log in with your YouTube account</li>
                                <li>Paste the authorization code back here</li>
                            </ol>
                        </div>
                        {error && <p className="text-error text-sm">{error}</p>}
                        <Button onClick={handleGetUrl} className="w-full bg-red-600 hover:bg-red-700 text-white">
                            <Link2 className="w-4 h-4 mr-2" /> Get Authorization Link
                        </Button>
                    </div>
                )}

                {step === "loading" && (
                    <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-red-400" />
                        <p className="text-sm">Processing...</p>
                    </div>
                )}

                {(step === "url" || step === "code") && (
                    <div className="space-y-5 py-4">
                        {/* Auth URL */}
                        <div>
                            <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">Authorization Link</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    readOnly
                                    value={authUrl}
                                    className="flex-1 bg-surface border-border text-xs text-muted-foreground overflow-hidden truncate"
                                />
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={handleCopy}
                                    className="bg-elevated text-muted-foreground hover:text-foreground"
                                >
                                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        <Button onClick={handleOpenInBrowser} variant="outline" className="w-full border-border hover:bg-accent">
                            <ExternalLink className="w-4 h-4 mr-2" /> Open in Browser → Grant Access
                        </Button>

                        <div className="border-t border-border pt-4">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">
                                Paste Authorization Code
                            </Label>
                            <p className="text-xs text-muted-foreground/60 mb-3">
                                After granting access, Google will show a code. Copy and paste it below.
                            </p>
                            <Input
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="4/0AX4XfWj..."
                                className="bg-surface border-border font-mono text-sm mb-3"
                                onKeyDown={e => e.key === "Enter" && handleConnect()}
                            />
                            {error && <p className="text-error text-xs mb-3">{error}</p>}
                            <Button
                                onClick={handleConnect}
                                disabled={!code.trim()}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                            >
                                <Youtube className="w-4 h-4 mr-2" /> Confirm & Connect
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Facebook Connect Modal ────────────────────────────────────────
function FacebookConnectModal({ account, onConnected }: { account: Account; onConnected: () => void }) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"idle" | "url" | "code" | "loading" | "select_page" | "done">("idle");
    const [authUrl, setAuthUrl] = useState("");
    const [code, setCode] = useState("");
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const [pages, setPages] = useState<{id: string, name: string}[]>([]);
    const [selectedPage, setSelectedPage] = useState("");

    const handleGetUrl = async () => {
        setStep("loading");
        setError("");
        try {
            const res = await accountsApi.getFacebookAuthUrl(account.id!);
            setAuthUrl(res.auth_url);
            setStep("url");
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || "Failed to get auth URL");
            setStep("idle");
        }
    };

    const handleConnect = async () => {
        if (!code.trim()) return;
        setStep("loading");
        setError("");
        try {
            const res = await accountsApi.connectFacebook(account.id!, code.trim());
            if (res.status === "needs_page" && res.pages) {
                setPages(res.pages);
                setStep("select_page");
            } else {
                setStep("done");
                setTimeout(() => finishFlow(), 1500);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || "Invalid code or token error. Please try again.");
            setStep("url");
        }
    };

    const handleSelectPage = async () => {
        if (!selectedPage) return;
        setStep("loading");
        setError("");
        try {
            await accountsApi.selectFacebookPage(account.id!, selectedPage);
            setStep("done");
            setTimeout(() => finishFlow(), 1500);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || "Failed to select page.");
            setStep("select_page");
        }
    };

    const finishFlow = () => {
        setOpen(false);
        setStep("idle");
        setCode("");
        setAuthUrl("");
        setPages([]);
        setSelectedPage("");
        onConnected();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(authUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenInBrowser = () => {
        window.open(authUrl, "_blank");
        setStep("code");
    };

    return (
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setStep("idle"); setCode(""); setError(""); } }}>
            <DialogTrigger render={<Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0 gap-2" />}>
                <Facebook className="w-4 h-4" /> Connect Facebook
            </DialogTrigger>
            <DialogContent className="bg-background border border-border text-foreground max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-blue-400">
                        <Facebook className="w-5 h-5" /> Connect Facebook Page
                    </DialogTitle>
                </DialogHeader>

                {step === "done" && (
                    <div className="flex flex-col items-center py-8 gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                        </div>
                        <p className="text-emerald-400 font-medium">Facebook Connected!</p>
                    </div>
                )}

                {step === "idle" && (
                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-surface rounded-lg border border-border text-sm text-muted-foreground space-y-2">
                            <p className="font-medium text-foreground">How it works:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Click the button below to get an authorization link</li>
                                <li>Open the link and log in with your Facebook account</li>
                                <li>Select the Pages you want to permit</li>
                                <li>After you are redirected, copy the URL from the browser&apos;s address bar</li>
                            </ol>
                        </div>
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        <Button onClick={handleGetUrl} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                            <Link2 className="w-4 h-4 mr-2" /> Get Authorization Link
                        </Button>
                    </div>
                )}

                {step === "loading" && (
                    <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                        <p className="text-sm">Processing...</p>
                    </div>
                )}

                {(step === "url" || step === "code") && (
                    <div className="space-y-5 py-4">
                        {/* Auth URL */}
                        <div>
                            <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">Authorization Link</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    readOnly
                                    value={authUrl}
                                    className="flex-1 bg-surface border-border text-xs text-muted-foreground overflow-hidden truncate"
                                />
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={handleCopy}
                                    className="bg-elevated text-muted-foreground hover:text-foreground"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        <Button onClick={handleOpenInBrowser} variant="outline" className="w-full border-border hover:bg-surface">
                            <ExternalLink className="w-4 h-4 mr-2" /> Open in Browser → Grant Access
                        </Button>

                        <div className="border-t border-border pt-4">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">
                                Paste Redirect URL (Contains Code)
                            </Label>
                            <p className="text-xs text-muted-foreground mb-3">
                                After logging in, you will be redirected to an empty or error page at HTTPS://LOCALHOST/... Copy the FULL URL in the address bar and paste it below.
                            </p>
                            <Input
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="https://localhost/?code=AQBc..."
                                className="bg-surface border-border font-mono text-sm mb-3"
                                onKeyDown={e => e.key === "Enter" && handleConnect()}
                            />
                            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
                            <Button
                                onClick={handleConnect}
                                disabled={!code.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Facebook className="w-4 h-4 mr-2" /> Confirm & Connect
                            </Button>
                        </div>
                    </div>
                )}

                {step === "select_page" && (
                    <div className="space-y-5 py-4">
                        <div className="p-4 bg-surface rounded-lg border border-border text-sm text-muted-foreground space-y-2">
                            <p className="font-medium text-foreground">Select Fan Page</p>
                            <p>We found {pages.length} page(s) associated with this account. Which one would you like to connect to this profile?</p>
                        </div>
                        
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {pages.map(page => (
                                <label key={page.id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${selectedPage === page.id ? 'bg-blue-600/10 border-blue-500' : 'bg-surface border-border hover:border-border-hover'}`}>
                                    <input 
                                        type="radio" 
                                        name="fb_page" 
                                        value={page.id} 
                                        checked={selectedPage === page.id}
                                        onChange={() => setSelectedPage(page.id)}
                                        className="mr-3"
                                    />
                                    <div>
                                        <p className="font-medium text-foreground">{page.name}</p>
                                        <p className="text-xs text-muted-foreground">ID: {page.id}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {error && <p className="text-red-400 text-xs">{error}</p>}
                        
                        <Button
                            onClick={handleSelectPage}
                            disabled={!selectedPage}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Facebook className="w-4 h-4 mr-2" /> Connect Selected Page
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Badge Helper ─────────────────────────────────────────────────
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
    return <span className={`inline-flex items-center justify-center ${className}`}>{children}</span>;
}

function BackupSection() {
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{message?: string; imported?: number; updated?: number} | null>(null);
    const [error, setError] = useState("");

    const handleExportJson = async () => {
        setExporting(true);
        setError("");
        try {
            const res = await accountsApi.exportCreds(true);
            const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "accounts_export.json";
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || "Failed to export JSON");
        } finally {
            setExporting(false);
        }
    };

    const handleExportZip = () => {
        window.open(`${DEFAULT_API_BASE_URL}/backup/export-zip`, "_blank");
    };

    const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setError("");
        setImportResult(null);
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const accounts = parsed.accounts || parsed;
            const res = await accountsApi.importCreds(accounts);
            setImportResult(res);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg || "Failed to import JSON");
        } finally {
            setImporting(false);
            e.target.value = "";
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Backup & Transfer
                </CardTitle>
                <CardDescription>Export ZIP (DB+secrets+sesi) atau export/import JSON creds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && <p className="text-error text-sm">{error}</p>}
                <div className="flex flex-wrap gap-2">
                    <Button onClick={handleExportZip} className="gap-2">
                        <ExternalLink className="w-4 h-4" /> Export ZIP
                    </Button>
                    <Button onClick={handleExportJson} disabled={exporting} variant="outline" className="gap-2">
                        <Download className="w-4 h-4" /> Export JSON
                    </Button>
                    <label className="inline-flex items-center">
                        <input type="file" accept="application/json" onChange={handleImportJson} className="hidden" id="importJsonInput" />
                        <Button disabled={importing} variant="outline" className="gap-2" onClick={() => document.getElementById("importJsonInput")?.click()}>
                            <Upload className="w-4 h-4" /> Import JSON
                        </Button>
                    </label>
                </div>
                {importResult && (
                    <div className="text-sm text-muted-foreground">
                        Imported: {importResult.imported} • Updated: {importResult.updated}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function getPlatformColor(platform: string) {
    switch (platform) {
        case "tiktok": return "text-cyan-400 border-cyan-400/30 bg-cyan-400/10";
        case "youtube": return "text-rose-500 border-rose-500/30 bg-rose-500/10";
        case "instagram": return "text-pink-500 border-pink-500/30 bg-pink-500/10";
        case "facebook": return "text-blue-500 border-blue-500/30 bg-blue-500/10";
        case "grok": return "text-violet-400 border-violet-400/30 bg-violet-400/10";
        case "whisk": return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
        default: return "text-muted-foreground border-border bg-elevated";
    }
}

// ─── Main Page ────────────────────────────────────────────────────
export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [platformFilter, setPlatformFilter] = useState("all");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentEditingAccount, setCurrentEditingAccount] = useState<Partial<Account> | null>(null);
    const [newAccount, setNewAccount] = useState<Partial<Account>>({
        name: "", platform: "tiktok", auth_method: "playwright", api_key: "", api_secret: "", tags: "", notes: "", browser_type: "chromium", lightweight_mode: false, proxy: "", user_agent: ""
    });
    const [youtubeSecrets, setYoutubeSecrets] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");

    const filteredAccounts = useMemo(() => {
        return accounts.filter(acc => {
            const matchesPlatform = platformFilter === "all" || acc.platform === platformFilter;
            const term = search.toLowerCase().trim();
            const matchesSearch = !term || 
                acc.name.toLowerCase().includes(term) || 
                (acc.channel_title || "").toLowerCase().includes(term) ||
                (acc.tags || "").toLowerCase().includes(term);
            return matchesPlatform && matchesSearch;
        });
    }, [accounts, search, platformFilter]);

    useEffect(() => {
        loadAccounts();
        loadYoutubeSecrets();
        try {
            const saved = typeof window !== "undefined" ? localStorage.getItem("accounts-view-mode") : null;
            if (saved === "grid" || saved === "list") setViewMode(saved as "list" | "grid");
        } catch {}
    }, []);

    useEffect(() => {
        const subscription = subscribeToRealtimeStream("accounts", (event: RealtimeEventRecord) => {
            const payload = event.payload as unknown as Account;
            if (!payload?.id) return;

            setAccounts((prev) => {
                if (event.event_type === "deleted") {
                    return prev.filter((item) => item.id !== payload.id);
                }

                const next = [...prev];
                const index = next.findIndex((item) => item.id === payload.id);
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

    const loadYoutubeSecrets = async () => {
        try {
            const data = await accountsApi.getYoutubeSecrets();
            setYoutubeSecrets(data.secrets || []);
        } catch (e) {
            console.error(e);
        }
    }

    const loadAccounts = async () => {
        setIsLoading(true);
        try {
            const data = await accountsApi.getAccounts();
            setAccounts(data.accounts || []);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const handleAddAccount = async () => {
        if (!newAccount.name || !newAccount.platform || !newAccount.auth_method) return;
        setIsSaving(true);
        try {
            await accountsApi.addAccount(newAccount as Account);
            setIsAddModalOpen(false);
            setNewAccount({ name: "", platform: "tiktok", auth_method: "playwright", api_key: "", api_secret: "", tags: "", notes: "", browser_type: "chromium", lightweight_mode: false, proxy: "", user_agent: "" });
            loadAccounts();
        } catch { alert("Failed to add account."); }
        finally { setIsSaving(false); }
    };

    const handleUpdateAccount = async () => {
        if (!currentEditingAccount || !currentEditingAccount.id || !currentEditingAccount.name) return;
        setIsSaving(true);
        try {
            await accountsApi.updateAccount(currentEditingAccount.id, currentEditingAccount as Account);
            setIsEditModalOpen(false);
            setCurrentEditingAccount(null);
            loadAccounts();
        } catch { alert("Failed to update account."); }
        finally { setIsSaving(false); }
    };

    const openEditModal = (acc: Account) => {
        setCurrentEditingAccount(acc);
        setIsEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this account and its session data?")) return;
        setActionLoading(`delete-${id}`);
        try { await accountsApi.deleteAccount(id); loadAccounts(); }
        catch { alert("Failed to delete account."); }
        finally { setActionLoading(null); }
    };

    const handleLogin = async (id: string, method: string) => {
        if (method !== "playwright") { alert("API login is handled via OAuth connect."); return; }
        setActionLoading(`login-${id}`);
        try { const res = await accountsApi.triggerLogin(id); alert(res.message); }
        catch { alert("Failed to launch login browser."); }
        finally { setActionLoading(null); }
    };

    const handleLaunchBrowser = async (id: string) => {
        setActionLoading(`launch-${id}`);
        try { const res = await accountsApi.launchPlaywrightManual(id); alert(res.message); }
        catch { alert("Failed to launch manual browser."); }
        finally { setActionLoading(null); }
    };

    const handleDisconnectYoutube = async (id: string) => {
        if (!confirm("Disconnect this YouTube channel? You'll need to re-authorize.")) return;
        setActionLoading(`yt-disconnect-${id}`);
        try { await accountsApi.disconnectYoutube(id); loadAccounts(); }
        catch { alert("Failed to disconnect."); }
        finally { setActionLoading(null); }
    };

    const handleDisconnectFacebook = async (id: string) => {
        if (!confirm("Disconnect this Facebook Page? You'll need to re-authorize.")) return;
        setActionLoading(`fb-disconnect-${id}`);
        try { await accountsApi.disconnectFacebook(id); loadAccounts(); }
        catch { alert("Failed to disconnect."); }
        finally { setActionLoading(null); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-[var(--gap-base)]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Globe className="w-6 h-6 text-primary" /> Account Management
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">Manage social media profiles and connection sessions.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <ViewToggle
                        value={viewMode}
                        onChange={(m) => { setViewMode(m); try { localStorage.setItem("accounts-view-mode", m); } catch {} }}
                        storageKey="accounts-view-mode"
                    />
                    <Button variant="outline" size="icon" onClick={loadAccounts} disabled={isLoading} className="border-border hover:bg-surface">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger render={<Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 sm:flex-none" />}>
                            <Plus className="w-4 h-4 mr-2" /> Add Account
                        </DialogTrigger>
                        <DialogContent className="bg-background border border-border text-foreground">
                            <DialogHeader>
                                <DialogTitle>Add Social Media Account</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase">Profile Name</Label>
                                    <Input
                                        placeholder="e.g. Main Gaming Channel"
                                        value={newAccount.name}
                                        onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                                        className="bg-surface border-border focus:border-primary"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase">Platform</Label>
                                        <select
                                            value={newAccount.platform}
                                            onChange={e => setNewAccount({ ...newAccount, platform: e.target.value })}
                                            className="w-full bg-surface border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                        >
                                            <option value="tiktok">TikTok</option>
                                            <option value="youtube">YouTube</option>
                                            <option value="instagram">Instagram</option>
                                            <option value="facebook">Facebook</option>
                                            <option value="grok">Grok Imagine</option>
                                            <option value="whisk">Google Flow (Whisk)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase">Auth Method</Label>
                                        <select
                                            value={newAccount.auth_method}
                                            onChange={e => setNewAccount({ ...newAccount, auth_method: e.target.value })}
                                            className="w-full bg-surface border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                        >
                                            <option value="playwright">Playwright (Browser Session)</option>
                                            <option value="api">Official OAuth API</option>
                                        </select>
                                    </div>
                                </div>
                                {newAccount.auth_method === "api" && newAccount.platform !== "youtube" && (
                                    <div className="space-y-3 p-4 bg-surface/50 border border-border rounded-lg">
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground text-xs uppercase">App ID / Client ID</Label>
                                            <Input value={newAccount.api_key} onChange={e => setNewAccount({ ...newAccount, api_key: e.target.value })} className="bg-surface border-border" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground text-xs uppercase">App Secret</Label>
                                            <Input type="password" value={newAccount.api_secret} onChange={e => setNewAccount({ ...newAccount, api_secret: e.target.value })} className="bg-surface border-border" />
                                        </div>
                                    </div>
                                )}
                                {newAccount.platform === "youtube" && newAccount.auth_method === "api" && (
                                    <div className="space-y-3 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                                        <div className="text-sm text-red-400">
                                            <Youtube className="w-4 h-4 inline mr-1.5" />
                                            YouTube uses OAuth 2.0. Choose a Google Cloud Client Secret file to associate with this account.
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground text-xs uppercase">Client Secret File</Label>
                                            <select
                                                value={newAccount.api_key || ""}
                                                onChange={e => setNewAccount({ ...newAccount, api_key: e.target.value })}
                                                className="w-full bg-surface border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                            >
                                                <option value="">-- Randomly Select Secret File --</option>
                                                {youtubeSecrets.map(sec => (
                                                    <option key={sec} value={`config/youtube_secrets/${sec}`}>{sec}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                {newAccount.auth_method === "playwright" && (
                                    <div className="space-y-3 p-4 bg-surface/50 border border-border rounded-lg">
                                        <div className="text-sm font-medium text-primary mb-2">Browser Configuration</div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground text-xs uppercase">Browser Type</Label>
                                            <select
                                                value={newAccount.browser_type || "chromium"}
                                                onChange={e => setNewAccount({ ...newAccount, browser_type: e.target.value })}
                                                className="w-full bg-surface border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                            >
                                                <option value="chromium">Chrome / Chromium</option>
                                                <option value="firefox">Firefox</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground text-xs uppercase">Proxy (Optional)</Label>
                                            <Input placeholder="http://user:pass@192.168.1.1:8080" value={newAccount.proxy || ""} onChange={e => setNewAccount({ ...newAccount, proxy: e.target.value })} className="bg-surface border-border" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground text-xs uppercase">User Agent (Optional)</Label>
                                            <Input placeholder="Mozilla/5.0..." value={newAccount.user_agent || ""} onChange={e => setNewAccount({ ...newAccount, user_agent: e.target.value })} className="bg-surface border-border" />
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                                            <input 
                                                type="checkbox" 
                                                checked={newAccount.lightweight_mode || false} 
                                                onChange={e => setNewAccount({ ...newAccount, lightweight_mode: e.target.checked })}
                                                className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary/20"
                                            />
                                            <span className="text-sm text-muted-foreground">Lightweight Mode</span>
                                        </label>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase"><Tag className="w-3 h-3 inline mr-1"/>Tags</Label>
                                    <Input
                                        placeholder="e.g. gaming, promo"
                                        value={newAccount.tags || ""}
                                        onChange={e => setNewAccount({ ...newAccount, tags: e.target.value })}
                                        className="bg-surface border-border"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs uppercase"><FileText className="w-3 h-3 inline mr-1"/>Notes</Label>
                                    <Textarea
                                        placeholder="Internal notes for this account..."
                                        value={newAccount.notes || ""}
                                        onChange={e => setNewAccount({ ...newAccount, notes: e.target.value })}
                                        className="w-full bg-surface border-border text-foreground text-sm min-h-[80px]"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddAccount} disabled={isSaving || !newAccount.name} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Account
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                        <DialogContent className="bg-background border border-border text-foreground overflow-y-auto max-h-[90vh]">
                            <DialogHeader>
                                <DialogTitle>Edit Account Settings</DialogTitle>
                            </DialogHeader>
                            {currentEditingAccount && (
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase">Profile Name</Label>
                                        <Input
                                            placeholder="e.g. Main Gaming Channel"
                                            value={currentEditingAccount.name}
                                            onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, name: e.target.value })}
                                            className="bg-surface border-border focus:border-primary"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground text-xs uppercase">Platform</Label>
                                            <select
                                                value={currentEditingAccount.platform}
                                                onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, platform: e.target.value })}
                                                className="w-full bg-surface border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                            >
                                                <option value="tiktok">TikTok</option>
                                                <option value="youtube">YouTube</option>
                                                <option value="instagram">Instagram</option>
                                                <option value="facebook">Facebook</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground text-xs uppercase">Auth Method</Label>
                                            <select
                                                value={currentEditingAccount.auth_method}
                                                onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, auth_method: e.target.value })}
                                                className="w-full bg-surface border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                            >
                                                <option value="playwright">Playwright (Browser Session)</option>
                                                <option value="api">Official OAuth API</option>
                                            </select>
                                        </div>
                                    </div>
                                    {currentEditingAccount.auth_method === "api" && currentEditingAccount.platform !== "youtube" && (
                                        <div className="space-y-3 p-4 bg-surface/50 border border-border rounded-lg">
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground text-xs uppercase">App ID / Client ID</Label>
                                                <Input value={currentEditingAccount.api_key || ""} onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, api_key: e.target.value })} className="bg-surface border-border" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground text-xs uppercase">App Secret / Access Token</Label>
                                                <Input type="password" value={currentEditingAccount.api_secret || ""} onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, api_secret: e.target.value })} className="bg-surface border-border" />
                                            </div>
                                        </div>
                                    )}
                                    {currentEditingAccount.platform === "youtube" && currentEditingAccount.auth_method === "api" && (
                                        <div className="space-y-3 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                                            <div className="text-sm text-red-400">
                                                <Youtube className="w-4 h-4 inline mr-1.5" />
                                                YouTube uses OAuth 2.0. Choose a Google Cloud Client Secret file to associate with this account.
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground text-xs uppercase">Client Secret File</Label>
                                                <select
                                                    value={currentEditingAccount.api_key || ""}
                                                    onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, api_key: e.target.value })}
                                                    className="w-full bg-surface border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                                >
                                                    <option value="">-- Randomly Select Secret File --</option>
                                                    {youtubeSecrets.map(sec => (
                                                        <option key={sec} value={`config/youtube_secrets/${sec}`}>{sec}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                    {currentEditingAccount.auth_method === "playwright" && (
                                        <div className="space-y-3 p-4 bg-surface/50 border border-border rounded-lg">
                                            <div className="text-sm font-medium text-primary mb-2">Browser Configuration</div>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground text-xs uppercase">Browser Type</Label>
                                                <select
                                                    value={currentEditingAccount.browser_type || "chromium"}
                                                    onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, browser_type: e.target.value })}
                                                    className="w-full bg-surface border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                                >
                                                    <option value="chromium">Chrome / Chromium</option>
                                                    <option value="firefox">Firefox</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground text-xs uppercase">Proxy (Optional)</Label>
                                                <Input placeholder="http://user:pass@192.168.1.1:8080" value={currentEditingAccount.proxy || ""} onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, proxy: e.target.value })} className="bg-surface border-border" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground text-xs uppercase">User Agent (Optional)</Label>
                                                <Input placeholder="Mozilla/5.0..." value={currentEditingAccount.user_agent || ""} onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, user_agent: e.target.value })} className="bg-surface border-border" />
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer pt-1">
                                                <input 
                                                    type="checkbox" 
                                                    checked={currentEditingAccount.lightweight_mode || false} 
                                                    onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, lightweight_mode: e.target.checked })}
                                                    className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm text-muted-foreground">Lightweight Mode</span>
                                            </label>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase"><Tag className="w-3 h-3 inline mr-1"/>Tags</Label>
                                        <Input
                                            placeholder="e.g. gaming, promo"
                                            value={currentEditingAccount.tags || ""}
                                            onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, tags: e.target.value })}
                                            className="bg-surface border-border"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs uppercase"><FileText className="w-3 h-3 inline mr-1"/>Notes</Label>
                                        <Textarea
                                            placeholder="Internal notes for this account..."
                                            value={currentEditingAccount.notes || ""}
                                            onChange={e => setCurrentEditingAccount({ ...currentEditingAccount, notes: e.target.value })}
                                            className="w-full bg-surface border-border text-foreground text-sm min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleUpdateAccount} disabled={isSaving || !currentEditingAccount?.name} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Changes
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters */}
            <div className="space-y-3 rounded-lg border border-border bg-surface/30 p-4">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search account name, channel title, or tags..."
                        className="pl-10 h-11 bg-background border-border"
                    />
                </div>
                
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mr-2">Filter Platform:</span>
                    {[
                        { id: "all", label: "All", icon: <Globe className="w-3.5 h-3.5" /> },
                        { id: "tiktok", label: "TikTok", icon: <Music className="w-3.5 h-3.5" /> },
                        { id: "youtube", label: "YouTube", icon: <Youtube className="w-3.5 h-3.5" /> },
                        { id: "instagram", label: "Instagram", icon: <Instagram className="w-3.5 h-3.5" /> },
                        { id: "facebook", label: "Facebook", icon: <Facebook className="w-3.5 h-3.5" /> },
                        { id: "grok", label: "Grok", icon: <Play className="w-3.5 h-3.5" /> },
                        { id: "whisk", label: "Whisk", icon: <Link2 className="w-3.5 h-3.5" /> },
                    ].map((p) => (
                        <Button
                            key={p.id}
                            size="xs"
                            variant={platformFilter === p.id ? "default" : "outline"}
                            onClick={() => setPlatformFilter(p.id)}
                            className={`rounded-full ${
                                platformFilter === p.id
                                    ? "shadow-sm shadow-primary/20"
                                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                            }`}
                        >
                            {p.icon}
                            {p.label}
                        </Button>
                    ))}
                </div>
            </div>

            <BackupSection />
            {viewMode === "list" ? (
                <div className="bg-surface border border-border rounded-xl overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left text-sm text-muted-foreground min-w-[800px]">
                        <thead className="text-xs uppercase bg-background/50 border-b border-border text-muted-foreground/70">
                            <tr>
                                <th className="px-5 py-4 font-medium">Profile Name</th>
                                <th className="px-5 py-4 font-medium">Platform / Method</th>
                                <th className="px-5 py-4 font-medium hidden md:table-cell">Tags / Notes</th>
                                <th className="px-5 py-4 font-medium">Status & Channel</th>
                                <th className="px-5 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredAccounts.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center">
                                        <Globe className="w-12 h-12 opacity-20 mx-auto mb-4" />
                                        <p>No accounts match your filters.</p>
                                    </td>
                                </tr>
                            )}
                            {filteredAccounts.map(acc => {
                                const isActive = acc.status === "active";
                                const statusText = acc.status === "active" ? "Active" : "Needs Setup";
                                return (
                                    <tr key={acc.id} className="hover:bg-accent/5 transition-colors group">
                                        <td className="px-5 py-4 align-top">
                                            <div className="font-semibold text-foreground flex items-center gap-2">
                                                {acc.name}
                                            </div>
                                            {acc.last_login && (
                                                <div className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                                                    Last: {new Date(acc.last_login).toLocaleDateString()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <Badge className={`${getPlatformColor(acc.platform)} font-mono uppercase text-[10px] px-2 py-0.5 rounded-full border mb-1 inline-block`}>
                                                {acc.platform}
                                            </Badge>
                                            <div className="text-xs font-mono uppercase">
                                                {acc.auth_method === "api" ? "OAuth API" : "Browser Session"}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top hidden md:table-cell max-w-[200px]">
                                            {acc.tags && (
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {acc.tags.split(",").map(t => (
                                                        <span key={t} className="px-1.5 py-0.5 bg-elevated text-muted-foreground text-[10px] rounded leading-none border border-border">
                                                            {t.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {acc.notes && (
                                                <details className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground">
                                                    <summary className="cursor-pointer select-none outline-none">Show Notes</summary>
                                                    <p className="mt-1 whitespace-pre-wrap">{acc.notes}</p>
                                                </details>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
                                                <span className={`text-sm ${isActive ? "text-success" : "text-error"}`}>
                                                    {statusText}
                                                </span>
                                            </div>
                                            {acc.platform === "youtube" && acc.youtube_connected && acc.channel_title && (
                                                <div className="flex items-center gap-1.5 text-xs text-foreground/80 truncate opacity-80">
                                                    <Youtube className="w-3 h-3 text-red-400 flex-shrink-0" />
                                                    <span className="truncate">{acc.channel_title}</span>
                                                </div>
                                            )}
                                            {acc.platform === "facebook" && acc.status === "active" && acc.channel_title && (
                                                <div className="flex items-center gap-1.5 text-xs text-foreground/80 truncate opacity-80">
                                                    <Facebook className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                                    <span className="truncate">{acc.channel_title}</span>
                                                </div>
                                            )}
                                            {(acc.platform === "grok" || acc.platform === "whisk") && (
                                                <div className="mt-1 text-[10px] text-muted-foreground/70 max-w-[220px]">
                                                    {acc.platform === "grok"
                                                        ? "Dipakai untuk generate video Grok Imagine (session chrome_profile)."
                                                        : "Dipakai untuk generate KDP / Flow di Google Labs (Whisk)."}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex gap-1 justify-end">
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                        onClick={() => openEditModal(acc)}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-error hover:bg-error/10"
                                                        onClick={() => handleDelete(acc.id!)}
                                                        disabled={actionLoading === `delete-${acc.id}`}
                                                    >
                                                        {actionLoading === `delete-${acc.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                                <div className="flex flex-col gap-1 w-full sm:w-auto mt-2">
                                                    {acc.platform === "youtube" && acc.auth_method === "api" && (
                                                        acc.youtube_connected || acc.status === "active" ? (
                                                            <Button
                                                                size="sm" variant="outline"
                                                                className="border-border hover:border-red-500/50 hover:bg-red-500/5 hover:text-red-400 gap-2 text-muted-foreground w-full justify-start whitespace-nowrap"
                                                                onClick={() => handleDisconnectYoutube(acc.id!)}
                                                                disabled={actionLoading === `yt-disconnect-${acc.id}`}
                                                            >
                                                                {actionLoading === `yt-disconnect-${acc.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2Off className="w-3 h-3" />}
                                                                Disconnect
                                                            </Button>
                                                        ) : (
                                                            <YouTubeConnectModal account={acc} onConnected={loadAccounts} />
                                                        )
                                                    )}
                                                    {acc.platform === "facebook" && acc.auth_method === "api" && (
                                                        acc.status === "active" ? (
                                                            <Button
                                                                size="sm" variant="outline"
                                                                className="border-border hover:border-blue-500/50 hover:bg-blue-500/5 hover:text-blue-400 gap-2 text-muted-foreground w-full justify-start whitespace-nowrap"
                                                                onClick={() => handleDisconnectFacebook(acc.id!)}
                                                                disabled={actionLoading === `fb-disconnect-${acc.id}`}
                                                            >
                                                                {actionLoading === `fb-disconnect-${acc.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2Off className="w-3 h-3" />}
                                                                Disconnect
                                                            </Button>
                                                        ) : (
                                                            <FacebookConnectModal account={acc} onConnected={loadAccounts} />
                                                        )
                                                    )}
                                                    {acc.auth_method === "playwright" && (
                                                        <div className="flex flex-wrap sm:flex-nowrap gap-1 w-full">
                                                            <Button
                                                                onClick={() => handleLogin(acc.id!, acc.auth_method)}
                                                                disabled={actionLoading === `login-${acc.id}`}
                                                                variant="secondary"
                                                                size="sm"
                                                                title="Run auto-login detector (Closes after successful login)"
                                                                className="flex-1 bg-surface hover:bg-elevated text-foreground border border-border px-2"
                                                            >
                                                                {actionLoading === `login-${acc.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                                                            </Button>
                                                            <Button
                                                                onClick={() => handleLaunchBrowser(acc.id!)}
                                                                disabled={actionLoading === `launch-${acc.id}`}
                                                                variant="default"
                                                                size="sm"
                                                                title="Launch persistent browser session for this profile"
                                                                className="flex-[3] bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap px-2"
                                                            >
                                                                {actionLoading === `launch-${acc.id}` ? (
                                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                ) : (
                                                                    <Play className="w-3 h-3 mr-1" />
                                                                )}
                                                                Open Browser
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--gap-base)]">
                    {filteredAccounts.length === 0 && !isLoading && (
                        <div className="col-span-full text-center py-16 text-muted-foreground/40">
                            <Globe className="w-12 h-12 mx-auto mb-3" />
                            <p className="text-sm">No accounts match your filters.</p>
                        </div>
                    )}
                    {filteredAccounts.map(acc => {
                        const isActive = acc.status === "active";
                        return (
                            <Card key={acc.id} className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                <CardHeader className="p-[var(--card-p)]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <CardTitle className="text-base text-foreground truncate">{acc.name}</CardTitle>
                                            <CardDescription className="mt-1">
                                                <Badge className={`${getPlatformColor(acc.platform)} font-mono uppercase text-[10px] px-2 py-0.5 rounded-full border inline-block`}>
                                                    {acc.platform}
                                                </Badge>
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                onClick={() => openEditModal(acc)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-error hover:bg-error/10"
                                                onClick={() => handleDelete(acc.id!)}
                                                disabled={actionLoading === `delete-${acc.id}`}
                                            >
                                                {actionLoading === `delete-${acc.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-[var(--card-p)] space-y-3 pt-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isActive ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
                                        <span className={`text-sm font-medium ${isActive ? "text-success" : "text-error"}`}>{isActive ? "Active" : "Needs Setup"}</span>
                                    </div>
                                    {acc.platform === "youtube" && acc.youtube_connected && acc.channel_title && (
                                        <div className="flex items-center gap-1.5 text-xs text-foreground/80 truncate opacity-80">
                                            <Youtube className="w-3 h-3 text-red-400 flex-shrink-0" />
                                            <span className="truncate">{acc.channel_title}</span>
                                        </div>
                                    )}
                                    {acc.platform === "facebook" && acc.status === "active" && acc.channel_title && (
                                        <div className="flex items-center gap-1.5 text-xs text-foreground/80 truncate opacity-80">
                                            <Facebook className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                            <span className="truncate">{acc.channel_title}</span>
                                        </div>
                                    )}
                                    {acc.tags && (
                                        <div className="flex flex-wrap gap-1">
                                            {acc.tags.split(",").slice(0, 6).map(t => (
                                                <span key={t} className="px-1.5 py-0.5 bg-elevated text-muted-foreground text-[10px] rounded leading-none border border-border">
                                                    {t.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {(acc.platform === "grok" || acc.platform === "whisk") && (
                                        <div className="text-[10px] text-muted-foreground/70">
                                            {acc.platform === "grok"
                                                ? "Dipakai untuk generate video Grok Imagine (session chrome_profile)."
                                                : "Dipakai untuk generate KDP / Flow di Google Labs (Whisk)."}
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-1 mt-auto">
                                        {acc.platform === "youtube" && acc.auth_method === "api" && (
                                            acc.youtube_connected || acc.status === "active" ? (
                                                <Button
                                                    size="sm" variant="outline"
                                                    className="border-border hover:border-red-500/50 hover:bg-red-500/5 hover:text-red-400 gap-2 text-muted-foreground justify-start whitespace-nowrap"
                                                    onClick={() => handleDisconnectYoutube(acc.id!)}
                                                    disabled={actionLoading === `yt-disconnect-${acc.id}`}
                                                >
                                                    {actionLoading === `yt-disconnect-${acc.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2Off className="w-3 h-3" />}
                                                    Disconnect
                                                </Button>
                                            ) : (
                                                <YouTubeConnectModal account={acc} onConnected={loadAccounts} />
                                            )
                                        )}
                                        {acc.platform === "facebook" && acc.auth_method === "api" && (
                                            acc.status === "active" ? (
                                                <Button
                                                    size="sm" variant="outline"
                                                    className="border-border hover:border-blue-500/50 hover:bg-blue-500/5 hover:text-blue-400 gap-2 text-muted-foreground justify-start whitespace-nowrap"
                                                    onClick={() => handleDisconnectFacebook(acc.id!)}
                                                    disabled={actionLoading === `fb-disconnect-${acc.id}`}
                                                >
                                                    {actionLoading === `fb-disconnect-${acc.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2Off className="w-3 h-3" />}
                                                    Disconnect
                                                </Button>
                                            ) : (
                                                <FacebookConnectModal account={acc} onConnected={loadAccounts} />
                                            )
                                        )}
                                        {acc.auth_method === "playwright" && (
                                            <div className="flex gap-1">
                                                <Button
                                                    onClick={() => handleLogin(acc.id!, acc.auth_method)}
                                                    disabled={actionLoading === `login-${acc.id}`}
                                                    variant="secondary"
                                                    size="sm"
                                                    className="bg-surface hover:bg-elevated text-foreground border border-border px-2"
                                                >
                                                    {actionLoading === `login-${acc.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                                                </Button>
                                                <Button
                                                    onClick={() => handleLaunchBrowser(acc.id!)}
                                                    disabled={actionLoading === `launch-${acc.id}`}
                                                    variant="default"
                                                    size="sm"
                                                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap px-2"
                                                >
                                                    {actionLoading === `launch-${acc.id}` ? (
                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    ) : (
                                                        <Play className="w-3 h-3 mr-1" />
                                                    )}
                                                    Open Browser
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
