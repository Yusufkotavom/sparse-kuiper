from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
from pathlib import Path
from backend.core.config import settings

from backend.core.logger import logger

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

CONFIG_FILE = Path(__file__).resolve().parent.parent.parent / "config.json"

VALID_CATEGORIES = ["kdp_coloring", "story", "video", "image_gen", "custom"]


def _read_config() -> dict:
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"templates": {}}


def _write_config(data: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


# --- Pydantic Models ---

class TemplatePayload(BaseModel):
    name: str
    category: str = "custom"
    system_prompt: str = ""
    prefix: str = ""
    suffix: str = ""


class TemplateUpdatePayload(BaseModel):
    category: Optional[str] = None
    system_prompt: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None


class LooperPreset(BaseModel):
    name: str
    description: Optional[str] = ""
    mode: str = "manual"            # manual, target, audio
    default_loops: int = 3
    target_duration: float = 15.0  # float to match frontend
    cut_start: float = 3.0
    disable_crossfade: bool = False
    crossfade_duration: float = 1.5
    quality: str = "high"           # high (crf18), medium (23), low (28)
    resolution: str = "original"   # original, 1080p, 1080p_p, 720p, 720p_p, 480p, 480p_p

    # Audio — names match frontend LooperPreset interface
    mute_original_audio: bool = False
    enable_audio_fade: bool = False
    audio_fade_duration: float = 2.0

    # Studio toggles
    enable_looper: Optional[bool] = True
    enable_scene_mixer: Optional[bool] = False

    # Scene mixer
    scene_mixer_source: Optional[str] = "original"
    scene_mixer_selected_files: Optional[List[str]] = None
    scene_mixer_clip_count: Optional[int] = 10
    scene_mixer_order: Optional[str] = "random"
    scene_mixer_full_duration: Optional[bool] = False
    scene_mixer_max_duration: Optional[float] = 5.0

    # Effects
    effect_zoom_crop: Optional[bool] = False
    effect_zoom_mode: Optional[str] = "random"
    effect_zoom_percent: Optional[float] = 90.0
    effect_mirror: Optional[bool] = False
    effect_speed_ramping: Optional[bool] = False
    effect_color_tweaking: Optional[bool] = False
    effect_film_grain: Optional[bool] = False
    effect_pulsing_vignette: Optional[bool] = False

    # Transitions & Watermark
    transition_type: Optional[str] = "none"
    watermark_url: Optional[str] = None
    watermark_scale: Optional[int] = 50
    watermark_opacity: Optional[int] = 100
    watermark_position: Optional[str] = "bottom_right"
    watermark_margin_x: Optional[int] = 24
    watermark_margin_y: Optional[int] = 24
    watermark_key_black: Optional[bool] = False
    watermark_key_green: Optional[bool] = False


# --- Endpoints ---

@router.get("/looper-presets")
async def list_looper_presets():
    """Returns all video looper presets."""
    config = _read_config()
    presets = config.get("looper_presets", {})
    result = []
    for name, data in presets.items():
        result.append({
            "name": name,
            **data
        })
    return result


@router.post("/looper-presets")
async def create_looper_preset(req: LooperPreset):
    """Creates a new looper preset."""
    config = _read_config()
    presets = config.setdefault("looper_presets", {})

    if req.name in presets:
        raise HTTPException(status_code=400, detail="Preset with this name already exists.")

    presets[req.name] = req.model_dump(exclude={"name"})
    _write_config(config)
    logger.info(f"Created looper preset: {req.name}")
    return {"status": "success", "message": f"Preset '{req.name}' created."}


@router.put("/looper-presets/{name}")
async def update_looper_preset(name: str, req: LooperPreset):
    """Updates an existing looper preset."""
    config = _read_config()
    presets = config.get("looper_presets", {})

    if name not in presets:
        raise HTTPException(status_code=404, detail="Preset not found.")

    # If name is changed, we need to handle it
    if req.name != name:
        if req.name in presets:
            raise HTTPException(status_code=400, detail="Preset with the new name already exists.")
        del presets[name]
    
    presets[req.name] = req.model_dump(exclude={"name"})
    _write_config(config)
    logger.info(f"Updated looper preset: {req.name}")
    return {"status": "success", "message": f"Preset '{req.name}' updated."}


@router.delete("/looper-presets/{name}")
async def delete_looper_preset(name: str):
    """Deletes a looper preset."""
    config = _read_config()
    presets = config.get("looper_presets", {})

    if name not in presets:
        raise HTTPException(status_code=404, detail="Preset not found.")

    del presets[name]
    _write_config(config)
    logger.info(f"Deleted looper preset: {name}")
    return {"status": "success", "message": f"Preset '{name}' deleted."}


@router.get("/templates")
async def list_templates():
    """Returns all prompt templates."""
    config = _read_config()
    templates = config.get("templates", {})
    result = []
    for name, data in templates.items():
        result.append({
            "name": name,
            "category": data.get("category", "custom"),
            "system_prompt": data.get("system_prompt", ""),
            "prefix": data.get("prefix", ""),
            "suffix": data.get("suffix", ""),
        })
    return result


@router.post("/templates")
async def create_template(req: TemplatePayload):
    """Creates a new prompt template."""
    if req.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {VALID_CATEGORIES}")

    config = _read_config()
    templates = config.setdefault("templates", {})

    if req.name in templates:
        raise HTTPException(status_code=400, detail="Template with this name already exists.")

    templates[req.name] = {
        "category": req.category,
        "system_prompt": req.system_prompt,
        "prefix": req.prefix,
        "suffix": req.suffix,
    }
    _write_config(config)
    logger.info(f"Created template: {req.name}")
    return {"status": "success", "message": f"Template '{req.name}' created."}


@router.put("/templates/{name}")
async def update_template(name: str, req: TemplateUpdatePayload):
    """Updates an existing prompt template."""
    config = _read_config()
    templates = config.get("templates", {})

    if name not in templates:
        raise HTTPException(status_code=404, detail="Template not found.")

    if req.category is not None:
        if req.category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {VALID_CATEGORIES}")
        templates[name]["category"] = req.category
    if req.system_prompt is not None:
        templates[name]["system_prompt"] = req.system_prompt
    if req.prefix is not None:
        templates[name]["prefix"] = req.prefix
    if req.suffix is not None:
        templates[name]["suffix"] = req.suffix

    _write_config(config)
    logger.info(f"Updated template: {name}")
    return {"status": "success", "message": f"Template '{name}' updated."}


@router.delete("/templates/{name}")
async def delete_template(name: str):
    """Deletes a prompt template."""
    config = _read_config()
    templates = config.get("templates", {})

    if name not in templates:
        raise HTTPException(status_code=404, detail="Template not found.")

    del templates[name]
    _write_config(config)
    logger.info(f"Deleted template: {name}")
    return {"status": "success", "message": f"Template '{name}' deleted."}


# ────────────────────────────────────────────
# System Prompts  (e.g. metadata_generate)
# ────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPTS = {
    "metadata_generate": (
        'You are a viral social media manager. Based on the provided video title and channel, create:\n'
        '1. A catchy, viral Title (max 60 chars)\n'
        '2. An engaging Description (2-3 sentences max) with a call to action\n'
        '3. A list of 5-8 highly relevant, viral hashtags\n\n'
        'Respond ONLY in valid JSON format with the keys: "title", "description", "tags".\n'
        'Example: {"title": "Viral Cat!", "description": "Watch this amazing cat. Follow for more!", "tags": "#cat #viral #funny"}'
    )
}

VALID_PROMPT_KEYS = list(DEFAULT_SYSTEM_PROMPTS.keys())


class SystemPromptPayload(BaseModel):
    value: str


@router.get("/system-prompts/{key}")
async def get_system_prompt(key: str):
    """Returns a system prompt value by key."""
    if key not in VALID_PROMPT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown prompt key: {key}")
    config = _read_config()
    system_prompts = config.get("system_prompts", {})
    value = system_prompts.get(key, DEFAULT_SYSTEM_PROMPTS[key])
    return {"key": key, "value": value}


@router.put("/system-prompts/{key}")
async def update_system_prompt(key: str, req: SystemPromptPayload):
    """Updates a system prompt value by key."""
    if key not in VALID_PROMPT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown prompt key: {key}")
    config = _read_config()
    if "system_prompts" not in config:
        config["system_prompts"] = {}
    config["system_prompts"][key] = req.value
    _write_config(config)
    logger.info(f"Updated system prompt: {key}")
    return {"status": "success", "key": key}


@router.get("/system-prompts")
async def list_system_prompts():
    """Returns all system prompts with their current values."""
    config = _read_config()
    system_prompts = config.get("system_prompts", {})
    result = {}
    for key, default in DEFAULT_SYSTEM_PROMPTS.items():
        result[key] = system_prompts.get(key, default)
    return result


class GroqKeyPayload(BaseModel):
    value: str


@router.get("/groq-api-key")
async def get_groq_api_key():
    config = _read_config()
    key = config.get("groq_api_key", "") or settings.groq_api_key or ""
    masked = ""
    if key:
        masked = ("*" * max(0, len(key) - 4)) + key[-4:]
    return {"has_key": bool(key), "masked": masked}


@router.put("/groq-api-key")
async def update_groq_api_key(req: GroqKeyPayload):
    if not req.value or not req.value.strip():
        raise HTTPException(status_code=400, detail="Value is required")
    config = _read_config()
    config["groq_api_key"] = req.value.strip()
    _write_config(config)
    settings.groq_api_key = req.value.strip()
    return {"status": "success"}


class OpenAIKeyPayload(BaseModel):
    value: str


@router.get("/openai-api-key")
async def get_openai_api_key():
    config = _read_config()
    key = config.get("openai_api_key", "") or settings.openai_api_key or ""
    masked = ""
    if key:
        masked = ("*" * max(0, len(key) - 4)) + key[-4:]
    return {"has_key": bool(key), "masked": masked}


@router.put("/openai-api-key")
async def update_openai_api_key(req: OpenAIKeyPayload):
    if not req.value or not req.value.strip():
        raise HTTPException(status_code=400, detail="Value is required")
    config = _read_config()
    config["openai_api_key"] = req.value.strip()
    _write_config(config)
    settings.openai_api_key = req.value.strip()
    return {"status": "success"}


class GeminiKeyPayload(BaseModel):
    value: str


@router.get("/gemini-api-key")
async def get_gemini_api_key():
    config = _read_config()
    key = config.get("gemini_api_key", "") or settings.gemini_api_key or ""
    masked = ""
    if key:
        masked = ("*" * max(0, len(key) - 4)) + key[-4:]
    return {"has_key": bool(key), "masked": masked}


@router.put("/gemini-api-key")
async def update_gemini_api_key(req: GeminiKeyPayload):
    if not req.value or not req.value.strip():
        raise HTTPException(status_code=400, detail="Value is required")
    config = _read_config()
    config["gemini_api_key"] = req.value.strip()
    _write_config(config)
    settings.gemini_api_key = req.value.strip()
    return {"status": "success"}


class AzureOpenAIPayload(BaseModel):
    endpoint: Optional[str] = None
    api_key: Optional[str] = None
    deployment: Optional[str] = None
    api_version: Optional[str] = None


@router.get("/azure-openai")
async def get_azure_openai_settings():
    config = _read_config()
    azure = config.get("azure_openai", {}) if isinstance(config.get("azure_openai", {}), dict) else {}
    api_key = azure.get("api_key", "") or settings.azure_openai_api_key or ""
    masked = ""
    if api_key:
        masked = ("*" * max(0, len(api_key) - 4)) + api_key[-4:]
    return {
        "endpoint": azure.get("endpoint", "") or settings.azure_openai_endpoint or "",
        "deployment": azure.get("deployment", "") or settings.azure_openai_deployment or "",
        "api_version": azure.get("api_version", "") or settings.azure_openai_api_version or "",
        "has_key": bool(api_key),
        "masked": masked,
    }


@router.put("/azure-openai")
async def update_azure_openai_settings(req: AzureOpenAIPayload):
    config = _read_config()
    azure = config.get("azure_openai", {}) if isinstance(config.get("azure_openai", {}), dict) else {}
    if req.endpoint is not None:
        azure["endpoint"] = req.endpoint.strip()
        settings.azure_openai_endpoint = req.endpoint.strip()
    if req.deployment is not None:
        azure["deployment"] = req.deployment.strip()
        settings.azure_openai_deployment = req.deployment.strip()
    if req.api_version is not None:
        azure["api_version"] = req.api_version.strip()
        settings.azure_openai_api_version = req.api_version.strip()
    if req.api_key is not None:
        if not req.api_key.strip():
            raise HTTPException(status_code=400, detail="api_key is required")
        azure["api_key"] = req.api_key.strip()
        settings.azure_openai_api_key = req.api_key.strip()
    config["azure_openai"] = azure
    _write_config(config)
    return {"status": "success"}
