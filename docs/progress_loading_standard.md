# Standar Implementasi Progress Loading (Backend + Frontend)

Dokumen ini menjadi acuan untuk developer/AI berikutnya agar pola progress loading konsisten seperti Looper Studio.

## Tujuan

- Memberikan feedback real-time saat proses panjang berjalan.
- Menjaga format status seragam di backend dan frontend.
- Memastikan UX tetap jelas untuk state `pending`, `running`, `done`, dan `error`.

## Kontrak Data Wajib

Gunakan shape status job berikut di endpoint status:

- `job_id: string`
- `status: "pending" | "running" | "done" | "error"`
- `progress: number` (0–100)
- `stage: number` (1..N)
- `stage_label: string`
- `output_path?: string | null`
- `error?: string | null`
- `finished_at?: number | null`

Aturan:

- `progress` hanya naik, tidak boleh turun.
- `status = done` wajib `progress = 100`.
- `status = error` wajib isi `error`.
- `stage_label` harus human-readable dan boleh berisi detail tahap aktif.

## Arsitektur Standar

### 1) Backend: run + status + cancel

Sediakan 3 endpoint:

- `POST /.../run` untuk memulai job async, return `job_id`.
- `GET /.../status/{job_id}` untuk polling status.
- `POST /.../cancel/{job_id}` untuk request pembatalan.

Aturan:

- `run` harus cepat return (jangan blok request utama).
- proses berat dijalankan di background thread/executor.
- status job disimpan terpusat (in-memory/DB), update per tahap.

### 2) Backend Worker: update progress per tahap

Gunakan stage map tetap, contoh 6 tahap:

1. Memuat & Validasi
2. Potong + Crossfade
3. Kalkulasi
4. Render 1x Loop
5. Gandakan via FFmpeg
6. Audio & Trim Final

Pola update tahap:

- saat masuk tahap baru, set:
  - `job.stage = currentStage`
  - `job.stage_label = "{nama tahap} — {detail opsional}"`
  - `job.progress = ((currentStage - 1) / totalStage) * 100`
  - `job.status = "running"`

Finalisasi:

- sukses:
  - `job.status = "done"`
  - `job.progress = 100`
  - `job.stage_label = "Selesai!"`
  - `job.output_path = ...`
  - `job.finished_at = now`
- gagal:
  - `job.status = "error"`
  - `job.error = pesan error`
  - `job.finished_at = now`

### 3) Frontend: start + polling + render panel

Saat user klik Run:

- panggil API `run()`.
- simpan `job_id`.
- seed status awal agar panel langsung tampil:
  - `status = pending`
  - `progress = 0`
  - `stage = 0`
  - `stage_label = "Menunggu dimulai…"`

Polling:

- interval default: setiap 2 detik.
- stop polling jika status `done` atau `error`.
- tangani error polling secara silent/retry agar UI tidak berkedip.

UI panel minimum:

- headline status (`Memproses…`, `Selesai`, `Gagal`).
- elapsed timer lokal (detik/menit).
- progress bar + persen.
- daftar tahap statis (pending/current/done).
- tombol `Cancel` saat running.
- tombol `Reset` saat done/error.

## Aturan UX

- Tombol Run harus disabled saat job running.
- Form konfigurasi boleh disabled saat running untuk mencegah state drift.
- Status text di tombol harus sinkron dengan panel.
- Error detail tampil ringkas + bisa dibaca user non-teknis.
- Preview output hanya ditampilkan jika `status = done` dan `output_path` tersedia.

## Aturan Naming & Konsistensi

- Gunakan istilah tahap yang sama antara backend `stage_label` dan frontend steps.
- Hindari istilah campur aduk untuk aksi yang sama.
- Jangan ubah urutan tahap tanpa update di worker + UI bersamaan.

## Checklist Implementasi

- [ ] Endpoint `run/status/cancel` tersedia.
- [ ] Job registry menyimpan `status/progress/stage/stage_label/error/output_path`.
- [ ] Worker update stage di setiap blok proses utama.
- [ ] Worker cek cancel flag di beberapa titik penting.
- [ ] Frontend seed status awal setelah `run`.
- [ ] Frontend polling periodik dan stop condition benar.
- [ ] UI menampilkan progress persen + tahap aktif.
- [ ] Done/error state menutup polling dan memberi feedback toast.
- [ ] `done` selalu 100%.
- [ ] Error selalu punya message yang jelas.

## Anti-Pattern (Hindari)

- Menjalankan proses berat langsung di request handler tanpa background worker.
- Hanya mengirim status akhir tanpa progress antar tahap.
- Progress berubah acak (mis. turun dari 60 ke 40).
- Frontend tidak menghentikan polling setelah done/error.
- Stage UI berbeda total dari stage backend.

## Template Integrasi Cepat

Untuk fitur baru dengan proses panjang, gunakan urutan tetap:

1. Definisikan stage list dan kontrak status.
2. Buat endpoint `run/status/cancel`.
3. Tambahkan worker update per tahap.
4. Buat client API `run/getStatus/cancel`.
5. Tambahkan panel progress + polling di frontend.
6. Validasi done/error/cancel secara manual.

Jika semua poin di atas dipatuhi, dev/AI berikutnya akan menghasilkan perilaku progress loading yang seragam dengan Looper Studio.
