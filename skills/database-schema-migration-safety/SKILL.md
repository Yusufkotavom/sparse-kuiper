---
name: database-schema-migration-safety
description: Prosedur perubahan schema database yang aman, backward-compatible, dan minim downtime untuk fitur AI baru.
---

# Database Schema Migration Safety

## Workflow
1. Rancang migration additive dulu (tambah kolom/tabel, jangan langsung drop).
2. Isi data backfill bertahap bila perlu.
3. Deploy kode yang kompatibel dengan schema lama+baru.
4. Setelah stabil, lakukan cleanup migration lanjutan.

## Checklist Minimum
- [ ] Backup sebelum migration.
- [ ] Rollback plan tersedia.
- [ ] Query lama tetap jalan sementara.
- [ ] Data integrity check setelah deploy.
