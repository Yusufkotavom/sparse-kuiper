168.110.210.101

ssh -i "C:\Users\admin\Desktop\New folder (4)\sparse-kuiper\ssh-key-2026-03-16 (3).key" ubuntu@168.110.210.101
sudo apt update
sudo apt -y upgrade
sudo reboot



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