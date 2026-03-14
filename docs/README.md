# 🤖 AIO Super App — Nomad Hub Dashboard

**Nomad Hub** adalah dashboard otomasi all-in-one untuk kreator konten digital. Generate gambar KDP, buat video otomatis, scrape & download video dari berbagai platform, hingga bulk publish ke TikTok / YouTube / Facebook / Instagram — semua dalam satu antarmuka.

[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016-black?logo=nextdotjs)](https://nextjs.org)
[![Database](https://img.shields.io/badge/Database-SQLite-blue?logo=sqlite)](https://sqlite.org)
[![AI](https://img.shields.io/badge/AI-Groq%20LLaMA-orange)](https://groq.com)

---

## ✨ Fitur Utama

| Module | Deskripsi |
|---|---|
| 🎨 **KDP Studio** | Generate prompt gambar AI, otomasi ke Google Flow via Playwright, ekspor PDF standar KDP |
| 🎬 **Video Gen** | Generate prompt video AI, otomasi ke Grok AI untuk buat video, kurasikan hasil terbaik |
| 🌐 **Web Scraper** | Scrape channel/playlist YouTube/TikTok/Instagram/Facebook, batch download video dengan yt-dlp |
| 📂 **Downloads Manager** | Kelola file hasil download: edit metadata (title/desc/tags), generate metadata via Groq AI, kirim ke upload queue |
| 📂 **Queue Manager** | Library media proyek dengan filter status, badge Published/Pending/Failed, dan tombol upload langsung |
| 📤 **Publisher** | Upload video ke TikTok/YouTube/Facebook/Instagram dengan metadata unik, jadwal otomatis, batch upload |
| 👤 **Accounts** | Kelola akun TikTok (Playwright), YouTube (OAuth2), Facebook (OAuth2), Instagram (Playwright) |
| ⚙️ **Settings** | Manajemen template prompt AI + konfigurasi system prompt untuk AI metadata generator |
| 📋 **Logs** | Real-time log viewer untuk semua aktivitas background bot |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API Key (gratis di [console.groq.com](https://console.groq.com))

### 1. Clone & Install Backend

```bash
git clone <repo-url>
cd sparse-kuiper

# Copy and fill environment variables
cp .env.example .env
# Edit .env dan set GROQ_API_KEY (opsional: bisa juga simpan di config.json)

# Install Python dependencies
pip install -r backend/requirements.txt

# Install Playwright browsers
playwright install chromium firefox
```

### 2. Install & Run Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Run Backend

```bash
# Di root project
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs

> 📌 Database SQLite (`nomad_hub.db`) dibuat otomatis saat pertama startup. Data dari `accounts.json` dan `status.json` lama auto-migrate ke SQLite.

---

## 📁 Project Structure

```
sparse-kuiper/
├── frontend/                  # Next.js frontend (App Router)
│   └── src/
│       ├── app/
│       │   ├── accounts/      # Manajemen akun sosmed
│       │   ├── kdp/           # KDP Studio (generator + curation)
│       │   ├── logs/          # Real-time log viewer
│       │   ├── publisher/     # Upload ke sosmed
│       │   ├── queue-manager/ # Upload queue + status tracker
│       │   ├── scraper/       # Web scraper + downloads manager
│       │   ├── settings/      # Prompt templates + AI config
│       │   └── video/         # Video generator + curation
│       ├── components/        # Reusable UI components (Sidebar, dll)
│       └── lib/api.ts         # Centralized API client (uses NEXT_PUBLIC_API_URL)
│
├── backend/                   # FastAPI backend
│   ├── main.py                # Entry point — router registration
│   ├── core/
│   │   ├── config.py          # Settings, env vars, path constants
│   │   ├── database.py        # SQLAlchemy engine + SessionLocal
│   │   ├── migrations.py      # JSON→SQLite seed migration
│   │   └── logger.py          # Logging setup
│   ├── models/                # SQLAlchemy ORM models
│   │   ├── account.py         # Account model
│   │   ├── upload_queue.py    # UploadQueueItem model
│   │   └── project_config.py  # ProjectConfig model
│   ├── routers/               # API endpoint handlers
│   │   ├── accounts.py        # /api/v1/accounts
│   │   ├── publisher.py       # /api/v1/publisher
│   │   ├── video.py           # /api/v1/video
│   │   ├── kdp.py             # /api/v1/kdp
│   │   ├── settings.py        # /api/v1/settings
│   │   ├── scraper.py         # /api/v1/scraper
│   │   ├── scraper_projects.py# /api/v1/scraper-projects
│   │   └── logs.py            # /api/v1/logs
│   └── services/              # Background workers & uploaders
│       ├── bot_worker.py       # KDP image generation Playwright bot
│       ├── video_worker.py     # Video generation Playwright bot
│       ├── ytdlp_service.py    # yt-dlp wrapper (scrape + download)
│       ├── prompt_engine.py    # Groq prompt generation
│       ├── playwright_login.py # Playwright session login helper
│       └── uploaders/
│           ├── tiktok_uploader.py   # TikTok upload (Playwright)
│           ├── youtube_uploader.py  # YouTube upload (OAuth2 API)
│           ├── facebook_uploader.py # Facebook upload (Graph API)
│           └── instagram_uploader.py# Instagram upload (Playwright)
│
├── video_projects/            # Video projects & downloaded files (gitignored)
├── projects/                  # KDP image projects (gitignored)
├── upload_queue/              # Video queue untuk publishing (gitignored)
├── data/                      # Session files & cookies (gitignored)
├── chrome_profile/            # Playwright Chrome profile (gitignored)
├── global_profiles/           # Multi-account profiles (gitignored)
├── nomad_hub.db               # SQLite database (gitignored)
├── config.json                # Groq API key + templates + system prompts
├── .env.example               # Environment variables template
└── CLAUDE.md                  # AI assistant coding instructions
```

---

## 🔧 Configuration

Copy `.env.example` ke `.env`:

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq AI API key untuk generate prompt & metadata |
| `DATABASE_URL` | ❌ | Default: `sqlite:///<repo-root>/nomad_hub.db` |
| `YOUTUBE_CLIENT_SECRETS_FILE` | ❌ | Path ke `client_secrets.json` untuk OAuth YouTube |
| `FACEBOOK_APP_ID` | ❌ | Facebook App ID untuk Graph API |
| `FACEBOOK_APP_SECRET` | ❌ | Facebook App Secret |

Untuk PostgreSQL (production):
```
DATABASE_URL=postgresql://user:password@localhost:5432/nomad_hub
```

Frontend API base URL dibaca dari `frontend/.env.local`:
- `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`

---

## 🏗️ Architecture

Lihat [`docs/architecture.md`](docs/architecture.md) untuk desain sistem lengkap.

```
Browser (Next.js:3000) ──HTTP──► FastAPI Backend (:8000) ──SQLAlchemy──► SQLite
                                          │
                    ┌─────────────────────┼──────────────────────────┐
                    │                     │                          │
              Playwright Bots        yt-dlp Service           Groq AI (LLaMA 3.3)
              (KDP, Video, TikTok,   (Scrape + Download)      (Prompt & Metadata
               Instagram upload)      video dari sosmed)        Generation)
```

---

## 📖 Documentation

- 📚 [`docs/api_reference.md`](docs/api_reference.md) — Full REST API reference
- 🚀 [`docs/deployment.md`](docs/deployment.md) — VPS Linux deployment guide
- 🏗️ [`docs/architecture.md`](docs/architecture.md) — System architecture & data flows
- 🤖 [`CLAUDE.md`](CLAUDE.md) — AI assistant coding instructions

---

## 🛠️ Development

### Menambah Backend Endpoint Baru
1. Buat `backend/routers/my_feature.py`
2. Define `router = APIRouter()` dan tambahkan endpoints
3. Register di `backend/main.py`

### Menambah Frontend Page Baru
1. Buat `frontend/src/app/my-page/page.tsx`
2. Tambahkan `"use client"` di baris pertama
3. Tambahkan API calls ke `frontend/src/lib/api.ts`
4. Tambahkan navigation link di `frontend/src/components/Sidebar.tsx`

---

*Built with ❤️ for content creators who want to automate their workflow.*
