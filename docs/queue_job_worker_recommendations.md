# Queue, Queue Manager, Job Run — Audit & Rekomendasi Arsitektur

Dokumen ini merangkum temuan dari alur saat ini dan usulan desain yang lebih fokus ke kebutuhan inti:

1. Ambil data project → schedule upload.
2. Ambil banyak data project → bulk post / bulk schedule.
3. Worker **tidak** langsung dieksekusi dari UI/API, tapi lewat antrean job yang durable.

## Temuan Kondisi Saat Ini (As-Is)

### 1) `upload_queue` saat ini mencampur 3 concern
Tabel `upload_queue` menyimpan data aset, state eksekusi worker, jadwal, retry counter, dan hasil platform sekaligus. Ini membuat batas antara **asset queue** dan **execution job** jadi kabur. Lihat field `scheduled_at`, `worker_state`, `attempt_count`, `last_error`, `last_run_at`, `platform_statuses`, dll pada model yang sama.

### 2) Primary key queue = `filename`
`UploadQueueItem.filename` digunakan sebagai primary key. Ini rentan bentrok bila nama file sama lintas project/channel. Saat scale, identitas job lebih aman memakai UUID, sedangkan filename jadi atribut.

### 3) Endpoint job belum didukung scheduler loop yang durable
Endpoint jobs (`run-now`, `pause`, `resume`, `cancel`, `reschedule`) mengubah state di DB, tapi eksekusi nyata masih memakai `BackgroundTasks` per request. Artinya:
- eksekusi bergantung lifecycle proses API,
- belum ada polling worker yang mengambil `scheduled` jobs secara periodik dari DB,
- `pause/cancel` belum benar-benar menghentikan subprocess yang sudah jalan.

### 4) Alur queue config belum mengunci transisi state
`/queue/update-config` dan `/queue/bulk-update-config` mengisi `scheduled_at`, platform, account, options; tetapi state worker tidak ditegaskan menjadi state siap-jadwal yang konsisten. Ini jadi salah satu sumber kebingungan antara item yang “sudah dikonfigurasi job” vs “masih draft queue”.

### 5) `GET /queue` melakukan scan filesystem + mutasi DB
Endpoint list queue bukan hanya membaca DB, tapi juga scanning folder legacy/per-project dan sekaligus upsert data. Perilaku ini membantu backward compatibility, tapi mencampur read-model dengan ingestion dan mempersulit reasoning saat debugging.

---

## Target Model (To-Be) yang Lebih Sederhana

Pisahkan tegas antara **Asset** dan **Job**:

- **Asset** = konten yang siap diproses (video/image + metadata dasar).
- **Job** = instruksi eksekusi (platform/channel/schedule/post-now) yang mengacu ke satu asset.

### Entitas yang disarankan

1. `assets`
   - `id` (uuid), `project_id`, `source_path`, `title`, `description`, `tags`, `checksum`, `created_at`.
2. `publish_jobs`
   - `id` (uuid), `asset_id`, `mode` (`post_now|scheduled`), `scheduled_at`, `priority`, `state`, `attempt`, `max_attempt`, `idempotency_key`, `created_by`, `created_at`.
3. `publish_job_targets`
   - `job_id`, `platform` (tiktok/youtube/instagram/facebook), `channel_account_id`, `publish_schedule_platform`, `payload_json`, `state`, `last_error`.
4. `job_events` (opsional tapi sangat berguna)
   - audit trail per transisi state: `queued`, `leased`, `running`, `retrying`, `done`, `failed`, `canceled`.

Dengan ini Queue Manager cukup menampilkan:
- Draft assets,
- Ready-to-schedule assets,
- Scheduled/running jobs,
- History.

---

## Flow yang Direkomendasikan

### A. Single: Ambil project data → schedule upload
1. User pilih 1 asset dari project.
2. User pilih platform + channel account + `post now` atau `scheduled`.
3. API membuat `publish_job` + `publish_job_targets` dengan state awal `queued`.
4. Worker dispatcher mengambil job dari antrean DB (bukan `BackgroundTasks` request).

### B. Bulk: Ambil banyak project data → bulk post/schedule
1. User multi-select assets lintas project.
2. User pilih template konfigurasi (platform/account/schedule strategy).
3. API membuat banyak `publish_jobs` dalam 1 transaksi.
4. Worker memproses per job (atau per target platform), dengan lease/lock.

### C. Worker execution pattern
1. Dispatcher loop (interval 1-5 detik) query job state `queued|scheduled<=now`.
2. Ambil job dengan lock (`SELECT ... FOR UPDATE SKIP LOCKED` jika DB mendukung; untuk SQLite pakai strategi lease timestamp).
3. Update state `running` + simpan `leased_until`.
4. Jalankan uploader per target platform.
5. Sukses semua target ⇒ `done`; jika sebagian gagal ⇒ `partial_failed` + retry policy granular.

---

## Kontrak API yang Disederhanakan

### Endpoint inti yang disarankan
- `POST /assets/from-project` → ingest satu/banyak asset dari project.
- `POST /jobs` → buat 1 job (single).
- `POST /jobs/bulk` → buat banyak job sekaligus.
- `GET /jobs?state=&project=&platform=&from=&to=` → list operasional.
- `POST /jobs/{id}/run-now`
- `POST /jobs/{id}/pause`
- `POST /jobs/{id}/resume`
- `POST /jobs/{id}/cancel`
- `GET /jobs/{id}/events`

### Payload create job (contoh ringkas)
```json
{
  "asset_id": "uuid-asset",
  "mode": "scheduled",
  "scheduled_at": "2026-03-20T08:00:00Z",
  "targets": [
    {
      "platform": "tiktok",
      "channel_account_id": "acc-123",
      "publish_schedule_platform": "2026-03-20T08:00:00Z"
    },
    {
      "platform": "youtube",
      "channel_account_id": "acc-yt-1"
    }
  ]
}
```

---

## Rekomendasi Implementasi Bertahap (Minim Risiko)

### Fase 1 — Klarifikasi state & naming (cepat)
- Tambahkan state machine eksplisit: `draft -> queued -> leased -> running -> success|failed|canceled`.
- Saat update config/bulk config, set state ke `queued` (jika valid), bukan dibiarkan ambigu.
- Tambah field `job_id` UUID (sementara filename tetap dipertahankan untuk kompatibilitas).

### Fase 2 — Dispatcher worker terpisah
- Buat service worker loop terpisah dari request API.
- Endpoint API hanya enqueue job (write DB), tidak mengeksekusi upload langsung.
- Tambahkan lease timeout + retry backoff.

### Fase 3 — Split tabel asset vs job
- Migrasi gradual dari tabel campuran ke `assets`, `publish_jobs`, `publish_job_targets`.
- Pertahankan endpoint lama sebagai adapter selama masa transisi.

### Fase 4 — Observability
- Event log per job target (start/end/error), durations, error category.
- Dashboard ringkas: queue depth, jobs/min, success rate, retry rate, oldest queued age.

---

## Quick Wins yang Bisa Dikerjakan Langsung

1. **Set state konsisten saat konfigurasi job**
   - Jika `platforms + account_map` valid dan ada `schedule`/post-now flag, ubah state ke `queued/scheduled`.
2. **Pisahkan endpoint list dan endpoint ingest**
   - `GET /queue` idealnya read-only.
   - Buat endpoint sinkronisasi terpisah (mis. `POST /queue/sync-from-projects`).
3. **Gunakan `job_uuid` untuk identitas eksekusi**
   - Hindari ketergantungan pada filename.
4. **Tambahkan kolom `next_retry_at` + `max_attempt`**
   - Retry policy jadi deterministic.
5. **Buat satu halaman “Runs” sebagai sumber kebenaran**
   - Sudah ada arah ke sana; lanjutkan sampai halaman legacy cukup jadi redirect.

---

## Dampak ke kebutuhan Anda

Dengan model di atas, kebutuhan Anda jadi natural:
- “Ambil data project → schedule upload” = create asset (jika belum ada) + create 1 job scheduled.
- “Ambil banyak data project → bulk post/schedule” = bulk create jobs via template.
- “Post now vs schedule” = beda `mode` job, bukan beda endpoint yang membingungkan.
- Worker selalu ambil dari antrean durable, bukan eksekusi langsung dari request.


---

## Alur Sederhana & User Friendly (Tujuan Utama Project)

Bagian ini adalah versi paling praktis untuk pengguna non-teknis. Fokus: **pilih asset -> pilih channel -> pilih waktu -> antrekan job**.

### 1) Menu yang user lihat (cukup 3 halaman)

1. **Assets**
   - Isi: semua asset dari project (`video_projects`/`projects`) yang siap posting.
   - Aksi utama:
     - `Add to Queue` (single)
     - `Select Multiple` (bulk)

2. **Queue Builder**
   - Isi: daftar asset terpilih yang belum jadi job final.
   - Aksi utama:
     - pilih social media (TikTok/YouTube/IG/FB)
     - pilih channel/account per platform
     - pilih mode `Post Now` atau `Schedule`
     - untuk bulk: pilih template jadwal (misal 3 post/hari, jeda 4 jam)
   - Tombol utama: **Create Jobs** (hanya enqueue, tidak upload langsung)

3. **Runs (Monitor)**
   - Tab: `Queued`, `Running`, `Scheduled`, `Done`, `Failed`.
   - Aksi: run now / pause / resume / cancel / retry.
   - Semua status bersumber dari job state machine, bukan dari scan folder.

### 2) Bahasa tombol/action yang disederhanakan

Hindari istilah teknis berlebihan. Gunakan label berikut:
- `Add to Queue`
- `Create Jobs`
- `Post Now`
- `Schedule`
- `Start Worker` (opsional untuk mode manual)
- `Retry Failed`
- `Open History`

### 3) Flow Single Post (1 asset)

1. User buka **Assets** -> pilih 1 asset.
2. Klik `Add to Queue`.
3. Masuk **Queue Builder**:
   - pilih platform/channel,
   - pilih `Post Now` atau `Schedule`.
4. Klik `Create Jobs`.
5. Sistem menampilkan toast: **"Job berhasil ditambahkan ke antrean"**.
6. Worker memproses job sesuai state.

### 4) Flow Bulk Post / Bulk Schedule

1. User buka **Assets** -> multi-select asset.
2. Klik `Add to Queue`.
3. Di **Queue Builder** pilih salah satu mode:
   - **Bulk Post Now** (semua queued langsung eligible dijalankan)
   - **Bulk Schedule** (isi start date + posts/day + gap hours)
4. Klik `Preview Schedule` (opsional tapi penting untuk UX).
5. Klik `Create Jobs`.
6. Semua item jadi job terpisah (punya `job_id` masing-masing), lalu worker proses bertahap.

### 5) Rule UX agar tidak membingungkan

1. **Tidak ada upload langsung dari halaman form.**
   - Semua aksi form berujung ke enqueue.
2. **Pisahkan jelas status asset vs status job.**
   - Asset status: draft/ready/archived.
   - Job status: queued/scheduled/running/done/failed/canceled.
3. **Jangan pakai filename sebagai identitas utama di UI.**
   - Tampilkan `title + project + short job id`.
4. **Selalu tampilkan “kenapa gagal”.**
   - Error message per platform harus terlihat tanpa buka log file manual.
5. **Tampilkan ETA sederhana.**
   - Misal: "3 job di depan Anda" untuk job queued.

### 6) State machine final yang direkomendasikan (ringkas)

- `draft` -> `queued` -> `leased` -> `running` -> `done`
- Jika error: `running` -> `retry_wait` -> `queued`
- Jika melebihi retry: `running/retry_wait` -> `failed`
- Aksi user:
  - pause: `queued/scheduled` -> `paused`
  - resume: `paused` -> `queued`
  - cancel: `queued/scheduled/paused` -> `canceled`

### 7) KPI operasional minimal (supaya owner mudah pantau)

- Queue depth (berapa job queued)
- Success rate 24 jam
- Failed rate per platform
- Rata-rata waktu dari `queued -> running`
- Oldest queued age (job paling lama belum diproses)

Jika 5 KPI ini terlihat di dashboard, kebingungan operasional biasanya turun drastis.
