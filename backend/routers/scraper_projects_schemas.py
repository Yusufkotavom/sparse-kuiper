from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class CreateProjectRequest(BaseModel):
    name: str


class SaveScrapedDataRequest(BaseModel):
    videos: List[Dict[str, Any]]
    channel: str = ""


class MoveQueueRequest(BaseModel):
    action: str = "copy"
    title: Optional[str] = None
    description: Optional[str] = ""
    tags: Optional[str] = ""
