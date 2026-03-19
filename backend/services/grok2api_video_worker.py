from __future__ import annotations

import json
import sys
from pathlib import Path

from backend.core.config import VIDEO_PROJECTS_DIR
from backend.core.logger import logger
from backend.services.grok2api_service import generate_videos_to_dir


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python -m backend.services.grok2api_video_worker <payload_json_path>")
        return 1

    payload_path = Path(sys.argv[1]).resolve()
    if not payload_path.exists():
        logger.error("[Grok2API Video Worker] Payload file not found: %s", payload_path)
        return 1

    try:
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
        project_name = str(payload.get("project_name") or "").strip()
        prompts = [str(item).strip() for item in (payload.get("prompts") or []) if str(item).strip()]
        size = str(payload.get("size") or "1792x1024").strip() or "1792x1024"
        seconds = int(payload.get("seconds") or 6)
        quality = str(payload.get("quality") or "standard").strip() or "standard"
        model = str(payload.get("model") or "grok-imagine-1.0-video").strip() or "grok-imagine-1.0-video"
        image_url = str(payload.get("image_url") or "").strip() or None
        if not project_name:
            raise ValueError("project_name is required")

        output_dir = VIDEO_PROJECTS_DIR / project_name / "raw_videos"
        logger.info(
            "[Grok2API Video Worker] Start project=%s prompts=%s size=%s seconds=%s quality=%s model=%s",
            project_name,
            len(prompts),
            size,
            seconds,
            quality,
            model,
        )
        result = generate_videos_to_dir(
            prompts=prompts,
            output_dir=output_dir,
            size=size,
            seconds=seconds,
            quality=quality,
            model=model,
            image_url=image_url,
        )
        logger.info(
            "[Grok2API Video Worker] Done project=%s status=%s created=%s errors=%s",
            project_name,
            result["status"],
            len(result["created"]),
            len(result["errors"]),
        )
        if result["errors"]:
            preview_errors = "; ".join(result["errors"][:3])
            logger.error("[Grok2API Video Worker] Error preview project=%s: %s", project_name, preview_errors)
        return 0
    except Exception as exc:
        logger.exception("[Grok2API Video Worker] Failed: %s", exc)
        return 1
    finally:
        try:
            payload_path.unlink(missing_ok=True)
        except Exception:
            logger.warning("[Grok2API Video Worker] Failed to delete payload file: %s", payload_path)


if __name__ == "__main__":
    raise SystemExit(main())
