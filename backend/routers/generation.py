"""Polling-friendly generation APIs for image/video tasks (Replicate provider)."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.models.generation_task import GenerationTask
from backend.services.generation_service import create_generation_task, run_generation_task

router = APIRouter(prefix="/api/v1/generation", tags=["generation"])


class GenerationCreateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    provider: str = Field(default="replicate")
    model_version: Optional[str] = None
    input: Dict[str, Any] = Field(default_factory=dict)


class GenerationCreateResponse(BaseModel):
    task_id: str
    status: str
    message: str


class GenerationTaskResponse(BaseModel):
    id: str
    task_type: str
    provider: str
    status: str
    prompt: str
    provider_task_id: Optional[str] = None
    result_url: Optional[str] = None
    error: Optional[str] = None
    poll_count: int = 0
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


class GenerationTaskDetailResponse(GenerationTaskResponse):
    input: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None


def _task_to_response(task: GenerationTask, include_payload: bool = False):
    base = {
        "id": task.id,
        "task_type": task.task_type,
        "provider": task.provider,
        "status": task.status,
        "prompt": task.prompt,
        "provider_task_id": task.provider_task_id,
        "result_url": task.result_url,
        "error": task.error,
        "poll_count": task.poll_count or 0,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "finished_at": task.finished_at.isoformat() if task.finished_at else None,
    }
    if not include_payload:
        return GenerationTaskResponse(**base)

    inp = {}
    res = None
    try:
        inp = json.loads(task.input_json or "{}")
    except Exception:
        inp = {}
    try:
        res = json.loads(task.result_json) if task.result_json else None
    except Exception:
        res = None

    return GenerationTaskDetailResponse(**base, input=inp, result=res)


@router.post("/image", response_model=GenerationCreateResponse)
def create_image_generation(req: GenerationCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    payload = dict(req.input or {})
    if req.model_version:
        payload["model_version"] = req.model_version
    payload["prompt"] = req.prompt

    task = create_generation_task(
        db=db,
        task_type="image",
        provider=req.provider,
        prompt=req.prompt,
        input_payload=payload,
    )
    background_tasks.add_task(run_generation_task, task.id)
    return GenerationCreateResponse(task_id=task.id, status=task.status, message=f"Task created. Poll /api/v1/generation/tasks/{task.id}")


@router.post("/video", response_model=GenerationCreateResponse)
def create_video_generation(req: GenerationCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    payload = dict(req.input or {})
    if req.model_version:
        payload["model_version"] = req.model_version
    payload["prompt"] = req.prompt

    task = create_generation_task(
        db=db,
        task_type="video",
        provider=req.provider,
        prompt=req.prompt,
        input_payload=payload,
    )
    background_tasks.add_task(run_generation_task, task.id)
    return GenerationCreateResponse(task_id=task.id, status=task.status, message=f"Task created. Poll /api/v1/generation/tasks/{task.id}")


@router.get("/tasks/{task_id}", response_model=GenerationTaskDetailResponse)
def get_generation_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_to_response(task, include_payload=True)


@router.get("/tasks", response_model=List[GenerationTaskResponse])
def list_generation_tasks(
    status: Optional[str] = Query(default=None),
    task_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(GenerationTask)
    if status:
        q = q.filter(GenerationTask.status == status)
    if task_type:
        q = q.filter(GenerationTask.task_type == task_type)

    rows = q.order_by(GenerationTask.created_at.desc()).limit(limit).all()
    return [_task_to_response(row, include_payload=False) for row in rows]


@router.post("/tasks/{task_id}/cancel", response_model=GenerationTaskResponse)
def cancel_generation_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status in {"succeeded", "failed", "canceled"}:
        return _task_to_response(task, include_payload=False)
    task.status = "canceled"
    db.commit()
    db.refresh(task)
    return _task_to_response(task, include_payload=False)
