from sqlalchemy import Column, BigInteger, String, Index
from sqlalchemy.sql import func

from backend.core.database import Base
from backend.core.sqltypes import JSON_VALUE, UTC_DATETIME


class RealtimeEvent(Base):
    __tablename__ = "realtime_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stream = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    entity_table = Column(String, nullable=False, index=True)
    entity_id = Column(String, nullable=False, index=True)
    payload = Column(JSON_VALUE, nullable=False, default=dict)
    created_at = Column(UTC_DATETIME, nullable=False, server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_realtime_events_stream_id", "stream", "id"),
        Index("ix_realtime_events_entity_lookup", "entity_table", "entity_id"),
    )
