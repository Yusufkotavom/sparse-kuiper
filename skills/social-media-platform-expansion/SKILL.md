---
name: social-media-platform-expansion
description: Panduan menambah platform sosial media baru pada sistem publisher (akun, metadata, schedule, status mapping, dan fallback).
---

# Social Media Platform Expansion

## Workflow
1. Definisikan capability platform baru (format, durasi, privasi, API limits).
2. Tambah mapping akun dan credential handling aman.
3. Normalisasi metadata publish lintas platform.
4. Tambah status mapping (`queued/success/failed`) per platform.
5. Uji end-to-end mulai dari queue sampai published history.

## Checklist Minimum
- [ ] Platform baru tidak merusak platform existing.
- [ ] Perbedaan requirement platform terdokumentasi.
- [ ] Error message per-platform jelas.
- [ ] Monitoring hasil publish per-platform tersedia.
