"""UploadQueueItem ORM Model — replaces upload_queue/status.json."""
import json
from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.sql import func
from backend.core.database import Base


class UploadQueueItem(Base):
    __tablename__ = "upload_queue"

    filename = Column(String, primary_key=True, index=True)
    status = Column(String, default="pending")  # pending, uploading, completed, completed_with_errors
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    tags = Column(String, nullable=True)
    _platform_statuses = Column("platform_statuses", Text, default="{}")  # JSON stored as text
    _target_platforms = Column("target_platforms", Text, default="[]")  # JSON array of platforms
    _account_map = Column("account_map", Text, default="{}")  # JSON map {platform: account_id}
    _options = Column("options", Text, default="{}")  # JSON map for misc options (open_browser, pw_debug, privacy, category_id, product_id)
    scheduled_at = Column(DateTime, nullable=True)
    uploaded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    worker_state = Column(String, default="pending")  # pending, scheduled, running, paused, completed, failed, canceled
    _job_tags = Column("job_tags", Text, default="[]")  # JSON array of tags
    attempt_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    last_run_at = Column(DateTime, nullable=True)
    
    file_path = Column(String, nullable=True)
    project_dir = Column(String, nullable=True)

    @property
    def platforms(self) -> dict:
        try:
            return json.loads(self._platform_statuses or "{}")
        except Exception:
            return {}

    @platforms.setter
    def platforms(self, value: dict):
        self._platform_statuses = json.dumps(value)

    @property
    def target_platforms(self) -> list:
        try:
            return json.loads(self._target_platforms or "[]")
        except Exception:
            return []

    @target_platforms.setter
    def target_platforms(self, value: list):
        self._target_platforms = json.dumps(value or [])

    @property
    def account_map(self) -> dict:
        try:
            return json.loads(self._account_map or "{}")
        except Exception:
            return {}

    @account_map.setter
    def account_map(self, value: dict):
        self._account_map = json.dumps(value or {})

    @property
    def options(self) -> dict:
        try:
            return json.loads(self._options or "{}")
        except Exception:
            return {}

    @options.setter
    def options(self, value: dict):
        self._options = json.dumps(value or {})

    @property
    def job_tags(self) -> list:
        try:
            return json.loads(self._job_tags or "[]")
        except Exception:
            return []

    @job_tags.setter
    def job_tags(self, value: list):
        self._job_tags = json.dumps(value or [])

    def to_dict(self) -> dict:
        return {
            "filename": self.filename,
            "status": self.status,
            "platforms": self.platforms,
            "metadata": {
                "title": self.title,
                "description": self.description,
                "tags": self.tags,
            },
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "file_path": self.file_path,
            "project_dir": self.project_dir,
            "target_platforms": self.target_platforms,
            "account_map": self.account_map,
            "options": self.options,
            "worker_state": self.worker_state,
            "job_tags": self.job_tags,
            "attempt_count": self.attempt_count,
            "last_error": self.last_error or "",
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
        }
