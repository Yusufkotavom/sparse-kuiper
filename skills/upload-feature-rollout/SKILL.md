---
name: upload-feature-rollout
description: Blueprint implementasi fitur upload baru (validasi file, queue processing, progress status, retry) secara bertahap dan aman.
---

# Upload Feature Rollout

## Workflow
1. Definisikan tipe file, limit ukuran, dan validasi keamanan.
2. Simpan metadata upload + status proses.
3. Integrasikan dengan queue untuk proses async berat.
4. Tampilkan progress, success, failed, retry di UI.
5. Lakukan gradual rollout per user/tenant jika ada.

## Checklist Minimum
- [ ] Validasi file server-side wajib.
- [ ] Error upload bisa dipahami user.
- [ ] Retry untuk kegagalan jaringan/transient.
- [ ] Endpoint upload lama (jika ada) tetap kompatibel.
