# Sparse Kuiper Documentation

Dokumentasi resmi proyek **Sparse Kuiper** (FastAPI + Next.js) untuk workflow otomasi konten: KDP, video, scraper, queue, publisher, account auth, dan operasi service.

## Ringkasan Sistem
- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: Next.js App Router + shadcn/ui
- Worker: Playwright, yt-dlp, uploader platform
- Storage kerja: `video_projects/`, `projects/`, `upload_queue/`, `data/`

## Navigasi Dokumen
- [quickstart.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/quickstart.md) — setup lokal cepat (Windows-friendly)
- [architecture.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/architecture.md) — arsitektur aplikasi & aliran data
- [api_reference.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/api_reference.md) — daftar endpoint backend terbaru
- [operations.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/operations.md) — runbook operasional harian
- [deployment.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/deployment.md) — panduan deployment
- [ssh.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/ssh.md) — pola koneksi SSH aman
- [shadcn_first_ui.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/shadcn_first_ui.md) — standar UI frontend
- [documentation.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/documentation.md) — kebijakan dokumentasi

## Struktur Inti Repository
```text
sparse-kuiper/
├─ backend/
│  ├─ main.py
│  ├─ core/
│  ├─ models/
│  ├─ routers/
│  └─ services/
├─ frontend/
│  └─ src/
├─ docs/
├─ video_projects/
├─ projects/
├─ upload_queue/
└─ data/
```

## Catatan Penting
- Router `publisher` sudah dipecah modular: queue, uploads, metadata, assets, jobs.
- Beberapa router besar juga sudah dipecah skema request ke file `*_schemas.py`.
- Endpoint histori publish terpisah dari queue aktif: `GET /api/v1/publisher/queue/published`.
- Queue list menggunakan endpoint thumbnail: `GET /api/v1/publisher/queue/thumbnail/{filename}`.
- Rotasi akun generator Grok/Whisk berbasis profile per akun di `data/sessions/<account_id>/chrome_profile`.
- Untuk endpoint terkini, selalu jadikan `GET /docs` dan [api_reference.md](file:///c:/Users/admin/Desktop/New%20folder%20(4)/sparse-kuiper/docs/api_reference.md) sebagai sumber utama.
