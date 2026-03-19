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
   ├─ PostgreSQL / Supabase (state aplikasi)
   ├─ Worker Playwright (bot/generator/uploader)
   ├─ Publisher dispatcher (DB polling worker dasar)
   ├─ yt-dlp service (extract/download)
   └─ Prompt engine (Groq/OpenAI/Gemini/Azure)
```

## Komponen Utama
- `frontend/src/app/*` — halaman aplikasi (accounts, kdp, video, scraper, queue-builder, queue-manager, settings, logs, looper)
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
- `/api/v1/publisher` — queue builder backend API, metadata, upload legacy, jobs
- `/api/v1/settings` — template, provider keys, dan integrasi Telegram
- `/api/v1/services` — start/stop service lokal
- `/api/v1/looper` — looper job async + watermark upload
- `/api/v1/logs` — observability log

## Alur Data Inti
1. Scrape/download video ke `video_projects/<project>/raw_videos`.
2. Asset dikirim ke queue project dan diregistrasikan di `upload_queue`.
3. Metadata dikelola via `publisher/assets` + sidecar `.meta.json`.
4. Queue Builder menyimpan konfigurasi job (platform/account/schedule) ke record queue.
5. Dispatcher polling mengambil item `queued/scheduled` dari DB.
6. Uploader menjalankan publish per-platform dan mengembalikan hasil ke record queue yang sama.
7. Event penting dapat memicu notifikasi Telegram melalui service notifier terpusat.

## Struktur Runtime
- `video_projects/` — data project video
- `projects/` — data project KDP
- `upload_queue/` — queue legacy/global
- `data/sessions/` — cookies/session Playwright
- `config.json` — API key + templates + system prompts
- `config.json.telegram` — bot token, chat ID, dan toggle notifikasi Telegram

## Catatan Arsitektur Terkini
- Frontend utama untuk publishing sekarang memakai istilah **Queue Builder**.
- Route frontend utama: `/queue-builder`.
- Route `/publisher` tetap dipertahankan sebagai redirect kompatibilitas.
- Router `publisher` sudah menjadi aggregator modular:
  - `publisher_queue.py`
  - `publisher_uploads.py`
  - `publisher_metadata.py`
  - `publisher_assets.py`
  - `publisher_jobs.py`
- Dispatcher dasar sekarang tersedia di:
  - `backend/services/publisher_dispatcher.py`
- Worker queue saat ini sudah mendukung:
  - polling DB
  - state `queued/scheduled/running/completed/failed/canceled`
  - lease dasar via `lease_expires_at`
  - retry dasar via `next_retry_at`
- Service notifikasi Telegram dipusatkan di `backend/services/telegram_notifier.py` agar router dan worker berbagi helper yang sama.
- Schema request banyak router sudah dipindah ke `*_schemas.py` untuk menjaga file router tetap fokus pada endpoint logic.

## Catatan Batasan Saat Ini
- Model `upload_queue` masih mencampur asset queue, job config, execution state, retry state, dan result platform.
- Dispatcher masih berjalan sebagai thread di proses FastAPI, belum dipisah menjadi worker service dedicated.
- Belum ada tabel `job_events` atau pemisahan penuh `assets` vs `publish_jobs`.
