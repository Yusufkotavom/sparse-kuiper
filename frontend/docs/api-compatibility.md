# API Compatibility Plan

Dokumen ini menjelaskan strategi kompatibilitas API antara endpoint existing (`/api/v1`) dan endpoint baru (`/api/v2`), termasuk status kompatibilitas, aturan versioning, standar error response, dan strategi transisi di frontend.

## 1) Daftar endpoint existing vs endpoint baru

| Domain | Existing (v1) | Baru (v2) | Catatan |
|---|---|---|---|
| KDP | `/api/v1/kdp/*` | `/api/v2/content/kdp/*` | Namespace dipindah ke `content` |
| Video | `/api/v1/video/*` | `/api/v2/content/video/*` | Namespace dipindah ke `content` |
| Settings | `/api/v1/settings/*` | `/api/v2/system/settings/*` | Dipisahkan ke domain `system` |
| Publisher | `/api/v1/publisher/*` | `/api/v2/distribution/publisher/*` | Dipisahkan ke domain `distribution` |
| Endpoint lain | tetap | tetap | Jika belum dimigrasikan, tetap di path existing |

## 2) Status compatibility

| Tipe perubahan | Definisi | Contoh | Kebijakan |
|---|---|---|---|
| Backward compatible | Contract lama tetap valid | Menambah field response opsional | Bisa dirilis di versi minor/patch |
| Deprecated | Masih bekerja tetapi ditandai akan dihapus | `/api/v1/kdp/*` saat klien mulai migrasi ke v2 | Tambah warning header/log + timeline sunset |
| Breaking | Mengubah path/shape wajib/semantik | `kdp -> content/kdp`, perubahan struktur payload wajib | Hanya di major version (`/api/v2`) |

### Rekomendasi masa transisi

- Periode transisi: backend melayani **v1 dan v2** secara paralel.
- Endpoint v1 diberi status **deprecated** sampai tanggal sunset yang disepakati.
- Setelah sunset, v1 dapat dikembalikan `410 Gone` dengan pesan migrasi.

## 3) Aturan versioning

Gunakan URL versioning eksplisit:

- `/api/v1/...` untuk contract lama/stabil saat ini.
- `/api/v2/...` untuk contract baru yang mengandung breaking change.

### Aturan rilis

1. **Non-breaking change** (tambahan field opsional, endpoint baru) boleh tetap dalam versi yang sama.
2. **Breaking change** wajib masuk versi baru (`v2`, `v3`, dst).
3. Selama transisi major version:
   - dokumentasikan mapping endpoint v1 -> v2,
   - sediakan deprecation notice,
   - sediakan fallback adapter di frontend.

## 4) Error response standard (kode + shape)

Standarisasi error response JSON lintas versi:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Project tidak ditemukan",
    "details": {
      "project": "demo-project"
    },
    "request_id": "req_12345"
  }
}
```

### HTTP status yang direkomendasikan

| HTTP status | code | Kapan digunakan |
|---|---|---|
| `400` | `BAD_REQUEST` | Payload tidak valid secara format |
| `401` | `UNAUTHORIZED` | Token tidak ada/tidak valid |
| `403` | `FORBIDDEN` | Tidak punya akses |
| `404` | `RESOURCE_NOT_FOUND` | Resource tidak ditemukan |
| `409` | `CONFLICT` | Bentrok state/data |
| `422` | `VALIDATION_ERROR` | Validasi field gagal |
| `429` | `RATE_LIMITED` | Melebihi limit request |
| `500` | `INTERNAL_ERROR` | Error server tidak terduga |
| `503` | `SERVICE_UNAVAILABLE` | Service dependency down/maintenance |

### Catatan implementasi

- `code` harus **stabil** untuk konsumsi frontend (jangan bergantung pada `message` untuk logic).
- `message` human-readable, bisa dilokalisasi.
- `details` opsional untuk konteks validasi/debug.
- `request_id` wajib pada lingkungan produksi untuk traceability.

## 5) Kewajiban frontend adapter selama transisi

Frontend client **wajib memakai adapter endpoint** agar endpoint lama tetap berjalan selama masa transisi:

- Saat target versi frontend = `v2`, endpoint lama dipetakan otomatis ke path baru.
- Bila backend belum menyediakan path v2, client melakukan fallback ke endpoint legacy (`v1`) untuk menjaga kompatibilitas.
- Konfigurasi versi target dilakukan via environment variable (misalnya `NEXT_PUBLIC_API_TARGET_VERSION=v1|v2`).

Dengan pendekatan ini, migrasi dapat dilakukan bertahap tanpa memblokir pengguna yang masih terhubung ke backend lama.
