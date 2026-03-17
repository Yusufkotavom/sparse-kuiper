from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import List
import os
import json
from pathlib import Path
from sqlalchemy.orm import Session

from backend.services.prompt_engine import generate_kdp_prompts
from backend.services.pdf_engine import create_kdp_pdf
from backend.services.bot_worker import run_playwright_bot
from backend.core.config import PROJECTS_DIR, BASE_DIR
from backend.core.logger import logger
from backend.core.database import get_db
from backend.models.project_config import ProjectConfig as ProjectConfigModel
from backend.models.account import Account
from backend.services.playwright_session_guard import check_whisk_session

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
    whisk_account_id: str = ""

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
        if not PROJECTS_DIR.exists():
            return []
        return [d.name for d in PROJECTS_DIR.iterdir() if d.is_dir()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects")
async def create_project(req: CreateProjectRequest):
    """Creates a new project directory structure."""
    try:
        project_dir = PROJECTS_DIR / req.name
        
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
        project_dir = PROJECTS_DIR / project_name
        
        raw_dir = project_dir / "raw_images"
        final_dir = project_dir / "final"
        archive_dir = project_dir / "archive"
        
        def get_images(path: Path):
            if not path.exists():
                return []
            return [str(f.relative_to(PROJECTS_DIR)).replace("\\", "/") for f in path.iterdir() if f.suffix.lower() in [".png", ".jpg", ".jpeg"]]

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
        project_dir = PROJECTS_DIR / project_name
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
        project_dir = PROJECTS_DIR / project_name
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
        prompts_file = PROJECTS_DIR / project_name / "prompts.json"
        
        with open(prompts_file, "w", encoding="utf-8") as f:
            json.dump(req.prompts, f, indent=4)
            
        return {"status": "success", "message": "Prompts saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_name}/prompts")
async def get_project_prompts(project_name: str):
    """Loads saved prompts for a project."""
    try:
        prompts_file = PROJECTS_DIR / project_name / "prompts.json"
        
        if not prompts_file.exists():
            return {"prompts": []}
            
        with open(prompts_file, "r", encoding="utf-8") as f:
            prompts = json.load(f)
            
        return {"prompts": prompts}
    except Exception as e:
        return {"prompts": []}

@router.post("/projects/{project_name}/config")
async def save_project_config(project_name: str, config: ProjectConfig, db: Session = Depends(get_db)):
    """Saves project configuration (topic, character, prompts settings)."""
    try:
        row = db.query(ProjectConfigModel).filter(
            ProjectConfigModel.name == project_name,
            ProjectConfigModel.project_type == "kdp",
        ).first()
        if not row:
            row = ProjectConfigModel(name=project_name, project_type="kdp")
            db.add(row)

        row.topic = config.topic
        row.character = config.character
        row.number_n = config.number_n
        row.system_prompt = config.system_prompt
        row.prefix = config.prefix
        row.suffix = config.suffix
        row.whisk_account_id = config.whisk_account_id
        db.commit()

        config_file = PROJECTS_DIR / project_name / "project_config.json"
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
            ProjectConfigModel.project_type == "kdp",
        ).first()
        if row:
            return ProjectConfig(
                topic=row.topic or "",
                character=row.character or "",
                number_n=row.number_n or 10,
                system_prompt=row.system_prompt or "",
                prefix=row.prefix or "",
                suffix=row.suffix or "",
                whisk_account_id=row.whisk_account_id or "",
            ).model_dump()

        config_file = PROJECTS_DIR / project_name / "project_config.json"
        if not config_file.exists():
            return ProjectConfig().model_dump()

        with open(config_file, "r", encoding="utf-8") as f:
            legacy = json.load(f)

        parsed = ProjectConfig(**legacy)
        row = ProjectConfigModel(name=project_name, project_type="kdp")
        row.topic = parsed.topic
        row.character = parsed.character
        row.number_n = parsed.number_n
        row.system_prompt = parsed.system_prompt
        row.prefix = parsed.prefix
        row.suffix = parsed.suffix
        row.whisk_account_id = parsed.whisk_account_id
        db.add(row)
        db.commit()
        return parsed.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/generate")
async def trigger_kdp_generation(project_name: str, db: Session = Depends(get_db)):
    """Triggers the Playwright bot as a separate process."""
    import subprocess
    import sys
    
    try:
        project_dir = PROJECTS_DIR / project_name
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
            ProjectConfigModel.project_type == "kdp",
        ).first()
        whisk_account_id = (cfg.whisk_account_id if cfg else "") or ""
        if not whisk_account_id:
            active = db.query(Account).filter(
                Account.platform == "whisk",
                Account.auth_method == "playwright",
                Account.status == "active",
            ).order_by(Account.last_login.desc().nullslast()).first()
            if active:
                whisk_account_id = active.id
            else:
                any_whisk = db.query(Account).filter(
                    Account.platform == "whisk",
                    Account.auth_method == "playwright",
                ).order_by(Account.last_login.desc().nullslast()).first()
                whisk_account_id = any_whisk.id if any_whisk else "whisk_default"

        import anyio
        ok, reason = await anyio.to_thread.run_sync(check_whisk_session, whisk_account_id)
        if not ok:
            raise HTTPException(status_code=409, detail=f"session expired, re-login required ({reason})")
        
        # Run bot as a separate process to avoid asyncio conflicts with Playwright
        bot_script = BASE_DIR / "backend" / "services" / "bot_worker.py"
        
        # Detach process on Windows so it survives Uvicorn reload
        kwargs = {}
        if os.name == 'nt':
            kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
            
        process = subprocess.Popen(
            [sys.executable, str(bot_script), project_name, whisk_account_id],
            cwd=str(BASE_DIR),
            **kwargs
        )
        
        logger.info(f"[API] Bot process started (PID {process.pid}) for: {project_name} ({len(prompts_data)} prompts) account={whisk_account_id}")
        return {"status": "success", "message": f"Bot started for '{project_name}' with {len(prompts_data)} prompts (PID: {process.pid}). account_id={whisk_account_id}. A Chrome window should open shortly."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/curate")
async def curate_image(project_name: str, req: CurateRequest):
    """Moves an image from raw_images to the final directory."""
    try:
        project_dir = PROJECTS_DIR / project_name
        
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
        project_dir = PROJECTS_DIR / project_name
        
        archive_dir = project_dir / "archive"
        os.makedirs(archive_dir, exist_ok=True)
        archive_path = archive_dir / req.filename
        
        raw_dir = project_dir / "raw_images"
        final_dir = project_dir / "final"
        raw_path = raw_dir / req.filename
        raw_queue_path = raw_dir / "queue" / req.filename
        project_queue_path = project_dir / "queue" / req.filename
        final_path = final_dir / req.filename
        
        source_path = None
        for path in [final_path, raw_path, raw_queue_path, project_queue_path]:
            if path.exists():
                source_path = path
                break
            
        if not source_path:
            raise HTTPException(status_code=404, detail="Image not found in project")
            
        os.rename(source_path, archive_path)
        
        return {"status": "success", "message": f"Moved {req.filename} to archive"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/move")
async def move_image_stage(project_name: str, req: MoveRequest):
    try:
        project_dir = PROJECTS_DIR / project_name
        target = req.target_stage.lower()
        raw_dir = project_dir / "raw_images"
        final_dir = project_dir / "final"
        archive_dir = project_dir / "archive"
        if target not in {"raw", "final", "archive"}:
            raise HTTPException(status_code=400, detail="Invalid target_stage")
        target_dir = raw_dir if target == "raw" else final_dir if target == "final" else archive_dir
        raw_path = raw_dir / req.filename
        raw_queue_path = raw_dir / "queue" / req.filename
        project_queue_path = project_dir / "queue" / req.filename
        final_path = final_dir / req.filename
        archive_path = archive_dir / req.filename
        source_path = None
        for path in [raw_path, raw_queue_path, project_queue_path, final_path, archive_path]:
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
        output_dir = PROJECTS_DIR / req.project_name / "final"
        filename = f"{req.project_name}_KDP_Format.pdf"
        
        pdf_path = create_kdp_pdf(
            image_paths=req.image_paths,
            output_filename=filename,
            output_dir=str(output_dir)
        )
        return {"status": "success", "pdf_path": pdf_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
