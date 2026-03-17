# API Reference (Latest)

Base URL lokal: `http://localhost:8000/api/v1`

Sumber kebenaran utama schema request/response ada di Swagger: `http://localhost:8000/docs`.

## Health
- `GET /`

## Accounts
- `GET /api/v1/accounts/`
- `POST /api/v1/accounts/`
- `PUT /api/v1/accounts/{account_id}`
- `DELETE /api/v1/accounts/{account_id}`
- `POST /api/v1/accounts/{account_id}/login`
- `POST /api/v1/accounts/{account_id}/playwright/launch`
- `POST /api/v1/accounts/{account_id}/refresh-status`
- `GET /api/v1/accounts/youtube-secrets`
- `GET /api/v1/accounts/{account_id}/youtube/auth-url`
- `POST /api/v1/accounts/{account_id}/youtube/connect`
- `POST /api/v1/accounts/{account_id}/youtube/disconnect`
- `GET /api/v1/accounts/{account_id}/drive/auth-url`
- `POST /api/v1/accounts/{account_id}/drive/connect`
- `GET /api/v1/accounts/{account_id}/facebook/auth-url`
- `POST /api/v1/accounts/{account_id}/facebook/connect`
- `POST /api/v1/accounts/{account_id}/facebook/select-page`
- `POST /api/v1/accounts/{account_id}/facebook/disconnect`
- `GET /api/v1/accounts/export-creds`
- `POST /api/v1/accounts/import-creds`

## Video
- `GET /api/v1/video/projects`
- `POST /api/v1/video/projects`
- `DELETE /api/v1/video/projects/{project_name}`
- `GET /api/v1/video/projects/{project_name}/videos`
- `DELETE /api/v1/video/projects/{project_name}/videos`
- `GET /api/v1/video/projects/{project_name}/prompts`
- `POST /api/v1/video/projects/{project_name}/prompts`
- `POST /api/v1/video/projects/{project_name}/config`
- `GET /api/v1/video/projects/{project_name}/config`
- `POST /api/v1/video/projects/{project_name}/generate`
- `POST /api/v1/video/projects/{project_name}/curate`
- `POST /api/v1/video/projects/{project_name}/archive`
- `POST /api/v1/video/projects/{project_name}/move`
- `GET /api/v1/video/thumbnail?file=<relative_path>`

## KDP
- `GET /api/v1/kdp/projects`
- `POST /api/v1/kdp/projects`
- `DELETE /api/v1/kdp/projects/{project_name}`
- `GET /api/v1/kdp/projects/{project_name}/images`
- `DELETE /api/v1/kdp/projects/{project_name}/images`
- `GET /api/v1/kdp/projects/{project_name}/prompts`
- `POST /api/v1/kdp/projects/{project_name}/prompts`
- `POST /api/v1/kdp/projects/{project_name}/config`
- `GET /api/v1/kdp/projects/{project_name}/config`
- `POST /api/v1/kdp/projects/{project_name}/generate`
- `POST /api/v1/kdp/projects/{project_name}/curate`
- `POST /api/v1/kdp/projects/{project_name}/archive`
- `POST /api/v1/kdp/projects/{project_name}/move`
- `POST /api/v1/kdp/prompts`
- `POST /api/v1/kdp/pdf`

## Scraper
- `POST /api/v1/scraper/extract-info`
- `POST /api/v1/scraper/download`
- `POST /api/v1/scraper/download-batch`

## Scraper Projects
- `GET /api/v1/scraper-projects`
- `POST /api/v1/scraper-projects`
- `GET /api/v1/scraper-projects/{project_name}/scraped-data`
- `POST /api/v1/scraper-projects/{project_name}/scraped-data`
- `GET /api/v1/scraper-projects/{project_name}/logs`
- `GET /api/v1/scraper-projects/{project_name}/downloads`
- `DELETE /api/v1/scraper-projects/{project_name}/downloads/{filename}`
- `GET /api/v1/scraper-projects/{project_name}/downloads/{filename}/play`
- `GET /api/v1/scraper-projects/{project_name}/downloads/{filename}/thumbnail`
- `POST /api/v1/scraper-projects/{project_name}/downloads/{filename}/queue`

## Publisher
- `GET /api/v1/publisher/queue`
- `GET /api/v1/publisher/queue/published`
- `POST /api/v1/publisher/queue/add`
- `DELETE /api/v1/publisher/queue/{filename}`
- `POST /api/v1/publisher/queue/archive/{filename}`
- `POST /api/v1/publisher/queue/return/{filename}`
- `GET /api/v1/publisher/queue/video/{filename}`
- `GET /api/v1/publisher/queue/thumbnail/{filename}`
- `POST /api/v1/publisher/queue/update-metadata`
- `POST /api/v1/publisher/queue/update-config`
- `POST /api/v1/publisher/queue/bulk-update-config`
- `POST /api/v1/publisher/upload/{filename}`
- `POST /api/v1/publisher/upload/batch`
- `POST /api/v1/publisher/generate-metadata`
- `GET /api/v1/publisher/metadata/sidecar`
- `GET /api/v1/publisher/assets/metadata`
- `POST /api/v1/publisher/assets/metadata/batch`
- `POST /api/v1/publisher/assets/metadata`
- `POST /api/v1/publisher/assets/move`
- `GET /api/v1/publisher/jobs`
- `POST /api/v1/publisher/jobs/run-now/{filename}`
- `POST /api/v1/publisher/jobs/pause/{filename}`
- `POST /api/v1/publisher/jobs/resume/{filename}`
- `POST /api/v1/publisher/jobs/cancel/{filename}`
- `POST /api/v1/publisher/jobs/reschedule`
- `POST /api/v1/publisher/jobs/set-tags`
- `POST /api/v1/publisher/jobs/delete/{filename}`

## Drive
- `POST /api/v1/drive/list`
- `POST /api/v1/drive/folder`
- `POST /api/v1/drive/upload`
- `GET /api/v1/drive/download/{file_id}`
- `GET /api/v1/drive/meta/{file_id}`
- `POST /api/v1/drive/delete`
- `POST /api/v1/drive/move`
- `POST /api/v1/drive/import-to-video-project`
- `POST /api/v1/drive/import-to-kdp-project`

## Settings
- `GET /api/v1/settings/templates`
- `POST /api/v1/settings/templates`
- `PUT /api/v1/settings/templates/{name}`
- `DELETE /api/v1/settings/templates/{name}`
- `GET /api/v1/settings/system-prompts`
- `GET /api/v1/settings/system-prompts/{key}`
- `PUT /api/v1/settings/system-prompts/{key}`
- `GET /api/v1/settings/groq-api-key`
- `PUT /api/v1/settings/groq-api-key`
- `GET /api/v1/settings/openai-api-key`
- `PUT /api/v1/settings/openai-api-key`
- `GET /api/v1/settings/gemini-api-key`
- `PUT /api/v1/settings/gemini-api-key`
- `GET /api/v1/settings/azure-openai`
- `PUT /api/v1/settings/azure-openai`
- `GET /api/v1/settings/looper-presets`
- `PUT /api/v1/settings/looper-presets/{name}`
- `DELETE /api/v1/settings/looper-presets/{name}`

## Looper
- `POST /api/v1/looper/run`
- `GET /api/v1/looper/status/{job_id}`
- `POST /api/v1/looper/cancel/{job_id}`
- `GET /api/v1/looper/file-info`
- `POST /api/v1/looper/watermark/upload`

## Internal Playwright
- `POST /api/v1/internal/playwright/grok/run-project`
- `POST /api/v1/internal/playwright/whisk/run-project`
- `POST /api/v1/internal/playwright/probe`

## Services, Logs, Backup
- `GET /api/v1/services/status/{name}`
- `POST /api/v1/services/start`
- `POST /api/v1/services/stop`
- `GET /api/v1/logs/`
- `GET /api/v1/backup/export-zip`
