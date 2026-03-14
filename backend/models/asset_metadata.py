from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from backend.core.database import Base


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
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
