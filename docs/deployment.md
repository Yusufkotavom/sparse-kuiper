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

## Security Minimum
- Jangan expose server tanpa auth/rate limit di internet publik.
- Jangan commit `config.json`, OAuth secrets, database, session cookies.
- Batasi akses file runtime (`data/`, `video_projects/`, `projects/`).
