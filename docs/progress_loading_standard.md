# Progress Loading Standard

Dokumen ini mendefinisikan standar UX loading/progress agar konsisten.

## Prinsip
- Selalu tampilkan state `idle/loading/success/error`.
- Untuk proses panjang (upload/generate/download), gunakan progress polling.
- Jangan block seluruh halaman jika hanya satu panel yang loading.

## Rekomendasi UI
- Action button: disable saat request berjalan.
- Table/list: tampilkan skeleton pada fetch awal.
- Job async: tampilkan badge status + timestamp update terakhir.
- Error: tampilkan pesan user-friendly + detail singkat untuk debugging.

## Endpoint yang umumnya async
- `/api/v1/publisher/upload/*`
- `/api/v1/video/projects/*/generate`
- `/api/v1/kdp/projects/*/generate`
- `/api/v1/scraper/download-batch`
- `/api/v1/looper/run`
