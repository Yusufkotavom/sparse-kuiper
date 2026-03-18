---
name: release-guardian
description: Terapkan quality gate sebelum merge: lint, type/build, smoke test, dan ringkasan risiko release. Gunakan saat finalisasi PR atau persiapan rilis.
---

# Release Guardian

## Kapan dipakai
- Sebelum commit final atau merge PR.
- Saat user meminta validasi menyeluruh perubahan.

## Workflow
1. Identifikasi stack terdampak (frontend/backend/docs).
2. Jalankan checks minimum sesuai stack.
3. Catat hasil per command: pass/warning/fail.
4. Verifikasi breaking change potensial.
5. Siapkan release note ringkas untuk reviewer.

## Minimum checks (sesuaikan scope)
- Frontend: build/lint/typecheck.
- Backend: startup/smoke endpoint docs.
- Dokumentasi: link dan struktur file utama valid.

## Format output wajib
- **Check matrix** (command + status).
- **Breaking changes** (jika ada).
- **Go/No-Go recommendation**.
