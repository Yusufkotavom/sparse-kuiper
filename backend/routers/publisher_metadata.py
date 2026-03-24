from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
import json
from pathlib import Path

from backend.core.config import VIDEO_PROJECTS_DIR, PROJECTS_DIR
from backend.core.database import get_db
from backend.core.logger import logger
from backend.models.asset_metadata import AssetMetadata
from backend.routers.publisher_schemas import MetadataRequest
from backend.services.prompt_engine import _chat_completion_text, _resolve_provider_and_model
from sqlalchemy.orm import Session
import re


router = APIRouter()


@router.post("/generate-metadata")
async def generate_metadata(request: MetadataRequest, db: Session = Depends(get_db)):
    from backend.routers.settings import _read_config, DEFAULT_SYSTEM_PROMPTS
    _cfg = _read_config()
    system_prompt = (
        _cfg.get("system_prompts", {}).get("metadata_generate")
        or DEFAULT_SYSTEM_PROMPTS["metadata_generate"]
    )

    def _parse_asset_path(project_type: str, file: str):
        parts = file.replace("\\", "/").split("/")
        if len(parts) == 0:
            raise HTTPException(status_code=400, detail="Invalid file path")
        project_name = parts[0]
        filename = parts[-1]
        canonical_dir = ""
        if "queue" in parts:
            idx = parts.index("queue")
            if idx > 0:
                canonical_dir = parts[idx - 1]
        else:
            if len(parts) > 1:
                canonical_dir = parts[1]
        return project_name, canonical_dir, filename

    def _resolve_prompt_from_asset(project_type: str, file: str) -> str:
        normalized = file.replace("\\", "/")
        parts = normalized.split("/")
        if not parts:
            return ""
        project_name = parts[0]
        filename = parts[-1]

        match = re.search(r"prompt_(\d+)", filename)
        if not match:
            return ""
        try:
            idx = int(match.group(1)) - 1
        except Exception:
            return ""
        if idx < 0:
            return ""

        if project_type == "video":
            prompts_file = VIDEO_PROJECTS_DIR / project_name / "prompts.json"
        elif project_type == "kdp":
            prompts_file = PROJECTS_DIR / project_name / "prompts.json"
        else:
            return ""

        if not prompts_file.exists():
            return ""
        try:
            with open(prompts_file, "r", encoding="utf-8") as f:
                prompts = json.load(f)
            if isinstance(prompts, list) and idx < len(prompts) and isinstance(prompts[idx], str):
                return prompts[idx].strip()
        except Exception:
            return ""
        return ""

    def _read_sidecar_metadata(project_type: str, file: str) -> dict:
        if project_type == "video":
            base = VIDEO_PROJECTS_DIR
        elif project_type == "kdp":
            base = PROJECTS_DIR
        else:
            return {}

        full_path = base / file
        parent = full_path.parent
        sidecar_path = parent / f"{full_path.stem}.meta.json"
        if sidecar_path.exists():
            try:
                with open(sidecar_path, "r", encoding="utf-8") as sf:
                    data = json.load(sf)
                return {
                    "title": data.get("title", "") or "",
                    "description": data.get("description", "") or "",
                    "tags": data.get("tags", "") or "",
                    "context_lines": [],
                }
            except Exception:
                return {}

        info_path = parent / f"{full_path.stem}.info.json"
        if info_path.exists():
            try:
                with open(info_path, "r", encoding="utf-8") as jf:
                    data = json.load(jf)
                raw_tags = data.get("tags", []) or []
                raw_cats = data.get("categories", []) or []
                combined = list(dict.fromkeys(raw_tags + raw_cats))
                tags_str = " ".join(f"#{str(t).replace(' ', '')}" for t in combined[:10])
                info_tags = [str(t).strip() for t in raw_tags if str(t).strip()]
                info_cats = [str(c).strip() for c in raw_cats if str(c).strip()]
                context_lines: list[str] = []
                for key in ("uploader", "channel", "webpage_url", "original_url", "upload_date"):
                    value = data.get(key)
                    if value:
                        context_lines.append(f"{key}: {value}")
                if data.get("duration"):
                    context_lines.append(f"duration_seconds: {data.get('duration')}")
                if data.get("view_count"):
                    context_lines.append(f"view_count: {data.get('view_count')}")
                if info_cats:
                    context_lines.append(f"categories: {', '.join(info_cats[:10])}")
                if info_tags:
                    context_lines.append(f"source_tags: {', '.join(info_tags[:20])}")

                return {
                    "title": data.get("title", "") or "",
                    "description": (data.get("description") or "").strip()[:500],
                    "tags": tags_str,
                    "context_lines": context_lines,
                }
            except Exception:
                return {}

        return {}

    def _parse_json_loose(text: str) -> dict:
        s = text.strip()
        if s.startswith("```"):
            s = s.lstrip("`")
            s = s.replace("json\n", "", 1) if s.startswith("json") else s
            s = s.replace("```", "")
        try:
            return json.loads(s)
        except Exception:
            try:
                start = s.find("{")
                end = s.rfind("}")
                if start != -1 and end != -1 and end > start:
                    return json.loads(s[start:end + 1])
            except Exception:
                pass
        return {}

    try:
        default_model = "groq:llama-3.3-70b-versatile"
        provider_name, model_name = _resolve_provider_and_model(request.provider, request.model or default_model)
        if not model_name and provider_name == "openai":
            model_name = "gpt-4o-mini"
        if not model_name and provider_name == "gemini":
            model_name = "gemini-1.5-flash"

        user_parts: list[str] = []
        prompt_text = (request.prompt or "").strip()

        if request.project_type and request.file:
            project_type = request.project_type
            file = request.file
            user_parts.append(f"Asset file: {file}")

            gen_prompt = _resolve_prompt_from_asset(project_type, file)
            if gen_prompt:
                user_parts.append(f"Generation prompt:\n{gen_prompt}")

            seed_title = (request.title or "").strip()
            seed_description = (request.description or "").strip()
            seed_tags = (request.tags or "").strip()

            project_name, canonical_dir, filename = _parse_asset_path(project_type, file)
            row = None
            try:
                row = (
                    db.query(AssetMetadata)
                    .filter(
                        AssetMetadata.project_type == project_type,
                        AssetMetadata.project_name == project_name,
                        AssetMetadata.filename == filename,
                    )
                    .first()
                )
            except Exception:
                row = None
            if row:
                if not seed_title:
                    seed_title = (row.title or "").strip()
                if not seed_description:
                    seed_description = (row.description or "").strip()
                if not seed_tags:
                    seed_tags = (row.tags or "").strip()

            sidecar = _read_sidecar_metadata(project_type, file)
            if sidecar:
                if not seed_title:
                    seed_title = (sidecar.get("title") or "").strip()
                if not seed_description:
                    seed_description = (sidecar.get("description") or "").strip()
                if not seed_tags:
                    seed_tags = (sidecar.get("tags") or "").strip()
                context_lines = sidecar.get("context_lines") or []
                if isinstance(context_lines, list):
                    cleaned = [str(line).strip() for line in context_lines if str(line).strip()]
                    if cleaned:
                        user_parts.append("Asset/source context:")
                        for line in cleaned[:12]:
                            user_parts.append(f"- {line}")

            if seed_title or seed_description or seed_tags:
                user_parts.append("Existing metadata (may be incomplete, improve if needed):")
                if seed_title:
                    user_parts.append(f"- title: {seed_title}")
                if seed_description:
                    user_parts.append(f"- description: {seed_description}")
                if seed_tags:
                    user_parts.append(f"- tags: {seed_tags}")

            filename_keywords = [
                seg for seg in re.split(r"[^a-zA-Z0-9]+", filename) if seg and not seg.isdigit()
            ]
            if filename_keywords:
                user_parts.append(f"Filename keywords: {', '.join(filename_keywords[:8])}")

        if prompt_text:
            user_parts.append(f"Additional context:\n{prompt_text}")

        if not user_parts:
            user_parts.append('Additional context: ""')

        content = _chat_completion_text(
            provider=provider_name,
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "You are to produce ONLY a compact JSON object with keys: "
                        'title (string), description (string), tags (array of strings). '
                        "Do not include code fences, markdown, or explanations.\n\n"
                        "If existing metadata is provided, treat it as primary context.\n"
                        "Preserve core topic/entities/intent; improve wording, clarity, and virality without drifting topic.\n"
                        "Use source context and filename keywords to stay relevant.\n\n"
                        + "\n\n".join(user_parts)
                    ),
                },
            ],
            temperature=0.5,
        )
        result_json = _parse_json_loose(content or "")
        title = result_json.get("title") or "Viral Video"
        description = result_json.get("description") or "Check this out!"
        tags_val = result_json.get("tags", [])
        if isinstance(tags_val, list):
            tags = " ".join(str(t) for t in tags_val if str(t).strip())
        else:
            tags = str(tags_val)
        return {"title": title, "description": description, "tags": tags}
    except Exception as e:
        logger.error(f"Error generating metadata: {e}")
        return {
            "title": (request.prompt or "Viral Video")[:80],
            "description": f"{request.prompt or 'New content'} — ready to publish.",
            "tags": "#viral",
        }


@router.get("/metadata/sidecar")
async def get_sidecar_metadata(project_type: str, file: str):
    if project_type == "video":
        base = VIDEO_PROJECTS_DIR
    elif project_type == "kdp":
        base = PROJECTS_DIR
    else:
        raise HTTPException(status_code=400, detail="Invalid project_type")

    full_path = base / file
    parent = full_path.parent
    sidecar_path = parent / f"{full_path.stem}.meta.json"
    if not sidecar_path.exists():
        info_path = parent / f"{full_path.stem}.info.json"
        if info_path.exists():
            try:
                with open(info_path, "r", encoding="utf-8") as jf:
                    data = json.load(jf)
                raw_tags = data.get("tags", []) or []
                raw_cats = data.get("categories", []) or []
                combined = list(dict.fromkeys(raw_tags + raw_cats))
                tags_str = " ".join(f"#{str(t).replace(' ', '')}" for t in combined[:10])
                return {
                    "title": data.get("title", ""),
                    "description": (data.get("description") or "").strip()[:500],
                    "tags": tags_str,
                }
            except Exception:
                pass
        return JSONResponse(status_code=404, content={"message": "Sidecar not found"})
    try:
        with open(sidecar_path, "r", encoding="utf-8") as sf:
            data = json.load(sf)
        return {
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "tags": data.get("tags", ""),
        }
    except Exception as e:
        logger.error(f"[Sidecar] Failed reading sidecar metadata: {e}")
        raise HTTPException(status_code=500, detail="Failed to read sidecar metadata")
