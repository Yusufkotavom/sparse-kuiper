---
name: feature-extension-without-regression
description: Strategi menambah fitur baru tanpa mengubah perilaku lama, menggunakan feature flag, adapter, dan regresi test.
---

# Feature Extension Without Regression

## Workflow
1. Tambahkan fitur lewat jalur baru (non-breaking path).
2. Gunakan feature flag untuk aktivasi bertahap.
3. Jaga default behavior tetap sama dengan versi lama.
4. Jalankan regression test sebelum dan sesudah perubahan.

## Checklist Minimum
- [ ] Perilaku lama tetap default.
- [ ] Fitur baru bisa dimatikan cepat.
- [ ] Ada test untuk old path + new path.
- [ ] Dokumentasi perubahan menyebut dampak kompatibilitas.
