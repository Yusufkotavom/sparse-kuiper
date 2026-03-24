"""Queue bus abstraction for phased migration to Redis-backed workers.

Mode is controlled by WORKER_MODE env:
- legacy: keep DB polling dispatcher only
- hybrid: keep legacy dispatcher + also push queue signals to Redis
- redis: push queue signals to Redis (legacy dispatcher can be disabled by env)
"""

from __future__ import annotations

import os
from datetime import datetime

from backend.core.logger import logger

try:
    import redis as redis_pkg
except Exception:  # pragma: no cover - import safety for constrained env
    redis_pkg = None


_QUEUE_KEY = os.environ.get("PUBLISHER_REDIS_QUEUE_KEY", "publisher:jobs")
_DELAYED_KEY = os.environ.get("PUBLISHER_REDIS_DELAYED_KEY", "publisher:jobs:delayed")


def worker_mode() -> str:
    raw = (os.environ.get("WORKER_MODE", "legacy") or "legacy").strip().lower()
    return raw if raw in {"legacy", "hybrid", "redis"} else "legacy"


def queue_key() -> str:
    return _QUEUE_KEY


def delayed_key() -> str:
    return _DELAYED_KEY


def redis_client():
    if redis_pkg is None:
        return None
    redis_url = (os.environ.get("REDIS_URL", "") or "").strip()
    if not redis_url:
        return None
    try:
        return redis_pkg.from_url(redis_url, decode_responses=True)
    except Exception as exc:
        logger.error(f"[QueueBus] Failed creating Redis client: {exc}")
        return None


def enqueue_publish_job(filename: str, *, scheduled_at: datetime | None = None) -> bool:
    """Enqueue job signal to Redis in hybrid/redis mode.

    Returns True if queued to Redis, False otherwise.
    """
    mode = worker_mode()
    if mode == "legacy":
        return False

    client = redis_client()
    if client is None:
        logger.warning("[QueueBus] WORKER_MODE requires Redis but REDIS_URL is not available.")
        return False

    normalized_filename = (filename or "").strip()
    if not normalized_filename:
        return False

    try:
        if scheduled_at:
            score = scheduled_at.timestamp()
            # ZSET member is filename for natural de-dup (same filename updates score).
            client.zadd(_DELAYED_KEY, {normalized_filename: score})
        else:
            # De-dup in ready queue: keep latest position only once.
            client.lrem(_QUEUE_KEY, 0, normalized_filename)
            client.rpush(_QUEUE_KEY, normalized_filename)
        return True
    except Exception as exc:
        logger.error(f"[QueueBus] Failed enqueueing Redis job for {filename}: {exc}")
        return False
