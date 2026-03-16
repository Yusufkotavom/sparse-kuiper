import os
import io
import glob
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload, MediaIoBaseUpload
from fastapi import UploadFile
from backend.core.logger import logger

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CLIENT_SECRETS_FILE = str(BASE_DIR / "client_secrets.json")
GOOGLE_SECRETS_DIR = BASE_DIR / "config" / "google_secrets"

# Full access to Drive + per-file + metadata scopes (align with returned scopes)
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.metadata",
]

def _credentials_from_dict(token_dict: dict) -> Credentials:
    return Credentials(
        token=token_dict.get("token"),
        refresh_token=token_dict.get("refresh_token"),
        token_uri=token_dict.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_dict.get("client_id"),
        client_secret=token_dict.get("client_secret"),
        scopes=token_dict.get("scopes", SCOPES),
    )

def _credentials_to_dict(creds: Credentials) -> dict:
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes) if creds.scopes else SCOPES,
    }

def get_random_secret_file() -> str:
    os.makedirs(GOOGLE_SECRETS_DIR, exist_ok=True)
    secrets = glob.glob(str(GOOGLE_SECRETS_DIR / "*.json"))
    if not secrets:
        if os.path.exists(CLIENT_SECRETS_FILE):
            return CLIENT_SECRETS_FILE
        raise FileNotFoundError(f"No client_secrets files found in {GOOGLE_SECRETS_DIR}")
    return secrets[0]

def get_oauth_flow(client_secrets_path: Optional[str] = None) -> InstalledAppFlow:
    secrets_file = client_secrets_path or CLIENT_SECRETS_FILE
    if not os.path.exists(secrets_file):
        raise FileNotFoundError(f"client_secrets.json not found at {secrets_file}")
    return InstalledAppFlow.from_client_secrets_file(secrets_file, SCOPES)

def generate_auth_url(client_secrets_path: Optional[str] = None) -> Tuple[str, str, str]:
    if not client_secrets_path:
        client_secrets_path = get_random_secret_file()
    flow = get_oauth_flow(client_secrets_path)
    flow.redirect_uri = flow.client_config.get("installed", {}).get("redirect_uris", ["http://localhost"])[0]
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url, state, client_secrets_path

def exchange_code_for_token(code: str, client_secrets_path: Optional[str] = None) -> dict:
    if not client_secrets_path:
        client_secrets_path = CLIENT_SECRETS_FILE
    flow = get_oauth_flow(client_secrets_path)
    flow.redirect_uri = flow.client_config.get("installed", {}).get("redirect_uris", ["http://localhost"])[0]
    if "code=" in code:
        from urllib.parse import urlparse, parse_qs
        parsedParams = parse_qs(urlparse(code).query)
        if "code" in parsedParams:
            code = parsedParams["code"][0]
    flow.fetch_token(code=code)
    creds = flow.credentials
    return _credentials_to_dict(creds)

def refresh_credentials(token_dict: dict) -> dict:
    creds = _credentials_from_dict(token_dict)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        logger.info("[Google Drive] Access token refreshed.")
        return _credentials_to_dict(creds)
    return token_dict

def build_drive_client(token_dict: dict):
    token_dict = refresh_credentials(token_dict)
    creds = _credentials_from_dict(token_dict)
    return build("drive", "v3", credentials=creds), token_dict

def list_files(token_dict: dict, parent_id: Optional[str] = None, q: Optional[str] = None, page_token: Optional[str] = None) -> Dict[str, Any]:
    drive, token_dict = build_drive_client(token_dict)
    query_parts = []
    if parent_id:
        query_parts.append(f"'{parent_id}' in parents")
    if q:
        query_parts.append(q)
    query = " and ".join(query_parts) if query_parts else None
    fields = "nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)"
    resp = drive.files().list(
        q=query,
        fields=fields,
        pageToken=page_token or None,
        spaces="drive",
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
        corpora="allDrives",
    ).execute()
    return {"files": resp.get("files", []), "nextPageToken": resp.get("nextPageToken"), "refreshed_token": token_dict}

def create_folder(token_dict: dict, name: str, parent_id: Optional[str] = None) -> Dict[str, Any]:
    drive, token_dict = build_drive_client(token_dict)
    file_metadata = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    if parent_id:
        file_metadata["parents"] = [parent_id]
    folder = drive.files().create(body=file_metadata, fields="id, name, parents").execute()
    return {"id": folder["id"], "name": folder["name"], "parents": folder.get("parents", []), "refreshed_token": token_dict}

def upload_stream(token_dict: dict, upload_file: UploadFile, name: Optional[str] = None, parent_id: Optional[str] = None) -> Dict[str, Any]:
    drive, token_dict = build_drive_client(token_dict)
    file_metadata = {"name": name or upload_file.filename}
    if parent_id:
        file_metadata["parents"] = [parent_id]
    media = MediaIoBaseUpload(upload_file.file, mimetype=upload_file.content_type or "application/octet-stream", resumable=True)
    created = drive.files().create(body=file_metadata, media_body=media, fields="id, name, mimeType, parents").execute()
    return {"id": created["id"], "name": created["name"], "mimeType": created.get("mimeType", ""), "parents": created.get("parents", []), "refreshed_token": token_dict}

def delete_file(token_dict: dict, file_id: str) -> Dict[str, Any]:
    drive, token_dict = build_drive_client(token_dict)
    drive.files().delete(fileId=file_id).execute()
    return {"status": "deleted", "id": file_id, "refreshed_token": token_dict}

def move_file(token_dict: dict, file_id: str, target_parent_id: str) -> Dict[str, Any]:
    drive, token_dict = build_drive_client(token_dict)
    file = drive.files().get(fileId=file_id, fields="parents").execute()
    previous_parents = ",".join(file.get("parents", []))
    updated = drive.files().update(fileId=file_id, addParents=target_parent_id, removeParents=previous_parents, fields="id, parents").execute()
    return {"id": updated["id"], "parents": updated.get("parents", []), "refreshed_token": token_dict}

def download_file_bytes(token_dict: dict, file_id: str) -> bytes:
    drive, _ = build_drive_client(token_dict)
    request = drive.files().get_media(fileId=file_id, supportsAllDrives=True)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        if status:
            logger.info(f"[Google Drive] Download {int(status.progress() * 100)}%")
    return buf.getvalue()

def download_to_path(token_dict: dict, file_id: str, output_path: str, chunksize: int = 8 * 1024 * 1024) -> int:
    """
    Stream download a Drive file directly to disk. Returns total bytes written.
    Use for large files (videos/images) to avoid keeping them in memory.
    """
    drive, _ = build_drive_client(token_dict)
    request = drive.files().get_media(fileId=file_id, supportsAllDrives=True)
    total = 0
    with open(output_path, "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request, chunksize=chunksize)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                pct = int(status.progress() * 100)
                logger.info(f"[Google Drive] Download {pct}% → {output_path}")
    try:
        total = os.path.getsize(output_path)
    except Exception:
        pass
    return total

def get_file_meta(token_dict: dict, file_id: str) -> dict:
    drive, token_dict = build_drive_client(token_dict)
    meta = drive.files().get(fileId=file_id, fields="id, name, mimeType, parents", supportsAllDrives=True).execute()
    return {"meta": meta, "refreshed_token": token_dict}
