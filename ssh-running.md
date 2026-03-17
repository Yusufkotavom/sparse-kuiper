168.110.210.101

Panduan ini untuk:
- Setup server Ubuntu untuk menjalankan project `sparse-kuiper` via Docker
- Setup remote desktop (XFCE + noVNC) untuk login Playwright di server (tanpa sync profile dari local)
- Login Grok/Whisk/YouTube dsb sehingga session tersimpan di server: `data/sessions/<account_id>/chrome_profile`

Repo di server (berdasarkan setup saat ini):
- `/opt/sparse-kuiper`

## A) Login SSH dari Windows
Di Windows (PowerShell/CMD), jalankan:

```bash
ssh -i "C:\Users\admin\Desktop\New folder (4)\sparse-kuiper\ssh-key-2026-03-16 (3).key" ubuntu@168.110.210.101
```

Kalau `Connection timed out`:
- pastikan IP benar
- pastikan server sudah selesai reboot (tunggu 1–2 menit)
- pastikan port 22 tidak diblokir ISP/firewall

## B) Update OS (sekali saja)
Di server:

```bash
sudo apt update
sudo apt -y upgrade
```

Kalau ada prompt "Which services should be restarted?", pilih "none of the above" lalu lanjut.

Setelah upgrade kernel, reboot:

```bash
sudo reboot
```

Setelah reboot, SSH masuk lagi.



Paste blok ini persis , tunggu selesai, baru lanjut baris berikutnya:

```
sudo rm -f /etc/apt/sources.list.d/docker.list
```
```
sudo apt update
```
```
sudo apt install -y docker.io docker-compose git
```
```
sudo systemctl enable --now docker
```
```
sudo usermod -aG docker $USER
```
```
exit
```
Setelah SSH masuk lagi, cek:

```
docker --version
docker-compose --version
```
Kalau masih nyampur, biasanya karena terminal kamu “nangkep” paste terlalu cepat atau ada karakter aneh. Trik aman: paste 1 baris → Enter → tunggu selesai → baru paste baris berikutnya .

## C) Jalankan project via Docker
Di server:

```bash
cd /opt/sparse-kuiper
docker compose up -d --build
docker compose ps
```

Penting (Playwright sessions):
- Backend container menggunakan `SESSIONS_DIR=/app/data/sessions`
- Session login yang kamu buat di server akan ada di `/opt/sparse-kuiper/data/sessions`
- Jadi `docker-compose.yml` harus memetakan folder `./data` ke `/app/data`:

```yml
services:
  backend:
    volumes:
      - ./data:/app/data
```

Setelah edit compose, apply:

```bash
cd /opt/sparse-kuiper
docker compose up -d --build backend
```

Catatan port default (berdasarkan docker-compose.yml):
- Backend: `8001 -> 8000` (FastAPI)
- Frontend: `3000 -> 3000` (Next.js)

## D) Setup Remote Desktop (XFCE + noVNC) untuk login Playwright
Tujuan: kamu bisa buka desktop server lewat browser laptop, lalu login di browser server supaya session tersimpan langsung di server (tanpa upload profile).

### D1) Install paket GUI + VNC + noVNC
Di server:

```bash
sudo apt update
sudo apt install -y xfce4 xfce4-goodies dbus-x11 xvfb x11vnc novnc websockify xterm
```

### D2) Start headless display :1 + XFCE + VNC + noVNC
Di server (boleh copy-paste per baris):

```bash
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 2>/dev/null || true
nohup Xvfb :1 -screen 0 1366x768x24 -ac -noreset > /tmp/xvfb.log 2>&1 &
nohup bash -lc 'DISPLAY=:1 startxfce4' > /tmp/xfce.log 2>&1 &
nohup x11vnc -display :1 -rfbport 5901 -localhost -forever -shared -nopw > /tmp/x11vnc.log 2>&1 &
nohup websockify --web=/usr/share/novnc/ 127.0.0.1:6080 localhost:5901 > /tmp/novnc.log 2>&1 &
```

Validasi port:

```bash
ss -lntp | egrep ':5901|:6080' || true
```

Jika muncul error:
- `Server is already active for display 1`: hapus lock `/tmp/.X1-lock` dan `/tmp/.X11-unix/X1`, lalu start lagi
- Log bisa dicek: `tail -n 50 /tmp/xvfb.log /tmp/xfce.log /tmp/x11vnc.log /tmp/novnc.log`

### D3) Akses noVNC dari Windows pakai SSH tunnel
Di Windows (PowerShell/CMD), buka koneksi SSH tunnel:

```bash
ssh -i "C:\Users\admin\Desktop\New folder (4)\sparse-kuiper\ssh-key-2026-03-16 (3).key" -L 6080:127.0.0.1:6080 ubuntu@168.110.210.101
```

Lalu buka browser di Windows:
- `http://localhost:6080/vnc.html`

Catatan:
- noVNC akan jalan selama SSH tunnel masih terbuka

## E) Install Google Chrome di server (dibutuhkan oleh script Playwright login)
Script `backend/services/playwright_login.py` memakai `channel="chrome"` sehingga butuh Google Chrome di `/opt/google/chrome/chrome`.

Di server:

```bash
sudo apt update
sudo apt install -y wget gnupg
wget -qO- https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-linux.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install -y google-chrome-stable
/opt/google/chrome/chrome --version
```

## F) Install Playwright (host venv khusus login)
Karena backend jalan di Docker, kita pakai venv host untuk menjalankan login browser (session tersimpan di host).

Di server:

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip

cd /opt/sparse-kuiper
python3 -m venv .venv-login
source .venv-login/bin/activate
pip install --upgrade pip
pip install playwright
playwright install chromium
```

## G) Login akun (session tersimpan di server)
Pastikan noVNC sudah bisa diakses dan desktop :1 sudah jalan.

Di server:

```bash
cd /opt/sparse-kuiper
source .venv-login/bin/activate
DISPLAY=:1 python3 backend/services/playwright_login.py grok_default grok /opt/sparse-kuiper/data/sessions true
```

Setelah browser terbuka di noVNC:
- login ke Grok
- setelah sukses, tutup browser (close window)

## H) Verifikasi session tersimpan
Di server:

```bash
ls -la /opt/sparse-kuiper/data/sessions/grok_default/chrome_profile | head
```

Jika folder `chrome_profile` ada dan terisi, session sudah tersimpan.
