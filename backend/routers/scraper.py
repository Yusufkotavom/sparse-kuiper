from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional

from backend.services.ytdlp_service import extract_playlist_info, download_video
from backend.core.logger import logger
from backend.core.config import VIDEO_PROJECTS_DIR
import json
import os

router = APIRouter()

class ExtractRequest(BaseModel):
    url: str
    platform: str = "custom"
    media_type: str = "all"
    limit: int = 50
    min_views: int = 0
    date_after: str = ""

class DownloadRequest(BaseModel):
    url: str
    project_name: str = "Scraped_Downloads"
    download_thumbnail: bool = False
    
class BatchDownloadRequest(BaseModel):
    urls: List[str]
    project_name: str = "Scraped_Downloads"
    download_thumbnail: bool = False

@router.post("/extract-info")
async def extract_info(req: ExtractRequest):
    """
    Extracts flat playlist information without downloading videos.
    Useful for scraping channels, playlists, or tiktok user pages.
    """
    logger.info(f"Extracting {req.url} (Platform: {req.platform}, Type: {req.media_type})")
    
    # Offload the blocking yt_dlp extraction to a background thread
    import asyncio
    result = await asyncio.to_thread(
        extract_playlist_info,
        req.url, 
        req.platform, 
        req.media_type, 
        req.limit,
        req.min_views,
        req.date_after
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
        
    # Check for existing items in the specified project or "Downloads" 
    # Since we don't know the project name at extraction time (it's chosen after), 
    # we just return the raw extracted links. The de-duplication will happen when saving to the project.
    # However, if the user requested it specifically, we can merge.
    
    return result

@router.post("/download")
async def download_single(req: DownloadRequest, background_tasks: BackgroundTasks):
    """
    Triggers a background download for a single video.
    """
    # Duplicate check for single download
    project_dir = VIDEO_PROJECTS_DIR / req.project_name
    if project_dir.exists():
        # Check if URL is in any info.json
        for f in os.listdir(project_dir):
            if f.endswith(".info.json"):
                info_json = project_dir / f
                try:
                    with open(info_json, "r", encoding="utf-8") as jf:
                        metadata = json.load(jf)
                        if metadata.get("original_url") == req.url or metadata.get("webpage_url") == req.url:
                            logger.info(f"Skipping download, {req.url} already exists in {req.project_name}")
                            return {"message": "Video already downloaded in this project."}
                except:
                    pass

    async def run_download():
        res = await download_video(req.url, req.project_name, req.download_thumbnail)
        if res.get("success"):
            logger.info(f"Successfully downloaded {req.url} to {res.get('file')}")
            
    background_tasks.add_task(run_download)
    return {"message": "Download started in background."}

@router.post("/download-batch")
async def download_batch(req: BatchDownloadRequest, background_tasks: BackgroundTasks):
    """
    Triggers background downloads for a batch of URLs.
    """
    project_dir = VIDEO_PROJECTS_DIR / req.project_name
    existing_urls = set()
    
    if project_dir.exists():
        for f in os.listdir(project_dir):
            if f.endswith(".info.json"):
                info_json = project_dir / f
                try:
                    with open(info_json, "r", encoding="utf-8") as jf:
                        metadata = json.load(jf)
                        if "original_url" in metadata:
                            existing_urls.add(metadata["original_url"])
                        if "webpage_url" in metadata:
                            existing_urls.add(metadata["webpage_url"])
                except:
                    pass
                    
    # Filter out URLs that are already downloaded
    urls_to_download = [url for url in req.urls if url not in existing_urls]
    
    if not urls_to_download:
        return {"message": "All selected videos are already downloaded in this project."}

    async def run_batch():
        for url in urls_to_download:
            res = await download_video(url, req.project_name, req.download_thumbnail)
            if res.get("success"):
                logger.info(f"Successfully downloaded {url} to {res.get('file')}")
            else:
                logger.error(f"Failed to download {url}: {res.get('message')}")
                
    background_tasks.add_task(run_batch)
    return {"message": f"Started {len(urls_to_download)} downloads sequence in background. Skipped {len(req.urls) - len(urls_to_download)} duplicates."}
