from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List
import os
import json
from pathlib import Path

from backend.services.prompt_engine import generate_kdp_prompts
from backend.services.pdf_engine import create_kdp_pdf
from backend.services.bot_worker import run_playwright_bot
from backend.core.logger import logger

router = APIRouter(prefix="/api/v1/kdp", tags=["kdp"])

# Pydantic Models
class PromptRequest(BaseModel):
    system_prompt: str
    prefix_prompt: str
    suffix_prompt: str
    topic: str
    number_n: int
    character_type: str
    model: str | None = None
    provider: str | None = None

class SavePromptsRequest(BaseModel):
    prompts: List[str]

class ProjectConfig(BaseModel):
    topic: str = ""
    character: str = ""
    number_n: int = 10
    system_prompt: str = ""
    prefix: str = ""
    suffix: str = ""

class PdfRequest(BaseModel):
    project_name: str
    image_paths: List[str]

class CreateProjectRequest(BaseModel):
    name: str

class CurateRequest(BaseModel):
    filename: str

class BulkDeleteRequest(BaseModel):
    filenames: List[str]

class MoveRequest(BaseModel):
    filename: str
    target_stage: str

@router.get("/projects")
async def list_projects():
    """Lists all projects in the projects directory."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        projects_dir = base_dir / "projects"
        if not projects_dir.exists():
            return []
        return [d.name for d in projects_dir.iterdir() if d.is_dir()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects")
async def create_project(req: CreateProjectRequest):
    """Creates a new project directory structure."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "projects" / req.name
        
        if project_dir.exists():
            raise HTTPException(status_code=400, detail="Project already exists")
            
        os.makedirs(project_dir / "raw_images", exist_ok=True)
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

@router.get("/projects/{project_name}/images")
async def list_project_images(project_name: str):
    """Lists raw and final images for a project."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "projects" / project_name
        
        raw_dir = project_dir / "raw_images"
        final_dir = project_dir / "final"
        archive_dir = project_dir / "archive"
        
        def get_images(path: Path):
            if not path.exists():
                return []
            projects_root = base_dir / "projects"
            return [str(f.relative_to(projects_root)).replace("\\", "/") for f in path.iterdir() if f.suffix.lower() in [".png", ".jpg", ".jpeg"]]

        return {
            "raw": get_images(raw_dir),
            "final": get_images(final_dir),
            "archive": get_images(archive_dir)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/projects/{project_name}/images")
async def bulk_delete_images(project_name: str, req: BulkDeleteRequest):
    """Bulk deletes raw and final images for a project to save storage."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "projects" / project_name
        raw_dir = project_dir / "raw_images"
        final_dir = project_dir / "final"

        deleted_count = 0
        errors = []

        for filename in req.filenames:
            raw_path = raw_dir / filename
            if raw_path.exists():
                try:
                    os.remove(raw_path)
                    deleted_count += 1
                    continue
                except Exception as ex:
                    errors.append(f"Failed raw {filename}: {ex}")

            final_path = final_dir / filename
            if final_path.exists():
                try:
                    os.remove(final_path)
                    deleted_count += 1
                except Exception as ex:
                    errors.append(f"Failed final {filename}: {ex}")

        return {
            "status": "success" if deleted_count > 0 or not errors else "error",
            "message": f"Deleted {deleted_count} image(s).",
            "errors": errors,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/projects/{project_name}")
async def delete_kdp_project(project_name: str):
    """Permanently deletes an entire KDP project directory."""
    import shutil
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "projects" / project_name
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found")
        shutil.rmtree(project_dir, ignore_errors=False)
        logger.info(f"[KDP API] Deleted project: {project_name}")
        return {"status": "success", "message": f"Project '{project_name}' deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[KDP API] Error deleting project {project_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/prompts")
async def save_project_prompts(project_name: str, req: SavePromptsRequest):
    """Saves generated prompts to the project's prompts.json."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        prompts_file = base_dir / "projects" / project_name / "prompts.json"
        
        with open(prompts_file, "w", encoding="utf-8") as f:
            json.dump(req.prompts, f, indent=4)
            
        return {"status": "success", "message": "Prompts saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_name}/prompts")
async def get_project_prompts(project_name: str):
    """Loads saved prompts for a project."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        prompts_file = base_dir / "projects" / project_name / "prompts.json"
        
        if not prompts_file.exists():
            return {"prompts": []}
            
        with open(prompts_file, "r", encoding="utf-8") as f:
            prompts = json.load(f)
            
        return {"prompts": prompts}
    except Exception as e:
        return {"prompts": []}

@router.post("/projects/{project_name}/config")
async def save_project_config(project_name: str, config: ProjectConfig):
    """Saves project configuration (topic, character, prompts settings)."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        config_file = base_dir / "projects" / project_name / "project_config.json"
        
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
        config_file = base_dir / "projects" / project_name / "project_config.json"
        
        if not config_file.exists():
            return ProjectConfig().model_dump()
        
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/generate")
async def trigger_kdp_generation(project_name: str):
    """Triggers the Playwright bot as a separate process."""
    import subprocess
    import sys
    
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "projects" / project_name
        prompts_file = project_dir / "prompts.json"
        
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found.")
        
        if not prompts_file.exists():
            raise HTTPException(status_code=400, detail="No prompts.json found. Save prompts first.")
        
        with open(prompts_file, "r", encoding="utf-8") as f:
            prompts_data = json.load(f)
        if not prompts_data or len(prompts_data) == 0:
            raise HTTPException(status_code=400, detail="prompts.json is empty. Generate and save prompts first.")
        
        # Run bot as a separate process to avoid asyncio conflicts with Playwright
        bot_script = base_dir / "backend" / "services" / "bot_worker.py"
        
        # Detach process on Windows so it survives Uvicorn reload
        kwargs = {}
        if os.name == 'nt':
            kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
            
        process = subprocess.Popen(
            [sys.executable, str(bot_script), project_name],
            cwd=str(base_dir),
            **kwargs
        )
        
        logger.info(f"[API] Bot process started (PID {process.pid}) for: {project_name} ({len(prompts_data)} prompts)")
        return {"status": "success", "message": f"Bot started for '{project_name}' with {len(prompts_data)} prompts (PID: {process.pid}). A Chrome window should open shortly."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/curate")
async def curate_image(project_name: str, req: CurateRequest):
    """Moves an image from raw_images to the final directory."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "projects" / project_name
        
        raw_path = project_dir / "raw_images" / req.filename
        final_dir = project_dir / "final"
        final_path = final_dir / req.filename
        
        if not raw_path.exists():
            raise HTTPException(status_code=404, detail="Image not found in raw_images")
            
        os.makedirs(final_dir, exist_ok=True)
        os.rename(raw_path, final_path)
        
        return {"status": "success", "message": f"Moved {req.filename} to final"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/archive")
async def archive_image(project_name: str, req: CurateRequest):
    """Moves an image from raw_images or final to the archive directory."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "projects" / project_name
        
        archive_dir = project_dir / "archive"
        os.makedirs(archive_dir, exist_ok=True)
        archive_path = archive_dir / req.filename
        
        raw_path = project_dir / "raw_images" / req.filename
        final_path = project_dir / "final" / req.filename
        
        source_path = None
        if final_path.exists():
            source_path = final_path
        elif raw_path.exists():
            source_path = raw_path
            
        if not source_path:
            raise HTTPException(status_code=404, detail="Image not found in project")
            
        os.rename(source_path, archive_path)
        
        return {"status": "success", "message": f"Moved {req.filename} to archive"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/move")
async def move_image_stage(project_name: str, req: MoveRequest):
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        project_dir = base_dir / "projects" / project_name
        target = req.target_stage.lower()
        raw_dir = project_dir / "raw_images"
        final_dir = project_dir / "final"
        archive_dir = project_dir / "archive"
        if target not in {"raw", "final", "archive"}:
            raise HTTPException(status_code=400, detail="Invalid target_stage")
        target_dir = raw_dir if target == "raw" else final_dir if target == "final" else archive_dir
        raw_path = raw_dir / req.filename
        final_path = final_dir / req.filename
        archive_path = archive_dir / req.filename
        source_path = None
        for path in [raw_path, final_path, archive_path]:
            if path.exists():
                source_path = path
                break
        if not source_path:
            raise HTTPException(status_code=404, detail="Image not found in project")
        dest_path = target_dir / req.filename
        if source_path == dest_path:
            return {"status": "success", "message": f"{req.filename} already in {target}"}
        os.makedirs(target_dir, exist_ok=True)
        os.rename(source_path, dest_path)
        return {"status": "success", "message": f"Moved {req.filename} to {target}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prompts", response_model=List[str])
async def create_prompts(req: PromptRequest):
    """Generates a list of prompts via configured LLM provider."""
    try:
        prompts = generate_kdp_prompts(
            system_prompt=req.system_prompt,
            prefix_prompt=req.prefix_prompt,
            suffix_prompt=req.suffix_prompt,
            topic=req.topic,
            number_n=req.number_n,
            character_type=req.character_type,
            model=req.model,
            provider=req.provider,
        )
        return prompts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pdf")
async def compile_pdf(req: PdfRequest):
    """Weaves images into a final KDP-ready PDF."""
    try:
        base_dir = Path(__file__).resolve().parent.parent.parent
        output_dir = base_dir / "projects" / req.project_name / "final"
        filename = f"{req.project_name}_KDP_Format.pdf"
        
        pdf_path = create_kdp_pdf(
            image_paths=req.image_paths,
            output_filename=filename,
            output_dir=str(output_dir)
        )
        return {"status": "success", "pdf_path": pdf_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
