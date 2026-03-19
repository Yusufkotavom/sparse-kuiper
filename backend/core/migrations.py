"""
Postgres/Supabase-friendly migration bootstrap.

This module performs two lightweight startup tasks:
- one-time imports from legacy JSON flat files
- one-time imports from a legacy SQLite file when present

The routines are idempotent and skip tables that already contain data.
"""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any
from sqlalchemy import inspect, text

from backend.core.logger import logger

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ACCOUNTS_JSON = BASE_DIR / "data" / "accounts.json"
STATUS_JSON = BASE_DIR / "upload_queue" / "status.json"
LEGACY_SQLITE_DB = BASE_DIR / "nomad_hub.db"


def _env_bool(name: str, default: str = "0") -> bool:
    value = os.environ.get(name, default).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def seed_accounts_from_json(db):
    from backend.models.account import Account

    if db.query(Account).count() > 0 or not ACCOUNTS_JSON.exists():
        return

    try:
        with open(ACCOUNTS_JSON, "r", encoding="utf-8") as f:
            accounts = json.load(f)

        for acc in accounts:
            db.add(Account(
                id=acc.get("id") or f"{acc.get('platform', 'unknown')}_{uuid.uuid4().hex[:8]}",
                name=acc.get("name", "Unnamed"),
                platform=acc.get("platform", ""),
                auth_method=acc.get("auth_method", "playwright"),
                status=acc.get("status", "needs_login"),
                api_key=acc.get("api_key"),
                api_secret=acc.get("api_secret"),
                oauth_token_json=acc.get("oauth_token_json"),
                channel_title=acc.get("channel_title"),
                tags=acc.get("tags"),
                notes=acc.get("notes"),
                browser_type=acc.get("browser_type") or "chromium",
                proxy=acc.get("proxy"),
                user_agent=acc.get("user_agent"),
                lightweight_mode=bool(acc.get("lightweight_mode", False)),
                last_login=_parse_dt(acc.get("last_login")),
            ))

        db.commit()
        logger.info(f"[Migration] Seeded {len(accounts)} account(s) from accounts.json")
    except Exception as e:
        logger.error(f"[Migration] Failed to seed accounts from JSON: {e}")
        db.rollback()


def seed_upload_queue_from_json(db):
    from backend.models.upload_queue import UploadQueueItem

    if db.query(UploadQueueItem).count() > 0 or not STATUS_JSON.exists():
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
                uploaded_at=_parse_dt(data.get("uploaded_at")),
                scheduled_at=_parse_dt(data.get("scheduled_at")),
            )
            item.platforms = data.get("platforms", {})
            db.add(item)

        db.commit()
        logger.info(f"[Migration] Seeded {len(status_data)} queue item(s) from status.json")
    except Exception as e:
        logger.error(f"[Migration] Failed to seed upload queue from JSON: {e}")
        db.rollback()


def seed_from_legacy_sqlite(db):
    if not LEGACY_SQLITE_DB.exists():
        return

    try:
        from backend.models.account import Account
        from backend.models.asset_metadata import AssetMetadata
        from backend.models.generation_task import GenerationTask
        from backend.models.project_config import ProjectConfig
        from backend.models.upload_queue import UploadQueueItem

        conn = sqlite3.connect(str(LEGACY_SQLITE_DB))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        table_specs = [
            ("accounts", Account, lambda row: Account(
                id=row["id"],
                name=row["name"],
                platform=row["platform"],
                auth_method=row["auth_method"],
                status=row["status"],
                api_key=row["api_key"],
                api_secret=row["api_secret"],
                oauth_token_json=json.loads(row["oauth_token_json"]) if row["oauth_token_json"] else None,
                channel_title=row["channel_title"],
                last_login=_parse_dt(row["last_login"]),
                tags=row["tags"],
                notes=row["notes"],
                browser_type=row["browser_type"] or "chromium",
                proxy=row["proxy"],
                user_agent=row["user_agent"],
                lightweight_mode=bool(row["lightweight_mode"]) if row["lightweight_mode"] is not None else False,
            )),
            ("generation_tasks", GenerationTask, lambda row: GenerationTask(
                id=row["id"],
                task_type=row["task_type"],
                provider=row["provider"],
                status=row["status"],
                prompt=row["prompt"],
                input_json=json.loads(row["input_json"] or "{}"),
                provider_task_id=row["provider_task_id"],
                result_url=row["result_url"],
                result_json=json.loads(row["result_json"]) if row["result_json"] else None,
                error=row["error"],
                poll_count=row["poll_count"] or 0,
                created_at=_parse_dt(row["created_at"]),
                started_at=_parse_dt(row["started_at"]),
                finished_at=_parse_dt(row["finished_at"]),
                updated_at=_parse_dt(row["updated_at"]),
            )),
            ("upload_queue", UploadQueueItem, lambda row: UploadQueueItem(
                filename=row["filename"],
                status=row["status"],
                title=row["title"],
                description=row["description"],
                tags=row["tags"],
                scheduled_at=_parse_dt(row["scheduled_at"]),
                uploaded_at=_parse_dt(row["uploaded_at"]),
                created_at=_parse_dt(row["created_at"]),
                worker_state=row["worker_state"],
                attempt_count=row["attempt_count"] or 0,
                last_error=row["last_error"],
                last_run_at=_parse_dt(row["last_run_at"]),
                file_path=row["file_path"],
                project_dir=row["project_dir"],
            )),
            ("project_configs", ProjectConfig, lambda row: ProjectConfig(
                id=row["id"],
                name=row["name"],
                project_type=row["project_type"],
                topic=row["topic"] or "",
                character=row["character"] or "",
                number_n=row["number_n"] or 10,
                system_prompt=row["system_prompt"] or "",
                prefix=row["prefix"] or "",
                suffix=row["suffix"] or "",
                grok_account_id=row["grok_account_id"] or "",
                whisk_account_id=row["whisk_account_id"] or "",
                created_at=_parse_dt(row["created_at"]),
                updated_at=_parse_dt(row["updated_at"]),
                _prompts_json=json.loads(row["prompts_json"] or "[]"),
            )),
            ("asset_metadata", AssetMetadata, lambda row: AssetMetadata(
                id=row["id"],
                project_type=row["project_type"],
                project_name=row["project_name"],
                canonical_dir=row["canonical_dir"],
                filename=row["filename"],
                title=row["title"] or "",
                description=row["description"] or "",
                tags=row["tags"] or "",
                updated_at=_parse_dt(row["updated_at"]),
            )),
        ]

        for table_name, model, row_factory in table_specs:
            if db.query(model).count() > 0:
                continue
            try:
                rows = cur.execute(f"SELECT * FROM {table_name}").fetchall()
            except sqlite3.Error:
                continue
            if not rows:
                continue
            for row in rows:
                obj = row_factory(row)
                if isinstance(obj, UploadQueueItem):
                    obj.platforms = json.loads(row["platform_statuses"] or "{}")
                    obj.target_platforms = json.loads(row["target_platforms"] or "[]")
                    obj.account_map = json.loads(row["account_map"] or "{}")
                    obj.options = json.loads(row["options"] or "{}")
                    obj.job_tags = json.loads(row["job_tags"] or "[]")
                db.add(obj)
            db.commit()
            logger.info(f"[Migration] Imported {len(rows)} row(s) from legacy SQLite table {table_name}")
        conn.close()
    except Exception as e:
        logger.warning(f"[Migration] Legacy SQLite import skipped: {e}")
        db.rollback()


def run_migrations(db):
    ensure_upload_queue_runtime_columns(db)
    if not _env_bool("ENABLE_LEGACY_IMPORTS", "0"):
        logger.info("[Migration] Legacy imports disabled. Set ENABLE_LEGACY_IMPORTS=1 to run bootstrap imports.")
        return
    seed_from_legacy_sqlite(db)
    seed_accounts_from_json(db)
    seed_upload_queue_from_json(db)
    logger.info("[Migration] Migration check complete.")


def ensure_upload_queue_runtime_columns(db):
    try:
        inspector = inspect(db.bind)
        columns = {column["name"] for column in inspector.get_columns("upload_queue")}
    except Exception as e:
        logger.warning(f"[Migration] Could not inspect upload_queue columns: {e}")
        return

    statements: list[str] = []
    if "next_retry_at" not in columns:
        statements.append("ALTER TABLE upload_queue ADD COLUMN next_retry_at TIMESTAMPTZ NULL")
    if "lease_expires_at" not in columns:
        statements.append("ALTER TABLE upload_queue ADD COLUMN lease_expires_at TIMESTAMPTZ NULL")

    if not statements:
        return

    try:
        for statement in statements:
            db.execute(text(statement))
        db.commit()
        logger.info("[Migration] Added runtime queue columns: next_retry_at / lease_expires_at")
    except Exception as e:
        db.rollback()
        logger.error(f"[Migration] Failed to add runtime queue columns: {e}")
