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

## Penting: Limit plan Render Free

Jika kamu mendapat error:
`Create background worker ... (service type is not available for this plan)`

artinya akun/plan saat ini **tidak mendukung `type: worker`**.

Solusi:
1. **Naikkan plan** lalu gunakan `render-production.yaml` (redis-first, worker terpisah), atau
2. Tetap di free tier dengan blueprint khusus **tanpa worker service**:
   - `render-free-fullstack.yaml`
   - mode queue: `WORKER_MODE=legacy` (dispatcher jalan di proses API)

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
3. Pilih salah satu:
   - `render-production.yaml` (butuh plan yang support worker service), atau
   - `render-free-fullstack.yaml` (free-tier friendly, tanpa worker service).
4. Klik **Apply**.

### Step B — Set Environment Variables (wajib)
Set env berikut pada **API** dan **Worker**:
- `DATABASE_URL=<supabase postgres url>`
- `REDIS_URL=<redis connection url>`

Set env berikut pada **Frontend**:
- `NEXT_PUBLIC_API_URL=https://<url-api-render-anda>`

### Step B2 — Upload Secret Files (YouTube/Drive OAuth)
Jika memakai Render Secret Files:
1. Upload file OAuth client secret Google dengan ekstensi `.json` (bukan `.js`).
2. Nama file yang didukung:
   - `client_secrets.json`, atau
   - `client_secret_*.apps.googleusercontent.com*.json`
3. Saat startup, backend akan auto-copy file dari `/etc/secrets` ke:
   - `config/youtube_secrets/`
   - `config/google_secrets/`

Jika file berakhiran `.js`, backend akan memberi warning dan file tidak dipakai sebagai OAuth secret.

### Step C — Set mode redis-first
Di API + worker pastikan:
- `WORKER_MODE=redis`

Di API:
- `PUBLISHER_DISPATCHER_ENABLED=0`

> Catatan: di mode ini dispatcher legacy sengaja dimatikan agar tidak double-processing.

### Step C-alt — Mode free-tier (tanpa worker service)
Jika pakai `render-free-fullstack.yaml`, gunakan:
- `WORKER_MODE=legacy`
- `PUBLISHER_DISPATCHER_ENABLED=1`

Mode ini menjalankan queue dispatcher di proses API (lebih sederhana, tapi scale terbatas).

### Step D — Deploy order
Disarankan urutan deploy:
1. API
2. Worker (skip jika mode free-tier)
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

### Kenapa muncul error `failed to resolve host 'dpg-...-a'`?
Itu biasanya karena `DATABASE_URL` memakai host internal Render yang tidak bisa di-resolve dari service kamu (region/network tidak cocok atau salah copy URL).

Langkah fix:
1. Buka Render Postgres -> **Connect**.
2. Copy ulang **External Database URL** (disarankan untuk kasus ini), jangan ketik manual.
3. Update env `DATABASE_URL` di service API/worker.
4. Redeploy.

Checklist cepat:
- pastikan URL host berbentuk FQDN (punya domain, bukan hanya `dpg-...-a`).
- pastikan username/password terbaru (kalau credential sempat terekspos, rotate dulu).
