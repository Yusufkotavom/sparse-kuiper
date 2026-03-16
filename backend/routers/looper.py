"""
routers/looper.py
=================
FastAPI router for looper jobs.

Endpoints:
  POST /api/v1/looper/run           → start a new looper job
  GET  /api/v1/looper/status/{id}   → poll job status
  POST /api/v1/looper/cancel/{id}   → request job cancellation
  GET  /api/v1/looper/file-info     → ffprobe metadata for a project file
"""

from __future__ import annotations

import re
from uuid import uuid4
from pathlib import Path, PurePosixPath
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from backend.core.config import VIDEO_PROJECTS_DIR
from backend.core.logger import logger
from backend.services.looper_worker import (
    JOBS,
    create_job,
    get_file_info,
    get_job,
    run_looper_job,
)

router = APIRouter(prefix="/api/v1/looper", tags=["looper"])


# ─── Request / Response Models ────────────────────────────────────────────────

def _normalize_project_file(project: str, file_value: str) -> str:
    raw = (file_value or "").strip().replace("\\", "/")
    if not raw:
        raise HTTPException(status_code=400, detail="Parameter file tidak boleh kosong.")

    marker = "/video_projects/"
    lower_raw = raw.lower()
    marker_idx = lower_raw.find(marker)
    if marker_idx >= 0:
        raw = raw[marker_idx + len(marker):]

    raw = raw.lstrip("/")
    project_clean = project.strip().strip("/\\")
    project_prefix = f"{project_clean}/".lower() if project_clean else ""
    if project_prefix and raw.lower().startswith(project_prefix):
        raw = raw[len(project_clean) + 1:]

    normalized_parts = [part for part in PurePosixPath(raw).parts if part not in ("", ".")]
    if not normalized_parts:
        raise HTTPException(status_code=400, detail="Format path file tidak valid.")
    if any(part == ".." for part in normalized_parts):
        raise HTTPException(status_code=400, detail="Path traversal tidak diizinkan.")

    return "/".join(normalized_parts)

class LooperRunRequest(BaseModel):
    project: str
    file: str                        # relative path within project, e.g. "raw/clip.mp4"
    custom_audio_file: Optional[str] = None
    output_suffix: str = "_loop"

    # Preset / config params
    mode: str = "manual"             # manual | target | audio
    default_loops: int = 3
    target_duration: float = 15.0
    cut_start: float = 3.0
    disable_crossfade: bool = False
    crossfade_duration: float = 1.5
    quality: str = "high"
    resolution: str = "original"
    mute_original_audio: bool = False
    enable_audio_fade: bool = True
    audio_fade_duration: float = 2.0

    enable_looper: Optional[bool] = True
    enable_scene_mixer: Optional[bool] = False
    scene_mixer_source: Optional[str] = "original"
    scene_mixer_selected_files: Optional[List[str]] = None
    scene_mixer_clip_count: Optional[int] = 10
    scene_mixer_order: Optional[str] = "random"
    scene_mixer_full_duration: Optional[bool] = False
    scene_mixer_max_duration: Optional[float] = 5.0
    effect_zoom_crop: Optional[bool] = False
    effect_zoom_mode: Optional[str] = "random"
    effect_zoom_percent: Optional[float] = 90.0
    effect_mirror: Optional[bool] = False
    effect_speed_ramping: Optional[bool] = False
    effect_color_tweaking: Optional[bool] = False
    effect_film_grain: Optional[bool] = False
    effect_pulsing_vignette: Optional[bool] = False
    transition_type: Optional[str] = "none"
    watermark_url: Optional[str] = None
    watermark_scale: Optional[int] = 50
    watermark_opacity: Optional[int] = 100
    watermark_position: Optional[str] = "bottom_right"
    watermark_margin_x: Optional[int] = 24
    watermark_margin_y: Optional[int] = 24
    watermark_key_black: Optional[bool] = False
    watermark_key_green: Optional[bool] = False


class LooperRunResponse(BaseModel):
    job_id: str
    message: str


class LooperStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    stage: int
    stage_label: str
    output_path: Optional[str] = None
    error: Optional[str] = None
    finished_at: Optional[float] = None


class LooperWatermarkUploadResponse(BaseModel):
    relative_path: str
    static_url: str
    filename: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/run", response_model=LooperRunResponse)
async def looper_run(req: LooperRunRequest, background_tasks: BackgroundTasks):
    """
    Start a new looper job asynchronously.
    Returns job_id immediately; poll /status/{job_id} for progress.
    """
    normalized_file = _normalize_project_file(req.project, req.file)

    # Resolve input path
    project_dir = VIDEO_PROJECTS_DIR / req.project
    input_path  = project_dir / Path(normalized_file)
    custom_audio_path: Optional[Path] = None
    watermark_source: Optional[str] = None
    scene_mixer_selected_paths: Optional[List[str]] = None

    if not input_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"File tidak ditemukan: {req.project}/{normalized_file}",
        )
    if req.custom_audio_file:
        normalized_audio = _normalize_project_file(req.project, req.custom_audio_file)
        custom_audio_path = project_dir / Path(normalized_audio)
        if not custom_audio_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Audio tidak ditemukan: {req.project}/{normalized_audio}",
            )
    if req.watermark_url:
        raw_watermark = req.watermark_url.strip()
        if raw_watermark:
            if raw_watermark.startswith(("http://", "https://")):
                watermark_source = raw_watermark
            else:
                static_prefix = "/api/v1/video_projects_static/"
                if raw_watermark.startswith(static_prefix):
                    raw_watermark = raw_watermark[len(static_prefix):]
                elif raw_watermark.startswith("api/v1/video_projects_static/"):
                    raw_watermark = raw_watermark[len("api/v1/video_projects_static/"):]
                elif raw_watermark.startswith("video_projects_static/"):
                    raw_watermark = raw_watermark[len("video_projects_static/"):]

                normalized_watermark = _normalize_project_file(req.project, raw_watermark)
                watermark_path = project_dir / Path(normalized_watermark)
                if not watermark_path.exists():
                    raise HTTPException(
                        status_code=404,
                        detail=f"Watermark tidak ditemukan: {req.project}/{normalized_watermark}",
                    )
                watermark_source = str(watermark_path)

    mixer_source = (req.scene_mixer_source or "original").strip().lower()
    if bool(req.enable_scene_mixer) and mixer_source == "selected":
        raw_items = req.scene_mixer_selected_files or []
        if not isinstance(raw_items, list):
            raise HTTPException(status_code=400, detail="scene_mixer_selected_files harus berupa list.")

        seen = set()
        resolved: List[str] = []

        def _add(p: Path):
            key = str(p.resolve())
            if key in seen:
                return
            seen.add(key)
            resolved.append(str(p))

        _add(input_path)
        for item in raw_items:
            if not item:
                continue
            normalized_item = _normalize_project_file(req.project, str(item))
            candidate = project_dir / Path(normalized_item)
            if not candidate.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Scene mixer file tidak ditemukan: {req.project}/{normalized_item}",
                )
            _add(candidate)
            if len(resolved) >= 24:
                break

        if len(resolved) <= 1:
            scene_mixer_selected_paths = None
        else:
            scene_mixer_selected_paths = resolved

    # Create job entry
    job = create_job()
    unique_token = job.job_id.split("-")[0]

    # Resolve output path — always unique per process in project's "final" subfolder
    stem         = input_path.stem
    output_dir   = project_dir / "final"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path  = output_dir / f"{stem}{req.output_suffix}_{unique_token}.mp4"

    logger.info(f"[Looper] New job {job.job_id}: {req.project}/{normalized_file} → {output_path.name}")

    # Run in a thread pool executor so FFmpeg doesn't block the event loop
    def _run():
        run_looper_job(
            job=job,
            input_path=str(input_path),
            output_path=str(output_path),
            mode=req.mode,
            default_loops=req.default_loops,
            target_duration=req.target_duration,
            cut_start=req.cut_start,
            disable_crossfade=req.disable_crossfade,
            crossfade_duration=req.crossfade_duration,
            quality=req.quality,
            resolution=req.resolution,
            mute_original_audio=req.mute_original_audio,
            enable_audio_fade=req.enable_audio_fade,
            audio_fade_duration=req.audio_fade_duration,
            custom_audio_path=str(custom_audio_path) if custom_audio_path else None,
            enable_looper=bool(req.enable_looper),
            enable_scene_mixer=bool(req.enable_scene_mixer),
            scene_mixer_source=(req.scene_mixer_source or "original"),
            scene_mixer_selected_paths=scene_mixer_selected_paths,
            scene_mixer_clip_count=int(req.scene_mixer_clip_count or 10),
            scene_mixer_order=(req.scene_mixer_order or "random"),
            scene_mixer_full_duration=bool(req.scene_mixer_full_duration),
            scene_mixer_max_duration=float(req.scene_mixer_max_duration or 5.0),
            effect_zoom_crop=bool(req.effect_zoom_crop),
            effect_zoom_mode=(req.effect_zoom_mode or "random"),
            effect_zoom_percent=float(req.effect_zoom_percent if req.effect_zoom_percent is not None else 90.0),
            effect_mirror=bool(req.effect_mirror),
            effect_speed_ramping=bool(req.effect_speed_ramping),
            effect_color_tweaking=bool(req.effect_color_tweaking),
            effect_film_grain=bool(req.effect_film_grain),
            effect_pulsing_vignette=bool(req.effect_pulsing_vignette),
            transition_type=(req.transition_type or "none"),
            watermark_source=watermark_source,
            watermark_scale=int(req.watermark_scale if req.watermark_scale is not None else 50),
            watermark_opacity=int(req.watermark_opacity if req.watermark_opacity is not None else 100),
            watermark_position=(req.watermark_position or "bottom_right"),
            watermark_margin_x=int(req.watermark_margin_x if req.watermark_margin_x is not None else 24),
            watermark_margin_y=int(req.watermark_margin_y if req.watermark_margin_y is not None else 24),
            watermark_key_black=bool(req.watermark_key_black),
            watermark_key_green=bool(req.watermark_key_green),
        )

    async def _run_async():
        import asyncio as _asyncio
        loop = _asyncio.get_running_loop()
        await loop.run_in_executor(None, _run)

    background_tasks.add_task(_run_async)

    return LooperRunResponse(
        job_id=job.job_id,
        message=f"Job dimulai. Poll /api/v1/looper/status/{job.job_id} untuk progress.",
    )


@router.get("/status/{job_id}", response_model=LooperStatusResponse)
async def looper_status(job_id: str):
    """Poll the status of a running or completed looper job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job tidak ditemukan: {job_id}")

    return LooperStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        stage=job.stage,
        stage_label=job.stage_label,
        output_path=job.output_path,
        error=job.error,
        finished_at=job.finished_at,
    )


@router.post("/cancel/{job_id}")
async def looper_cancel(job_id: str):
    """Request cancellation of a running job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job tidak ditemukan: {job_id}")

    if job.status not in ("pending", "running"):
        return {"message": f"Job sudah dalam status {job.status}, tidak bisa dibatalkan."}

    job.cancel_requested = True
    logger.info(f"[Looper] Cancel requested for job {job_id}")
    return {"message": "Permintaan pembatalan dikirim."}


@router.get("/file-info")
async def looper_file_info(
    project: str = Query(..., description="Nama project video"),
    file: str    = Query(..., description="Relative path dalam project, contoh: raw/clip.mp4"),
):
    """
    Return ffprobe metadata for a project file.
    Used by the frontend preview panel to show duration, resolution, fps, size.
    """
    normalized_file = _normalize_project_file(project, file)
    input_path = VIDEO_PROJECTS_DIR / project / Path(normalized_file)

    if not input_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"File tidak ditemukan: {project}/{normalized_file}",
        )

    info = get_file_info(str(input_path))
    if not info:
        raise HTTPException(
            status_code=500,
            detail="Gagal membaca metadata file. Pastikan ffprobe tersedia.",
        )

    return info


@router.post("/watermark/upload", response_model=LooperWatermarkUploadResponse)
async def looper_upload_watermark(
    project: str = Query(..., description="Nama project video"),
    file: UploadFile = File(...),
):
    project_name = project.strip()
    if not project_name:
        raise HTTPException(status_code=400, detail="Parameter project tidak boleh kosong.")

    project_dir = VIDEO_PROJECTS_DIR / project_name
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project tidak ditemukan: {project_name}")

    incoming_name = Path((file.filename or "")).name
    if not incoming_name:
        raise HTTPException(status_code=400, detail="Nama file watermark tidak valid.")

    ext = Path(incoming_name).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"}:
        raise HTTPException(
            status_code=400,
            detail="Format watermark harus PNG/JPG/JPEG/WEBP/MP4/MOV/WEBM/MKV/AVI/M4V.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File watermark kosong.")

    watermark_dir = project_dir / "watermarks"
    watermark_dir.mkdir(parents=True, exist_ok=True)

    stem = re.sub(r"[^a-zA-Z0-9_-]+", "_", Path(incoming_name).stem).strip("_") or "watermark"
    filename = f"{stem}_{uuid4().hex[:8]}{ext}"
    target_path = watermark_dir / filename

    with open(target_path, "wb") as wf:
        wf.write(content)

    relative_path = str(target_path.relative_to(project_dir)).replace("\\", "/")
    static_path = f"{project_name}/{relative_path}".replace("\\", "/")
    logger.info(f"[Looper] Watermark uploaded: {project_name}/{relative_path}")

    return LooperWatermarkUploadResponse(
        relative_path=relative_path,
        static_url=f"/api/v1/video_projects_static/{static_path}",
        filename=filename,
    )
