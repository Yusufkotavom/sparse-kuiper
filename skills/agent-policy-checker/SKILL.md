---
name: agent-policy-checker
description: Validasi kepatuhan perubahan terhadap AGENTS.md, konvensi repo, dan instruksi user/developer sebelum commit. Gunakan saat review internal hasil kerja agent.
---

# Agent Policy Checker

## Kapan dipakai
- Sebelum commit.
- Saat hasil agent perlu diaudit kepatuhannya.

## Workflow
1. Baca instruksi prioritas: system/developer/user.
2. Baca AGENTS.md pada scope file yang disentuh.
3. Cocokkan perubahan terhadap:
   - style/convention,
   - workflow/testing,
   - batas keamanan.
4. Tandai pelanggaran + severity.
5. Berikan tindakan koreksi spesifik per file.

## Severity
- **High:** melanggar instruksi wajib atau berisiko merusak data/runtime.
- **Medium:** ketidaksesuaian style/workflow yang penting.
- **Low:** perbaikan kualitas non-blocking.

## Format output wajib
- **Policy checks** (pass/fail).
- **Daftar pelanggaran** (dengan severity).
- **Checklist perbaikan sebelum merge**.
