from fastapi import APIRouter, HTTPException, Depends, UploadFile
from typing import Optional
import json
import io
import os
from pathlib import Path
from backend.core.database import get_db
from backend.core.json_utils import ensure_json_dict
from backend.core.realtime import publish_realtime_event
from sqlalchemy.orm import Session
from backend.models.account import Account
from backend.core.logger import logger
from backend.core.config import VIDEO_PROJECTS_DIR, PROJECTS_DIR
from backend.routers.drive_schemas import (
    ListQuery,
    CreateFolderPayload,
    DeletePayload,
    MovePayload,
    ImportToVideoProjectPayload,
    ImportToKdpProjectPayload,
)
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


def _refresh_account_tokens(db: Session, account: Account, token_dict: dict):
    account.oauth_token_json = token_dict
    publish_realtime_event(
        db,
        stream="accounts",
        event_type="token_refreshed",
        entity_table="accounts",
        entity_id=account.id,
        payload=account.to_dict(mask_secret=True),
    )
    db.commit()

@router.post("/list")
async def drive_list(req: ListQuery, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = ensure_json_dict(account.oauth_token_json)
    try:
        res = list_files(token_dict=token_dict, parent_id=req.parent_id, q=req.q, page_token=req.page_token)
        if res.get("refreshed_token"):
            _refresh_account_tokens(db, account, res["refreshed_token"])
        return {"files": res.get("files", []), "next_page_token": res.get("nextPageToken")}
    except Exception as e:
        logger.error(f"[Drive] List failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/folder")
async def drive_create_folder(req: CreateFolderPayload, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = ensure_json_dict(account.oauth_token_json)
    try:
        res = create_folder(token_dict=token_dict, name=req.name, parent_id=req.parent_id)
        if res.get("refreshed_token"):
            _refresh_account_tokens(db, account, res["refreshed_token"])
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
    token_dict = ensure_json_dict(account.oauth_token_json)
    try:
        res = upload_stream(token_dict=token_dict, upload_file=file, parent_id=parent_id)
        if res.get("refreshed_token"):
            _refresh_account_tokens(db, account, res["refreshed_token"])
        return {"id": res["id"], "name": res["name"], "mimeType": res.get("mimeType", ""), "parents": res.get("parents", [])}
    except Exception as e:
        logger.error(f"[Drive] Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{file_id}")
async def drive_download(file_id: str, account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = ensure_json_dict(account.oauth_token_json)
    try:
        data = download_file_bytes(token_dict=token_dict, file_id=file_id)
        return StreamingResponse(io.BytesIO(data), media_type="application/octet-stream")
    except Exception as e:
        logger.error(f"[Drive] Download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete")
async def drive_delete(req: DeletePayload, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = ensure_json_dict(account.oauth_token_json)
    try:
        res = delete_file(token_dict=token_dict, file_id=req.file_id)
        if res.get("refreshed_token"):
            _refresh_account_tokens(db, account, res["refreshed_token"])
        return {"status": "deleted", "id": req.file_id}
    except Exception as e:
        logger.error(f"[Drive] Delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/move")
async def drive_move(req: MovePayload, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == req.account_id).first()
    if not account or not account.oauth_token_json:
        raise HTTPException(status_code=400, detail="Drive account not connected.")
    token_dict = ensure_json_dict(account.oauth_token_json)
    try:
        res = move_file(token_dict=token_dict, file_id=req.file_id, target_parent_id=req.target_parent_id)
        if res.get("refreshed_token"):
            _refresh_account_tokens(db, account, res["refreshed_token"])
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
    token_dict = ensure_json_dict(account.oauth_token_json)
    try:
        res = get_file_meta(token_dict=token_dict, file_id=file_id)
        if res.get("refreshed_token"):
            _refresh_account_tokens(db, account, res["refreshed_token"])
        return res.get("meta", {})
    except Exception as e:
        logger.error(f"[Drive] Meta failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
# ─── Import ke Project Lokal ───────────────────────────────────────────────────

@router.post("/import-to-video-project")
async def import_to_video_project(req: ImportToVideoProjectPayload, db: Session = Depends(get_db)):
    project_dir = VIDEO_PROJECTS_DIR / req.project_name.strip()
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
    token_dict = ensure_json_dict(account.oauth_token_json)

    try:
        listing = list_files(token_dict=token_dict, parent_id=req.parent_id)
        files = listing.get("files", [])
        if listing.get("refreshed_token"):
            _refresh_account_tokens(db, account, listing["refreshed_token"])
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
                download_to_path(token_dict=ensure_json_dict(account.oauth_token_json), file_id=file_id, output_path=str(out_path))
                imported += 1
            except Exception as de:
                logger.error(f"[Drive Import] Failed {name}: {de}")
                skipped += 1
        return {"status": "ok", "project": req.project_name, "imported": imported, "skipped": skipped}
    except Exception as e:
        logger.error(f"[Drive Import] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import-to-kdp-project")
async def import_to_kdp_project(req: ImportToKdpProjectPayload, db: Session = Depends(get_db)):
    project_dir = PROJECTS_DIR / req.project_name.strip()
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
    token_dict = ensure_json_dict(account.oauth_token_json)

    try:
        listing = list_files(token_dict=token_dict, parent_id=req.parent_id)
        files = listing.get("files", [])
        if listing.get("refreshed_token"):
            _refresh_account_tokens(db, account, listing["refreshed_token"])
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
                download_to_path(token_dict=ensure_json_dict(account.oauth_token_json), file_id=file_id, output_path=str(out_path))
                imported += 1
            except Exception as de:
                logger.error(f"[Drive Import] Failed {name}: {de}")
                skipped += 1
        return {"status": "ok", "project": req.project_name, "imported": imported, "skipped": skipped}
    except Exception as e:
        logger.error(f"[Drive Import] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
