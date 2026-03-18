"""Persistent task table for polling-based AI media generation jobs."""
from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.sql import func

from backend.core.database import Base


class GenerationTask(Base):
    __tablename__ = "generation_tasks"

    id = Column(String, primary_key=True, index=True)
    task_type = Column(String, nullable=False, index=True)  # image | video
    provider = Column(String, nullable=False, default="replicate", index=True)
    status = Column(String, nullable=False, default="queued", index=True)  # queued|running|succeeded|failed|canceled

    prompt = Column(Text, nullable=False)
    input_json = Column(Text, nullable=False, default="{}")

    provider_task_id = Column(String, nullable=True)
    result_url = Column(Text, nullable=True)
    result_json = Column(Text, nullable=True)
    error = Column(Text, nullable=True)

    poll_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
