// src/lib/api.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const API_TARGET_VERSION = process.env.NEXT_PUBLIC_API_TARGET_VERSION || "v1";

type CompatEndpointRule = {
    legacyPrefix: string;
    nextPrefix: string;
};

const COMPAT_ENDPOINT_RULES: CompatEndpointRule[] = [
    { legacyPrefix: "/kdp", nextPrefix: "/content/kdp" },
    { legacyPrefix: "/video", nextPrefix: "/content/video" },
    { legacyPrefix: "/settings", nextPrefix: "/system/settings" },
    { legacyPrefix: "/publisher", nextPrefix: "/distribution/publisher" },
];

export const DEFAULT_API_BASE_URL = API_BASE_URL;

function mapEndpointForVersion(endpoint: string, targetVersion: string): string {
    if (targetVersion !== "v2") {
        return endpoint;
    }

    for (const rule of COMPAT_ENDPOINT_RULES) {
        if (endpoint === rule.legacyPrefix || endpoint.startsWith(`${rule.legacyPrefix}/`)) {
            return endpoint.replace(rule.legacyPrefix, rule.nextPrefix);
        }
    }

    return endpoint;
}

function buildApiUrl(endpoint: string): string {
    return `${getApiBase()}${endpoint}`;
}

export function getApiBase(): string {
    if (typeof window !== "undefined") {
        try {
            const stored = window.localStorage.getItem("sk_api_base_url");
            if (stored && stored.trim()) {
                return stored.trim();
            }
        } catch {}
    }
    return API_BASE_URL;
}

/**
 * Generic fetch wrapper for the FastAPI backend
 */
export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const adaptedEndpoint = mapEndpointForVersion(endpoint, API_TARGET_VERSION);

    const defaultHeaders = {
        "Content-Type": "application/json",
    };

    let response = await fetch(buildApiUrl(adaptedEndpoint), {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });

    // Compatibility fallback: when frontend already points to v2 route shape,
    // retry using legacy endpoint so older backends remain usable during migration.
    if (!response.ok && adaptedEndpoint !== endpoint && [404, 405, 410].includes(response.status)) {
        response = await fetch(buildApiUrl(endpoint), {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        });
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `API request failed with status: ${response.status}`);
    }

    return response.json();
}

/**
 * KDP Studio Specific API Calls
 */
export const kdpApi = {
    generatePrompts: async (payload: {
        system_prompt: string;
        prefix_prompt: string;
        suffix_prompt: string;
        topic: string;
        number_n: number;
        character_type: string;
        model?: string;
    }): Promise<string[]> => {
        return fetchApi<string[]>("/kdp/prompts", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    createPdf: async (payload: {
        project_name: string;
        image_paths: string[];
    }): Promise<{ status: string; pdf_path: string }> => {
        return fetchApi<{ status: string; pdf_path: string }>("/kdp/pdf", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    listProjects: async (): Promise<string[]> => {
        return fetchApi<string[]>("/kdp/projects", {
            method: "GET",
        });
    },

    listProjectImages: async (projectName: string): Promise<{ raw: string[]; final: string[] }> => {
        return fetchApi<{ raw: string[]; final: string[] }>(`/kdp/projects/${projectName}/images`, {
            method: "GET",
        });
    },

    curateImage: async (projectName: string, filename: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/kdp/projects/${projectName}/curate`, {
            method: "POST",
            body: JSON.stringify({ filename }),
        });
    },

    createProject: async (name: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/kdp/projects`, {
            method: "POST",
            body: JSON.stringify({ name }),
        });
    },

    savePrompts: async (projectName: string, prompts: string[]): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/kdp/projects/${projectName}/prompts`, {
            method: "POST",
            body: JSON.stringify({ prompts }),
        });
    },

    getPrompts: async (projectName: string): Promise<{ prompts: string[] }> => {
        return fetchApi<{ prompts: string[] }>(`/kdp/projects/${projectName}/prompts`, {
            method: "GET",
        });
    },

    triggerBot: async (projectName: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/kdp/projects/${projectName}/generate`, {
            method: "POST",
        });
    },

    saveProjectConfig: async (projectName: string, config: ProjectConfig): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/kdp/projects/${encodeURIComponent(projectName)}/config`, {
            method: "POST",
            body: JSON.stringify(config),
        });
    },

    loadProjectConfig: async (projectName: string): Promise<ProjectConfig> => {
        return fetchApi<ProjectConfig>(`/kdp/projects/${encodeURIComponent(projectName)}/config`, {
            method: "GET",
        });
    },

    deleteProject: async (projectName: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/kdp/projects/${encodeURIComponent(projectName)}`, {
            method: "DELETE",
        });
    },

    generateWithGrok2Api: async (
        projectName: string,
        payload: {
            prompts?: string[];
            size?: string;
            model?: string;
        },
    ): Promise<{ status: string; message: string; created: string[]; errors?: string[]; provider: string }> => {
        return fetchApi<{ status: string; message: string; created: string[]; errors?: string[]; provider: string }>(
            `/kdp/projects/${encodeURIComponent(projectName)}/generate-grok2api`,
            {
                method: "POST",
                body: JSON.stringify(payload),
            }
        );
    },

    bulkDeleteProjectImages: async (projectName: string, filenames: string[]): Promise<{ status: string; message: string; errors?: string[] }> => {
        return fetchApi<{ status: string; message: string; errors?: string[] }>(`/kdp/projects/${projectName}/images`, {
            method: "DELETE",
            body: JSON.stringify({ filenames }),
        });
    },

    archiveImage: async (projectName: string, filename: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/kdp/projects/${encodeURIComponent(projectName)}/archive`, {
            method: "POST",
            body: JSON.stringify({ filename }),
        });
    },

    moveImageStage: async (
        projectName: string,
        filename: string,
        targetStage: "raw" | "final" | "archive",
    ): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/kdp/projects/${encodeURIComponent(projectName)}/move`, {
            method: "POST",
            body: JSON.stringify({ filename, target_stage: targetStage }),
        });
    },
};

/**
 * Video Gen / Grok Studio Specific API Calls
 */
export const videoApi = {
    generatePrompts: async (payload: {
        system_prompt: string;
        prefix_prompt: string;
        suffix_prompt: string;
        topic: string;
        number_n: number;
        character_type: string;
        model?: string;
    }): Promise<string[]> => {
        return fetchApi<string[]>("/kdp/prompts", { // Reuse KDP prompt generator as it's just Groq text generation
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    listProjects: async (): Promise<string[]> => {
        return fetchApi<string[]>("/video/projects", {
            method: "GET",
        });
    },

    listProjectVideos: async (projectName: string): Promise<{ raw: string[]; final: string[], archive: string[] }> => {
        return fetchApi<{ raw: string[]; final: string[], archive: string[] }>(`/video/projects/${projectName}/videos`, {
            method: "GET",
        });
    },

    uploadProjectVideos: async (
        projectName: string,
        files: File[],
        opts?: { targetStage?: "raw" | "final" },
    ): Promise<ProjectVideoUploadResponse> => {
        const endpoint = `/video/projects/${encodeURIComponent(projectName)}/upload`;
        const adaptedEndpoint = mapEndpointForVersion(endpoint, API_TARGET_VERSION);
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("target_stage", opts?.targetStage || "raw");

        let response = await fetch(buildApiUrl(adaptedEndpoint), {
            method: "POST",
            body: formData,
        });

        if (!response.ok && adaptedEndpoint !== endpoint && [404, 405, 410].includes(response.status)) {
            response = await fetch(buildApiUrl(endpoint), {
                method: "POST",
                body: formData,
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API request failed with status: ${response.status}`);
        }

        return response.json();
    },

    bulkDeleteProjectVideos: async (projectName: string, filenames: string[]): Promise<{ status: string; message: string; errors?: string[] }> => {
        return fetchApi<{ status: string; message: string; errors?: string[] }>(`/video/projects/${projectName}/videos`, {
            method: "DELETE",
            body: JSON.stringify({ filenames }),
        });
    },

    curateVideo: async (projectName: string, filename: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/video/projects/${projectName}/curate`, {
            method: "POST",
            body: JSON.stringify({ filename }),
        });
    },

    archiveVideo: async (projectName: string, filename: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/video/projects/${projectName}/archive`, {
            method: "POST",
            body: JSON.stringify({ filename }),
        });
    },

    moveVideoStage: async (
        projectName: string,
        filename: string,
        targetStage: "raw" | "final" | "archive",
    ): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/video/projects/${projectName}/move`, {
            method: "POST",
            body: JSON.stringify({ filename, target_stage: targetStage }),
        });
    },

    createProject: async (name: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/video/projects`, {
            method: "POST",
            body: JSON.stringify({ name }),
        });
    },

    savePrompts: async (projectName: string, prompts: string[]): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/video/projects/${projectName}/prompts`, {
            method: "POST",
            body: JSON.stringify({ prompts }),
        });
    },

    getPrompts: async (projectName: string): Promise<{ prompts: string[] }> => {
        return fetchApi<{ prompts: string[] }>(`/video/projects/${projectName}/prompts`, {
            method: "GET",
        });
    },

    triggerBot: async (
        projectName: string,
        useReference: boolean = true,
        headlessMode: boolean = true,
    ): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/video/projects/${projectName}/generate`, {
            method: "POST",
            body: JSON.stringify({ use_reference: useReference, headless_mode: headlessMode }),
        });
    },

    saveProjectConfig: async (projectName: string, config: ProjectConfig): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/video/projects/${encodeURIComponent(projectName)}/config`, {
            method: "POST",
            body: JSON.stringify(config),
        });
    },

    loadProjectConfig: async (projectName: string): Promise<ProjectConfig> => {
        return fetchApi<ProjectConfig>(`/video/projects/${encodeURIComponent(projectName)}/config`, {
            method: "GET",
        });
    },

    deleteProject: async (projectName: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/video/projects/${encodeURIComponent(projectName)}`, {
            method: "DELETE",
        });
    },

    generateWithGrok2Api: async (
        projectName: string,
        payload: {
            prompts?: string[];
            size?: string;
            seconds?: number;
            quality?: string;
            model?: string;
            image_url?: string;
        },
    ): Promise<{ status: string; message: string; created: string[]; errors?: string[]; provider: string }> => {
        return fetchApi<{ status: string; message: string; created: string[]; errors?: string[]; provider: string }>(
            `/video/projects/${encodeURIComponent(projectName)}/generate-grok2api`,
            {
                method: "POST",
                body: JSON.stringify(payload),
            }
        );
    },
};

export interface ProjectConfig {
    topic: string;
    character: string;
    number_n: number;
    system_prompt: string;
    prefix: string;
    suffix: string;
    grok_account_id?: string;
    whisk_account_id?: string;
}

export interface ProjectVideoUploadResponse {
    status: string;
    message: string;
    uploaded: Array<{
        filename: string;
        relative_path: string;
        stage: "raw" | "final" | string;
    }>;
    errors?: string[];
}

/**
 * Template type definition
 */
export interface PromptTemplate {
    name: string;
    category: string;
    system_prompt: string;
    prefix: string;
    suffix: string;
}

export interface LooperPreset {
    name: string;
    description?: string;
    mode: "manual" | "target" | "audio";
    default_loops: number;
    target_duration: number;
    cut_start: number;
    disable_crossfade: boolean;
    crossfade_duration: number;
    quality: "high" | "medium" | "low";
    resolution: "original" | "1080p" | "1080p_p" | "720p" | "720p_p" | "480p" | "480p_p";
    mute_original_audio: boolean;
    enable_audio_fade: boolean;
    audio_fade_duration: number;

    // --- NEW: Studio & Scene Mixer Toggles ---
    enable_looper?: boolean;
    enable_scene_mixer?: boolean;

    // --- Auto Scene Mixer Settings ---
    scene_mixer_source?: string;
    scene_mixer_selected_files?: string[];
    scene_mixer_clip_count?: number;
    scene_mixer_order?: "random" | "sequential";
    scene_mixer_full_duration?: boolean;
    scene_mixer_max_duration?: number;
    
    // --- Anti-Reused / Effects ---
    effect_zoom_crop?: boolean;
    effect_zoom_mode?: "random" | "manual";
    effect_zoom_percent?: number;
    effect_mirror?: boolean;
    effect_speed_ramping?: boolean;
    effect_color_tweaking?: boolean;
    effect_film_grain?: boolean;
    effect_pulsing_vignette?: boolean;
    
    // --- Transitions & Watermark ---
    transition_type?: "none" | "crossfade" | "dip_to_black" | "glitch";
    watermark_url?: string;
    watermark_scale?: number;
    watermark_opacity?: number;
    watermark_position?:
        | "top_left"
        | "top_center"
        | "top_right"
        | "center_left"
        | "center"
        | "center_right"
        | "bottom_left"
        | "bottom_center"
        | "bottom_right";
    watermark_margin_x?: number;
    watermark_margin_y?: number;
    watermark_key_black?: boolean;
    watermark_key_green?: boolean;
}

export interface TelegramSettings {
    enabled: boolean;
    has_bot_token: boolean;
    masked_bot_token: string;
    chat_id: string;
    has_chat_id: boolean;
}

export interface DatabaseFlushPayload {
    confirm_text: string;
    clear_upload_queue?: boolean;
    clear_generation_tasks?: boolean;
    clear_realtime_events?: boolean;
    clear_asset_metadata?: boolean;
    clear_project_configs?: boolean;
    clear_non_prompt_app_settings?: boolean;
    clear_accounts?: boolean;
}

/**
 * Settings / Prompt Management API Calls
 */
export const settingsApi = {
    listTemplates: async (): Promise<PromptTemplate[]> => {
        return fetchApi<PromptTemplate[]>("/settings/templates");
    },

    listLooperPresets: async (): Promise<LooperPreset[]> => {
        return fetchApi<LooperPreset[]>("/settings/looper-presets");
    },

    createLooperPreset: async (preset: LooperPreset): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>("/settings/looper-presets", {
            method: "POST",
            body: JSON.stringify(preset),
        });
    },

    updateLooperPreset: async (name: string, preset: LooperPreset): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/settings/looper-presets/${encodeURIComponent(name)}`, {
            method: "PUT",
            body: JSON.stringify(preset),
        });
    },

    deleteLooperPreset: async (name: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/settings/looper-presets/${encodeURIComponent(name)}`, {
            method: "DELETE",
        });
    },

    listConcatPresets: async (): Promise<ConcatPreset[]> => {
        return fetchApi<ConcatPreset[]>("/settings/concat-presets");
    },

    createConcatPreset: async (preset: ConcatPreset): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>("/settings/concat-presets", {
            method: "POST",
            body: JSON.stringify(preset),
        });
    },

    updateConcatPreset: async (name: string, preset: ConcatPreset): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/settings/concat-presets/${encodeURIComponent(name)}`, {
            method: "PUT",
            body: JSON.stringify(preset),
        });
    },

    deleteConcatPreset: async (name: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/settings/concat-presets/${encodeURIComponent(name)}`, {
            method: "DELETE",
        });
    },

    getGroqApiKey: async (): Promise<{ has_key: boolean; masked: string }> => {
        return fetchApi<{ has_key: boolean; masked: string }>("/settings/groq-api-key");
    },

    setGroqApiKey: async (value: string): Promise<{ status: string }> => {
        return fetchApi<{ status: string }>("/settings/groq-api-key", {
            method: "PUT",
            body: JSON.stringify({ value }),
        });
    },

    getOpenAiApiKey: async (): Promise<{ has_key: boolean; masked: string }> => {
        return fetchApi<{ has_key: boolean; masked: string }>("/settings/openai-api-key");
    },

    setOpenAiApiKey: async (value: string): Promise<{ status: string }> => {
        return fetchApi<{ status: string }>("/settings/openai-api-key", {
            method: "PUT",
            body: JSON.stringify({ value }),
        });
    },

    getGeminiApiKey: async (): Promise<{ has_key: boolean; masked: string }> => {
        return fetchApi<{ has_key: boolean; masked: string }>("/settings/gemini-api-key");
    },

    setGeminiApiKey: async (value: string): Promise<{ status: string }> => {
        return fetchApi<{ status: string }>("/settings/gemini-api-key", {
            method: "PUT",
            body: JSON.stringify({ value }),
        });
    },

    getAzureOpenAi: async (): Promise<{ endpoint: string; deployment: string; api_version: string; has_key: boolean; masked: string }> => {
        return fetchApi<{ endpoint: string; deployment: string; api_version: string; has_key: boolean; masked: string }>("/settings/azure-openai");
    },

    setAzureOpenAi: async (payload: { endpoint?: string; deployment?: string; api_version?: string; api_key?: string }): Promise<{ status: string }> => {
        return fetchApi<{ status: string }>("/settings/azure-openai", {
            method: "PUT",
            body: JSON.stringify(payload),
        });
    },

    getTelegramSettings: async (): Promise<TelegramSettings> => {
        return fetchApi<TelegramSettings>("/settings/telegram");
    },

    setTelegramSettings: async (payload: { enabled: boolean; bot_token?: string; chat_id?: string }): Promise<{ status: string }> => {
        return fetchApi<{ status: string }>("/settings/telegram", {
            method: "PUT",
            body: JSON.stringify(payload),
        });
    },

    testTelegramSettings: async (message?: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>("/settings/telegram/test", {
            method: "POST",
            body: JSON.stringify({ message }),
        });
    },

    flushDatabase: async (payload: DatabaseFlushPayload): Promise<{ status: string; message: string; deleted: Record<string, number> }> => {
        return fetchApi<{ status: string; message: string; deleted: Record<string, number> }>("/settings/maintenance/db/flush", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    createTemplate: async (template: PromptTemplate): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>("/settings/templates", {
            method: "POST",
            body: JSON.stringify(template),
        });
    },

    updateTemplate: async (name: string, data: Partial<PromptTemplate>): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/settings/templates/${encodeURIComponent(name)}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
    },

    deleteTemplate: async (name: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/settings/templates/${encodeURIComponent(name)}`, {
            method: "DELETE",
        });
    },
};

// ==========================================
// QUEUE BUILDER API
// Legacy backend routes still use `/publisher`, so `publisherApi`
// remains exported as a compatibility alias.
// ==========================================
export type PublisherJob = {
    filename: string;
    status: string;
    worker_state?: string;
    scheduled_at?: string | null;
    uploaded_at?: string | null;
    target_platforms?: string[];
    account_map?: Record<string, string>;
    job_tags?: string[];
    attempt_count?: number;
    last_error?: string;
    last_run_at?: string | null;
    platforms?: Record<string, { status: string; message: string; timestamp: string }>;
    options?: Record<string, unknown>;
    metadata?: { title?: string; description?: string; tags?: string };
};

export const publisherApi = {
    getQueue: async (): Promise<{ queue: QueueItem[] }> => {
        return fetchApi<{ queue: QueueItem[] }>("/publisher/queue");
    },
    getPublishedQueue: async (): Promise<{ queue: QueueItem[] }> => {
        return fetchApi<{ queue: QueueItem[] }>("/publisher/queue/published");
    },

    triggerUpload: async (filename: string, payload: {
        title: string;
        description: string;
        tags: string;
        platforms: string[];
        account_id?: string;
        schedule?: string;     // ISO UTC datetime string
        product_id?: string;   // TikTok product ID
        youtube_privacy?: string;
        youtube_category_id?: string;
        open_browser?: boolean;
        pw_debug?: boolean;
    }) => {
        return fetchApi<{ message: string }>(`/publisher/upload/${encodeURIComponent(filename)}`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    triggerBatchUpload: async (payload: {
        videos: Array<{
            filename: string;
            title: string;
            description: string;
            tags: string;
            schedule?: string;
            product_id?: string;
            youtube_privacy?: string;
            youtube_category_id?: string;
        }>;
        platforms: string[];
        account_id: string;
        open_browser?: boolean;
        pw_debug?: boolean;
    }) => {
        return fetchApi<{ message: string }>(`/publisher/upload/batch`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    generateMetadata: async (prompt: string, opts?: { provider?: string; model?: string }) => {
        return fetchApi<{ title: string, description: string, tags: string }>("/publisher/generate-metadata", {
            method: "POST",
            body: JSON.stringify({ prompt, ...(opts || {}) }),
        });
    },

    generateAssetMetadata: async (payload: {
        project_type: string;
        file: string;
        title?: string;
        description?: string;
        tags?: string;
        provider?: string;
        model?: string;
        prompt?: string;
    }) => {
        return fetchApi<{ title: string, description: string, tags: string }>("/publisher/generate-metadata", {
            method: "POST",
            body: JSON.stringify({
                prompt: payload.prompt || "",
                project_type: payload.project_type,
                file: payload.file,
                title: payload.title || "",
                description: payload.description || "",
                tags: payload.tags || "",
                provider: payload.provider,
                model: payload.model,
            }),
        });
    },

    addToQueue: async (payload: { project_type: string, relative_path: string, title: string, description: string, tags: string }) => {
        return fetchApi<{ message: string, filename: string }>("/publisher/queue/add", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    removeFromQueue: async (filename: string) => {
        return fetchApi<{ message: string }>(`/publisher/queue/${encodeURIComponent(filename)}`, {
            method: "DELETE",
        });
    },

    returnToProject: async (filename: string) => {
        return fetchApi<{ message: string; path?: string }>(`/publisher/queue/return/${encodeURIComponent(filename)}`, {
            method: "POST",
        });
    },

    getSidecarMetadata: async (projectType: string, file: string) => {
        const params = new URLSearchParams({ project_type: projectType, file });
        return fetchApi<{ title: string; description: string; tags: string }>(`/publisher/metadata/sidecar?${params.toString()}`, {
            method: "GET",
        });
    },

    getAssetMetadata: async (projectType: string, file: string) => {
        const params = new URLSearchParams({ project_type: projectType, file });
        return fetchApi<{ title: string; description: string; tags: string }>(`/publisher/assets/metadata?${params.toString()}`, {
            method: "GET",
        });
    },

    getAssetsMetadataBatch: async (projectType: string, files: string[], opts?: { includeSidecar?: boolean }) => {
        return fetchApi<{
            items: Array<{ file: string; title: string; description: string; tags: string; source: "db" | "sidecar" | "none" }>;
        }>(`/publisher/assets/metadata/batch`, {
            method: "POST",
            body: JSON.stringify({
                project_type: projectType,
                files,
                include_sidecar: opts?.includeSidecar ?? true,
            }),
        });
    },

    setAssetMetadata: async (projectType: string, file: string, meta: { title: string; description: string; tags: string }) => {
        return fetchApi<{ status: string }>(`/publisher/assets/metadata`, {
            method: "POST",
            body: JSON.stringify({ project_type: projectType, file, ...meta }),
        });
    },

    updateQueueMetadata: async (filename: string, meta: { title: string; description: string; tags: string }) => {
        return fetchApi<{ message: string }>(`/publisher/queue/update-metadata`, {
            method: "POST",
            body: JSON.stringify({ filename, ...meta }),
        });
    },

    updateQueueConfig: async (payload: {
        filename: string;
        platforms: string[];
        account_map: Record<string, string>;
        schedule?: string;
        platform_publish_schedule?: string;
        campaign_id?: string;
        open_browser?: boolean;
        pw_debug?: boolean;
        youtube_privacy?: string;
        youtube_category_id?: string;
        product_id?: string;
    }) => {
        return fetchApi<{ message: string }>(`/publisher/queue/update-config`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    bulkUpdateQueueConfig: async (payload: {
        filenames: string[];
        platforms: string[];
        account_map: Record<string, string>;
        schedule_start?: string;
        platform_publish_schedule_start?: string;
        campaign_id?: string;
        posts_per_day?: number;
        time_gap_hours?: number;
        open_browser?: boolean;
        pw_debug?: boolean;
        youtube_privacy?: string;
        youtube_category_id?: string;
        product_id?: string;
    }) => {
        return fetchApi<{ message: string; count: number }>(`/publisher/queue/bulk-update-config`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    getJobs: async (params?: { status?: string; tag?: string; platform?: string; account_id?: string; campaign?: string; date_from?: string; date_to?: string }) => {
        const query = new URLSearchParams();
        if (params?.status) query.set("status", params.status);
        if (params?.tag) query.set("tag", params.tag);
        if (params?.platform) query.set("platform", params.platform);
        if (params?.account_id) query.set("account_id", params.account_id);
        if (params?.campaign) query.set("campaign", params.campaign);
        if (params?.date_from) query.set("date_from", params.date_from);
        if (params?.date_to) query.set("date_to", params.date_to);
        return fetchApi<{ jobs: PublisherJob[] }>(`/publisher/jobs?${query.toString()}`);
    },
    runNowJob: async (filename: string) => {
        return fetchApi<{ message: string }>(`/publisher/jobs/run-now/${encodeURIComponent(filename)}`, {
            method: "POST",
        });
    },
    pauseJob: async (filename: string) => {
        return fetchApi<{ message: string }>(`/publisher/jobs/pause/${encodeURIComponent(filename)}`, {
            method: "POST",
        });
    },
    resumeJob: async (filename: string) => {
        return fetchApi<{ message: string }>(`/publisher/jobs/resume/${encodeURIComponent(filename)}`, {
            method: "POST",
        });
    },
    cancelJob: async (filename: string) => {
        return fetchApi<{ message: string }>(`/publisher/jobs/cancel/${encodeURIComponent(filename)}`, {
            method: "POST",
        });
    },
    rescheduleJob: async (filename: string, schedule: string) => {
        return fetchApi<{ message: string }>(`/publisher/jobs/reschedule`, {
            method: "POST",
            body: JSON.stringify({ filename, schedule }),
        });
    },
    setJobTags: async (filename: string, tags: string[]) => {
        return fetchApi<{ message: string }>(`/publisher/jobs/set-tags`, {
            method: "POST",
            body: JSON.stringify({ filename, tags }),
        });
    },

    deleteJobConfig: async (filename: string) => {
        return fetchApi<{ message: string }>(`/publisher/jobs/delete/${encodeURIComponent(filename)}`, {
            method: "POST",
        });
    }
};

export const queueBuilderApi = publisherApi;
export type QueueBuilderJob = PublisherJob;
// ==========================================
// ACCOUNTS API
// ==========================================
export interface Account {
    id?: string;
    name: string;
    platform: string;
    auth_method: string;
    status: string;
    api_key?: string;
    api_secret?: string;
    youtube_connected?: boolean;
    channel_title?: string;
    last_login?: string;
    tags?: string;
    notes?: string;
    browser_type?: string;
    proxy?: string;
    user_agent?: string;
    lightweight_mode?: boolean;
}

export interface PlatformStatus {
    status: string;
    message: string;
    timestamp: string;
}

export interface QueueItem {
    filename: string;
    status: string;
    platforms: Record<string, PlatformStatus>;
    metadata?: { title?: string; description?: string; tags?: string };
    scheduled_at?: string | null;
    uploaded_at?: string | null;
    file_path?: string | null;
    project_dir?: string | null;
}

export const accountsApi = {
    getAccounts: async (): Promise<{ accounts: Account[] }> => {
        return fetchApi<{ accounts: Account[] }>("/accounts/");
    },

    getYoutubeSecrets: async (): Promise<{ secrets: string[] }> => {
        return fetchApi<{ secrets: string[] }>("/accounts/youtube-secrets");
    },

    addAccount: async (account: Account): Promise<{ message: string; account: Account }> => {
        return fetchApi<{ message: string; account: Account }>("/accounts/", {
            method: "POST",
            body: JSON.stringify(account),
        });
    },

    updateAccount: async (accountId: string, account: Partial<Account>): Promise<{ message: string; account: Account }> => {
        return fetchApi<{ message: string; account: Account }>(`/accounts/${accountId}`, {
            method: "PUT",
            body: JSON.stringify(account),
        });
    },

    deleteAccount: async (accountId: string): Promise<{ message: string }> => {
        return fetchApi<{ message: string }>(`/accounts/${accountId}`, {
            method: "DELETE",
        });
    },


    triggerLogin: async (accountId: string): Promise<{ message: string }> => {
        return fetchApi<{ message: string }>(`/accounts/${accountId}/login`, {
            method: "POST",
        });
    },

    launchPlaywrightManual: async (accountId: string): Promise<{ message: string }> => {
        return fetchApi<{ message: string }>(`/accounts/${accountId}/playwright/launch`, {
            method: "POST",
        });
    },

    refreshStatus: async (accountId: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/accounts/${accountId}/refresh-status`, {
            method: "POST",
        });
    },

    getYoutubeAuthUrl: async (accountId: string): Promise<{ auth_url: string; instructions: string }> => {
        return fetchApi<{ auth_url: string; instructions: string }>(`/accounts/${accountId}/youtube/auth-url`);
    },

    connectYoutube: async (accountId: string, code: string): Promise<{ status: string; channel_title: string; message: string }> => {
        return fetchApi<{ status: string; channel_title: string; message: string }>(`/accounts/${accountId}/youtube/connect`, {
            method: "POST",
            body: JSON.stringify({ code }),
        });
    },

    disconnectYoutube: async (accountId: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/accounts/${accountId}/youtube/disconnect`, {
            method: "POST",
        });
    },

    getFacebookAuthUrl: async (accountId: string): Promise<{ auth_url: string; instructions: string }> => {
        return fetchApi<{ auth_url: string; instructions: string }>(`/accounts/${accountId}/facebook/auth-url`);
    },

    connectFacebook: async (accountId: string, code: string): Promise<{ status: string; channel_title?: string; message: string; pages?: {id: string, name: string}[] }> => {
        return fetchApi<{ status: string; channel_title?: string; message: string; pages?: {id: string, name: string}[] }>(`/accounts/${accountId}/facebook/connect`, {
            method: "POST",
            body: JSON.stringify({ code }),
        });
    },

    selectFacebookPage: async (accountId: string, pageId: string): Promise<{ status: string; channel_title: string; message: string }> => {
        return fetchApi<{ status: string; channel_title: string; message: string }>(`/accounts/${accountId}/facebook/select-page`, {
            method: "POST",
            body: JSON.stringify({ page_id: pageId }),
        });
    },

    disconnectFacebook: async (accountId: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/accounts/${accountId}/facebook/disconnect`, {
            method: "POST",
        });
    },

    getDriveAuthUrl: async (accountId: string): Promise<{ auth_url: string; instructions: string }> => {
        return fetchApi<{ auth_url: string; instructions: string }>(`/accounts/${accountId}/drive/auth-url`);
    },

    connectDrive: async (accountId: string, code: string): Promise<{ status: string; message: string }> => {
        return fetchApi<{ status: string; message: string }>(`/accounts/${accountId}/drive/connect`, {
            method: "POST",
            body: JSON.stringify({ code }),
        });
    },

    exportCreds: async (includeTokens: boolean = true): Promise<{ accounts: Array<Account & Record<string, unknown>> }> => {
        const query = includeTokens ? "?include_tokens=true" : "";
        return fetchApi<{ accounts: Array<Account & Record<string, unknown>> }>(`/accounts/export-creds${query}`);
    },

    importCreds: async (accounts: Array<Record<string, unknown>>): Promise<{ message: string; imported: number; updated: number }> => {
        return fetchApi<{ message: string; imported: number; updated: number }>(`/accounts/import-creds`, {
            method: "POST",
            body: JSON.stringify({ accounts }),
        });
    },
};

// ==========================================
// LOOPER API
// ==========================================

export interface LooperRunPayload {
    project: string;
    file: string;
    custom_audio_file?: string;
    output_suffix?: string;
    // config params (mirror LooperPreset)
    mode?: "manual" | "target" | "audio";
    default_loops?: number;
    target_duration?: number;
    cut_start?: number;
    disable_crossfade?: boolean;
    crossfade_duration?: number;
    quality?: "high" | "medium" | "low";
    resolution?: string;
    mute_original_audio?: boolean;
    enable_audio_fade?: boolean;
    audio_fade_duration?: number;
    enable_looper?: boolean;
    enable_scene_mixer?: boolean;
    scene_mixer_source?: string;
    scene_mixer_selected_files?: string[];
    scene_mixer_clip_count?: number;
    scene_mixer_order?: "random" | "sequential";
    scene_mixer_full_duration?: boolean;
    scene_mixer_max_duration?: number;
    effect_zoom_crop?: boolean;
    effect_zoom_mode?: "random" | "manual";
    effect_zoom_percent?: number;
    effect_mirror?: boolean;
    effect_speed_ramping?: boolean;
    effect_color_tweaking?: boolean;
    effect_film_grain?: boolean;
    effect_pulsing_vignette?: boolean;
    transition_type?: "none" | "crossfade" | "dip_to_black" | "glitch";
    watermark_url?: string;
    watermark_scale?: number;
    watermark_opacity?: number;
    watermark_position?:
        | "top_left"
        | "top_center"
        | "top_right"
        | "center_left"
        | "center"
        | "center_right"
        | "bottom_left"
        | "bottom_center"
        | "bottom_right";
    watermark_margin_x?: number;
    watermark_margin_y?: number;
    watermark_key_black?: boolean;
    watermark_key_green?: boolean;
}

export interface LooperJobStatus {
    job_id: string;
    status: "pending" | "running" | "done" | "error";
    progress: number;
    stage: number;
    stage_label: string;
    output_path?: string | null;
    error?: string | null;
    finished_at?: number | null;
}

export interface LooperFileInfo {
    duration: number;
    width: number;
    height: number;
    fps: number;
    size_mb: number;
}

export interface LooperWatermarkUploadResponse {
    relative_path: string;
    static_url: string;
    filename: string;
}

export interface PlaywrightProbeSelectorResult {
    selector: string;
    count: number;
    visible: boolean;
}

export interface PlaywrightProbeResult {
    status: string;
    title: string;
    url: string;
    selectors: PlaywrightProbeSelectorResult[];
}

export interface PlaywrightRunResult {
    status: string;
    pid: number;
    project: string;
    worker: string;
}

export const looperApi = {
    run: async (payload: LooperRunPayload): Promise<{ job_id: string; message: string }> => {
        return fetchApi<{ job_id: string; message: string }>("/looper/run", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    getStatus: async (jobId: string): Promise<LooperJobStatus> => {
        return fetchApi<LooperJobStatus>(`/looper/status/${jobId}`);
    },

    cancel: async (jobId: string): Promise<{ message: string }> => {
        return fetchApi<{ message: string }>(`/looper/cancel/${jobId}`, {
            method: "POST",
        });
    },

    getFileInfo: async (project: string, file: string): Promise<LooperFileInfo> => {
        const params = new URLSearchParams({ project, file });
        return fetchApi<LooperFileInfo>(`/looper/file-info?${params.toString()}`);
    },

    uploadWatermark: async (project: string, file: File): Promise<LooperWatermarkUploadResponse> => {
        const formData = new FormData();
        formData.append("file", file);
        const params = new URLSearchParams({ project });
        const response = await fetch(`${getApiBase()}/looper/watermark/upload?${params.toString()}`, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API request failed with status: ${response.status}`);
        }
        return response.json();
    },
};

// ==========================================
// CONCAT API
// ==========================================

export interface TrimPoint {
    start: number;
    end: number;
}

export interface ConcatPreset {
    name: string;
    description?: string;
    transition_type: "cut" | "crossfade" | "dip_to_black" | "glitch";
    transition_duration: number;
    resolution: "original" | "1080p" | "720p" | "480p";
    quality: "high" | "medium" | "low";
    mute_original_audio: boolean;
    enable_audio_fade: boolean;
    audio_fade_duration: number;
    background_music_volume: number;
}

export interface ConcatRunPayload {
    project: string;
    files: string[];
    trim_settings?: Record<string, TrimPoint>;
    output_suffix?: string;
    transition_type?: "cut" | "crossfade" | "dip_to_black" | "glitch";
    transition_duration?: number;
    resolution?: "original" | "1080p" | "720p" | "480p";
    quality?: "high" | "medium" | "low";
    mute_original_audio?: boolean;
    enable_audio_fade?: boolean;
    audio_fade_duration?: number;
    background_music_file?: string | null;
    background_music_volume?: number;
}

export interface ConcatJobStatus {
    job_id: string;
    status: "pending" | "running" | "done" | "error";
    progress: number;
    stage: number;
    stage_label: string;
    current_video?: string | null;
    output_path?: string | null;
    error?: string | null;
    finished_at?: number | null;
}

export const concatApi = {
    run: async (payload: ConcatRunPayload): Promise<{ job_id: string; message: string }> => {
        return fetchApi<{ job_id: string; message: string }>("/concat/run", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    getStatus: async (jobId: string): Promise<ConcatJobStatus> => {
        return fetchApi<ConcatJobStatus>(`/concat/status/${jobId}`);
    },

    cancel: async (jobId: string): Promise<{ message: string }> => {
        return fetchApi<{ message: string }>(`/concat/cancel/${jobId}`, {
            method: "POST",
        });
    },

    getFileInfo: async (project: string, file: string): Promise<LooperFileInfo> => {
        const params = new URLSearchParams({ project, file });
        return fetchApi<LooperFileInfo>(`/concat/file-info?${params.toString()}`);
    },
};

export const internalPlaywrightApi = {
    runGrokProject: async (payload: { project_name: string; use_reference?: boolean; headless_mode?: boolean }): Promise<PlaywrightRunResult> => {
        return fetchApi<PlaywrightRunResult>("/internal/playwright/grok/run-project", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    runWhiskProject: async (payload: { project_name: string }): Promise<PlaywrightRunResult> => {
        return fetchApi<PlaywrightRunResult>("/internal/playwright/whisk/run-project", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    probe: async (payload: { url: string; selectors?: string[]; wait_ms?: number; headless?: boolean }): Promise<PlaywrightProbeResult> => {
        return fetchApi<PlaywrightProbeResult>("/internal/playwright/probe", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
};

// ==========================================
// GOOGLE DRIVE API
// ==========================================
export const driveApi = {
    list: async (payload: { account_id: string; parent_id?: string; q?: string; page_token?: string }): Promise<{ files: Array<{id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; parents?: string[]}>; next_page_token?: string }> => {
        return fetchApi<{ files: Array<{id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; parents?: string[]}>; next_page_token?: string }>(`/drive/list`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    createFolder: async (payload: { account_id: string; name: string; parent_id?: string }): Promise<{ id: string; name: string; parents?: string[] }> => {
        return fetchApi<{ id: string; name: string; parents?: string[] }>(`/drive/folder`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    uploadWithProgress: async (
        accountId: string,
        parentId: string | undefined,
        file: File,
        onProgress?: (pct: number) => void
    ): Promise<{ id: string; name: string; mimeType?: string; parents?: string[] }> => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", file);
            const params = new URLSearchParams();
            params.set("account_id", accountId);
            if (parentId) params.set("parent_id", parentId);
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${getApiBase()}/drive/upload?${params.toString()}`);
            xhr.responseType = "json";
            xhr.upload.onprogress = (e: ProgressEvent) => {
                if (typeof onProgress === "function") {
                    const total = e.total || 0;
                    if (total > 0) {
                        const pct = Math.round((e.loaded / total) * 100);
                        onProgress(Math.max(0, Math.min(100, pct)));
                    } else {
                        onProgress(50);
                    }
                }
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response);
                } else {
                    try {
                        const data = typeof xhr.response === "object" ? xhr.response : JSON.parse(String(xhr.response || "{}"));
                        reject(new Error(data.detail || `API request failed with status: ${xhr.status}`));
                    } catch {
                        reject(new Error(`API request failed with status: ${xhr.status}`));
                    }
                }
            };
            xhr.onerror = () => {
                reject(new Error("Network error during upload"));
            };
            xhr.send(formData);
        });
    },

    upload: async (accountId: string, parentId: string | undefined, file: File): Promise<{ id: string; name: string; mimeType?: string; parents?: string[] }> => {
        const formData = new FormData();
        formData.append("file", file);
        const params = new URLSearchParams();
        params.set("account_id", accountId);
        if (parentId) params.set("parent_id", parentId);
        const response = await fetch(`${getApiBase()}/drive/upload?${params.toString()}`, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API request failed with status: ${response.status}`);
        }
        return response.json();
    },

    download: async (accountId: string, fileId: string): Promise<Blob> => {
        const params = new URLSearchParams({ account_id: accountId });
        const response = await fetch(`${getApiBase()}/drive/download/${encodeURIComponent(fileId)}?${params.toString()}`, {
            method: "GET",
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API request failed with status: ${response.status}`);
        }
        return response.blob();
    },

    delete: async (accountId: string, fileId: string): Promise<{ status: string; id: string }> => {
        return fetchApi<{ status: string; id: string }>(`/drive/delete`, {
            method: "POST",
            body: JSON.stringify({ account_id: accountId, file_id: fileId }),
        });
    },

    move: async (accountId: string, fileId: string, targetParentId: string): Promise<{ id: string; parents?: string[] }> => {
        return fetchApi<{ id: string; parents?: string[] }>(`/drive/move`, {
            method: "POST",
            body: JSON.stringify({ account_id: accountId, file_id: fileId, target_parent_id: targetParentId }),
        });
    },

    getMeta: async (accountId: string, fileId: string): Promise<{ id: string; name: string; mimeType: string; parents?: string[] }> => {
        const params = new URLSearchParams({ account_id: accountId });
        return fetchApi<{ id: string; name: string; mimeType: string; parents?: string[] }>(`/drive/meta/${encodeURIComponent(fileId)}?${params.toString()}`);
    },

    importToVideoProject: async (payload: { account_id: string; parent_id: string; project_name: string; file_ids?: string[] }): Promise<{ status: string; project: string; imported: number; skipped: number }> => {
        return fetchApi<{ status: string; project: string; imported: number; skipped: number }>(`/drive/import-to-video-project`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    importToKdpProject: async (payload: { account_id: string; parent_id: string; project_name: string; file_ids?: string[] }): Promise<{ status: string; project: string; imported: number; skipped: number }> => {
        return fetchApi<{ status: string; project: string; imported: number; skipped: number }>(`/drive/import-to-kdp-project`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
};
