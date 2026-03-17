"""
Database configuration - SQLAlchemy engine, session factory, and dependency injection.

Uses SQLite by default (file: nomad_hub.db at the project root).
Override DATABASE_URL in .env to use PostgreSQL for production:
  DATABASE_URL=postgresql://user:password@host:5432/nomad_hub
"""
import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
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
engine_kwargs = {"echo": False}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {"prepare_threshold": None}
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

# Enable WAL mode + foreign keys for SQLite automatically
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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
    from backend.models import account, upload_queue, project_config, asset_metadata  # noqa: F401
    Base.metadata.create_all(bind=engine)
