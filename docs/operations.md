# Operations (Daily & Bulk Features)

## Daily Maintenance
- Update dan rebuild backend:
```bash
cd /opt/sparse-kuiper
git pull
docker compose -f docker-compose.backend.yml up -d --build backend
```
- Cek status:
```bash
docker ps
docker logs --tail=200 sparse-kuiper-backend-local
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```
- Production: tutup ingress port 8001; gunakan HTTPS via Cloudflare/Nginx (443).

## Bulk Actions di Project Manager
Di halaman `/project-manager/[project]`:
- Enable Select: aktifkan mode pilih banyak
- Select All / Clear / Exit
- Delete Selected: hapus banyak file (raw/final)
- Move to Final / Archive: pindahkan stage
- Add to Queue (video): tambahkan ke Publisher Queue dengan metadata
- Generate Metadata (video): AI generate title/description/tags, simpan ke asset

## Publisher Bulk Config (Queue)
API menyediakan operasi bulk update konfigurasi queue:
- Pengaturan platform, akun mapping, jadwal awal, posting per hari, gap waktu, privasi YouTube, dll.

## Cookies YouTube (yt-dlp)
Untuk konten yang perlu login:
- Export cookies Netscape dari Incognito
- Simpan di `/opt/sparse-kuiper/global_profiles/youtube_cookies.txt`
- Jalankan dalam container:
```bash
docker exec -it sparse-kuiper-backend-local yt-dlp \
  --cookies /app/global_profiles/youtube_cookies.txt \
  "https://www.youtube.com/watch?v=<ID>"
```
Shorts otomatis dinormalisasi ke format watch.

## Monitoring
- Daftarkan https://api.<domain>/ dan /docs ke UptimeRobot atau Cloudflare Health Checks.
- Backup `nomad_hub.db` berkala ke `/opt/backups`.
