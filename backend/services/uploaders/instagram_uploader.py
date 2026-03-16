"""
Instagram Uploader service — launches instagram_upload_worker.py as a subprocess.

Authentication:
    Uses cookies.txt (Netscape format) from: data/sessions/<account_id>/cookies.txt
"""

import os
import sys
import json
import uuid
import asyncio
import subprocess
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent  # project root
SESSIONS_DIR = BASE_DIR / "data" / "sessions"
WORKER_SCRIPT = Path(__file__).resolve().parent.parent / "instagram_upload_worker.py"
JOBS_DIR = BASE_DIR / "data" / "upload_jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)


def get_cookies_path(account_id: str) -> Path:
    return SESSIONS_DIR / account_id / "cookies.txt"


async def upload_to_instagram(
    account_id: str,
    videos: List[Dict[str, str]], # Expected keys: "video_path", "description", etc.
) -> dict:
    """
    Uploads a batch of videos to Instagram Reels via a detached subprocess worker.
    """
    cookies_path = get_cookies_path(account_id)
    if not cookies_path.exists():
        return {
            "success": False,
            "message": f"No cookies.txt for account '{account_id}'. Please login via Accounts page first."
        }

    # Format tags for each video description
    formatted_videos = []
    for vid in videos:
        title = vid.get("title", "")
        desc = vid.get("description", "")
        tags = vid.get("tags", "")
        raw_tags = tags.replace(",", " ").split()
        formatted_tags = " ".join(t if t.startswith("#") else f"#{t}" for t in raw_tags if t)
        
        # Combine description and tags
        description_parts = []
        if title: description_parts.append(title)
        if desc: description_parts.append(desc)
        if formatted_tags: description_parts.append(formatted_tags)
        
        description_text = "\n".join(description_parts).strip()
        
        formatted_videos.append({
            "video_path": vid["video_path"],
            "description": description_text,
        })

    # Write job file
    job_id = str(uuid.uuid4())[:8]
    job_path = JOBS_DIR / f"job_{job_id}.json"
    result_path = JOBS_DIR / f"job_{job_id}_result.json"

    job_data = {
        "cookies_path": str(cookies_path),
        "videos": formatted_videos
    }

    with open(job_path, "w", encoding="utf-8") as f:
        json.dump(job_data, f, indent=2)

    log_path = JOBS_DIR / f"job_{job_id}.log"
    logger.info(f"[Instagram] Launching batch upload worker for job {job_id}: {len(formatted_videos)} videos")

    kwargs = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS

    proc = subprocess.Popen(
        [sys.executable, str(WORKER_SCRIPT), str(job_path)],
        cwd=str(BASE_DIR),
        stdout=open(log_path, "w"),
        stderr=subprocess.STDOUT,
        **kwargs
    )

    # Poll for result (max 10 minutes for upload)
    for _ in range(120):  # 120 x 5s = 600s = 10 min
        await asyncio.sleep(5)
        if result_path.exists():
            try:
                with open(result_path, "r", encoding="utf-8") as f:
                    result = json.load(f)
                logger.info(f"[Instagram] Job {job_id} result: {result}")
                return result
            except Exception as e:
                logger.error(f"[Instagram] Failed to read result for job {job_id}: {e}")
                return {"success": False, "message": f"Failed to read upload result: {e}"}

        # Check if process died without writing result
        if proc.poll() is not None and not result_path.exists():
            # Read log for error
            try:
                with open(log_path, "r") as f:
                    err = f.read()[-1000:]
            except Exception:
                err = "(no log)"
            return {"success": False, "message": f"Worker process exited without result. Log:\n{err}"}

    return {"success": False, "message": "Upload timed out (10 minutes). Check logs."}
