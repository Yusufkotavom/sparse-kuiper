---
name: ai-api-orchestration
description: Standar implementasi integrasi API AI agar konsisten, resilient, dan mudah dipantau. Gunakan saat menambah endpoint AI baru, memperbaiki error handling, retry, timeout, atau fallback model/provider.
---

# AI API Orchestration

## Tujuan
Menyatukan cara aplikasi memanggil AI API agar:
- konsisten,
- mudah di-debug,
- tahan gagal (retry/fallback),
- aman untuk produksi.

## Workflow
1. Definisikan kontrak request/response typed.
2. Terapkan timeout + retry terukur (bukan infinite retry).
3. Normalisasi error ke format internal tunggal.
4. Tambahkan fallback model/provider bila critical path.
5. Catat metrik minimum: latency, error rate, token/cost (jika tersedia).

## Checklist Minimum
- [ ] Ada helper tunggal untuk call AI (hindari duplikasi).
- [ ] Timeout eksplisit per request.
- [ ] Retry hanya untuk error transient (429/5xx/network).
- [ ] Error user-friendly dipisah dari error teknis.
- [ ] Correlation/request id diteruskan ke log.

## Kapan Tidak Dipakai
- Task murni UI statis tanpa interaksi AI.
