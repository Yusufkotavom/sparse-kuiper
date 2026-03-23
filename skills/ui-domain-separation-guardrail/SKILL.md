---
name: ui-domain-separation-guardrail
description: Aturan audit dan refactor untuk memisahkan domain Asset Generator vs Social Media Publisher, mengurangi halaman gemuk, dan menyederhanakan UI agar to-the-point.
---

# UI Domain Separation Guardrail

Gunakan skill ini saat user minta:
- pemisahan jelas antara **asset generator** dan **publisher ops**,
- audit file/frontend/backend yang terlalu gemuk,
- simplifikasi UI/UX yang terlalu padat informasi.

## Tujuan

1. Mencegah page/router menjadi "god file".
2. Menegakkan pemisahan domain:
   - Asset Studio (ideation/generation/curation/finalize)
   - Publisher Ops (channel/account/schedule/run)
3. Menurunkan cognitive load di UI.

## Workflow Wajib

1. **Scan hotspot**
   - Ambil 15-20 file terbesar (frontend `.tsx/.ts`, backend `.py`).
   - Tanda bahaya:
     - page > 400 baris,
     - >10 `useState` di satu page,
     - router > 500 baris dengan logic domain berat.

2. **Klasifikasikan tanggung jawab**
   - Tandai apakah logic termasuk:
     - presentation,
     - data-fetching,
     - business/domain rule,
     - integration/IO.
   - Jika 1 file memegang >=3 kategori, rencanakan split.

3. **Pemetaan domain**
   - Semua fitur diberi label: `asset_domain` atau `publisher_domain`.
   - Jika satu page memuat dua domain sekaligus, wajib pecah dengan step/route terpisah.

4. **UI complexity pass**
   - Cari gejala:
     - teks panjang di card/list,
     - >1 CTA primer dalam satu panel,
     - advanced options tampil default,
     - field required/optional tidak jelas.

5. **Refactor plan**
   - Quick win (1 sprint), mid-term (2-3 sprint), long-term.
   - Sertakan file target yang disentuh lebih dulu.

## Guardrail Teknis

### Frontend

- Batasi page container ke **300–400 baris**.
- Maksimal **8–10 useState** per page; lebih dari itu extract hook.
- Pisahkan ke layer:
  - `app/.../page.tsx` => orchestration ringan
  - `components/.../sections/*` => UI section
  - `hooks/*` => state & side-effects domain
  - `lib/api.ts` => API contract
- Gunakan komponen reusable (`PageHeader`, `EmptyState`, `KpiCard`, `SegmentedTabs`) sebelum membuat baru.

### Backend

- Router hanya validasi + orchestration.
- Logic scan/sync/retry dipindah ke `services/*`.
- Hindari satu router memegang domain campuran (settings AI + integrations + reset destructive dalam satu file).

## Guardrail UX

- Satu layar = satu keputusan utama.
- Advanced option collapsed by default.
- Copy card:
  - title: 2–4 kata,
  - subtitle: 8–12 kata max.
- Mandatory label eksplisit: `Required`, `Optional`, `Advanced`.
- Gunakan wizard 3–4 langkah untuk flow kompleks (bukan satu form panjang).

## Output Format Wajib

- **Hotspot files** (frontend + backend).
- **Risk map**: High / Medium / Low.
- **UI friction map**: area yang bikin user bingung.
- **Refactor plan**: quick win / mid-term / long-term.
- **Definition of done**: indikator selesai yang terukur.

## Definition of Done (minimum)

- Tidak ada page baru > 400 baris tanpa split plan.
- Tidak ada router baru > 500 baris tanpa ekstraksi service.
- UI flow utama punya 1 CTA primer yang jelas.
- Advanced settings tidak tampil default.
- Ada sebelum/sesudah audit note + command bukti scan.
