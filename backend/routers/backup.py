from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import os
import time
import zipfile

router = APIRouter(prefix="/api/v1/backup", tags=["backup"])

def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent

@router.get("/export-zip")
async def export_zip(include_db: bool = True, include_google_secrets: bool = True, include_youtube_secrets: bool = True, include_sessions: bool = True):
    base = _project_root()
    backup_dir = base / "data" / "backups"
    os.makedirs(backup_dir, exist_ok=True)
    ts = int(time.time())
    zip_path = backup_dir / f"backup_{ts}.zip"

    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            if include_db:
                db_path = base / "nomad_hub.db"
                if db_path.exists():
                    zf.write(str(db_path), arcname="nomad_hub.db")
            if include_google_secrets:
                gs_dir = base / "config" / "google_secrets"
                if gs_dir.exists():
                    for p in gs_dir.glob("*.json"):
                        zf.write(str(p), arcname=str(Path("config/google_secrets") / p.name))
            if include_youtube_secrets:
                ys_dir = base / "config" / "youtube_secrets"
                if ys_dir.exists():
                    for p in ys_dir.glob("*.json"):
                        zf.write(str(p), arcname=str(Path("config/youtube_secrets") / p.name))
            if include_sessions:
                sess_dir = base / "data" / "sessions"
                if sess_dir.exists():
                    for p in sess_dir.rglob("*"):
                        if p.is_file():
                            rel = p.relative_to(base)
                            zf.write(str(p), arcname=str(rel))
        return FileResponse(path=str(zip_path), filename=zip_path.name, media_type="application/zip")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
