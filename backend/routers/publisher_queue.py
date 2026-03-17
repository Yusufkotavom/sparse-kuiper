from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, Any
import os
import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from backend.core.config import UPLOAD_QUEUE_DIR, VIDEO_PROJECTS_DIR, PROJECTS_DIR
from backend.core.database import get_db
from backend.core.logger import logger
from backend.models.upload_queue import UploadQueueItem
from backend.models.asset_metadata import AssetMetadata
from backend.routers.publisher_schemas import QueueAddRequest, QueueUpdateRequest, QueueConfigRequest, BulkQueueConfigRequest


router = APIRouter()


@router.get("/queue", response_model=Dict[str, Any])
async def get_upload_queue(db: Session = Depends(get_db)):
    items = db.query(UploadQueueItem).filter(UploadQueueItem.status != "archived").all()
    queue = []
    seen: set[str] = set()
    db_items: dict[str, UploadQueueItem] = {i.filename: i for i in items}
    dirty = False

    for item in items:
        file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / item.filename)
        if os.path.exists(file_path):
            if (not item.file_path) or (item.file_path != file_path):
                item.file_path = file_path
                dirty = True
            queue.append(item.to_dict())
            seen.add(item.filename)

    legacy_files = [f for f in os.listdir(UPLOAD_QUEUE_DIR) if f.endswith(".mp4")]
    for filename in legacy_files:
        if filename in seen:
            continue
        item = db_items.get(filename)
        if not item:
            item = UploadQueueItem(filename=filename, status="pending")
            item.platforms = {}
            item.file_path = str(UPLOAD_QUEUE_DIR / filename)
            db.add(item)
            db_items[filename] = item
            dirty = True
        elif not item.file_path:
            item.file_path = str(UPLOAD_QUEUE_DIR / filename)
            dirty = True
        file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)
        if os.path.exists(file_path):
            queue.append(item.to_dict())
            seen.add(filename)

    try:
        project_queue_paths = []
        vp = Path(VIDEO_PROJECTS_DIR)
        if vp.exists():
            for p in vp.glob("*/*/queue/*.mp4"):
                project_queue_paths.append(p)
        pr = Path(PROJECTS_DIR)
        if pr.exists():
            for p in pr.glob("*/queue/*.mp4"):
                project_queue_paths.append(p)

        for p in project_queue_paths:
            fname = p.name
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
            item = db_items.get(fname)
            if not item:
                item = UploadQueueItem(filename=fname, status="pending")
                item.platforms = {}
                item.file_path = str(p)
                item.project_dir = proj_dir
                if meta_dict:
                    item.title = meta_dict.get("title", "") or ""
                    item.description = meta_dict.get("description", "") or ""
                    item.tags = meta_dict.get("tags", "") or ""
                db.add(item)
                db_items[fname] = item
                dirty = True
            else:
                updated = False
                if not item.file_path or not os.path.exists(item.file_path):
                    item.file_path = str(p)
                    updated = True
                if not item.project_dir:
                    item.project_dir = proj_dir
                    updated = True
                if meta_dict:
                    if not (item.title or "").strip():
                        item.title = meta_dict.get("title", "") or ""
                        updated = True
                    if not (item.description or "").strip():
                        item.description = meta_dict.get("description", "") or ""
                        updated = True
                    if not (item.tags or "").strip():
                        item.tags = meta_dict.get("tags", "") or ""
                        updated = True
                if updated:
                    dirty = True

            if fname not in seen and os.path.exists(str(p)):
                queue.append(item.to_dict())
                seen.add(fname)
    except Exception as e:
        logger.error(f"[Queue] Failed to scan per-project queue folders: {e}")

    if dirty:
        db.commit()

    return {"queue": queue}


@router.delete("/queue/{filename}")
async def delete_from_queue(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()

    file_path = item.file_path if item and item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)

    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.error(f"[Publisher] Failed to delete file {filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")

    if item:
        db.delete(item)
        db.commit()

    return {"message": "File removed from queue"}


@router.post("/queue/add")
async def add_to_queue(request: QueueAddRequest, db: Session = Depends(get_db)):
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
    while db.query(UploadQueueItem).filter(UploadQueueItem.filename == dest_filename, UploadQueueItem.status != "archived").first():
        dest_filename = f"{base_name}_{counter}{ext}"
        dest_path = queue_dir / dest_filename
        counter += 1

    try:
        shutil.move(src_path, dest_path)
    except Exception:
        try:
            shutil.copy2(src_path, dest_path)
            os.remove(src_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to move file: {e}")

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
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if item and item.file_path and os.path.exists(item.file_path):
        return FileResponse(item.file_path)

    legacy_path = str(UPLOAD_QUEUE_DIR / filename)
    if os.path.exists(legacy_path):
        return FileResponse(legacy_path)

    raise HTTPException(status_code=404, detail="Video file not found")


@router.post("/queue/archive/{filename}")
async def archive_queue_item(filename: str, db: Session = Depends(get_db)):
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
    if item.project_dir and os.path.exists(item.project_dir):
        target_dir = Path(item.project_dir)
    else:
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


@router.post("/queue/update-metadata")
async def update_queue_metadata(request: QueueUpdateRequest, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == request.filename).first()
    if not item:
        resolved: Path | None = None
        legacy_path = Path(UPLOAD_QUEUE_DIR) / request.filename
        if legacy_path.exists():
            resolved = legacy_path
        else:
            vp = Path(VIDEO_PROJECTS_DIR)
            if vp.exists():
                matches = list(vp.glob(f"*/*/queue/{request.filename}"))
                if matches:
                    resolved = matches[0]
            if resolved is None:
                pr = Path(PROJECTS_DIR)
                if pr.exists():
                    matches = list(pr.glob(f"*/queue/{request.filename}"))
                    if matches:
                        resolved = matches[0]
        if resolved is None:
            raise HTTPException(status_code=404, detail="Queue item not found")
        item = UploadQueueItem(filename=request.filename, status="pending")
        item.platforms = {}
        item.file_path = str(resolved)
        try:
            item.project_dir = str(resolved.parent.parent)
        except Exception:
            item.project_dir = ""
        db.add(item)
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
            scheduled = start_dt.replace()
            try:
                scheduled = scheduled + timedelta(days=day_offset)
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

