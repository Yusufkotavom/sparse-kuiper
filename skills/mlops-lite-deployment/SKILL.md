---
name: mlops-lite-deployment
description: Praktik deployment ringan untuk fitur AI: environment strategy, smoke test, monitoring, dan rollback. Gunakan saat release fitur AI ke staging/production.
---

# MLOps-lite Deployment

## Tujuan
Merilis perubahan AI dengan aman tanpa proses MLOps berat.

## Workflow
1. Pisahkan env dev/staging/prod dengan konfigurasi model terkontrol.
2. Jalankan smoke test end-to-end setelah deploy.
3. Monitor KPI kritikal 24 jam pertama.
4. Aktifkan gradual rollout (feature flag/canary sederhana).
5. Siapkan prosedur rollback cepat.

## Checklist Minimum
- [ ] Konfigurasi model per env terdokumentasi.
- [ ] Smoke test otomatis untuk endpoint AI utama.
- [ ] Dashboard pasca-rilis siap sebelum deploy.
- [ ] Rollback plan diuji minimal sekali.

## Definition of Done
Release dianggap selesai jika stabilitas, biaya, dan kualitas berada dalam threshold yang disepakati.
