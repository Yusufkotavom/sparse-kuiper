# Sparse Kuiper — Arsitektur Sistem

## Gambaran Umum
Sparse Kuiper adalah monorepo dengan frontend Next.js dan backend FastAPI.

```text
Browser (Next.js)
   │
   ▼
REST API (/api/v1/*)
   │
   ▼
FastAPI Routers + SQLAlchemy
   │
   ├─ SQLite (state aplikasi)
   ├─ Worker Playwright (bot/generator/uploader)
   ├─ yt-dlp service (extract/download)
   └─ Prompt engine (Groq/OpenAI/Gemini/Azure)
```

## Komponen Utama
- `frontend/src/app/*` — halaman aplikasi (accounts, kdp, video, scraper, publisher, queue-manager, settings, logs, looper)
- `frontend/src/lib/api.ts` — pusat request API frontend
- `backend/main.py` — registrasi router + mount static
- `backend/routers/*` — endpoint domain API
- `backend/services/*` — worker, uploader, utility eksternal
- `backend/models/*` — model SQLAlchemy
- `backend/core/*` — config, DB session, logger

## Domain API
- `/api/v1/accounts` — lifecycle akun + OAuth + Playwright login
- `/api/v1/video` — project video (prompts, generation, stage move)
- `/api/v1/kdp` — project KDP (prompts, generation, PDF)
- `/api/v1/scraper` & `/api/v1/scraper-projects` — extract/download + project scraping
- `/api/v1/publisher` — queue, metadata, upload, jobs
- `/api/v1/settings` — template & key model provider
- `/api/v1/services` — start/stop service lokal
- `/api/v1/looper` — looper job async + watermark upload
- `/api/v1/logs` — observability log

## Alur Data Inti
1. Scrape/download video ke `video_projects/<project>/raw_videos`.
2. Entri queue diproses ke `raw_videos/queue` atau `upload_queue`.
3. Metadata dikelola via `publisher/assets` + sidecar `.meta.json`.
4. Job upload dijalankan per-platform melalui worker uploader.
5. Status upload dan job disimpan di tabel queue (SQLite).

## Struktur Runtime
- `video_projects/` — data project video
- `projects/` — data project KDP
- `upload_queue/` — queue legacy/global
- `data/sessions/` — cookies/session Playwright
- `config.json` — API key + templates + system prompts

## Catatan Arsitektur Terkini
- Router `publisher` sudah menjadi aggregator modular:
  - `publisher_queue.py`
  - `publisher_uploads.py`
  - `publisher_metadata.py`
  - `publisher_assets.py`
  - `publisher_jobs.py`
- Schema request banyak router sudah dipindah ke `*_schemas.py` untuk menjaga file router tetap fokus pada endpoint logic.
