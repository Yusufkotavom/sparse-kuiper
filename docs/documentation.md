# Nomad Hub Backend Documentation

This document provides a comprehensive overview of the Nomad Hub backend architecture, specifically focusing on its API structure, worker processes (like Playwright uploaders), and required dependencies.

## 1. Environment and Dependencies

The backend is built with **FastAPI** and requires the following key Python libraries defined in [requirements.txt](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/requirements.txt):
*   **Web Server**: `fastapi` (>=0.111.0), `uvicorn` (>=0.30.1), `python-multipart`
*   **Data Models & Configuration**: `pydantic`, `pydantic-settings`
*   **Database**: `sqlalchemy` (>=2.0.0), `alembic` (for migrations)
*   **Automation & Scraping**: [playwright](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/routers/publisher.py#99-159) (>=1.44.0), `requests`
*   **AI Integrations**: `groq`
*   **Media Processing**: `pillow`
*   **Platform Specific Uploaders**: `tiktok-uploader`, `google-api-python-client`, `google-auth`

## 2. Backend Application Structure ([main.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/main.py))

The FASTApi application is rooted in [main.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/main.py). 
*   **Static Serving**: It mounts three local directories for static file access: `/api/v1/projects_static`, `/api/v1/video_projects_static`, and `/api/v1/upload_queue_static`.
*   **Database Initialization**: Automatically executes `create_all_tables()` and [run_migrations()](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/core/migrations.py#207-216) on the [startup](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/main.py#36-53) event to ensure the SQLite schema is always current.
*   **Routing**: The application aggregates multiple functional routers under the `/api/v1/` prefix.

## 3. API Modules & Endpoints (`backend/routers/`)

The API is segmented by domains:

### Publisher API (`/api/v1/publisher`)
Handles video queuing and uploading.
*   `GET /queue`: Retrieves active items from `UploadQueueItem` in the database.
*   `POST /queue/add`: Moves a file from a project into the queue directory and logs it in the DB.
*   `POST /queue/archive/{filename}`: Moves a queued video into an `archive/` subfolder.
*   `POST /upload/{filename}` / `POST /upload/batch`: Triggers background upload workers for platforms like YouTube, Facebook, TikTok, etc.
*   `GET /queue/video/{filename}`: Serves the physical media file for frontend preview.

### Video Editor API (`/api/v1/video`)
Manages standard video generation projects.
*   Project CRUD: `GET /projects`, `POST /projects`, `DELETE /projects/{name}`
*   Assets: `GET /projects/{name}/videos`, `POST /projects/{name}/archive`
*   Workflow: `POST /projects/{name}/generate` (starts `video_worker.py`), `POST /projects/{name}/curate`

### KDP Studio API (`/api/v1/kdp`)
Targeted for Kindle Direct Publishing (Image/PDF books).
*   Project CRUD: `GET /projects`, `POST /projects`, `DELETE /projects/{name}`
*   Assets: `GET /projects/{name}/images`, `POST /projects/{name}/curate`, `POST /projects/{name}/archive`
*   PDF Generation: `POST /pdf` (Interfaces with `pdf_engine.py`)

### Accounts API (`/api/v1/accounts`)
*   Manages social media accounts connected to the system (CRUD).
*   OAuth flows for YouTube (`/youtube/auth-url`, `/youtube/connect`) and Facebook.
*   `POST /{id}/playwright/launch`: Allows users to launch an interactive Playwright browser to log into accounts manually.

### Scraper API (`/api/v1/scraper`, `/api/v1/scraper-projects`)
*   Endpoints to extract information, manage bulk downloads, and organize scraped data into localized project folders.

### Settings API (`/api/v1/settings`)
*   Manages configuration data like Prompt Templates (`/templates`) and System Prompts (`/system-prompts`).

## 4. Playwright Upload Worker Processes (`backend/services/`)

The application utilizes background worker scripts to perform heavy, long-running automations. These scripts are invoked via CLI commands (running as separate OS processes) and typically accept a JSON file path detailing the task parameters.

### `youtube_playwright_upload_worker.py`
*   **Mechanism**: Uses `sync_playwright` to launch a persistent Chromium or Firefox context.
*   **Headless vs Headed**: Supports debug modes (`PWDEBUG=1`) and visible UI interactions (if `headless=False` is passed).
*   **Process Flow**:
    1.  Navigates to `https://www.youtube.com/upload`.
    2.  Verifies Google account session.
    3.  Injects the video using `page.set_input_files`.
    4.  Fills out the title and description using `#title-textarea` and `#description-textarea`.
    5.  Selects "Not made for kids" radio buttons.
    6.  Navigates to the final visibility step.
    7.  Handles scheduling: Tries to parse ISO strings, clicks the scheduler tools, injects date keys, and selects the time.
    8.  Captures the generated `youtu.be` link before clicking the final 'Done' button.
    9.  Writes the result back to a `<job>_result.json` file.

### `instagram_upload_worker.py`
*   **Mechanism**: Uses `async_playwright` to automate Instagram Reels uploads.
*   **Authentication**: Does not use persistent contexts. Instead, it parses a Netscape formatted `cookies.txt` file and injects them directly into a fresh Playwright session using `context.add_cookies()`.
*   **Process Flow**:
    1.  Navigates to `instagram.com` to verify session viability.
    2.  Finds the "New Post" SVG elements and simulates file drag/drop or input.
    3.  Clicks through the "Reels notice", cropping, and filtering steps sequentially.
    4.  Inserts the caption.
    5.  Waits for the "Your reel has been shared" toast/modal which signals full byte transfer.

### Other Workers
*   **`tiktok_upload_worker.py`**: Uses the `tiktok-uploader` module.
*   **`bot_worker.py` / `video_worker.py`**: Handle generation pipelines.

## 5. Potential Bugs and Technical Observations

During the static scan, the following architectural vulnerabilities and potential bugs were identified that require developer attention:

1.  **Broad Exception Swallowing in Upload Workers**
    *   *Issue*: In `youtube_playwright_upload_worker.py`, almost all DOM interactions (filling title, clicking next, setting schedules) are enclosed in `try...except Exception as e: pass` blocks.
    *   *Impact*: If YouTube modifies its UI layer, the bot will silently bypass critical steps (saving a video with a blank title, or immediately publishing instead of scheduling) but report "Success" because it still reaches the final button.
2.  **Date Picker Fragility (YouTube Worker)**
    *   *Issue*: The logic to input dates using `page.keyboard.press('Control+A')` and typing over it is highly reliant on DOM focus behavior and localization. Browsers running in different locales might reject standard date formats.
3.  **Process Interruption and Zombie States**
    *   *Issue*: Workers are executed by dropping a JSON file and launching a `subprocess`. There is no formal job queue manager (like Celery, RQ, or Redis).
    *   *Impact*: If Nomad Hub crashes or the host server is restarted, actively running uploads are killed as OS orphaned processes, and there is no auto-resume logic.
4.  **Cookie Expiration handling**
    *   *Issue*: `instagram_upload_worker.py` throws a fatal error if redirected to `accounts/login`. This requires manual user intervention to re-export `cookies.txt` and is not fully resilient.
