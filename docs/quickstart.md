# Quick Start (Local Dev)

## Prerequisites
- Python 3.11+
- Node.js 18+
- Git
- Optional: Groq API Key (untuk AI prompt)

## Backend (FastAPI)
```bash
cd /path/to/sparse-kuiper
pip install -r backend/requirements.txt
playwright install chromium firefox
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
Endpoint:
- API: http://localhost:8000/api/v1
- Docs: http://localhost:8000/docs

## Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Akses UI: http://localhost:3000

## Konfigurasi Frontend
Set environment:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```
Atau via LocalStorage (di UI Settings): `sk_api_base_url`

## Struktur Proyek (ringkas)
- frontend/src/app/* → halaman
- frontend/src/components/* → komponen UI (shadcn/ui)
- frontend/src/lib/api.ts → client API
- backend/main.py → entry FastAPI
- backend/routers/* → modul endpoint
- backend/services/* → worker/uploader/yt-dlp
- video_projects/, projects/, upload_queue/ → data runtime (gitignored)

## Commands Penting
```bash
# Frontend
npm run build
npm run start
npm run lint

# Backend
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
