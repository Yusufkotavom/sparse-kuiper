from pathlib import Path
from threading import Lock
import time
from typing import Tuple

from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROFILE_DIR = BASE_DIR / "chrome_profile"

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


def check_grok_session(timeout_ms: int = 12000, headless: bool = True) -> Tuple[bool, str]:
    if not PROFILE_DIR.exists():
        return False, "chrome_profile belum ada di server"

    cached = _get_cached("grok", ttl_ok_s=600, ttl_fail_s=60)
    if cached is not None:
        return cached

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(PROFILE_DIR),
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
            _set_cached("grok", False, "session expired, re-login required")
            return False, "session expired, re-login required"

        _set_cached("grok", True, "ok")
        return True, "ok"
    except Exception as e:
        reason = f"login check error: {e}"
        _set_cached("grok", False, reason)
        return False, reason


def check_whisk_session(timeout_ms: int = 12000, headless: bool = True) -> Tuple[bool, str]:
    if not PROFILE_DIR.exists():
        return False, "chrome_profile belum ada di server"

    cached = _get_cached("whisk", ttl_ok_s=600, ttl_fail_s=60)
    if cached is not None:
        return cached

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(PROFILE_DIR),
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
            _set_cached("whisk", False, "session expired, re-login required")
            return False, "session expired, re-login required"

        _set_cached("whisk", True, "ok")
        return True, "ok"
    except Exception as e:
        reason = f"login check error: {e}"
        _set_cached("whisk", False, reason)
        return False, reason
