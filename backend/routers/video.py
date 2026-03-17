from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import os
import json
import hashlib
from pathlib import Path
import subprocess
import sys
from sqlalchemy.orm import Session

from backend.core.logger import logger
from backend.core.config import VIDEO_PROJECTS_DIR, BASE_DIR
from backend.core.database import get_db
from backend.models.project_config import ProjectConfig as ProjectConfigModel
from backend.models.account import Account
from backend.services.playwright_session_guard import check_grok_session

router = APIRouter(prefix="/api/v1/video", tags=["video"])

# Pydantic Models
class SavePromptsRequest(BaseModel):
    prompts: List[str]

class ProjectConfig(BaseModel):
    topic: str = ""
    character: str = ""
    number_n: int = 10
    system_prompt: str = ""
    prefix: str = ""
    suffix: str = ""
    grok_account_id: str = ""

class CreateProjectRequest(BaseModel):
    name: str

class CurateRequest(BaseModel):
    filename: str

class MoveRequest(BaseModel):
    filename: str
    target_stage: str

class GenerateVideoRequest(BaseModel):
    use_reference: bool = True
    headless_mode: bool = True

class BulkDeleteRequest(BaseModel):
    filenames: List[str]


@router.get("/thumbnail")
async def get_video_thumbnail(file: str):
    base = VIDEO_PROJECTS_DIR.resolve()
    full = (VIDEO_PROJECTS_DIR / file).resolve()
    if base not in full.parents and full != base:
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not full.exists() or full.suffix.lower() != ".mp4":
        raise HTTPException(status_code=404, detail="Video not found")

    cache_dir = BASE_DIR / "data" / "thumb_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    try:
        project = file.replace("\\", "/").split("/")[0] if "/" in file.replace("\\", "/") else "global"
        size = full.stat().st_size
    except Exception:
        project = "global"
        size = 0
    cache_key = f"{project}::{full.name}::{size}"
    digest = hashlib.sha1(cache_key.encode("utf-8")).hexdigest()
    thumb_path = cache_dir / f"{digest}.jpg"
    if thumb_path.exists():
        return FileResponse(path=str(thumb_path), headers={"Cache-Control": "public, max-age=86400"})

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                "00:00:01",
                "-i",
                str(full),
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
            full.parent / f"{full.stem}.webp",
            full.parent / f"{full.stem}.jpg",
            full.parent / f"{full.stem}.png",
            full.parent / f"{full.stem}_ref.jpg",
            full.parent / f"{full.stem}.__thumb.jpg",
        ]
        for p in candidates:
            if p.exists():
                return FileResponse(path=str(p), headers={"Cache-Control": "public, max-age=86400"})
        raise HTTPException(status_code=404, detail="Thumbnail not available")

    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(path=str(thumb_path), headers={"Cache-Control": "public, max-age=86400"})


@router.get("/projects")
async def list_projects():
    """Lists all projects in the video_projects directory."""
    try:
        if not VIDEO_PROJECTS_DIR.exists():
            return []
        return [d.name for d in VIDEO_PROJECTS_DIR.iterdir() if d.is_dir()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects")
async def create_project(req: CreateProjectRequest):
    """Creates a new video project directory structure."""
    try:
        project_dir = VIDEO_PROJECTS_DIR / req.name
        
        if project_dir.exists():
            raise HTTPException(status_code=400, detail="Project already exists")
            
        os.makedirs(project_dir / "raw_videos", exist_ok=True)
        os.makedirs(project_dir / "final", exist_ok=True)
        os.makedirs(project_dir / "archive", exist_ok=True)
        os.makedirs(project_dir / "queue", exist_ok=True)
        
        # Create an empty prompts.json
        with open(project_dir / "prompts.json", "w") as f:
            json.dump([], f)
            
        return {"status": "success", "message": f"Project {req.name} created"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_name}/videos")
async def list_project_videos(project_name: str):
    """Lists raw and final MP4 videos for a project."""
    try:
        project_dir = VIDEO_PROJECTS_DIR / project_name
        
        raw_dir = project_dir / "raw_videos"
        final_dir = project_dir / "final"
        archive_dir = project_dir / "archive"
        
        def get_videos(path: Path):
            if not path.exists():
                return []
            # Return relative path to match static mount point
            return [str(f.relative_to(VIDEO_PROJECTS_DIR)).replace("\\", "/") for f in path.iterdir() if f.suffix.lower() == ".mp4"]

        return {
            "raw": get_videos(raw_dir),
            "final": get_videos(final_dir),
            "archive": get_videos(archive_dir)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_name}/prompts")
async def get_project_prompts(project_name: str):
    """Loads saved prompts for a project."""
    try:
        prompts_file = VIDEO_PROJECTS_DIR / project_name / "prompts.json"
        
        if not prompts_file.exists():
            return {"prompts": []}
        
        with open(prompts_file, "r", encoding="utf-8") as f:
            return {"prompts": json.load(f)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/prompts")
async def save_project_prompts(project_name: str, req: SavePromptsRequest):
    """Saves generated prompts to the project's prompts.json."""
    try:
        prompts_file = VIDEO_PROJECTS_DIR / project_name / "prompts.json"
        
        os.makedirs(prompts_file.parent, exist_ok=True)
        with open(prompts_file, "w", encoding="utf-8") as f:
            json.dump(req.prompts, f, indent=4)
            
        # Also save to visual_prompts_only.txt for compatibility with generate_grok.py logic
        txt_file = VIDEO_PROJECTS_DIR / project_name / "visual_prompts_only.txt"
        with open(txt_file, "w", encoding="utf-8") as f:
            f.write("\n".join(req.prompts))
            
        return {"status": "success", "message": "Prompts saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/config")
async def save_project_config(project_name: str, config: ProjectConfig, db: Session = Depends(get_db)):
    """Saves project configuration (topic, character, prompts settings)."""
    try:
        row = db.query(ProjectConfigModel).filter(
            ProjectConfigModel.name == project_name,
            ProjectConfigModel.project_type == "video",
        ).first()
        if not row:
            row = ProjectConfigModel(name=project_name, project_type="video")
            db.add(row)

        row.topic = config.topic
        row.character = config.character
        row.number_n = config.number_n
        row.system_prompt = config.system_prompt
        row.prefix = config.prefix
        row.suffix = config.suffix
        row.grok_account_id = config.grok_account_id
        db.commit()

        config_file = VIDEO_PROJECTS_DIR / project_name / "project_config.json"
        os.makedirs(config_file.parent, exist_ok=True)
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=4)
        
        return {"status": "success", "message": "Project config saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_name}/config")
async def get_project_config(project_name: str, db: Session = Depends(get_db)):
    """Loads project configuration."""
    try:
        row = db.query(ProjectConfigModel).filter(
            ProjectConfigModel.name == project_name,
            ProjectConfigModel.project_type == "video",
        ).first()
        if row:
            return ProjectConfig(
                topic=row.topic or "",
                character=row.character or "",
                number_n=row.number_n or 10,
                system_prompt=row.system_prompt or "",
                prefix=row.prefix or "",
                suffix=row.suffix or "",
                grok_account_id=row.grok_account_id or "",
            ).model_dump()

        config_file = VIDEO_PROJECTS_DIR / project_name / "project_config.json"
        if not config_file.exists():
            return ProjectConfig().model_dump()

        with open(config_file, "r", encoding="utf-8") as f:
            legacy = json.load(f)

        parsed = ProjectConfig(**legacy)
        row = ProjectConfigModel(name=project_name, project_type="video")
        row.topic = parsed.topic
        row.character = parsed.character
        row.number_n = parsed.number_n
        row.system_prompt = parsed.system_prompt
        row.prefix = parsed.prefix
        row.suffix = parsed.suffix
        row.grok_account_id = parsed.grok_account_id
        db.add(row)
        db.commit()
        return parsed.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/generate")
async def trigger_video_generation(project_name: str, req: GenerateVideoRequest, db: Session = Depends(get_db)):
    """Triggers the Grok Playwright bot as a separate process."""
    try:
        project_dir = VIDEO_PROJECTS_DIR / project_name
        prompts_file = project_dir / "prompts.json"
        
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found.")
        
        if not prompts_file.exists():
            raise HTTPException(status_code=400, detail="No prompts.json found. Save prompts first.")
        
        with open(prompts_file, "r", encoding="utf-8") as f:
            prompts_data = json.load(f)
        if not prompts_data or len(prompts_data) == 0:
            raise HTTPException(status_code=400, detail="prompts.json is empty. Generate and save prompts first.")

        cfg = db.query(ProjectConfigModel).filter(
            ProjectConfigModel.name == project_name,
            ProjectConfigModel.project_type == "video",
        ).first()
        grok_account_id = (cfg.grok_account_id if cfg else "") or ""
        if not grok_account_id:
            active = db.query(Account).filter(
                Account.platform == "grok",
                Account.auth_method == "playwright",
                Account.status == "active",
            ).order_by(Account.last_login.desc().nullslast()).first()
            if active:
                grok_account_id = active.id
            else:
                any_grok = db.query(Account).filter(
                    Account.platform == "grok",
                    Account.auth_method == "playwright",
                ).order_by(Account.last_login.desc().nullslast()).first()
                grok_account_id = any_grok.id if any_grok else "grok_default"

        import anyio
        ok, reason = await anyio.to_thread.run_sync(check_grok_session, grok_account_id)
        if not ok:
            raise HTTPException(status_code=409, detail=f"session expired, re-login required ({reason})")
        
        # Run bot as a separate process
        bot_script = BASE_DIR / "backend" / "services" / "video_worker.py"
        
        # Detach process on Windows
        kwargs = {}
        if os.name == 'nt':
            kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
            
        process = subprocess.Popen(
            [
                sys.executable,
                str(bot_script),
                project_name,
                str(req.use_reference).lower(),
                str(req.headless_mode).lower(),
                grok_account_id,
            ],
            cwd=str(BASE_DIR),
            **kwargs
        )
        
        logger.info(f"[Video API] Grok Bot process started (PID {process.pid}) for: {project_name} account={grok_account_id}")
        return {"status": "success", "message": f"Grok Bot started for '{project_name}'. PID: {process.pid}. account_id={grok_account_id}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Video API] Error triggering gen: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/curate")
async def curate_video(project_name: str, req: CurateRequest):
    """Moves a video from raw_videos to the final directory."""
    try:
        project_dir = VIDEO_PROJECTS_DIR / project_name
        
        raw_dir = project_dir / "raw_videos"
        raw_path = raw_dir / req.filename
        queue_path = project_dir / "queue" / req.filename
        final_dir = project_dir / "final"
        final_path = final_dir / req.filename
        
        source_path = raw_path if raw_path.exists() else queue_path if queue_path.exists() else None
        if not source_path:
            raise HTTPException(status_code=404, detail="Video not found in raw_videos")
            
        os.makedirs(final_dir, exist_ok=True)
        try:
            os.rename(source_path, final_path)
        except Exception:
            try:
                import shutil
                shutil.copy2(source_path, final_path)
                os.remove(source_path)
            except Exception as ex:
                raise HTTPException(status_code=500, detail=f"Failed to move file: {ex}")
        return {"status": "success", "message": f"Moved {req.filename} to final"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/archive")
async def archive_video(project_name: str, req: CurateRequest):
    """Moves a video from raw_videos or final to the archive directory."""
    try:
        project_dir = VIDEO_PROJECTS_DIR / project_name
        
        archive_dir = project_dir / "archive"
        os.makedirs(archive_dir, exist_ok=True)
        archive_path = archive_dir / req.filename
        
        # Determine source
        raw_dir = project_dir / "raw_videos"
        final_dir = project_dir / "final"
        queue_dir = project_dir / "queue"
        raw_path = raw_dir / req.filename
        final_path = final_dir / req.filename
        queue_path = queue_dir / req.filename
        
        source_path = None
        for path in [final_path, raw_path, queue_path]:
            if path.exists():
                source_path = path
                break
            
        if not source_path:
            raise HTTPException(status_code=404, detail="Video not found in project")
            
        try:
            os.rename(source_path, archive_path)
        except Exception:
            try:
                import shutil
                shutil.copy2(source_path, archive_path)
                os.remove(source_path)
            except Exception as ex:
                raise HTTPException(status_code=500, detail=f"Failed to move file: {ex}")
        return {"status": "success", "message": f"Moved {req.filename} to archive"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/move")
async def move_video_stage(project_name: str, req: MoveRequest):
    try:
        project_dir = VIDEO_PROJECTS_DIR / project_name
        target = req.target_stage.lower()
        raw_dir = project_dir / "raw_videos"
        final_dir = project_dir / "final"
        archive_dir = project_dir / "archive"
        queue_dir = project_dir / "queue"
        if target not in {"raw", "final", "archive"}:
            raise HTTPException(status_code=400, detail="Invalid target_stage")
        target_dir = raw_dir if target == "raw" else final_dir if target == "final" else archive_dir
        raw_path = raw_dir / req.filename
        final_path = final_dir / req.filename
        archive_path = archive_dir / req.filename
        queue_path = queue_dir / req.filename
        source_path = None
        for path in [raw_path, final_path, queue_path, archive_path]:
            if path.exists():
                source_path = path
                break
        if not source_path:
            raise HTTPException(status_code=404, detail="Video not found in project")
        dest_path = target_dir / req.filename
        if source_path == dest_path:
            return {"status": "success", "message": f"{req.filename} already in {target}"}
        os.makedirs(target_dir, exist_ok=True)
        try:
            os.rename(source_path, dest_path)
        except Exception:
            try:
                import shutil
                shutil.copy2(source_path, dest_path)
                os.remove(source_path)
            except Exception as ex:
                raise HTTPException(status_code=500, detail=f"Failed to move file: {ex}")
        return {"status": "success", "message": f"Moved {req.filename} to {target}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/projects/{project_name}/videos")
async def bulk_delete_videos(project_name: str, req: BulkDeleteRequest):
    """Bulk deletes raw and final MP4 videos for a project to save storage."""
    try:
        project_dir = VIDEO_PROJECTS_DIR / project_name
        
        raw_dir = project_dir / "raw_videos"
        final_dir = project_dir / "final"
        
        deleted_count = 0
        errors = []
        
        for filename in req.filenames:
            # Check raw_videos
            raw_path = raw_dir / filename
            if raw_path.exists():
                try:
                    os.remove(raw_path)
                    deleted_count += 1
                    continue
                except Exception as ex:
                    errors.append(f"Failed to delete {filename} from raw: {str(ex)}")
            
            # Check final
            final_path = final_dir / filename
            if final_path.exists():
                try:
                    os.remove(final_path)
                    deleted_count += 1
                except Exception as ex:
                    errors.append(f"Failed to delete {filename} from final: {str(ex)}")

        message = f"Deleted {deleted_count} video(s)."
        if errors:
            message += f" Encountered {len(errors)} error(s)."
            
        return {"status": "success" if deleted_count > 0 or not errors else "error", "message": message, "errors": errors}
    except Exception as e:
        logger.error(f"[Video API] Error bulk deleting videos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/projects/{project_name}")
async def delete_project(project_name: str):
    """Permanently deletes an entire video project directory."""
    import shutil
    try:
        project_dir = VIDEO_PROJECTS_DIR / project_name
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail="Project not found")
        shutil.rmtree(project_dir, ignore_errors=False)
        logger.info(f"[Video API] Deleted project: {project_name}")
        return {"status": "success", "message": f"Project '{project_name}' deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Video API] Error deleting project {project_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
