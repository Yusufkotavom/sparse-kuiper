# Production Deployment Guide (Render + Supabase + Redis)

Dokumen ini untuk deployment **full stack production**:
- Frontend (Next.js)
- Backend API (FastAPI)
- Dedicated worker Redis (publisher_redis_worker)
- Database external (Supabase Postgres)
- Redis external (Upstash/Redis managed)

Blueprint file yang dipakai:
- `render-production.yaml`

---

## 1) Prasyarat

Siapkan terlebih dulu:
1. Supabase project + connection string Postgres.
2. Redis endpoint (disarankan Upstash Redis URL).
3. Repo terbaru sudah ter-push (termasuk `render-production.yaml`).

---

## 2) Arsitektur Production

Service yang akan dibuat Render:
1. `sparse-kuiper-api` (web) — FastAPI API
2. `sparse-kuiper-publisher-worker` (worker) — consumer Redis queue
3. `sparse-kuiper-frontend` (web) — Next.js UI

Flow publish:
- Queue config update -> enqueue signal ke Redis
- Worker consume Redis -> claim state di DB -> execute uploader

---

## 3) Deploy Step-by-step

### Step A — Create Blueprint
1. Render Dashboard -> **New +** -> **Blueprint**.
2. Pilih repository.
3. Pastikan file blueprint yang dipakai: `render-production.yaml`.
4. Klik **Apply**.

### Step B — Set Environment Variables (wajib)
Set env berikut pada **API** dan **Worker**:
- `DATABASE_URL=<supabase postgres url>`
- `REDIS_URL=<redis connection url>`

Set env berikut pada **Frontend**:
- `NEXT_PUBLIC_API_URL=https://<url-api-render-anda>`

### Step C — Set mode redis-first
Di API + worker pastikan:
- `WORKER_MODE=redis`

Di API:
- `PUBLISHER_DISPATCHER_ENABLED=0`

> Catatan: di mode ini dispatcher legacy sengaja dimatikan agar tidak double-processing.

### Step D — Deploy order
Disarankan urutan deploy:
1. API
2. Worker
3. Frontend

---

## 4) Post-deploy Verification

## 4.1 API
- `GET https://<api>/` -> status ok
- `GET https://<api>/docs` -> terbuka

## 4.2 Realtime health
- `GET https://<api>/api/v1/realtime/health`
- Pastikan `database_url_configured=true`.

## 4.3 Worker smoke
1. Tambahkan 1 item ke queue dari UI.
2. Update config item (platform/account).
3. Pastikan item masuk state `queued/scheduled`, lalu diproses worker.
4. Cek logs worker Render:
   - ada log consume/promotion dari Redis,
   - tidak ada loop error berulang.

## 4.4 Frontend
- Buka URL frontend.
- Pastikan queue builder bisa load data dari API.

---

## 5) Operational Checklist

Harian:
- Pantau logs API + Worker.
- Pantau error upload platform.
- Pantau queue backlog.

Mingguan:
- Review failure rate per platform.
- Review retry count/lease timeout.
- Review kredensial expired (account cookies/tokens).

---

## 6) Rollback Plan (1-step)

Jika ada issue di redis-first:
1. Ubah env API ke:
   - `WORKER_MODE=legacy`
   - `PUBLISHER_DISPATCHER_ENABLED=1`
2. Redeploy API.
3. Stop service worker sementara.

Ini mengembalikan proses ke dispatcher DB-polling lama.

---

## 7) Production Hardening (disarankan)

1. Aktifkan auth/rate-limit untuk API publik.
2. Tambah alerting untuk:
   - worker crash,
   - queue backlog tinggi,
   - fail rate upload spike.
3. Gunakan secret manager Render (jangan hardcode token/key).
4. Putuskan kebijakan retry + dead-letter queue.

---

## 8) FAQ cepat

### Apakah bisa tetap tanpa Redis?
Bisa, tapi untuk production scaling disarankan Redis + worker dedicated.

### Apakah frontend wajib di Render?
Tidak wajib. Bisa di Vercel/Cloudflare Pages, cukup set `NEXT_PUBLIC_API_URL`.

### Apakah Supabase wajib?
Tidak wajib, asal PostgreSQL kompatibel dan `DATABASE_URL` valid.
