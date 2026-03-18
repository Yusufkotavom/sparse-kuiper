---
name: migration-designer
description: Rancang migrasi database yang idempotent, aman rollback, dan kompatibel bertahap untuk backend FastAPI + SQLAlchemy (SQLite/PostgreSQL). Gunakan saat ada perubahan schema/data.
---

# Migration Designer

## Kapan dipakai
- Ada perubahan kolom/tabel/index.
- Ada transisi model data (batch ke real-time, dll).
- User minta rencana migrasi + rollback.

## Workflow
1. Definisikan state saat ini vs target schema.
2. Tulis migration plan bertahap:
   - pre-check,
   - DDL/DML,
   - verifikasi.
3. Pastikan idempotent:
   - cek table/column/index sebelum create/alter.
4. Definisikan compatibility mode:
   - dual-read / dual-write bila perlu.
5. Tulis rollback plan yang realistis.
6. Catat dampak ke API, worker, dan data historis.

## Format output wajib
- **Tujuan migrasi**.
- **Langkah migrasi** (urut + command/SQL).
- **Rollback plan**.
- **Risiko data** + mitigasi.
- **Checklist validasi pasca migrasi**.
