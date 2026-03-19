from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from backend.core.database import get_db
from backend.models.upload_queue import UploadQueueItem
from backend.routers.publisher_schemas import UploadRequest, TagsRequest, RescheduleRequest
from backend.routers.publisher_queue import sync_queue_job_state
from backend.routers.publisher_uploads import process_upload_task


router = APIRouter()


def _build_upload_request_for_platform(item: UploadQueueItem, platform: str, run_now: bool = False) -> UploadRequest:
    opts = item.options or {}
    publish_schedule = opts.get("platform_publish_schedule", "") or ""
    return UploadRequest(
        title=item.title or "",
        description=item.description or "",
        tags=item.tags or "",
        platforms=[platform],
        account_id=(item.account_map or {}).get(platform, ""),
        schedule=publish_schedule,
        product_id=opts.get("product_id", ""),
        youtube_privacy=opts.get("youtube_privacy", "private"),
        youtube_category_id=opts.get("youtube_category_id", "22"),
        open_browser=bool(opts.get("open_browser", False)),
        pw_debug=bool(opts.get("pw_debug", False)),
    )


@router.get("/jobs")
async def list_jobs(
    status: str = "",
    tag: str = "",
    platform: str = "",
    account_id: str = "",
    campaign: str = "",
    date_from: str = "",
    date_to: str = "",
    db: Session = Depends(get_db),
):
    q = db.query(UploadQueueItem).filter(UploadQueueItem.status != "archived")
    if status:
        q = q.filter(UploadQueueItem.worker_state == status)
    items = q.all()

    def _is_active_job(it: UploadQueueItem) -> bool:
        if (it.target_platforms or []):
            return True
        if (it.account_map or {}):
            return True
        if (it.options or {}):
            return True
        if it.scheduled_at is not None:
            return True
        if (it.job_tags or []):
            return True
        if (it.platforms or {}):
            return True
        if (it.attempt_count or 0) > 0:
            return True
        state = (it.worker_state or "").strip().lower()
        if state and state != "pending":
            return True
        return False

    items = [it for it in items if _is_active_job(it)]

    def _has_tag(it: UploadQueueItem, t: str) -> bool:
        try:
            return t and (t in (it.job_tags or []))
        except Exception:
            return False

    if tag:
        items = [it for it in items if _has_tag(it, tag)]
    if platform:
        items = [it for it in items if platform in (it.target_platforms or [])]
    if account_id:
        items = [it for it in items if (it.account_map or {}).get(platform or "", "") == account_id or account_id in (it.account_map or {}).values()]
    if campaign:
        items = [it for it in items if (it.options or {}).get("campaign_id", "") == campaign]
    if date_from or date_to:
        try:
            from_dt = datetime.fromisoformat(date_from) if date_from else None
            to_dt = datetime.fromisoformat(date_to) if date_to else None
        except Exception:
            from_dt = to_dt = None
        if from_dt or to_dt:
            def _in_range(it: UploadQueueItem) -> bool:
                if not it.scheduled_at:
                    return False
                t = it.scheduled_at
                if from_dt and t < from_dt:
                    return False
                if to_dt and t > to_dt:
                    return False
                return True
            items = [it for it in items if _in_range(it)]
    return {"jobs": [it.to_dict() for it in items]}


@router.post("/jobs/run-now/{filename}")
async def jobs_run_now(filename: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    plats = item.target_platforms or []
    if not plats:
        raise HTTPException(status_code=400, detail="No target platforms configured for this job")
    item.worker_state = "running"
    item.last_run_at = datetime.now()
    item.attempt_count = (item.attempt_count or 0) + 1
    item.next_retry_at = None
    item.lease_expires_at = None
    db.commit()
    for p in plats:
        req = _build_upload_request_for_platform(item, p, run_now=True)
        background_tasks.add_task(process_upload_task, filename, req)
    return {"message": "Job started"}


@router.post("/jobs/pause/{filename}")
async def jobs_pause(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.worker_state = "paused"
    item.lease_expires_at = None
    db.commit()
    return {"message": "Job paused"}


@router.post("/jobs/resume/{filename}")
async def jobs_resume(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    sync_queue_job_state(item)
    db.commit()
    return {"message": "Job resumed"}


@router.post("/jobs/cancel/{filename}")
async def jobs_cancel(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.worker_state = "canceled"
    item.lease_expires_at = None
    db.commit()
    return {"message": "Job canceled"}


@router.post("/jobs/reschedule")
async def jobs_reschedule(req: RescheduleRequest, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == req.filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    try:
        item.scheduled_at = datetime.fromisoformat(req.schedule)
        sync_queue_job_state(item)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid schedule format")
    db.commit()
    return {"message": "Job rescheduled"}


@router.post("/jobs/set-tags")
async def jobs_set_tags(req: TagsRequest, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == req.filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.job_tags = req.tags or []
    db.commit()
    return {"message": "Tags updated"}


@router.post("/jobs/delete/{filename}")
async def jobs_delete(filename: str, db: Session = Depends(get_db)):
    item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    item.target_platforms = []
    item.account_map = {}
    item.options = {}
    item.platforms = {}
    item.scheduled_at = None
    item.worker_state = "pending"
    item.job_tags = []
    item.attempt_count = 0
    item.last_error = None
    item.last_run_at = None
    item.next_retry_at = None
    item.lease_expires_at = None
    db.commit()
    return {"message": "Job configuration cleared"}
