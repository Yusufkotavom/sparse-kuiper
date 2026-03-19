"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { settingsApi, PromptTemplate, LooperPreset, TelegramSettings, getApiBase, DEFAULT_API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { LooperPresetFields } from "@/components/studio/LooperConfig";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Save,
    X,
    BookOpen,
    Video,
    Image as ImageIcon,
    Sparkles,
    Tag,
    FileText,
    RotateCcw,
    Bot,
    CheckCircle2,
    Settings2,
    Layers,
    Clock,
    Scissors,
    Volume2,
    VolumeX,
    Zap,
    Monitor,
    Send,
} from "lucide-react";

const CATEGORIES = [
    { value: "kdp_coloring", label: "KDP Coloring", icon: BookOpen, color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
    { value: "story", label: "Story", icon: FileText, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    { value: "video", label: "Video", icon: Video, color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
    { value: "image_gen", label: "Image Gen", icon: ImageIcon, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { value: "custom", label: "Custom", icon: Tag, color: "bg-muted/50 text-muted-foreground border-border" },
];

function getCategoryMeta(value: string) {
    return CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

const EMPTY_TEMPLATE: PromptTemplate = {
    name: "",
    category: "custom",
    system_prompt: "",
    prefix: "",
    suffix: "",
};

const EMPTY_LOOPER_PRESET: LooperPreset = {
    name: "",
    description: "",
    mode: "manual",
    default_loops: 3,
    target_duration: 15,
    cut_start: 3.0,
    disable_crossfade: false,
    crossfade_duration: 1.5,
    quality: "high",
    resolution: "original",
    mute_original_audio: false,
    enable_audio_fade: false,
    audio_fade_duration: 2.0,
    effect_zoom_crop: false,
    effect_zoom_mode: "random",
    effect_zoom_percent: 90,
    watermark_scale: 50,
    watermark_opacity: 100,
    watermark_position: "bottom_right",
    watermark_margin_x: 24,
    watermark_margin_y: 24,
};

const DEFAULT_METADATA_PROMPT = `You are a viral social media manager. Based on the provided video title and channel, create:
1. A catchy, viral Title (max 60 chars)
2. An engaging Description (2-3 sentences max) with a call to action
3. A list of 5-8 highly relevant, viral hashtags

Respond ONLY in valid JSON format with the keys: "title", "description", "tags".
Example: {"title": "Viral Cat!", "description": "Watch this amazing cat. Follow for more!", "tags": "#cat #viral #funny"}`;

type SettingsSection = "ai" | "prompts" | "looper" | "integrations" | "workspace";

export default function SettingsPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [looperPresets, setLooperPresets] = useState<LooperPreset[]>([]);
    const [search, setSearch] = useState("");
    const [looperSearch, setLooperSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingOriginalName, setEditingOriginalName] = useState<string | null>(null);
    const [form, setForm] = useState<PromptTemplate>({ ...EMPTY_TEMPLATE });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Looper Preset state
    const [isEditingLooper, setIsEditingLooper] = useState(false);
    const [editingLooperOriginalName, setEditingLooperOriginalName] = useState<string | null>(null);
    const [looperForm, setLooperForm] = useState<LooperPreset>({ ...EMPTY_LOOPER_PRESET });
    const [isSavingLooper, setIsSavingLooper] = useState(false);
    const [deleteLooperConfirm, setDeleteLooperConfirm] = useState<string | null>(null);

    // AI Metadata Prompt state
    const [metadataPrompt, setMetadataPrompt] = useState(DEFAULT_METADATA_PROMPT);
    const [isSavingMetaPrompt, setIsSavingMetaPrompt] = useState(false);
    const [metaPromptSaved, setMetaPromptSaved] = useState(false);

    const [groqKeyInput, setGroqKeyInput] = useState("");
    const [groqMasked, setGroqMasked] = useState("");
    const [groqHasKey, setGroqHasKey] = useState(false);
    const [isSavingGroqKey, setIsSavingGroqKey] = useState(false);
    const [groqSaved, setGroqSaved] = useState(false);
    const [groqModel, setGroqModel] = useState("");
    const [groqModelInput, setGroqModelInput] = useState("");
    const [groqModelSaved, setGroqModelSaved] = useState(false);

    const [openaiKeyInput, setOpenaiKeyInput] = useState("");
    const [openaiMasked, setOpenaiMasked] = useState("");
    const [openaiHasKey, setOpenaiHasKey] = useState(false);
    const [isSavingOpenaiKey, setIsSavingOpenaiKey] = useState(false);
    const [openaiSaved, setOpenaiSaved] = useState(false);

    const [geminiKeyInput, setGeminiKeyInput] = useState("");
    const [geminiMasked, setGeminiMasked] = useState("");
    const [geminiHasKey, setGeminiHasKey] = useState(false);
    const [isSavingGeminiKey, setIsSavingGeminiKey] = useState(false);
    const [geminiSaved, setGeminiSaved] = useState(false);

    const [azureEndpointInput, setAzureEndpointInput] = useState("");
    const [azureDeploymentInput, setAzureDeploymentInput] = useState("");
    const [azureApiVersionInput, setAzureApiVersionInput] = useState("");
    const [azureKeyInput, setAzureKeyInput] = useState("");
    const [azureMasked, setAzureMasked] = useState("");
    const [azureHasKey, setAzureHasKey] = useState(false);
    const [isSavingAzure, setIsSavingAzure] = useState(false);
    const [azureSaved, setAzureSaved] = useState(false);

    const [activeSection, setActiveSection] = useState<SettingsSection>("ai");
    const [apiBaseInput, setApiBaseInput] = useState("");
    const [apiHealth, setApiHealth] = useState<"idle" | "checking" | "ok" | "error">("idle");
    const [apiHealthMessage, setApiHealthMessage] = useState("");
    const [telegramEnabled, setTelegramEnabled] = useState(false);
    const [telegramBotTokenInput, setTelegramBotTokenInput] = useState("");
    const [telegramChatIdInput, setTelegramChatIdInput] = useState("");
    const [telegramStatus, setTelegramStatus] = useState<TelegramSettings | null>(null);
    const [isSavingTelegram, setIsSavingTelegram] = useState(false);
    const [telegramSaved, setTelegramSaved] = useState(false);
    const [isTestingTelegram, setIsTestingTelegram] = useState(false);
    const [dbFlushConfirm, setDbFlushConfirm] = useState("");
    const [dbFlushFlags, setDbFlushFlags] = useState({
        clear_upload_queue: true,
        clear_queue_files: true,
        clear_generation_tasks: true,
        clear_realtime_events: true,
        clear_asset_metadata: true,
        clear_project_configs: true,
        clear_non_prompt_app_settings: false,
        clear_accounts: false,
    });
    const [isFlushingDb, setIsFlushingDb] = useState(false);
    const [forceRemoveFilename, setForceRemoveFilename] = useState("");
    const [forceRemoveConfirm, setForceRemoveConfirm] = useState("");
    const [forceRemoveFlags, setForceRemoveFlags] = useState({
        remove_from_disk: true,
        remove_from_db: true,
    });
    const [isForceRemoving, setIsForceRemoving] = useState(false);

    useEffect(() => {
        loadTemplates();
        loadLooperPresets();
        loadMetadataPrompt();
        loadGroqKeyStatus();
        loadOpenaiKeyStatus();
        loadGeminiKeyStatus();
        loadAzureOpenaiStatus();
        loadTelegramStatus();
        try {
            const currentBase = getApiBase();
            setApiBaseInput(currentBase);
            if (typeof window !== "undefined") {
                const storedModel = window.localStorage.getItem("sk_groq_model");
                if (storedModel && storedModel.trim()) {
                    setGroqModel(storedModel.trim());
                    setGroqModelInput(storedModel.trim());
                }
            }
        } catch {}
    }, []);

    const loadTemplates = async () => {
        try {
            const data = await settingsApi.listTemplates();
            setTemplates(data);
        } catch (e) {
            console.error("Failed to load templates", e);
        }
    };

    const loadLooperPresets = async () => {
        try {
            const data = await settingsApi.listLooperPresets();
            setLooperPresets(data);
        } catch (e) {
            console.error("Failed to load looper presets", e);
        }
    };

    const loadMetadataPrompt = async () => {
        try {
            const res = await fetch(`${getApiBase()}/settings/system-prompts/metadata_generate`);
            if (res.ok) {
                const data = await res.json();
                setMetadataPrompt(data.value || DEFAULT_METADATA_PROMPT);
            }
        } catch (e) {
            console.error("Failed to load metadata prompt", e);
        }
    };

    const loadGroqKeyStatus = async () => {
        try {
            const res = await settingsApi.getGroqApiKey();
            setGroqHasKey(Boolean(res.has_key));
            setGroqMasked(res.masked || "");
        } catch (e) {
            console.error("Failed to load Groq key status", e);
        }
    };

    const loadOpenaiKeyStatus = async () => {
        try {
            const res = await settingsApi.getOpenAiApiKey();
            setOpenaiHasKey(Boolean(res.has_key));
            setOpenaiMasked(res.masked || "");
        } catch (e) {
            console.error("Failed to load OpenAI key status", e);
        }
    };

    const loadGeminiKeyStatus = async () => {
        try {
            const res = await settingsApi.getGeminiApiKey();
            setGeminiHasKey(Boolean(res.has_key));
            setGeminiMasked(res.masked || "");
        } catch (e) {
            console.error("Failed to load Gemini key status", e);
        }
    };

    const loadAzureOpenaiStatus = async () => {
        try {
            const res = await settingsApi.getAzureOpenAi();
            setAzureHasKey(Boolean(res.has_key));
            setAzureMasked(res.masked || "");
            setAzureEndpointInput(res.endpoint || "");
            setAzureDeploymentInput(res.deployment || "");
            setAzureApiVersionInput(res.api_version || "");
        } catch (e) {
            console.error("Failed to load Azure OpenAI status", e);
        }
    };

    const loadTelegramStatus = async () => {
        try {
            const res = await settingsApi.getTelegramSettings();
            setTelegramStatus(res);
            setTelegramEnabled(Boolean(res.enabled));
            setTelegramChatIdInput(res.chat_id || "");
        } catch (e) {
            console.error("Failed to load Telegram settings", e);
        }
    };

    const handleSaveGroqKey = async () => {
        if (!groqKeyInput.trim()) return;
        setIsSavingGroqKey(true);
        try {
            await settingsApi.setGroqApiKey(groqKeyInput.trim());
            setGroqKeyInput("");
            await loadGroqKeyStatus();
            setGroqSaved(true);
            setTimeout(() => setGroqSaved(false), 2000);
        } catch (e) {
            console.error("Failed to save Groq key", e);
            toast.error(e instanceof Error ? e.message : "Failed to save Groq key");
        } finally {
            setIsSavingGroqKey(false);
        }
    };

    const handleSaveOpenaiKey = async () => {
        if (!openaiKeyInput.trim()) return;
        setIsSavingOpenaiKey(true);
        try {
            await settingsApi.setOpenAiApiKey(openaiKeyInput.trim());
            setOpenaiKeyInput("");
            await loadOpenaiKeyStatus();
            setOpenaiSaved(true);
            setTimeout(() => setOpenaiSaved(false), 2000);
        } catch (e) {
            console.error("Failed to save OpenAI key", e);
            toast.error(e instanceof Error ? e.message : "Failed to save OpenAI key");
        } finally {
            setIsSavingOpenaiKey(false);
        }
    };

    const handleSaveGeminiKey = async () => {
        if (!geminiKeyInput.trim()) return;
        setIsSavingGeminiKey(true);
        try {
            await settingsApi.setGeminiApiKey(geminiKeyInput.trim());
            setGeminiKeyInput("");
            await loadGeminiKeyStatus();
            setGeminiSaved(true);
            setTimeout(() => setGeminiSaved(false), 2000);
        } catch (e) {
            console.error("Failed to save Gemini key", e);
            toast.error(e instanceof Error ? e.message : "Failed to save Gemini key");
        } finally {
            setIsSavingGeminiKey(false);
        }
    };

    const handleSaveAzureOpenai = async () => {
        setIsSavingAzure(true);
        try {
            const payload: { endpoint?: string; deployment?: string; api_version?: string; api_key?: string } = {
                endpoint: azureEndpointInput.trim(),
                deployment: azureDeploymentInput.trim(),
                api_version: azureApiVersionInput.trim(),
            };
            if (azureKeyInput.trim()) payload.api_key = azureKeyInput.trim();
            await settingsApi.setAzureOpenAi(payload);
            setAzureKeyInput("");
            await loadAzureOpenaiStatus();
            setAzureSaved(true);
            setTimeout(() => setAzureSaved(false), 2000);
        } catch (e) {
            console.error("Failed to save Azure OpenAI settings", e);
            toast.error(e instanceof Error ? e.message : "Failed to save Azure OpenAI settings");
        } finally {
            setIsSavingAzure(false);
        }
    };

    const handleFlushDatabase = async () => {
        if (dbFlushConfirm.trim().toUpperCase() !== "FLUSH") {
            toast.error("Ketik FLUSH untuk konfirmasi.");
            return;
        }
        setIsFlushingDb(true);
        try {
            const res = await settingsApi.flushDatabase({
                confirm_text: dbFlushConfirm,
                ...dbFlushFlags,
            });
            const removedFiles = typeof res.deleted_files === "number" ? ` Queue files removed: ${res.deleted_files}.` : "";
            const failedFiles = Array.isArray(res.failed_queue_files) ? res.failed_queue_files.length : 0;
            if (failedFiles > 0) {
                toast.error(`${res.message || "Database flush completed with warnings."}${removedFiles} Failed to remove ${failedFiles} queue file(s).`);
            } else {
                toast.success((res.message || "Database flush completed.") + removedFiles);
            }
            setDbFlushConfirm("");
        } catch (e) {
            console.error("Failed to flush database", e);
            toast.error(e instanceof Error ? e.message : "Failed to flush database");
        } finally {
            setIsFlushingDb(false);
        }
    };

    const handleForceRemoveQueueItem = async () => {
        if (!forceRemoveFilename.trim()) {
            toast.error("Isi filename queue yang ingin dihapus paksa.");
            return;
        }
        if (forceRemoveConfirm.trim().toUpperCase() !== "FLUSH") {
            toast.error("Ketik FLUSH untuk konfirmasi force remove.");
            return;
        }
        setIsForceRemoving(true);
        try {
            const res = await settingsApi.forceRemoveQueueItem({
                confirm_text: forceRemoveConfirm,
                filename: forceRemoveFilename.trim(),
                ...forceRemoveFlags,
            });
            const failed = Array.isArray(res.failed_files) ? res.failed_files.length : 0;
            if (failed > 0) {
                toast.error(`${res.message} Removed files: ${res.removed_files?.length || 0}. Failed files: ${failed}.`);
            } else {
                toast.success(`${res.message} DB rows: ${res.deleted_upload_queue_rows}. Files: ${res.removed_files?.length || 0}.`);
            }
            setForceRemoveConfirm("");
        } catch (e) {
            console.error("Failed to force remove queue item", e);
            toast.error(e instanceof Error ? e.message : "Failed to force remove queue item");
        } finally {
            setIsForceRemoving(false);
        }
    };

    const handleSaveGroqModel = () => {
        const value = groqModelInput.trim();
        if (!value) return;
        try {
            if (typeof window !== "undefined") {
                window.localStorage.setItem("sk_groq_model", value);
            }
            setGroqModel(value);
            setGroqModelSaved(true);
            setTimeout(() => setGroqModelSaved(false), 2000);
        } catch {}
    };

    const handleSaveTelegram = async () => {
        setIsSavingTelegram(true);
        try {
            const payload: { enabled: boolean; bot_token?: string; chat_id?: string } = {
                enabled: telegramEnabled,
                chat_id: telegramChatIdInput.trim(),
            };
            if (telegramBotTokenInput.trim()) {
                payload.bot_token = telegramBotTokenInput.trim();
            }
            await settingsApi.setTelegramSettings(payload);
            setTelegramBotTokenInput("");
            await loadTelegramStatus();
            setTelegramSaved(true);
            setTimeout(() => setTelegramSaved(false), 2000);
        } catch (e) {
            console.error("Failed to save Telegram settings", e);
            toast.error(e instanceof Error ? e.message : "Failed to save Telegram settings");
        } finally {
            setIsSavingTelegram(false);
        }
    };

    const handleTestTelegram = async () => {
        setIsTestingTelegram(true);
        try {
            await settingsApi.testTelegramSettings("Telegram test message from sparse-kuiper App Settings.");
            toast.success("Telegram test message sent.");
        } catch (e) {
            console.error("Failed to send Telegram test message", e);
            toast.error(e instanceof Error ? e.message : "Failed to send Telegram test message");
        } finally {
            setIsTestingTelegram(false);
        }
    };

    const handleSaveApiBase = () => {
        const value = apiBaseInput.trim();
        try {
            if (typeof window !== "undefined") {
                if (value) {
                    window.localStorage.setItem("sk_api_base_url", value);
                } else {
                    window.localStorage.removeItem("sk_api_base_url");
                }
            }
            setApiHealth("idle");
            setApiHealthMessage("");
        } catch {}
    };

    const handleCheckApiHealth = async () => {
        setApiHealth("checking");
        setApiHealthMessage("");
        try {
            const base = getApiBase();
            const res = await fetch(`${base}/kdp/projects`, { method: "GET" });
            if (res.ok) {
                setApiHealth("ok");
                setApiHealthMessage("Backend reachable");
            } else {
                setApiHealth("error");
                setApiHealthMessage(`Status ${res.status}`);
            }
        } catch (e) {
            setApiHealth("error");
            setApiHealthMessage(e instanceof Error ? e.message : "Request failed");
        }
    };

    const handleSaveMetadataPrompt = async () => {
        setIsSavingMetaPrompt(true);
        try {
            const res = await fetch(`${getApiBase()}/settings/system-prompts/metadata_generate`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: metadataPrompt }),
            });
            if (res.ok) {
                setMetaPromptSaved(true);
                setTimeout(() => setMetaPromptSaved(false), 2000);
            }
        } catch (e) {
            console.error("Failed to save metadata prompt", e);
        } finally {
            setIsSavingMetaPrompt(false);
        }
    };

    // --- Filtered list ---
    const filtered = templates.filter((t) => {
        const matchSearch =
            search === "" ||
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.system_prompt.toLowerCase().includes(search.toLowerCase());
        const matchCategory = !filterCategory || t.category === filterCategory;
        return matchSearch && matchCategory;
    });

    // --- CRUD Handlers ---
    const handleNew = () => {
        setForm({ ...EMPTY_TEMPLATE });
        setEditingOriginalName(null);
        setIsEditing(true);
    };

    const handleEdit = (t: PromptTemplate) => {
        setForm({ ...t });
        setEditingOriginalName(t.name);
        setIsEditing(true);
    };

    const handleDelete = async (name: string) => {
        try {
            await settingsApi.deleteTemplate(name);
            setDeleteConfirm(null);
            await loadTemplates();
        } catch (e) {
            console.error("Failed to delete template", e);
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setIsSaving(true);
        try {
            if (editingOriginalName) {
                // Update existing
                await settingsApi.updateTemplate(editingOriginalName, {
                    name: form.name,
                    category: form.category,
                    system_prompt: form.system_prompt,
                    prefix: form.prefix,
                    suffix: form.suffix,
                });
            } else {
                // Create new
                await settingsApi.createTemplate(form);
            }
            setIsEditing(false);
            setEditingOriginalName(null);
            setForm({ ...EMPTY_TEMPLATE });
            await loadTemplates();
        } catch (e) {
            console.error("Failed to save template", e);
            toast.error(e instanceof Error ? e.message : "Save failed");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditingOriginalName(null);
        setForm({ ...EMPTY_TEMPLATE });
    };

    // --- Looper CRUD Handlers ---
    const handleNewLooper = () => {
        setLooperForm({ ...EMPTY_LOOPER_PRESET });
        setEditingLooperOriginalName(null);
        setIsEditingLooper(true);
    };

    const handleEditLooper = (p: LooperPreset) => {
        setLooperForm({ ...p });
        setEditingLooperOriginalName(p.name);
        setIsEditingLooper(true);
    };

    const handleDeleteLooper = async (name: string) => {
        try {
            await settingsApi.deleteLooperPreset(name);
            setDeleteLooperConfirm(null);
            await loadLooperPresets();
        } catch (e) {
            console.error("Failed to delete looper preset", e);
        }
    };

    const handleSaveLooper = async () => {
        if (!looperForm.name.trim()) return;
        setIsSavingLooper(true);
        try {
            if (editingLooperOriginalName) {
                await settingsApi.updateLooperPreset(editingLooperOriginalName, looperForm);
            } else {
                await settingsApi.createLooperPreset(looperForm);
            }
            setIsEditingLooper(false);
            setEditingLooperOriginalName(null);
            setLooperForm({ ...EMPTY_LOOPER_PRESET });
            await loadLooperPresets();
        } catch (e) {
            console.error("Failed to save looper preset", e);
            toast.error(e instanceof Error ? e.message : "Save failed");
        } finally {
            setIsSavingLooper(false);
        }
    };

    const handleCancelLooper = () => {
        setIsEditingLooper(false);
        setEditingLooperOriginalName(null);
        setLooperForm({ ...EMPTY_LOOPER_PRESET });
    };

    const filteredLooper = looperPresets.filter((p) => {
        return (
            looperSearch === "" ||
            p.name.toLowerCase().includes(looperSearch.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(looperSearch.toLowerCase()))
        );
    });

    return (
        <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6 lg:flex-row">
            <aside className="w-full lg:w-64 flex-shrink-0 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Settings</h2>
                <button
                    type="button"
                    onClick={() => setActiveSection("ai")}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs flex items-center justify-between ${
                        activeSection === "ai"
                            ? "bg-surface text-foreground border border-border"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5" />
                        AI & API
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection("prompts")}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs flex items-center justify-between ${
                        activeSection === "prompts"
                            ? "bg-surface text-foreground border border-border"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        Prompt Templates
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection("looper")}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs flex items-center justify-between ${
                        activeSection === "looper"
                            ? "bg-surface text-foreground border border-border"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Looper Presets
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection("integrations")}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs flex items-center justify-between ${
                        activeSection === "integrations"
                            ? "bg-surface text-foreground border border-border"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Video className="w-3.5 h-3.5" />
                        Integrations
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection("workspace")}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs flex items-center justify-between ${
                        activeSection === "workspace"
                            ? "bg-surface text-foreground border border-border"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5" />
                        Workspace
                    </span>
                </button>
            </aside>

            <section className="flex-1 space-y-6">
                <div className="mb-2">
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Settings</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Kelola konfigurasi AI, API, prompt templates, dan info workspace.
                    </p>
                </div>

                {activeSection === "ai" && (
                    <div className="space-y-6">
                        <Card className="bg-surface border-border">
                            <CardHeader className="pb-3 border-b border-border/50">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-violet-400" />
                                            Groq API
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Key disimpan di server. Status:{" "}
                                            <span className="text-foreground">
                                                {groqHasKey ? `configured (${groqMasked})` : "not configured"}
                                            </span>
                                            . Model default disimpan lokal per browser.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveGroqKey}
                                        disabled={isSavingGroqKey || !groqKeyInput.trim()}
                                        className={`h-8 text-xs font-semibold transition-all w-full sm:w-auto ${
                                            groqSaved ? "bg-emerald-600 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"
                                        }`}
                                    >
                                        {groqSaved ? (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Saved!
                                            </>
                                        ) : isSavingGroqKey ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-3.5 h-3.5 mr-1.5" /> Save Key
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)] items-end">
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Groq API Key</Label>
                                        <Input
                                            type="password"
                                            value={groqKeyInput}
                                            onChange={(e) => setGroqKeyInput(e.target.value)}
                                            placeholder="gsk_..."
                                            className="bg-background border-border text-foreground text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Default model</Label>
                                        <div className="flex gap-2">
                                            <select
                                                value=""
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    if (!v) return;
                                                    setGroqModelInput(v);
                                                }}
                                                className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                                            >
                                                <option value="">Choose preset…</option>
                                                <option value="llama-3.1-70b">llama-3.1-70b</option>
                                                <option value="llama-3.1-8b">llama-3.1-8b</option>
                                            </select>
                                            <Input
                                                value={groqModelInput}
                                                onChange={(e) => setGroqModelInput(e.target.value)}
                                                placeholder="custom-model-name"
                                                className="h-9 w-40 bg-background border-border text-xs"
                                            />
                                            <Button
                                                size="sm"
                                                type="button"
                                                onClick={handleSaveGroqModel}
                                                disabled={!groqModelInput.trim()}
                                                className={`h-9 text-[11px] ${
                                                    groqModelSaved
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-muted hover:bg-muted/80 text-foreground"
                                                }`}
                                            >
                                                {groqModelSaved ? "Saved" : "Save"}
                                            </Button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            Current model:{" "}
                                            <span className="font-mono text-foreground">
                                                {groqModel || "use backend default"}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface border-border">
                            <CardHeader className="pb-3 border-b border-border/50">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-violet-400" />
                                            OpenAI API
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Key disimpan di server. Status:{" "}
                                            <span className="text-foreground">
                                                {openaiHasKey ? `configured (${openaiMasked})` : "not configured"}
                                            </span>
                                            . Pakai format model <span className="font-mono text-foreground">openai:gpt-4o-mini</span> di field model custom.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveOpenaiKey}
                                        disabled={isSavingOpenaiKey || !openaiKeyInput.trim()}
                                        className={`h-8 text-xs font-semibold transition-all w-full sm:w-auto ${
                                            openaiSaved ? "bg-emerald-600 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"
                                        }`}
                                    >
                                        {openaiSaved ? (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Saved!
                                            </>
                                        ) : isSavingOpenaiKey ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-3.5 h-3.5 mr-1.5" /> Save Key
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-muted-foreground text-xs">OpenAI API Key</Label>
                                    <Input
                                        type="password"
                                        value={openaiKeyInput}
                                        onChange={(e) => setOpenaiKeyInput(e.target.value)}
                                        placeholder="sk-..."
                                        className="bg-background border-border text-foreground text-sm"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface border-border">
                            <CardHeader className="pb-3 border-b border-border/50">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-violet-400" />
                                            Gemini API
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Key disimpan di server. Status:{" "}
                                            <span className="text-foreground">
                                                {geminiHasKey ? `configured (${geminiMasked})` : "not configured"}
                                            </span>
                                            . Pakai format model <span className="font-mono text-foreground">gemini:gemini-1.5-flash</span> di field model custom.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveGeminiKey}
                                        disabled={isSavingGeminiKey || !geminiKeyInput.trim()}
                                        className={`h-8 text-xs font-semibold transition-all w-full sm:w-auto ${
                                            geminiSaved ? "bg-emerald-600 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"
                                        }`}
                                    >
                                        {geminiSaved ? (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Saved!
                                            </>
                                        ) : isSavingGeminiKey ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-3.5 h-3.5 mr-1.5" /> Save Key
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-muted-foreground text-xs">Gemini API Key</Label>
                                    <Input
                                        type="password"
                                        value={geminiKeyInput}
                                        onChange={(e) => setGeminiKeyInput(e.target.value)}
                                        placeholder="AIza..."
                                        className="bg-background border-border text-foreground text-sm"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface border-border">
                            <CardHeader className="pb-3 border-b border-border/50">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-violet-400" />
                                            Azure OpenAI
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Endpoint + deployment disimpan di server. Status key:{" "}
                                            <span className="text-foreground">
                                                {azureHasKey ? `configured (${azureMasked})` : "not configured"}
                                            </span>
                                            . Pakai format model <span className="font-mono text-foreground">azure:deployment-name</span> di field model custom.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveAzureOpenai}
                                        disabled={isSavingAzure}
                                        className={`h-8 text-xs font-semibold transition-all w-full sm:w-auto ${
                                            azureSaved ? "bg-emerald-600 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"
                                        }`}
                                    >
                                        {azureSaved ? (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Saved!
                                            </>
                                        ) : isSavingAzure ? (
                                            "Saving..."
                                        ) : (
                                            <>
                                                <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Endpoint</Label>
                                        <Input
                                            value={azureEndpointInput}
                                            onChange={(e) => setAzureEndpointInput(e.target.value)}
                                            placeholder="https://your-resource.openai.azure.com"
                                            className="bg-background border-border text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Deployment</Label>
                                        <Input
                                            value={azureDeploymentInput}
                                            onChange={(e) => setAzureDeploymentInput(e.target.value)}
                                            placeholder="gpt-4o-mini"
                                            className="bg-background border-border text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">API Version</Label>
                                        <Input
                                            value={azureApiVersionInput}
                                            onChange={(e) => setAzureApiVersionInput(e.target.value)}
                                            placeholder="2024-02-15-preview"
                                            className="bg-background border-border text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">API Key (opsional)</Label>
                                        <Input
                                            type="password"
                                            value={azureKeyInput}
                                            onChange={(e) => setAzureKeyInput(e.target.value)}
                                            placeholder="********"
                                            className="bg-background border-border text-xs"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface border-border">
                            <CardHeader className="pb-3 border-b border-border/50">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Tag className="w-4 h-4 text-sky-400" />
                                            Workspace API
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1 space-y-0.5">
                                            <p>
                                                Default API URL dari env:{" "}
                                                <span className="font-mono text-foreground">{DEFAULT_API_BASE_URL}</span>
                                            </p>
                                            <p>
                                                Client override per browser:{" "}
                                                <span className="font-mono text-foreground">{getApiBase()}</span>
                                            </p>
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-muted-foreground text-xs">Client API base URL</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={apiBaseInput}
                                            onChange={(e) => setApiBaseInput(e.target.value)}
                                            placeholder={DEFAULT_API_BASE_URL}
                                            className="bg-background border-border text-xs"
                                        />
                                        <Button
                                            size="sm"
                                            type="button"
                                            onClick={handleSaveApiBase}
                                            className="h-9 text-[11px]"
                                        >
                                            Save URL
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Kosongkan lalu simpan untuk kembali menggunakan env NEXT_PUBLIC_API_URL.
                                    </p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <span
                                            className={`inline-flex h-2 w-2 rounded-full ${
                                                apiHealth === "ok"
                                                    ? "bg-emerald-500"
                                                    : apiHealth === "error"
                                                    ? "bg-red-500"
                                                    : apiHealth === "checking"
                                                    ? "bg-amber-400"
                                                    : "bg-muted-foreground/50"
                                            }`}
                                        />
                                        <span className="text-muted-foreground">
                                            {apiHealth === "ok"
                                                ? "API healthy"
                                                : apiHealth === "error"
                                                ? "API error"
                                                : apiHealth === "checking"
                                                ? "Checking…"
                                                : "Idle"}
                                            {apiHealthMessage ? ` · ${apiHealthMessage}` : ""}
                                        </span>
                                    </div>
                                    <Button
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                        onClick={handleCheckApiHealth}
                                        className="h-8 text-[11px]"
                                    >
                                        Check API health
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                )}

                {activeSection === "prompts" && (
                    <div className="space-y-6">
                        <Card className="bg-surface border-border">
                            <CardHeader className="pb-3 border-b border-border/50">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-violet-400" />
                                            AI Metadata Generate Prompt
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            System prompt yang digunakan saat tombol{" "}
                                            <span className="text-violet-300 font-medium">✨ Generate with AI</span>{" "}
                                            ditekan di halaman Downloads.
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs text-muted-foreground hover:text-foreground border border-border flex-1 sm:flex-initial"
                                            onClick={() => setMetadataPrompt(DEFAULT_METADATA_PROMPT)}
                                        >
                                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveMetadataPrompt}
                                            disabled={isSavingMetaPrompt}
                                            className={`h-8 text-xs font-semibold transition-all flex-1 sm:flex-initial ${
                                                metaPromptSaved
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-violet-600 hover:bg-violet-700 text-white"
                                            }`}
                                        >
                                            {metaPromptSaved ? (
                                                <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Saved!</>
                                            ) : isSavingMetaPrompt ? (
                                                "Saving..."
                                            ) : (
                                                <><Save className="w-3.5 h-3.5 mr-1.5" /> Save Prompt</>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <Textarea
                                    value={metadataPrompt}
                                    onChange={e => setMetadataPrompt(e.target.value)}
                                    rows={10}
                                    className="bg-background border-border text-foreground text-xs font-mono resize-y leading-relaxed"
                                    placeholder="Enter your metadata generation system prompt..."
                                />
                                <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
                                    {metadataPrompt.length} chars
                                </p>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <div className="mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-violet-400" />
                                    Prompt Template Manager
                                </h3>
                                <div className="flex gap-2 items-center w-full sm:w-auto">
                                    <div className="relative flex-1 sm:flex-initial">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Search templates..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="bg-background border-border text-foreground text-xs pl-8 h-8 w-full sm:w-56"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => router.push("/settings/prompt-playground")}
                                        className="text-xs h-8"
                                    >
                                        Prompt Playground
                                    </Button>
                                    <Button
                                        onClick={handleNew}
                                        className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-8 font-semibold"
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                                        New Template
                                    </Button>
                                </div>
                            </div>

                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    size="xs"
                                    variant={!filterCategory ? "secondary" : "outline"}
                                    onClick={() => setFilterCategory(null)}
                                    className={`rounded-full ${
                                        !filterCategory
                                            ? "text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    All ({templates.length})
                                </Button>
                                {CATEGORIES.map((cat) => {
                                    const count = templates.filter((t) => t.category === cat.value).length;
                                    const Icon = cat.icon;
                                    const selected = filterCategory === cat.value;
                                    return (
                                        <Button
                                            key={cat.value}
                                            size="xs"
                                            variant={selected ? "secondary" : "outline"}
                                            onClick={() =>
                                                setFilterCategory(selected ? null : cat.value)
                                            }
                                            className={`rounded-full flex items-center gap-1.5 ${
                                                selected
                                                    ? cat.color
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            <Icon className="w-3 h-3" />
                                            {cat.label} ({count})
                                        </Button>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className={`${isEditing ? "lg:col-span-1" : "lg:col-span-3"} space-y-3`}>
                                    {filtered.length === 0 ? (
                                        <Card className="bg-surface border-border">
                                            <CardContent className="py-12 text-center">
                                                <Sparkles className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                                                <p className="text-muted-foreground text-sm">
                                                    {templates.length === 0
                                                        ? "No templates yet. Click 'New Template' to get started."
                                                        : "No templates match your filter."}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <div
                                            className={`grid gap-3 ${
                                                isEditing ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                                            }`}
                                        >
                                            {filtered.map((t) => {
                                                const cat = getCategoryMeta(t.category);
                                                const CatIcon = cat.icon;
                                                const isSelected = editingOriginalName === t.name;

                                                return (
                                                    <Card
                                                        key={t.name}
                                                        className={`bg-surface border-border hover:border-border-hover transition-colors cursor-pointer group ${
                                                            isSelected ? "ring-1 ring-violet-500 border-violet-500/50" : ""
                                                        }`}
                                                        onClick={() => handleEdit(t)}
                                                    >
                                                        <CardContent className="p-4">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-sm font-semibold text-foreground truncate">
                                                                        {t.name}
                                                                    </h4>
                                                                    <span
                                                                        className={`inline-flex items-center gap-1 text-[10px] font-medium mt-1 px-2 py-0.5 rounded-full border ${cat.color}`}
                                                                    >
                                                                        <CatIcon className="w-2.5 h-2.5" />
                                                                        {cat.label}
                                                                    </span>
                                                                </div>
                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleEdit(t);
                                                                        }}
                                                                    >
                                                                        <Pencil className="w-3 h-3" />
                                                                    </Button>
                                                                    {deleteConfirm === t.name ? (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/50"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDelete(t.name);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeleteConfirm(t.name);
                                                                                setTimeout(
                                                                                    () => setDeleteConfirm(null),
                                                                                    3000
                                                                                );
                                                                            }}
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
                                                                {t.system_prompt
                                                                    ? t.system_prompt.slice(0, 120) +
                                                                      (t.system_prompt.length > 120 ? "..." : "")
                                                                    : "No system prompt configured."}
                                                            </p>
                                                            {(t.prefix || t.suffix) && (
                                                                <div className="flex gap-2 mt-2">
                                                                    {t.prefix && (
                                                                        <span className="text-[10px] text-muted-foreground bg-elevated px-1.5 py-0.5 rounded">
                                                                            Prefix ✓
                                                                        </span>
                                                                    )}
                                                                    {t.suffix && (
                                                                        <span className="text-[10px] text-muted-foreground bg-elevated px-1.5 py-0.5 rounded">
                                                                            Suffix ✓
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="lg:col-span-2">
                                    {isEditing && (
                                        <Card className="bg-surface border-border">
                                            <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between gap-3">
                                                <div>
                                                    <CardTitle className="text-sm font-semibold text-foreground">
                                                        {editingOriginalName ? "Edit Template" : "New Template"}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs mt-1">
                                                        Set system prompt dan optional prefix/suffix untuk digunakan ulang.
                                                    </CardDescription>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    onClick={handleCancel}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </CardHeader>
                                            <CardContent className="pt-4 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
                                                    <div className="space-y-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-muted-foreground">
                                                                Template Name
                                                            </Label>
                                                            <Input
                                                                value={form.name}
                                                                onChange={(e) =>
                                                                    setForm((prev) => ({
                                                                        ...prev,
                                                                        name: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="My Prompt Template"
                                                                className="bg-background border-border text-sm"
                                                                disabled={Boolean(editingOriginalName)}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-muted-foreground">
                                                                System Prompt
                                                            </Label>
                                                            <Textarea
                                                                value={form.system_prompt}
                                                                onChange={(e) =>
                                                                    setForm((prev) => ({
                                                                        ...prev,
                                                                        system_prompt: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="You are a helpful assistant..."
                                                                rows={6}
                                                                className="bg-background border-border text-xs font-mono leading-relaxed resize-y"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-muted-foreground">
                                                                Category
                                                            </Label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {CATEGORIES.map((cat) => {
                                                                    const Icon = cat.icon;
                                                                    const selected = form.category === cat.value;
                                                                    return (
                                                                        <button
                                                                            key={cat.value}
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setForm((prev) => ({
                                                                                    ...prev,
                                                                                    category: cat.value,
                                                                                }))
                                                                            }
                                                                            className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${
                                                                                selected
                                                                                    ? cat.color
                                                                                    : "border-border text-muted-foreground hover:text-foreground"
                                                                            }`}
                                                                        >
                                                                            <Icon className="w-3 h-3" />
                                                                            {cat.label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-muted-foreground">
                                                                Prefix
                                                            </Label>
                                                            <Textarea
                                                                value={form.prefix}
                                                                onChange={(e) =>
                                                                    setForm((prev) => ({
                                                                        ...prev,
                                                                        prefix: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="[TITLE]:"
                                                                rows={3}
                                                                className="bg-background border-border text-xs font-mono leading-snug resize-y"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-muted-foreground">
                                                                Suffix
                                                            </Label>
                                                            <Textarea
                                                                value={form.suffix}
                                                                onChange={(e) =>
                                                                    setForm((prev) => ({
                                                                        ...prev,
                                                                        suffix: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Return your answer in JSON."
                                                                rows={3}
                                                                className="bg-background border-border text-xs font-mono leading-snug resize-y"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        onClick={handleCancel}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={handleSave}
                                                        disabled={isSaving || !form.name.trim()}
                                                        className="bg-violet-600 hover:bg-violet-700 text-white"
                                                    >
                                                        {isSaving ? "Saving..." : "Save Template"}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === "looper" && (
                    <div className="space-y-6">
                        <div className="mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-sky-400" />
                                Video Looper Presets
                            </h3>
                            <div className="flex gap-2 items-center w-full sm:w-auto">
                                <div className="relative flex-1 sm:flex-initial">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search presets..."
                                        value={looperSearch}
                                        onChange={(e) => setLooperSearch(e.target.value)}
                                        className="bg-background border-border text-foreground text-xs pl-8 h-8 w-full sm:w-56"
                                    />
                                </div>
                                <Button
                                    onClick={handleNewLooper}
                                    className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-8 font-semibold"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                    New Preset
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className={`${isEditingLooper ? "lg:col-span-1" : "lg:col-span-3"} space-y-3`}>
                                {filteredLooper.length === 0 ? (
                                    <Card className="bg-surface border-border">
                                        <CardContent className="py-12 text-center">
                                            <RotateCcw className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                                            <p className="text-muted-foreground text-sm">
                                                {looperPresets.length === 0
                                                    ? "No looper presets yet. Click 'New Preset' to get started."
                                                    : "No presets match your search."}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div
                                        className={`grid gap-3 ${
                                            isEditingLooper ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                                        }`}
                                    >
                                        {filteredLooper.map((p) => (
                                            <Card
                                                key={p.name}
                                                className={`bg-surface border-border hover:border-border-hover transition-colors cursor-pointer group ${
                                                    editingLooperOriginalName === p.name ? "ring-1 ring-sky-500 border-sky-500/50" : ""
                                                }`}
                                                onClick={() => handleEditLooper(p)}
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-sm font-semibold text-foreground truncate">
                                                                {p.name}
                                                            </h4>
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 capitalize">
                                                                    {p.mode}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                                                    {p.resolution}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border capitalize">
                                                                    {p.quality}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditLooper(p);
                                                                }}
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </Button>
                                                            {deleteLooperConfirm === p.name ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/50"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteLooper(p.name);
                                                                    }}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeleteLooperConfirm(p.name);
                                                                        setTimeout(() => setDeleteLooperConfirm(null), 3000);
                                                                    }}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-muted-foreground text-[11px] line-clamp-1 mt-1">
                                                        {p.description || "No description provided."}
                                                    </p>
                                                    <div className="flex gap-2 mt-3 text-[10px] text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Scissors className="w-2.5 h-2.5" /> {p.cut_start}s
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Zap className="w-2.5 h-2.5" /> {p.disable_crossfade ? "Off" : `${p.crossfade_duration}s`}
                                                        </span>
                                                        {p.mute_original_audio && (
                                                            <span className="flex items-center gap-1 text-amber-400/80">
                                                                <VolumeX className="w-2.5 h-2.5" /> Muted
                                                            </span>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="lg:col-span-2">
                                {isEditingLooper && (
                                    <Card className="bg-surface border-border sticky top-6">
                                        <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between gap-3">
                                            <div>
                                                <CardTitle className="text-sm font-semibold text-foreground">
                                                    {editingLooperOriginalName ? "Edit Looper Preset" : "New Looper Preset"}
                                                </CardTitle>
                                                <CardDescription className="text-xs mt-1">
                                                    Atur bagaimana video mentah dipotong dan di-loop.
                                                </CardDescription>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={handleCancelLooper}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="pt-4 space-y-6">
                                            {/* General Info */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-muted-foreground">Preset Name</Label>
                                                    <Input
                                                        value={looperForm.name}
                                                        onChange={(e) => setLooperForm({ ...looperForm, name: e.target.value })}
                                                        placeholder="TikTok_15s_High"
                                                        className="bg-background border-border text-sm h-9"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-muted-foreground">Description</Label>
                                                    <Input
                                                        value={looperForm.description}
                                                        onChange={(e) => setLooperForm({ ...looperForm, description: e.target.value })}
                                                        placeholder="High quality 15s loop for TikTok"
                                                        className="bg-background border-border text-sm h-9"
                                                    />
                                                </div>
                                            </div>

                                            <LooperPresetFields config={looperForm} onChangeConfig={setLooperForm} />

                                            <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-muted-foreground hover:text-foreground h-9 px-4"
                                                    onClick={handleCancelLooper}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={handleSaveLooper}
                                                    disabled={isSavingLooper || !looperForm.name.trim()}
                                                    className="bg-sky-600 hover:bg-sky-700 text-white h-9 px-6 font-semibold shadow-lg shadow-sky-600/20"
                                                >
                                                    {isSavingLooper ? "Saving..." : "Save Looper Preset"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === "integrations" && (
                    <div className="space-y-6">
                        <Card className="bg-surface border-border">
                            <CardHeader className="pb-3 border-b border-border/50">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Send className="w-4 h-4 text-sky-400" />
                                            Telegram Bot
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Notifikasi Telegram untuk event backend. Status:{" "}
                                            <span className="text-foreground">
                                                {telegramStatus?.enabled ? "enabled" : "disabled"}
                                            </span>
                                            . Bot token tersimpan di server.
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleTestTelegram}
                                            disabled={
                                                isTestingTelegram ||
                                                !telegramStatus?.enabled ||
                                                !telegramStatus?.has_bot_token ||
                                                !telegramStatus?.has_chat_id
                                            }
                                            className="h-8 text-xs font-semibold w-full sm:w-auto"
                                        >
                                            {isTestingTelegram ? "Sending..." : "Send Test"}
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveTelegram}
                                            disabled={isSavingTelegram}
                                            className={`h-8 text-xs font-semibold transition-all w-full sm:w-auto ${
                                                telegramSaved ? "bg-emerald-600 text-white" : "bg-sky-600 hover:bg-sky-700 text-white"
                                            }`}
                                        >
                                            {telegramSaved ? (
                                                <>
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Saved!
                                                </>
                                            ) : isSavingTelegram ? (
                                                "Saving..."
                                            ) : (
                                                <>
                                                    <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium text-foreground">Enable Telegram notifications</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Dipakai untuk test message dan notifikasi generation task sukses/gagal.
                                        </p>
                                    </div>
                                    <Switch checked={telegramEnabled} onCheckedChange={setTelegramEnabled} />
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Bot token</Label>
                                        <Input
                                            type="password"
                                            value={telegramBotTokenInput}
                                            onChange={(e) => setTelegramBotTokenInput(e.target.value)}
                                            placeholder={telegramStatus?.masked_bot_token || "123456789:AA..."}
                                            className="bg-background border-border text-xs"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            {telegramStatus?.has_bot_token
                                                ? `Current token: ${telegramStatus.masked_bot_token}`
                                                : "Belum ada bot token tersimpan."}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Chat ID</Label>
                                        <Input
                                            value={telegramChatIdInput}
                                            onChange={(e) => setTelegramChatIdInput(e.target.value)}
                                            placeholder="123456789 atau -100xxxxxxxxxx"
                                            className="bg-background border-border text-xs"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            {telegramStatus?.has_chat_id
                                                ? `Current chat ID: ${telegramStatus.chat_id}`
                                                : "Belum ada chat ID tersimpan."}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-border bg-background/40 px-3 py-3 text-[11px] text-muted-foreground space-y-1">
                                    <p>Langkah cepat:</p>
                                    <p>1. Buat bot lewat BotFather dan ambil bot token.</p>
                                    <p>2. Kirim pesan ke bot Anda.</p>
                                    <p>3. Ambil chat ID lalu isi di sini, simpan, lalu klik Send Test.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeSection === "workspace" && (
                    <div className="space-y-6">
                        <Card className="bg-surface border-border">
                            <CardHeader>
                                <CardTitle className="text-sm">Workspace environment</CardTitle>
                                <CardDescription className="text-xs">
                                    Ringkasan konfigurasi runtime frontend yang relevan untuk debugging.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-xs text-muted-foreground">
                                <div className="flex flex-col gap-1">
                                    <span className="font-mono text-foreground">
                                        NEXT_PUBLIC_API_URL={DEFAULT_API_BASE_URL}
                                    </span>
                                    <span className="font-mono text-foreground">
                                        NEXT_PUBLIC_SUPABASE_URL={process.env.NEXT_PUBLIC_SUPABASE_URL}
                                    </span>
                                </div>
                                <p className="text-[11px]">
                                    Nilai di atas dibaca saat build. Override client API base URL di section AI & API
                                    jika perlu pointing ke backend berbeda untuk browser ini.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface border-border">
                            <CardHeader>
                                <CardTitle className="text-sm">Database Control (Danger Zone)</CardTitle>
                                <CardDescription className="text-xs">
                                    Bersihkan data operasional DB tanpa menyentuh akun/prompt, kecuali jika Anda centang opsinya.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2 md:grid-cols-2">
                                    {[
                                        { key: "clear_upload_queue", label: "Clear upload queue jobs" },
                                        { key: "clear_queue_files", label: "Clear physical queue files" },
                                        { key: "clear_generation_tasks", label: "Clear generation tasks" },
                                        { key: "clear_realtime_events", label: "Clear realtime events/log stream" },
                                        { key: "clear_asset_metadata", label: "Clear asset metadata cache" },
                                        { key: "clear_project_configs", label: "Clear project config runtime" },
                                        { key: "clear_non_prompt_app_settings", label: "Clear non-prompt app settings" },
                                        { key: "clear_accounts", label: "Clear accounts (danger)" },
                                    ].map((opt) => (
                                        <div
                                            key={opt.key}
                                            className="rounded-lg border border-border bg-background/40 px-3 py-2 flex items-center justify-between gap-3"
                                        >
                                            <Label className="text-xs text-foreground">{opt.label}</Label>
                                            <Switch
                                                checked={dbFlushFlags[opt.key as keyof typeof dbFlushFlags]}
                                                onCheckedChange={(checked) =>
                                                    setDbFlushFlags((prev) => ({ ...prev, [opt.key]: checked }))
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-[11px] text-red-300 space-y-1">
                                    <p className="font-medium">Perhatian:</p>
                                    <p>- Aksi ini menghapus data permanen dari database.</p>
                                    <p>- Secara default file fisik di folder queue juga ikut dibersihkan.</p>
                                    <p>- Secara default akun dan prompt template tetap aman.</p>
                                    <p>- Ketik FLUSH untuk mengaktifkan tombol eksekusi.</p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Input
                                        value={dbFlushConfirm}
                                        onChange={(e) => setDbFlushConfirm(e.target.value)}
                                        placeholder="Type FLUSH to confirm"
                                        className="bg-background border-border text-xs sm:max-w-xs"
                                    />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={isFlushingDb || dbFlushConfirm.trim().toUpperCase() !== "FLUSH"}
                                        onClick={handleFlushDatabase}
                                    >
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                        {isFlushingDb ? "Flushing..." : "Flush Selected Tables"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface border-border">
                            <CardHeader>
                                <CardTitle className="text-sm">Local Fallback Queue Cleaner</CardTitle>
                                <CardDescription className="text-xs">
                                    Hapus paksa 1 item queue berdasarkan filename (disk + DB) jika masih nyangkut setelah flush.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Filename queue</Label>
                                    <Input
                                        value={forceRemoveFilename}
                                        onChange={(e) => setForceRemoveFilename(e.target.value)}
                                        placeholder="contoh: prompt_09_grok_gen_20260315073113.mp4"
                                        className="bg-background border-border text-xs"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <div className="rounded-lg border border-border bg-background/40 px-3 py-2 flex items-center justify-between gap-3">
                                        <Label className="text-xs text-foreground">Remove from disk</Label>
                                        <Switch
                                            checked={forceRemoveFlags.remove_from_disk}
                                            onCheckedChange={(checked) => setForceRemoveFlags((prev) => ({ ...prev, remove_from_disk: checked }))}
                                        />
                                    </div>
                                    <div className="rounded-lg border border-border bg-background/40 px-3 py-2 flex items-center justify-between gap-3">
                                        <Label className="text-xs text-foreground">Remove from DB</Label>
                                        <Switch
                                            checked={forceRemoveFlags.remove_from_db}
                                            onCheckedChange={(checked) => setForceRemoveFlags((prev) => ({ ...prev, remove_from_db: checked }))}
                                        />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                                    Gunakan hanya untuk kasus emergency item nyangkut. Ketik FLUSH untuk konfirmasi.
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Input
                                        value={forceRemoveConfirm}
                                        onChange={(e) => setForceRemoveConfirm(e.target.value)}
                                        placeholder="Type FLUSH to confirm"
                                        className="bg-background border-border text-xs sm:max-w-xs"
                                    />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={
                                            isForceRemoving
                                            || !forceRemoveFilename.trim()
                                            || forceRemoveConfirm.trim().toUpperCase() !== "FLUSH"
                                            || (!forceRemoveFlags.remove_from_disk && !forceRemoveFlags.remove_from_db)
                                        }
                                        onClick={handleForceRemoveQueueItem}
                                    >
                                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                        {isForceRemoving ? "Removing..." : "Force Remove by Filename"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </section>
        </div>
    );
}
