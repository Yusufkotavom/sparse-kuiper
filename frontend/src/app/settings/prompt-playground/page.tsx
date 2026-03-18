"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { kdpApi, settingsApi, PromptTemplate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bot, Loader2, Sparkles, Trophy } from "lucide-react";

type PromptVariant = {
    key: "A" | "B";
    name: string;
    system_prompt: string;
    prefix_prompt: string;
    suffix_prompt: string;
};

type CompareResult = {
    variantKey: "A" | "B";
    variantName: string;
    model: string;
    prompts: string[];
    error?: string;
    score: number;
};

const DEFAULT_VARIANTS: PromptVariant[] = [
    {
        key: "A",
        name: "Prompt A",
        system_prompt:
            "You are an expert prompt engineer. Generate exactly {N} unique prompts for {CHARACTER} about {TOPIC}.",
        prefix_prompt: "",
        suffix_prompt: "",
    },
    {
        key: "B",
        name: "Prompt B",
        system_prompt:
            "You are a strict creative director. Return exactly {N} concise prompts, each with a clear visual direction.",
        prefix_prompt: "",
        suffix_prompt: "",
    },
];

const MODEL_OPTIONS = [
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",
    "deepseek-r1-distill-llama-70b",
];

function normalizePrompt(prompt: string): string {
    return prompt.toLowerCase().replace(/\s+/g, " ").trim();
}

function calcScore(prompts: string[]): number {
    if (prompts.length === 0) return 0;
    const unique = new Set(prompts.map(normalizePrompt)).size;
    const avgLen = prompts.reduce((acc, p) => acc + p.length, 0) / prompts.length;
    return Math.round(unique * 12 + avgLen / 14);
}

export default function PromptPlaygroundPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [variants, setVariants] = useState<PromptVariant[]>(DEFAULT_VARIANTS);
    const [selectedTemplate, setSelectedTemplate] = useState<Record<"A" | "B", string>>({ A: "", B: "" });
    const [templateDraftName, setTemplateDraftName] = useState<Record<"A" | "B", string>>({
        A: DEFAULT_VARIANTS[0].name,
        B: DEFAULT_VARIANTS[1].name,
    });
    const [topic, setTopic] = useState("viral educational short video");
    const [characterType, setCharacterType] = useState("narrator style");
    const [numberN, setNumberN] = useState(8);
    const [selectedModels, setSelectedModels] = useState<string[]>([MODEL_OPTIONS[0], MODEL_OPTIONS[1]]);
    const [customModel, setCustomModel] = useState("");
    const [isComparing, setIsComparing] = useState(false);
    const [templateActionLoading, setTemplateActionLoading] = useState<string | null>(null);
    const [results, setResults] = useState<CompareResult[]>([]);

    useEffect(() => {
        settingsApi.listTemplates().then(setTemplates).catch(() => setTemplates([]));
    }, []);

    const rankedResults = useMemo(() => {
        return [...results].sort((a, b) => b.score - a.score);
    }, [results]);

    const winner = rankedResults[0];

    const updateVariant = (key: "A" | "B", updates: Partial<PromptVariant>) => {
        setVariants((prev) =>
            prev.map((v) => {
                if (v.key !== key) return v;
                return { ...v, ...updates };
            })
        );
    };

    const loadTemplateToVariant = (key: "A" | "B", templateName: string) => {
        const t = templates.find((x) => x.name === templateName);
        if (!t) return;
        updateVariant(key, {
            system_prompt: t.system_prompt,
            prefix_prompt: t.prefix,
            suffix_prompt: t.suffix,
            name: `${key} · ${t.name}`,
        });
        setSelectedTemplate((prev) => ({ ...prev, [key]: t.name }));
        setTemplateDraftName((prev) => ({ ...prev, [key]: t.name }));
    };

    const saveVariantTemplate = async (key: "A" | "B") => {
        const templateName = templateDraftName[key].trim();
        if (!templateName) return;
        const variant = variants.find((v) => v.key === key);
        if (!variant) return;

        setTemplateActionLoading(`save-${key}`);
        try {
            const payload: PromptTemplate = {
                name: templateName,
                category: "custom",
                system_prompt: variant.system_prompt,
                prefix: variant.prefix_prompt,
                suffix: variant.suffix_prompt,
            };
            const existing = templates.find((t) => t.name === templateName);
            if (existing) {
                await settingsApi.updateTemplate(templateName, {
                    category: payload.category,
                    system_prompt: payload.system_prompt,
                    prefix: payload.prefix,
                    suffix: payload.suffix,
                });
            } else {
                await settingsApi.createTemplate(payload);
            }
            const latestTemplates = await settingsApi.listTemplates();
            setTemplates(latestTemplates);
            setSelectedTemplate((prev) => ({ ...prev, [key]: templateName }));
            setTemplateDraftName((prev) => ({ ...prev, [key]: templateName }));
        } catch (e) {
            alert(e instanceof Error ? e.message : "Gagal simpan template");
        } finally {
            setTemplateActionLoading(null);
        }
    };

    const deleteSelectedTemplate = async (key: "A" | "B") => {
        const templateName = selectedTemplate[key];
        if (!templateName) return;
        setTemplateActionLoading(`delete-${key}`);
        try {
            await settingsApi.deleteTemplate(templateName);
            const latestTemplates = await settingsApi.listTemplates();
            setTemplates(latestTemplates);
            setSelectedTemplate((prev) => ({ ...prev, [key]: "" }));
            setTemplateDraftName((prev) => ({ ...prev, [key]: "" }));
        } catch (e) {
            alert(e instanceof Error ? e.message : "Gagal hapus template");
        } finally {
            setTemplateActionLoading(null);
        }
    };

    const toggleModel = (model: string) => {
        setSelectedModels((prev) => {
            if (prev.includes(model)) return prev.filter((m) => m !== model);
            return [...prev, model];
        });
    };

    const addCustomModel = () => {
        const model = customModel.trim();
        if (!model) return;
        setSelectedModels((prev) => (prev.includes(model) ? prev : [...prev, model]));
        setCustomModel("");
    };

    const handleCompare = async () => {
        const models = selectedModels.filter((m) => m.trim());
        if (models.length === 0) return;
        setIsComparing(true);
        setResults([]);

        const jobs = variants.flatMap((variant) =>
            models.map(async (model): Promise<CompareResult> => {
                try {
                    const prompts = await kdpApi.generatePrompts({
                        system_prompt: variant.system_prompt.replaceAll("{TOPIC}", topic),
                        prefix_prompt: variant.prefix_prompt,
                        suffix_prompt: variant.suffix_prompt,
                        topic,
                        number_n: numberN,
                        character_type: characterType,
                        model,
                    });
                    return {
                        variantKey: variant.key,
                        variantName: variant.name,
                        model,
                        prompts,
                        score: calcScore(prompts),
                    };
                } catch (e) {
                    return {
                        variantKey: variant.key,
                        variantName: variant.name,
                        model,
                        prompts: [],
                        error: e instanceof Error ? e.message : "Gagal generate",
                        score: 0,
                    };
                }
            })
        );

        const settled = await Promise.all(jobs);
        setResults(settled);
        setIsComparing(false);
    };

    return (
        <div className="w-full p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-violet-400" />
                        Prompt Playground
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Compare prompt template dan compare model untuk cari hasil terbaik.
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/settings")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Settings
                </Button>
            </div>

            <div className="space-y-6">
                <Card className="bg-surface border-border">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold text-foreground">Konfigurasi Komparasi</CardTitle>
                        <CardDescription className="text-xs">
                            Atur context ideation, lalu jalankan perbandingan pada 2 prompt variant dan banyak model.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Topic</Label>
                                <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Character / Style</Label>
                                <Input value={characterType} onChange={(e) => setCharacterType(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Jumlah Prompt</Label>
                                <Input
                                    type="number"
                                    value={numberN}
                                    onChange={(e) => setNumberN(Math.max(1, parseInt(e.target.value) || 1))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Model Compare</Label>
                            <div className="flex flex-wrap gap-2">
                                {MODEL_OPTIONS.map((model) => {
                                    const active = selectedModels.includes(model);
                                    return (
                                        <Button
                                            key={model}
                                            type="button"
                                            size="sm"
                                            variant={active ? "default" : "outline"}
                                            className="h-7 text-[11px]"
                                            onClick={() => toggleModel(model)}
                                        >
                                            {model}
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={customModel}
                                    onChange={(e) => setCustomModel(e.target.value)}
                                    placeholder="Tambah model custom..."
                                />
                                <Button type="button" variant="outline" onClick={addCustomModel}>
                                    Tambah
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {variants.map((variant) => (
                                <div key={variant.key} className="rounded-lg border border-border/60 p-3 space-y-3 bg-background/40">
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground">Nama Variant</Label>
                                        <Input
                                            value={variant.name}
                                            onChange={(e) => updateVariant(variant.key, { name: e.target.value })}
                                            className="h-8"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground">Template Tersimpan</Label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Select
                                                value={selectedTemplate[variant.key] || undefined}
                                                onValueChange={(v) => {
                                                    if (typeof v === "string") loadTemplateToVariant(variant.key, v);
                                                }}
                                            >
                                                <SelectTrigger className="h-8 flex-1">
                                                    <SelectValue placeholder={`Load template ke ${variant.key}`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {templates.map((t) => (
                                                        <SelectItem key={`${variant.key}-${t.name}`} value={t.name}>
                                                            {t.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                className="h-8 text-xs"
                                                disabled={!selectedTemplate[variant.key] || templateActionLoading === `delete-${variant.key}`}
                                                onClick={() => deleteSelectedTemplate(variant.key)}
                                            >
                                                {templateActionLoading === `delete-${variant.key}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-muted-foreground">Nama untuk Save</Label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Input
                                                value={templateDraftName[variant.key]}
                                                onChange={(e) =>
                                                    setTemplateDraftName((prev) => ({
                                                        ...prev,
                                                        [variant.key]: e.target.value,
                                                    }))
                                                }
                                                className="h-8"
                                                placeholder="Nama template"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-8 text-xs"
                                                disabled={templateActionLoading === `save-${variant.key}`}
                                                onClick={() => saveVariantTemplate(variant.key)}
                                            >
                                                {templateActionLoading === `save-${variant.key}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                                            </Button>
                                        </div>
                                    </div>
                                    <Textarea
                                        rows={4}
                                        value={variant.system_prompt}
                                        onChange={(e) => updateVariant(variant.key, { system_prompt: e.target.value })}
                                        placeholder="System prompt"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <Input
                                            value={variant.prefix_prompt}
                                            onChange={(e) => updateVariant(variant.key, { prefix_prompt: e.target.value })}
                                            placeholder="Prefix"
                                        />
                                        <Input
                                            value={variant.suffix_prompt}
                                            onChange={(e) => updateVariant(variant.key, { suffix_prompt: e.target.value })}
                                            placeholder="Suffix"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button
                            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                            onClick={handleCompare}
                            disabled={isComparing || selectedModels.length === 0}
                        >
                            {isComparing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                            Compare Prompt + Compare Model
                        </Button>
                    </CardContent>
                </Card>

                <Card className="bg-surface border-border">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-400" />
                            Hasil Komparasi
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Ranking berbasis variasi hasil (unik) + kepadatan konten prompt.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
                        {results.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                                Belum ada hasil. Jalankan compare untuk melihat performa prompt dan model.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {rankedResults.map((item, idx) => (
                                    <div key={`${item.variantKey}-${item.model}`} className="rounded-lg border border-border/60 p-3 bg-background/40 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-xs font-semibold text-foreground">
                                                #{idx + 1} · {item.variantName} · {item.model}
                                            </div>
                                            <div className="text-[11px] font-bold text-violet-300">Score {item.score}</div>
                                        </div>
                                        {item.error ? (
                                            <p className="text-xs text-red-300">{item.error}</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                                    {item.prompts.slice(0, 4).map((p, i) => (
                                                        <p key={i} className="text-xs text-foreground/90 leading-relaxed">
                                                            {i + 1}. {p}
                                                        </p>
                                                    ))}
                                                </div>
                                                {item.prompts.length > 4 && (
                                                    <p className="text-[11px] text-muted-foreground">+{item.prompts.length - 4} prompt lainnya</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {winner && (
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                                <p className="text-xs font-semibold text-emerald-300">
                                    Rekomendasi saat ini: {winner.variantName} + {winner.model}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
