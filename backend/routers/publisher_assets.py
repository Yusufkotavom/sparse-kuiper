from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Tuple
import json
from pathlib import Path

from backend.core.database import get_db
from backend.core.config import VIDEO_PROJECTS_DIR, PROJECTS_DIR
from backend.models.asset_metadata import AssetMetadata
from backend.routers.publisher_schemas import AssetMetadataRequest, AssetMoveRequest, AssetMetadataBatchRequest


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


def _read_sidecar_metadata(project_type: str, file: str) -> Dict[str, str] | None:
    if project_type == "video":
        base = VIDEO_PROJECTS_DIR
    elif project_type == "kdp":
        base = PROJECTS_DIR
    else:
        return None

    full_path = base / file
    parent = full_path.parent
    sidecar_path = parent / f"{full_path.stem}.meta.json"
    if sidecar_path.exists():
        try:
            with open(sidecar_path, "r", encoding="utf-8") as sf:
                data = json.load(sf)
            return {
                "title": data.get("title", "") or "",
                "description": data.get("description", "") or "",
                "tags": data.get("tags", "") or "",
            }
        except Exception:
            return None

    info_path = parent / f"{full_path.stem}.info.json"
    if info_path.exists():
        try:
            with open(info_path, "r", encoding="utf-8") as jf:
                data = json.load(jf)
            raw_tags = data.get("tags", []) or []
            raw_cats = data.get("categories", []) or []
            combined = list(dict.fromkeys(raw_tags + raw_cats))
            tags_str = " ".join(f"#{str(t).replace(' ', '')}" for t in combined[:10])
            return {
                "title": data.get("title", "") or "",
                "description": (data.get("description") or "").strip()[:500],
                "tags": tags_str,
            }
        except Exception:
            return None

    return None


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


@router.post("/assets/metadata/batch")
async def get_asset_metadata_batch(req: AssetMetadataBatchRequest, db: Session = Depends(get_db)):
    parsed: List[Tuple[str, str, str, str]] = []
    for f in req.files:
        project_name, canonical_dir, filename = _parse_asset_path(req.project_type, f)
        parsed.append((f, project_name, canonical_dir, filename))

    by_project: Dict[str, List[Tuple[str, str, str]]] = {}
    for f, project_name, canonical_dir, filename in parsed:
        by_project.setdefault(project_name, []).append((f, canonical_dir, filename))

    exact_rows: Dict[Tuple[str, str, str], AssetMetadata] = {}
    any_rows: Dict[Tuple[str, str], AssetMetadata] = {}
    for project_name, entries in by_project.items():
        filenames = list({filename for _, _, filename in entries})
        if not filenames:
            continue
        rows = (
            db.query(AssetMetadata)
            .filter(
                AssetMetadata.project_type == req.project_type,
                AssetMetadata.project_name == project_name,
                AssetMetadata.filename.in_(filenames),
            )
            .all()
        )
        for r in rows:
            any_rows[(r.project_name, r.filename)] = r
            exact_rows[(r.project_name, r.canonical_dir or "", r.filename)] = r

    touched: List[AssetMetadata] = []
    items: List[Dict[str, Any]] = []
    for f, project_name, canonical_dir, filename in parsed:
        row = exact_rows.get((project_name, canonical_dir, filename))
        if row:
            items.append({
                "file": f,
                "title": row.title or "",
                "description": row.description or "",
                "tags": row.tags or "",
                "source": "db",
            })
            continue

        alt = any_rows.get((project_name, filename))
        if alt:
            if (alt.canonical_dir or "") != canonical_dir:
                alt.canonical_dir = canonical_dir
                touched.append(alt)
            items.append({
                "file": f,
                "title": alt.title or "",
                "description": alt.description or "",
                "tags": alt.tags or "",
                "source": "db",
            })
            continue

        if req.include_sidecar:
            sidecar = _read_sidecar_metadata(req.project_type, f)
            if sidecar is not None:
                items.append({ "file": f, **sidecar, "source": "sidecar" })
                continue

        items.append({
            "file": f,
            "title": "",
            "description": "",
            "tags": "",
            "source": "none",
        })

    if touched:
        db.commit()

    return {"items": items}


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
