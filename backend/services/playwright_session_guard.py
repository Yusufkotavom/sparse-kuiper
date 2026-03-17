from pathlib import Path
from threading import Lock
import time
from typing import Tuple

from playwright.sync_api import sync_playwright

from backend.core.config import SESSIONS_DIR

_CACHE_LOCK = Lock()
_CACHE: dict[str, tuple[float, bool, str]] = {}


def _get_cached(key: str, ttl_ok_s: int, ttl_fail_s: int) -> tuple[bool, str] | None:
    now = time.time()
    with _CACHE_LOCK:
        hit = _CACHE.get(key)
    if not hit:
        return None
    ts, ok, reason = hit
    ttl = ttl_ok_s if ok else ttl_fail_s
    if now - ts <= ttl:
        return ok, reason
    return None


def _set_cached(key: str, ok: bool, reason: str) -> None:
    with _CACHE_LOCK:
        _CACHE[key] = (time.time(), ok, reason)


def check_grok_session(account_id: str, timeout_ms: int = 12000, headless: bool = True) -> Tuple[bool, str]:
    profile_dir = Path(SESSIONS_DIR) / account_id / "chrome_profile"
    if not profile_dir.exists():
        return False, f"chrome_profile belum ada untuk account_id='{account_id}' di '{profile_dir}'"

    cache_key = f"grok:{account_id}"
    cached = _get_cached(cache_key, ttl_ok_s=600, ttl_fail_s=60)
    if cached is not None:
        return cached

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=headless,
                channel="chrome",
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                ],
                ignore_https_errors=True,
            )
            try:
                page = context.new_page()
                page.goto("https://grok.com/imagine", wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(500)
                current_url = (page.url or "").lower()
            finally:
                context.close()

        if "login" in current_url or "signin" in current_url or "signup" in current_url:
            _set_cached(cache_key, False, "session expired, re-login required")
            return False, "session expired, re-login required"
        _set_cached(cache_key, True, "ok")
        return True, "ok"
    except Exception as e:
        reason = f"login check error: {e}"
        _set_cached(cache_key, False, reason)
        return False, reason


def check_whisk_session(account_id: str, timeout_ms: int = 12000, headless: bool = True) -> Tuple[bool, str]:
    profile_dir = Path(SESSIONS_DIR) / account_id / "chrome_profile"
    if not profile_dir.exists():
        return False, f"chrome_profile belum ada untuk account_id='{account_id}' di '{profile_dir}'"

    cache_key = f"whisk:{account_id}"
    cached = _get_cached(cache_key, ttl_ok_s=600, ttl_fail_s=60)
    if cached is not None:
        return cached

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=headless,
                channel="chrome",
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                ],
                ignore_default_args=["--enable-automation"],
                no_viewport=True,
                ignore_https_errors=True,
            )
            try:
                page = context.new_page()
                page.goto("https://labs.google/fx/tools/flow", wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(500)
                current_url = (page.url or "").lower()
            finally:
                context.close()

        if "accounts.google.com" in current_url or "signin" in current_url:
            _set_cached(cache_key, False, "session expired, re-login required")
            return False, "session expired, re-login required"
        _set_cached(cache_key, True, "ok")
        return True, "ok"
    except Exception as e:
        reason = f"login check error: {e}"
        _set_cached(cache_key, False, reason)
        return False, reason
