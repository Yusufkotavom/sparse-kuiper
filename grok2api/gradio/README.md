# Grok2API Gradio UI

UI web sederhana untuk fitur utama Grok2API, dengan fokus utama pada image generation.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Pastikan Grok2API server sudah running:
```bash
cd ../grok2api
# jalankan server sesuai dokumentasi
```

3. (Optional) Set environment variables:
```bash
export GROK2API_BASE_URL="http://localhost:8000"
export GROK2API_API_KEY="your-api-key"  # jika diperlukan
```

## Run

```bash
python app.py
```

Buka browser di: http://localhost:7860

## Features

- Tab `Image First` dengan gallery hasil batch
- Generate banyak gambar sekaligus via `POST /v1/images/generations`
- Dukungan `grok-imagine-1.0-fast` via `POST /v1/chat/completions`
- Recent image gallery dari folder `outputs/`
- Chat sederhana ke `POST /v1/chat/completions`
- Generate video ke `POST /v1/videos`
- Cek model yang tersedia dari `GET /v1/models`
- Base URL dan API key bisa diubah langsung dari UI
- Semua output media disimpan di folder `outputs/`

## Usage

### Chat
1. Pilih model chat
2. Isi system prompt jika perlu
3. Isi user prompt
4. Klik `Kirim Chat`

### Image Generation
1. Buka tab `Image First`
2. Pilih model image
3. Masukkan prompt
4. Pilih size
5. Atur `Jumlah Hasil` untuk mode standard, atau `Fast Rounds` untuk mode fast
6. Klik `Generate Image Set`
7. Hasil akan tampil sebagai gallery dan otomatis masuk ke `Recent Images`

Catatan:
- `grok-imagine-1.0` cocok untuk banyak variasi sekaligus
- `grok-imagine-1.0-fast` dipanggil lewat jalur chat/completions yang sesuai backend

### Chat
1. Pilih model chat
2. Isi system prompt jika perlu
3. Isi user prompt
4. Klik `Kirim Chat`

### Video Generation
1. Masukkan prompt
2. (Opsional) isi `Image URL` untuk image-to-video
3. Pilih size, durasi, dan resolution
4. Klik `Generate Video`
5. Tunggu hasil muncul

### Models
1. Klik `Refresh Models`
2. UI akan menampilkan daftar model dari server API
