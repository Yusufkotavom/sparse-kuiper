import sys
import os
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def _run(job):
    from playwright.sync_api import sync_playwright

    session_dir = job["session_dir"]
    video_path = job["video_path"]
    title = (job.get("title") or "")[:100]
    description = (job.get("description") or "")[:5000]
    schedule = job.get("schedule")
    youtube_privacy = (job.get("youtube_privacy") or "private").lower()
    browser_type = (job.get("browser_type") or "chromium").lower()
    proxy = job.get("proxy")
    user_agent = job.get("user_agent")
    headless = bool(job.get("headless", False))
    pw_debug = bool(job.get("pw_debug", False))

    # Playwright Inspector control
    if not headless:
        if pw_debug:
            os.environ["PWDEBUG"] = "1"
        else:
            os.environ.pop("PWDEBUG", None)

    if not os.path.exists(video_path):
        return {"success": False, "message": f"Video not found: {video_path}"}

    launch_kwargs = {
        "headless": headless,
        "args": ["--start-maximized", "--disable-blink-features=AutomationControlled"],
        "no_viewport": True,
    }
    if proxy:
        launch_kwargs["proxy"] = {"server": proxy}
    if user_agent:
        launch_kwargs["user_agent"] = user_agent

    with sync_playwright() as p:
        if browser_type == "firefox":
            user_data_dir = os.path.join(session_dir, "firefox_profile")
            os.makedirs(user_data_dir, exist_ok=True)
            context = p.firefox.launch_persistent_context(user_data_dir=user_data_dir, **launch_kwargs)
        else:
            user_data_dir = os.path.join(session_dir, "chrome_profile")
            os.makedirs(user_data_dir, exist_ok=True)
            context = p.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                channel="chrome",
                ignore_default_args=["--enable-automation"],
                **launch_kwargs
            )

        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto("https://www.youtube.com/upload", timeout=120000)
            page.wait_for_load_state("domcontentloaded", timeout=120000)

            if "accounts.google.com" in (page.url or ""):
                return {"success": False, "message": "YouTube session not logged in. Please login again via Playwright."}

            page.set_input_files('input[type="file"]', video_path)

            try:
                page.wait_for_selector('#title-textarea #textbox', timeout=60000)
                page.fill('#title-textarea #textbox', title)
            except Exception as e:
                print(f"Error filling title: {e}")
                pass
            
            try:
                page.wait_for_selector('#description-textarea #textbox', timeout=10000)
                page.fill('#description-textarea #textbox', description)
            except Exception as e:
                print(f"Error filling description: {e}")
                pass

            try:
                page.click('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]', timeout=10000)
            except Exception as e:
                print(f"Error clicking made for kids: {e}")
                pass

            try:
                for _ in range(3):
                    page.click('#next-button', timeout=5000)
                    page.wait_for_timeout(1000)
                if schedule:
                    try:
                        page.locator('#second-container-expand-button').click(timeout=5000)
                    except:
                        try:
                            page.locator('tp-yt-paper-radio-button[name="SCHEDULE"]').click(timeout=5000)
                        except:
                            page.locator('#schedule-radio-button').click(timeout=5000)
                    
                    # Parse schedule and fill date/time
                    try:
                        from datetime import datetime
                        # schedule format might be "2026-03-14 10:00:00" or ISO. We parse standard formats.
                        dt = None
                        try:
                            dt = datetime.fromisoformat(schedule.replace('Z', '+00:00'))
                        except:
                            try:
                                dt = datetime.strptime(schedule, '%Y-%m-%d %H:%M:%S')
                            except:
                                dt = datetime.strptime(schedule, '%Y-%m-%d %H:%M')
                        
                        if dt:
                            date_str = dt.strftime('%d %b %Y') # e.g. 14 Mar 2026
                            time_str = dt.strftime('%H:%M')    # e.g. 10:00

                            page.wait_for_timeout(1000)
                            
                            # Click datepicker trigger, then we can type the date directly
                            page.locator('#datepicker-trigger').click(timeout=5000)
                            page.wait_for_timeout(500)
                            
                            # Using keyboard to select all and type the formatted date
                            page.keyboard.press('Control+A')
                            page.keyboard.press('Backspace')
                            page.keyboard.type(date_str, delay=50)
                            page.keyboard.press('Enter')
                            page.wait_for_timeout(500)

                            # Click and fill time using Playwright inspector logic
                            try:
                                page.locator("#input-1").get_by_label("", exact=True).click(timeout=5000)
                            except:
                                page.locator("#input-1 input").click(timeout=5000)
                                
                            try:
                                page.get_by_role("option", name=time_str).click(timeout=5000)
                            except:
                                page.locator("#input-1").get_by_label("", exact=True).fill(time_str)
                                page.keyboard.press('Enter')
                                
                            page.wait_for_timeout(500)
                    except Exception as e:
                        print(f"Error filling schedule date/time: {e}")
                        pass
                else:
                    if youtube_privacy == "public":
                        page.locator('tp-yt-paper-radio-button[name="PUBLIC"]').click(timeout=10000)
                    elif youtube_privacy == "unlisted":
                        page.locator('tp-yt-paper-radio-button[name="UNLISTED"]').click(timeout=10000)
                    else:
                        page.locator('tp-yt-paper-radio-button[name="PRIVATE"]').click(timeout=10000)
            except Exception as e:
                print(f"Error on visibility logic: {e}")
                pass

            try:
                page.wait_for_selector('text=Checks complete', timeout=10000)
            except Exception:
                pass
                
            try:
                # Click the final save/schedule button
                try:
                    page.click('#done-button', timeout=5000)
                except:
                    page.get_by_role("button", name="Schedule").click(timeout=5000)
                page.wait_for_timeout(3000)
            except Exception as e:
                print(f"Error clicking final publish button: {e}")
                pass

            video_url = ""
            try:
                share_btn = page.wait_for_selector('text=Copy video link', timeout=10000)
                share_btn.click()
                link_el = page.query_selector('a[href*="youtu.be"], a[href*="youtube.com/watch"]')
                if link_el:
                    video_url = link_el.get_attribute("href")
            except Exception:
                pass

            return {"success": True, "message": f"Uploaded: {video_url or '(url pending)'}", "url": video_url}
        finally:
            context.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: youtube_playwright_upload_worker.py <job_json_path>")
        sys.exit(1)

    job_path = sys.argv[1]
    result_path = job_path.replace(".json", "_result.json")

    try:
        with open(job_path, "r", encoding="utf-8") as f:
            job = json.load(f)
    except Exception as e:
        result = {"success": False, "message": f"Failed to read job file: {e}"}
        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(result, f)
        sys.exit(1)

    try:
        result = _run(job)
    except Exception as e:
        result = {"success": False, "message": str(e)}

    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()

