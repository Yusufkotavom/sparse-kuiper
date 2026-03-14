"""
Publisher router — now backed by SQLite via SQLAlchemy.
All JSON flat-file I/O (status.json) has been replaced with proper ORM CRUD.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import json
import shutil
from datetime import datetime, timedelta
import subprocess
import sys
from pathlib import Path
from groq import Groq
from sqlalchemy.orm import Session
from backend.routers.settings import _read_config
from backend.core.config import UPLOAD_QUEUE_DIR, VIDEO_PROJECTS_DIR, PROJECTS_DIR, settings

# Sessions directory (mirrors accounts.py)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SESSIONS_DIR = os.path.join(BASE_DIR, "data", "sessions")
from backend.core.database import get_db
from backend.core.logger import logger
from backend.models.upload_queue import UploadQueueItem
from backend.models.asset_metadata import AssetMetadata

router = APIRouter()

# Ensure queue directory exists
os.makedirs(UPLOAD_QUEUE_DIR, exist_ok=True)


# ──────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────

class UploadRequest(BaseModel):
    title: str
    description: str
    tags: str
    platforms: List[str]
    account_id: str = ""
    schedule: str = ""
    product_id: str = ""
    youtube_privacy: str = "private"
    youtube_category_id: str = "22"
    open_browser: bool = False
    pw_debug: bool = False


class BatchVideoItem(BaseModel):
    filename: str
    title: str
    description: str
    tags: str
    schedule: str = ""
    product_id: str = ""
    youtube_privacy: str = "private"
    youtube_category_id: str = "22"
    open_browser: bool = False
    pw_debug: bool = False


class BatchUploadRequest(BaseModel):
    videos: List[BatchVideoItem]
    platforms: List[str]
    account_id: str = ""
    open_browser: bool = False
    pw_debug: bool = False


class MetadataRequest(BaseModel):
    prompt: str


class QueueAddRequest(BaseModel):
    project_type: str
    relative_path: str
    title: str
    description: str
    tags: str

class AssetMetadataRequest(BaseModel):
    project_type: str
    file: str
    title: str
    description: str
    tags: str

class AssetMoveRequest(BaseModel):
    project_type: str
    old_file: str
    new_file: str


# ──────────────────────────────────────
# DB Helpers
# ──────────────────────────────────────

def _get_or_create_item(db: Session, filename: str) -> UploadQueueItem:
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        item = UploadQueueItem(filename=filename, status="pending")
        item.platforms = {}
        db.add(item)
        db.flush()
    return item


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
    session_dir = os.path.join(SESSIONS_DIR, account.id)
    cookies_path = os.path.join(session_dir, "cookies.txt")
    if not os.path.exists(cookies_path):
        return {"success": False, "message": f"YouTube Playwright session not connected (missing cookies.txt at {cookies_path})."}

    job_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) / "data" / "upload_jobs"
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

    script_path = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / "services" / "youtube_playwright_upload_worker.py"
    cwd_path = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
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

# ──────────────────────────────────────
# Queue endpoints
# ──────────────────────────────────────

@router.get("/queue", response_model=Dict[str, Any])
async def get_upload_queue(db: Session = Depends(get_db)):
    """Returns all active upload queue items from the DB."""
    items = db.query(UploadQueueItem).filter(UploadQueueItem.status != "archived").all()
    queue = []
    
    for item in items:
        # Check if file exists.
        file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / item.filename)
        if os.path.exists(file_path):
            queue.append(item.to_dict())

    # Include any legacy files in UPLOAD_QUEUE_DIR that aren't in DB (or were skipped)
    legacy_files = [f for f in os.listdir(UPLOAD_QUEUE_DIR) if f.endswith(".mp4")]
    db_filenames = {i.filename for i in items}
    for filename in legacy_files:
        if filename not in db_filenames:
            queue.append({
                "filename": filename,
                "status": "pending",
                "platforms": {},
                "metadata": {},
            })

    # Include any per-project queue files (video_projects/*/*/queue/*.mp4 and projects/*/queue/*.mp4) that aren't yet in DB
    try:
        from pathlib import Path
        project_queue_paths = []
        # video projects: .../video_projects/*/(raw_videos|final_videos)/queue/*.mp4
        vp = Path(VIDEO_PROJECTS_DIR)
        if vp.exists():
            for p in vp.glob("*/*/queue/*.mp4"):
                project_queue_paths.append(p)
        # kdp/plain projects: .../projects/*/queue/*.mp4
        pr = Path(PROJECTS_DIR)
        if pr.exists():
            for p in pr.glob("*/queue/*.mp4"):
                project_queue_paths.append(p)

        for p in project_queue_paths:
            fname = p.name
            if fname in db_filenames:
                continue
            parent = p.parent
            proj_dir_path = parent.parent
            proj_dir = str(proj_dir_path)
            meta_dict = {}
            project_type = "video" if str(p).replace("\\", "/").startswith(str(VIDEO_PROJECTS_DIR).replace("\\", "/")) else "kdp"
            try:
                if project_type == "video":
                    rel = p.relative_to(VIDEO_PROJECTS_DIR)
                    parts = str(rel).replace("\\", "/").split("/")
                    project_name = parts[0] if len(parts) > 0 else ""
                    canonical_dir = parts[1] if len(parts) > 2 else ""
                else:
                    rel = p.relative_to(PROJECTS_DIR)
                    parts = str(rel).replace("\\", "/").split("/")
                    project_name = parts[0] if len(parts) > 0 else ""
                    canonical_dir = ""
                row = (
                    db.query(AssetMetadata)
                    .filter(
                        AssetMetadata.project_type == project_type,
                        AssetMetadata.project_name == project_name,
                        AssetMetadata.canonical_dir == canonical_dir,
                        AssetMetadata.filename == fname,
                    ).first()
                )
                if row:
                    meta_dict = {
                        "title": row.title or "",
                        "description": row.description or "",
                        "tags": row.tags or "",
                    }
            except Exception:
                meta_dict = {}
            queue.append({
                "filename": fname,
                "status": "pending",
                "platforms": {},
                "metadata": meta_dict,
                "file_path": str(p),
                "project_dir": proj_dir,
            })
    except Exception as e:
        logger.error(f"[Queue] Failed to scan per-project queue folders: {e}")

    return {"queue": queue}


@router.delete("/queue/{filename}")
async def delete_from_queue(filename: str, db: Session = Depends(get_db)):
    """Removes a video file from the DB and disk."""
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    
    file_path = item.file_path if item and item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)
    
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.error(f"[Publisher] Failed to delete file {filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
            
    # Remove from DB if exists
    if item:
        db.delete(item)
        db.commit()
        
    return {"message": "File removed from queue"}


# ──────────────────────────────────────
# Upload task logic
# ──────────────────────────────────────

def process_upload_task(filename: str, request: UploadRequest):
    """Routes the upload to the correct platform uploader service (sync — runs in thread pool)."""
    from backend.core.database import SessionLocal
    db = SessionLocal()
    try:
        logger.info(f"Starting upload for {filename} to {request.platforms}")

        item = _get_or_create_item(db, filename)
        file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)
        
        if not os.path.exists(file_path):
            logger.error(f"Cannot upload {filename}: file not found at {file_path}")
            item.status = "completed_with_errors"
            item.worker_state = "failed"
            item.last_error = f"File not found: {file_path}"
            db.commit()
            return

        item = _get_or_create_item(db, filename)
        item.status = "uploading"
        item.title = request.title
        item.description = request.description
        item.tags = request.tags
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
                        # Derive cookies path dynamically from sessions directory
                        _cookies_path = os.path.join(SESSIONS_DIR, request.account_id, "cookies.txt")
                        logger.info(f"[TikTok] Checking cookies at: {_cookies_path} | exists={os.path.exists(_cookies_path)} | account={account is not None}")
                        if not account or not os.path.exists(_cookies_path):
                             result = {"success": False, "message": f"TikTok account not connected (missing cookies.txt at {_cookies_path})."}
                             logger.error(f"[TikTok] FAIL — cookies check failed. path={_cookies_path}")
                        else:
                            # Create job JSON for TikTok worker
                            job_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) / "data" / "upload_jobs"
                            job_dir.mkdir(parents=True, exist_ok=True)
                            job_path = job_dir / f"tiktok_{datetime.now().timestamp()}.json"
                            result_path = Path(str(job_path).replace(".json", "_result.json"))
                            logger.info(f"[TikTok] Step1: job_path={job_path}")

                            job_payload = {
                                "cookies_path": _cookies_path,
                                "videos": [{
                                    "video_path": file_path,
                                    "description": f"{request.title} {request.tags} #shorts",
                                    "schedule": request.schedule or None,
                                    "product_id": request.product_id or None
                                }],
                                "headless": not request.open_browser,
                                "pw_debug": request.pw_debug
                            }
                            logger.info(f"[TikTok] Step2: payload built, writing file...")

                            # Write job file and guarantee flush to disk before launching worker
                            try:
                                with open(str(job_path), "w", encoding="utf-8") as f:
                                    json.dump(job_payload, f, indent=2)
                                    f.flush()
                                    os.fsync(f.fileno())
                                logger.info(f"[TikTok] Step3: file written ({job_path.stat().st_size} bytes)")
                            except Exception as write_err:
                                logger.error(f"[TikTok] WRITE FAILED: {write_err}")
                                raise

                            script_path = (Path(os.path.dirname(os.path.abspath(__file__))) / "../../backend/services/tiktok_upload_worker.py").resolve()
                            cwd_path = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
                            logger.info(f"[TikTok] Step4: launching worker {script_path}...")

                            # Run worker — blocking (OK here since we are in a sync background task thread)
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
                            token_dict = json.loads(account.oauth_token_json)
                            # upload_video is synchronous, block off event loop if needed or just run directly
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
                            # Update token if refreshed
                            if yt_res.get("refreshed_token"):
                                account.oauth_token_json = json.dumps(yt_res["refreshed_token"])
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
                            token_dict = json.loads(account.oauth_token_json)
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
            item.status = "completed" if all_success else "completed_with_errors"
            item.worker_state = "completed" if all_success else "failed"
            item.last_error = "" if all_success else "; ".join(
                f"{k}: {v.get('message', '')}" for k, v in platforms_status.items() if v.get("status") != "success"
            )[:1000]
            if all_success:
                item.uploaded_at = datetime.now()
            db.commit()

        logger.info(f"Finished upload task for {filename}")
    finally:
        db.close()


@router.post("/upload/batch")
async def process_batch_upload(request: BatchUploadRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Triggers a batch upload for multiple videos to supported platforms."""
    logger.info(f"[Batch Upload] Received request with open_browser={request.open_browser}, platforms={request.platforms}, videos_count={len(request.videos)}")
    if not set(request.platforms).intersection({"tiktok", "youtube", "facebook", "instagram"}):
        raise HTTPException(status_code=400, detail="Batch upload is currently only supported for TikTok, YouTube, Facebook, and Instagram.")
    if not request.account_id:
        raise HTTPException(status_code=400, detail="No account_id provided for bulk upload.")

    videos_data = []
    for vid in request.videos:
        item = _get_or_create_item(db, vid.filename)
        file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / vid.filename)
        
        if not os.path.exists(file_path):
            continue

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
        item.status = "uploading"
        item.title = vid.title
        item.description = vid.description
        item.tags = vid.tags

    if not videos_data:
        raise HTTPException(status_code=400, detail="No valid videos found for batch upload.")

    db.commit()

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
                            if result.get("success"):
                                item.uploaded_at = datetime.now()
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
                                if status == "success":
                                    item.uploaded_at = datetime.now()
                    else:
                        from backend.services.uploaders.youtube_uploader import upload_video
                        import json
                        if not account.oauth_token_json:
                            logger.error("[Batch Upload] YouTube account not connected.")
                            continue
                        token_dict = json.loads(account.oauth_token_json)
                        
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
                                    account.oauth_token_json = json.dumps(token_dict)
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
                                if status == "success":
                                    item.uploaded_at = datetime.now()
                elif platform == "facebook":
                    from backend.services.uploaders.facebook_uploader import upload_video_to_facebook
                    import json
                    if not account.oauth_token_json:
                        logger.error("[Batch Upload] Facebook account not connected.")
                        continue
                    token_dict = json.loads(account.oauth_token_json)
                    
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
                            if status == "success":
                                item.uploaded_at = datetime.now()
                elif platform == "instagram":
                    from backend.services.uploaders.instagram_uploader import upload_to_instagram
                    
                    # Convert 'schedule' from BatchVideoItem format to string for the service
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
                            if result.get("success"):
                                item.uploaded_at = datetime.now()
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
    background_tasks.add_task(process_upload_task, filename, request)
    return {"message": f"Upload job for {filename} queued successfully"}


# ──────────────────────────────────────
# Metadata generation
# ──────────────────────────────────────

@router.post("/generate-metadata")
async def generate_metadata(request: MetadataRequest):
    if not settings.groq_api_key:
        raise HTTPException(status_code=500, detail="Groq API Key is not configured.")

    # Load prompt from config.json (editable via Settings page)
    from backend.routers.settings import _read_config, DEFAULT_SYSTEM_PROMPTS
    _cfg = _read_config()
    system_prompt = (
        _cfg.get("system_prompts", {}).get("metadata_generate")
        or DEFAULT_SYSTEM_PROMPTS["metadata_generate"]
    )

    client = Groq(api_key=settings.groq_api_key)

    def _parse_json_loose(text: str) -> dict:
        s = text.strip()
        # Strip common code fences if present
        if s.startswith("```"):
            # remove leading ```json or ``` and trailing ```
            s = s.lstrip("`")
            s = s.replace("json\n", "", 1) if s.startswith("json") else s
            # Remove any remaining backticks
            s = s.replace("```", "")
        # Try direct json
        try:
            return json.loads(s)
        except Exception:
            # Fallback: extract the first JSON object
            try:
                start = s.find("{")
                end = s.rfind("}")
                if start != -1 and end != -1 and end > start:
                    return json.loads(s[start:end + 1])
            except Exception:
                pass
        return {}

    try:
        # First attempt: no response_format (avoid 400 json_validate_failed), strong instruction in user prompt
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "You are to produce ONLY a compact JSON object with keys: "
                        'title (string), description (string), tags (array of strings). '
                        "Do not include code fences, markdown, or explanations.\n\n"
                        f'Generate metadata for: "{request.prompt}"'
                    ),
                },
            ],
            temperature=0.5,
        )
        content = completion.choices[0].message.content
        result_json = _parse_json_loose(content or "")
        title = result_json.get("title") or "Viral Video"
        description = result_json.get("description") or "Check this out!"
        tags_val = result_json.get("tags", [])
        # Normalize tags to single space-separated string as elsewhere in app
        if isinstance(tags_val, list):
            tags = " ".join(str(t) for t in tags_val if str(t).strip())
        else:
            tags = str(tags_val)
        return {"title": title, "description": description, "tags": tags}
    except Exception as e:
        logger.error(f"Error generating metadata: {e}")
        # Last resort fallback using the prompt
        return {
            "title": (request.prompt or "Viral Video")[:80],
            "description": f"{request.prompt or 'New content'} — ready to publish.",
            "tags": "#viral",
        }


# ──────────────────────────────────────
# Queue management
# ──────────────────────────────────────

@router.post("/queue/add")
async def add_to_queue(request: QueueAddRequest, db: Session = Depends(get_db)):
    """Moves a file from a project to the upload queue and saves its metadata to DB."""
    if request.project_type == "video":
        src_path = VIDEO_PROJECTS_DIR / request.relative_path
    elif request.project_type == "kdp":
        src_path = PROJECTS_DIR / request.relative_path
    else:
        raise HTTPException(status_code=400, detail="Invalid project_type")

    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail=f"Source file not found: {src_path}")

    filename = os.path.basename(src_path)
    project_dir = os.path.dirname(src_path)
    
    queue_dir = Path(project_dir) / "queue"
    queue_dir.mkdir(parents=True, exist_ok=True)
    
    base_name, ext = os.path.splitext(filename)
    dest_filename = filename
    counter = 1
    dest_path = queue_dir / dest_filename
    while dest_path.exists():
        dest_filename = f"{base_name}_{counter}{ext}"
        dest_path = queue_dir / dest_filename
        counter += 1
    # Ensure global uniqueness across UploadQueueItem filenames (avoid collisions across projects)
    while db.query(UploadQueueItem).filter(UploadQueueItem.filename == dest_filename, UploadQueueItem.status != "archived").first():
        dest_filename = f"{base_name}_{counter}{ext}"
        dest_path = queue_dir / dest_filename
        counter += 1

    try:
        shutil.move(src_path, dest_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to move file: {e}")

    # Upsert queue item in DB
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == dest_filename).first()
    if not item:
        item = UploadQueueItem(filename=dest_filename)
        db.add(item)

    item.status = "pending"
    item.title = request.title
    item.description = request.description
    item.tags = request.tags
    item.platforms = {}
    item.file_path = str(dest_path)
    item.project_dir = str(project_dir)
    db.commit()

    # Persist sidecar metadata in project_dir for continuity outside queue
    try:
        sidecar_path = Path(project_dir) / f"{Path(dest_filename).stem}.meta.json"
        with open(sidecar_path, "w", encoding="utf-8") as sf:
            json.dump({
                "title": request.title,
                "description": request.description,
                "tags": request.tags,
            }, sf, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"[Queue Add] Failed writing sidecar metadata: {e}")

    return {"message": "Added to queue successfully", "filename": dest_filename}

@router.get("/queue/video/{filename}")
async def get_queue_video(filename: str, db: Session = Depends(get_db)):
    """Serves the actual video file."""
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if item and item.file_path and os.path.exists(item.file_path):
        return FileResponse(item.file_path)
    
    legacy_path = str(UPLOAD_QUEUE_DIR / filename)
    if os.path.exists(legacy_path):
        return FileResponse(legacy_path)
        
    raise HTTPException(status_code=404, detail="Video file not found")

@router.post("/queue/archive/{filename}")
async def archive_queue_item(filename: str, db: Session = Depends(get_db)):
    """Moves a video to the archive folder of its project."""
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical file not found")
        
    if item.project_dir and os.path.exists(item.project_dir):
        archive_dir = Path(item.project_dir) / "archive"
    else:
        archive_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) / "data" / "upload_archive"
        
    archive_dir.mkdir(parents=True, exist_ok=True)
    
    dest_path = archive_dir / filename
    base_name, ext = os.path.splitext(filename)
    counter = 1
    while dest_path.exists():
        dest_path = archive_dir / f"{base_name}_{counter}{ext}"
        counter += 1
        
    try:
        shutil.move(file_path, dest_path)
    except Exception as e:
        logger.error(f"Failed to archive {filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to move file to archive")
    
    item.file_path = str(dest_path)
    item.status = "archived"
    db.commit()
    
    # Normalize AssetMetadata canonical_dir to 'archive' if present
    try:
        project_type = "video" if str(dest_path).replace("\\", "/").startswith(str(VIDEO_PROJECTS_DIR).replace("\\", "/")) else "kdp"
        rel = dest_path.relative_to(VIDEO_PROJECTS_DIR if project_type == "video" else PROJECTS_DIR)
        parts = str(rel).replace("\\", "/").split("/")
        project_name = parts[0] if len(parts) > 0 else ""
        canonical_dir = "archive"
        meta = (
            db.query(AssetMetadata)
            .filter(
                AssetMetadata.project_type == project_type,
                AssetMetadata.project_name == project_name,
                AssetMetadata.filename == filename,
            ).first()
        )
        if meta and meta.canonical_dir != canonical_dir:
            meta.canonical_dir = canonical_dir
            db.commit()
    except Exception as e:
        logger.error(f"[Archive] Failed to normalize AssetMetadata for {filename}: {e}")
    
    return {"message": "Video archived successfully"}

@router.post("/queue/return/{filename}")
async def return_queue_item_to_project(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical file not found")

    target_dir = None
    # Primary: use recorded project_dir
    if item.project_dir and os.path.exists(item.project_dir):
        target_dir = Path(item.project_dir)
    else:
        # Fallback: if file_path contains "/queue/", go to its parent (raw_videos/final_videos or project root)
        normalized = file_path.replace("\\", "/")
        if "/queue/" in normalized:
            before_queue = normalized.split("/queue/")[0]
            if os.path.exists(before_queue):
                target_dir = Path(before_queue)
    if target_dir is None:
        raise HTTPException(status_code=400, detail="Project directory unavailable for this queue item")

    target_filename = filename
    target_path = target_dir / target_filename
    base_name, ext = os.path.splitext(filename)
    counter = 1
    while target_path.exists():
        target_filename = f"{base_name}_return_{counter}{ext}"
        target_path = target_dir / target_filename
        counter += 1

    try:
        shutil.move(file_path, target_path)
    except Exception as e:
        logger.error(f"Failed to return {filename} to project dir: {e}")
        raise HTTPException(status_code=500, detail="Failed to return file to project")

    db.delete(item)
    db.commit()
    # Persist sidecar metadata at target to keep metadata in project
    try:
        sidecar_path = target_dir / f"{Path(target_filename).stem}.meta.json"
        with open(sidecar_path, "w", encoding="utf-8") as sf:
            json.dump({
                "title": item.title or "",
                "description": item.description or "",
                "tags": item.tags or "",
            }, sf, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"[Queue Return] Failed writing sidecar metadata: {e}")

    return {"message": "Video returned to project successfully", "path": str(target_path)}

# ──────────────────────────────────────
# Queue item metadata update
# ──────────────────────────────────────
class QueueUpdateRequest(BaseModel):
    filename: str
    title: str
    description: str
    tags: str

@router.post("/queue/update-metadata")
async def update_queue_metadata(request: QueueUpdateRequest, db: Session = Depends(get_db)):
    """
    Updates the metadata (title, description, tags) for an existing queue item by filename.
    Also persists a sidecar .meta.json alongside the project_dir for continuity.
    """
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == request.filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.title = request.title
    item.description = request.description
    item.tags = request.tags
    db.commit()
    try:
        if item.project_dir and os.path.exists(item.project_dir):
            sidecar_path = Path(item.project_dir) / f"{Path(item.filename).stem}.meta.json"
            with open(sidecar_path, "w", encoding="utf-8") as sf:
                json.dump({
                    "title": request.title,
                    "description": request.description,
                    "tags": request.tags,
                }, sf, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"[Queue Update] Failed writing sidecar metadata: {e}")
    return {"message": "Queue metadata updated"}

class QueueConfigRequest(BaseModel):
    filename: str
    platforms: List[str] = []
    account_map: Dict[str, str] = {}
    schedule: str = ""
    platform_publish_schedule: str = ""
    campaign_id: str = ""
    open_browser: bool = False
    pw_debug: bool = False
    youtube_privacy: str = "private"
    youtube_category_id: str = "22"
    product_id: str = ""

@router.post("/queue/update-config")
async def update_queue_config(request: QueueConfigRequest, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == request.filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    prev_options = item.options or {}
    item.target_platforms = request.platforms
    item.account_map = request.account_map
    item.options = {
        "open_browser": request.open_browser,
        "pw_debug": request.pw_debug,
        "youtube_privacy": request.youtube_privacy,
        "youtube_category_id": request.youtube_category_id,
        "product_id": request.product_id,
        "platform_publish_schedule": request.platform_publish_schedule or "",
        "campaign_id": request.campaign_id or prev_options.get("campaign_id", ""),
    }
    try:
        item.scheduled_at = datetime.fromisoformat(request.schedule) if request.schedule else None
    except Exception:
        item.scheduled_at = None
    db.commit()
    return {"message": "Queue config updated"}

class BulkQueueConfigRequest(BaseModel):
    filenames: List[str]
    platforms: List[str] = []
    account_map: Dict[str, str] = {}
    schedule_start: str = ""
    platform_publish_schedule_start: str = ""
    campaign_id: str = ""
    posts_per_day: int = 1
    time_gap_hours: int = 1
    open_browser: bool = False
    pw_debug: bool = False
    youtube_privacy: str = "private"
    youtube_category_id: str = "22"
    product_id: str = ""

@router.post("/queue/bulk-update-config")
async def bulk_update_queue_config(request: BulkQueueConfigRequest, db: Session = Depends(get_db)):
    try:
        start_dt = datetime.fromisoformat(request.schedule_start) if request.schedule_start else None
    except Exception:
        start_dt = None
    try:
        publish_start_dt = datetime.fromisoformat(request.platform_publish_schedule_start) if request.platform_publish_schedule_start else None
    except Exception:
        publish_start_dt = None
    campaign_id = (request.campaign_id or "").strip() or datetime.now().strftime("batch-%Y%m%d-%H%M%S")
    for idx, fname in enumerate(request.filenames):
        item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == fname).first()
        if not item:
            continue
        item.target_platforms = request.platforms
        item.account_map = request.account_map
        item.options = {
            "open_browser": request.open_browser,
            "pw_debug": request.pw_debug,
            "youtube_privacy": request.youtube_privacy,
            "youtube_category_id": request.youtube_category_id,
            "product_id": request.product_id,
            "platform_publish_schedule": "",
            "campaign_id": campaign_id,
        }
        if start_dt:
            day_offset = idx // max(request.posts_per_day, 1)
            slot_idx = idx % max(request.posts_per_day, 1)
            scheduled = start_dt.replace()  # copy
            try:
                # day offset
                scheduled = scheduled + timedelta(days=day_offset)
                # slot offset
                scheduled = scheduled + timedelta(hours=slot_idx * max(request.time_gap_hours, 1))
            except Exception:
                pass
            item.scheduled_at = scheduled
        if publish_start_dt:
            day_offset = idx // max(request.posts_per_day, 1)
            slot_idx = idx % max(request.posts_per_day, 1)
            publish_scheduled = publish_start_dt.replace()
            try:
                publish_scheduled = publish_scheduled + timedelta(days=day_offset)
                publish_scheduled = publish_scheduled + timedelta(hours=slot_idx * max(request.time_gap_hours, 1))
            except Exception:
                pass
            opts = item.options or {}
            opts["platform_publish_schedule"] = publish_scheduled.isoformat()
            item.options = opts
    db.commit()
    return {"message": "Bulk queue config updated", "count": len(request.filenames)}
# ──────────────────────────────────────
# Metadata sidecar retrieval
# ──────────────────────────────────────
@router.get("/metadata/sidecar")
async def get_sidecar_metadata(project_type: str, file: str):
    """
    Returns sidecar metadata JSON for a given project asset.
    - project_type: 'video' or 'kdp'
    - file: relative path like 'cat/raw_videos/filename.mp4' or 'kdp_project/cover.png'
    """
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

# ──────────────────────────────────────
# Metadata DB (source of truth)
# ──────────────────────────────────────
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

@router.get("/assets/metadata")
async def get_asset_metadata(project_type: str, file: str, db: Session = Depends(get_db)):
    project_name, canonical_dir, filename = _parse_asset_path(project_type, file)
    # First attempt: exact match
    row = (
        db.query(AssetMetadata)
        .filter(
            AssetMetadata.project_type == project_type,
            AssetMetadata.project_name == project_name,
            AssetMetadata.canonical_dir == canonical_dir,
            AssetMetadata.filename == filename,
        ).first()
    )
    # Fallback: any canonical_dir for same asset, then normalize to requested canonical_dir
    if not row:
        alt = (
            db.query(AssetMetadata)
            .filter(
                AssetMetadata.project_type == project_type,
                AssetMetadata.project_name == project_name,
                AssetMetadata.filename == filename,
            ).first()
        )
        if alt:
            if alt.canonical_dir != canonical_dir:
                alt.canonical_dir = canonical_dir
                db.commit()
            row = alt
    if not row:
        base = VIDEO_PROJECTS_DIR if project_type == "video" else PROJECTS_DIR
        full_path = base / file
        parent = full_path.parent
        sidecar_path = parent / f"{full_path.stem}.meta.json"
        if sidecar_path.exists():
            try:
                with open(sidecar_path, "r", encoding="utf-8") as sf:
                    data = json.load(sf)
                return {
                    "title": data.get("title", ""),
                    "description": data.get("description", ""),
                    "tags": data.get("tags", ""),
                }
            except Exception:
                pass
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
        raise HTTPException(status_code=404, detail="Metadata not found")
    return {"title": row.title or "", "description": row.description or "", "tags": row.tags or ""}

@router.post("/assets/metadata")
async def upsert_asset_metadata(req: AssetMetadataRequest, db: Session = Depends(get_db)):
    project_name, canonical_dir, filename = _parse_asset_path(req.project_type, req.file)
    row = (
        db.query(AssetMetadata)
        .filter(
            AssetMetadata.project_type == req.project_type,
            AssetMetadata.project_name == project_name,
            AssetMetadata.canonical_dir == canonical_dir,
            AssetMetadata.filename == filename,
        ).first()
    )
    if not row:
        row = AssetMetadata(
            project_type=req.project_type,
            project_name=project_name,
            canonical_dir=canonical_dir,
            filename=filename,
        )
        db.add(row)
    row.title = req.title
    row.description = req.description
    row.tags = req.tags
    db.commit()
    return {"status": "ok"}

@router.post("/assets/move")
async def move_asset_metadata(req: AssetMoveRequest, db: Session = Depends(get_db)):
    old_proj, old_dir, old_name = _parse_asset_path(req.project_type, req.old_file)
    new_proj, new_dir, new_name = _parse_asset_path(req.project_type, req.new_file)
    row = (
        db.query(AssetMetadata)
        .filter(
            AssetMetadata.project_type == req.project_type,
            AssetMetadata.project_name == old_proj,
            AssetMetadata.canonical_dir == old_dir,
            AssetMetadata.filename == old_name,
        ).first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Metadata not found for old path")
    row.project_name = new_proj
    row.canonical_dir = new_dir
    row.filename = new_name
    db.commit()
    return {"status": "ok"}

# ──────────────────────────────────────
# Jobs (Scheduler) endpoints
# ──────────────────────────────────────
class TagsRequest(BaseModel):
    filename: str
    tags: List[str]

class RescheduleRequest(BaseModel):
    filename: str
    schedule: str

def _build_upload_request_for_platform(item: UploadQueueItem, platform: str, run_now: bool = False) -> UploadRequest:
    opts = item.options or {}
    publish_schedule = opts.get("platform_publish_schedule", "") or ""
    return UploadRequest(
        title=item.title or "",
        description=item.description or "",
        tags=item.tags or "",
        platforms=[platform],
        account_id=(item.account_map or {}).get(platform, ""),
        schedule=publish_schedule,
        product_id=opts.get("product_id", ""),
        youtube_privacy=opts.get("youtube_privacy", "private"),
        youtube_category_id=opts.get("youtube_category_id", "22"),
        open_browser=bool(opts.get("open_browser", False)),
        pw_debug=bool(opts.get("pw_debug", False)),
    )

@router.get("/jobs")
async def list_jobs(
    status: str = "",
    tag: str = "",
    platform: str = "",
    account_id: str = "",
    campaign: str = "",
    date_from: str = "",
    date_to: str = "",
    db: Session = Depends(get_db),
):
    q = db.query(UploadQueueItem).filter(UploadQueueItem.status != "archived")
    if status:
        q = q.filter(UploadQueueItem.worker_state == status)
    items = q.all()
    # Only show items that actually have job configuration/history.
    # This keeps deleted job configs (reset to pending + empty config) out of Jobs page.
    def _is_active_job(it: UploadQueueItem) -> bool:
        if (it.target_platforms or []):
            return True
        if (it.account_map or {}):
            return True
        if (it.options or {}):
            return True
        if it.scheduled_at is not None:
            return True
        if (it.job_tags or []):
            return True
        if (it.platforms or {}):
            return True
        if (it.attempt_count or 0) > 0:
            return True
        state = (it.worker_state or "").strip().lower()
        if state and state != "pending":
            return True
        return False
    items = [it for it in items if _is_active_job(it)]
    # Filter by tag if provided
    def _has_tag(it: UploadQueueItem, t: str) -> bool:
        try:
            return t and (t in (it.job_tags or []))
        except Exception:
            return False
    if tag:
        items = [it for it in items if _has_tag(it, tag)]
    if platform:
        items = [it for it in items if platform in (it.target_platforms or [])]
    if account_id:
        items = [it for it in items if (it.account_map or {}).get(platform or "", "") == account_id or account_id in (it.account_map or {}).values()]
    if campaign:
        items = [it for it in items if (it.options or {}).get("campaign_id", "") == campaign]
    if date_from or date_to:
        try:
            from_dt = datetime.fromisoformat(date_from) if date_from else None
            to_dt = datetime.fromisoformat(date_to) if date_to else None
        except Exception:
            from_dt = to_dt = None
        if from_dt or to_dt:
            def _in_range(it: UploadQueueItem) -> bool:
                if not it.scheduled_at:
                    return False
                t = it.scheduled_at
                if from_dt and t < from_dt:
                    return False
                if to_dt and t > to_dt:
                    return False
                return True
            items = [it for it in items if _in_range(it)]
    return {"jobs": [it.to_dict() for it in items]}

@router.post("/jobs/run-now/{filename}")
async def jobs_run_now(filename: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    plats = item.target_platforms or []
    if not plats:
        raise HTTPException(status_code=400, detail="No target platforms configured for this job")
    item.worker_state = "running"
    item.last_run_at = datetime.now()
    item.attempt_count = (item.attempt_count or 0) + 1
    db.commit()
    for p in plats:
        req = _build_upload_request_for_platform(item, p, run_now=True)
        background_tasks.add_task(process_upload_task, filename, req)
    return {"message": "Job started"}

@router.post("/jobs/pause/{filename}")
async def jobs_pause(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.worker_state = "paused"
    db.commit()
    return {"message": "Job paused"}

@router.post("/jobs/resume/{filename}")
async def jobs_resume(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.worker_state = "scheduled"
    db.commit()
    return {"message": "Job resumed"}

@router.post("/jobs/cancel/{filename}")
async def jobs_cancel(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.worker_state = "canceled"
    db.commit()
    return {"message": "Job canceled"}

@router.post("/jobs/reschedule")
async def jobs_reschedule(req: RescheduleRequest, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == req.filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    try:
        item.scheduled_at = datetime.fromisoformat(req.schedule)
        item.worker_state = "scheduled"
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid schedule format")
    db.commit()
    return {"message": "Job rescheduled"}

@router.post("/jobs/set-tags")
async def jobs_set_tags(req: TagsRequest, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == req.filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.job_tags = req.tags or []
    db.commit()
    return {"message": "Tags updated"}

@router.post("/jobs/delete/{filename}")
async def jobs_delete(filename: str, db: Session = Depends(get_db)):
    """
    Clears job configuration (schedule, platforms, tags) but keeps the queue item and file.
    Use Queue page delete to remove physical file if needed.
    """
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.target_platforms = []
    item.account_map = {}
    item.options = {}
    item.platforms = {}
    item.scheduled_at = None
    item.worker_state = "pending"
    item.job_tags = []
    item.attempt_count = 0
    item.last_error = None
    item.last_run_at = None
    db.commit()
    return {"message": "Job configuration cleared"}
