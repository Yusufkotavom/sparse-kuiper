---
name: security-secret-management
description: Praktik keamanan untuk integrasi AI: secret management, kontrol akses, dan sanitasi data. Gunakan saat mengelola API key, akun provider, atau data sensitif.
---

# Security & Secret Management

## Tujuan
Menjaga integrasi AI aman sejak development sampai production.

## Workflow
1. Simpan secret hanya di env/secret manager.
2. Pisahkan key per environment (dev/staging/prod).
3. Batasi akses berdasarkan principle of least privilege.
4. Masking secret di log/error.
5. Rotasi key berkala + prosedur revoke darurat.

## Checklist Minimum
- [ ] Tidak ada API key di source code.
- [ ] Tidak ada secret di client-side bundle.
- [ ] Audit akses akun/provider terdokumentasi.
- [ ] Data sensitif diproteksi saat transit dan at rest.

## Wajib
Jika ada account rotation atau multi-account automation, log aktivitas akun harus tersedia.
