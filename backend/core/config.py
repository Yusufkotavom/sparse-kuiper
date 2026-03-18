import os
import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_FILE = BASE_DIR / "config.json"
PROJECTS_DIR = BASE_DIR / "projects"
VIDEO_PROJECTS_DIR = BASE_DIR / "video_projects"
UPLOAD_QUEUE_DIR = BASE_DIR / "upload_queue"
SESSIONS_DIR = BASE_DIR / "data" / "sessions"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"))

    app_name: str = "AIO Super App API"
    environment: str = "development"
    database_url: str = ""

    database_pool_size: int = 10
    database_max_overflow: int = 20
    enable_legacy_imports: bool = False
    
    # Placeholder for Groq API Key (loaded from config.json or env)
    groq_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""

    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = ""
    azure_openai_api_version: str = ""

settings = Settings()

def load_local_config():
    """Loads API keys and settings from the legacy config.json if it exists."""
    global settings
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                if "groq_api_key" in data:
                    settings.groq_api_key = data["groq_api_key"]
                if "openai_api_key" in data:
                    settings.openai_api_key = data["openai_api_key"]
                if "gemini_api_key" in data:
                    settings.gemini_api_key = data["gemini_api_key"]

                azure = data.get("azure_openai", {}) if isinstance(data.get("azure_openai", {}), dict) else {}
                if "api_key" in azure:
                    settings.azure_openai_api_key = azure.get("api_key", "") or ""
                if "endpoint" in azure:
                    settings.azure_openai_endpoint = azure.get("endpoint", "") or ""
                if "deployment" in azure:
                    settings.azure_openai_deployment = azure.get("deployment", "") or ""
                if "api_version" in azure:
                    settings.azure_openai_api_version = azure.get("api_version", "") or ""
        except Exception as e:
            print(f"Error loading local config: {e}")

# Call it once at startup
load_local_config()
