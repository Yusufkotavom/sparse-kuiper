# Nomad Hub — REST API Reference

**Base URL:** `http://localhost:8000/api/v1`  
**Interactive Docs:** `http://localhost:8000/docs` (Swagger UI)  
**Local Network:** `http://<server-ip>:8000/api/v1` (jalankan dengan `--host 0.0.0.0`)

---

## Authentication

Tidak ada autentikasi (dirancang untuk localhost/LAN). Untuk production, tambahkan API key middleware.

---

## Publisher — `/publisher`

### `GET /publisher/queue`
Returns semua `.mp4` di upload queue beserta status upload.

**Response:**
```json
{
  "queue": [
    {
      "filename": "video_001.mp4",
      "status": "completed",
      "title": "Judul Video",
      "description": "Deskripsi video...",
      "tags": "#tag1 #tag2",
      "platforms": {
        "tiktok": { "status": "success", "message": "", "timestamp": "..." },
        "youtube": { "status": "failed", "message": "Token expired", "timestamp": "..." }
      },
      "uploaded_at": "2026-03-12T10:00:00"
    }
  ]
}
```

**Status values:** `pending` | `uploading` | `completed` | `completed_with_errors`

---

### `DELETE /publisher/queue/{filename}`
Hapus file dari upload queue dan database.

---

### `POST /publisher/upload/{filename}`
Trigger upload satu video ke platform tertentu (background task).

**Body:**
```json
{
  "title": "My Video Title",
  "description": "Description text",
  "tags": "#tag1 #tag2",
  "platforms": ["tiktok"],
  "account_id": "tiktok_abc123",
  "schedule": "2026-03-15T10:00:00Z",
  "product_id": "",
  "youtube_privacy": "private",
  "youtube_category_id": "22"
}
```

**Platforms supported:** `tiktok` | `youtube` | `facebook` | `instagram`

---

### `POST /publisher/upload/batch`
Trigger batch upload multi-video ke satu atau beberapa platform.

**Body:**
```json
{
  "videos": [
    {
      "filename": "video_001.mp4",
      "title": "Title 1",
      "description": "Desc 1",
      "tags": "#fyp",
      "schedule": "",
      "youtube_privacy": "private",
      "youtube_category_id": "22"
    }
  ],
  "platforms": ["youtube"],
  "account_id": "youtube_abc123"
}
```

---

### `POST /publisher/generate-metadata`
Generate viral title, description, dan tags menggunakan Groq AI.

System prompt dibaca dari `config.json["system_prompts"]["metadata_generate"]` (editable via Settings page).

**Body:**
```json
{ "prompt": "Judul video atau deskripsi singkat konten" }
```

**Response:**
```json
{
  "title": "Judul Viral! 🔥",
  "description": "Tonton video ini sampai habis. Follow untuk lebih banyak konten!",
  "tags": "#viral #fyp #trending"
}
```

---

### `POST /publisher/queue/add`
Copy file dari project folder ke upload_queue/ dan simpan metadata ke DB.

**Body:**
```json
{
  "project_type": "video",
  "relative_path": "my-project/final/video_001.mp4",
  "title": "Generated title",
  "description": "Generated description",
  "tags": "#fyp #viral"
}
```

---

## Scraper — `/scraper`

### `POST /scraper/extract-info`
Extract video list dari channel/playlist tanpa download.

**Body:**
```json
{
  "url": "https://www.youtube.com/@channel",
  "platform": "youtube",
  "media_type": "all",
  "limit": 50,
  "min_views": 10000,
  "date_after": "2025-01-01"
}
```

**media_type values:** `all` | `shorts` | `videos` (YouTube only)

**Response:**
```json
{
  "success": true,
  "channel": "Channel Name",
  "videos": [
    {
      "title": "Video Title",
      "url": "https://youtube.com/watch?v=...",
      "duration": 120,
      "view_count": 50000,
      "thumbnail": "https://..."
    }
  ]
}
```

---

### `POST /scraper/download`
Download satu video ke folder project (background).

**Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "project_name": "MyProject",
  "download_thumbnail": true
}
```

---

### `POST /scraper/download-batch`
Download banyak video sekaligus ke folder project (background).

**Body:**
```json
{
  "urls": ["https://...", "https://..."],
  "project_name": "MyProject",
  "download_thumbnail": false
}
```

---

## Scraper Projects — `/scraper-projects`

### `GET /scraper-projects`
List semua scraper project directories di `video_projects/`.

### `POST /scraper-projects`
Buat project baru.

**Body:** `{ "name": "MyProject" }`

### `GET /scraper-projects/{project_name}/scraped-data`
Get daftar video yang sudah di-scrape (dari `scraped_items.json`).

### `POST /scraper-projects/{project_name}/scraped-data`
Simpan/merge daftar video hasil scrape.

### `GET /scraper-projects/{project_name}/logs`
Get download logs (last N lines dari `download.log`).

**Query:** `?lines=100`

### `GET /scraper-projects/{project_name}/downloads`
List semua file `.mp4` yang sudah didownload beserta metadata.

**Response:**
```json
{
  "files": [
    {
      "filename": "video_abc123.mp4",
      "title": "Judul Asli dari info.json",
      "description": "Deskripsi original (max 500 char)",
      "tags": "#tag1 #tag2 #tag3",
      "duration": 180,
      "view_count": 100000,
      "size_mb": 45.2,
      "uploader": "Channel Name",
      "channel": "Channel Name",
      "has_thumbnail": true
    }
  ]
}
```

### `DELETE /scraper-projects/{project_name}/downloads/{filename}`
Hapus file video beserta `.info.json` dan thumbnail terkait.

### `POST /scraper-projects/{project_name}/downloads/{filename}/queue`
Copy/move file ke upload queue dengan metadata.

**Body:**
```json
{
  "action": "copy",
  "title": "Judul yang sudah diedit",
  "description": "Deskripsi yang sudah diedit",
  "tags": "#tag1 #tag2"
}
```

**action values:** `copy` | `move`

### `GET /scraper-projects/{project_name}/downloads/{filename}/play`
Stream file video (untuk preview player).

### `GET /scraper-projects/{project_name}/downloads/{filename}/thumbnail`
Get thumbnail image file.

---

## Accounts — `/accounts`

### `GET /accounts/`
List semua akun sosmed yang tersimpan.

### `POST /accounts/`
Tambah akun baru.

**Body:**
```json
{
  "name": "My TikTok",
  "platform": "tiktok",
  "auth_method": "playwright",
  "status": "needs_login"
}
```

**platform values:** `tiktok` | `youtube` | `instagram` | `facebook`  
**auth_method values:** `playwright` | `api` | `oauth`

### `PUT /accounts/{account_id}`
Update data akun.

### `DELETE /accounts/{account_id}`
Hapus akun dan session data-nya.

### `POST /accounts/{account_id}/login`
Buka browser Playwright untuk manual login (akun `auth_method: playwright`).

### `POST /accounts/{account_id}/refresh-status`
Re-check cookies untuk update status akun ke `active`.

### `GET /accounts/youtube/auth-url`
Generate OAuth2 URL untuk login YouTube.

### `POST /accounts/youtube/callback`
Exchange authorization code untuk OAuth2 token YouTube.

### `GET /accounts/facebook/auth-url`
Generate OAuth2 URL untuk login Facebook.

### `POST /accounts/facebook/callback`
Exchange code untuk token Facebook + list Facebook Pages.

### `POST /accounts/facebook/select-page`
Pilih Facebook Page yang akan digunakan untuk upload.

---

## Video Projects — `/video`

### `GET /video/projects`
List semua video project directories.

### `POST /video/projects`
Buat video project baru.

**Body:** `{ "name": "my-project" }`

### `GET /video/projects/{project_name}/videos`
List raw dan final videos di project.

**Response:** `{ "raw": ["path/v1.mp4"], "final": ["path/v1.mp4"] }`

### `DELETE /video/projects/{project_name}/videos`
Bulk delete file video.

**Body:** `{ "filenames": ["v1.mp4", "v2.mp4"] }`

### `GET /video/projects/{project_name}/prompts`
Get prompt list dari project.

### `POST /video/projects/{project_name}/prompts`
Simpan prompt list.

**Body:** `{ "prompts": ["Prompt 1", "Prompt 2"] }`

### `POST /video/projects/{project_name}/generate`
Trigger video generation bot (Playwright → Grok AI).

### `POST /video/projects/{project_name}/curate`
Pindahkan raw video ke folder final.

---

## KDP Studio — `/kdp`

### `GET /kdp/projects`
List semua KDP image projects.

### `POST /kdp/projects`
Buat KDP project baru.

### `GET /kdp/projects/{project_name}/images`
List raw dan final images di project.

### `POST /kdp/projects/{project_name}/prompts`
Simpan prompt list dan trigger image generation.

### `POST /kdp/projects/{project_name}/curate`
Pindahkan raw image ke folder final.

### `POST /kdp/projects/{project_name}/generate-pdf`
Compile semua final images menjadi KDP-ready PDF.

---

## Settings — `/settings`

### `GET /settings/templates`
List semua saved prompt templates.

### `POST /settings/templates`
Buat prompt template baru.

**Body:**
```json
{
  "name": "My Template",
  "category": "kdp_coloring",
  "system_prompt": "You are a prompt generator...",
  "prefix": "Prefix text...",
  "suffix": "Suffix text..."
}
```

**category values:** `kdp_coloring` | `story` | `video` | `image_gen` | `custom`

### `PUT /settings/templates/{name}`
Update prompt template.

### `DELETE /settings/templates/{name}`
Hapus prompt template.

### `GET /settings/system-prompts`
List semua system prompts (key → value).

### `GET /settings/system-prompts/{key}`
Get satu system prompt by key.

**key values:** `metadata_generate`

**Response:**
```json
{ "key": "metadata_generate", "value": "You are a viral social media manager..." }
```

### `PUT /settings/system-prompts/{key}`
Update system prompt.

**Body:** `{ "value": "New system prompt text..." }`

---

## Logs — `/logs`

### `GET /logs`
Returns recent backend log entries.

**Query:** `?lines=100`

---

## Static File Mounts

| Path | Serves |
|---|---|
| `/api/v1/projects_static/{path}` | Files dari `projects/` directory |
| `/api/v1/video_projects_static/{path}` | Files dari `video_projects/` directory |
| `/api/v1/upload_queue_static/{path}` | Files dari `upload_queue/` directory |
