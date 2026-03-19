"""Generation service for image/video tasks with DB-backed polling state."""
from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

import requests

from backend.core.database import SessionLocal
from backend.core.json_utils import ensure_json_value
from backend.core.logger import logger
from backend.core.realtime import publish_realtime_event
from backend.models.generation_task import GenerationTask
from backend.services.telegram_notifier import send_telegram_message


REPLICATE_API_BASE = "https://api.replicate.com/v1"


def _now() -> datetime:
    return datetime.utcnow()


def _extract_result_url(output: Any) -> Optional[str]:
    if isinstance(output, str):
        return output
    if isinstance(output, list) and output:
        first = output[0]
        if isinstance(first, str):
            return first
    return None


def _notify_generation_status(task: GenerationTask) -> None:
    if task.status not in {"succeeded", "failed"}:
        return

    lines = [
        f"Generation {task.status.upper()}",
        f"Task ID: {task.id}",
        f"Type: {task.task_type}",
        f"Provider: {task.provider}",
    ]

    if task.result_url:
        lines.append(f"Result: {task.result_url}")
    if task.error:
        lines.append(f"Error: {task.error}")

    send_telegram_message("\n".join(lines))


def create_generation_task(db, task_type: str, provider: str, prompt: str, input_payload: Dict[str, Any]) -> GenerationTask:
    task = GenerationTask(
        id=f"gen_{uuid.uuid4().hex[:12]}",
        task_type=task_type,
        provider=provider,
        status="queued",
        prompt=prompt,
        input_json=input_payload or {},
    )
    db.add(task)
    publish_realtime_event(
        db,
        stream="generation_tasks",
        event_type="created",
        entity_table="generation_tasks",
        entity_id=task.id,
        payload={"id": task.id, "task_type": task.task_type, "status": task.status, "provider": task.provider},
    )
    db.commit()
    db.refresh(task)
    return task


def _run_replicate_prediction(task: GenerationTask, api_token: str, model_version: str, input_payload: Dict[str, Any], timeout_seconds: int = 300) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Token {api_token}",
        "Content-Type": "application/json",
    }
    create_payload = {
        "version": model_version,
        "input": input_payload,
    }

    create_resp = requests.post(f"{REPLICATE_API_BASE}/predictions", headers=headers, json=create_payload, timeout=30)
    create_resp.raise_for_status()
    prediction = create_resp.json()

    get_url = (prediction.get("urls") or {}).get("get")
    if not get_url:
        raise RuntimeError("Replicate response missing poll URL")

    started = time.time()
    poll_count = 0
    latest = prediction
    while True:
        status = latest.get("status")
        if status in {"succeeded", "failed", "canceled"}:
            return {"prediction": latest, "poll_count": poll_count}

        if time.time() - started > timeout_seconds:
            raise TimeoutError("Replicate prediction timeout")

        time.sleep(2)
        poll_count += 1
        poll_resp = requests.get(get_url, headers=headers, timeout=30)
        poll_resp.raise_for_status()
        latest = poll_resp.json()


def run_generation_task(task_id: str):
    db = SessionLocal()
    try:
        task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
        if not task:
            return
        if task.status == "canceled":
            return

        task.status = "running"
        task.started_at = _now()
        publish_realtime_event(
            db,
            stream="generation_tasks",
            event_type="updated",
            entity_table="generation_tasks",
            entity_id=task.id,
            payload={"id": task.id, "status": task.status, "started_at": task.started_at},
        )
        db.commit()

        input_payload = ensure_json_value(task.input_json) or {}
        if task.provider != "replicate":
            raise RuntimeError(f"Unsupported provider: {task.provider}")

        api_token = os.getenv("REPLICATE_API_TOKEN", "").strip()
        if not api_token:
            raise RuntimeError("Missing REPLICATE_API_TOKEN")

        if task.task_type == "image":
            model_version = input_payload.pop("model_version", "") or os.getenv("REPLICATE_IMAGE_MODEL_VERSION", "").strip()
        else:
            model_version = input_payload.pop("model_version", "") or os.getenv("REPLICATE_VIDEO_MODEL_VERSION", "").strip()

        if not model_version:
            raise RuntimeError("Missing model_version and default REPLICATE_*_MODEL_VERSION")

        result = _run_replicate_prediction(
            task=task,
            api_token=api_token,
            model_version=model_version,
            input_payload=input_payload,
            timeout_seconds=int(input_payload.pop("timeout_seconds", 300) or 300),
        )

        prediction = result["prediction"]
        task.provider_task_id = prediction.get("id")
        task.poll_count = int(result.get("poll_count") or 0)
        task.result_json = prediction
        task.result_url = _extract_result_url(prediction.get("output"))
        task.status = prediction.get("status") or "succeeded"
        if task.status != "succeeded":
            task.error = prediction.get("error") or "Generation failed"

        task.finished_at = _now()
        publish_realtime_event(
            db,
            stream="generation_tasks",
            event_type="updated",
            entity_table="generation_tasks",
            entity_id=task.id,
            payload={"id": task.id, "status": task.status, "result_url": task.result_url, "error": task.error},
        )
        _notify_generation_status(task)
        db.commit()

    except Exception as exc:
        logger.exception(f"[Generation] Task failed {task_id}: {exc}")
        task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
        if task:
            task.status = "failed"
            task.error = str(exc)
            task.finished_at = _now()
            publish_realtime_event(
                db,
                stream="generation_tasks",
                event_type="updated",
                entity_table="generation_tasks",
                entity_id=task.id,
                payload={"id": task.id, "status": task.status, "error": task.error},
            )
            _notify_generation_status(task)
            db.commit()
    finally:
        db.close()
