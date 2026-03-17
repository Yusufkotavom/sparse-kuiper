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

## Lokasi Data Runtime
- `video_projects/`
- `projects/`
- `upload_queue/`
- `data/sessions/`
- `config.json`
