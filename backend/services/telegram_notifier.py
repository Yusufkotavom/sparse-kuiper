from __future__ import annotations

from typing import Any

import requests

from backend.core.config import settings
from backend.core.logger import logger


def _clean(value: Any) -> str:
    return str(value or "").strip()


def get_telegram_config() -> dict[str, Any]:
    token = _clean(settings.telegram_bot_token)
    chat_id = _clean(settings.telegram_chat_id)
    return {
        "enabled": bool(settings.telegram_notifications_enabled),
        "has_token": bool(token),
        "has_chat_id": bool(chat_id),
        "masked_token": (("*" * max(0, len(token) - 4)) + token[-4:]) if token else "",
        "chat_id": chat_id,
    }


def is_telegram_ready() -> bool:
    config = get_telegram_config()
    return bool(config["enabled"] and config["has_token"] and config["has_chat_id"])


def send_telegram_message(text: str) -> bool:
    token = _clean(settings.telegram_bot_token)
    chat_id = _clean(settings.telegram_chat_id)

    if not settings.telegram_notifications_enabled:
        logger.info("[Telegram] Notification skipped because integration is disabled.")
        return False

    if not token or not chat_id:
        logger.warning("[Telegram] Notification skipped because bot token/chat id is missing.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }

    try:
        response = requests.post(url, json=payload, timeout=15)
        response.raise_for_status()
        data = response.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("description") or "Telegram API returned ok=false")
        return True
    except Exception as exc:
        logger.error(f"[Telegram] Failed to send notification: {exc}")
        return False
