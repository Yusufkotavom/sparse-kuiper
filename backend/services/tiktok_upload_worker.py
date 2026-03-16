"""
Standalone TikTok upload worker.
Launched as a separate OS process by publisher.py to avoid Windows
ProactorEventLoop conflicts with Playwright (used internally by tiktok-uploader).

Usage:
    python tiktok_upload_worker.py <job_json_path>

job_json_path: Path to a JSON file with upload job details.
On completion, writes result back to a result JSON file.
"""

import sys
import os
import json
import datetime
from pathlib import Path


def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def run_upload(job: dict) -> dict:
    try:
        from tiktok_uploader.upload import TikTokUploader
    except ImportError:
        return {"success": False, "message": "tiktok-uploader not installed. Run: pip install tiktok-uploader"}

    cookies_path = job["cookies_path"]
    videos_payload = job["videos"]

    if not os.path.exists(cookies_path):
        return {"success": False, "message": f"cookies.txt not found: {cookies_path}"}

    formatted_videos = []
    
    for vid in videos_payload:
        video_path = vid["video_path"]
        if not os.path.exists(video_path):
            log(f"⚠️ Video not found, skipping: {video_path}")
            continue
            
        description = vid.get("description", "")
        schedule_str = vid.get("schedule")
        product_id = vid.get("product_id")

        log(f"Queuing TikTok upload: {os.path.basename(video_path)}")
        
        video_args = {
            "path": video_path,
            "description": description
        }

        if schedule_str:
            try:
                s = schedule_str.strip()
                if s.endswith("Z"):
                    dt = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
                else:
                    dt = datetime.datetime.fromisoformat(s)
                if dt.tzinfo is None:
                    local_tz = datetime.datetime.now().astimezone().tzinfo
                    dt = dt.replace(tzinfo=local_tz)
                dt_utc = dt.astimezone(datetime.timezone.utc)
                video_args["schedule"] = dt_utc.replace(tzinfo=None)
            except Exception as e:
                log(f"⚠️ Invalid schedule format for {video_path}: {e}. Uploading immediately.")

        if product_id:
            video_args["product_id"] = product_id
            
        formatted_videos.append(video_args)

    if not formatted_videos:
        return {"success": False, "message": "No valid videos found to upload."}
        
    headless_mode = job.get("headless", True)
    pw_debug = job.get("pw_debug", False)
    browser_name = job.get("browser_type") or "chromium"
    proxy_cfg = job.get("proxy")
    proxy_dict = None
    try:
        if isinstance(proxy_cfg, dict):
            proxy_dict = proxy_cfg
        elif isinstance(proxy_cfg, str) and proxy_cfg.strip():
            s = proxy_cfg.strip()
            if "://" in s:
                s = s.split("://", 1)[1]
            creds, hostport = ("", s) if "@" not in s else (s.split("@", 1)[0], s.split("@", 1)[1])
            host, port = (hostport.split(":")[0], hostport.split(":")[1]) if ":" in hostport else (hostport, "")
            user = creds.split(":")[0] if ":" in creds else (creds or "")
            password = creds.split(":")[1] if ":" in creds else ""
            proxy_dict = {"host": host}
            if port: proxy_dict["port"] = port
            if user: proxy_dict["user"] = user
            if password: proxy_dict["pass"] = password
    except Exception:
        proxy_dict = None
    try:
        log(f"Playwright headless={headless_mode}")
        if not headless_mode:
            if pw_debug:
                os.environ["PWDEBUG"] = "1"
                log("PWDEBUG=1 set — Playwright Inspector enabled")
            else:
                os.environ.pop("PWDEBUG", None)
            os.environ["DEBUG"] = "pw:api"
            log("DEBUG=pw:api set for verbose Playwright API logging")
    except Exception as _e:
        pass
    
    uploader = TikTokUploader(
        cookies=cookies_path, 
        headless=headless_mode,
        browser=browser_name,
        proxy=proxy_dict
    )

    try:
        log(f"Starting bulk upload of {len(formatted_videos)} videos...")
        
        import time
        log("⏳ Waiting 5 seconds for browser to stabilize...")
        time.sleep(5)
        failed_videos = uploader.upload_videos(formatted_videos)
        total = len(formatted_videos)
        failed = len(failed_videos or [])
        succeeded = total - failed
        log("✅ Bulk upload sequence finished!")
        if failed:
            try:
                details = [{"path": v.get("path") or v.get("video"), "description": v.get("description", "")} for v in failed_videos]
            except Exception:
                details = []
            return {
                "success": False,
                "message": f"{succeeded}/{total} videos uploaded. {failed} failed.",
                "failed_videos": details
            }
        return {"success": True, "message": f"{total} videos uploaded to TikTok."}

    except Exception as e:
        log(f"❌ Upload failed: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: tiktok_upload_worker.py <job_json_path>")
        sys.exit(1)

    job_path = sys.argv[1]
    result_path = job_path.replace(".json", "_result.json")

    try:
        with open(job_path, "r", encoding="utf-8") as f:
            job = json.load(f)
    except Exception as e:
        result = {"success": False, "message": f"Failed to read job file: {e}"}
        with open(result_path, "w") as f:
            json.dump(result, f)
        sys.exit(1)

    result = run_upload(job)

    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    log(f"Result written to: {result_path}")
    sys.exit(0 if result["success"] else 1)
