from pydantic import BaseModel
from typing import List, Dict


class UploadRequest(BaseModel):
    title: str
    description: str
    tags: str
    platforms: List[str]
    account_id: str = ""
    schedule: str = ""
    product_id: str = ""
    youtube_privacy: str = "private"
    youtube_category_id: str = "22"
    open_browser: bool = False
    pw_debug: bool = False


class BatchVideoItem(BaseModel):
    filename: str
    title: str
    description: str
    tags: str
    schedule: str = ""
    product_id: str = ""
    youtube_privacy: str = "private"
    youtube_category_id: str = "22"
    open_browser: bool = False
    pw_debug: bool = False


class BatchUploadRequest(BaseModel):
    videos: List[BatchVideoItem]
    platforms: List[str]
    account_id: str = ""
    open_browser: bool = False
    pw_debug: bool = False


class MetadataRequest(BaseModel):
    prompt: str
    provider: str | None = None
    model: str | None = None


class QueueAddRequest(BaseModel):
    project_type: str
    relative_path: str
    title: str
    description: str
    tags: str


class AssetMetadataRequest(BaseModel):
    project_type: str
    file: str
    title: str
    description: str
    tags: str


class AssetMetadataBatchRequest(BaseModel):
    project_type: str
    files: List[str]
    include_sidecar: bool = True


class AssetMoveRequest(BaseModel):
    project_type: str
    old_file: str
    new_file: str


class QueueUpdateRequest(BaseModel):
    filename: str
    title: str
    description: str
    tags: str


class QueueConfigRequest(BaseModel):
    filename: str
    platforms: List[str] = []
    account_map: Dict[str, str] = {}
    schedule: str = ""
    platform_publish_schedule: str = ""
    campaign_id: str = ""
    open_browser: bool = False
    pw_debug: bool = False
    youtube_privacy: str = "private"
    youtube_category_id: str = "22"
    product_id: str = ""


class BulkQueueConfigRequest(BaseModel):
    filenames: List[str]
    platforms: List[str] = []
    account_map: Dict[str, str] = {}
    schedule_start: str = ""
    platform_publish_schedule_start: str = ""
    campaign_id: str = ""
    posts_per_day: int = 1
    time_gap_hours: int = 1
    open_browser: bool = False
    pw_debug: bool = False
    youtube_privacy: str = "private"
    youtube_category_id: str = "22"
    product_id: str = ""


class TagsRequest(BaseModel):
    filename: str
    tags: List[str]


class RescheduleRequest(BaseModel):
    filename: str
    schedule: str
