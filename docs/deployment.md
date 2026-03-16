# Nomad Hub — VPS Deployment Guide

Panduan ini mencakup deployment di Linux VPS (Ubuntu 22.04 recommended).

---

## Prerequisites

- VPS Ubuntu 22.04 LTS (min. 2 CPU, 4 GB RAM)
- Domain name (opsional tapi disarankan)
- SSH access

---

## Oracle Deployment Quick Start (Compose v2 + Cloudflare Tunnel)

1) Buat VM Oracle
- Image: Ubuntu 22.04 (x86_64)
- Spec: 2 OCPU, 8GB RAM, disk 60GB (atau lebih)
- Attach SSH key dan catat Public IP

2) Networking
- Security List/NSG: buka 22 (SSH), 443 (HTTPS)
- Tambahkan ingress TCP 8001 untuk testing awal (opsional, tutup di production)
- Buat Internet Gateway dan route `0.0.0.0/0` ke IGW

3) SSH dan dasar sistem
```bash
ssh -i /path/to/key.pem ubuntu@<PUBLIC_IP>
sudo apt update && sudo apt -y upgrade
```

4) Install Docker + Compose v2
```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-compose-plugin docker-buildx-plugin
sudo systemctl enable --now docker
```

5) Clone repo dan siapkan runtime
```bash
sudo mkdir -p /opt/sparse-kuiper && sudo chown -R $USER:$USER /opt/sparse-kuiper
cd /opt/sparse-kuiper
git clone <REPO_URL> .
mkdir -p data projects video_projects upload_queue chrome_profile global_profiles
printf '{}' > config.json
```

6) Jalankan backend (Compose v2)
```bash
docker compose -f docker-compose.backend.yml up -d --build backend
docker ps
curl http://127.0.0.1:8001/
```

7) Aktifkan HTTPS via Cloudflare Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create nomad-hub
cloudflared tunnel route dns nomad-hub api.<domain>
sudo tee /etc/cloudflared/config.yml >/dev/null <<'EOF'
tunnel: nomad-hub
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL-UUID>.json
ingress:
  - hostname: api.<domain>
    service: http://localhost:8001
  - service: http_status:404
EOF
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

8) Frontend
- Vercel env: `NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1`
- Redeploy

---

## 1. Server Setup

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+
sudo apt install python3.11 python3.11-venv python3-pip -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Install nginx
sudo apt install nginx -y

# Playwright system dependencies
sudo apt install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libasound2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2
```

---

## 2. Clone & Configure

```bash
sudo mkdir -p /var/www/nomad-hub
sudo chown $USER:$USER /var/www/nomad-hub

git clone <your-repo-url> /var/www/nomad-hub
cd /var/www/nomad-hub

# Setup environment
cp .env.example .env
nano .env  # Set GROQ_API_KEY dan variabel lainnya
```

---

## 3. Backend Setup

```bash
cd /var/www/nomad-hub

python3.11 -m venv venv
source venv/bin/activate

pip install -r backend/requirements.txt

# Install Playwright browser
playwright install chromium
playwright install-deps
```

---

## 4. Frontend Build

```bash
cd /var/www/nomad-hub/frontend

# Set API URL ke domain/IP server
echo "NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1" > .env.local

npm install
npm run build
```

---

## 5. Process Management (systemd)

### Backend Service

```bash
sudo nano /etc/systemd/system/nomad-backend.service
```

```ini
[Unit]
Description=Nomad Hub FastAPI Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/nomad-hub
ExecStart=/var/www/nomad-hub/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3
EnvironmentFile=/var/www/nomad-hub/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable nomad-backend
sudo systemctl start nomad-backend
```

### Frontend Service (Next.js)

```bash
sudo nano /etc/systemd/system/nomad-frontend.service
```

```ini
[Unit]
Description=Nomad Hub Next.js Frontend
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/nomad-hub/frontend
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable nomad-frontend
sudo systemctl start nomad-frontend
```

---

## 6. Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/nomad-hub
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 500M;  # Allow large video uploads
    }

    # Swagger docs
    location /docs {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nomad-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. SSL Certificate (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

---

## 8. Local Network Access (LAN)

Untuk akses dari perangkat lain di jaringan lokal (HP, tablet, PC lain) **tanpa VPS**:

```bash
# Backend — bind ke semua network interface
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Frontend — expose ke LAN
# Set API URL ke IP komputer server di frontend/.env.local:
# NEXT_PUBLIC_API_URL=http://192.168.1.X:8000/api/v1

cd frontend && npm run dev -- --hostname 0.0.0.0 --port 3000
```

- Cek IP komputer server: `ipconfig` (Windows) atau `ip addr` (Linux)
- Akses dari device lain: `http://192.168.1.X:3000`

> ⚠️ **Penting:** Jika `NEXT_PUBLIC_API_URL` tidak di-set, frontend akan call `http://localhost:8000` — yang pada device lain menunjuk ke device itu sendiri, bukan server. Selalu set env variable ini.

### Ngrok (akses dari internet untuk demo/testing)
Jika ingin akses dari luar jaringan (internet) untuk demo cepat, paling stabil gunakan reverse proxy satu pintu lalu expose lewat ngrok.

Pola yang aman dan simpel:
- Frontend dan Backend tetap jalan lokal (port 3000 dan 8000)
- Reverse proxy di port 80 mengarahkan:
  - `/api/v1/*` → `http://127.0.0.1:8000/api/v1/*`
  - `/` → `http://127.0.0.1:3000/`
- Ngrok expose port 80 (jadi cukup satu URL publik)

Contoh cepat (ngrok):
```bash
ngrok http 80
```

Jika Anda pakai reverse proxy satu origin seperti ini, set frontend:
- `NEXT_PUBLIC_API_URL=/api/v1`

### Cloudflare Tunnel (recommended, URL stabil tanpa buka port)
Jika backend jalan di PC sendiri tapi frontend di Vercel, backend harus punya URL publik. Cara yang stabil adalah Cloudflare Tunnel (tanpa port-forwarding router).

Contoh setup untuk domain: `piiblog.net` dan subdomain API: `api.piiblog.net`.

1) Login Cloudflare (Windows):
```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel login
```

2) Buat named tunnel:
```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel create nomad-hub
```

3) Buat subdomain DNS yang mengarah ke tunnel:
```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel route dns nomad-hub api.piiblog.net
```

4) Jalankan backend lokal:
```bash
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

5) Jalankan tunnel (pakai config):
```yml
# cloudflared.yml (contoh)
tunnel: nomad-hub
credentials-file: C:\Users\<USER>\.cloudflared\<TUNNEL-UUID>.json

ingress:
  - hostname: api.piiblog.net
    service: http://localhost:8000
  - service: http_status:404
```

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config .\cloudflared.yml run nomad-hub
```

6) Test:
- `https://api.piiblog.net/docs`
- `https://api.piiblog.net/api/v1/settings/system-prompts`

7) Set Vercel Environment:
- `NEXT_PUBLIC_API_URL=https://api.piiblog.net/api/v1`

---

## 9. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key untuk AI generation |
| `DATABASE_URL` | ❌ | Default: `sqlite:///./nomad_hub.db` |
| `YOUTUBE_CLIENT_SECRETS_FILE` | ❌ | Path ke `client_secrets.json` untuk OAuth YouTube |
| `FACEBOOK_APP_ID` | ❌ | Facebook App ID |
| `FACEBOOK_APP_SECRET` | ❌ | Facebook App Secret |
| `FACEBOOK_REDIRECT_URI` | ❌ | OAuth callback URL untuk Facebook |

---

## 10. Database Backup

```bash
# Backup SQLite database
cp /var/www/nomad-hub/nomad_hub.db /backups/nomad_hub_$(date +%Y%m%d).db

# Automate dengan cron (daily at 2am)
echo "0 2 * * * cp /var/www/nomad-hub/nomad_hub.db /backups/nomad_hub_\$(date +\%Y\%m\%d).db" | crontab -
```

---

## 11. Useful Commands

```bash
# Check backend status
sudo systemctl status nomad-backend

# View backend logs
sudo journalctl -u nomad-backend -f

# Restart setelah code update
sudo systemctl restart nomad-backend nomad-frontend

# Pull latest dan redeploy
cd /var/www/nomad-hub
git pull
source venv/bin/activate && pip install -r backend/requirements.txt
cd frontend && npm run build
sudo systemctl restart nomad-backend nomad-frontend
```

---

## 11.1 Daily Maintenance (Ops)

- Update code + rebuild (Compose v2):
```bash
cd /opt/sparse-kuiper
git pull
docker compose -f docker-compose.backend.yml up -d --build backend
```

- Cek status & log:
```bash
docker ps
docker logs --tail=200 sparse-kuiper-backend-local
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```

- Tutup port testing (production best-practice):
  - Hapus ingress TCP 8001 dari Security List/NSG, gunakan hanya 443 via tunnel/proxy

---

## 11.2 Troubleshooting

### Compose: KeyError 'ContainerConfig' saat recreate
Perbaikan:
```bash
docker compose -f docker-compose.backend.yml down --remove-orphans
docker rm -f sparse-kuiper-backend-local || true
docker compose -f docker-compose.backend.yml up -d --build backend
```
Jika tetap muncul pada `docker-compose` lama, upgrade ke Compose v2.

### Bind mount config.json menyebabkan crash
Jika `config.json` ter-mount sebagai folder:
```bash
rm -rf /opt/sparse-kuiper/config.json
printf '{}' > /opt/sparse-kuiper/config.json
docker compose -f docker-compose.backend.yml up -d --build backend
```

### Cloudflare Tunnel tidak tersambung
Periksa:
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
nslookup api.<domain>
curl http://127.0.0.1:8001/
```
Pastikan `ingress` mengarah ke `http://localhost:8001` dan kredensial tunnel benar.

### yt-dlp: diminta login/cookies
Gunakan cookies Netscape dan User-Agent:
```bash
docker exec -it sparse-kuiper-backend-local yt-dlp \
  --cookies /app/global_profiles/youtube_cookies.txt \
  --add-headers "User-Agent: Mozilla/5.0 ..." \
  "https://www.youtube.com/watch?v=<ID>"
```
Untuk Shorts, backend otomatis normalisasi ke `watch?v=<ID>`. Jika perlu client mweb/PO Token, gunakan parameter di endpoint `/api/v1/scraper/download`.

---

## 12. Storage Requirements

| Data | Estimated Size |
|---|---|
| Downloaded videos (per project) | 50MB – 5GB |
| upload_queue/ | Up to 10GB+ |
| KDP projects (images + PDF) | 100MB – 2GB |
| nomad_hub.db | < 10MB |

Pastikan VPS memiliki minimal **50GB** disk space.
