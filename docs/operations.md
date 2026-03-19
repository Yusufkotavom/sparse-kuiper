# Operations Runbook

## Startup Lokal
```bash
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm run dev
```

## Health Check
- Backend: `GET /`
- OpenAPI: `GET /openapi.json`
- UI: buka `http://localhost:3000`

## Command Validasi
```bash
# backend
python -m compileall backend

# frontend
cd frontend
npm run lint
npm run build
```

## Troubleshooting Cepat
- Queue item tidak muncul: cek folder `video_projects/*/*/queue` atau `upload_queue`.
- Upload gagal auth: cek `data/sessions/<account_id>/cookies.txt` atau OAuth token account.
- Static media 404: verifikasi path relatif project dan mount static di `backend/main.py`.
- Telegram test gagal: cek toggle enabled, `bot_token`, `chat_id`, dan pastikan bot sudah pernah menerima pesan dari chat tujuan.

## Published & Konfirmasi Upload
- Halaman `/published` mengambil histori dari endpoint `GET /api/v1/publisher/queue/published`.
- Status upload per platform dibaca dari `platforms.<platform>.status` (`success`/`failed`).
- Detail hasil worker tampil di `platforms.<platform>.message` dan `last_error` (jika ada).
- Untuk upload TikTok Playwright, hasil akhir diambil dari file `data/upload_jobs/*_result.json` lalu disimpan ke DB queue.
- Jika Telegram aktif, notifikasi dikirim saat upload file mencapai status final `completed` atau `completed_with_errors`.

## Telegram Notifications
- Setting dilakukan dari halaman `/settings` → `Integrations` → `Telegram Bot`.
- Backend menyimpan konfigurasi di `config.json` blok `telegram`.
- Tombol `Send Test` memakai endpoint `POST /api/v1/settings/telegram/test`.
- Trigger notifikasi yang aktif:
  - generation task `succeeded` / `failed`
  - publisher upload per file `completed` / `completed_with_errors`

## Rotasi Akun Grok/Whisk
- Session setiap akun menggunakan folder: `data/sessions/<account_id>/chrome_profile`.
- Login manual akun dilakukan dari halaman `/accounts` untuk akun platform `grok` / `whisk`.
- Pilihan akun generator ada di:
  - `/video/ideation` → `Grok Account`
  - `/kdp/ideation` → `Whisk Account`
- Jika project belum memilih akun, backend fallback ke akun aktif terbaru untuk platform terkait.

## Lokasi Data Runtime
- `video_projects/`
- `projects/`
- `upload_queue/`
- `data/sessions/`
- `config.json`
