from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List
import os
import json
from pathlib import Path
import subprocess
import sys

from backend.core.logger import logger

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

class CreateProjectRequest(BaseModel):
    name: str

class CurateRequest(BaseModel):
    filename: str

class GenerateVideoRequest(BaseModel):
    use_reference: bool = True

class BulkDeleteRequest(BaseModel):
    filenames: List[str]

@router.get("/projects")
async def list_projects():
    """Lists all projects in the video_projects directory."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        projects_dir = base_dir / "video_projects"
        if not projects_dir.exists():
            return []
        return [d.name for d in projects_dir.iterdir() if d.is_dir()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects")
async def create_project(req: CreateProjectRequest):
    """Creates a new video project directory structure."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "video_projects" / req.name
        
        if project_dir.exists():
            raise HTTPException(status_code=400, detail="Project already exists")
            
        os.makedirs(project_dir / "raw_videos", exist_ok=True)
        os.makedirs(project_dir / "final", exist_ok=True)
        os.makedirs(project_dir / "archive", exist_ok=True)
        
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
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "video_projects" / project_name
        
        raw_dir = project_dir / "raw_videos"
        final_dir = project_dir / "final"
        archive_dir = project_dir / "archive"
        
        def get_videos(path: Path):
            if not path.exists():
                return []
            projects_root = base_dir / "video_projects"
            # Return relative path to match static mount point
            return [str(f.relative_to(projects_root)).replace("\\", "/") for f in path.iterdir() if f.suffix.lower() == ".mp4"]

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
        base_dir = Path(__file__).resolve().parent.parent.parent
        prompts_file = base_dir / "video_projects" / project_name / "prompts.json"
        
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
        base_dir = Path(__file__).resolve().parent.parent.parent
        prompts_file = base_dir / "video_projects" / project_name / "prompts.json"
        
        os.makedirs(prompts_file.parent, exist_ok=True)
        with open(prompts_file, "w", encoding="utf-8") as f:
            json.dump(req.prompts, f, indent=4)
            
        # Also save to visual_prompts_only.txt for compatibility with generate_grok.py logic
        txt_file = base_dir / "video_projects" / project_name / "visual_prompts_only.txt"
        with open(txt_file, "w", encoding="utf-8") as f:
            f.write("\n".join(req.prompts))
            
        return {"status": "success", "message": "Prompts saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/config")
async def save_project_config(project_name: str, config: ProjectConfig):
    """Saves project configuration (topic, character, prompts settings)."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        config_file = base_dir / "video_projects" / project_name / "project_config.json"
        
        os.makedirs(config_file.parent, exist_ok=True)
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=4)
        
        return {"status": "success", "message": "Project config saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_name}/config")
async def get_project_config(project_name: str):
    """Loads project configuration."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        config_file = base_dir / "video_projects" / project_name / "project_config.json"
        
        if not config_file.exists():
            return ProjectConfig().model_dump()
        
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/generate")
async def trigger_video_generation(project_name: str, req: GenerateVideoRequest):
    """Triggers the Grok Playwright bot as a separate process."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "video_projects" / project_name
        prompts_file = project_dir / "prompts.json"
        
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found.")
        
        if not prompts_file.exists():
            raise HTTPException(status_code=400, detail="No prompts.json found. Save prompts first.")
        
        with open(prompts_file, "r", encoding="utf-8") as f:
            prompts_data = json.load(f)
        if not prompts_data or len(prompts_data) == 0:
            raise HTTPException(status_code=400, detail="prompts.json is empty. Generate and save prompts first.")
        
        # Run bot as a separate process
        bot_script = base_dir / "backend" / "services" / "video_worker.py"
        
        # Detach process on Windows
        kwargs = {}
        if os.name == 'nt':
            kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
            
        process = subprocess.Popen(
            [sys.executable, str(bot_script), project_name, str(req.use_reference).lower()],
            cwd=str(base_dir),
            **kwargs
        )
        
        logger.info(f"[Video API] Grok Bot process started (PID {process.pid}) for: {project_name}")
        return {"status": "success", "message": f"Grok Bot started for '{project_name}'. PID: {process.pid}."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Video API] Error triggering gen: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/curate")
async def curate_video(project_name: str, req: CurateRequest):
    """Moves a video from raw_videos to the final directory."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "video_projects" / project_name
        
        raw_path = project_dir / "raw_videos" / req.filename
        final_dir = project_dir / "final"
        final_path = final_dir / req.filename
        
        if not raw_path.exists():
            raise HTTPException(status_code=404, detail="Video not found in raw_videos")
            
        os.makedirs(final_dir, exist_ok=True)
        os.rename(raw_path, final_path)
        return {"status": "success", "message": f"Moved {req.filename} to final"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/archive")
async def archive_video(project_name: str, req: CurateRequest):
    """Moves a video from raw_videos or final to the archive directory."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "video_projects" / project_name
        
        archive_dir = project_dir / "archive"
        os.makedirs(archive_dir, exist_ok=True)
        archive_path = archive_dir / req.filename
        
        # Determine source
        raw_path = project_dir / "raw_videos" / req.filename
        final_path = project_dir / "final" / req.filename
        
        source_path = None
        if final_path.exists():
            source_path = final_path
        elif raw_path.exists():
            source_path = raw_path
            
        if not source_path:
            raise HTTPException(status_code=404, detail="Video not found in project")
            
        os.rename(source_path, archive_path)
        return {"status": "success", "message": f"Moved {req.filename} to archive"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/projects/{project_name}/videos")
async def bulk_delete_videos(project_name: str, req: BulkDeleteRequest):
    """Bulk deletes raw and final MP4 videos for a project to save storage."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "video_projects" / project_name
        
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
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "video_projects" / project_name
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
