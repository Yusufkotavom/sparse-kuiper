"""UploadQueueItem ORM Model — replaces upload_queue/status.json."""
from sqlalchemy import Column, String, Text, Integer
from sqlalchemy.sql import func
from backend.core.database import Base
from backend.core.sqltypes import JSON_VALUE, UTC_DATETIME


class UploadQueueItem(Base):
    __tablename__ = "upload_queue"

    filename = Column(String, primary_key=True, index=True)
    status = Column(String, default="pending", index=True)  # pending, uploading, completed, completed_with_errors
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    tags = Column(String, nullable=True)
    _platform_statuses = Column("platform_statuses", JSON_VALUE, default=dict)  # JSON statuses per platform
    _target_platforms = Column("target_platforms", JSON_VALUE, default=list)  # JSON array of platforms
    _account_map = Column("account_map", JSON_VALUE, default=dict)  # JSON map {platform: account_id}
    _options = Column("options", JSON_VALUE, default=dict)  # JSON map for misc options
    scheduled_at = Column(UTC_DATETIME, nullable=True)
    uploaded_at = Column(UTC_DATETIME, nullable=True)
    created_at = Column(UTC_DATETIME, server_default=func.now())
    worker_state = Column(String, default="pending", index=True)  # pending, scheduled, running, paused, completed, failed, canceled
    _job_tags = Column("job_tags", JSON_VALUE, default=list)  # JSON array of tags
    attempt_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    last_run_at = Column(UTC_DATETIME, nullable=True)
    next_retry_at = Column(UTC_DATETIME, nullable=True)
    lease_expires_at = Column(UTC_DATETIME, nullable=True)
    
    file_path = Column(String, nullable=True)
    project_dir = Column(String, nullable=True)

    @property
    def platforms(self) -> dict:
        return self._platform_statuses or {}

    @platforms.setter
    def platforms(self, value: dict):
        self._platform_statuses = value or {}

    @property
    def target_platforms(self) -> list:
        return self._target_platforms or []

    @target_platforms.setter
    def target_platforms(self, value: list):
        self._target_platforms = value or []

    @property
    def account_map(self) -> dict:
        return self._account_map or {}

    @account_map.setter
    def account_map(self, value: dict):
        self._account_map = value or {}

    @property
    def options(self) -> dict:
        return self._options or {}

    @options.setter
    def options(self, value: dict):
        self._options = value or {}

    @property
    def job_tags(self) -> list:
        return self._job_tags or []

    @job_tags.setter
    def job_tags(self, value: list):
        self._job_tags = value or []

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
            "next_retry_at": self.next_retry_at.isoformat() if self.next_retry_at else None,
            "lease_expires_at": self.lease_expires_at.isoformat() if self.lease_expires_at else None,
        }
