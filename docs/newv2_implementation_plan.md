# NewV2 Implementation Plan (Asset vs Publisher Split)

Dokumen ini adalah rencana implementasi praktis untuk membangun UI baru di `app/newv2` **tanpa menghapus UI lama**.

## Goal

- Menyediakan flow baru yang lebih clean dan to-the-point.
- Memisahkan domain:
  - **Asset Generator**
  - **Social Media Publisher**
- Menjaga backward compatibility dengan route lama.

## Scope Guardrail

- UI lama tetap aktif.
- Semua perubahan V2 diletakkan di namespace baru (`/newv2/*`).
- Tidak melakukan migrasi besar backend di tahap awal.

## Milestone Plan

## Milestone 1 — Foundation (Week 1)

### Deliverables
- [x] Route baru `app/newv2` tersedia.
- [x] V2 landing menampilkan 2 entry utama: `Asset Generator` dan `Publisher Ops`.
- [x] Menampilkan status progress plan (total task, done, in-progress, blocked).
- [x] Link ke route lama tersedia sebagai fallback.

### Exit Criteria
- [x] `npm run build` lolos.
- [x] Tidak ada route lama yang dihapus.

## Milestone 2 — Asset Generator V2 Skeleton (Week 2)

### Deliverables
- [x] Sub-route `newv2/assets`.
- [x] Step ringkas: Ideation → Generate → Curation → Finalize.
- [x] Semua advanced opsi dipindahkan ke accordion/collapsible.
- [x] Empty/loading/error states konsisten.

### Exit Criteria
- [x] User bisa menyelesaikan 1 flow asset tanpa masuk route lama.

## Milestone 3 — Publisher Ops V2 Skeleton (Week 3)

### Deliverables
- [x] Sub-route `newv2/publisher`.
- [x] Wizard: Select Assets → Platforms/Accounts → Schedule → Review.
- [x] Label field jelas: Required / Optional / Advanced.
- [x] Monitoring card: queued / scheduled / running / failed.

### Exit Criteria
- [x] User bisa create job publish dari V2 skeleton.

## Milestone 4 — Monitoring & Stabilization (Week 4)

### Deliverables
- [x] Halaman `newv2/monitoring` untuk checklist delivery plan.
- [x] Audit copy: deskripsi dipendekkan, CTA primer tunggal per panel.
- [x] Telemetry dasar (action success/fail).

### Exit Criteria
- [x] Checklist plan bisa dipakai PM/dev untuk tracking progres harian.

## Backlog Todo (Prioritas)

## P0 (harus dulu)
- [x] Build route `newv2` + cards domain split.
- [x] Buat baseline checklist monitoring.
- [x] Definisikan status task: `todo`, `in_progress`, `blocked`, `done`.

## P1
- [x] Integrasi data realtime runs ke monitor V2.
- [x] Komponen reusable stepper/wizard.
- [ ] Snapshot UI before/after untuk review cepat.

## P2
- [x] A/B test copy singkat vs copy panjang.
- [x] KPI UX: time-to-first-job, click count, completion rate.

## Daily Execution Checklist

- [ ] Pilih 1 task P0/P1.
- [ ] Tandai status (`todo` → `in_progress` → `done/blocked`).
- [ ] Catat blocker + next action.
- [ ] Update monitoring board sebelum end-of-day.

## Definition of Done (V2)

- [x] Route lama masih hidup.
- [x] V2 punya domain split yang tegas.
- [x] Advanced setting tidak mendominasi layar utama.
- [x] Checklist monitoring dipakai aktif oleh tim.
