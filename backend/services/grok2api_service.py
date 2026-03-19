from __future__ import annotations

import base64
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

from backend.core.config import settings


def _base_url() -> str:
    base = (settings.grok2api_base_url or "").strip()
    if not base:
        raise ValueError("GROK2API_BASE_URL is not configured.")

    if "://" not in base:
        base = f"http://{base}"

    parsed = urlparse(base)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("GROK2API_BASE_URL must use http:// or https:// scheme.")

    return base.rstrip("/")


def _api_url(path: str) -> str:
    base = _base_url()
    normalized_path = path if path.startswith("/") else f"/{path}"
    if base.endswith("/v1") and normalized_path.startswith("/v1/"):
        normalized_path = normalized_path[3:]
    return f"{base}{normalized_path}"


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    api_key = (settings.grok2api_api_key or "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def _error_text(response: requests.Response) -> str:
    body = (response.text or "").strip()
    return f"HTTP {response.status_code}: {body[:1000]}" if body else f"HTTP {response.status_code}"


def _safe_filename(prefix: str, index: int, suffix: str) -> str:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{prefix}-{stamp}-{index:03d}{suffix}"


def generate_images_to_dir(
    *,
    prompts: list[str],
    output_dir: Path,
    size: str = "1024x1024",
    model: str = "grok-imagine-1.0",
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    created: list[str] = []
    errors: list[str] = []

    for index, prompt in enumerate(prompts, start=1):
        clean_prompt = (prompt or "").strip()
        if not clean_prompt:
            errors.append(f"Prompt #{index} kosong.")
            continue

        payload = {
            "model": model,
            "prompt": clean_prompt,
            "n": 1,
            "size": size,
            "response_format": "b64_json",
            "stream": False,
        }

        try:
            response = requests.post(
                _api_url("/v1/images/generations"),
                headers=_headers(),
                json=payload,
                timeout=240,
            )
            if not response.ok:
                raise RuntimeError(_error_text(response))

            data = response.json()
            item = ((data.get("data") or [None])[0]) or {}
            raw_b64 = item.get("b64_json")
            if not raw_b64:
                raise RuntimeError("Response did not contain b64_json image data.")

            filename = _safe_filename("grok2api-image", index, ".png")
            out_path = output_dir / filename
            out_path.write_bytes(base64.b64decode(raw_b64))
            created.append(str(out_path))
        except Exception as exc:
            errors.append(f"Prompt #{index}: {exc}")

    status = "success" if created and not errors else "partial_success" if created else "error"
    return {"status": status, "created": created, "errors": errors}


def generate_videos_to_dir(
    *,
    prompts: list[str],
    output_dir: Path,
    size: str = "1792x1024",
    seconds: int = 6,
    quality: str = "standard",
    model: str = "grok-imagine-1.0-video",
    image_url: str | None = None,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    created: list[str] = []
    errors: list[str] = []

    for index, prompt in enumerate(prompts, start=1):
        clean_prompt = (prompt or "").strip()
        if not clean_prompt:
            errors.append(f"Prompt #{index} kosong.")
            continue

        payload: dict[str, Any] = {
            "model": model,
            "prompt": clean_prompt,
            "size": size,
            "seconds": seconds,
            "quality": quality,
        }
        if image_url:
            payload["image_reference"] = {"image_url": image_url}

        try:
            response = requests.post(
                _api_url("/v1/videos"),
                headers=_headers(),
                json=payload,
                timeout=600,
            )
            if not response.ok:
                raise RuntimeError(_error_text(response))

            data = response.json()
            video_url = (data.get("url") or "").strip()
            if not video_url:
                raise RuntimeError("Response did not contain downloadable video URL.")

            video_response = requests.get(video_url, timeout=600)
            video_response.raise_for_status()

            filename = _safe_filename("grok2api-video", index, ".mp4")
            out_path = output_dir / filename
            out_path.write_bytes(video_response.content)
            created.append(str(out_path))
        except Exception as exc:
            errors.append(f"Prompt #{index}: {exc}")

    status = "success" if created and not errors else "partial_success" if created else "error"
    return {"status": status, "created": created, "errors": errors}
