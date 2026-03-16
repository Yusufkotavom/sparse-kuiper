from fastapi import APIRouter, HTTPException, Depends, UploadFile
from pydantic import BaseModel
from typing import Optional
import json
import io
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
