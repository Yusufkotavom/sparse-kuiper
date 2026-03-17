# SSH Notes

## Tujuan
Panduan koneksi SSH aman untuk maintenance server deployment.

## Praktik Aman
- Gunakan key-based auth, hindari password login.
- Nonaktifkan root login jika memungkinkan.
- Batasi IP yang boleh akses port SSH.
- Simpan private key di lokasi aman, jangan commit ke repo.

## Contoh koneksi
```bash
ssh -i /path/to/private_key user@server_ip
```

## Setelah login
- Cek service backend/frontend.
- Cek log aplikasi dan resource (disk, memory, process).
- Jangan ubah file kredensial tanpa backup.
