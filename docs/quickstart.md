# Quick Start (Lokal)

## Prasyarat
- Python 3.11+
- Node.js 18+
- Playwright browser runtime

## Opsi A — Setup otomatis (Windows)
```bash
setup_local.bat
run_local.bat
```

## Opsi B — Setup manual

### 1) Backend
```bash
pip install -r backend/requirements.txt
playwright install chromium firefox
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend
```bash
cd frontend
npm install
npm run dev
```

## URL Lokal
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Swagger/OpenAPI: `http://localhost:8000/docs`

## Konfigurasi dasar
- Frontend environment:
  - `frontend/.env.local`
  - `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`
- Backend key/config:
  - `config.json` (Groq/OpenAI/Gemini/Azure)
  - atau environment variable (`.env`) sesuai kebutuhan deploy

## Validasi cepat setelah startup
```bash
# frontend
cd frontend
npm run lint
npm run build
```

```bash
# backend (dari root)
python -m compileall backend
```

## Validasi fitur Publisher (disarankan)
- Buka `http://localhost:3000/queue` lalu pastikan item queue tampil dan thumbnail muncul.
- Buka `http://localhost:3000/publisher` untuk trigger upload single/bulk.
- Buka `http://localhost:3000/published` untuk konfirmasi status sukses/gagal per platform.

## Validasi fitur rotasi akun Grok/Whisk
- Login akun Grok/Whisk lewat `http://localhost:3000/accounts`.
- Simpan pilihan akun per project di:
  - `http://localhost:3000/video/ideation` (Grok Account)
  - `http://localhost:3000/kdp/ideation` (Whisk Account)
