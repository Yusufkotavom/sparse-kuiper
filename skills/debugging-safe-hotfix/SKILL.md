---
name: debugging-safe-hotfix
description: Alur debugging dan hotfix aman untuk memperbaiki bug cepat tanpa menimbulkan kerusakan baru di kode utama.
---

# Debugging & Safe Hotfix

## Workflow
1. Reproduksi bug dengan langkah yang konsisten.
2. Tambah logging terarah pada titik gagal.
3. Perbaiki akar masalah (bukan symptom-only) jika memungkinkan.
4. Tambahkan regression test untuk bug tersebut.
5. Rollout hotfix kecil dan terpantau.

## Checklist Minimum
- [ ] Bug reproduction terdokumentasi.
- [ ] Fix minim scope, tidak refactor besar.
- [ ] Test terkait bug ditambahkan/diperbarui.
- [ ] Ada verifikasi pasca-deploy.
