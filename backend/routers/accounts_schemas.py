from pydantic import BaseModel
from typing import List, Optional


class AccountModel(BaseModel):
    id: Optional[str] = None
    name: str
    platform: str
    auth_method: str
    api_secret: Optional[str] = None
    last_login: Optional[str] = None
    status: str = "needs_login"
    api_key: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    browser_type: Optional[str] = "chromium"
    proxy: Optional[str] = None
    user_agent: Optional[str] = None
    lightweight_mode: Optional[bool] = False
    oauth_token_json: Optional[str] = None
    channel_title: Optional[str] = None
    created_at: Optional[str] = None
    youtube_connected: Optional[bool] = None


class OpenUrlPayload(BaseModel):
    url: str


class YoutubeConnectRequest(BaseModel):
    code: str


class DriveConnectRequest(BaseModel):
    code: str


class ExportCredsResponse(BaseModel):
    accounts: List[dict]


class ImportAccountsPayload(BaseModel):
    accounts: List[dict]


class FacebookConnectRequest(BaseModel):
    code: str


class FacebookSelectPageRequest(BaseModel):
    page_id: str
