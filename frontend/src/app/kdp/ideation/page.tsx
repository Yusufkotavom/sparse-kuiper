"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { kdpApi, settingsApi, PromptTemplate, ProjectConfig, accountsApi, Account } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wand2, Loader2, Eye, EyeOff, Copy, CheckCheck } from "lucide-react";

const DEFAULT_SYSTEM_PROMPT = `You are an expert prompt engineer specializing in creating detailed Stable Diffusion / Midjourney prompts for KDP coloring books. Generate exactly {N} unique, non-repeating prompts for a coloring book featuring {CHARACTER}. Each prompt should be on its own line, numbered 1 through {N}. Each prompt should describe a single, clear scene or character pose.`;
const DEFAULT_PREFIX = "simple line art coloring page,";
const DEFAULT_SUFFIX = "black and white outline only, no shading, no fill, clean white background, suitable for coloring book, KDP printable";

export default function IdeationPage() {
    const router = useRouter();
    const LAST_PROJECT_STORAGE_KEY = "last_ideation_project_image";
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
    const [suffix, setSuffix] = useState(DEFAULT_SUFFIX);
    const [topic, setTopic] = useState("cute animals in nature");
    const [numberN, setNumberN] = useState(10);
    const [character, setCharacter] = useState("cute animal");
    const [prompts, setPrompts] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [projectName, setProjectName] = useState("");
    const [projects, setProjects] = useState<string[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [savedTemplates, setSavedTemplates] = useState<PromptTemplate[]>([]);
    const [whiskAccounts, setWhiskAccounts] = useState<Account[]>([]);
    const [whiskAccountId, setWhiskAccountId] = useState("whisk_default");

    const workspaceDraft = useMemo(() => ({
        project: selectedProject || projectName || "Belum dipilih",
        topic,
        character,
        promptCount: numberN,
    }), [selectedProject, projectName, topic, character, numberN]);
    const curationHref = selectedProject ? `/kdp/curation?project=${encodeURIComponent(selectedProject)}` : "/kdp/curation";

    useEffect(() => {
        loadProjects();
        loadTemplates();
        loadWhiskAccounts();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const lastProject = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
        if (!lastProject) return;
        void handleProjectSelect(lastProject);
    }, []);

    const loadTemplates = async () => {
        try {
            const list = await settingsApi.listTemplates();
            setSavedTemplates(list);
        } catch (e) {
            console.error("Failed to load templates", e);
        }
    };

    const handleLoadTemplate = (templateName: string) => {
        const t = savedTemplates.find((s) => s.name === templateName);
        if (!t) return;
        setSystemPrompt(t.system_prompt);
        setPrefix(t.prefix);
        setSuffix(t.suffix);
        setShowAdvanced(true);
    };

    const loadProjects = async () => {
        try {
            const list = await kdpApi.listProjects();
            setProjects(list);
        } catch (e) {
            console.error("Failed to load projects", e);
        }
    };

    const loadWhiskAccounts = async () => {
        try {
            const data = await accountsApi.getAccounts();
            const items = (data.accounts || []).filter((a) => a.platform === "whisk" && a.auth_method === "playwright");
            setWhiskAccounts(items);
            if (items.length > 0) {
                setWhiskAccountId((prev) => prev || items[0].id || "whisk_default");
            }
        } catch (e) {
            console.error("Failed to load whisk accounts", e);
        }
    };

    const handleProjectSelect = async (name: string) => {
        setSelectedProject(name);
        setProjectName(name);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, name);
        }
        let currentPrefix = prefix;
        let currentSuffix = suffix;

        // Load saved project config
        try {
            const config = await kdpApi.loadProjectConfig(name);
            if (config.topic) setTopic(config.topic);
            if (config.character) setCharacter(config.character);
            if (config.number_n) setNumberN(config.number_n);
            if (config.system_prompt) setSystemPrompt(config.system_prompt);
            if (config.prefix !== undefined) {
                setPrefix(config.prefix);
                currentPrefix = config.prefix;
            }
            if (config.suffix !== undefined) {
                setSuffix(config.suffix);
                currentSuffix = config.suffix;
            }
            if (config.whisk_account_id !== undefined) {
                setWhiskAccountId(config.whisk_account_id || "whisk_default");
            } else {
                setWhiskAccountId("whisk_default");
            }
        } catch (e) {
            console.log("No saved config for project, using defaults");
            setWhiskAccountId("whisk_default");
        }

        // Load saved project prompts
        try {
            const result = await kdpApi.getPrompts(name);
            if (result && result.prompts && result.prompts.length > 0) {
                const loadedPrompts = result.prompts.map((p: string) => {
                    let text = p.trim();
                    const pfx = currentPrefix.trim();
                    const sfx = currentSuffix.trim();
                    if (pfx && text.startsWith(pfx)) {
                        text = text.substring(pfx.length).trim();
                    }
                    if (sfx && text.endsWith(sfx)) {
                        text = text.substring(0, text.length - sfx.length).trim();
                    }
                    return text;
                });
                setPrompts(loadedPrompts);
            } else {
                setPrompts([]);
            }
        } catch (e) {
            setPrompts([]);
        }
    };

    const handleCreateProject = async () => {
        if (!projectName.trim()) return;
        try {
            await kdpApi.createProject(projectName);
            await loadProjects();
            await handleProjectSelect(projectName);
            alert(`Project ${projectName} created successfully!`);
        } catch (e) {
            console.error("Failed to create project", e);
            alert("Error creating project. It might already exist.");
        }
    };

    const handleSavePrompts = async () => {
        if (!selectedProject || prompts.length === 0) return;
        try {
            // Compose full prompts with prefix and suffix
            const composedPrompts = prompts.map(p =>
                `${prefix.trim()} ${p.trim()} ${suffix.trim()}`.trim()
            );
            await kdpApi.savePrompts(selectedProject, composedPrompts);

            // Also save project config
            await kdpApi.saveProjectConfig(selectedProject, {
                topic,
                character,
                number_n: numberN,
                system_prompt: systemPrompt,
                prefix,
                suffix,
                whisk_account_id: whiskAccountId,
            });

            alert(`${composedPrompts.length} prompts + project settings saved!`);
        } catch (e) {
            console.error("Failed to save", e);
        }
    };

    const handleGenerate = async () => {
        if (!systemPrompt.trim()) return;
        setIsLoading(true);
        setError(null);
        setPrompts([]);
        try {
            const result = await kdpApi.generatePrompts({
                system_prompt: systemPrompt,
                prefix_prompt: prefix,
                suffix_prompt: suffix,
                topic,
                number_n: numberN,
                character_type: character,
            });
            setPrompts(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unknown error occurred. Is the FastAPI backend running?");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-[var(--gap-base)]">
            <div className="mb-2">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                    <Wand2 className="w-6 h-6 text-primary" /> Image Ideation
                </h2>
                <p className="text-muted-foreground text-sm mt-1">Generate AI-powered visual prompts for Image Generation (KDP/Social Media).</p>
                <div className="mt-3 rounded-xl border border-border bg-surface/80 p-2 sm:p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                            { key: "brief", label: "1. Brief", href: "/kdp/ideation" },
                            { key: "generate", label: "2. Generate", href: "/kdp/ideation" },
                            { key: "review", label: "3. Review", href: curationHref },
                            { key: "run", label: "4. Run", href: "/runs" },
                        ].map((step) => (
                            <Link
                                key={step.key}
                                href={step.href}
                                className={`rounded-md border px-2 py-1.5 text-center text-[11px] font-semibold transition-colors ${
                                    step.key === "generate"
                                        ? "border-primary/40 bg-primary/10 text-primary"
                                        : "border-border text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {step.label}
                            </Link>
                        ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        <span className="rounded-md bg-accent px-2 py-1">Project: {workspaceDraft.project}</span>
                        <span className="rounded-md bg-accent px-2 py-1">Topic: {workspaceDraft.topic}</span>
                        <span className="rounded-md bg-accent px-2 py-1">Prompts: {workspaceDraft.promptCount}</span>
                    </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                    <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary font-semibold">1. Ideation</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">2. Curation</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">3. Processing (Runs)</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">4. Publish</span>
                </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--gap-base)]">
                {/* --- LEFT PANEL: Configuration --- */}
                <div className="space-y-[var(--gap-base)]">
                    <Card className="bg-surface border-border">
                        <CardHeader className="pb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-primary" /> Project Configuration
                            </CardTitle>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <select
                                    className="bg-background border-border text-xs text-foreground rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 flex-1 min-w-[120px]"
                                    onChange={(e) => handleLoadTemplate(e.target.value)}
                                    value=""
                                >
                                    <option value="" disabled>✨ Load Template</option>
                                    {savedTemplates.filter(t => ["kdp_coloring", "story", "image_gen", "custom"].includes(t.category)).map(t => (
                                        <option key={t.name} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                                <select
                                    className="bg-background border-border text-xs text-foreground rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 flex-1 min-w-[120px]"
                                    onChange={(e) => handleProjectSelect(e.target.value)}
                                    value={selectedProject || ""}
                                >
                                    <option value="" disabled>📂 Load Project</option>
                                    {projects.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-2">
                            {/* Create Project Section */}
                            <div className="p-3 bg-accent/30 rounded-xl border border-border/50 space-y-3">
                                <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">New Project</Label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    placeholder="Enter project name..."
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="h-9 bg-background border-border text-sm flex-1"
                                />
                                <Button onClick={handleCreateProject} disabled={!projectName.trim()} className="h-9 bg-primary text-primary-foreground font-bold px-4 w-full sm:w-auto">
                                    Create
                                </Button>
                            </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground font-medium">Topic / Subject</Label>
                                    <Input
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        className="bg-background border-border h-9"
                                        placeholder="e.g. Mandala Art"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground font-medium">Character / Style</Label>
                                    <Input
                                        value={character}
                                        onChange={(e) => setCharacter(e.target.value)}
                                        className="bg-background border-border h-9"
                                        placeholder="e.g. Coloring Book, Line Art"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground font-medium">Number of Prompts</Label>
                                    <Input
                                        type="number"
                                        value={numberN}
                                        onChange={(e) => setNumberN(parseInt(e.target.value) || 1)}
                                        className="bg-background border-border h-9"
                                    />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label className="text-xs text-muted-foreground font-medium">Whisk Account</Label>
                                    <select
                                        value={whiskAccountId}
                                        onChange={(e) => setWhiskAccountId(e.target.value)}
                                        className="w-full bg-background border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary"
                                    >
                                        {whiskAccounts.length === 0 ? (
                                            <option value="whisk_default">whisk_default</option>
                                        ) : (
                                            whiskAccounts.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/40 px-3 py-2">
                                <div>
                                    <p className="text-xs font-semibold text-foreground">Advanced Prompt Controls</p>
                                    <p className="text-[11px] text-muted-foreground">Mode simple menyembunyikan system prompt, prefix, dan suffix.</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => setShowAdvanced((prev) => !prev)}
                                >
                                    {showAdvanced ? "Simple Mode" : "Advanced Mode"}
                                </Button>
                            </div>

                            {showAdvanced && (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground font-medium">System Prompt (AI Logic)</Label>
                                        <Textarea
                                            rows={4}
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                            className="bg-background border-border text-sm leading-relaxed"
                                            placeholder="Tell the AI how to behave..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground font-medium">Prefix (Always Before)</Label>
                                            <Input
                                                value={prefix}
                                                onChange={(e) => setPrefix(e.target.value)}
                                                className="bg-background border-border h-9 text-xs"
                                                placeholder="e.g. A black and white..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground font-medium">Suffix (Always After)</Label>
                                            <Input
                                                value={suffix}
                                                onChange={(e) => setSuffix(e.target.value)}
                                                className="bg-background border-border h-9 text-xs"
                                                placeholder="e.g. --ar 8.5:11"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Button
                                    onClick={handleGenerate}
                                    disabled={isLoading || !systemPrompt.trim()}
                                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-bold shadow-lg shadow-primary/20"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                    Generate Image Prompts
                                </Button>
                                <Button
                                    onClick={handleSavePrompts}
                                    disabled={!selectedProject || prompts.length === 0}
                                    variant="outline"
                                    className="border-primary/30 text-primary hover:bg-primary/5 h-10 font-bold px-6 w-full sm:w-auto"
                                >
                                    Save to Project
                                </Button>
                            </div>

                            {error && (
                                <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-medium animate-in slide-in-from-top-2">
                                    ⚠️ {error}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* --- RIGHT PANEL: Results --- */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-foreground">
                            <CheckCheck className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-bold uppercase tracking-wider">Generated Results ({prompts.length})</h3>
                        </div>
                        {prompts.length > 0 && (
                            <span className="text-[10px] font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                                {selectedProject ? `Ready to save to ${selectedProject}` : "Create project to save"}
                            </span>
                        )}
                    </div>

                    <div className="space-y-3 max-h-[70vh] sm:max-h-[75vh] overflow-y-auto pr-1 sm:pr-2 scrollbar-thin">
                        {prompts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-border rounded-3xl text-muted-foreground/40 bg-surface/30">
                                <Wand2 className="w-12 h-12 mb-4 opacity-10" />
                                <p className="text-sm font-medium italic">Your creative ideas will appear here...</p>
                                <p className="text-xs mt-1">Configure settings and click Generate</p>
                            </div>
                        ) : (
                            prompts.map((p, i) => (
                                <Card key={i} className="group relative bg-surface border-border hover:border-primary/50 transition-all duration-300 rounded-2xl overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                    <CardContent className="p-4">
                                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                            <div className="flex-1 space-y-2 w-full">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">PROMPT #{i + 1}</span>
                                                </div>
                                                <p className="text-sm text-foreground leading-relaxed font-medium break-words">{p}</p>
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    <span className="text-[10px] text-muted-foreground bg-accent/50 px-2 py-0.5 rounded border border-border/50">Prefix: {prefix || "none"}</span>
                                                    <span className="text-[10px] text-muted-foreground bg-accent/50 px-2 py-0.5 rounded border border-border/50">Suffix: {suffix || "none"}</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all self-end sm:self-start"
                                                onClick={() => handleCopy(p, i)}
                                            >
                                                {copiedIndex === i ? <CheckCheck className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {selectedProject && (
                <div className="sticky bottom-3 z-20 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                            Next step untuk <span className="font-semibold text-foreground">{selectedProject}</span>: lanjutkan ke curation atau buka detail project.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/project-manager/${encodeURIComponent(selectedProject)}`)}
                            >
                                Buka Project Detail
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => router.push(`/kdp/curation?project=${encodeURIComponent(selectedProject)}`)}
                            >
                                Lanjut ke Curation
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
