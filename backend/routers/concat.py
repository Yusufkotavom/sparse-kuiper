"""
routers/concat.py
=================
FastAPI router for video concatenation jobs.

Endpoints:
  POST /api/v1/concat/run           → start a new concat job
  GET  /api/v1/concat/status/{id}   → poll job status
  POST /api/v1/concat/cancel/{id}   → request job cancellation
  GET  /api/v1/concat/file-info     → ffprobe metadata for a project file
"""

from __future__ import annotations

from pathlib import Path, PurePosixPath
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from backend.core.config import VIDEO_PROJECTS_DIR
from backend.core.logger import logger
from backend.routers.concat_schemas import (
    ConcatRunRequest,
    ConcatRunResponse,
    ConcatStatusResponse,
)
from backend.services.concat_worker import (
    create_job,
    get_file_info,
    get_job,
    run_concat_job,
)

router = APIRouter(prefix="/api/v1/concat", tags=["concat"])


# ─── Helper Functions ─────────────────────────────────────────────────────────

def _normalize_project_file(project: str, file_value: str) -> str:
    """
    Normalize and validate project file path.
    
    Security validations:
    - Prevents path traversal attacks
    - Ensures file is within project directory
    - Validates path format
    
    Validates: Requirements 11.10
    """
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


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/run", response_model=ConcatRunResponse)
async def concat_run(req: ConcatRunRequest, background_tasks: BackgroundTasks):
    """
    Start a new concat job asynchronously.
    Returns job_id immediately; poll /status/{job_id} for progress.
    
    Validates: Requirements 4.1, 4.3, 4.4
    """
    # Validate and normalize input file paths
    project_dir = VIDEO_PROJECTS_DIR / req.project
    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project tidak ditemukan: {req.project}",
        )

    input_paths: List[str] = []
    for file_path in req.files:
        normalized_file = _normalize_project_file(req.project, file_path)
        full_path = project_dir / Path(normalized_file)
        
        if not full_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"File tidak ditemukan: {req.project}/{normalized_file}",
            )
        
        input_paths.append(str(full_path))

    # Validate background music if specified
    background_music_path: Optional[str] = None
    if req.background_music_file:
        normalized_music = _normalize_project_file(req.project, req.background_music_file)
        music_path = project_dir / Path(normalized_music)
        if not music_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Background music tidak ditemukan: {req.project}/{normalized_music}",
            )
        background_music_path = str(music_path)

    # Process trim settings to use absolute paths as keys
    trim_settings_absolute = None
    if req.trim_settings:
        trim_settings_absolute = {}
        for file_path, trim_point in req.trim_settings.items():
            normalized_file = _normalize_project_file(req.project, file_path)
            full_path = project_dir / Path(normalized_file)
            trim_settings_absolute[str(full_path)] = {
                "start": trim_point.start,
                "end": trim_point.end,
            }

    # Create job entry
    job = create_job()
    unique_token = job.job_id.split("-")[0]

    # Resolve output path — always unique per process in project's "final" subfolder
    output_dir = project_dir / "final"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"concat{req.output_suffix}_{unique_token}.mp4"

    logger.info(f"[Concat] New job {job.job_id}: {len(input_paths)} files → {output_path.name}")

    # Run in a thread pool executor so FFmpeg doesn't block the event loop
    def _run():
        run_concat_job(
            job=job,
            input_paths=input_paths,
            output_path=str(output_path),
            trim_settings=trim_settings_absolute,
            transition_type=req.transition_type,
            transition_duration=req.transition_duration,
            resolution=req.resolution,
            quality=req.quality,
            mute_original_audio=req.mute_original_audio,
            enable_audio_fade=req.enable_audio_fade,
            audio_fade_duration=req.audio_fade_duration,
            background_music_path=background_music_path,
            background_music_volume=req.background_music_volume,
        )

    async def _run_async():
        import asyncio as _asyncio
        loop = _asyncio.get_running_loop()
        await loop.run_in_executor(None, _run)

    background_tasks.add_task(_run_async)

    return ConcatRunResponse(
        job_id=job.job_id,
        message=f"Job dimulai. Poll /api/v1/concat/status/{job.job_id} untuk progress.",
    )


@router.get("/status/{job_id}", response_model=ConcatStatusResponse)
async def concat_status(job_id: str):
    """
    Poll the status of a running or completed concat job.
    
    Validates: Requirements 4.3, 4.4
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job tidak ditemukan: {job_id}")

    return ConcatStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        stage=job.stage,
        stage_label=job.stage_label,
        current_video=job.current_video,
        output_path=job.output_path,
        error=job.error,
        finished_at=job.finished_at,
    )


@router.post("/cancel/{job_id}")
async def concat_cancel(job_id: str):
    """
    Request cancellation of a running job.
    
    Validates: Requirements 4.8
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job tidak ditemukan: {job_id}")

    if job.status not in ("pending", "running"):
        return {"message": f"Job sudah dalam status {job.status}, tidak bisa dibatalkan."}

    job.cancel_requested = True
    logger.info(f"[Concat] Cancel requested for job {job_id}")
    return {"message": "Permintaan pembatalan dikirim."}


@router.get("/file-info")
async def concat_file_info(
    project: str = Query(..., description="Nama project video"),
    file: str = Query(..., description="Relative path dalam project, contoh: raw/clip.mp4"),
):
    """
    Return ffprobe metadata for a project file.
    Used by the frontend preview panel to show duration, resolution, fps, size.
    
    Validates: Requirements 11.10
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
