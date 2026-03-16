from fastapi import APIRouter, HTTPException, Depends, UploadFile
from pydantic import BaseModel
from typing import Optional
import json
import io
import os
from pathlib import Path
from backend.core.database import get_db
from sqlalchemy.orm import Session
from backend.models.account import Account
from backend.core.logger import logger
from backend.services.google_drive_service import (
    list_files,
    create_folder,
    upload_stream,
    delete_file,
    move_file,
    download_file_bytes,
    download_to_path,
    get_file_meta,
)
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/v1/drive", tags=["drive"])

class ListQuery(BaseModel):
    account_id: str
    parent_id: Optional[str] = None
    q: Optional[str] = None
    page_token: Optional[str] = None

@router.post("/list")
async def drive_list(req: ListQuery, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = json.loads(account.oauth_token_json)
    try:
        res = list_files(token_dict=token_dict, parent_id=req.parent_id, q=req.q, page_token=req.page_token)
        if res.get("refreshed_token"):
            account.oauth_token_json = json.dumps(res["refreshed_token"])
            db.commit()
        return {"files": res.get("files", []), "next_page_token": res.get("nextPageToken")}
    except Exception as e:
        logger.error(f"[Drive] List failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class CreateFolderPayload(BaseModel):
    account_id: str
    name: str
    parent_id: Optional[str] = None

@router.post("/folder")
async def drive_create_folder(req: CreateFolderPayload, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = json.loads(account.oauth_token_json)
    try:
        res = create_folder(token_dict=token_dict, name=req.name, parent_id=req.parent_id)
        if res.get("refreshed_token"):
            account.oauth_token_json = json.dumps(res["refreshed_token"])
            db.commit()
        return {"id": res["id"], "name": res["name"], "parents": res.get("parents", [])}
    except Exception as e:
        logger.error(f"[Drive] Create folder failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def drive_upload(account_id: str, parent_id: Optional[str] = None, file: UploadFile = None, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    token_dict = json.loads(account.oauth_token_json)
    try:
        res = upload_stream(token_dict=token_dict, upload_file=file, parent_id=parent_id)
        if res.get("refreshed_token"):
            account.oauth_token_json = json.dumps(res["refreshed_token"])
            db.commit()
        return {"id": res["id"], "name": res["name"], "mimeType": res.get("mimeType", ""), "parents": res.get("parents", [])}
    except Exception as e:
        logger.error(f"[Drive] Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{file_id}")
async def drive_download(file_id: str, account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = json.loads(account.oauth_token_json)
    try:
        data = download_file_bytes(token_dict=token_dict, file_id=file_id)
        return StreamingResponse(io.BytesIO(data), media_type="application/octet-stream")
    except Exception as e:
        logger.error(f"[Drive] Download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class DeletePayload(BaseModel):
    account_id: str
    file_id: str

@router.post("/delete")
async def drive_delete(req: DeletePayload, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = json.loads(account.oauth_token_json)
    try:
        res = delete_file(token_dict=token_dict, file_id=req.file_id)
        if res.get("refreshed_token"):
            account.oauth_token_json = json.dumps(res["refreshed_token"])
            db.commit()
        return {"status": "deleted", "id": req.file_id}
    except Exception as e:
        logger.error(f"[Drive] Delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class MovePayload(BaseModel):
    account_id: str
    file_id: str
    target_parent_id: str

@router.post("/move")
async def drive_move(req: MovePayload, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = json.loads(account.oauth_token_json)
    try:
        res = move_file(token_dict=token_dict, file_id=req.file_id, target_parent_id=req.target_parent_id)
        if res.get("refreshed_token"):
            account.oauth_token_json = json.dumps(res["refreshed_token"])
            db.commit()
        return {"id": res["id"], "parents": res.get("parents", [])}
    except Exception as e:
        logger.error(f"[Drive] Move failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── Meta by file_id ───────────────────────────────────────────────────────────
@router.get("/meta/{file_id}")
async def drive_meta(file_id: str, account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = json.loads(account.oauth_token_json)
    try:
        res = get_file_meta(token_dict=token_dict, file_id=file_id)
        if res.get("refreshed_token"):
            account.oauth_token_json = json.dumps(res["refreshed_token"])
            db.commit()
        return res.get("meta", {})
    except Exception as e:
        logger.error(f"[Drive] Meta failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
# ─── Import ke Project Lokal ───────────────────────────────────────────────────

class ImportToVideoProjectPayload(BaseModel):
    account_id: str
    parent_id: str  # Drive folder ID
    project_name: str
    file_ids: Optional[list[str]] = None

@router.post("/import-to-video-project")
async def import_to_video_project(req: ImportToVideoProjectPayload, db: Session = Depends(get_db)):
    base_dir = Path(__file__).resolve().parent.parent.parent
    project_dir = base_dir / "video_projects" / req.project_name.strip()
    raw_dir = project_dir / "raw_videos"
    final_dir = project_dir / "final"
    archive_dir = project_dir / "archive"
    try:
        os.makedirs(raw_dir, exist_ok=True)
        os.makedirs(final_dir, exist_ok=True)
        os.makedirs(archive_dir, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project dirs: {e}")

    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = json.loads(account.oauth_token_json)

    try:
        listing = list_files(token_dict=token_dict, parent_id=req.parent_id)
        files = listing.get("files", [])
        if listing.get("refreshed_token"):
            account.oauth_token_json = json.dumps(listing["refreshed_token"])
            db.commit()
        imported = 0
        skipped = 0
        for f in files:
            mime = f.get("mimeType", "")
            if not mime.startswith("video/"):
                skipped += 1
                continue
            file_id = f.get("id")
            if req.file_ids and file_id not in set(req.file_ids):
                skipped += 1
                continue
            name = f.get("name") or f"{file_id}.mp4"
            try:
                out_path = raw_dir / name
                download_to_path(token_dict=json.loads(account.oauth_token_json), file_id=file_id, output_path=str(out_path))
                imported += 1
            except Exception as de:
                logger.error(f"[Drive Import] Failed {name}: {de}")
                skipped += 1
        return {"status": "ok", "project": req.project_name, "imported": imported, "skipped": skipped}
    except Exception as e:
        logger.error(f"[Drive Import] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ImportToKdpProjectPayload(BaseModel):
    account_id: str
    parent_id: str  # Drive folder ID
    project_name: str
    file_ids: Optional[list[str]] = None

@router.post("/import-to-kdp-project")
async def import_to_kdp_project(req: ImportToKdpProjectPayload, db: Session = Depends(get_db)):
    base_dir = Path(__file__).resolve().parent.parent.parent
    project_dir = base_dir / "projects" / req.project_name.strip()
    raw_dir = project_dir / "raw_images"
    final_dir = project_dir / "final"
    archive_dir = project_dir / "archive"
    try:
        os.makedirs(raw_dir, exist_ok=True)
        os.makedirs(final_dir, exist_ok=True)
        os.makedirs(archive_dir, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project dirs: {e}")

    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = json.loads(account.oauth_token_json)

    try:
        listing = list_files(token_dict=token_dict, parent_id=req.parent_id)
        files = listing.get("files", [])
        if listing.get("refreshed_token"):
            account.oauth_token_json = json.dumps(listing["refreshed_token"])
            db.commit()
        imported = 0
        skipped = 0
        for f in files:
            mime = f.get("mimeType", "")
            if not mime.startswith("image/"):
                skipped += 1
                continue
            file_id = f.get("id")
            if req.file_ids and file_id not in set(req.file_ids):
                skipped += 1
                continue
            name = f.get("name") or f"{file_id}.png"
            try:
                out_path = raw_dir / name
                download_to_path(token_dict=json.loads(account.oauth_token_json), file_id=file_id, output_path=str(out_path))
                imported += 1
            except Exception as de:
                logger.error(f"[Drive Import] Failed {name}: {de}")
                skipped += 1
        return {"status": "ok", "project": req.project_name, "imported": imported, "skipped": skipped}
    except Exception as e:
        logger.error(f"[Drive Import] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
