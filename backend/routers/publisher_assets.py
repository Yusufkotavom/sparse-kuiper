from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.models.asset_metadata import AssetMetadata
from backend.routers.publisher_schemas import AssetMetadataRequest, AssetMoveRequest


router = APIRouter()


def _parse_asset_path(project_type: str, file: str):
    parts = file.replace("\\", "/").split("/")
    if len(parts) == 0:
        raise HTTPException(status_code=400, detail="Invalid file path")
    project_name = parts[0]
    filename = parts[-1]
    canonical_dir = ""
    if "queue" in parts:
        idx = parts.index("queue")
        if idx > 0:
            canonical_dir = parts[idx - 1]
    else:
        if len(parts) > 1:
            canonical_dir = parts[1]
    return project_name, canonical_dir, filename


@router.get("/assets/metadata")
async def get_asset_metadata(project_type: str, file: str, db: Session = Depends(get_db)):
    project_name, canonical_dir, filename = _parse_asset_path(project_type, file)
    row = (
        db.query(AssetMetadata)
        .filter(
            AssetMetadata.project_type == project_type,
            AssetMetadata.project_name == project_name,
            AssetMetadata.canonical_dir == canonical_dir,
            AssetMetadata.filename == filename,
        ).first()
    )
    if not row:
        alt = (
            db.query(AssetMetadata)
            .filter(
                AssetMetadata.project_type == project_type,
                AssetMetadata.project_name == project_name,
                AssetMetadata.filename == filename,
            ).first()
        )
        if alt:
            alt.canonical_dir = canonical_dir
            db.commit()
            row = alt
        else:
            raise HTTPException(status_code=404, detail="Metadata not found")
    return {"title": row.title or "", "description": row.description or "", "tags": row.tags or ""}


@router.post("/assets/metadata")
async def upsert_asset_metadata(req: AssetMetadataRequest, db: Session = Depends(get_db)):
    project_name, canonical_dir, filename = _parse_asset_path(req.project_type, req.file)
    row = (
        db.query(AssetMetadata)
        .filter(
            AssetMetadata.project_type == req.project_type,
            AssetMetadata.project_name == project_name,
            AssetMetadata.canonical_dir == canonical_dir,
            AssetMetadata.filename == filename,
        ).first()
    )
    if not row:
        row = AssetMetadata(
            project_type=req.project_type,
            project_name=project_name,
            canonical_dir=canonical_dir,
            filename=filename,
        )
        db.add(row)
    row.title = req.title
    row.description = req.description
    row.tags = req.tags
    db.commit()
    return {"status": "ok"}


@router.post("/assets/move")
async def move_asset_metadata(req: AssetMoveRequest, db: Session = Depends(get_db)):
    old_proj, old_dir, old_name = _parse_asset_path(req.project_type, req.old_file)
    new_proj, new_dir, new_name = _parse_asset_path(req.project_type, req.new_file)
    row = (
        db.query(AssetMetadata)
        .filter(
            AssetMetadata.project_type == req.project_type,
            AssetMetadata.project_name == old_proj,
            AssetMetadata.canonical_dir == old_dir,
            AssetMetadata.filename == old_name,
        ).first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Metadata not found for old path")
    row.project_name = new_proj
    row.canonical_dir = new_dir
    row.filename = new_name
    db.commit()
    return {"status": "ok"}

