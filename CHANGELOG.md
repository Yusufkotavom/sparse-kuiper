# Changelog

Dokumen ini merangkum perubahan penting yang membentuk ulang flow utama project menjadi lebih user friendly dan lebih dekat ke model queue/job yang durable.

## 2026-03 Queue Builder & Durable Job Flow

### Frontend UX / Routing
- Menetapkan flow utama produk menjadi:
  - `Assets -> Queue Builder -> Runs`
- Menambahkan route utama baru:
  - `/ideation`
- Menjadikan `Ideation Hub` sebagai jembatan utama bersama untuk flow video dan image sebelum user bercabang ke generator/workspace spesifik.
- Menjadikan **Queue Builder** sebagai nama utama di UI.
- Menambahkan route utama frontend:
  - `/queue-builder`
- Menjaga route legacy:
  - `/publisher` sekarang redirect kompatibilitas ke `/queue-builder`
- Menjadikan `Runs` sebagai operational hub utama.
- Menjadikan route legacy `/queue`, `/jobs`, `/queue-manager` sebagai redirect ke flow baru.

### Queue Builder
- Memindahkan implementasi utama Queue Builder ke:
  - `frontend/src/components/queue-builder/QueueBuilderPage.tsx`
- Menambahkan:
  - KPI ringkas queue source / selected assets / platforms / mode
  - step banner `Assets -> Queue Builder -> Runs`
  - Queue Source Picker langsung di halaman
  - search/filter untuk item queue
  - select single / bulk langsung dari halaman queue builder
  - worker status summary (`Queued`, `Scheduled`, `Running`, `Failed`)
  - error terakhir langsung terlihat pada queue source item
- Mengubah aksi utama dari kesan “upload langsung” menjadi:
  - `Create Jobs`
  - `Create Scheduled Jobs`

### Ideation Hub / Generator Bridge
- Menyatukan titik masuk ideation video dan image ke satu pola yang sama lewat `Ideation Hub`.
- Menambahkan:
  - mode switch `Video Flow / Image Flow`
  - quick project setup langsung dari hub
  - branch cards mobile-first ke:
    - prompt builder
    - generator utama
    - project assets
    - runs / curation
- Menggeser route root `/video` dan `/kdp` agar masuk ke hub ini lebih dulu.
- Workspace lama `video/ideation` dan `kdp/ideation` tetap dipertahankan sebagai cabang spesifik, dengan positioning baru sebagai `Prompt Builder`.

### Curation Hub / Review Bridge
- Menambahkan route utama baru:
  - `/curation`
- Menyatukan titik masuk review video dan image ke satu pola yang sama lewat `Curation Hub`.
- Menambahkan:
  - mode switch `Video Review / Image Review`
  - project chooser yang ringan untuk mobile
  - branch cards ke review workspace, prompt builder, project assets, queue/runs, dan route lanjutan
- Workspace lama `video/curation` dan `kdp/curation` tetap dipertahankan sebagai cabang spesifik, dengan positioning baru sebagai `Curation Workspace`.

### Shared Hub Shell
- Menambahkan shared component:
  - `frontend/src/components/organisms/FlowHubShell.tsx`
- `Ideation Hub` dan `Curation Hub` sekarang memakai shell yang sama untuk:
  - mode switch
  - project picker / project creation
  - current context panel
  - branch cards
  - footer shortcut cards
- Ini menjadi fondasi utama untuk memperluas hub ke generator atau workflow lain tanpa menduplikasi layout besar.

### Project Manager / Asset Flow
- Menambahkan CTA yang lebih tegas ke:
  - Queue Builder
  - Runs
- Menambahkan `Manual Upload` langsung dari halaman project video.
- Manual Upload mendukung:
  - upload multi-file dari lokal ke stage `raw` atau `final`
  - rename otomatis bila nama file bentrok
  - opsi fast-track agar file yang baru diupload langsung di-enqueue dan dibuka di Queue Builder
- Setelah `Add to Queue`, user sekarang bisa langsung diarahkan ke Queue Builder dengan file yang baru dipilih ikut terseleksi.
- Bulk enqueue dari Project Manager sekarang bisa langsung membuka Queue Builder dengan beberapa file.

### Runs / Monitoring
- Memperjelas posisi `Runs` sebagai langkah ketiga dari flow utama.
- Menyamakan istilah UI dari `Publisher` menjadi `Queue Builder`.
- Menjadikan `Runs` sebagai tampilan utama untuk:
  - active jobs
  - scheduled jobs
  - history / failed

### Published / Scraper / Global Navigation
- Menyamakan copy dan CTA menjadi `Queue Builder` di:
  - dashboard
  - landing page
  - sidebar
  - command palette
  - top bar
  - published history
  - scraper downloads flow

### Frontend API Naming
- Menambahkan alias:
  - `queueBuilderApi`
- Menjaga `publisherApi` sebagai compatibility alias untuk backend lama.
- Halaman flow utama mulai menggunakan `queueBuilderApi` agar naming internal frontend lebih sesuai dengan UX baru.

### Backend Queue / Job Alignment
- Menormalkan state dasar ke arah:
  - `pending`
  - `queued`
  - `scheduled`
  - `running`
  - `completed`
  - `failed`
  - `canceled`
- Menambahkan sinkronisasi state pada queue config update:
  - item yang sudah punya config job masuk ke `queued` atau `scheduled`

### Legacy Upload Compatibility
- Endpoint legacy `upload/*` tetap dipertahankan untuk kompatibilitas.
- Namun flow utama frontend tidak lagi mengandalkan endpoint itu untuk create job.
- Endpoint legacy sekarang ikut menulis config job dengan lebih konsisten sebelum eksekusi.

### Dispatcher Worker Dasar
- Menambahkan dispatcher polling DB:
  - `backend/services/publisher_dispatcher.py`
- Dispatcher berjalan saat startup backend.
- Dispatcher mengambil item `queued/scheduled` dari DB dan menjalankan uploader berdasarkan config tersimpan.

### Lease / Retry Dasar
- Menambahkan field runtime pada `upload_queue`:
  - `next_retry_at`
  - `lease_expires_at`
- Menambahkan bootstrap migration ringan agar kolom runtime bisa dibuat pada startup.
- Menambahkan retry dasar dengan backoff sederhana.
- Menambahkan lease dasar agar job `running` yang macet lebih siap untuk dipulihkan pada iterasi berikutnya.

### Dokumentasi
- Memperbarui:
  - `docs/queue_job_worker_recommendations.md`
  - `docs/architecture.md`
- Menambahkan ringkasan status implementasi terhadap tujuan utama project.

## Status Saat Ini

### Sudah siap dipakai
- Flow user utama untuk operasional dasar:
  - pilih asset
  - kirim ke queue
  - pilih platform/account/schedule
  - create jobs
  - monitor di runs

### Masih belum final
- Model data masih campuran di `upload_queue`
- Dispatcher masih embedded di proses FastAPI
- Belum ada `job_events` / audit trail granular
- Belum ada split penuh `assets` vs `publish_jobs` vs `publish_job_targets`
