# Nomad Hub — VPS Deployment Guide

Lihat versi lengkap di root/docs. Ringkasan langkah cepat (Compose v2 + Cloudflare Tunnel):

## Quick Start
1) VM: Ubuntu 22.04, 2 OCPU, 8GB RAM, disk 60GB
2) Networking: buka 22/443, IGW + route 0.0.0.0/0, 8001 untuk testing
3) SSH:
```bash
ssh -i /path/to/key.pem ubuntu@<PUBLIC_IP>
sudo apt update && sudo apt -y upgrade
```
4) Docker + Compose v2:
```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-compose-plugin docker-buildx-plugin
sudo systemctl enable --now docker
```
5) Repo + runtime:
```bash
sudo mkdir -p /opt/sparse-kuiper && sudo chown -R $USER:$USER /opt/sparse-kuiper
cd /opt/sparse-kuiper
git clone <REPO_URL> .
mkdir -p data projects video_projects upload_queue chrome_profile global_profiles
printf '{}' > config.json
```
6) Backend:
```bash
docker compose -f docker-compose.backend.yml up -d --build backend
docker ps
curl http://127.0.0.1:8001/
```
7) Cloudflare Tunnel:
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
8) Frontend (Vercel):
- NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1
- Redeploy
