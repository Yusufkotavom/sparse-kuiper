# Nomad Hub — System Architecture

## Overview

Nomad Hub adalah **monorepo** dengan frontend dan backend terpisah yang berkomunikasi via REST API.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Browser / User Device                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP (port 3000)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Next.js Frontend (App Router)                      │
│                                                                     │
│  Pages:                                                             │
│   /            → Dashboard (landing)                                │
│   /accounts    → Manajemen akun sosmed (TikTok/YT/FB/IG)           │
│   /kdp         → KDP Studio (generate + curation KDP)              │
│   /video       → Video Generator (generate + curation)              │
│   /scraper     → Web Scraper & Downloader                           │
│   /scraper/downloads → Downloads Manager (edit metadata + queue)   │
│   /queue-manager → Upload Queue (track status per platform)         │
│   /publisher   → Publish ke TikTok/YT/FB/IG                        │
│   /settings    → Prompt templates + AI metadata prompt config       │
│   /logs        → Real-time backend log viewer                       │
│                                                                     │
│  lib/api.ts → Semua API calls (single source of truth)              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP REST (port 8000)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FastAPI Backend                             │
│                                                                     │
│  Routers:                                                           │
│   /api/v1/accounts        → Akun sosmed CRUD + login Playwright     │
│   /api/v1/publisher       → Upload queue, trigger upload, gen meta  │
│   /api/v1/video           → Video project management                │
│   /api/v1/kdp             → KDP project management                  │
│   /api/v1/settings        → Prompt templates + system prompts       │
│   /api/v1/scraper         → Extract info + download via yt-dlp      │
│   /api/v1/scraper-projects→ Project management + downloads CRUD      │
│   /api/v1/logs            → Log file reader                         │
│                                                                     │
│  Core:    config.py, database.py, migrations.py, logger.py          │
│  Models:  Account, UploadQueueItem, ProjectConfig                   │
│                                                                     │
│  ┌────────────────────┐   ┌─────────────────────────────────────┐   │
│  │   SQLAlchemy ORM   │   │         Background Services         │   │
│  │   SQLite (default) │   │                                     │   │
│  │   (nomad_hub.db)   │   │  bot_worker.py   — KDP Playwright   │   │
│  └────────────────────┘   │  video_worker.py — Video Playwright │   │
│                           │  ytdlp_service.py— Scrape/Download  │   │
│  ┌────────────────────┐   │                                     │   │
│  │  config.json       │   │  Uploaders:                         │   │
│  │  • groq_api_key    │   │   tiktok_uploader.py  (Playwright)  │   │
│  │  • templates{}     │   │   youtube_uploader.py (OAuth2 API)  │   │
│  │  • system_prompts{}│   │   facebook_uploader.py(Graph API)   │   │
│  └────────────────────┘   │   instagram_uploader.py(Playwright) │   │
│                           └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flows

### 1. KDP Image Generation Flow
```
User buat project → Set prompt config (topic, character, template)
→ Groq LLaMA 3.3 → Generate N prompts
→ bot_worker.py (Playwright) → Google Flow (web)
→ Download images → projects/{project}/raw_images/
→ User curasikan (raw → final)
→ PDF Engine (Pillow) → KDP-ready PDF
```

### 2. Video Generation Flow
```
User buat video project → Set prompt config
→ Groq LLaMA 3.3 → Generate N prompts
→ video_worker.py (Playwright) → Grok AI web
→ Download videos → video_projects/{project}/raw_videos/
→ User kurasikan (raw → final)
```

### 3. Scraper & Download Flow
```
User input URL channel/playlist/video
→ Scraper page → POST /api/v1/scraper/extract-info
→ ytdlp_service.py (yt-dlp) → Extract video list (title, duration, views, thumbnail)
→ Simpan ke video_projects/{project}/scraped_items.json
→ User pilih video → POST /api/v1/scraper/download-batch
→ yt-dlp download .mp4 + .info.json + thumbnail
→ video_projects/{project}/{video}.mp4
```

### 4. Metadata Edit & Queue Flow
```
Downloads page → Baca .info.json → Tampilkan title/description/tags otomatis
→ User edit metadata (atau Generate with AI)
→ Generate with AI: POST /api/v1/publisher/generate-metadata
  → Baca system prompt dari config.json["system_prompts"]["metadata_generate"]
  → Groq LLaMA 3.3 → Return {title, description, tags}
→ Send to Queue: POST /api/v1/scraper-projects/{project}/downloads/{file}/queue
  → Copy/Move file ke upload_queue/
  → Simpan title+description+tags ke SQLite (UploadQueueItem)
```

### 5. Publishing Flow
```
Publisher page → GET /api/v1/publisher/queue → List pending videos
→ User pilih video + akun + platform + jadwal
→ POST /api/v1/publisher/upload/{filename}
→ Background Task:
    TikTok  → tiktok_uploader.py (Playwright)
    YouTube → youtube_uploader.py (Google API v3 OAuth2)
    Facebook→ facebook_uploader.py (Graph API)
    Instagram→ instagram_uploader.py (Playwright)
→ Status update di SQLite → Badge di Queue Manager
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js (App Router) | SSR/CSR pages, routing |
| UI Components | shadcn/ui + Radix UI | Dialog, Button, Input, dll |
| Icons | Lucide React | Icon set |
| Styling | Tailwind CSS + CSS variables | Design system & responsive layout |
| Backend | FastAPI | REST API, async handlers |
| Database ORM | SQLAlchemy 2.0 | Type-safe database access |
| Database | SQLite (default) | Zero-dependency local storage |
| Database (prod) | PostgreSQL | Multi-user, cloud deployment |
| AI | Groq LLaMA 3.3 70B | Prompt & metadata generation |
| Video Downloader | yt-dlp | Scrape & download multi-platform |
| Automation | Playwright | Browser bots (KDP, Video, TikTok, IG) |
| Image Processing | Pillow | KDP PDF preparation |
| YouTube Upload | Google API v3 | OAuth2 video upload |
| Facebook Upload | Facebook Graph API | Page video upload |

---

## File System Layout

| Directory/File | Purpose | In Git? |
|---|---|---|
| `frontend/` | Next.js app source | ✅ |
| `backend/` | FastAPI + services | ✅ |
| `docs/` | Documentation | ✅ |
| `video_projects/` | Downloaded & generated videos | ❌ |
| `projects/` | KDP image projects | ❌ |
| `upload_queue/` | Videos queued for publishing | ❌ |
| `data/` | Session files + cookies | ❌ |
| `chrome_profile/` | Playwright Chrome profile | ❌ |
| `global_profiles/` | Multi-account browser profiles | ❌ |
| `nomad_hub.db` | SQLite database | ❌ |
| `config.json` | Groq key + templates + system prompts | ❌ |
| `.env` | Active environment variables | ❌ |

---

## Database Schema

### `accounts`
| Column | Type | Description |
|---|---|---|
| id | String PK | e.g. `tiktok_abc123`, `youtube_xyz` |
| name | String | Display name |
| platform | String | tiktok / youtube / instagram / facebook |
| auth_method | String | playwright / api / oauth |
| status | String | active / needs_login / disconnected |
| api_key | String | Optional API credentials |
| oauth_token_json | Text | OAuth2 token JSON (YouTube/Facebook) |
| page_id | String | Facebook Page ID |
| last_login | DateTime | Last successful login |

### `upload_queue`
| Column | Type | Description |
|---|---|---|
| filename | String PK | `.mp4` filename |
| status | String | pending / uploading / completed / completed_with_errors |
| title | Text | Video title (editable) |
| description | Text | Video description (editable) |
| tags | String | Hashtags (editable) |
| platforms | Text (JSON) | Per-platform upload results & status |
| scheduled_at | DateTime | Optional scheduled publish time |
| uploaded_at | DateTime | When successfully uploaded |

### `project_configs`
| Column | Type | Description |
|---|---|---|
| id | Integer PK | Auto-increment |
| name | String | Project name |
| project_type | String | video / kdp |
| topic | String | Generation topic |
| character | String | Character config |
| system_prompt | Text | AI system prompt used |
| prompts_json | Text (JSON) | Array of generated prompts |

---

## config.json Structure

```json
{
  "groq_api_key": "gsk_...",
  "templates": {
    "Template Name": {
      "category": "kdp_coloring | story | video | image_gen | custom",
      "system_prompt": "...",
      "prefix": "...",
      "suffix": "..."
    }
  },
  "system_prompts": {
    "metadata_generate": "System prompt untuk AI metadata generator di Downloads page..."
  }
}
```

---

## Network Access (Local Network)

Untuk mengakses dari perangkat lain di jaringan lokal (HP, tablet, PC lain):

```bash
# Backend — bind ke semua interface (bukan hanya localhost)
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Frontend — set API URL ke IP komputer server
# Di frontend/.env.local:
NEXT_PUBLIC_API_URL=http://192.168.1.X:8000

# Jalankan Next.js agar bisa diakses dari LAN
cd frontend && npm run dev -- --hostname 0.0.0.0
```

Akses dari device lain: `http://192.168.1.X:3000`
