"""Helpers to bootstrap OAuth secret files from Render Secret Files locations."""

from __future__ import annotations

import shutil
from pathlib import Path

from backend.core.config import BASE_DIR
from backend.core.logger import logger


YOUTUBE_SECRETS_DIR = BASE_DIR / "config" / "youtube_secrets"
GOOGLE_SECRETS_DIR = BASE_DIR / "config" / "google_secrets"


def _collect_secret_candidates() -> list[Path]:
    sources = [Path("/etc/secrets"), BASE_DIR]
    found: list[Path] = []

    for src in sources:
        if not src.exists() or not src.is_dir():
            continue

        explicit = src / "client_secrets.json"
        if explicit.exists() and explicit.is_file():
            found.append(explicit)

        for p in src.glob("client_secret_*.apps.googleusercontent.com*.json"):
            if p.is_file():
                found.append(p)

        for p in src.glob("client_secret_*.apps.googleusercontent.com*.js"):
            if p.is_file():
                logger.warning(
                    "[Secrets] Found OAuth secret with .js extension (%s). "
                    "Google client secret file must be .json",
                    str(p),
                )

    # stable unique order
    unique: list[Path] = []
    seen: set[str] = set()
    for p in found:
        s = str(p.resolve())
        if s not in seen:
            unique.append(p)
            seen.add(s)
    return unique


def bootstrap_oauth_secret_files() -> int:
    """Copy discovered OAuth client secret JSON files into expected config folders.

    Returns number of files copied.
    """
    candidates = _collect_secret_candidates()
    if not candidates:
        logger.info("[Secrets] No OAuth secret JSON files discovered in /etc/secrets or app root")
        return 0

    copied = 0
    for target_dir in (YOUTUBE_SECRETS_DIR, GOOGLE_SECRETS_DIR):
        target_dir.mkdir(parents=True, exist_ok=True)
        for src in candidates:
            dst = target_dir / src.name
            if dst.exists():
                continue
            try:
                shutil.copy2(src, dst)
                copied += 1
            except Exception as exc:
                logger.error(f"[Secrets] Failed copying {src} -> {dst}: {exc}")

    if copied:
        logger.info(f"[Secrets] Bootstrapped {copied} OAuth secret file copy/copies")
    return copied
