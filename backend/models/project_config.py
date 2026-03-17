"""ProjectConfig ORM Model — stores per-project settings and prompts list."""
import json
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from backend.core.database import Base


class ProjectConfig(Base):
    __tablename__ = "project_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    project_type = Column(String, nullable=False)   # "video" | "kdp"
    topic = Column(String, default="")
    character = Column(String, default="")
    number_n = Column(Integer, default=10)
    system_prompt = Column(Text, default="")
    prefix = Column(String, default="")
    suffix = Column(String, default="")
    grok_account_id = Column(String, default="")
    whisk_account_id = Column(String, default="")
    _prompts_json = Column("prompts_json", Text, default="[]")  # JSON array of strings
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def prompts(self) -> list:
        try:
            return json.loads(self._prompts_json or "[]")
        except Exception:
            return []

    @prompts.setter
    def prompts(self, value: list):
        self._prompts_json = json.dumps(value)
