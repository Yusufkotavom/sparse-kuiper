from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import Dict, Any
import os
import json
from datetime import datetime, timedelta, timezone
import subprocess
import sys
from pathlib import Path
from sqlalchemy.orm import Session

from backend.core.config import UPLOAD_QUEUE_DIR, BASE_DIR, SESSIONS_DIR
from backend.core.database import get_db
from backend.core.json_utils import ensure_json_dict
from backend.core.logger import logger
from backend.core.realtime import publish_realtime_event
from backend.models.upload_queue import UploadQueueItem
from backend.routers.publisher_queue import sync_queue_job_state
from backend.routers.publisher_schemas import UploadRequest, BatchUploadRequest
from backend.services.telegram_notifier import send_telegram_message


router = APIRouter()


def _publish_queue_event(db: Session, item: UploadQueueItem, event_type: str = "updated"):
    publish_realtime_event(
        db,
        stream="upload_queue",
        event_type=event_type,
        entity_table="upload_queue",
        entity_id=item.filename,
        payload=item.to_dict(),
    )


def _build_upload_notification(item: UploadQueueItem) -> str | None:
    status = (item.status or "").strip().lower()
    if status not in {"completed", "completed_with_errors"}:
        return None

    success_lines: list[str] = []
    failed_lines: list[str] = []
    for platform, data in (item.platforms or {}).items():
        line = f"- {platform}: {data.get('message', '')}".strip()
        if data.get("status") == "success":
            success_lines.append(line)
        else:
            failed_lines.append(line)

    lines = [
        "Publisher upload finished",
        f"File: {item.filename}",
        f"Status: {item.status}",
    ]

    if success_lines:
        lines.append("Success:")
        lines.extend(success_lines)
    if failed_lines:
        lines.append("Failed:")
        lines.extend(failed_lines)
    if item.last_error and not failed_lines:
        lines.append(f"Error: {item.last_error}")

    return "\n".join(lines)


def _notify_upload_result(item: UploadQueueItem) -> None:
    message = _build_upload_notification(item)
    if message:
        send_telegram_message(message)


def _get_or_create_item(db: Session, filename: str) -> UploadQueueItem:
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        item = UploadQueueItem(filename=filename, status="pending")
        item.platforms = {}
        db.add(item)
        db.flush()
    return item


def _max_attempts() -> int:
    try:
        return max(1, int(os.environ.get("PUBLISHER_JOB_MAX_ATTEMPTS", "3")))
    except Exception:
        return 3


def _retry_delay_seconds(attempt_count: int) -> int:
    base = max(30, int(os.environ.get("PUBLISHER_RETRY_BASE_SECONDS", "60")))
    capped_attempt = max(1, attempt_count)
    return min(base * (2 ** (capped_attempt - 1)), 3600)


def _mark_retryable_failure(item: UploadQueueItem, message: str) -> None:
    item.last_error = (message or "Upload failed")[:1000]
    item.lease_expires_at = None
    if int(item.attempt_count or 0) < _max_attempts():
        item.worker_state = "queued"
        item.status = "queued"
        item.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=_retry_delay_seconds(int(item.attempt_count or 0)))
    else:
        item.worker_state = "failed"
        item.status = "failed"
        item.next_retry_at = None


def _apply_legacy_job_config(item: UploadQueueItem, request: UploadRequest) -> None:
    item.target_platforms = request.platforms or []
    account_map = {}
    for platform in request.platforms or []:
        if request.account_id:
            account_map[platform] = request.account_id
    item.account_map = account_map
    item.options = {
        "open_browser": request.open_browser,
        "pw_debug": request.pw_debug,
        "youtube_privacy": request.youtube_privacy,
        "youtube_category_id": request.youtube_category_id,
        "product_id": request.product_id,
        "platform_publish_schedule": request.schedule or "",
    }
    try:
        item.scheduled_at = datetime.fromisoformat(request.schedule) if request.schedule else None
    except Exception:
        item.scheduled_at = None
    sync_queue_job_state(item)


def _run_youtube_playwright_upload(
    account,
    file_path: str,
    title: str,
    description: str,
    tags: str,
    schedule: str = "",
    youtube_privacy: str = "private",
    youtube_category_id: str = "22",
    open_browser: bool = False,
    pw_debug: bool = False,
) -> Dict[str, Any]:
    session_dir = os.path.join(str(SESSIONS_DIR), account.id)
    cookies_path = os.path.join(session_dir, "cookies.txt")
    if not os.path.exists(cookies_path):
        return {"success": False, "message": f"YouTube Playwright session not connected (missing cookies.txt at {cookies_path})."}

    job_dir = BASE_DIR / "data" / "upload_jobs"
    job_dir.mkdir(parents=True, exist_ok=True)
    job_path = job_dir / f"yt_playwright_{datetime.now().timestamp()}.json"
    result_path = Path(str(job_path).replace(".json", "_result.json"))
    job_payload = {
        "session_dir": session_dir,
        "video_path": file_path,
        "title": title,
        "description": description,
        "tags": tags,
        "schedule": schedule,
        "youtube_privacy": youtube_privacy,
        "youtube_category_id": youtube_category_id,
        "headless": not open_browser,
        "pw_debug": pw_debug,
        "browser_type": account.browser_type or "chromium",
        "proxy": account.proxy,
        "user_agent": account.user_agent,
    }

    with open(job_path, "w", encoding="utf-8") as f:
        json.dump(job_payload, f)

    script_path = BASE_DIR / "backend" / "services" / "youtube_playwright_upload_worker.py"
    cwd_path = BASE_DIR
    result_proc = subprocess.run(
        [sys.executable, str(script_path), str(job_path)],
        cwd=str(cwd_path),
        capture_output=True,
        text=True,
        check=False
    )

    if result_proc.stdout:
        logger.info(f"[YouTube Playwright Worker STDOUT] {result_proc.stdout}")
    if result_proc.stderr:
        logger.error(f"[YouTube Playwright Worker STDERR] {result_proc.stderr}")

    if not result_path.exists():
        return {"success": False, "message": "Worker did not produce a result"}

    with open(result_path, "r", encoding="utf-8") as rf:
        return json.load(rf)


def process_upload_task(filename: str, request: UploadRequest):
    from backend.core.database import SessionLocal
    db = SessionLocal()
    try:
        logger.info(f"Starting upload for {filename} to {request.platforms}")

        item = _get_or_create_item(db, filename)
        file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)

        if not os.path.exists(file_path):
            logger.error(f"Cannot upload {filename}: file not found at {file_path}")
            _mark_retryable_failure(item, f"File not found: {file_path}")
            _publish_queue_event(db, item)
            _notify_upload_result(item)
            db.commit()
            return

        item = _get_or_create_item(db, filename)
        item.status = "uploading"
        item.worker_state = "running"
        item.title = request.title
        item.description = request.description
        item.tags = request.tags
        item.next_retry_at = None
        _publish_queue_event(db, item)
        db.commit()

        platforms_status = item.platforms.copy()

        for platform in request.platforms:
            result = {"success": False, "message": "Not implemented"}
            try:
                if platform == "tiktok":
                    if not request.account_id:
                        result = {"success": False, "message": "No account_id provided."}
                    else:
                        from backend.models.account import Account
                        account = db.query(Account).filter(Account.id == request.account_id).first()
                        _cookies_path = os.path.join(str(SESSIONS_DIR), request.account_id, "cookies.txt")
                        logger.info(f"[TikTok] Checking cookies at: {_cookies_path} | exists={os.path.exists(_cookies_path)} | account={account is not None}")
                        if not account or not os.path.exists(_cookies_path):
                            result = {"success": False, "message": f"TikTok account not connected (missing cookies.txt at {_cookies_path})."}
                            logger.error(f"[TikTok] FAIL — cookies check failed. path={_cookies_path}")
                        else:
                            job_dir = BASE_DIR / "data" / "upload_jobs"
                            job_dir.mkdir(parents=True, exist_ok=True)
                            job_path = job_dir / f"tiktok_{datetime.now().timestamp()}.json"
                            result_path = Path(str(job_path).replace(".json", "_result.json"))
                            logger.info(f"[TikTok] Step1: job_path={job_path}")

                            job_payload = {
                                "cookies_path": _cookies_path,
                                "videos": [{
                                    "video_path": file_path,
                                    "description": (
                                        (
                                            ((request.title or "").strip() + ("\n" if (request.title or "").strip() else "")) +
                                            ((request.description or "").strip() + ("\n" if (request.description or "").strip() else ""))
                                        )
                                        +
                                        " ".join(
                                            t if t.startswith("#") else f"#{t}"
                                            for t in (request.tags or "").replace(",", " ").split()
                                            if t
                                        )
                                    ).strip(),
                                    "schedule": request.schedule or None,
                                    "product_id": request.product_id or None
                                }],
                                "headless": not request.open_browser,
                                "pw_debug": request.pw_debug,
                                "browser_type": (account.browser_type or "chromium"),
                                "proxy": (account.proxy or None)
                            }
                            logger.info(f"[TikTok] Step2: payload built, writing file...")

                            with open(str(job_path), "w", encoding="utf-8") as f:
                                json.dump(job_payload, f, indent=2)
                                f.flush()
                                os.fsync(f.fileno())
                            logger.info(f"[TikTok] Step3: file written ({job_path.stat().st_size} bytes)")

                            script_path = (BASE_DIR / "backend" / "services" / "tiktok_upload_worker.py").resolve()
                            cwd_path = BASE_DIR
                            logger.info(f"[TikTok] Step4: launching worker {script_path}...")

                            result_proc = subprocess.run(
                                [sys.executable, str(script_path), str(job_path)],
                                cwd=str(cwd_path),
                                capture_output=True,
                                text=True,
                                check=False
                            )

                            if result_proc.stdout:
                                logger.info(f"[TikTok Worker STDOUT] {result_proc.stdout}")
                            if result_proc.stderr:
                                logger.error(f"[TikTok Worker STDERR] {result_proc.stderr}")

                            logger.info(f"[TikTok] Step5: worker exited with code {result_proc.returncode}")

                            if not result_path.exists():
                                result = {"success": False, "message": "TikTok Worker did not produce result file"}
                            else:
                                with open(result_path, "r", encoding="utf-8") as rf:
                                    result = json.load(rf)
                elif platform == "youtube":
                    if not request.account_id:
                        result = {"success": False, "message": "No YouTube account_id provided."}
                    else:
                        from backend.models.account import Account
                        account = db.query(Account).filter(Account.id == request.account_id).first()
                        if not account:
                            result = {"success": False, "message": "YouTube account not connected."}
                        elif account.auth_method == "playwright":
                            result = _run_youtube_playwright_upload(
                                account=account,
                                file_path=file_path,
                                title=request.title,
                                description=request.description,
                                tags=request.tags,
                                schedule=request.schedule,
                                youtube_privacy=request.youtube_privacy,
                                youtube_category_id=request.youtube_category_id,
                                open_browser=request.open_browser,
                                pw_debug=request.pw_debug,
                            )
                        elif not account.oauth_token_json:
                            result = {"success": False, "message": "YouTube account not connected."}
                        else:
                            from backend.services.uploaders.youtube_uploader import upload_video
                            token_dict = ensure_json_dict(account.oauth_token_json)
                            yt_res = upload_video(
                                token_dict=token_dict,
                                video_path=file_path,
                                title=request.title,
                                description=request.description,
                                tags=request.tags,
                                privacy=request.youtube_privacy,
                                category_id=request.youtube_category_id,
                                schedule=request.schedule,
                            )
                            if yt_res.get("refreshed_token"):
                                account.oauth_token_json = yt_res["refreshed_token"]
                                db.commit()

                            result = {"success": True, "message": f"Uploaded: {yt_res.get('url')}"}
                elif platform == "facebook":
                    if not request.account_id:
                        result = {"success": False, "message": "No Facebook account_id provided."}
                    else:
                        from backend.models.account import Account
                        account = db.query(Account).filter(Account.id == request.account_id).first()
                        if not account or not account.oauth_token_json:
                            result = {"success": False, "message": "Facebook account not connected."}
                        else:
                            from backend.services.uploaders.facebook_uploader import upload_video_to_facebook
                            token_dict = ensure_json_dict(account.oauth_token_json)
                            try:
                                fb_res = upload_video_to_facebook(
                                    token_dict=token_dict,
                                    video_path=file_path,
                                    title=request.title,
                                    description=request.description,
                                    schedule=request.schedule
                                )
                                result = {"success": True, "message": f"Uploaded: {fb_res.get('url')}"}
                            except Exception as e:
                                result = {"success": False, "message": str(e)}
                elif platform == "instagram":
                    if not request.account_id:
                        result = {"success": False, "message": "No account_id provided."}
                    else:
                        import asyncio as _asyncio
                        from backend.services.uploaders.instagram_uploader import upload_to_instagram
                        result = _asyncio.run(upload_to_instagram(
                            account_id=request.account_id,
                            videos=[{
                                "video_path": file_path,
                                "title": request.title,
                                "description": request.description,
                                "tags": request.tags
                            }]
                        ))
            except Exception as e:
                result = {"success": False, "message": str(e)}

            platforms_status[platform] = {
                "status": "success" if result.get("success") else "failed",
                "message": result.get("message", ""),
                "timestamp": datetime.now().isoformat(),
            }

        all_success = all(v.get("status") == "success" for v in platforms_status.values())
        item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
        if item:
            item.platforms = platforms_status
            item.lease_expires_at = None
            if all_success:
                item.status = "completed"
                item.worker_state = "completed"
                item.last_error = ""
                item.next_retry_at = None
            else:
                _mark_retryable_failure(
                    item,
                    "; ".join(
                        f"{k}: {v.get('message', '')}" for k, v in platforms_status.items() if v.get("status") != "success"
                    )[:1000],
                )
            if all_success:
                item.uploaded_at = datetime.now()
            _publish_queue_event(db, item)
            if item.worker_state == "failed" or all_success:
                _notify_upload_result(item)
            db.commit()

        logger.info(f"Finished upload task for {filename}")
    finally:
        db.close()


@router.post("/upload/batch")
async def process_batch_upload(request: BatchUploadRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    logger.info(f"[Batch Upload] Received request with open_browser={request.open_browser}, platforms={request.platforms}, videos_count={len(request.videos)}")
    if not set(request.platforms).intersection({"tiktok", "youtube", "facebook", "instagram"}):
        raise HTTPException(status_code=400, detail="Batch upload is currently only supported for TikTok, YouTube, Facebook, and Instagram.")
    if not request.account_id:
        raise HTTPException(status_code=400, detail="No account_id provided for bulk upload.")

    videos_data = []
    has_scheduled_items = False
    for vid in request.videos:
        item = _get_or_create_item(db, vid.filename)
        file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / vid.filename)

        if not os.path.exists(file_path):
            continue

        if vid.schedule:
            has_scheduled_items = True

        videos_data.append({
            "video_path": file_path,
            "title": vid.title,
            "description": vid.description,
            "tags": vid.tags,
            "schedule": vid.schedule or None,
            "product_id": vid.product_id or None,
            "youtube_privacy": vid.youtube_privacy,
            "youtube_category_id": vid.youtube_category_id,
            "open_browser": request.open_browser,
            "pw_debug": request.pw_debug,
        })

        item = _get_or_create_item(db, vid.filename)
        item.title = vid.title
        item.description = vid.description
        item.tags = vid.tags
        item.target_platforms = request.platforms or []
        item.account_map = {platform: request.account_id for platform in (request.platforms or []) if request.account_id}
        item.options = {
            "open_browser": request.open_browser,
            "pw_debug": request.pw_debug,
            "youtube_privacy": vid.youtube_privacy,
            "youtube_category_id": vid.youtube_category_id,
            "product_id": vid.product_id or "",
            "platform_publish_schedule": vid.schedule or "",
        }
        try:
            item.scheduled_at = datetime.fromisoformat(vid.schedule) if vid.schedule else None
        except Exception:
            item.scheduled_at = None
        sync_queue_job_state(item)
        _publish_queue_event(db, item)

    if not videos_data:
        raise HTTPException(status_code=400, detail="No valid videos found for batch upload.")

    db.commit()

    if has_scheduled_items:
        return {"status": "success", "message": f"Configured {len(videos_data)} scheduled jobs"}

    async def run_batch_task(account_id, platforms, videos, open_browser_flag=False, pw_debug_flag=False):
        from backend.core.database import SessionLocal
        from backend.models.account import Account
        db2 = SessionLocal()
        try:
            account = db2.query(Account).filter(Account.id == account_id).first()
            if not account:
                logger.error(f"[Batch Upload] Account {account_id} not found.")
                return

            for platform in platforms:
                if platform == "tiktok":
                    from backend.services.uploaders.tiktok_uploader import upload_to_tiktok
                    open_browser = bool(open_browser_flag)
                    logger.info(f"[Batch Upload] TikTok open_browser={open_browser}, headless={not open_browser}")
                    result = await upload_to_tiktok(account_id=account_id, videos=videos, headless=not open_browser, pw_debug=pw_debug_flag)
                    for vid in videos:
                        fname = os.path.basename(vid["video_path"])
                        item = db2.query(UploadQueueItem).filter(UploadQueueItem.filename == fname).first()
                        if item:
                            plats = item.platforms.copy()
                            plats["tiktok"] = {
                                "status": "success" if result.get("success") else "failed",
                                "message": result.get("message", ""),
                                "timestamp": datetime.now().isoformat(),
                            }
                            item.platforms = plats
                            item.status = "completed" if result.get("success") else "completed_with_errors"
                            item.worker_state = "completed" if result.get("success") else "failed"
                            item.last_error = "" if result.get("success") else (result.get("message", "") or "")[:1000]
                            if result.get("success"):
                                item.uploaded_at = datetime.now()
                            _publish_queue_event(db2, item)
                            _notify_upload_result(item)
                elif platform == "youtube":
                    if account.auth_method == "playwright":
                        for vid in videos:
                            fname = os.path.basename(vid["video_path"])
                            try:
                                res = _run_youtube_playwright_upload(
                                    account=account,
                                    file_path=vid["video_path"],
                                    title=vid["title"],
                                    description=vid["description"],
                                    tags=vid["tags"],
                                    schedule=vid.get("schedule") or "",
                                    youtube_privacy=vid["youtube_privacy"],
                                    youtube_category_id=vid["youtube_category_id"],
                                    open_browser=open_browser_flag,
                                    pw_debug=pw_debug_flag,
                                )
                                status = "success" if res.get("success") else "failed"
                                msg = res.get("message", "")
                            except Exception as e:
                                status, msg = "failed", str(e)

                            item = db2.query(UploadQueueItem).filter(UploadQueueItem.filename == fname).first()
                            if item:
                                plats = item.platforms.copy()
                                plats["youtube"] = {
                                    "status": status,
                                    "message": msg,
                                    "timestamp": datetime.now().isoformat(),
                                }
                                item.platforms = plats
                                item.status = "completed" if status == "success" else "completed_with_errors"
                                item.worker_state = "completed" if status == "success" else "failed"
                                item.last_error = "" if status == "success" else (msg or "")[:1000]
                                if status == "success":
                                    item.uploaded_at = datetime.now()
                                _publish_queue_event(db2, item)
                                _notify_upload_result(item)
                    else:
                        from backend.services.uploaders.youtube_uploader import upload_video
                        if not account.oauth_token_json:
                            logger.error("[Batch Upload] YouTube account not connected.")
                            continue
                        token_dict = ensure_json_dict(account.oauth_token_json)

                        for vid in videos:
                            fname = os.path.basename(vid["video_path"])
                            try:
                                yt_res = upload_video(
                                    token_dict=token_dict,
                                    video_path=vid["video_path"],
                                    title=vid["title"],
                                    description=vid["description"],
                                    tags=vid["tags"],
                                    privacy=vid["youtube_privacy"],
                                    category_id=vid["youtube_category_id"],
                                    schedule=vid.get("schedule"),
                                )
                                if yt_res.get("refreshed_token"):
                                    token_dict = yt_res["refreshed_token"]
                                    account.oauth_token_json = token_dict
                                    db2.commit()

                                status, msg = "success", f"Uploaded: {yt_res.get('url')}"
                            except Exception as e:
                                status, msg = "failed", str(e)

                            item = db2.query(UploadQueueItem).filter(UploadQueueItem.filename == fname).first()
                            if item:
                                plats = item.platforms.copy()
                                plats["youtube"] = {
                                    "status": status,
                                    "message": msg,
                                    "timestamp": datetime.now().isoformat(),
                                }
                                item.platforms = plats
                                item.status = "completed" if status == "success" else "completed_with_errors"
                                item.worker_state = "completed" if status == "success" else "failed"
                                item.last_error = "" if status == "success" else (msg or "")[:1000]
                                if status == "success":
                                    item.uploaded_at = datetime.now()
                                _publish_queue_event(db2, item)
                                _notify_upload_result(item)
                elif platform == "facebook":
                    from backend.services.uploaders.facebook_uploader import upload_video_to_facebook
                    if not account.oauth_token_json:
                        logger.error("[Batch Upload] Facebook account not connected.")
                        continue
                    token_dict = ensure_json_dict(account.oauth_token_json)

                    for vid in videos:
                        fname = os.path.basename(vid["video_path"])
                        try:
                            fb_res = upload_video_to_facebook(
                                token_dict=token_dict,
                                video_path=vid["video_path"],
                                title=vid["title"],
                                description=vid["description"],
                                schedule=vid.get("schedule")
                            )
                            status, msg = "success", f"Uploaded: {fb_res.get('url')}"
                        except Exception as e:
                            status, msg = "failed", str(e)

                        item = db2.query(UploadQueueItem).filter(UploadQueueItem.filename == fname).first()
                        if item:
                            plats = item.platforms.copy()
                            plats["facebook"] = {
                                "status": status,
                                "message": msg,
                                "timestamp": datetime.now().isoformat(),
                            }
                            item.platforms = plats
                            item.status = "completed" if status == "success" else "completed_with_errors"
                            item.worker_state = "completed" if status == "success" else "failed"
                            item.last_error = "" if status == "success" else (msg or "")[:1000]
                            if status == "success":
                                item.uploaded_at = datetime.now()
                            _publish_queue_event(db2, item)
                            _notify_upload_result(item)
                elif platform == "instagram":
                    from backend.services.uploaders.instagram_uploader import upload_to_instagram

                    formatted_videos = []
                    for vid in videos:
                        formatted_videos.append({
                            "video_path": vid["video_path"],
                            "title": vid["title"],
                            "description": vid["description"],
                            "tags": vid["tags"]
                        })

                    result = await upload_to_instagram(account_id=account_id, videos=formatted_videos)
                    for vid in videos:
                        fname = os.path.basename(vid["video_path"])
                        item = db2.query(UploadQueueItem).filter(UploadQueueItem.filename == fname).first()
                        if item:
                            plats = item.platforms.copy()
                            plats["instagram"] = {
                                "status": "success" if result.get("success") else "failed",
                                "message": result.get("message", ""),
                                "timestamp": datetime.now().isoformat(),
                            }
                            item.platforms = plats
                            item.status = "completed" if result.get("success") else "completed_with_errors"
                            item.worker_state = "completed" if result.get("success") else "failed"
                            item.last_error = "" if result.get("success") else (result.get("message", "") or "")[:1000]
                            if result.get("success"):
                                item.uploaded_at = datetime.now()
                            _publish_queue_event(db2, item)
                            _notify_upload_result(item)
            db2.commit()
        finally:
            db2.close()

    background_tasks.add_task(run_batch_task, request.account_id, request.platforms, videos_data, request.open_browser, request.pw_debug)
    return {"status": "success", "message": f"Queued {len(videos_data)} videos for batch upload"}


@router.post("/upload/{filename}")
async def trigger_upload(filename: str, request: UploadRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    file_path = item.file_path if item and item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found in queue")
    item = _get_or_create_item(db, filename)
    item.title = request.title
    item.description = request.description
    item.tags = request.tags
    _apply_legacy_job_config(item, request)
    _publish_queue_event(db, item)
    db.commit()
    if request.schedule:
        return {"message": f"Scheduled job created for {filename}"}
    background_tasks.add_task(process_upload_task, filename, request)
    return {"message": f"Upload job for {filename} queued successfully"}
