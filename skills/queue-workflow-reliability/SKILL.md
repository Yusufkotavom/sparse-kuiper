---
name: queue-workflow-reliability
description: Panduan merancang workflow async berbasis queue yang idempotent, observable, dan tahan gagal. Gunakan untuk fitur antrian, publisher, atau background jobs.
---

# Queue Workflow Reliability

## Tujuan
Mencegah job hilang, duplikasi proses, dan status tidak sinkron.

## Workflow
1. Definisikan state machine job (queued, processing, success, failed, retrying).
2. Terapkan idempotency key pada operasi kritikal.
3. Bedakan retryable vs non-retryable failure.
4. Simpan alasan gagal terakhir (`last_error`) yang jelas.
5. Sediakan requeue manual + dead-letter handling sederhana.

## Checklist Minimum
- [ ] Setiap job punya ID unik stabil.
- [ ] Update status atomik.
- [ ] Ada batas retry + backoff.
- [ ] Ada endpoint/halaman monitoring status.
- [ ] Ada jejak audit waktu submit/proses/selesai.

## Anti-Pattern
- Retry tanpa batas.
- Mengandalkan status hanya di memori proses.
