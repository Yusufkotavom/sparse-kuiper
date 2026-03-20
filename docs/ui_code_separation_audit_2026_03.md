# UI / Code Separation Audit — 2026-03-20

Dokumen ini memetakan area yang paling gemuk (frontend + backend), area UI yang terlalu kompleks untuk user, dan rekomendasi pemisahan yang bisa dieksekusi bertahap.

## 1) Hotspot code paling gemuk

### Frontend

Hasil scan line-count menunjukkan beberapa hotspot utama:

- `frontend/src/app/settings/page.tsx` (~1868 baris)
- `frontend/src/app/accounts/page.tsx` (~1327 baris)
- `frontend/src/components/queue-builder/QueueBuilderPage.tsx` (~1092 baris)
- `frontend/src/app/project-manager/[project]/page.tsx` (~931 baris)
- `frontend/src/components/studio/LooperConfig.tsx` (~910 baris)

Masalah utamanya: satu file memegang terlalu banyak tanggung jawab (data-fetching, state besar, form action, rendering detail, side-effect).

#### Bukti separation lemah (contoh konkret)

1. **Settings page menumpuk state + actions lintas domain** (AI key, prompt, looper, telegram, workspace, DB flush) dalam satu komponen.
   - Banyak `useState` untuk domain berbeda dalam satu file.
   - Banyak handler save/load dari concern berbeda.

2. **Queue Builder mencampur selection, metadata form, account mapping, scheduler, preview player, dan realtime update** dalam satu komponen besar.

3. **Runs page menggabungkan queue-run + job-run normalisasi + filter intent + aksi mutasi state** sekaligus dalam satu page component.

### Backend

Hasil scan line-count backend menunjukkan hotspot:

- `backend/services/looper_worker.py` (~1109 baris)
- `backend/services/concat_worker.py` (~808 baris)
- `backend/routers/publisher_queue.py` (~795 baris)
- `backend/routers/publisher_uploads.py` (~688 baris)
- `backend/routers/video.py` (~678 baris)
- `backend/routers/settings.py` (~605 baris)

Masalah utama: router melakukan terlalu banyak logic domain + IO + adaptasi legacy sekaligus.

#### Bukti separation lemah (contoh konkret)

1. **`publisher_queue.py`** tidak hanya endpoint handler, tetapi juga scan filesystem multi-lokasi, sinkronisasi data legacy, merge metadata, plus state sync.
2. **`settings.py`** memegang endpoint sangat lebar untuk banyak domain yang seharusnya bisa dipisah modular (provider key, prompt template, looper/concat preset, telegram, workspace reset/flush).

## 2) Area UI yang terlalu kompleks / membingungkan

### A. Queue Builder

- Halaman memiliki banyak blok berurutan dalam satu view: source picker, metadata, platform toggle, account selector per platform, YouTube advanced options, schedule job, social-media schedule per platform, batch cadence, serta CTA job.
- Copy edukasi panjang berulang (tips/info schedule) membuat beban baca tinggi saat user ingin cepat "submit job".

**Dampak UX:** user sulit membedakan mana mandatory vs optional, dan merasa semua harus diisi.

### B. Settings

- Settings menjadi super-panel tunggal untuk banyak domain konfigurasi yang sangat berbeda.
- User harus men-scroll panjang dan konteks berpindah-pindah (AI provider ↔ prompt ↔ integrations ↔ workspace risk action).

**Dampak UX:** cognitive overload, rawan salah aksi, terutama pada section sensitif seperti DB flush.

### C. Hub pages (Ideation/Curation)

- Struktur sudah reusable via `FlowHubShell`, tapi deskripsi di branch cards/footer cenderung panjang.
- Banyak teks deskriptif membuat card terasa berat untuk scanning cepat.

**Dampak UX:** user paham konsep, tapi lambat memilih aksi karena membaca terlalu banyak copy.

### D. Landing page

- Banyak section marketing + copy panjang + FAQ/paket dll dalam satu halaman tebal.
- Untuk product user yang ingin langsung trial flow, signal-to-noise ratio rendah.

**Dampak UX:** fokus aksi utama bisa tenggelam oleh konten naratif.

## 3) Rule of thumb untuk pemisahan (eksekusi cepat)

1. **Maks 300–400 baris per page container** (di atas itu wajib split ke section components).
2. **Maks 8–10 `useState` per page** (lebih dari itu pindah ke custom hooks berbasis domain).
3. **Satu page = satu tujuan utama user**; advanced setting masuk collapsible/drawer.
4. **Pisahkan domain Asset vs Publisher secara eksplisit**:
   - Asset domain: create/curate/finalize
   - Publisher domain: channel/account/schedule/run
5. **Router FastAPI tipis**: validasi + orchestration saja; logic besar pindah ke service module.
6. **Copy hygiene**:
   - Judul pendek
   - Deskripsi maksimal 1 kalimat
   - Detail bantuan di tooltip/collapsible, bukan tampil default panjang

## 4) Prioritas refactor (30 hari)

### Sprint 1 (quick wins)

- Queue Builder: ubah jadi 4 step (Select Assets → Platforms/Accounts → Schedule → Review).
- Settings: split tab menjadi route-level subpages:
  - `/settings/ai`
  - `/settings/prompts`
  - `/settings/integrations`
  - `/settings/workspace`
- Hub cards: trim deskripsi jadi 8–12 kata per card.

### Sprint 2 (stabilisasi)

- Extract custom hooks:
  - `useQueueSelection`
  - `usePublisherAccounts`
  - `usePublishSchedule`
  - `useSettingsProviders`
- Backend split module:
  - `services/publisher_queue_scan.py`
  - `services/publisher_queue_state.py`
  - `routers/settings_ai.py`, `settings_integrations.py`, dll.

### Sprint 3 (domain hardening)

- Pisahkan model data asset vs publish job secara lebih tegas sesuai roadmap durable job.
- Tambahkan event/audit granular untuk runs agar UI monitoring bisa lebih ringkas dan jelas.

## 5) Heuristik UI simplification (untuk desain berikutnya)

- Default layar hanya menampilkan:
  - KPI kecil (max 3)
  - daftar inti
  - 1 CTA utama
- Informasi detail:
  - dipindah ke drawer kanan atau accordion.
- Selalu tandai field:
  - `Required`
  - `Optional`
  - `Advanced`
- Copy standar card:
  - title 2–3 kata
  - subtitle maksimal 10 kata

## 6) Kesimpulan

Masalah inti saat ini lebih ke **separation of concerns** dan **information density**, bukan semata framework. Dengan split domain + split component + trim copy, UI bisa jauh lebih clean tanpa rewrite platform besar.
