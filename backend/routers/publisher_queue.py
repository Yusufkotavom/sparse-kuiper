from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, Any
import os
import json
import shutil
import subprocess
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

from backend.core.config import UPLOAD_QUEUE_DIR, VIDEO_PROJECTS_DIR, PROJECTS_DIR, BASE_DIR
from backend.core.database import get_db
from backend.core.logger import logger
from backend.core.realtime import publish_realtime_event
from backend.models.upload_queue import UploadQueueItem
from backend.models.asset_metadata import AssetMetadata
from backend.routers.publisher_schemas import QueueAddRequest, QueueUpdateRequest, QueueConfigRequest, BulkQueueConfigRequest
from backend.services.queue_bus import enqueue_publish_job


router = APIRouter()


def _publish_queue_event(db: Session, item: UploadQueueItem, event_type: str):
    publish_realtime_event(
        db,
        stream="upload_queue",
        event_type=event_type,
        entity_table="upload_queue",
        entity_id=item.filename,
        payload=item.to_dict(),
    )


def _has_job_config(item: UploadQueueItem) -> bool:
    return bool((item.target_platforms or []) and (item.account_map or {}))


def sync_queue_job_state(item: UploadQueueItem) -> None:
    if not _has_job_config(item):
        item.worker_state = "pending"
        item.next_retry_at = None
        item.lease_expires_at = None
        if (item.status or "").strip().lower() not in {"completed", "completed_with_errors", "failed", "archived"}:
            item.status = "pending"
        return

    if item.scheduled_at:
        item.worker_state = "scheduled"
    else:
        item.worker_state = "queued"

    if (item.status or "").strip().lower() not in {"uploading", "completed", "completed_with_errors", "failed", "archived"}:
        item.status = "queued"


@router.get("/queue", response_model=Dict[str, Any])
async def get_upload_queue(db: Session = Depends(get_db)):
    items = db.query(UploadQueueItem).filter(UploadQueueItem.status != "archived").all()
    queue = []
    seen: set[str] = set()
    db_items: dict[str, UploadQueueItem] = {i.filename: i for i in items}
    dirty = False

    for item in items:
        sync_queue_job_state(item)
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
            for p in vp.glob("*/queue/*.mp4"):
                project_queue_paths.append(p)
            for p in vp.glob("*/*/queue/*.mp4"):
                project_queue_paths.append(p)
        pr = Path(PROJECTS_DIR)
        if pr.exists():
            for p in pr.glob("*/queue/*.mp4"):
                project_queue_paths.append(p)

        path_contexts: list[tuple[Path, str, str, str, str, str]] = []
        grouped_filenames: dict[tuple[str, str, str], set[str]] = {}
        for p in project_queue_paths:
            fname = p.name
            parent = p.parent
            proj_dir_path = parent.parent
            proj_dir = str(proj_dir_path)
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
            except Exception:
                project_name = ""
                canonical_dir = ""

            if project_type == "video" and canonical_dir == "queue":
                candidate = Path(VIDEO_PROJECTS_DIR) / project_name / "raw_videos"
                if candidate.exists():
                    proj_dir = str(candidate)
            if project_type == "kdp" and canonical_dir == "queue":
                candidate = Path(PROJECTS_DIR) / project_name / "raw_images"
                if candidate.exists():
                    proj_dir = str(candidate)

            path_contexts.append((p, fname, proj_dir, project_type, project_name, canonical_dir))
            gkey = (project_type, project_name, canonical_dir)
            if gkey not in grouped_filenames:
                grouped_filenames[gkey] = set()
            grouped_filenames[gkey].add(fname)

        meta_lookup: dict[tuple[str, str, str, str], dict[str, str]] = {}
        for (project_type, project_name, canonical_dir), filenames in grouped_filenames.items():
            if not filenames:
                continue
            rows = (
                db.query(AssetMetadata)
                .filter(
                    AssetMetadata.project_type == project_type,
                    AssetMetadata.project_name == project_name,
                    AssetMetadata.canonical_dir == canonical_dir,
                    AssetMetadata.filename.in_(list(filenames)),
                )
                .all()
            )
            for row in rows:
                meta_lookup[(project_type, project_name, canonical_dir, row.filename)] = {
                    "title": row.title or "",
                    "description": row.description or "",
                    "tags": row.tags or "",
                }

        for p, fname, proj_dir, project_type, project_name, canonical_dir in path_contexts:
            meta_dict = meta_lookup.get((project_type, project_name, canonical_dir, fname), {})
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


@router.get("/queue/published", response_model=Dict[str, Any])
async def get_published_history(db: Session = Depends(get_db)):
    items = db.query(UploadQueueItem).all()
    records = []
    for item in items:
        row = item.to_dict()
        platforms = row.get("platforms") or {}
        has_history = (
            row.get("uploaded_at") is not None
            or row.get("status") in {"completed", "completed_with_errors", "failed", "archived"}
            or (row.get("attempt_count") or 0) > 0
            or (row.get("worker_state") or "pending") != "pending"
            or len(platforms) > 0
        )
        if has_history:
            records.append(row)
    return {"queue": records}


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
        _publish_queue_event(db, item, "deleted")
        db.delete(item)
        db.commit()

    return {"message": "File removed from queue"}


@router.post("/queue/add")
async def add_to_queue(request: QueueAddRequest, db: Session = Depends(get_db)):
    project_name = ""
    if request.project_type == "video":
        src_path = VIDEO_PROJECTS_DIR / request.relative_path
    elif request.project_type == "kdp":
        src_path = PROJECTS_DIR / request.relative_path
    else:
        raise HTTPException(status_code=400, detail="Invalid project_type")

    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail=f"Source file not found: {src_path}")

    filename = os.path.basename(src_path)
    origin_dir = Path(os.path.dirname(src_path))

    if request.project_type == "video":
        try:
            rel = Path(src_path).resolve().relative_to(Path(VIDEO_PROJECTS_DIR).resolve())
            project_name = str(rel).replace("\\", "/").split("/")[0]
            project_root = Path(VIDEO_PROJECTS_DIR) / project_name
        except Exception:
            project_root = origin_dir.parent
    else:
        try:
            rel = Path(src_path).resolve().relative_to(Path(PROJECTS_DIR).resolve())
            project_name = str(rel).replace("\\", "/").split("/")[0]
            project_root = Path(PROJECTS_DIR) / project_name
        except Exception:
            project_root = origin_dir.parent

    queue_dir = Path(project_root) / "queue"
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

    resolved_title = (request.title or "").strip()
    resolved_description = (request.description or "").strip()
    resolved_tags = (request.tags or "").strip()

    try:
        existing_meta = (
            db.query(AssetMetadata)
            .filter(
                AssetMetadata.project_type == request.project_type,
                AssetMetadata.project_name == project_name,
                AssetMetadata.filename == filename,
            )
            .first()
        )
    except Exception:
        existing_meta = None

    if existing_meta:
        if not resolved_title:
            resolved_title = (existing_meta.title or "").strip()
        if not resolved_description:
            resolved_description = (existing_meta.description or "").strip()
        if not resolved_tags:
            resolved_tags = (existing_meta.tags or "").strip()

    if not (resolved_title and resolved_description and resolved_tags):
        try:
            sidecar_path = origin_dir / f"{Path(filename).stem}.meta.json"
            if sidecar_path.exists():
                with open(sidecar_path, "r", encoding="utf-8") as sf:
                    loaded = json.load(sf)
                    sidecar = loaded if isinstance(loaded, dict) else {}
        except Exception:
            sidecar = {}
        if not resolved_title:
            resolved_title = (sidecar.get("title") or "").strip()
        if not resolved_description:
            resolved_description = (sidecar.get("description") or "").strip()
        if not resolved_tags:
            resolved_tags = (sidecar.get("tags") or "").strip()

    if not resolved_title:
        resolved_title = Path(dest_filename).stem
    if not resolved_description:
        resolved_description = f"Uploaded from project {project_name or request.project_type}"
    if not resolved_tags:
        resolved_tags = "#video" if request.project_type == "video" else "#image"

    item.status = "pending"
    item.worker_state = "pending"
    item.title = resolved_title
    item.description = resolved_description
    item.tags = resolved_tags
    item.platforms = {}
    item.file_path = str(dest_path)
    item.project_dir = str(origin_dir)

    queue_meta = (
        db.query(AssetMetadata)
        .filter(
            AssetMetadata.project_type == request.project_type,
            AssetMetadata.project_name == project_name,
            AssetMetadata.canonical_dir == "queue",
            AssetMetadata.filename == dest_filename,
        )
        .first()
    )
    if not queue_meta:
        queue_meta = AssetMetadata(
            project_type=request.project_type,
            project_name=project_name,
            canonical_dir="queue",
            filename=dest_filename,
        )
        db.add(queue_meta)
    queue_meta.title = resolved_title
    queue_meta.description = resolved_description
    queue_meta.tags = resolved_tags

    _publish_queue_event(db, item, "upserted")
    db.commit()

    try:
        sidecar_path = origin_dir / f"{Path(dest_filename).stem}.meta.json"
        with open(sidecar_path, "w", encoding="utf-8") as sf:
            json.dump({
                "title": resolved_title,
                "description": resolved_description,
                "tags": resolved_tags,
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


@router.get("/queue/thumbnail/{filename}")
async def get_queue_thumbnail(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    file_path = item.file_path if item and item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Queue file not found")

    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        return FileResponse(str(path), headers={"Cache-Control": "public, max-age=86400"})

    if suffix != ".mp4":
        raise HTTPException(status_code=404, detail="Thumbnail not available")

    cache_dir = BASE_DIR / "data" / "thumb_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    try:
        normalized = str(path).replace("\\", "/")
        if "/video_projects/" in normalized:
            project = normalized.split("/video_projects/", 1)[1].split("/", 1)[0] or "video"
        elif "/projects/" in normalized:
            project = normalized.split("/projects/", 1)[1].split("/", 1)[0] or "kdp"
        else:
            project = "legacy"
        size = path.stat().st_size
    except Exception:
        project = "legacy"
        size = 0
    cache_key = f"{project}::{path.name}::{size}"
    digest = hashlib.sha1(cache_key.encode("utf-8")).hexdigest()
    thumb_path = cache_dir / f"{digest}.jpg"
    if thumb_path.exists():
        return FileResponse(str(thumb_path), headers={"Cache-Control": "public, max-age=86400"})

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                "00:00:01",
                "-i",
                str(path),
                "-frames:v",
                "1",
                "-vf",
                "scale=320:-1",
                str(thumb_path),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
    except Exception:
        candidates = [
            path.parent / f"{path.stem}.webp",
            path.parent / f"{path.stem}.jpg",
            path.parent / f"{path.stem}.png",
            path.parent / f"{path.stem}_ref.jpg",
            path.parent / f"{path.stem}.__thumb.jpg",
        ]
        for c in candidates:
            if c.exists():
                return FileResponse(str(c), headers={"Cache-Control": "public, max-age=86400"})
        raise HTTPException(status_code=404, detail="Thumbnail not available")

    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(str(thumb_path), headers={"Cache-Control": "public, max-age=86400"})


@router.post("/queue/archive/{filename}")
async def archive_queue_item(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    file_path = item.file_path if item.file_path and os.path.exists(item.file_path) else str(UPLOAD_QUEUE_DIR / filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical file not found")

    archive_dir: Path | None = None
    try:
        normalized = file_path.replace("\\", "/")
        if "/video_projects/" in normalized:
            after = normalized.split("/video_projects/", 1)[1]
            project_name = after.split("/", 1)[0]
            project_root = Path(VIDEO_PROJECTS_DIR) / project_name
            if project_root.exists():
                archive_dir = project_root / "archive"
        elif "/projects/" in normalized:
            after = normalized.split("/projects/", 1)[1]
            project_name = after.split("/", 1)[0]
            project_root = Path(PROJECTS_DIR) / project_name
            if project_root.exists():
                archive_dir = project_root / "archive"
    except Exception:
        archive_dir = None

    if archive_dir is None:
        if item.project_dir and os.path.exists(item.project_dir):
            pd = Path(item.project_dir)
            if pd.name in {"raw_videos", "final", "raw_images"}:
                archive_dir = pd.parent / "archive"
            else:
                archive_dir = pd / "archive"
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
    _publish_queue_event(db, item, "updated")
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
                candidate = Path(before_queue)
                if "/video_projects/" in normalized:
                    raw_dir = candidate / "raw_videos"
                    target_dir = raw_dir if raw_dir.exists() else candidate
                elif "/projects/" in normalized:
                    raw_dir = candidate / "raw_images"
                    target_dir = raw_dir if raw_dir.exists() else candidate
                else:
                    target_dir = candidate
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

    _publish_queue_event(db, item, "deleted")
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
                matches = list(vp.glob(f"*/queue/{request.filename}"))
                if matches:
                    resolved = matches[0]
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
            if resolved.parent.name == "queue":
                if str(resolved).replace("\\", "/").startswith(str(VIDEO_PROJECTS_DIR).replace("\\", "/")):
                    rel = resolved.relative_to(VIDEO_PROJECTS_DIR)
                    parts = str(rel).replace("\\", "/").split("/")
                    project_name = parts[0] if len(parts) > 0 else ""
                    candidate = Path(VIDEO_PROJECTS_DIR) / project_name / "raw_videos"
                    item.project_dir = str(candidate) if candidate.exists() else str(resolved.parent.parent)
                else:
                    rel = resolved.relative_to(PROJECTS_DIR)
                    parts = str(rel).replace("\\", "/").split("/")
                    project_name = parts[0] if len(parts) > 0 else ""
                    candidate = Path(PROJECTS_DIR) / project_name / "raw_images"
                    item.project_dir = str(candidate) if candidate.exists() else str(resolved.parent.parent)
            else:
                item.project_dir = str(resolved.parent.parent)
        except Exception:
            item.project_dir = ""
        db.add(item)
    item.title = request.title
    item.description = request.description
    item.tags = request.tags
    _publish_queue_event(db, item, "updated")
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
        "platform_publish_schedule_map": request.platform_publish_schedule_map or {},
        "campaign_id": request.campaign_id or prev_options.get("campaign_id", ""),
    }
    try:
        item.scheduled_at = datetime.fromisoformat(request.schedule) if request.schedule else None
    except Exception:
        item.scheduled_at = None
    sync_queue_job_state(item)
    if item.worker_state in {"queued", "scheduled"}:
        item.last_error = None
        enqueue_publish_job(item.filename, scheduled_at=item.scheduled_at)
    _publish_queue_event(db, item, "updated")
    db.commit()
    return {"message": "Queue config updated"}


@router.post("/queue/bulk-update-config")
async def bulk_update_queue_config(request: BulkQueueConfigRequest, db: Session = Depends(get_db)):
    enqueued_count = 0
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
            "platform_publish_schedule_map": request.platform_publish_schedule_map_start or {},
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
        else:
            item.scheduled_at = None
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
        sync_queue_job_state(item)
        if item.worker_state in {"queued", "scheduled"}:
            item.last_error = None
            if enqueue_publish_job(item.filename, scheduled_at=item.scheduled_at):
                enqueued_count += 1
        _publish_queue_event(db, item, "updated")
    db.commit()
    return {
        "message": "Bulk queue config updated",
        "count": len(request.filenames),
        "redis_enqueued": enqueued_count,
    }
