"""
Standalone Instagram Reels upload worker.
Launched as a separate OS process by instagram_uploader.py.

Usage:
    python instagram_upload_worker.py <job_json_path>
"""

import sys
import os
import json
import datetime
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

async def upload_video(page, video_path: str, description: str):
    log(f"Starting upload for {os.path.basename(video_path)}")
    
    # 1. Navigate to Instagram homepage
    await page.goto("https://www.instagram.com/", wait_until="networkidle")
    
    # Check if there's a login redirect (meaning cookies are invalid/expired)
    if "accounts/login" in page.url:
        raise Exception("Cookies are invalid or expired. Please re-login via the Accounts page.")

    # 2. Click "Create" on the sidebar
    # The SVG aria-label is usually "New post"
    log("Clicking Create button...")
    create_btn = page.locator("svg[aria-label='New post']").locator("..").locator("..")
    await create_btn.click()
    
    # 3. Wait for the upload modal to appear
    log("Waiting for upload modal...")
    await page.wait_for_selector("text=Drag photos and videos here", timeout=10000)
    
    # 4. Upload the file
    log("Injecting video file...")
    # Playwright can set files on the first file input it finds
    file_input = page.locator("input[type='file']")
    await file_input.set_input_files(video_path)
    
    # 5. Handle "Video posts are now shared as reels" modal if it appears
    log("Handling modals...")
    try:
        ok_btn = page.locator("button", has_text="OK")
        await ok_btn.click(timeout=5000)
        log("Clicked 'OK' on Reels notice.")
    except Exception:
        pass # It's fine if it doesn't appear
        
    # Wait for the "Next" button in the crop section
    log("Clicking Next (Crop)...")
    next_btn = page.locator("div[role='dialog']").locator("text=Next").first
    await next_btn.click()

    # Wait for the "Next" button in the filter section
    log("Clicking Next (Filter)...")
    next_btn = page.locator("div[role='dialog']").locator("text=Next").first
    await next_btn.click()

    # 6. Fill description
    log("Writing description...")
    await page.wait_for_selector("div[aria-label='Write a caption...']", timeout=10000)
    caption_box = page.locator("div[aria-label='Write a caption...']")
    await caption_box.click()
    await page.keyboard.insert_text(description)

    # 7. Click Share
    log("Clicking Share...")
    share_btn = page.locator("text=Share").first
    await share_btn.click()

    # 8. Wait for success message
    log("Waiting for upload to complete (this may take a while)...")
    # Instagram shows "Your reel has been shared." or similar
    await page.wait_for_selector("text=Your reel has been shared.", timeout=120000) # 2 minute timeout for upload
    
    # Close the success modal
    try:
        close_btn = page.locator("svg[aria-label='Close']").locator("..")
        await close_btn.click()
    except Exception:
        pass
        
    log(f"✅ Successfully uploaded {os.path.basename(video_path)}")

async def run_upload(job: dict) -> dict:
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
        formatted_videos.append(vid)

    if not formatted_videos:
        return {"success": False, "message": "No valid videos found to upload."}

    # Load Netscape cookies
    cookies = []
    with open(cookies_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.strip().split("\t")
            if len(parts) >= 7:
                cookies.append({
                    "domain": parts[0],
                    "path": parts[2],
                    "secure": parts[3] == "TRUE",
                    "expires": int(parts[4]),
                    "name": parts[5],
                    "value": parts[6]
                })

    log(f"Starting Playwright. Loaded {len(cookies)} cookies.")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        await context.add_cookies(cookies)
        
        page = await context.new_page()
        
        success_count = 0
        error_msgs = []
        
        for vid in formatted_videos:
            try:
                await upload_video(page, vid["video_path"], vid["description"])
                success_count += 1
                # Small delay between uploads
                await asyncio.sleep(5)
            except Exception as e:
                log(f"❌ Upload failed for {vid['video_path']}: {e}")
                error_msgs.append(str(e))
                # Take screenshot on failure
                try:
                    await page.screenshot(path=f"instagram_error_{datetime.datetime.now().strftime('%H%M%S')}.png")
                except:
                    pass
                
        await browser.close()
        
        if success_count > 0:
            return {
                "success": True, 
                "message": f"Successfully uploaded {success_count}/{len(formatted_videos)} videos to Instagram.",
                "errors": error_msgs
            }
        else:
            return {
                "success": False,
                "message": f"Failed to upload any videos. Errors: {'; '.join(error_msgs)}"
            }

def main():
    if len(sys.argv) < 2:
        print("Usage: instagram_upload_worker.py <job_json_path>")
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

    result = asyncio.run(run_upload(job))

    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    log(f"Result written to: {result_path}")
    sys.exit(0 if result["success"] else 1)

if __name__ == "__main__":
    main()
