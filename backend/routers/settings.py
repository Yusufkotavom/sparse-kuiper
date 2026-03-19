from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import json
from pathlib import Path
from sqlalchemy.orm import Session
from backend.core.config import settings, CONFIG_FILE, UPLOAD_QUEUE_DIR, VIDEO_PROJECTS_DIR, PROJECTS_DIR
from backend.core.database import get_db
from backend.models.app_setting import AppSetting
from backend.models.account import Account
from backend.models.asset_metadata import AssetMetadata
from backend.models.generation_task import GenerationTask
from backend.models.project_config import ProjectConfig
from backend.models.realtime_event import RealtimeEvent
from backend.models.upload_queue import UploadQueueItem
from backend.routers.settings_schemas import (
    TemplatePayload,
    TemplateUpdatePayload,
    LooperPreset,
    ConcatPreset,
    SystemPromptPayload,
    GroqKeyPayload,
    OpenAIKeyPayload,
    GeminiKeyPayload,
    AzureOpenAIPayload,
    TelegramSettingsPayload,
    TelegramTestPayload,
    DatabaseFlushPayload,
)
from backend.services.telegram_notifier import send_telegram_message

from backend.core.logger import logger

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

VALID_CATEGORIES = ["kdp_coloring", "story", "video", "image_gen", "custom"]
TEMPLATE_SETTING_TYPE = "prompt_template"
LOOPER_PRESET_SETTING_TYPE = "looper_preset"
CONCAT_PRESET_SETTING_TYPE = "concat_preset"


def _read_config() -> dict:
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"templates": {}}


def _write_config(data: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def _setting_to_dict(row: AppSetting) -> dict:
    payload = row.payload if isinstance(row.payload, dict) else {}
    return {
        "name": row.name,
        **payload,
    }


def _seed_settings_from_config(db: Session, *, setting_type: str, config_key: str):
    has_rows = db.query(AppSetting).filter(AppSetting.setting_type == setting_type).first()
    if has_rows:
        return

    config = _read_config()
    data = config.get(config_key, {})
    if not isinstance(data, dict) or not data:
        return

    for name, payload in data.items():
        db.add(AppSetting(
            setting_type=setting_type,
            name=name,
            payload=payload if isinstance(payload, dict) else {},
        ))
    db.commit()
    logger.info(f"Seeded {len(data)} {setting_type} record(s) from config.json")


# --- Endpoints ---

@router.get("/looper-presets")
async def list_looper_presets(db: Session = Depends(get_db)):
    """Returns all video looper presets."""
    _seed_settings_from_config(db, setting_type=LOOPER_PRESET_SETTING_TYPE, config_key="looper_presets")
    rows = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == LOOPER_PRESET_SETTING_TYPE)
        .order_by(AppSetting.name.asc())
        .all()
    )
    return [_setting_to_dict(row) for row in rows]


@router.post("/looper-presets")
async def create_looper_preset(req: LooperPreset, db: Session = Depends(get_db)):
    """Creates a new looper preset."""
    existing = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == LOOPER_PRESET_SETTING_TYPE, AppSetting.name == req.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Preset with this name already exists.")

    db.add(AppSetting(
        setting_type=LOOPER_PRESET_SETTING_TYPE,
        name=req.name,
        payload=req.model_dump(exclude={"name"}),
    ))
    db.commit()
    logger.info(f"Created looper preset: {req.name}")
    return {"status": "success", "message": f"Preset '{req.name}' created."}


@router.put("/looper-presets/{name}")
async def update_looper_preset(name: str, req: LooperPreset, db: Session = Depends(get_db)):
    """Updates an existing looper preset."""
    preset = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == LOOPER_PRESET_SETTING_TYPE, AppSetting.name == name)
        .first()
    )
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found.")

    if req.name != name:
        rename_conflict = (
            db.query(AppSetting)
            .filter(AppSetting.setting_type == LOOPER_PRESET_SETTING_TYPE, AppSetting.name == req.name)
            .first()
        )
        if rename_conflict:
            raise HTTPException(status_code=400, detail="Preset with the new name already exists.")
        preset.name = req.name

    preset.payload = req.model_dump(exclude={"name"})
    db.commit()
    logger.info(f"Updated looper preset: {req.name}")
    return {"status": "success", "message": f"Preset '{req.name}' updated."}


@router.delete("/looper-presets/{name}")
async def delete_looper_preset(name: str, db: Session = Depends(get_db)):
    """Deletes a looper preset."""
    preset = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == LOOPER_PRESET_SETTING_TYPE, AppSetting.name == name)
        .first()
    )
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found.")

    db.delete(preset)
    db.commit()
    logger.info(f"Deleted looper preset: {name}")
    return {"status": "success", "message": f"Preset '{name}' deleted."}


@router.get("/concat-presets")
async def list_concat_presets(db: Session = Depends(get_db)):
    """Returns all video concat presets."""
    _seed_settings_from_config(db, setting_type=CONCAT_PRESET_SETTING_TYPE, config_key="concat_presets")
    rows = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == CONCAT_PRESET_SETTING_TYPE)
        .order_by(AppSetting.name.asc())
        .all()
    )
    return [_setting_to_dict(row) for row in rows]


@router.post("/concat-presets")
async def create_concat_preset(req: ConcatPreset, db: Session = Depends(get_db)):
    """Creates a new concat preset."""
    existing = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == CONCAT_PRESET_SETTING_TYPE, AppSetting.name == req.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Preset with this name already exists.")

    db.add(AppSetting(
        setting_type=CONCAT_PRESET_SETTING_TYPE,
        name=req.name,
        payload=req.model_dump(exclude={"name"}),
    ))
    db.commit()
    logger.info(f"Created concat preset: {req.name}")
    return {"status": "success", "message": f"Preset '{req.name}' created."}


@router.put("/concat-presets/{name}")
async def update_concat_preset(name: str, req: ConcatPreset, db: Session = Depends(get_db)):
    """Updates an existing concat preset."""
    preset = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == CONCAT_PRESET_SETTING_TYPE, AppSetting.name == name)
        .first()
    )
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found.")

    if req.name != name:
        rename_conflict = (
            db.query(AppSetting)
            .filter(AppSetting.setting_type == CONCAT_PRESET_SETTING_TYPE, AppSetting.name == req.name)
            .first()
        )
        if rename_conflict:
            raise HTTPException(status_code=400, detail="Preset with the new name already exists.")
        preset.name = req.name

    preset.payload = req.model_dump(exclude={"name"})
    db.commit()
    logger.info(f"Updated concat preset: {req.name}")
    return {"status": "success", "message": f"Preset '{req.name}' updated."}


@router.delete("/concat-presets/{name}")
async def delete_concat_preset(name: str, db: Session = Depends(get_db)):
    """Deletes a concat preset."""
    preset = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == CONCAT_PRESET_SETTING_TYPE, AppSetting.name == name)
        .first()
    )
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found.")

    db.delete(preset)
    db.commit()
    logger.info(f"Deleted concat preset: {name}")
    return {"status": "success", "message": f"Preset '{name}' deleted."}


@router.get("/templates")
async def list_templates(db: Session = Depends(get_db)):
    """Returns all prompt templates."""
    _seed_settings_from_config(db, setting_type=TEMPLATE_SETTING_TYPE, config_key="templates")
    rows = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == TEMPLATE_SETTING_TYPE)
        .order_by(AppSetting.name.asc())
        .all()
    )
    result = []
    for row in rows:
        payload = row.payload if isinstance(row.payload, dict) else {}
        result.append({
            "name": row.name,
            "category": payload.get("category", "custom"),
            "system_prompt": payload.get("system_prompt", ""),
            "prefix": payload.get("prefix", ""),
            "suffix": payload.get("suffix", ""),
        })
    return result


@router.post("/templates")
async def create_template(req: TemplatePayload, db: Session = Depends(get_db)):
    """Creates a new prompt template."""
    if req.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {VALID_CATEGORIES}")

    existing = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == TEMPLATE_SETTING_TYPE, AppSetting.name == req.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Template with this name already exists.")

    db.add(AppSetting(
        setting_type=TEMPLATE_SETTING_TYPE,
        name=req.name,
        payload={
            "category": req.category,
            "system_prompt": req.system_prompt,
            "prefix": req.prefix,
            "suffix": req.suffix,
        },
    ))
    db.commit()
    logger.info(f"Created template: {req.name}")
    return {"status": "success", "message": f"Template '{req.name}' created."}


@router.put("/templates/{name}")
async def update_template(name: str, req: TemplateUpdatePayload, db: Session = Depends(get_db)):
    """Updates an existing prompt template."""
    template = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == TEMPLATE_SETTING_TYPE, AppSetting.name == name)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")

    next_name = req.name.strip() if req.name is not None else name
    if not next_name:
        raise HTTPException(status_code=400, detail="Template name cannot be empty.")
    if next_name != name:
        rename_conflict = (
            db.query(AppSetting)
            .filter(AppSetting.setting_type == TEMPLATE_SETTING_TYPE, AppSetting.name == next_name)
            .first()
        )
        if rename_conflict:
            raise HTTPException(status_code=400, detail="Template with this name already exists.")
        template.name = next_name

    payload = template.payload if isinstance(template.payload, dict) else {}
    if req.category is not None:
        if req.category not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {VALID_CATEGORIES}")
        payload["category"] = req.category
    if req.system_prompt is not None:
        payload["system_prompt"] = req.system_prompt
    if req.prefix is not None:
        payload["prefix"] = req.prefix
    if req.suffix is not None:
        payload["suffix"] = req.suffix

    template.payload = payload
    db.commit()
    logger.info(f"Updated template: {template.name}")
    return {"status": "success", "message": f"Template '{template.name}' updated."}


@router.delete("/templates/{name}")
async def delete_template(name: str, db: Session = Depends(get_db)):
    """Deletes a prompt template."""
    template = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == TEMPLATE_SETTING_TYPE, AppSetting.name == name)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")

    db.delete(template)
    db.commit()
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


@router.get("/telegram")
async def get_telegram_settings():
    config = _read_config()
    telegram = config.get("telegram", {}) if isinstance(config.get("telegram", {}), dict) else {}
    bot_token = telegram.get("bot_token", "") or settings.telegram_bot_token or ""
    chat_id = str(telegram.get("chat_id", "") or settings.telegram_chat_id or "")
    enabled = bool(telegram.get("enabled", settings.telegram_notifications_enabled))
    masked = ""
    if bot_token:
        masked = ("*" * max(0, len(bot_token) - 4)) + bot_token[-4:]
    return {
        "enabled": enabled,
        "has_bot_token": bool(bot_token),
        "masked_bot_token": masked,
        "chat_id": chat_id,
        "has_chat_id": bool(chat_id),
    }


@router.put("/telegram")
async def update_telegram_settings(req: TelegramSettingsPayload):
    config = _read_config()
    telegram = config.get("telegram", {}) if isinstance(config.get("telegram", {}), dict) else {}

    telegram["enabled"] = bool(req.enabled)
    settings.telegram_notifications_enabled = bool(req.enabled)

    if req.bot_token is not None:
        telegram["bot_token"] = req.bot_token.strip()
        settings.telegram_bot_token = req.bot_token.strip()

    if req.chat_id is not None:
        telegram["chat_id"] = req.chat_id.strip()
        settings.telegram_chat_id = req.chat_id.strip()

    config["telegram"] = telegram
    _write_config(config)
    return {"status": "success"}


@router.post("/telegram/test")
async def test_telegram_settings(req: TelegramTestPayload):
    message = (req.message or "").strip() or "Telegram test message from sparse-kuiper."
    ok = send_telegram_message(message)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to send Telegram message. Check enabled state, bot token, and chat ID.")
    return {"status": "success", "message": "Telegram test message sent."}


@router.post("/maintenance/db/flush")
async def flush_database(req: DatabaseFlushPayload, db: Session = Depends(get_db)):
    confirm = (req.confirm_text or "").strip().upper()
    if confirm != "FLUSH":
        raise HTTPException(status_code=400, detail="Invalid confirmation text. Type FLUSH to continue.")

    deleted: dict[str, int] = {}
    total_deleted = 0

    def _delete(query, key: str) -> None:
        nonlocal total_deleted
        count = query.delete(synchronize_session=False)
        deleted[key] = int(count or 0)
        total_deleted += deleted[key]

    deleted_files = 0
    scanned_dirs: list[str] = []

    def _clear_queue_files() -> int:
        removed = 0
        queue_dirs: list[Path] = [Path(UPLOAD_QUEUE_DIR)]
        queue_dirs.extend(Path(VIDEO_PROJECTS_DIR).glob("*/queue"))
        queue_dirs.extend(Path(VIDEO_PROJECTS_DIR).glob("*/*/queue"))
        queue_dirs.extend(Path(PROJECTS_DIR).glob("*/queue"))

        for qdir in queue_dirs:
            if not qdir.exists() or not qdir.is_dir():
                continue
            scanned_dirs.append(str(qdir))
            for fp in qdir.iterdir():
                if not fp.is_file():
                    continue
                try:
                    fp.unlink()
                    removed += 1
                except Exception as exc:
                    logger.warning(f"Failed to remove queue file {fp}: {exc}")
        return removed

    try:
        if req.clear_upload_queue:
            _delete(db.query(UploadQueueItem), "upload_queue")
        if req.clear_generation_tasks:
            _delete(db.query(GenerationTask), "generation_task")
        if req.clear_realtime_events:
            _delete(db.query(RealtimeEvent), "realtime_event")
        if req.clear_asset_metadata:
            _delete(db.query(AssetMetadata), "asset_metadata")
        if req.clear_project_configs:
            _delete(db.query(ProjectConfig), "project_config")
        if req.clear_non_prompt_app_settings:
            _delete(
                db.query(AppSetting).filter(AppSetting.setting_type != TEMPLATE_SETTING_TYPE),
                "app_settings_non_prompt",
            )
        if req.clear_accounts:
            _delete(db.query(Account), "accounts")

        db.commit()

        if req.clear_queue_files:
            deleted_files = _clear_queue_files()
    except Exception:
        db.rollback()
        raise

    return {
        "status": "success",
        "message": f"Database flush completed. Deleted {total_deleted} row(s).",
        "deleted": deleted,
        "deleted_files": deleted_files,
        "scanned_queue_dirs": scanned_dirs,
        "preserved": {
            "accounts": not req.clear_accounts,
            "prompt_templates": True,
            "non_prompt_app_settings": not req.clear_non_prompt_app_settings,
            "queue_files": not req.clear_queue_files,
        },
    }
