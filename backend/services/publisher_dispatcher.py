"""Lightweight DB-backed dispatcher for queued publisher jobs."""

from __future__ import annotations

import os
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_

from backend.core.database import SessionLocal
from backend.core.logger import logger
from backend.models.upload_queue import UploadQueueItem
from backend.routers.publisher_queue import sync_queue_job_state
from backend.routers.publisher_schemas import UploadRequest
from backend.routers.publisher_uploads import process_upload_task

_dispatcher_thread: threading.Thread | None = None
_stop_event = threading.Event()
_start_lock = threading.Lock()


def _poll_interval_seconds() -> float:
    try:
        return max(1.0, float(os.environ.get("PUBLISHER_DISPATCHER_POLL_SECONDS", "5")))
    except Exception:
        return 5.0


def _lease_timeout_seconds() -> int:
    try:
        return max(30, int(os.environ.get("PUBLISHER_JOB_LEASE_SECONDS", "300")))
    except Exception:
        return 300


def _dispatcher_enabled() -> bool:
    explicit = os.environ.get("PUBLISHER_DISPATCHER_ENABLED")
    if explicit is not None:
        return explicit.strip().lower() not in {"0", "false", "no", "off"}
    if os.environ.get("WORKER_MODE", "legacy").strip().lower() == "redis":
        return False
    return True


def _build_platform_request(item: UploadQueueItem, platform: str) -> UploadRequest:
    opts = item.options or {}
    return UploadRequest(
        title=item.title or "",
        description=item.description or "",
        tags=item.tags or "",
        platforms=[platform],
        account_id=(item.account_map or {}).get(platform, ""),
        schedule=(opts.get("platform_publish_schedule") or "") if item.scheduled_at else "",
        product_id=opts.get("product_id", "") or "",
        youtube_privacy=opts.get("youtube_privacy", "private") or "private",
        youtube_category_id=opts.get("youtube_category_id", "22") or "22",
        open_browser=bool(opts.get("open_browser", False)),
        pw_debug=bool(opts.get("pw_debug", False)),
    )


def _claim_next_job() -> tuple[str, list[str]] | None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        item = (
            db.query(UploadQueueItem)
            .filter(UploadQueueItem.status != "archived")
            .filter(UploadQueueItem.worker_state.in_(["queued", "scheduled"]))
            .filter(or_(UploadQueueItem.scheduled_at.is_(None), UploadQueueItem.scheduled_at <= now))
            .filter(or_(UploadQueueItem.next_retry_at.is_(None), UploadQueueItem.next_retry_at <= now))
            .filter(or_(UploadQueueItem.lease_expires_at.is_(None), UploadQueueItem.lease_expires_at <= now))
            .order_by(UploadQueueItem.scheduled_at.is_(None).desc(), UploadQueueItem.scheduled_at.asc(), UploadQueueItem.created_at.asc())
            .with_for_update(skip_locked=True)
            .first()
        )
        if not item:
            return None

        sync_queue_job_state(item)
        if item.worker_state not in {"queued", "scheduled"}:
            db.commit()
            return None

        platforms = list(item.target_platforms or [])
        if not platforms:
            item.worker_state = "failed"
            item.status = "failed"
            item.last_error = "No target platforms configured."
            db.commit()
            return None

        item.worker_state = "running"
        item.status = "uploading"
        item.last_run_at = now
        item.attempt_count = int(item.attempt_count or 0) + 1
        item.last_error = None
        item.next_retry_at = None
        item.lease_expires_at = now + timedelta(seconds=_lease_timeout_seconds())
        db.commit()
        return item.filename, platforms
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _run_dispatch_loop() -> None:
    interval = _poll_interval_seconds()
    logger.info(f"[PublisherDispatcher] Started with poll interval {interval:.1f}s")
    while not _stop_event.is_set():
        try:
            claimed = _claim_next_job()
            if not claimed:
                _stop_event.wait(interval)
                continue

            filename, platforms = claimed
            logger.info(f"[PublisherDispatcher] Claimed job {filename} for platforms={platforms}")

            db = SessionLocal()
            try:
                item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
                if not item:
                    continue
                for platform in platforms:
                    process_upload_task(filename, _build_platform_request(item, platform))
            finally:
                db.close()
        except Exception as exc:
            logger.error(f"[PublisherDispatcher] Loop error: {exc}", exc_info=True)
            _stop_event.wait(interval)

    logger.info("[PublisherDispatcher] Stopped")


def start_publisher_dispatcher() -> None:
    global _dispatcher_thread
    if not _dispatcher_enabled():
        logger.info("[PublisherDispatcher] Disabled by environment")
        return

    with _start_lock:
        if _dispatcher_thread and _dispatcher_thread.is_alive():
            return
        _stop_event.clear()
        _dispatcher_thread = threading.Thread(
            target=_run_dispatch_loop,
            name="publisher-dispatcher",
            daemon=True,
        )
        _dispatcher_thread.start()


def stop_publisher_dispatcher() -> None:
    _stop_event.set()
