"""
YouTube Uploader — OAuth 2.0 + YouTube Data API v3
Handles authorization flow, token storage, and video upload.
"""
import json
import os
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from backend.core.logger import logger

# Scopes required for uploading
SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly"]

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
CLIENT_SECRETS_FILE = str(BASE_DIR / "client_secrets.json")
YOUTUBE_SECRETS_DIR = BASE_DIR / "config" / "youtube_secrets"

import glob
import random

def _normalize_publish_at(schedule: str) -> Optional[str]:
    s = (schedule or "").strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except Exception:
        try:
            dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        except Exception:
            try:
                dt = datetime.strptime(s, "%Y-%m-%d %H:%M")
            except Exception:
                return None
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def get_random_secret_file() -> str:
    os.makedirs(YOUTUBE_SECRETS_DIR, exist_ok=True)
    secrets = glob.glob(str(YOUTUBE_SECRETS_DIR / "*.json"))
    if not secrets:
        if os.path.exists(CLIENT_SECRETS_FILE):
             return CLIENT_SECRETS_FILE
        raise FileNotFoundError(f"No client_secrets files found in {YOUTUBE_SECRETS_DIR}")
    return random.choice(secrets)

# Privacy options
PRIVACY_OPTIONS = ["public", "unlisted", "private"]

# YouTube categories (common ones)
CATEGORIES = {
    "1": "Film & Animation",
    "2": "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "19": "Travel & Events",
    "20": "Gaming",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Nonprofits & Activism",
}


def _credentials_from_dict(token_dict: dict) -> Credentials:
    """Rebuild Credentials object from stored JSON dict."""
    return Credentials(
        token=token_dict.get("token"),
        refresh_token=token_dict.get("refresh_token"),
        token_uri=token_dict.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_dict.get("client_id"),
        client_secret=token_dict.get("client_secret"),
        scopes=token_dict.get("scopes", SCOPES),
    )


def _credentials_to_dict(creds: Credentials) -> dict:
    """Serialize Credentials to a storable dict."""
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes) if creds.scopes else SCOPES,
    }


def get_oauth_flow(client_secrets_path: Optional[str] = None) -> InstalledAppFlow:
    """Create an OAuth flow from the client secrets file."""
    secrets_file = client_secrets_path or CLIENT_SECRETS_FILE
    if not os.path.exists(secrets_file):
        raise FileNotFoundError(f"client_secrets.json not found at {secrets_file}")
    return InstalledAppFlow.from_client_secrets_file(secrets_file, SCOPES)


def generate_auth_url(client_secrets_path: Optional[str] = None) -> tuple[str, str, str, Optional[str]]:
    """
    Generate an OAuth authorization URL.
    Returns (auth_url, state, client_secrets_path)
    """
    if not client_secrets_path:
        client_secrets_path = get_random_secret_file()
        
    flow = get_oauth_flow(client_secrets_path)
    flow.redirect_uri = flow.client_config.get("installed", {}).get("redirect_uris", ["http://localhost"])[0]
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # Force refresh_token to always be returned
    )
    code_verifier = getattr(flow, "code_verifier", None)
    return auth_url, state, client_secrets_path, code_verifier


def exchange_code_for_token(code: str, client_secrets_path: Optional[str] = None, code_verifier: Optional[str] = None) -> dict:
    """
    Exchange authorization code for access + refresh tokens.
    Returns token dict suitable for storing in DB.
    """
    if not client_secrets_path:
        client_secrets_path = CLIENT_SECRETS_FILE
    flow = get_oauth_flow(client_secrets_path)
    flow.redirect_uri = flow.client_config.get("installed", {}).get("redirect_uris", ["http://localhost"])[0]
    # In case the user pasted the entire URL (http://localhost/?code=4/1AX...), parse out the code
    if "code=" in code:
        from urllib.parse import urlparse, parse_qs
        parsedParams = parse_qs(urlparse(code).query)
        if "code" in parsedParams:
            code = parsedParams["code"][0]
            
    if code_verifier:
        try:
            setattr(flow, "code_verifier", code_verifier)
        except Exception:
            pass
        try:
            flow.fetch_token(code=code, code_verifier=code_verifier)
        except TypeError:
            flow.fetch_token(code=code)
    else:
        flow.fetch_token(code=code)
    creds = flow.credentials
    return _credentials_to_dict(creds)


def get_channel_info(token_dict: dict) -> dict:
    """Fetch authenticated channel title and ID."""
    creds = _credentials_from_dict(token_dict)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    youtube = build("youtube", "v3", credentials=creds)
    resp = youtube.channels().list(part="snippet", mine=True).execute()
    items = resp.get("items", [])
    if items:
        snippet = items[0]["snippet"]
        return {
            "channel_id": items[0]["id"],
            "channel_title": snippet.get("title", ""),
            "thumbnail": snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
        }
    return {"channel_id": "", "channel_title": "", "thumbnail": ""}


def refresh_credentials(token_dict: dict) -> dict:
    """Refresh the access token if needed and return updated dict."""
    creds = _credentials_from_dict(token_dict)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        logger.info("[YouTube] Access token refreshed.")
        return _credentials_to_dict(creds)
    return token_dict


def upload_video(
    token_dict: dict,
    video_path: str,
    title: str,
    description: str,
    tags: str = "",
    privacy: str = "private",
    category_id: str = "22",
    schedule: Optional[str] = None
) -> dict:
    """
    Upload a video to YouTube.
    Returns: { video_id, url, status }
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    if privacy not in PRIVACY_OPTIONS:
        privacy = "private"

    publish_at = _normalize_publish_at(schedule) if schedule else None
    if publish_at:
        privacy = "private"

    # Refresh token if needed
    token_dict = refresh_credentials(token_dict)
    creds = _credentials_from_dict(token_dict)

    youtube = build("youtube", "v3", credentials=creds)

    # Parse tags
    tag_list = [t.strip().lstrip("#") for t in tags.replace(",", " ").split() if t.strip()]

    status = {
        "privacyStatus": privacy,
        "selfDeclaredMadeForKids": False,
    }
    if publish_at:
        status["publishAt"] = publish_at
    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": tag_list[:500],
            "categoryId": category_id,
        },
        "status": status,
    }

    media = MediaFileUpload(
        video_path,
        mimetype="video/*",
        resumable=True,
        chunksize=5 * 1024 * 1024,  # 5MB chunks
    )

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            progress = int(status.progress() * 100)
            logger.info(f"[YouTube Upload] Progress: {progress}%")

    video_id = response.get("id", "")
    logger.info(f"[YouTube Upload] Done: https://youtu.be/{video_id}")

    return {
        "video_id": video_id,
        "url": f"https://youtu.be/{video_id}",
        "status": "uploaded",
        "refreshed_token": token_dict,
    }
