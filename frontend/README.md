# Nomad Hub Frontend (Next.js)

Frontend dashboard untuk Nomad Hub (KDP Studio, Video Gen, Scraper, Queue, Publisher, Accounts).

## Prerequisites
- Node.js 18+ (disarankan Node 20)
- Backend FastAPI berjalan di port `8000`

## Konfigurasi
Copy template env lalu sesuaikan value:

```bash
cp .env.example .env.local
```

Isi minimal `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_REALTIME_SCHEMA=public
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
