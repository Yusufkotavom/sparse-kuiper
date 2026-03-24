# NewV2 UI Snapshot (Before vs After)

Dokumen ini dipakai sebagai **snapshot review cepat** untuk item backlog P1: `Snapshot UI before/after`.

## Before (Skeleton-only)

- Assets: hanya step cards + collapsible advanced, belum ada action API langsung.
- Publisher: hanya wizard skeleton, belum ada add-to-queue + save config.
- Monitoring: hanya task board checklist, belum ada metrics realtime.

## After (Wired + Observable)

- Assets:
  - create/list project video,
  - upload files ke target stage (`raw/final`),
  - success/error state untuk action utama.
- Publisher:
  - add asset ke queue,
  - quick-pick asset dari project video,
  - pilih platform + account map,
  - save metadata/config job.
- Monitoring:
  - metrics realtime queue/jobs (queued/scheduled/running/failed/total),
  - refresh manual + interval 15 detik,
  - KPI UX (time-to-first-job, total clicks, completion rate) dari local telemetry.

## Reviewer Checklist

- [x] Domain split tetap jelas (`/newv2/assets`, `/newv2/publisher`, `/newv2/monitoring`).
- [x] Legacy route tetap hidup sebagai fallback.
- [x] Action utama di V2 bisa dieksekusi tanpa pindah route lama.
- [x] Monitoring bisa dipakai untuk status operasional harian.
