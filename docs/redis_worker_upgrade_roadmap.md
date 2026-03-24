# Roadmap Upgrade Arsitektur: FastAPI + Redis + Dedicated Worker

Dokumen ini menjabarkan migrasi bertahap dari model saat ini (DB polling dispatcher thread di proses FastAPI) menuju arsitektur:
- FastAPI API (control plane)
- Redis (broker + optional cache/locks)
- Dedicated worker process (data plane eksekusi job)

Fokus utama:
1. minim risiko,
2. kompatibel dengan Queue Builder saat ini,
3. bisa rollback cepat.

## Status Implementasi Saat Ini (2026-03-24)

Fondasi phase-1 sudah mulai ditanam:
- sudah ada abstraction `queue_bus` untuk mode worker (`legacy|hybrid|redis`);
- enqueue sinyal Redis sudah di-wire dari endpoint update config queue (`/publisher/queue/update-config` dan bulk variant);
- mode default tetap `legacy` sehingga perilaku existing tidak berubah jika env Redis belum diisi.

Eksekusi phase-3 (redis-first) sudah disiapkan secara teknis:
- dedicated worker process tersedia di `backend/services/publisher_redis_worker.py`;
- dispatcher legacy otomatis nonaktif saat `WORKER_MODE=redis` (kecuali dioverride explicit `PUBLISHER_DISPATCHER_ENABLED`);
- update config queue akan mendorong sinyal job ke Redis pada mode `hybrid/redis`.

### Quick start redis-first
1. Set env:
   - `WORKER_MODE=redis`
   - `REDIS_URL=<redis-connection-string>`
2. Jalankan API FastAPI seperti biasa.
3. Jalankan worker terpisah:
   - `python -m backend.services.publisher_redis_worker`
4. Untuk rollback cepat:
   - `WORKER_MODE=legacy`

---

## 0) Kondisi Saat Ini (Baseline)

- Queue publish masih diproses oleh dispatcher internal yang polling DB (`upload_queue`) dan berjalan sebagai thread di proses FastAPI.
- State job masih tersimpan di tabel `upload_queue`.
- Frontend Queue Builder sudah terhubung kuat ke model data dan state tersebut.

Implikasi:
- API dan worker lifecycle masih saling menempel.
- Scale API != scale worker.
- Recovery worker crash masih bertumpu pada lease + polling.

---

## 1) Target Arsitektur

```text
Frontend (Queue Builder)
   |
   v
FastAPI API  -------------------------------> PostgreSQL/Supabase (source of truth)
   |
   | enqueue / schedule / retry command
   v
Redis (queue broker)
   |
   v
Dedicated Worker(s)
   |
   +--> platform uploaders (YouTube/TikTok/IG/FB)
   +--> notifier (Telegram)
```

Prinsip:
- DB tetap source of truth untuk status/final result.
- Redis hanya transport queue + transient lock/routing.
- Worker update status ke DB + kirim realtime event.

---

## 2) Strategi Migrasi Bertahap (Low Risk)

### Phase 1 — Fondasi tanpa mengubah flow user
**Tujuan:** tambah komponen baru tanpa mematikan dispatcher lama.

Checklist:
- Tambah `worker_mode` via env:
  - `WORKER_MODE=legacy|hybrid|redis`
- Tambah producer abstraction di backend:
  - `enqueue_publish_job()` (interface tunggal)
  - implementasi awal: tetap write DB + optional push Redis (hybrid)
- Tambah worker service baru (proses terpisah) tapi hanya consume queue uji coba.
- Tambah dead-letter queue (DLQ) Redis untuk job gagal fatal.

Kriteria selesai:
- API existing tidak berubah (frontend tetap normal).
- Worker baru bisa jalan paralel tanpa ganggu job produksi.

---

### Phase 2 — Hybrid Execution
**Tujuan:** sebagian traffic diproses dedicated worker, dispatcher legacy tetap jadi fallback.

Checklist:
- Routing per job menggunakan flag:
  - `execution_backend=legacy|redis`
- Tambah idempotency key per job/platform:
  - contoh: `job_id + platform + scheduled_slot`
- Worker consume dari Redis, lalu:
  1. claim lock,
  2. set state DB `running`,
  3. execute uploader,
  4. commit result + realtime event.
- Pertahankan lease timeout DB untuk safety.

Kriteria selesai:
- >=30% job stabil via Redis worker.
- Tidak ada double publish.

---

### Phase 3 — Redis-first
**Tujuan:** Redis worker jadi jalur utama, dispatcher legacy dinonaktifkan default.

Checklist:
- Set default `execution_backend=redis`.
- Disable dispatcher by default (`PUBLISHER_DISPATCHER_ENABLED=0`) di env produksi.
- Legacy path tetap ada untuk emergency rollback.
- Tambah autoscaling worker berdasarkan queue depth.

Kriteria selesai:
- >=95% job diproses worker baru.
- SLA publish lebih stabil dibanding baseline.

---

### Phase 4 — Simplifikasi Model Data
**Tujuan:** rapikan pemisahan entity asset vs publish job.

Checklist:
- Perkenalkan tabel terpisah (opsional, bertahap):
  - `assets`
  - `publish_jobs`
  - `publish_attempts`
  - `job_events`
- `upload_queue` dijaga sebagai compatibility layer sementara.
- Migrasi query frontend secara bertahap lewat endpoint aggregator.

Kriteria selesai:
- Domain model lebih jelas.
- Audit trail retry/attempt lebih baik.

---

## 3) Kontrak Kompatibilitas Queue Builder

Agar frontend tidak pecah selama migrasi:
- Endpoint saat ini tetap dipertahankan:
  - add/update/remove queue,
  - update metadata,
  - job listing/status.
- Field status tetap kompatibel:
  - `queued/scheduled/running/completed/failed/canceled`.
- Tambahkan field baru secara additive (non-breaking), contoh:
  - `execution_backend`,
  - `worker_run_id`,
  - `attempt_seq`.

---

## 4) Design Worker yang Direkomendasikan

## 4.1 Job Envelope
Contoh payload minimal:
- `job_id`
- `filename`
- `platforms[]`
- `account_map`
- `metadata` (title/description/tags)
- `schedule_at`
- `idempotency_key`
- `trace_id`

## 4.2 Retry Policy
- Retry transient error: exponential backoff + jitter.
- Retry maksimal per platform (mis. 3 kali).
- Setelah melewati batas -> DLQ + state DB `failed`.

## 4.3 Idempotency
- Sebelum upload, cek `idempotency_key` di DB.
- Jika sudah sukses sebelumnya, skip upload dan tandai completed idempotent.

---

## 5) Observability Minimum

Wajib ada sebelum cutover penuh:
- Metrics:
  - queue depth,
  - wait time,
  - success rate per platform,
  - retry count,
  - DLQ count.
- Structured logs:
  - `trace_id`, `job_id`, `platform`, `attempt`.
- Health endpoints:
  - `/worker/health`
  - `/worker/metrics` (Prometheus format jika memungkinkan).

---

## 6) Deployment Plan (Staging -> Production)

1. **Staging**
   - Nyalakan hybrid mode.
   - Inject synthetic jobs (beban kecil-sedang).
2. **Canary Production**
   - 5-10% job via Redis worker.
   - Pantau error/retry latency minimal 3-7 hari.
3. **Ramp up**
   - 30% -> 60% -> 95%.
4. **Redis-first**
   - Dispatcher legacy off by default.
5. **Post-cutover hardening**
   - Review DLQ, tuning retry, tuning concurrency.

---

## 7) Rollback Plan

Rollback harus satu langkah env switch:
- `WORKER_MODE=legacy`
- `PUBLISHER_DISPATCHER_ENABLED=1`
- worker service bisa dihentikan tanpa mengganggu API.

Data safety:
- DB tetap source of truth.
- Job in-flight worker yang belum commit dianggap retriable.

---

## 8) Risiko & Mitigasi

1. **Double execution**
   - Mitigasi: idempotency key + DB lock + lease.
2. **Message loss**
   - Mitigasi: durable Redis queue + ack policy + periodic reconciliation DB.
3. **State drift DB vs Worker**
   - Mitigasi: heartbeat + reconciliation job.
4. **Cost creep**
   - Mitigasi: batasi concurrency, TTL queue, monitor throughput.

---

## 9) Deliverables per Milestone

### M1 (1 sprint)
- worker abstraction + env mode + redis producer skeleton.

### M2 (1 sprint)
- dedicated worker consume queue + update state DB + idempotency dasar.

### M3 (1 sprint)
- hybrid production canary + metrics + alert.

### M4 (opsional)
- refactor schema `assets/publish_jobs/publish_attempts/job_events`.

---

## 10) Keputusan Teknis yang Disarankan

- Broker: Redis (Upstash/ElastiCache/Redis managed) tergantung environment.
- Worker framework:
  - ringan: RQ,
  - fleksibel/retry kuat: Celery,
  - simple modern: Dramatiq.
- Untuk migrasi minim risiko: mulai dari abstraction + custom worker loop terlebih dulu,
  lalu pilih framework jika kebutuhan kompleksitas meningkat.

---

## 11) Ringkasan Eksekutif

Roadmap ini menjaga UX Queue Builder tetap stabil sambil memindahkan eksekusi job ke dedicated worker berbasis Redis.
Pendekatan hybrid + feature flag memberi jalur aman: bisa scale bertahap, rollback cepat, dan menurunkan coupling antara API dan proses upload.
