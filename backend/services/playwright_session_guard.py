from pathlib import Path
from typing import Tuple

from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROFILE_DIR = BASE_DIR / "chrome_profile"


def check_grok_session(timeout_ms: int = 12000, headless: bool = True) -> Tuple[bool, str]:
    if not PROFILE_DIR.exists():
        return False, "chrome_profile belum ada di server"
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
            page = context.new_page()
            page.goto("https://grok.com/imagine", wait_until="domcontentloaded", timeout=timeout_ms)
            try:
                page.locator('textarea, [contenteditable="true"]').last.wait_for(
                    state="visible",
                    timeout=timeout_ms,
                )
                context.close()
                return True, "ok"
            except Exception:
                current_url = (page.url or "").lower()
                context.close()
                if "login" in current_url or "signin" in current_url or "signup" in current_url:
                    return False, "session expired, re-login required"
                return False, "gagal memverifikasi editor Grok"
    except Exception as e:
        return False, f"login check error: {e}"


def check_whisk_session(timeout_ms: int = 12000, headless: bool = True) -> Tuple[bool, str]:
    if not PROFILE_DIR.exists():
        return False, "chrome_profile belum ada di server"
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
            page = context.new_page()
            page.goto("https://labs.google/fx/tools/flow", wait_until="domcontentloaded", timeout=timeout_ms)
            try:
                page.locator('div[role="textbox"][data-slate-editor="true"]').first.wait_for(
                    state="visible",
                    timeout=timeout_ms,
                )
                context.close()
                return True, "ok"
            except Exception:
                current_url = (page.url or "").lower()
                context.close()
                if "accounts.google.com" in current_url or "signin" in current_url:
                    return False, "session expired, re-login required"
                return False, "gagal memverifikasi editor Whisk"
    except Exception as e:
        return False, f"login check error: {e}"
