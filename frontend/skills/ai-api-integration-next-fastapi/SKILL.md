---
name: ai-api-integration-next-fastapi
description: Pedoman integrasi AI API baru antara Next.js dan FastAPI, termasuk kontrak payload, error mapping, timeout, dan versioning endpoint.
---

# AI API Integration (Next.js + FastAPI)

## Workflow
1. Definisikan kontrak request/response (typed) di backend dan frontend.
2. Tambah endpoint AI baru dengan versioning yang jelas.
3. Terapkan timeout, retry terbatas, dan error normalization.
4. Dokumentasikan endpoint + contoh payload.
5. Tambah fallback untuk menjaga UX saat provider gagal.

## Checklist Minimum
- [ ] Endpoint baru tidak memecah endpoint lama.
- [ ] Frontend API client terpusat dan reusable.
- [ ] Error backend dipetakan ke pesan UI yang jelas.
- [ ] Ada test integration untuk endpoint AI baru.
