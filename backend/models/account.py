"""Account ORM Model — replaces data/accounts.json."""
from sqlalchemy import Column, String, Text, Boolean
from sqlalchemy.sql import func
from backend.core.database import Base
from backend.core.sqltypes import JSON_VALUE, UTC_DATETIME


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    platform = Column(String, nullable=False)        # tiktok, youtube, instagram, facebook
    auth_method = Column(String, nullable=False)     # playwright, api
    status = Column(String, default="needs_login")   # active, disconnected, needs_login
    api_key = Column(String, nullable=True)
    api_secret = Column(String, nullable=True)       # Stored as-is; mask on response
    oauth_token_json = Column(JSON_VALUE, nullable=True)   # OAuth/refresh tokens
    channel_title = Column(String, nullable=True)    # YouTube channel name after connect
    last_login = Column(UTC_DATETIME, nullable=True)
    created_at = Column(UTC_DATETIME, server_default=func.now())
    tags = Column(String, nullable=True)             # Comma-separated or JSON string for tags
    notes = Column(Text, nullable=True)              # Notes for this account
    browser_type = Column(String, default="chromium")# chromium, firefox
    proxy = Column(String, nullable=True)            # Proxy URL e.g. http://ip:port
    user_agent = Column(String, nullable=True)       # Custom user agent string
    lightweight_mode = Column(Boolean, default=False)# Optimizations for lower RAM

    def to_dict(self, mask_secret: bool = True):
        return {
            "id": self.id,
            "name": self.name,
            "platform": self.platform,
            "auth_method": self.auth_method,
            "status": self.status,
            "api_key": self.api_key,
            "api_secret": "********" if mask_secret and self.api_secret else self.api_secret,
            "youtube_connected": bool(self.oauth_token_json),
            "channel_title": self.channel_title,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "tags": self.tags,
            "notes": self.notes,
            "browser_type": self.browser_type,
            "proxy": self.proxy,
            "user_agent": self.user_agent,
            "lightweight_mode": self.lightweight_mode
        }
