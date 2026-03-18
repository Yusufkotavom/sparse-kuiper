---
name: playwright-e2e-ui-validation
description: Standar penggunaan Playwright untuk validasi perubahan UI, flow fitur AI, dan regresi sebelum rilis.
---

# Playwright E2E UI Validation

## Tujuan
Mencegah regresi saat ubah UI atau menambah fitur baru.

## Workflow
1. Buat skenario e2e untuk flow utama (login, generate, queue, publish).
2. Tambahkan test untuk fitur baru dan jalur lama.
3. Simpan screenshot artifact untuk perubahan visual penting.
4. Jalankan di CI sebelum merge.

## Checklist Minimum
- [ ] Minimal 1 test happy path.
- [ ] Minimal 1 test regresi jalur lama.
- [ ] Assertion error state dan loading state.
- [ ] Screenshot untuk perubahan visual.
