"""
Database configuration - SQLAlchemy engine, session factory, and dependency injection.

Supabase/PostgreSQL is required.
"""
import os
import psycopg
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL wajib diisi untuk integrasi Supabase.")
if not DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
    raise RuntimeError("Hanya PostgreSQL/Supabase yang didukung. Gunakan DATABASE_URL Postgres.")

engine_kwargs = {"echo": False, "future": True}
engine_kwargs["pool_pre_ping"] = True
engine_kwargs["pool_recycle"] = 300
engine_kwargs["pool_size"] = int(os.environ.get("DATABASE_POOL_SIZE", "10"))
engine_kwargs["max_overflow"] = int(os.environ.get("DATABASE_MAX_OVERFLOW", "20"))
engine_kwargs["connect_args"] = {"prepare_threshold": None, "cursor_factory": psycopg.ClientCursor}

engine = create_engine(
    DATABASE_URL,
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
    from backend.models import account, app_setting, upload_queue, project_config, asset_metadata, generation_task, realtime_event  # noqa: F401
    Base.metadata.create_all(bind=engine)
