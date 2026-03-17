"""
Publisher router (aggregator).

Route implementations live in smaller modules:
- publisher_queue
- publisher_uploads
- publisher_metadata
- publisher_assets
- publisher_jobs
"""

from fastapi import APIRouter
import os

from backend.core.config import UPLOAD_QUEUE_DIR
from backend.routers import (
    publisher_queue,
    publisher_uploads,
    publisher_metadata,
    publisher_assets,
    publisher_jobs,
)

os.makedirs(UPLOAD_QUEUE_DIR, exist_ok=True)

router = APIRouter()
router.include_router(publisher_queue.router)
router.include_router(publisher_uploads.router)
router.include_router(publisher_metadata.router)
router.include_router(publisher_assets.router)
router.include_router(publisher_jobs.router)
