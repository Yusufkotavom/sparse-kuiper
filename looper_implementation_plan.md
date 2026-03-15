# 🗺️ Implementation Plan: Looper Studio → Live Engine

> **Goal:** Ubah `/looper` dari prototype (stub) menjadi tool yang benar-benar bekerja, satu fase per satu.

---

## Status Kondisi Saat Ini

| Item | Status |
|------|--------|
| [frontend/src/app/looper/page.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/looper/page.tsx) | ✅ UI + run/poll/cancel + save/delete preset |
| [frontend/src/components/studio/LooperConfig.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/components/studio/LooperConfig.tsx) | ✅ Config component lengkap |
| [frontend/src/lib/api.ts](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/lib/api.ts) — `settingsApi.listLooperPresets` | ✅ Ada |
| [frontend/src/lib/api.ts](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/lib/api.ts) — `looperApi` (run/status/cancel/file-info) | ✅ Ada |
| [backend/routers/looper.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/routers/looper.py) | ✅ Ada |
| [backend/services/looper_worker.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/services/looper_worker.py) | ✅ Ada |
| [services/autocrop/app.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/services/autocrop/app.py) — pipeline lengkap | ✅ Ada (Streamlit, belum terekspos) |
| [frontend/src/components/studio/LooperPreviewPanel.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/components/studio/LooperPreviewPanel.tsx) | ✅ Preview mini video + metadata + estimasi |

---

## Fase 1 — Backend Looper Engine + API Connect ⬅️ MULAI DARI SINI

**Scope:** Buat backend yang bisa menjalankan looper job secara async dan expose status-nya.

### File yang Disentuh:
```
backend/services/looper_worker.py  ← NEW
backend/routers/looper.py          ← NEW
backend/main.py                    ← +1 baris register router
frontend/src/lib/api.ts            ← tambah looperApi
frontend/src/app/looper/page.tsx   ← ganti handleRun stub → real API call
```

### Tasks:
- [x] **1a.** Buat [backend/services/looper_worker.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/services/looper_worker.py)
  - Extract fungsi [proses_video()](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/services/autocrop/app.py#132-541) dari [autocrop/app.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/services/autocrop/app.py) jadi pure Python function
  - Support semua parameter: `cut_start`, `disable_crossfade`, `crossfade_duration`, `mode`, `loops`, `target_duration`, `quality`, `resolution`, `mute_audio`, `audio_fade`
  - Return [(success: bool, output_path: str, error_message: str)](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/lib/api.ts#777-783)
  - Simpan progress ke dict in-memory `JOBS: dict[str, JobStatus]`

- [x] **1b.** Buat [backend/routers/looper.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/routers/looper.py)
  - `POST /api/v1/looper/run` → terima payload, taruh ke `BackgroundTasks`, return `{ job_id }`
  - `GET  /api/v1/looper/status/{job_id}` → return `{ status, progress, stage_label, output_path?, error? }`
  - `POST /api/v1/looper/cancel/{job_id}` → set cancel flag

- [x] **1c.** Register router di [backend/main.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/main.py)

- [x] **1d.** Tambah `looperApi` di [frontend/src/lib/api.ts](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/lib/api.ts)
  - `looperApi.run(payload)` → POST /looper/run
  - `looperApi.getStatus(jobId)` → GET /looper/status/{id}

- [x] **1e.** Update [frontend/src/app/looper/page.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/looper/page.tsx)
  - [handleRun](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/looper/page.tsx#203-250) → call `looperApi.run()`
  - Simpan `jobId` di state
  - Poll `looperApi.getStatus(jobId)` setiap 2 detik
  - [JobProgressPanel](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/looper/page.tsx#37-126) dengan 6 stage + cancel button

### Done When:
> ✅ **FASE 1 SELESAI** — Klik "Buat B-Roll Baru" → backend menjalankan pipeline FFmpeg secara nyata → file output terbentuk di disk → frontend menampilkan progress 6-stage dengan cancel button.

---

## Fase 2 — Progress UI yang Keren (Real-time Feedback)

**Scope:** Upgrade tampilan progress dari basic ke full experience.

### File yang Disentuh:
```
frontend/src/app/looper/page.tsx   ← enhance progress UI
frontend/src/components/studio/    ← LooperRunProgress.tsx (NEW component)
```

### Tasks:
- [x] **2a.** Buat komponen `LooperRunProgress.tsx`:
  - 6 tahap visual dengan ikon (📂 Muat → ✂️ Potong → 🧮 Kalkulasi → 🎬 Render → ⚡ Gandakan → 🎵 Audio)
  - Setiap tahap: ikon status (pending/running/done/error)
  - Progress bar animasi
  - Timer elapsed

- [x] **2b.** Tambahkan state manajemen yang lebih baik di page.tsx:
  - `jobState: "idle" | "running" | "done" | "error"`
  - Loading spinner di tombol saat running
  - Disable form input saat job berjalan

- [x] **2c.** Setelah selesai: tampilkan output path + estimasi ukuran file

### Done When:
> ✅ User melihat 6 tahap yang update satu per satu saat proses berjalan, dengan timer dan status per tahap.

---

## Fase 3 — Kolom Kanan: Video Preview + Estimasi Output

**Scope:** Isi kolom kanan layout yang saat ini kosong.

### File yang Disentuh:
```
frontend/src/app/looper/page.tsx              ← aktifkan kolom kanan
frontend/src/components/studio/LooperPreviewPanel.tsx  ← NEW
backend/routers/looper.py                      ← tambah endpoint file info
```

### Tasks:
- [x] **3a.** Buat komponen `LooperPreviewPanel.tsx`:
  - Thumbnail/mini preview dari file yang dipilih (via video element `src`)
  - Info metadata: durasi asli, resolusi, FPS (dari backend `ffprobe`)
  - Section **"Estimasi Output"** (pure frontend calculation):
    - Durasi output berdasarkan config
    - Jumlah loop yang akan terjadi
    - Perkiraan ukuran file (estimasi kasar berdasarkan bitrate)

- [x] **3b.** Tambah endpoint `GET /api/v1/looper/file-info?project=...&file=...`
  - Jalankan `ffprobe` pada file, kembalikan `{ duration, width, height, fps, size_mb }`

- [x] **3c.** Kalkulasi estimasi output di frontend (realtime saat slider berubah):
  ```ts
  const estimatedDuration = mode === "manual"
    ? (asliDuration - cut_start) * loops
    : targetDuration;
  ```

### Done When:
> ✅ Kolom kanan terisi dengan preview file + info metadata + estimasi output yang update realtime saat user ganti slider.

---

## Fase 4 — Save Current Config as Preset

**Scope:** Tombol "Simpan sebagai Preset" yang menyimpan config aktif.

### File yang Disentuh:
```
frontend/src/components/studio/LooperConfig.tsx  ← tambah tombol + dialog
frontend/src/app/looper/page.tsx                 ← handle save logic
```

### Tasks:
- [x] **4a.** Tambah tombol `Save as Preset` di [LooperConfig.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/components/studio/LooperConfig.tsx) (di header section)
- [x] **4b.** Dialog popup untuk input nama preset baru
- [x] **4c.** Call `settingsApi.createLooperPreset()` (sudah ada di api.ts!)
- [x] **4d.** Reload preset list setelah save berhasil
- [x] **4e.** Tambah tombol **Delete Preset** dengan konfirmasi

### Done When:
> ✅ User bisa configure settings, klik "Simpan sebagai Preset", beri nama, dan preset tampil di dropdown untuk dipakai lagi.

---

## Urutan Implementasi

```
Fase 1 → Fase 2 → Fase 3 → Fase 4
  ↑
Mulai sekarang
```

Setiap fase di-complete dan di-test sebelum lanjut ke fase berikutnya.

---

## Catatan Teknis Penting

### Path Resolution
- File input path dari URL params adalah relative path dalam project directory
- Backend perlu resolve: `VIDEO_PROJECTS_DIR / project / "raw" / file`
- Output disimpan di: `VIDEO_PROJECTS_DIR / project / "final" / {name}{suffix}.mp4`

### BackgroundTasks vs Threading
- `FastAPI BackgroundTasks` cocok untuk task sederhana
- Untuk pipeline FFmpeg yang bisa lama (>30 detik), gunakan `asyncio.get_event_loop().run_in_executor()` agar tidak block event loop

### Job Storage
- MVP: in-memory dict `JOBS: Dict[str, JobStatus]` (hilang saat restart)
- Upgrade nanti: SQLite table `looper_jobs` (setelah semua fase selesai)
