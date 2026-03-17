import os
import asyncio
import json
import random
import time
import argparse
import sys
from playwright.async_api import async_playwright
from datetime import datetime

# Fallback logger if not accessible
def setup_fallback_logger():
    import logging
    logger = logging.getLogger("grok_video_fallback")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        ch = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
        ch.setFormatter(formatter)
        logger.addHandler(ch)
    return logger

try:
    from backend.core.logger import logger
except ImportError:
    logger = setup_fallback_logger()

def log_message(project_dir, message, is_error=False):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_file = os.path.join(project_dir, "error.log" if is_error else "activity.log")
    formatted_msg = f"[{timestamp}] {message}"
    print(formatted_msg, flush=True)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(formatted_msg + "\n")

async def process_grok_project(project_name, project_dir, p, account_id="grok_default", profile_name="Profile_Grok_1", use_reference=True, headless_mode=True):
    prompts_file = os.path.join(project_dir, "prompts.json")
    download_dir = os.path.join(project_dir, "raw_videos")
    log_dir = project_dir
    
    # Profile per akun di data/sessions/<account_id>/chrome_profile
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    user_data_dir = os.path.join(base_dir, "data", "sessions", account_id, "chrome_profile")
    
    os.makedirs(download_dir, exist_ok=True)
    os.makedirs(os.path.dirname(user_data_dir), exist_ok=True)
    
    try:
        with open(prompts_file, 'r', encoding='utf-8') as f:
            prompts = json.load(f)
    except FileNotFoundError:
        log_message(log_dir, f"❌ File prompts.json tidak ditemukan. Mengabaikan.", True)
        return
        
    if not prompts:
        log_message(project_dir, f"⚠️ Tidak ada prompt di dalam prompts.json", True)
        return

    log_message(project_dir, f"📂 Memulai Project GROK: {project_name} (Total {len(prompts)} prompt)")
    
    try:
        launch_kwargs = {
            "user_data_dir": user_data_dir,
            "headless": headless_mode,
            "args": [
                "--start-maximized",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
            ],
            "ignore_https_errors": True,
        }
        try:
            browser = await p.chromium.launch_persistent_context(**launch_kwargs, channel="chrome")
        except Exception:
            browser = await p.chromium.launch_persistent_context(**launch_kwargs)
        
        page = await browser.new_page()
        
        # Selector download video
        selectors = [
            'button[aria-label="Download"]',
            'button:has(svg.lucide-download)',
            'button[aria-label*="Download" i]',
            'button[aria-label*="Save video" i]',
            'button[title*="Download" i]',
            'a[download]'
        ]
        combined_selector = ", ".join(selectors)
        
        last_downloaded_file = None
        
        for prompt_idx, prompt in enumerate(prompts):
            log_message(project_dir, f"🚀 [{prompt_idx+1}/{len(prompts)}]: '{prompt[:50]}...'")
            safename = f"prompt_{str(prompt_idx+1).zfill(2)}"
            
            import glob
            existing = glob.glob(os.path.join(download_dir, f"{safename}_*.mp4"))
            if existing:
                log_message(project_dir, f"⏭️ Skip prompt {prompt_idx+1} — sudah ada video.")
                frame_candidate = existing[0].replace(".mp4", "_ref.jpg")
                last_downloaded_file = frame_candidate if os.path.exists(frame_candidate) else existing[0]
                continue
            
            try:
                log_message(project_dir, "Membuka Grok...")
                await page.goto("https://grok.com/imagine", timeout=120000)
                await page.wait_for_timeout(5000)
                
                input_box = page.locator('textarea, [contenteditable="true"]').last
                await input_box.wait_for(state="visible", timeout=30000)
                
                if last_downloaded_file and os.path.exists(last_downloaded_file) and use_reference:
                    log_message(project_dir, f"📎 Melampirkan referensi sebelumnya: {os.path.basename(last_downloaded_file)}")
                    try:
                        import base64
                        with open(last_downloaded_file, "rb") as image_file:
                            encoded_string = base64.b64encode(image_file.read()).decode()
                        await input_box.click()
                        await input_box.evaluate(f'''(node) => {{
                            const byteCharacters = atob("{encoded_string}");
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {{
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }}
                            const byteArray = new Uint8Array(byteNumbers);
                            const file = new File([byteArray], "reference.jpg", {{ type: "image/jpeg" }});
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            const pasteEvent = new ClipboardEvent("paste", {{ clipboardData: dataTransfer, bubbles: true }});
                            node.dispatchEvent(pasteEvent);
                        }}''')
                        await page.wait_for_timeout(5000)
                    except Exception as paste_err:
                        log_message(project_dir, f"⚠️ Gagal paste referensi: {paste_err}")
                
                has_ref_image = last_downloaded_file and os.path.exists(last_downloaded_file) and use_reference

                if has_ref_image:
                    log_message(project_dir, "⚙️ [1/3] Ada referensi: Klik Settings → Make Video...")
                    settings_btn = None
                    for sel in ['button[aria-label="Pengaturan"]', 'button[aria-label="Settings"]']:
                        try:
                            candidate = page.locator(sel).last
                            if await candidate.is_visible(timeout=5000):
                                settings_btn = candidate
                                break
                        except:
                            continue
                    
                    if settings_btn:
                        await settings_btn.click()
                        await page.wait_for_timeout(1000)
                        buat_video_selectors = [
                            '[role="menuitem"]:has-text("Make Video")',
                            '[role="menuitem"]:has-text("Buat Video")'
                        ]
                        buat_video_btn = None
                        for sel in buat_video_selectors:
                            try:
                                candidate = page.locator(sel).first
                                if await candidate.is_visible(timeout=3000):
                                    buat_video_btn = candidate
                                    break
                            except:
                                continue
                        
                        if buat_video_btn:
                            await buat_video_btn.click()
                            await page.wait_for_timeout(1000)
                        else:
                            await page.keyboard.press("Escape")
                
                log_message(project_dir, "✍️ Ketik prompt → Enter...")
                try:
                    await input_box.click()
                    await input_box.fill(prompt)
                except:
                    await input_box.click()
                    await input_box.type(prompt, delay=0)
                await page.wait_for_timeout(500)
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(2000)
                
                log_message(project_dir, "⏳ Sedang generate video, unduh saat tombol Download muncul...")
                download_success = False
                
                for i in range(150):
                    await page.wait_for_timeout(2000)
                    locators = page.locator(combined_selector)
                    count = await locators.count()
                    btn = None
                    for j in range(count - 1, -1, -1):
                        potensial_btn = locators.nth(j)
                        if await potensial_btn.is_visible():
                            btn = potensial_btn
                            break
                    if btn:
                        try:
                            video_ready = False
                            try:
                                video_ready = await page.locator('video#sd-video[src], video#hd-video[src]').last.is_visible(timeout=5000)
                            except:
                                pass
                            if not video_ready:
                                continue
                            
                            log_message(project_dir, f"✅ Video siap! Mulai mengunduh...")
                            async with page.expect_download(timeout=60000) as download_info:
                                await btn.hover(force=True)
                                await btn.click(force=True)
                            download = await download_info.value
                            dt = datetime.now().strftime("%Y%m%d%H%M%S")
                            save_path = os.path.join(download_dir, f"{safename}_grok_gen_{dt}.mp4")
                            await download.save_as(save_path)
                            log_message(project_dir, f"🎉 Video disimpan: {os.path.basename(save_path)}")
                            download_success = True
                            
                            import subprocess
                            frame_path = save_path.replace(".mp4", "_ref.jpg")
                            try:
                                subprocess.run([
                                    "ffmpeg", "-y", "-sseof", "-0.5", "-i", save_path,
                                    "-update", "1", "-vframes", "1", "-q:v", "2", frame_path
                                ], capture_output=True, check=True)
                                if os.path.exists(frame_path):
                                    last_downloaded_file = frame_path
                                else:
                                    last_downloaded_file = save_path
                            except Exception:
                                last_downloaded_file = save_path
                            break
                        except Exception:
                            pass
                
                if not download_success:
                    log_message(project_dir, "❌ Timeout: Video gagal diunduh otomatis.", True)
                    
            except Exception as e:
                log_message(project_dir, f"❌ Error memproses prompt: {e}", True)
                
            delay = random.uniform(5, 10)
            await page.wait_for_timeout(delay * 1000)
            
        log_message(project_dir, f"✅ SEMUA BATCH UNTUK PROJECT {project_name} SELESAI ✅")
        
    except Exception as e:
        log_message(project_dir, f"❌ FATAL ERROR: {e}", True)
    finally:
        if 'browser' in locals():
            await browser.close()

async def run_grok_bot(project_name, use_reference=True, headless_mode=True, account_id="grok_default"):
    print("==================================================")
    print(f"🤖 GROK VIDEO AUTOMATOR - API DRIVEN")
    print(f"Project: {project_name}")
    print("==================================================")
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    project_dir = os.path.join(base_dir, "video_projects", project_name)
    
    if not os.path.exists(project_dir):
        print(f"❌ Project dir tidak ditemukan: {project_dir}")
        return

    try:
        async with async_playwright() as p:
            await process_grok_project(project_name, project_dir, p, account_id=account_id, use_reference=use_reference, headless_mode=headless_mode)
            print("\n✅✅ PROSES SELESAI ✅✅")
    except Exception as e:
        print("\n❌ TERJADI ERROR FATAL ❌", e)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Jalankan Grok Video bot untuk project spesifik")
    parser.add_argument("project", type=str, help="Nama folder project")
    parser.add_argument("use_reference", type=str, nargs="?", default="true", help="Gunakan gambar referensi (true/false)")
    parser.add_argument("headless_mode", type=str, nargs="?", default="true", help="Jalankan browser headless (true/false)")
    parser.add_argument("account_id", type=str, nargs="?", default="grok_default", help="ID akun Grok dari data/sessions")
    args = parser.parse_args()
    
    use_ref = args.use_reference.lower() == "true"
    headless_mode = args.headless_mode.lower() == "true"
    asyncio.run(run_grok_bot(args.project, use_ref, headless_mode, args.account_id))
