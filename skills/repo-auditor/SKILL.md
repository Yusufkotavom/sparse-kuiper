---
name: repo-auditor
description: Audit struktur repository, code risk, coupling, dan quick-win refactor untuk project FastAPI + Next.js. Gunakan saat user meminta peninjauan kode, audit arsitektur, atau prioritas technical debt.
---

# Repo Auditor

## Kapan dipakai
- User minta *peninjauan kode*.
- User minta daftar risiko + prioritas perbaikan.
- Akan mulai refactor area besar.

## Workflow
1. Petakan struktur folder dan modul inti.
2. Identifikasi hotspot:
   - file besar,
   - dependency silang,
   - duplikasi logic,
   - area rawan bug/runtime.
3. Klasifikasikan risiko: tinggi/sedang/rendah.
4. Berikan prioritas aksi:
   - quick win (1 sprint),
   - mid-term,
   - long-term.
5. Tutup dengan daftar file yang disarankan disentuh terlebih dulu.

## Format output wajib
- **Temuan utama** (3–7 poin).
- **Risk map** (tinggi/sedang/rendah).
- **Aksi prioritas** (urut, bisa dieksekusi).
- **Dampak & trade-off**.
