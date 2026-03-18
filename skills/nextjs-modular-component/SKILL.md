---
name: nextjs-modular-component
description: Pedoman membuat komponen Next.js modular dan reusable agar penambahan fitur baru tidak merusak halaman lama.
---

# Next.js Modular Component

## Workflow
1. Pisahkan komponen atom/molecule/section sesuai tanggung jawab.
2. Jaga props API stabil dan typed.
3. Hindari side-effect lintas komponen yang tersembunyi.
4. Buat wrapper adaptasi jika ada kebutuhan baru.

## Checklist Minimum
- [ ] Komponen baru reusable, bukan hardcoded halaman tunggal.
- [ ] Tidak mengubah contract komponen lama tanpa migration path.
- [ ] State management tidak bocor ke global secara tidak perlu.
- [ ] Test render dan interaction dasar tersedia.
