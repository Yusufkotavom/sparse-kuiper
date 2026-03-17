"""
Accounts router — now backed by SQLite via SQLAlchemy.
All JSON flat-file I/O has been replaced with proper ORM CRUD.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
import os
import sys
import uuid
import subprocess
from datetime import datetime
from sqlalchemy.orm import Session

from backend.core.logger import logger
from backend.core.database import get_db
from backend.models.account import Account
from backend.core.config import settings, BASE_DIR, SESSIONS_DIR
from backend.routers.accounts_schemas import (
    AccountModel,
    OpenUrlPayload,
    YoutubeConnectRequest,
    DriveConnectRequest,
    ExportCredsResponse,
    ImportAccountsPayload,
    FacebookConnectRequest,
    FacebookSelectPageRequest,
)

router = APIRouter()

# Session directories (Playwright auth)
os.makedirs(str(SESSIONS_DIR), exist_ok=True)
LOGIN_SCRIPT = str(BASE_DIR / "backend" / "services" / "playwright_login.py")


@router.get("/")
async def get_accounts(db: Session = Depends(get_db)):
    accounts = db.query(Account).all()
    return {"accounts": [acc.to_dict(mask_secret=True) for acc in accounts]}


@router.get("/youtube-secrets")
async def get_youtube_secrets():
    import glob
    secrets_dir = BASE_DIR / "config" / "youtube_secrets"
    secrets = glob.glob(str(secrets_dir / "*.json"))
    return {"secrets": [os.path.basename(s) for s in secrets]}
@router.post("/")
async def add_account(account: AccountModel, db: Session = Depends(get_db)):
    acc_id = account.id or f"{account.platform}_{uuid.uuid4().hex[:8]}"
    db_account = Account(
        id=acc_id,
        name=account.name,
        platform=account.platform,
        auth_method=account.auth_method,
        status=account.status,
        api_key=account.api_key,
        api_secret=account.api_secret,
        tags=account.tags,
        notes=account.notes,
        browser_type=account.browser_type or "chromium",
        proxy=account.proxy,
        user_agent=account.user_agent,
        lightweight_mode=account.lightweight_mode or False,
        last_login=datetime.fromisoformat(account.last_login) if account.last_login else None,
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return {"message": "Account added successfully", "account": db_account.to_dict(mask_secret=True)}

@router.put("/{account_id}")
async def update_account(account_id: str, account: AccountModel, db: Session = Depends(get_db)):
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")

    db_account.name = account.name
    db_account.platform = account.platform
    db_account.auth_method = account.auth_method
    if account.api_key is not None:
        db_account.api_key = account.api_key
    if account.api_secret is not None:
        db_account.api_secret = account.api_secret
    if account.tags is not None:
        db_account.tags = account.tags
    if account.notes is not None:
        db_account.notes = account.notes
    if account.browser_type is not None:
        db_account.browser_type = account.browser_type
    if account.proxy is not None:
        db_account.proxy = account.proxy
    if account.user_agent is not None:
        db_account.user_agent = account.user_agent
    if account.lightweight_mode is not None:
        db_account.lightweight_mode = account.lightweight_mode

    db.commit()
    db.refresh(db_account)
    return {"message": "Account updated successfully", "account": db_account.to_dict(mask_secret=True)}


@router.delete("/{account_id}")
async def delete_account(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    db.delete(account)
    db.commit()

    # Optional: Delete playwright session if it exists
    session_path = os.path.join(str(SESSIONS_DIR), account_id)
    if os.path.exists(session_path):
        import shutil
        shutil.rmtree(session_path, ignore_errors=True)

    return {"message": "Account deleted successfully"}


@router.post("/{account_id}/login")
async def trigger_login(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.auth_method == "playwright":
        kwargs = {}
        if os.name == "nt":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS

        log_path = os.path.join(os.path.dirname(LOGIN_SCRIPT), "playwright_login_error.log")
        subprocess.Popen(
            [sys.executable, LOGIN_SCRIPT, account_id, account.platform, str(SESSIONS_DIR)],
            cwd=str(BASE_DIR),
            stdout=open(log_path, "w"),
            stderr=subprocess.STDOUT,
            **kwargs,
        )
        return {"message": "Login browser opened. Log in manually — status will auto-update within 5 minutes."}

    return {"message": "API login methods are handled via credentials update."}

@router.post("/{account_id}/playwright/launch")
async def launch_playwright_manual(account_id: str, db: Session = Depends(get_db)):
    """Launch the account's Chromium profile manually and leave it open."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    kwargs = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS

    log_path = os.path.join(os.path.dirname(LOGIN_SCRIPT), "playwright_login_error.log")
    
    # Passing "true" as the 4th argument activates manual_mode in playwright_login.py
    subprocess.Popen(
        [sys.executable, LOGIN_SCRIPT, account_id, account.platform, str(SESSIONS_DIR), "true"],
        cwd=str(BASE_DIR),
        stdout=open(log_path, "a"),
        stderr=subprocess.STDOUT,
        **kwargs,
    )
    return {"message": "Browser profile opened in manual mode."}

@router.post("/{account_id}/refresh-status")
async def refresh_account_status(account_id: str, db: Session = Depends(get_db)):
    """Manually refresh account status by checking if cookies.txt exists."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    cookies_path = os.path.join(str(SESSIONS_DIR), account_id, "cookies.txt")
    if os.path.exists(cookies_path):
        account.status = "active"
        account.last_login = datetime.now()
        db.commit()
        logger.info(f"[Accounts] {account_id} manually refreshed → active (cookies found)")
        return {"status": "active", "message": "Cookies found — account marked as active."}

    return {"status": account.status, "message": "No cookies.txt found. Please log in first."}


# ─── YouTube OAuth ────────────────────────────────────────────────────────────

@router.get("/{account_id}/youtube/auth-url")
async def get_youtube_auth_url(account_id: str, db: Session = Depends(get_db)):
    """Generate a Google OAuth authorization URL for YouTube access."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.platform != "youtube":
        raise HTTPException(status_code=400, detail="Account is not a YouTube account")

    try:
        from backend.services.uploaders.youtube_uploader import generate_auth_url
        auth_url, state, secret_path, code_verifier = generate_auth_url()
        account.api_key = secret_path
        if code_verifier:
            account.api_secret = code_verifier
        db.commit()
        
        return {
            "auth_url": auth_url,
            "instructions": (
                "1. Open the URL below in your browser\n"
                "2. Log in with your Google/YouTube account\n"
                "3. Grant access when prompted\n"
                "4. Copy the authorization code shown\n"
                "5. Paste it in the Connect form"
            )
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"[YouTube OAuth] Error generating auth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{account_id}/youtube/connect")
async def connect_youtube(account_id: str, req: YoutubeConnectRequest, db: Session = Depends(get_db)):
    """Exchange authorization code for tokens and save to account."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.platform != "youtube":
        raise HTTPException(status_code=400, detail="Account is not a YouTube account")

    try:
        from backend.services.uploaders.youtube_uploader import exchange_code_for_token, get_channel_info
        import json

        # Exchange code for tokens using the stored secret path
        secret_path = account.api_key or None
        token_dict = exchange_code_for_token(req.code.strip(), client_secrets_path=secret_path, code_verifier=account.api_secret or None)

        # Fetch channel info
        channel_info = get_channel_info(token_dict)

        # Save to DB
        account.oauth_token_json = json.dumps(token_dict)
        account.channel_title = channel_info.get("channel_title", "")
        account.status = "active"
        account.last_login = datetime.now()
        account.api_secret = None
        db.commit()

        logger.info(f"[YouTube OAuth] Account {account_id} connected: {account.channel_title}")
        return {
            "status": "active",
            "channel_title": account.channel_title,
            "channel_id": channel_info.get("channel_id", ""),
            "message": f"Successfully connected to YouTube channel: {account.channel_title}"
        }
    except Exception as e:
        logger.error(f"[YouTube OAuth] Error connecting account {account_id}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect: {str(e)}")


@router.post("/{account_id}/youtube/disconnect")
async def disconnect_youtube(account_id: str, db: Session = Depends(get_db)):
    """Revoke and remove stored YouTube OAuth token."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    account.oauth_token_json = None
    account.channel_title = None
    account.status = "needs_login"
    db.commit()
    logger.info(f"[YouTube OAuth] Account {account_id} disconnected.")
    return {"status": "disconnected", "message": "YouTube disconnected."}

# ─── Google Drive OAuth ─────────────────────────────────────────────────────────

@router.get("/{account_id}/drive/auth-url")
async def get_drive_auth_url(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.platform != "google_drive":
        raise HTTPException(status_code=400, detail="Account is not a Google Drive account")
    try:
        from backend.services.google_drive_service import generate_auth_url
        auth_url, state, secret_path = generate_auth_url()
        account.api_key = secret_path
        db.commit()
        return {
            "auth_url": auth_url,
            "instructions": (
                "1. Open the URL below in your browser\n"
                "2. Log in with your Google account\n"
                "3. Grant access to Google Drive\n"
                "4. Copy the authorization code\n"
                "5. Paste it in the Connect form"
            )
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"[Drive OAuth] Error generating auth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{account_id}/drive/connect")
async def connect_drive(account_id: str, req: DriveConnectRequest, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.platform != "google_drive":
        raise HTTPException(status_code=400, detail="Account is not a Google Drive account")
    try:
        from backend.services.google_drive_service import exchange_code_for_token
        import json
        secret_path = account.api_key or None
        token_dict = exchange_code_for_token(req.code.strip(), client_secrets_path=secret_path)
        account.oauth_token_json = json.dumps(token_dict)
        account.channel_title = "Google Drive"
        account.status = "active"
        account.last_login = datetime.now()
        db.commit()
        logger.info(f"[Drive OAuth] Account {account_id} connected.")
        return {"status": "active", "message": "Google Drive connected."}
    except Exception as e:
        logger.error(f"[Drive OAuth] Error connecting account {account_id}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect: {str(e)}")

@router.get("/export-creds", response_model=ExportCredsResponse)
async def export_credentials(include_tokens: bool = True, db: Session = Depends(get_db)):
    rows = db.query(Account).all()
    data = []
    for acc in rows:
        item = acc.to_dict(mask_secret=not include_tokens)
        if include_tokens:
            item["oauth_token_json"] = acc.oauth_token_json
            item["api_secret"] = acc.api_secret
        data.append(item)
    return {"accounts": data}

@router.post("/import-creds")
async def import_credentials(payload: ImportAccountsPayload, db: Session = Depends(get_db)):
    imported = 0
    updated = 0
    from backend.models.account import Account as Acc
    for item in payload.accounts:
        acc_id = item.get("id")
        if not acc_id:
            continue
        row = db.query(Acc).filter(Acc.id == acc_id).first()
        if not row:
            row = Acc(
                id=acc_id,
                name=item.get("name") or "",
                platform=item.get("platform") or "",
                auth_method=item.get("auth_method") or "api",
            )
            db.add(row)
            imported += 1
        row.status = item.get("status") or row.status
        row.api_key = item.get("api_key") or row.api_key
        row.api_secret = item.get("api_secret") or row.api_secret
        row.oauth_token_json = item.get("oauth_token_json") or row.oauth_token_json
        row.channel_title = item.get("channel_title") or row.channel_title
        row.tags = item.get("tags") or row.tags
        row.notes = item.get("notes") or row.notes
        row.browser_type = item.get("browser_type") or row.browser_type
        row.proxy = item.get("proxy") or row.proxy
        row.user_agent = item.get("user_agent") or row.user_agent
        updated += 1
    db.commit()
    return {"message": "Import completed", "imported": imported, "updated": updated}

# ─── Facebook OAuth ────────────────────────────────────────────────────────────

@router.get("/{account_id}/facebook/auth-url")
async def get_facebook_auth_url(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.platform != "facebook" or account.auth_method != "api":
        raise HTTPException(status_code=400, detail="Account is not configured for Facebook API")
    if not account.api_key or not account.api_secret:
        raise HTTPException(status_code=400, detail="App ID and App Secret must be set first")

    try:
        from backend.services.uploaders.facebook_uploader import generate_auth_url
        auth_url, state = generate_auth_url(account.api_key)
        return {
            "auth_url": auth_url,
            "instructions": (
                "1. Open the URL below in your browser\n"
                "2. Log in with your Facebook account\n"
                "3. Grant access to your pages when prompted\n"
                "4. Copy the URL you are redirected to (or the authorization code)\n"
                "5. Paste it in the Connect form"
            )
        }
    except Exception as e:
        logger.error(f"[Facebook OAuth] Error generating auth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{account_id}/facebook/connect")
async def connect_facebook(account_id: str, req: FacebookConnectRequest, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    try:
        import json
        from backend.services.uploaders.facebook_uploader import exchange_code_for_token
        token_dict = exchange_code_for_token(req.code.strip(), account.api_key, account.api_secret)
        pages = token_dict.get("pages", [])
        
        account.oauth_token_json = json.dumps(token_dict)
        account.status = "needs_page"
        db.commit()

        logger.info(f"[Facebook OAuth] Account {account_id} fetched {len(pages)} pages")
        return {
            "status": "needs_page",
            "pages": [{"id": p.get("id"), "name": p.get("name")} for p in pages],
            "message": "Please select a page to connect."
        }
    except Exception as e:
        logger.error(f"[Facebook OAuth] Error connecting account {account_id}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to connect: {str(e)}")

@router.post("/{account_id}/facebook/select-page")
async def select_facebook_page(account_id: str, req: FacebookSelectPageRequest, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    import json
    if not account.oauth_token_json:
         raise HTTPException(status_code=400, detail="Not authorized yet")

    token_dict = json.loads(account.oauth_token_json)
    pages = token_dict.get("pages", [])
    
    selected_page = next((p for p in pages if p.get("id") == req.page_id), None)
    if not selected_page:
        raise HTTPException(status_code=400, detail="Invalid page selected")
        
    token_dict["selected_page_id"] = req.page_id
    account.oauth_token_json = json.dumps(token_dict)
    account.channel_title = selected_page.get("name")
    account.status = "active"
    account.last_login = datetime.now()
    db.commit()

    logger.info(f"[Facebook OAuth] Account {account_id} connected to page: {account.channel_title}")
    return {
        "status": "active",
        "channel_title": account.channel_title,
        "message": f"Successfully connected to Facebook page: {account.channel_title}"
    }

@router.post("/{account_id}/facebook/disconnect")
async def disconnect_facebook(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    account.oauth_token_json = None
    account.channel_title = None
    account.status = "needs_login"
    db.commit()
    logger.info(f"[Facebook OAuth] Account {account_id} disconnected.")
    return {"status": "disconnected", "message": "Facebook disconnected."}
