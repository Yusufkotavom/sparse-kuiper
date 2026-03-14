from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
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

# --- Endpoints ---

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
