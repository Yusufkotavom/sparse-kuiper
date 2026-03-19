import os
import json
import base64
from pathlib import Path

import requests


BASE_URL = os.getenv("GROK2API_BASE_URL", "http://localhost:8000").rstrip("/")
API_KEY = os.getenv("GROK2API_API_KEY", "").strip()  # isi kalau app.api_key kamu aktif


def _headers():
    h = {"Content-Type": "application/json"}
    if API_KEY:
        h["Authorization"] = f"Bearer {API_KEY}"
    return h


def gen_image(prompt: str, out_path: str = "out.png"):
    url = f"{BASE_URL}/v1/images/generations"
    payload = {
        "model": "grok-imagine-1.0",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "response_format": "b64_json",  # bisa juga "url"
        "stream": False,
    }
    r = requests.post(url, headers=_headers(), json=payload, timeout=120)
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code} from {url}: {r.text[:1000]}")
    data = r.json()

    item = (data.get("data") or [None])[0] or {}
    b64 = item.get("b64_json")
    if not b64:
        raise RuntimeError(f"Unexpected response: {json.dumps(data)[:500]}")

    Path(out_path).write_bytes(base64.b64decode(b64))
    return out_path


def gen_video(prompt: str, out_path: str = "out.mp4", image_url: str | None = None):
    url = f"{BASE_URL}/v1/videos"
    payload = {
        "model": "grok-imagine-1.0-video",
        "prompt": prompt,
        "size": "1792x1024",     # salah satu: 1280x720, 720x1280, 1792x1024, 1024x1792, 1024x1024
        "seconds": 6,           # 6-30
        "quality": "standard",  # standard/high
    }
    if image_url:
        payload["image_reference"] = {"image_url": image_url}  # image-to-video

    r = requests.post(url, headers=_headers(), json=payload, timeout=600)
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code} from {url}: {r.text[:2000]}")
    data = r.json()

    video_url = data.get("url")
    if not video_url:
        raise RuntimeError(f"Unexpected response: {json.dumps(data)[:500]}")

    # download mp4 dari url hasil
    vr = requests.get(video_url, timeout=600)
    vr.raise_for_status()
    Path(out_path).write_bytes(vr.content)
    return out_path, video_url


if __name__ == "__main__":
    img = gen_image("Seekor kucing cyberpunk, neon, 4k")
    print("Image saved:", img)

    vid, vid_url = gen_video("Cyberpunk city flythrough, cinematic", image_url=None)
    print("Video saved:", vid)
    print("Video url:", vid_url)
