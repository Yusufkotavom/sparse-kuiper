# Nomad Hub Frontend (Next.js)

Frontend dashboard untuk Nomad Hub (KDP Studio, Video Gen, Scraper, Queue, Publisher, Accounts).

## Prerequisites
- Node.js 18+ (disarankan Node 20)
- Backend FastAPI berjalan di port `8000`

## Konfigurasi
Pastikan file `.env.local` berisi API base URL backend FastAPI:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Menjalankan Lokal

```bash
npm install
npm run dev
```

- Frontend: http://localhost:3000
- Backend docs (Swagger): http://localhost:8000/docs

## Build Produksi

```bash
npm run build
npm run start
```

## Lint

```bash
npm run lint
```
