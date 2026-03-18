from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from backend.models.realtime_event import RealtimeEvent


def _to_iso(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def publish_realtime_event(
    db: Session,
    *,
    stream: str,
    event_type: str,
    entity_table: str,
    entity_id: str,
    payload: dict[str, Any],
) -> RealtimeEvent:
    event = RealtimeEvent(
        stream=stream,
        event_type=event_type,
        entity_table=entity_table,
        entity_id=str(entity_id),
        payload={k: _to_iso(v) for k, v in (payload or {}).items()},
    )
    db.add(event)
    return event
