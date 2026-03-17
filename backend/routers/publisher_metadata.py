from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import json
from pathlib import Path

from backend.core.config import VIDEO_PROJECTS_DIR, PROJECTS_DIR
from backend.core.logger import logger
from backend.routers.publisher_schemas import MetadataRequest
from backend.services.prompt_engine import _chat_completion_text, _resolve_provider_and_model


router = APIRouter()


@router.post("/generate-metadata")
async def generate_metadata(request: MetadataRequest):
    from backend.routers.settings import _read_config, DEFAULT_SYSTEM_PROMPTS
    _cfg = _read_config()
    system_prompt = (
        _cfg.get("system_prompts", {}).get("metadata_generate")
        or DEFAULT_SYSTEM_PROMPTS["metadata_generate"]
    )

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
                        f'Generate metadata for: \"{request.prompt}\"'
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

