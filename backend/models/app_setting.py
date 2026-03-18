"""Generic persisted app settings for templates, presets, and similar JSON-backed records."""
from sqlalchemy import Column, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from backend.core.database import Base
from backend.core.sqltypes import JSON_VALUE, UTC_DATETIME


class AppSetting(Base):
    __tablename__ = "app_settings"
    __table_args__ = (
        UniqueConstraint("setting_type", "name", name="uq_app_settings_type_name"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    setting_type = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    payload = Column(JSON_VALUE, nullable=False, default=dict)
    created_at = Column(UTC_DATETIME, server_default=func.now(), index=True)
    updated_at = Column(UTC_DATETIME, server_default=func.now(), onupdate=func.now(), index=True)
