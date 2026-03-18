---
name: ai-observability-evaluation
description: Standar observability dan evaluasi kualitas output AI. Gunakan saat membangun dashboard metrik AI, tracing, dan quality checks.
---

# AI Observability & Evaluation

## Tujuan
Mengetahui apakah fitur AI:
- cepat,
- hemat biaya,
- stabil,
- berkualitas.

## Metrik Inti
- Latency (p50/p95)
- Error rate per endpoint/model
- Token/cost per request (jika provider mendukung)
- Quality score (manual atau rule-based)

## Workflow
1. Definisikan KPI per use case.
2. Log input/output metadata (tanpa data sensitif mentah).
3. Buat dashboard + alert threshold.
4. Jalankan evaluasi berkala pada sample tetap.
5. Tindak lanjuti regresi sebelum rollout luas.

## Checklist Minimum
- [ ] Request ID konsisten lintas service.
- [ ] Error class terstruktur.
- [ ] Dashboard untuk kualitas dan performa.
- [ ] Alarm untuk lonjakan error/cost.
