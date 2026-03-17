"""
Auto-migration seeder: Imports existing JSON flat-files into SQLite on first startup.
Run automatically by main.py on application start.
"""
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from sqlalchemy import inspect, text

from backend.core.logger import logger
from backend.core.database import engine

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ACCOUNTS_JSON = BASE_DIR / "data" / "accounts.json"
STATUS_JSON = BASE_DIR / "upload_queue" / "status.json"
IS_SQLITE = engine.dialect.name == "sqlite"


def seed_accounts_from_json(db):
    """Import data/accounts.json into the accounts table if the table is empty."""
    from backend.models.account import Account
    if db.query(Account).count() > 0:
        return  # Already seeded

    if not ACCOUNTS_JSON.exists():
        return

    try:
        with open(ACCOUNTS_JSON, "r", encoding="utf-8") as f:
            accounts = json.load(f)

        for acc in accounts:
            account = Account(
                id=acc.get("id") or f"{acc.get('platform', 'unknown')}_{uuid.uuid4().hex[:8]}",
                name=acc.get("name", "Unnamed"),
                platform=acc.get("platform", ""),
                auth_method=acc.get("auth_method", "playwright"),
                status=acc.get("status", "needs_login"),
                api_key=acc.get("api_key"),
                api_secret=acc.get("api_secret"),
                last_login=datetime.fromisoformat(acc["last_login"]) if acc.get("last_login") else None,
            )
            db.add(account)

        db.commit()
        count = len(accounts)
        logger.info(f"[Migration] Seeded {count} account(s) from accounts.json → SQLite")
    except Exception as e:
        logger.error(f"[Migration] Failed to seed accounts: {e}")
        db.rollback()


def seed_upload_queue_from_json(db):
    """Import upload_queue/status.json into the upload_queue table if it is empty."""
    from backend.models.upload_queue import UploadQueueItem
    if db.query(UploadQueueItem).count() > 0:
        return  # Already seeded

    if not STATUS_JSON.exists():
        return

    try:
        with open(STATUS_JSON, "r", encoding="utf-8") as f:
            status_data = json.load(f)

        for filename, data in status_data.items():
            meta = data.get("metadata", {})
            item = UploadQueueItem(
                filename=filename,
                status=data.get("status", "pending"),
                title=meta.get("title"),
                description=meta.get("description"),
                tags=meta.get("tags"),
            )
            item.platforms = data.get("platforms", {})
            db.add(item)

        db.commit()
        count = len(status_data)
        logger.info(f"[Migration] Seeded {count} queue item(s) from status.json → SQLite")
    except Exception as e:
        logger.error(f"[Migration] Failed to seed upload queue: {e}")
        db.rollback()


def alter_accounts_add_youtube_cols():
    """Add oauth_token_json / channel_title to accounts if not present.
    Uses the raw SQLite engine directly — safe to call before any ORM query.
    """
    if not IS_SQLITE:
        return
    try:
        with engine.connect() as conn:
            raw = conn.connection  # raw sqlite3 Connection
            cursor = raw.cursor()
            existing = {row[1] for row in cursor.execute("PRAGMA table_info(accounts)")}
            added = []
            if "oauth_token_json" not in existing:
                cursor.execute("ALTER TABLE accounts ADD COLUMN oauth_token_json TEXT")
                added.append("oauth_token_json")
            if "channel_title" not in existing:
                cursor.execute("ALTER TABLE accounts ADD COLUMN channel_title VARCHAR")
                added.append("channel_title")
            if added:
                raw.commit()
                logger.info(f"[Migration] Added accounts columns: {added}")
    except Exception as e:
        logger.warning(f"[Migration] Could not add YouTube columns: {e}")

def remove_accounts_donut_cols():
    if not IS_SQLITE:
        return
    try:
        with engine.connect() as conn:
            raw = conn.connection
            cursor = raw.cursor()
            existing = {row[1] for row in cursor.execute("PRAGMA table_info(accounts)")}
            if "donut_profile_id" not in existing and "donut_api_token" not in existing:
                return

            cursor.execute("""
                CREATE TABLE accounts_new (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    platform VARCHAR NOT NULL,
                    auth_method VARCHAR NOT NULL,
                    status VARCHAR,
                    api_key VARCHAR,
                    api_secret VARCHAR,
                    oauth_token_json TEXT,
                    channel_title VARCHAR,
                    last_login DATETIME,
                    created_at DATETIME,
                    tags VARCHAR,
                    notes TEXT,
                    browser_type VARCHAR,
                    proxy VARCHAR,
                    user_agent VARCHAR,
                    lightweight_mode BOOLEAN
                )
            """)

            cursor.execute("""
                INSERT INTO accounts_new (
                    id,
                    name,
                    platform,
                    auth_method,
                    status,
                    api_key,
                    api_secret,
                    oauth_token_json,
                    channel_title,
                    last_login,
                    created_at,
                    tags,
                    notes,
                    browser_type,
                    proxy,
                    user_agent,
                    lightweight_mode
                )
                SELECT
                    id,
                    name,
                    platform,
                    auth_method,
                    status,
                    api_key,
                    api_secret,
                    oauth_token_json,
                    channel_title,
                    last_login,
                    created_at,
                    tags,
                    notes,
                    browser_type,
                    proxy,
                    user_agent,
                    lightweight_mode
                FROM accounts
            """)

            cursor.execute("DROP TABLE accounts")
            cursor.execute("ALTER TABLE accounts_new RENAME TO accounts")
            raw.commit()
            logger.info("[Migration] Removed Donut columns from accounts")
    except Exception as e:
        logger.warning(f"[Migration] Could not remove Donut columns: {e}")

def alter_upload_queue_add_paths():
    """Add file_path and project_dir to upload_queue table if not present."""
    if not IS_SQLITE:
        return
    try:
        with engine.connect() as conn:
            raw = conn.connection
            cursor = raw.cursor()
            existing = {row[1] for row in cursor.execute("PRAGMA table_info(upload_queue)")}
            added = []
            if "file_path" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN file_path VARCHAR")
                added.append("file_path")
            if "project_dir" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN project_dir VARCHAR")
                added.append("project_dir")
            if added:
                raw.commit()
                logger.info(f"[Migration] Added upload_queue columns: {added}")
    except Exception as e:
        logger.warning(f"[Migration] Could not add path columns to upload_queue: {e}")

def alter_upload_queue_add_config():
    """Add config columns to upload_queue if not present."""
    if not IS_SQLITE:
        return
    try:
        with engine.connect() as conn:
            raw = conn.connection
            cursor = raw.cursor()
            existing = {row[1] for row in cursor.execute("PRAGMA table_info(upload_queue)")}
            added = []
            if "target_platforms" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN target_platforms TEXT")
                added.append("target_platforms")
            if "account_map" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN account_map TEXT")
                added.append("account_map")
            if "options" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN options TEXT")
                added.append("options")
            if "scheduled_at" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN scheduled_at DATETIME")
                added.append("scheduled_at")
            if "worker_state" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN worker_state VARCHAR")
                added.append("worker_state")
            if "job_tags" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN job_tags TEXT")
                added.append("job_tags")
            if "attempt_count" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN attempt_count INTEGER DEFAULT 0")
                added.append("attempt_count")
            if "last_error" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN last_error TEXT")
                added.append("last_error")
            if "last_run_at" not in existing:
                cursor.execute("ALTER TABLE upload_queue ADD COLUMN last_run_at DATETIME")
                added.append("last_run_at")
            if added:
                raw.commit()
                logger.info(f"[Migration] Added upload_queue config columns: {added}")
    except Exception as e:
        logger.warning(f"[Migration] Could not add config columns to upload_queue: {e}")

def alter_project_configs_add_number_n():
    try:
        with engine.connect() as conn:
            inspector = inspect(conn)
            tables = set(inspector.get_table_names())
            if "project_configs" not in tables:
                return
            existing = {c["name"] for c in inspector.get_columns("project_configs")}
            if "number_n" in existing:
                return
            conn.execute(text("ALTER TABLE project_configs ADD COLUMN number_n INTEGER DEFAULT 10"))
            conn.commit()
            logger.info("[Migration] Added project_configs column: number_n")
    except Exception as e:
        logger.warning(f"[Migration] Could not add number_n to project_configs: {e}")


def alter_project_configs_add_accounts():
    try:
        with engine.connect() as conn:
            inspector = inspect(conn)
            tables = set(inspector.get_table_names())
            if "project_configs" not in tables:
                return
            existing = {c["name"] for c in inspector.get_columns("project_configs")}
            statements = []
            if "grok_account_id" not in existing:
                statements.append("ALTER TABLE project_configs ADD COLUMN grok_account_id VARCHAR DEFAULT ''")
            if "whisk_account_id" not in existing:
                statements.append("ALTER TABLE project_configs ADD COLUMN whisk_account_id VARCHAR DEFAULT ''")
            for stmt in statements:
                conn.execute(text(stmt))
            if statements:
                conn.commit()
                logger.info("[Migration] Added project_configs columns: grok_account_id, whisk_account_id")
    except Exception as e:
        logger.warning(f"[Migration] Could not add grok/whisk accounts to project_configs: {e}")

def run_migrations(db):
    """Run all migrations. Called once on startup."""
    # Column migrations MUST run before any ORM queries on the models
    alter_accounts_add_youtube_cols()
    remove_accounts_donut_cols()
    alter_upload_queue_add_paths()
    alter_upload_queue_add_config()
    alter_project_configs_add_number_n()
    alter_project_configs_add_accounts()
    seed_accounts_from_json(db)
    seed_upload_queue_from_json(db)
    logger.info("[Migration] Migration check complete.")
