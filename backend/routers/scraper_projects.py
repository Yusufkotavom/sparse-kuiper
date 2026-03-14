import os
import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from pathlib import Path
from backend.core.config import VIDEO_PROJECTS_DIR, UPLOAD_QUEUE_DIR
from backend.core.database import get_db
from sqlalchemy.orm import Session
import shutil

router = APIRouter()

class CreateProjectRequest(BaseModel):
    name: str

class SaveScrapedDataRequest(BaseModel):
    videos: List[Dict[str, Any]]
    channel: str = ""

@router.get("")
def list_projects():
    if not VIDEO_PROJECTS_DIR.exists():
        return {"projects": []}
    
    projects = []
    for d in os.listdir(VIDEO_PROJECTS_DIR):
        full_path = VIDEO_PROJECTS_DIR / d
        if full_path.is_dir():
            projects.append(d)
    
    # Sort alphabetically
    projects.sort()
    return {"projects": projects}

@router.post("")
def create_project(req: CreateProjectRequest):
    project_dir = VIDEO_PROJECTS_DIR / req.name.strip()
    if project_dir.exists():
        return {"message": "Project already exists", "name": req.name}
    
    try:
         os.makedirs(project_dir, exist_ok=True)
         os.makedirs(project_dir / "raw_videos", exist_ok=True)
         os.makedirs(project_dir / "final", exist_ok=True)
         os.makedirs(project_dir / "archive", exist_ok=True)
         return {"message": "Project created", "name": req.name}
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_name}/scraped-data")
def get_scraped_data(project_name: str):
    project_dir = VIDEO_PROJECTS_DIR / project_name
    if not project_dir.exists():
        return {"videos": [], "channel": ""}
        
    json_path = project_dir / "scraped_items.json"
    if not json_path.exists():
        return {"videos": [], "channel": ""}
        
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    except Exception as e:
        return {"videos": [], "channel": ""}

@router.post("/{project_name}/scraped-data")
def save_scraped_data(project_name: str, req: SaveScrapedDataRequest):
    project_dir = VIDEO_PROJECTS_DIR / project_name
    os.makedirs(project_dir, exist_ok=True)
    
    json_path = project_dir / "scraped_items.json"
    
    existing_videos = []
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing_videos = data.get("videos", [])
        except:
            pass
            
    # Merge, keeping existing ones and appending new unique urls
    existing_urls = {v.get("url") for v in existing_videos}
    for new_vid in req.videos:
        if new_vid.get("url") not in existing_urls:
            existing_videos.append(new_vid)
            existing_urls.add(new_vid.get("url"))
            
    try:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump({"videos": existing_videos, "channel": req.channel}, f, indent=4)
        return {"message": "Scraped data saved and merged successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_name}/logs")
def get_project_logs(project_name: str, lines: int = 50):
    project_dir = VIDEO_PROJECTS_DIR / project_name
    log_path = project_dir / "download.log"
    
    if not log_path.exists():
        return {"logs": ["No logs yet for this project."]}
        
    try:
         with open(log_path, "r", encoding="utf-8") as f:
             # Read the last N lines
             all_lines = f.readlines()
             return {"logs": [line.strip() for line in all_lines[-lines:]]}
    except Exception as e:
         return {"logs": [f"Error reading logs: {str(e)}"]}

@router.get("/{project_name}/downloads")
def get_project_downloads(project_name: str):
    base_dir = VIDEO_PROJECTS_DIR / project_name
    raw_dir = base_dir / "raw_videos"
    if not base_dir.exists():
        return {"files": []}
    if not raw_dir.exists():
        return {"files": []}
    
    files = []
    for f in os.listdir(raw_dir):
        if f.endswith(".mp4"):
            base = f[:-4]
            info_json = raw_dir / f"{base}.info.json"
            
            size_mb = 0
            file_path = raw_dir / f
            if file_path.exists():
                size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
                
            metadata = {}
            if info_json.exists():
                try:
                    with open(info_json, "r", encoding="utf-8") as jf:
                        metadata = json.load(jf)
                except:
                    pass
                    
            # Check for thumbnail
            has_thumbnail = False
            for ext in [".jpg", ".webp", ".png"]:
                if (raw_dir / f"{base}{ext}").exists():
                    has_thumbnail = True
                    break

            # Build tags from categories/tags in info.json
            raw_tags = metadata.get("tags", []) or []
            raw_cats = metadata.get("categories", []) or []
            combined_tags = list(dict.fromkeys(raw_tags + raw_cats))  # deduplicate
            tags_str = " ".join(f"#{t.replace(' ', '')}" for t in combined_tags[:10])

            # Description: use original description, trimmed
            description = (metadata.get("description") or "").strip()[:500]
            
            files.append({
                "filename": f,
                "title": metadata.get("title", f),
                "description": description,
                "tags": tags_str,
                "duration": metadata.get("duration", 0),
                "view_count": metadata.get("view_count", 0),
                "size_mb": size_mb,
                "uploader": metadata.get("uploader", "Unknown"),
                "channel": metadata.get("channel", "Unknown"),
                "has_thumbnail": has_thumbnail
            })
            
    return {"files": files}

@router.delete("/{project_name}/downloads/{filename}")
def delete_project_download(project_name: str, filename: str):
    raw_dir = VIDEO_PROJECTS_DIR / project_name / "raw_videos"
    file_path = raw_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        os.remove(file_path)
        base = filename[:-4]
        for ext in [".info.json", ".jpg", ".webp", ".png"]:
            extra_file = raw_dir / f"{base}{ext}"
            if extra_file.exists():
                os.remove(extra_file)
        return {"message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MoveQueueRequest(BaseModel):
    action: str = "copy"  # or "move"
    title: Optional[str] = None
    description: Optional[str] = ""
    tags: Optional[str] = ""

@router.post("/{project_name}/downloads/{filename}/queue")
def queue_project_download(
    project_name: str,
    filename: str,
    req: MoveQueueRequest,
    db: Session = Depends(get_db)
):
    raw_dir = VIDEO_PROJECTS_DIR / project_name / "raw_videos"
    file_path = raw_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    queue_dir = raw_dir / "queue"
    os.makedirs(queue_dir, exist_ok=True)
    
    base_name, ext = os.path.splitext(filename)
    dest_filename = filename
    counter = 1
    dest_path = queue_dir / dest_filename
    while dest_path.exists():
        dest_filename = f"{base_name}_{counter}{ext}"
        dest_path = queue_dir / dest_filename
        counter += 1
    
    try:
        if req.action == "move":
            shutil.move(str(file_path), str(dest_path))
        else:
            shutil.copy2(str(file_path), str(dest_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Read info.json for fallback title
    info_json_path = raw_dir / f"{base_name}.info.json"
    fallback_title = filename
    if info_json_path.exists():
        try:
            with open(info_json_path, "r", encoding="utf-8") as jf:
                meta = json.load(jf)
                fallback_title = meta.get("title", filename)
        except Exception:
            pass

    # Persist to DB
    from backend.models.upload_queue import UploadQueueItem
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == dest_filename).first()
    if not item:
        item = UploadQueueItem(filename=dest_filename)
        db.add(item)

    item.status = "pending"
    item.title = req.title or fallback_title
    item.description = req.description or ""
    item.tags = req.tags or ""
    item.platforms = {}
    item.file_path = str(dest_path)
    item.project_dir = str(raw_dir)
    db.commit()
    
    # Write sidecar metadata in raw_videos
    try:
        sidecar_path = raw_dir / f"{os.path.splitext(dest_filename)[0]}.meta.json"
        with open(sidecar_path, "w", encoding="utf-8") as sf:
            json.dump({
                "title": item.title or "",
                "description": item.description or "",
                "tags": item.tags or "",
            }, sf, ensure_ascii=False, indent=2)
    except Exception:
        pass

    return {"message": f"File {req.action}d to queue successfully", "filename": dest_filename}

@router.get("/{project_name}/downloads/{filename}/play")
def play_project_download(project_name: str, filename: str):
    raw_dir = VIDEO_PROJECTS_DIR / project_name / "raw_videos"
    file_path = raw_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(path=file_path, media_type="video/mp4")

@router.get("/{project_name}/downloads/{filename}/thumbnail")
def get_project_download_thumbnail(project_name: str, filename: str):
    raw_dir = VIDEO_PROJECTS_DIR / project_name / "raw_videos"
    base = filename[:-4] # remove .mp4
    
    # Try finding the exact thumbnail extension downloaded
    for ext in [".webp", ".jpg", ".png"]:
        thumb_path = raw_dir / f"{base}{ext}"
        if thumb_path.exists():
            return FileResponse(path=thumb_path)
            
    # Default fallback placeholder if no thumb found
    raise HTTPException(status_code=404, detail="Thumbnail not found")
