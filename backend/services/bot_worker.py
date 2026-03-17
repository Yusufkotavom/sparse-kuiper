import json
import time
import os
import asyncio
from pathlib import Path
from playwright.sync_api import sync_playwright

# Fallback logger for standalone execution
try:
    from backend.core.logger import logger
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [BOT] %(message)s")
    logger = logging.getLogger("bot_worker")

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECTS_DIR = BASE_DIR / "projects"

def run_playwright_bot(project_name: str, account_id: str = "whisk_default"):
    """
    Runs the Playwright bot to generate images in Google Flow.
    This should ideally be called as a background task.
    """
    project_dir = PROJECTS_DIR / project_name
    prompts_file = project_dir / "prompts.json"
    
    try:
        with open(prompts_file, "r", encoding="utf-8") as f:
            prompts = json.load(f)
    except FileNotFoundError:
        logger.error(f"Prompts file not found: {prompts_file}")
        raise FileNotFoundError(f"File '{prompts_file}' tidak ditemukan.")

    with sync_playwright() as p:
        user_data_dir = str(BASE_DIR / "data" / "sessions" / account_id / "chrome_profile")
        
        logger.info("[+] Starting Browser...")
        browser = p.chromium.launch_persistent_context(
            user_data_dir,
            headless=False,
            args=[
                "--start-maximized",
                "--disable-blink-features=AutomationControlled"
            ],
            ignore_default_args=["--enable-automation"],
            no_viewport=True,
            channel="chrome"
        )
        
        page = browser.new_page()
        page.goto("https://labs.google/fx/tools/flow/project/15964288-b22e-44b0-8b9e-981f2ac7ecae")

        logger.info("[+] Navigated to Google Flow. Waiting for editor...")
        
        try:
            page.locator('div[role="textbox"][data-slate-editor="true"]').first.wait_for(state="visible", timeout=60000)
            logger.info("[+] Editor found! Starting prompt execution...")
            time.sleep(3)
        except Exception:
            logger.error("[-] Failed to find the editor. Ensure internet connection and login status.")
            browser.close()
            return

        seen_urls = set()
        logger.info("[+] Mapping existing images to ignore...")
        for img in page.locator('img[alt="Generated image"]').all():
            src = img.get_attribute("src")
            if src:
                seen_urls.add(src)
                
        for i, prompt in enumerate(prompts):
            logger.info(f"[{i+1}/{len(prompts)}] Processing prompt: {prompt[:50]}...")

            try:
                textbox = page.locator('div[role="textbox"][data-slate-editor="true"]').first
                textbox.wait_for(state="visible", timeout=10000)
                
                textbox.click()
                page.keyboard.insert_text(prompt)

                generate_btn = page.locator('button:has(span:text-is("Buat")), button:has(i:text-is("arrow_forward")), button[aria-label="Generate"], button:has-text("Generate")').last
                generate_btn.click()

                logger.info("Waiting for image generation to complete (max 90 seconds)...")
                
                new_urls = []
                timeout_at = time.time() + 90
                
                while time.time() < timeout_at:
                    try:
                        current_images = page.locator('img[alt="Generated image"]').all()
                        for img in current_images:
                            src = img.get_attribute("src")
                            if src and src not in seen_urls and src not in new_urls:
                                new_urls.append(src)
                                
                        if len(new_urls) >= 4:
                            time.sleep(2) 
                            break
                    except Exception as e:
                        logger.warning(f"Error checking images: {e}")
                    time.sleep(2)
                    
                for url in new_urls:
                    seen_urls.add(url)
                
                raw_images_dir = project_dir / "raw_images"
                os.makedirs(raw_images_dir, exist_ok=True)
                
                download_count = 0
                for idx, img_url in enumerate(new_urls[:4]):
                    try:
                        if img_url.startswith("/"):
                            img_url = "https://labs.google" + img_url
                        
                        prompt_number = str(i + 1).zfill(2)
                        variation_number = idx + 1
                        filepath = raw_images_dir / f"prompt_{prompt_number}_var_{variation_number}.png"
                        
                        response = page.request.get(img_url)
                        if response.ok:
                            with open(filepath, "wb") as f:
                                f.write(response.body())
                            download_count += 1
                    except Exception as e:
                        logger.error(f"Error saving image: {e}")
                
                logger.info(f"Successfully downloaded {download_count} images for prompt {i+1}")

            except Exception as e:
                logger.error(f"Failed to process prompt {i+1}: {e}")

        logger.info("[+] Execution finished! Closing browser in 5 seconds...")
        time.sleep(5)
        browser.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python bot_worker.py <project_name> [account_id]")
        sys.exit(1)
    project_name = sys.argv[1]
    account_id = sys.argv[2] if len(sys.argv) > 2 else "whisk_default"
    logger.info(f"[BOT] Running standalone for project: {project_name}")
    run_playwright_bot(project_name, account_id)
