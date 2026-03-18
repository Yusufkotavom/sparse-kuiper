---
name: provider-abstraction
description: Pola abstraksi provider AI agar aplikasi tidak terkunci pada satu model/vendor. Gunakan saat menambah provider baru, fallback model, atau migrasi vendor.
---

# Provider Abstraction

## Tujuan
Memisahkan logika bisnis dari detail SDK/provider AI.

## Workflow
1. Buat interface provider netral (generate, embed, classify, dst).
2. Implement adapter per provider di layer terpisah.
3. Mapping capability per model/provider (fitur, limit, cost).
4. Buat routing policy (default, fallback, cost-aware).
5. Uji kompatibilitas output antar provider utama.

## Checklist Minimum
- [ ] Kode bisnis tidak import SDK provider langsung.
- [ ] Fallback strategy terdokumentasi.
- [ ] Perbedaan format response dinormalisasi.
- [ ] Ada feature flag untuk pindah provider.

## Catatan
Abstraksi bukan berarti menyamakan semua fitur canggih provider; expose fitur khusus secara opt-in.
