---
name: video-gen-kdp-workflow
description: Workflow pengembangan fitur Video Gen dan KDP agar tetap kompatibel dengan proyek lama, termasuk prompt, asset stages, queue, dan publish readiness.
---

# Video Gen + KDP Workflow

## Tujuan
Menambah atau mengubah fitur Video Gen/KDP tanpa memutus flow project existing.

## Workflow
1. Petakan flow lama (generate -> curate -> queue -> publish).
2. Tambah field/opsi baru secara backward-compatible.
3. Jaga stage asset (`raw/final/archive`) tetap konsisten.
4. Uji end-to-end untuk project lama dan project baru.

## Checklist Minimum
- [ ] Endpoint lama tetap berfungsi.
- [ ] Struktur data lama masih bisa dibaca.
- [ ] Fitur baru punya fallback default.
- [ ] Ada smoke test untuk jalur Video Gen dan KDP.
