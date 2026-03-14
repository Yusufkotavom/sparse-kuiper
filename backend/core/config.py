import os
import json
from pydantic_settings import BaseSettings
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_FILE = BASE_DIR / "config.json"
PROJECTS_DIR = BASE_DIR / "projects"
VIDEO_PROJECTS_DIR = BASE_DIR / "video_projects"
UPLOAD_QUEUE_DIR = BASE_DIR / "upload_queue"

class Settings(BaseSettings):
    app_name: str = "AIO Super App API"
    environment: str = "development"
    
    # Placeholder for Groq API Key (loaded from config.json or env)
    groq_api_key: str = ""

    class Config:
        env_file = ".env"

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
        except Exception as e:
            print(f"Error loading local config: {e}")

# Call it once at startup
load_local_config()
