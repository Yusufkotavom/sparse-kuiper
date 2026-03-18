"""
Database configuration - SQLAlchemy engine, session factory, and dependency injection.

Supabase/PostgreSQL is the canonical target for production.
SQLite fallback remains only for local compatibility when DATABASE_URL is not set.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
from dotenv import load_dotenv

# Resolve database path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")
_DEFAULT_DB = f"sqlite:///{BASE_DIR / 'nomad_hub.db'}"
DATABASE_URL = os.environ.get("DATABASE_URL", _DEFAULT_DB).strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Engine options
connect_args = {}
engine_kwargs = {"echo": False, "future": True}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = int(os.environ.get("DATABASE_POOL_SIZE", "10"))
    engine_kwargs["max_overflow"] = int(os.environ.get("DATABASE_MAX_OVERFLOW", "20"))

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and ensures it is closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables():
    """Create all tables (safe to call on every startup)."""
    from backend.models import account, upload_queue, project_config, asset_metadata, generation_task, realtime_event  # noqa: F401
    Base.metadata.create_all(bind=engine)
