---
name: telegram-notification-integration
description: Tambah atau ubah integrasi notifikasi Telegram bot untuk FastAPI/queue/background jobs, termasuk settings UI, endpoint test, dan trigger event sukses/gagal.
---

# Telegram Notification Integration

## Gunakan saat
- Menambah Telegram bot notification ke backend FastAPI.
- Menyimpan bot token/chat ID dari halaman settings.
- Menambahkan tombol test notification dari UI.
- Menyambungkan notifikasi ke queue job, publisher, generation, atau worker async lain.

## Workflow
1. Tambahkan config runtime untuk `telegram_bot_token`, `telegram_chat_id`, dan `telegram_notifications_enabled`.
2. Simpan setting lewat router `settings` agar bisa dikelola dari UI, bukan hardcode file manual.
3. Bungkus pemanggilan Telegram API di service terpisah agar router/worker tidak menangani HTTP call langsung.
4. Kirim notifikasi hanya di titik status final atau event penting untuk menghindari spam.
5. Sediakan endpoint test message agar konfigurasi bisa diverifikasi dari App Settings.
6. Jalankan smoke check backend import dan `frontend/npm run build`.

## Checklist Minimum
- [ ] Ada endpoint `GET/PUT` untuk membaca dan menyimpan setting Telegram.
- [ ] Ada endpoint `POST` untuk kirim test message.
- [ ] Token dimask saat ditampilkan kembali ke UI.
- [ ] Worker/service memakai helper notifier bersama.
- [ ] Pesan notifikasi memuat entity, status akhir, dan error utama bila ada.

## Anti-Pattern
- Mengirim notifikasi pada setiap langkah intermediate queue.
- Memanggil Telegram API langsung dari banyak router tanpa service wrapper.
- Menampilkan bot token utuh di response settings atau UI.
- Menaruh konfigurasi hanya di localStorage frontend.
