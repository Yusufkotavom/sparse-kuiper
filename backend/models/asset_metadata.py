from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.sql import func
from backend.core.database import Base
from backend.core.sqltypes import UTC_DATETIME


class AssetMetadata(Base):
    __tablename__ = "asset_metadata"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_type = Column(String, nullable=False, index=True)
    project_name = Column(String, nullable=False, index=True)
    canonical_dir = Column(String, nullable=True, index=True)
    filename = Column(String, nullable=False, index=True)
    title = Column(String, default="")
    description = Column(Text, default="")
    tags = Column(String, default="")
    updated_at = Column(UTC_DATETIME, server_default=func.now(), onupdate=func.now(), index=True)
