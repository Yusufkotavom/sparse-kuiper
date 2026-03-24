# Deployment Guide

## Opsi Umum
- Reverse proxy: Nginx/Caddy
- Backend: Uvicorn (disarankan lewat process manager)
- Frontend: `npm run build && npm run start`

## Environment Wajib
- `NEXT_PUBLIC_API_URL` (frontend)
- `config.json` atau env untuk provider key (Groq/OpenAI/Gemini/Azure)

## Checklist Deploy
1. Pull source terbaru.
2. Install dependency backend/frontend.
3. Jalankan build frontend.
4. Jalankan backend + frontend via process manager.
5. Verifikasi endpoint `/`, `/docs`, dan UI halaman utama.

## Deploy Backend ke Render Free Tier

### 1) Persiapan repository
1. Push project ini ke GitHub/GitLab terlebih dahulu.
2. Pastikan file `render.yaml` ikut ter-push (sudah disediakan di root repo).

### 2) Deploy via Blueprint (backend only)
1. Login ke Render.
2. Pilih **New +** → **Blueprint**.
3. Pilih repository project.
4. Render akan membaca `render.yaml` dan membuat resource berikut:
   - `sparse-kuiper-db` (managed PostgreSQL, free)
   - `sparse-kuiper-backend` (FastAPI web service, free)
5. Klik **Apply** untuk mulai deploy.

### 3) Tambahkan environment variable secret backend
Isi di service backend sesuai kebutuhan fitur:
- `GROQ_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

> Catatan: Render free tier memiliki keterbatasan resource dan service bisa sleep saat idle.

### 4) Validasi pasca deploy backend
- Backend health: `GET https://<backend>/`
- Swagger docs: `GET https://<backend>/docs`

### 5) Hubungkan frontend (jika frontend di-host terpisah)
- Set env frontend: `NEXT_PUBLIC_API_URL=https://<url-backend-render-anda>`

### Troubleshooting Render
- Jika log menampilkan `ModuleNotFoundError: No module named 'psycopg2'`, pastikan memakai versi kode terbaru.
- Backend sudah dinormalisasi untuk memakai driver `psycopg` (`postgresql+psycopg://...`) agar kompatibel dengan dependency `psycopg` di `backend/requirements.txt`.
- Setelah update kode, lakukan redeploy backend dari commit terbaru.

## Security Minimum
- Jangan expose server tanpa auth/rate limit di internet publik.
- Jangan commit `config.json`, OAuth secrets, database, session cookies.
- Batasi akses file runtime (`data/`, `video_projects/`, `projects/`).
