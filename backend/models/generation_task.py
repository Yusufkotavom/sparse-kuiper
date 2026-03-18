"""Persistent task table for polling-based AI media generation jobs."""
from sqlalchemy import Column, String, Text, Integer
from sqlalchemy.sql import func

from backend.core.database import Base
from backend.core.sqltypes import JSON_VALUE, UTC_DATETIME


class GenerationTask(Base):
    __tablename__ = "generation_tasks"

    id = Column(String, primary_key=True, index=True)
    task_type = Column(String, nullable=False, index=True)  # image | video
    provider = Column(String, nullable=False, default="replicate", index=True)
    status = Column(String, nullable=False, default="queued", index=True)  # queued|running|succeeded|failed|canceled

    prompt = Column(Text, nullable=False)
    input_json = Column(JSON_VALUE, nullable=False, default=dict)

    provider_task_id = Column(String, nullable=True)
    result_url = Column(Text, nullable=True)
    result_json = Column(JSON_VALUE, nullable=True)
    error = Column(Text, nullable=True)

    poll_count = Column(Integer, nullable=False, default=0)
    created_at = Column(UTC_DATETIME, server_default=func.now(), index=True)
    started_at = Column(UTC_DATETIME, nullable=True)
    finished_at = Column(UTC_DATETIME, nullable=True)
    updated_at = Column(UTC_DATETIME, server_default=func.now(), onupdate=func.now(), index=True)
