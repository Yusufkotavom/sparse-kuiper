from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.core.database import DATABASE_URL, engine, get_db
from backend.models.realtime_event import RealtimeEvent

router = APIRouter(prefix="/api/v1/realtime", tags=["realtime"])


@router.get("/health")
def realtime_health(db: Session = Depends(get_db)):
    latest = (
        db.query(RealtimeEvent)
        .order_by(RealtimeEvent.id.desc())
        .first()
    )
    return {
        "status": "ok",
        "database_url_configured": bool(DATABASE_URL),
        "dialect": engine.dialect.name,
        "latest_event_id": latest.id if latest else None,
    }


@router.get("/events")
def replay_events(
    stream: str | None = Query(default=None),
    after_id: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(RealtimeEvent).filter(RealtimeEvent.id > after_id)
    if stream:
        query = query.filter(RealtimeEvent.stream == stream)
    rows = query.order_by(RealtimeEvent.id.asc()).limit(limit).all()
    return {
        "events": [
            {
                "id": row.id,
                "stream": row.stream,
                "event_type": row.event_type,
                "entity_table": row.entity_table,
                "entity_id": row.entity_id,
                "payload": row.payload,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
    }
