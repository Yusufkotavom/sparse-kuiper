# SSH & Server Setup (Oracle Ubuntu)

## SSH Login
```bash
ssh -i "/path/to/ssh-key.pem" ubuntu@<PUBLIC_IP>
```
Contoh:
```bash
ssh -i "C:\Users\admin\Desktop\New folder (4)\sparse-kuiper\ssh-key-2026-03-16 (3).key" ubuntu@168.110.210.101
```

## Update Sistem
```bash
sudo apt update
sudo apt -y upgrade
sudo reboot
```

## Install Docker (repo Ubuntu, cepat)
Jalankan per baris (jangan digabung):
```bash
sudo rm -f /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker.io docker-compose git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
exit
```
Masuk lagi SSH, verifikasi:
```bash
docker --version
docker-compose --version
```

Tips: paste satu baris → Enter → tunggu selesai → baru lanjut ke baris berikutnya.
