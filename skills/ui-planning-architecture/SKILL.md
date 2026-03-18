---
name: ui-planning-architecture
description: Panduan perencanaan UI agar kompleksitas fitur tidak menurunkan kualitas pengalaman pengguna, termasuk prioritas UX, arsitektur halaman, dan kontrol scope.
---

# UI Planning Architecture

## Tujuan
Menjaga UI tetap maksimal walau project makin kompleks.

## Prinsip
1. User flow utama lebih penting daripada jumlah fitur.
2. Satu halaman satu fokus utama (hindari UI campur aduk).
3. Prioritaskan kejelasan aksi dibanding dekorasi visual.
4. Pecah kompleksitas ke komponen/step progresif.

## Workflow
1. Definisikan 3 prioritas UX per halaman (aksi utama, feedback, error handling).
2. Petakan informasi: apa yang wajib tampil, opsional, dan advanced.
3. Buat struktur layout bertingkat (primary panel, secondary panel, drawer/modal).
4. Uji dengan skenario pengguna baru vs pengguna power-user.
5. Lock UI contract sebelum implementasi besar.

## Checklist Minimum
- [ ] Ada dokumen ringkas user flow sebelum coding UI.
- [ ] Ada batasan elemen per layar agar tidak overload.
- [ ] Loading/empty/error states dirancang dari awal.
- [ ] Ada jalur sederhana (basic) dan jalur lanjutan (advanced).
- [ ] UI review wajib sebelum merge.
