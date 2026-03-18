# Ide Simplifikasi Workflow & UI/UX

Dokumen ini merangkum rekomendasi untuk menyederhanakan produk supaya user lebih cepat sampai ke hasil utama (publish konten / mengeksekusi job), dan dilengkapi dengan **step-by-step implementation**.

## 1) Yang bisa **digabung**

### A. `Queue` + `Queue Manager` + `Jobs`
- **Masalah saat ini**: fungsinya mirip (monitor proses & status) tapi tersebar di beberapa halaman.
- **Saran**: satukan menjadi satu halaman **"Runs"** dengan 3 tab:
  1. Active
  2. Scheduled
  3. History/Failed
- **Dampak**: mengurangi kebingungan user baru dan mempersingkat navigasi.

### B. Alur konten `Video` dan `KDP`
- **Masalah saat ini**: keduanya punya pola yang sama (`ideation -> curation -> production`).
- **Saran**: buat kerangka bersama bernama **"Pipeline"**, lalu channel (Video/KDP) jadi filter atau preset.
- **Dampak**: UI konsisten, komponen bisa reuse, maintenance lebih ringan.

### C. `Project Manager` + `Drive`
- **Masalah saat ini**: konteks project dan aset terasa terpisah.
- **Saran**: jadikan `Drive` sebagai tab/section di dalam detail project:
  - Overview
  - Assets (Drive)
  - Studio
  - Publish
- **Dampak**: user tidak kehilangan konteks project saat mengelola file.

## 2) Yang bisa **dibuang / disederhanakan**

### A. Halaman utilitas yang duplikatif
- Jika ada halaman internal/eksperimen seperti `studio-test`, `playwright-lab`, pertimbangkan:
  - pindahkan ke mode dev-only,
  - sembunyikan dari navigasi production.
- **Tujuan**: menu utama jadi fokus ke use case user akhir.

### B. Item sidebar terlalu granular
- Kurangi item level-1 di sidebar; gunakan grouping:
  - Create
  - Operate
  - Assets
  - Settings
- **Tujuan**: cognitive load turun dan onboarding lebih cepat.

### C. Terminologi campuran
- Samakan istilah: pilih satu istilah utama, misalnya `Runs` (bukan campuran `Queue/Jobs/Runs`).
- **Tujuan**: hindari user mengira itu fitur berbeda padahal sama.

## 3) Yang perlu **ditambahkan**

### A. Global Command Palette (`⌘K` / `Ctrl+K`)
Aksi cepat yang disarankan:
- "Buat project baru"
- "Jalankan pipeline"
- "Lihat job gagal"
- "Buka halaman X"

### B. Onboarding berbasis use-case
- Wizard 3 langkah untuk first-time user:
  1. Pilih tujuan (Video/KDP)
  2. Pilih template pipeline
  3. Jalankan contoh pertama
- Sertakan sample data agar state awal tidak kosong.

### C. Empty state yang actionable
Di halaman kosong, selalu tampilkan CTA jelas:
- "Belum ada project" -> **Buat Project**
- "Belum ada run" -> **Jalankan Pipeline Pertama**

### D. Progress & error UX yang konsisten
- Standarkan status badge: `Queued`, `Running`, `Done`, `Failed`.
- Setiap error wajib punya:
  - penjelasan singkat,
  - tombol retry,
  - link ke logs relevan.

## 4) Prioritas implementasi (quick wins 2-4 minggu)

1. **Unifikasi `Queue/Jobs` -> `Runs`** (impact tinggi, effort sedang)
2. **Rapikan sidebar + naming konsisten** (impact tinggi, effort rendah)
3. **Tambahkan command palette + empty state CTA** (impact sedang, effort rendah)
4. **Pipeline template lintas Video/KDP** (impact tinggi, effort sedang)

## 5) Step-by-step implementation

## Step 0 — Kickoff (Hari 1)
**Tujuan:** menyepakati scope dan definisi sukses.

1. Tentukan PIC lintas fungsi (PM, design, frontend, backend).
2. Sepakati istilah resmi (contoh: `Runs`, `Pipeline`, `Assets`).
3. Finalkan KPI baseline sebelum perubahan:
   - time-to-first-run,
   - jumlah klik ke eksekusi pertama,
   - completion rate onboarding.
4. Buat backlog dengan label: `ux-quick-win`, `ia-refactor`, `onboarding`.

**Output:** dokumen scope v1 + KPI baseline + backlog prioritas.

## Step 1 — Unifikasi Runs (Minggu 1)
**Tujuan:** mengganti 3 permukaan (`Queue`, `Queue Manager`, `Jobs`) jadi 1 pintu masuk.

1. Buat halaman baru `Runs` dengan tab `Active`, `Scheduled`, `History/Failed`.
2. Mapping data dari halaman lama ke struktur tab baru.
3. Tambahkan redirect dari route lama ke `Runs`.
4. Pertahankan fitur minimum:
   - filter status,
   - search,
   - retry untuk failed.
5. Tambahkan status badge yang konsisten (`Queued/Running/Done/Failed`).

**Acceptance criteria:**
- User bisa melakukan semua aksi utama monitoring dari satu halaman.
- Tidak ada fitur kritikal di halaman lama yang hilang.

## Step 2 — Rapikan Sidebar & Terminologi (Minggu 1-2)
**Tujuan:** menyederhanakan navigasi dan menurunkan cognitive load.

1. Kelompokkan menu level-1: `Create`, `Operate`, `Assets`, `Settings`.
2. Pindahkan halaman eksperimen/internal ke dev-only.
3. Ganti label campuran menjadi satu standar (contoh semua jadi `Runs`).
4. Tambahkan tooltip singkat untuk label yang berpotensi ambigu.

**Acceptance criteria:**
- Jumlah menu level-1 turun signifikan.
- Tidak ada label duplikat makna (Queue/Jobs/Runs campur).

## Step 3 — Empty State + CTA (Minggu 2)
**Tujuan:** mencegah layar kosong tanpa arahan.

1. Audit semua halaman yang bisa kosong (project, runs, assets, dll).
2. Untuk tiap halaman, definisikan 1 CTA utama dan 1 CTA sekunder.
3. Tambahkan komponen empty state seragam (icon + copy + tombol).
4. Uji copywriting agar berbasis aksi (contoh: "Jalankan Pipeline Pertama").

**Acceptance criteria:**
- Semua halaman kosong punya CTA yang bisa ditindak.
- Tidak ada halaman kosong tanpa konteks.

## Step 4 — Command Palette (Minggu 2-3)
**Tujuan:** mempercepat akses aksi penting tanpa banyak klik.

1. Implement shortcut global `Ctrl+K` / `⌘K`.
2. Tambahkan command prioritas tinggi:
   - buat project,
   - jalankan pipeline,
   - buka runs failed,
   - navigasi cepat halaman inti.
3. Tambahkan recent commands dan pinned commands (opsional jika waktu cukup).
4. Track analytics command yang paling sering dipakai.

**Acceptance criteria:**
- Command palette bisa dipanggil dari halaman mana pun.
- 4 command utama berjalan end-to-end.

## Step 5 — Pipeline Template Lintas Channel (Minggu 3-4)
**Tujuan:** menyatukan pola Video/KDP jadi kerangka yang sama.

1. Definisikan model tahap generik: `Ideation -> Curation -> Production`.
2. Buat preset template per channel (Video/KDP) di atas model yang sama.
3. Samakan komponen UI antarchannel (stepper, status, action bar).
4. Tambahkan opsi clone template untuk tim.

**Acceptance criteria:**
- User bisa berpindah channel tanpa belajar ulang alur.
- Minimal 1 template Video dan 1 template KDP aktif.

## Step 6 — Onboarding Wizard (Minggu 4)
**Tujuan:** meningkatkan aktivasi user baru.

1. Wizard 3 langkah:
   - pilih tujuan,
   - pilih template,
   - jalankan contoh.
2. Siapkan sample data default supaya user langsung lihat hasil.
3. Tambahkan progress indicator (`1/3`, `2/3`, `3/3`).
4. Tambahkan fallback "skip untuk nanti" tanpa mengganggu flow utama.

**Acceptance criteria:**
- User baru bisa mencapai run pertama tanpa keluar dari wizard.
- Completion rate onboarding meningkat dari baseline.

## Step 7 — QA, Rollout, dan Evaluasi (Minggu 4+)
**Tujuan:** rilis aman dan dampak terukur.

1. QA regression pada flow kritikal: create project, run pipeline, retry failed.
2. Rollout bertahap (internal -> beta user -> semua user).
3. Pantau KPI 2 minggu setelah rilis.
4. Lakukan iterasi dari feedback user (terutama pain point onboarding).

**Acceptance criteria:**
- Tidak ada penurunan signifikan di task success rate.
- KPI utama bergerak ke arah target.

## 6) KPI untuk mengukur keberhasilan

- Time-to-first-run (target turun >= 30%)
- Jumlah klik dari dashboard ke eksekusi pertama (target turun)
- Rasio job gagal yang berhasil retry (target naik)
- Completion rate onboarding pengguna baru (target naik)

---

Jika diinginkan, langkah berikutnya adalah membuat breakdown teknis per sprint (ticket FE/BE/Design + estimasi story points) berdasarkan step-step di atas.

## 7) Implementasi **Phase 1** (langsung eksekusi)

Berikut eksekusi **phase pertama** yang paling realistis: fokus unifikasi `Queue + Queue Manager + Jobs` menjadi `Runs`.

### Scope Phase 1
- In scope:
  - halaman `Runs` dengan 3 tab (`Active`, `Scheduled`, `History/Failed`),
  - redirect dari halaman lama,
  - status badge konsisten,
  - retry untuk item failed.
- Out of scope (phase berikutnya):
  - command palette,
  - onboarding wizard,
  - pipeline template lintas channel.

### Breakdown pekerjaan (7 hari kerja)

#### Hari 1 — Alignment & Technical Design
1. Finalkan definisi data model `Run` (id, source, status, startedAt, endedAt, errorMessage).
2. Petakan field dari `Queue`, `Queue Manager`, `Jobs` ke model `Run`.
3. Tentukan contract API untuk list/filter/retry.

**Deliverable:** spesifikasi model + API contract + daftar gap data.

#### Hari 2 — UI Skeleton `Runs`
1. Buat layout halaman `Runs`.
2. Tambahkan 3 tab: `Active`, `Scheduled`, `History/Failed`.
3. Tambahkan komponen list/table sederhana dengan kolom inti.

**Deliverable:** halaman bisa dibuka dan navigasi tab berfungsi.

#### Hari 3 — Integrasi Data & Filter
1. Hubungkan tab ke data source.
2. Implement filter status dan search.
3. Pastikan loading/empty/error state tampil konsisten.

**Deliverable:** data tampil sesuai tab + filter bekerja.

#### Hari 4 — Retry & Error UX
1. Tambahkan action `Retry` pada status `Failed`.
2. Tampilkan error ringkas + link ke logs.
3. Tambahkan feedback sukses/gagal saat retry.

**Deliverable:** user bisa retry dari halaman `Runs` tanpa pindah halaman.

#### Hari 5 — Redirect & Deprecation Halaman Lama
1. Redirect route lama (`Queue`, `Queue Manager`, `Jobs`) ke `Runs`.
2. Rapikan sidebar agar hanya tampil satu entry point (`Runs`).
3. Tambahkan note deprecation internal untuk tim.

**Deliverable:** tidak ada duplikasi entry monitoring di navigasi utama.

#### Hari 6 — QA Regression
1. Uji skenario utama:
   - lihat active runs,
   - cari run tertentu,
   - retry run failed,
   - buka detail/log.
2. Uji edge case:
   - data kosong,
   - API timeout,
   - status berubah real-time.

**Deliverable:** checklist QA lulus + daftar bug prioritas.

#### Hari 7 — Release Bertahap
1. Rilis ke internal user terlebih dahulu.
2. Monitor error rate + feedback 24 jam.
3. Jika aman, rilis ke semua user.

**Deliverable:** phase 1 live dengan monitoring metrik awal.

### Acceptance Criteria Phase 1
- Semua aktivitas monitoring run bisa dilakukan dari 1 halaman `Runs`.
- Halaman lama tidak lagi menjadi entry point utama.
- User dapat retry run failed langsung dari list.
- Penamaan status dan badge konsisten di seluruh halaman terkait.

### KPI validasi setelah Phase 1 (2 minggu)
- Penurunan jumlah klik untuk cek status run (target: -30%).
- Peningkatan retry success rate untuk failed run.
- Penurunan pertanyaan support terkait "bedanya Queue vs Jobs".

## 8) Implementasi **Phase 2** (Sidebar & Terminologi)

Phase 2 melanjutkan hasil Phase 1 dengan fokus menyederhanakan navigasi utama agar user lebih cepat menemukan alur kerja inti.

### Scope Phase 2
- In scope:
  - restrukturisasi sidebar level-1 menjadi: `Create`, `Operate`, `Assets`, `Settings`,
  - konsolidasi entry monitoring ke `Runs`,
  - menyembunyikan menu eksperimen/internal dari navigasi utama production.
- Out of scope:
  - command palette global,
  - onboarding wizard,
  - perubahan arsitektur backend.

### Rencana eksekusi (5 hari kerja)

#### Hari 1 — Audit IA + Mapping Navigasi
1. Audit seluruh item sidebar saat ini.
2. Kelompokkan item ke 4 kategori final (`Create`, `Operate`, `Assets`, `Settings`).
3. Tandai menu internal/eksperimental yang dipindah dari production nav.

**Deliverable:** peta migrasi menu lama -> menu baru.

#### Hari 2 — Implement Group Baru di Sidebar
1. Ubah section sidebar menjadi 4 group final.
2. Pindahkan `Runs` menjadi pusat monitoring di group `Operate`.
3. Pastikan urutan item mencerminkan prioritas workflow user.

**Deliverable:** sidebar baru aktif di environment dev.

#### Hari 3 — Konsistensi Terminologi
1. Hilangkan istilah campuran pada navigasi utama (`Queue/Jobs`).
2. Pertahankan istilah tunggal `Runs` untuk aktivitas monitoring.
3. Review label item agar lebih ringkas dan tidak ambigu.

**Deliverable:** glossary label v1 untuk menu utama.

#### Hari 4 — Cleanup Menu Internal
1. Hapus tautan eksperimen/internal dari sidebar production.
2. Pastikan halaman internal tetap bisa diakses via direct route oleh tim dev.
3. Jalankan regresi akses menu utama.

**Deliverable:** production nav bebas menu internal.

#### Hari 5 — QA + Rollout
1. Uji klik seluruh item menu utama.
2. Uji transisi route untuk user authenticated/non-authenticated.
3. Rilis bertahap dan monitor feedback awal.

**Deliverable:** Phase 2 live + checklist QA.

### Acceptance Criteria Phase 2
- Sidebar level-1 hanya memakai 4 group utama (`Create`, `Operate`, `Assets`, `Settings`).
- Entry monitoring utama hanya `Runs`.
- Menu eksperimen/internal tidak muncul pada navigasi production.
- User dapat menemukan alur utama lebih cepat dengan jumlah klik yang lebih sedikit.


### Progress implementasi terkini
- Redirect route legacy `Queue`, `Queue Manager`, dan `Jobs` sudah diarahkan ke `/runs`.
- Sidebar production disederhanakan ke 4 grup utama (`Create`, `Operate`, `Assets`, `Settings`).
- Label monitoring di navigasi utama dikonsolidasikan menjadi `Runs`.
