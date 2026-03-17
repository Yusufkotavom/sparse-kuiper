"""
Standalone Playwright login script for account cookie extraction.
Launched as a completely separate OS process by accounts.py.

Uses sync_playwright with launch_persistent_context so:
- Real Chrome profile (no "Debugger paused" tab)
- Window is maximized
- Session persists across reloads (QR code scan works)

Usage:
    python playwright_login.py <account_id> <platform> <sessions_dir> [manual_mode]
"""

import sys
import os
import json
import time
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent.parent


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


# Session-cookie names that confirm a logged-in user per platform
SESSION_COOKIES = {
    "tiktok": {"sessionid", "sid_guard", "uid_tt"},
    "instagram": {"sessionid", "ds_user_id"},
    "facebook": {"c_user", "xs"},
    "youtube": {"SID", "HSID", "SSID"},
}

# URL fragments that mean we're NOT logged in yet
LOGIN_URL_FRAGMENTS = {
    "tiktok": ["/login", "/signup", "accounts/login"],
    "instagram": ["accounts/login", "accounts/emailsignup"],
    "facebook": ["/login", "/r.php"],
    "youtube": ["accounts.google.com/signin", "accounts.google.com/o/oauth2"],
    "grok": ["login", "signin", "signup"],
    "whisk": ["accounts.google.com", "signin"],
}


def is_logged_in(context, platform: str) -> bool:
    """Check login by looking for platform-specific session cookies."""
    required = SESSION_COOKIES.get(platform, set())
    if not required:
        return False
    try:
        cookies = context.cookies()
        found = {c["name"] for c in cookies}
        return bool(required & found)  # Any session cookie found = logged in
    except Exception:
        return False


def run_login(account_id: str, platform: str, sessions_dir: str, manual_mode: bool = False):
    from playwright.sync_api import sync_playwright

    session_dir = os.path.join(sessions_dir, account_id)
    os.makedirs(session_dir, exist_ok=True)
    cookies_path = os.path.join(session_dir, "cookies.txt")

    accounts_file = str(Path(sessions_dir).parent / "accounts.json")

    login_urls = {
        "tiktok": "https://www.tiktok.com/login",
        "instagram": "https://www.instagram.com/accounts/login/",
        "facebook": "https://www.facebook.com/login",
        "youtube": "https://accounts.google.com/signin",
        "grok": "https://grok.com/imagine",
        "whisk": "https://labs.google/fx/tools/flow",
    }
    url = login_urls.get(platform, "https://google.com")

    # Fetch account configuration for this specific session
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if project_root not in sys.path:
        sys.path.append(project_root)

    browser_type = "chromium"
    proxy_server = None
    user_agent = None
    lightweight_mode = False

    try:
        from backend.core.database import SessionLocal
        from backend.models.account import Account
        db = SessionLocal()
        db_acc = db.query(Account).filter(Account.id == account_id).first()
        if db_acc:
            browser_type = db_acc.browser_type or "chromium"
            proxy_server = db_acc.proxy
            user_agent = db_acc.user_agent
            lightweight_mode = db_acc.lightweight_mode
        db.close()
    except Exception as e:
        log(f"Warning: Could not fetch account settings DB: {e}")

    log(f"Opening {browser_type} for {platform} login...")

    with sync_playwright() as p:
        args = [
            "--start-maximized",
            "--disable-blink-features=AutomationControlled",
        ]

        # Apply lightweight flags only if chromium
        if lightweight_mode and browser_type == "chromium":
            log("Lightweight mode active (minimal RAM flags applied)")
            args.extend([
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-background-networking",
                "--disable-default-apps",
                "--disable-extensions",
                "--disable-sync",
            ])

        kwargs = {
            "headless": False,
            "args": args,
            "no_viewport": True,
        }

        if proxy_server:
            kwargs["proxy"] = {"server": proxy_server}
            log(f"Using proxy: {proxy_server.split('@')[-1] if '@' in proxy_server else proxy_server}")

        if user_agent:
            kwargs["user_agent"] = user_agent
            log(f"Using custom User-Agent: {user_agent[:40]}...")

        if browser_type == "firefox":
            user_data_dir = os.path.join(session_dir, "firefox_profile")
            os.makedirs(user_data_dir, exist_ok=True)
            kwargs["user_data_dir"] = user_data_dir
            context = p.firefox.launch_persistent_context(**kwargs)
        else:
            user_data_dir = os.path.join(session_dir, "chrome_profile")
            os.makedirs(user_data_dir, exist_ok=True)
            kwargs["user_data_dir"] = user_data_dir
            kwargs["ignore_default_args"] = ["--enable-automation"]
            try:
                context = p.chromium.launch_persistent_context(**kwargs, channel="chrome")
            except Exception:
                context = p.chromium.launch_persistent_context(**kwargs)
        page = context.new_page()
        page.goto(url)

        if manual_mode:
            log(f"Manual mode activated for {platform}. Browser will remain open indefinitely until you close it.")
            log("Waiting for browser to be closed...")
            try:
                page.wait_for_timeout(86400000) # Wait 24 hours or until naturally closed
            except Exception:
                pass
            log("Manual session ended by user. Saving current cookies as final step...")
            logged_in = True # We just always export cookies on exit for manual mode
        else:
            log("Waiting for login (up to 5 minutes, checking every 3s)...")
            logged_in = False
    
            for i in range(100):  # 100 x 3s = 300s = 5 min
                time.sleep(3)
    
                # Primary check: session cookies (most reliable)
                if is_logged_in(context, platform):
                    log(f"✅ Session cookie detected — login confirmed!")
                    logged_in = True
                    break
    
                # Fallback URL check
                try:
                    pages = context.pages
                    current_urls = [pg.url for pg in pages if pg.url]
                except Exception:
                    current_urls = []
    
                for cur_url in current_urls:
                    login_frags = LOGIN_URL_FRAGMENTS.get(platform, [])
                    on_login_page = any(frag in cur_url for frag in login_frags)
                    on_platform = platform in cur_url.replace("accounts.google.com", "")
    
                    if on_platform and not on_login_page and cur_url not in ("about:blank", ""):
                        log(f"✅ URL-based login detected: {cur_url}")
                        logged_in = True
                        break
    
                if logged_in:
                    break
    
                if i % 10 == 0 and i > 0:
                    log(f"Still waiting... ({i * 3}s elapsed)")

        if logged_in:
            time.sleep(2)  # Let cookies settle

            raw_cookies = context.cookies()
            netscape_lines = ["# Netscape HTTP Cookie File"]
            for c in raw_cookies:
                domain = c.get("domain", "")
                flag = "TRUE" if domain.startswith(".") else "FALSE"
                path_val = c.get("path", "/")
                secure = "TRUE" if c.get("secure") else "FALSE"
                expiry = int(c.get("expires", 0)) if c.get("expires", 0) > 0 else 2147483647
                name = c.get("name", "")
                value = c.get("value", "")
                netscape_lines.append(f"{domain}\t{flag}\t{path_val}\t{secure}\t{expiry}\t{name}\t{value}")

            with open(cookies_path, "w", encoding="utf-8") as f:
                f.write("\n".join(netscape_lines))

            log(f"✅ {len(raw_cookies)} cookies saved → {cookies_path}")

            # Also export session cookies as JSON for easier debugging
            session_json_path = os.path.join(session_dir, "session_cookies.json")
            with open(session_json_path, "w", encoding="utf-8") as f:
                json.dump(raw_cookies, f, indent=2)

            # Update account status in the SQLite database
            try:
                # Need to add backend to sys.path so we can import from backend
                project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                if project_root not in sys.path:
                    sys.path.append(project_root)
                    
                from backend.core.database import SessionLocal
                from backend.models.account import Account
                
                db = SessionLocal()
                try:
                    db_acc = db.query(Account).filter(Account.id == account_id).first()
                    if db_acc:
                        db_acc.status = "active"
                        db_acc.last_login = datetime.now()
                        db.commit()
                        log("✅ Account status → active in database")
                    else:
                        log(f"⚠️ Account {account_id} not found in database")
                finally:
                    db.close()
            except Exception as e:
                log(f"⚠️  Could not update SQLite database: {e}")
        else:
            log("⏰ TIMEOUT: No login detected within 5 minutes. No cookies saved.")
            log("   Tip: After logging in, wait a moment for the page to redirect.")

        context.close()


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: playwright_login.py <account_id> <platform> <sessions_dir>")
        sys.exit(1)

    account_id = sys.argv[1]
    platform = sys.argv[2]
    sessions_dir = sys.argv[3]
    manual_mode = (len(sys.argv) > 4 and sys.argv[4].lower() == "true")

    try:
        run_login(account_id, platform, sessions_dir, manual_mode=manual_mode)
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
