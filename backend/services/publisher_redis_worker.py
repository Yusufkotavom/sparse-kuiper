"""Dedicated Redis-backed worker for publisher jobs.

This worker is intended for WORKER_MODE=redis / hybrid modes.
It consumes queue signals from Redis and executes upload jobs by filename.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.core.database import SessionLocal
from backend.core.logger import logger
from backend.models.upload_queue import UploadQueueItem
from backend.routers.publisher_queue import sync_queue_job_state
from backend.routers.publisher_schemas import UploadRequest
from backend.routers.publisher_uploads import process_upload_task
from backend.services.queue_bus import delayed_key, queue_key, redis_client


def _lease_timeout_seconds() -> int:
    try:
        return max(30, int(os.environ.get("PUBLISHER_JOB_LEASE_SECONDS", "300")))
    except Exception:
        return 300


def _promote_delayed_jobs(client, batch_size: int = 100) -> int:
    now = time.time()
    try:
        due = client.zrangebyscore(delayed_key(), min="-inf", max=now, start=0, num=batch_size)
    except Exception as exc:
        logger.error(f"[RedisWorker] Failed reading delayed queue: {exc}")
        return 0

    moved = 0
    for payload in due:
        try:
            with client.pipeline() as pipe:
                pipe.zrem(delayed_key(), payload)
                pipe.rpush(queue_key(), payload)
                pipe.execute()
            moved += 1
        except Exception as exc:
            logger.error(f"[RedisWorker] Failed promoting delayed payload: {exc}")
    return moved


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


def _claim_job(filename: str, db: Session) -> list[str] | None:
    now = datetime.now(timezone.utc)
    item = (
        db.query(UploadQueueItem)
        .filter(UploadQueueItem.filename == filename)
        .with_for_update(skip_locked=True)
        .first()
    )
    if not item:
        return None

    sync_queue_job_state(item)
    if item.worker_state not in {"queued", "scheduled"}:
        db.commit()
        return None

    if item.scheduled_at and item.scheduled_at > now:
        db.commit()
        return None

    if item.next_retry_at and item.next_retry_at > now:
        db.commit()
        return None

    if item.lease_expires_at and item.lease_expires_at > now:
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
    return platforms


def _process_filename(filename: str) -> None:
    db = SessionLocal()
    try:
        platforms = _claim_job(filename, db)
        if not platforms:
            return

        item = db.query(UploadQueueItem).filter(UploadQueueItem.filename == filename).first()
        if not item:
            return

        for platform in platforms:
            process_upload_task(filename, _build_platform_request(item, platform))
    except Exception as exc:
        logger.error(f"[RedisWorker] Failed processing {filename}: {exc}", exc_info=True)
    finally:
        db.close()


def run_forever() -> None:
    client = redis_client()
    if client is None:
        raise RuntimeError("REDIS_URL is required for publisher_redis_worker")

    logger.info("[RedisWorker] started")
    block_seconds = max(1, int(os.environ.get("REDIS_WORKER_BLOCK_SECONDS", "5")))

    while True:
        try:
            moved = _promote_delayed_jobs(client)
            if moved:
                logger.info(f"[RedisWorker] promoted {moved} delayed jobs")

            popped = client.blpop(queue_key(), timeout=block_seconds)
            if not popped:
                continue

            _key, payload = popped
            filename = str(payload or "").strip()
            # Backward compatibility: accept legacy JSON payload format.
            if filename.startswith("{"):
                try:
                    data = json.loads(filename)
                    filename = str((data or {}).get("filename") or "").strip()
                except Exception:
                    logger.warning("[RedisWorker] skipping malformed payload")
                    continue
            if not filename:
                continue
            _process_filename(filename)
        except Exception as exc:
            logger.error(f"[RedisWorker] loop error: {exc}", exc_info=True)
            time.sleep(1)


if __name__ == "__main__":
    run_forever()
