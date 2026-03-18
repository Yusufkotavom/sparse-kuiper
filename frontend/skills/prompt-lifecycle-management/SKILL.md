---
name: prompt-lifecycle-management
description: Praktik mengelola prompt sebagai aset produk (template, versioning, evaluasi). Gunakan saat membuat atau mengubah prompt untuk fitur AI.
---

# Prompt Lifecycle Management

## Tujuan
Menjaga kualitas output AI tetap stabil saat fitur berkembang.

## Workflow
1. Simpan prompt sebagai template (system, prefix, suffix, variables).
2. Beri versi dan changelog singkat tiap perubahan.
3. Siapkan dataset uji kecil (happy path + edge cases).
4. Evaluasi hasil sebelum rilis.
5. Rollback ke versi stabil jika kualitas turun.

## Checklist Minimum
- [ ] Prompt tidak hardcoded tersebar di banyak file.
- [ ] Ada aturan style output (format, tone, panjang).
- [ ] Ada acceptance criteria terukur.
- [ ] Ada catatan model yang dipakai per versi prompt.

## Catatan
Jika output dipakai untuk publikasi, tambahkan review human-in-the-loop.
