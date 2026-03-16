import yt_dlp
import os
import json
import uuid
import asyncio
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
VIDEO_PROJECTS_DIR = BASE_DIR / "video_projects"

class ProjectLogger:
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.log_file = VIDEO_PROJECTS_DIR / project_name / "download.log"
        os.makedirs(self.log_file.parent, exist_ok=True)

    def _write(self, msg: str):
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}\n")
        except Exception:
            pass

    def debug(self, msg):
        # yt-dlp uses debug for standard stdout like progress bars
        if msg.startswith('[download]'):
            self._write(msg.replace("\r", ""))
        else:
            self._write(f"[DEBUG] {msg}")

    def info(self, msg):
        self._write(f"[INFO] {msg}")

    def warning(self, msg):
        self._write(f"[WARNING] {msg}")

    def error(self, msg):
        self._write(f"[ERROR] {msg}")

def extract_playlist_info(url: str, platform: str, media_type: str = "all", limit: int = 50, min_views: int = 0, date_after: str = "") -> dict:
    """
    Extracts video URLs and titles from a playlist/channel via yt-dlp.
    Doesn't download the actual videos.
    """
    # Default project for extraction logs
    project_name = "Extract_Jobs"
    if url.startswith("http"):
         # Just a fallback if needed
         pass

    ydl_opts = {
        'extract_flat': True,
        'dump_single_json': True,
        'quiet': False, # Let the logger capture it
        'no_warnings': True,
        'playlistend': limit,
        'logger': ProjectLogger(project_name)
    }
    
    if platform == "youtube":
        if media_type == "shorts":
            ydl_opts['match_filter'] = yt_dlp.utils.match_filter_func("original_url=*=/shorts/")
        elif media_type == "videos":
            ydl_opts['match_filter'] = yt_dlp.utils.match_filter_func("original_url!*=/shorts/")

    # Apply advanced filters if provided
    filter_strs = []
    if min_views and min_views > 0:
        filter_strs.append(f"view_count >= {min_views}")
    if date_after:
        # yt-dlp expects YYYYMMDD
        safe_date = date_after.replace("-", "")
        filter_strs.append(f"upload_date >= {safe_date}")
        
    if filter_strs:
        new_filter = yt_dlp.utils.match_filter_func(" & ".join(filter_strs))
        if 'match_filter' in ydl_opts:
            # Combine existing match_filter (like shorts vs videos) with new
            old_filter = ydl_opts['match_filter']
            ydl_opts['match_filter'] = lambda info_dict, incomplete: old_filter(info_dict, incomplete) or new_filter(info_dict, incomplete)
        else:
            ydl_opts['match_filter'] = new_filter

            
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            entries = []
            if 'entries' in info:
                for entry in info['entries']:
                    if entry:
                        entries.append({
                            "title": entry.get("title", ""),
                            "url": entry.get("url", ""),
                            "duration": entry.get("duration", 0),
                            "view_count": entry.get("view_count", 0),
                            "channel": entry.get("channel", entry.get("uploader", "")),
                            "thumbnail": entry.get("thumbnails", [{"url": ""}])[-1].get("url") if entry.get("thumbnails") else ""
                        })
            else:
                # Single video
                entries.append({
                    "title": info.get("title", ""),
                    "url": info.get("webpage_url", info.get("url", "")),
                    "duration": info.get("duration", 0),
                    "view_count": info.get("view_count", 0),
                    "channel": info.get("channel", info.get("uploader", "")),
                    "thumbnail": info.get("thumbnail", "")
                })
                
            return {
                "success": True,
                "domain": info.get("extractor", ""),
                "channel": info.get("uploader", ""),
                "videos": entries
            }
    except Exception as e:
        logger.error(f"yt-dlp extraction error: {e}")
        return {"success": False, "message": str(e)}


async def download_video(url: str, project_name: str = "Downloads", download_thumbnail: bool = False, cookies_path: str = "", user_agent: str = "", po_token: str = "", use_mweb_client: bool = False, force_watch: bool = True) -> dict:
    """
    Downloads a single video and its metadata JSON using yt-dlp into the video_projects folder.
    """
    target_dir = VIDEO_PROJECTS_DIR / project_name / "raw_videos"
    os.makedirs(target_dir, exist_ok=True)
    
    # We use a unique ID for the filename to avoid clashes
    file_id = str(uuid.uuid4())[:8]
    output_tmpl = str(target_dir / f"%(title)s_{file_id}.%(ext)s")
    
    if force_watch and "/shorts/" in url:
        try:
            _vid = url.split("/shorts/")[-1].split("?")[0]
            if _vid:
                url = f"https://www.youtube.com/watch?v={_vid}"
        except Exception:
            pass

    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': output_tmpl,
        'writeinfojson': True,
        'quiet': False,
        'no_warnings': True,
        'logger': ProjectLogger(project_name)
    }
    if cookies_path:
        ydl_opts['cookiefile'] = cookies_path
    if user_agent:
        ydl_opts['http_headers'] = {'User-Agent': user_agent}
    _extractor_args = {}
    if use_mweb_client or po_token:
        _extractor_args['youtube'] = {}
        if use_mweb_client:
            _extractor_args['youtube']['player_client'] = ['mweb']
        if po_token:
            _extractor_args['youtube']['po_token'] = [po_token]
    if _extractor_args:
        ydl_opts['extractor_args'] = _extractor_args
    
    if download_thumbnail:
        ydl_opts['writethumbnail'] = True
    
    try:
        def do_download():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                # If writing info json, yt-dlp replaces ext with info.json
                return filename, info
                
        # Run blocking yt-dlp in a background thread to prevent blocking FastAPI
        filename, info = await asyncio.to_thread(do_download)
        
        return {
            "success": True,
            "title": info.get("title"),
            "file": filename,
            "message": "Download completed"
        }
    except Exception as e:
        logger.error(f"yt-dlp download error: {e}")
        return {"success": False, "message": str(e)}
