# Operasi Docker (Backend)

Catatan: Jalankan perintah dari root repo sparse-kuiper. Semua perintah 1-baris, siap copy-paste.

## Build / Recreate Backend

```
docker compose -f docker-compose.backend.yml build backend
docker compose -f docker-compose.backend.yml up -d --force-recreate backend
docker logs --tail=200 sparse-kuiper-backend-local
```

## Start / Stop / Restart

```
docker compose -f docker-compose.backend.yml up -d backend
docker compose -f docker-compose.backend.yml stop backend
docker compose -f docker-compose.backend.yml restart backend
```

## Down (hentikan & remove container)

```
docker compose -f docker-compose.backend.yml down
```

## Cek Status

```
docker compose -f docker-compose.backend.yml ps
docker ps
```

## Logs

```
docker logs --tail=200 sparse-kuiper-backend-local
docker logs -f sparse-kuiper-backend-local
```

## Copy File ke Container (tanpa volume)

```
docker cp nomad_hub.db sparse-kuiper-backend-local:/app/nomad_hub.db
docker cp config/google_secrets/client_secrets.json sparse-kuiper-backend-local:/app/config/google_secrets/client_secrets.json
docker cp config/youtube_secrets/client_secrets.json sparse-kuiper-backend-local:/app/config/youtube_secrets/client_secrets.json
```

## Remove Container / Image

```
docker rm -f sparse-kuiper-backend-local
docker images
docker rmi <IMAGE_ID>
```

## Prune (bersih-bersih)

```
docker system prune -a
```

## Pull Git (atasi perubahan lokal)

```
git stash push -u -m "local changes"
git pull --rebase origin master
git stash pop
```

## Hentikan Tracking DB di Git

```
cp nomad_hub.db nomad_hub.backup.db
git rm --cached nomad_hub.db
git commit -m "stop tracking nomad_hub.db"
```

## Rebuild Wajib (setelah ubah kode backend)

```
docker compose -f docker-compose.backend.yml build backend
docker compose -f docker-compose.backend.yml up -d --force-recreate backend
docker logs --tail=200 sparse-kuiper-backend-local
```

## Recreate Saja (ubah data/volume saja)

```
docker compose -f docker-compose.backend.yml up -d --force-recreate backend
```

## Volumes Penting (pastikan sudah terpasang)

```
./nomad_hub.db:/app/nomad_hub.db
./config/google_secrets:/app/config/google_secrets
./config/youtube_secrets:/app/config/youtube_secrets
./client_secrets.json:/app/client_secrets.json
```

## Compose File yang Dipakai

- `docker compose up ...` tanpa `-f` akan memakai `docker-compose.yml`.
- `docker compose -f docker-compose.backend.yml up ...` akan memakai `docker-compose.backend.yml`.
- Cek file aktif:

```
docker compose config --services
docker compose config | sed -n '/backend:/,/^[^ ]/p'
```

## Setup Supabase PostgreSQL di Docker

- Di service `backend`, gunakan `DATABASE_URL` dari env:

```
environment:
  - PYTHONUNBUFFERED=1
  - APP_ENV=local
  - DATABASE_URL=${DATABASE_URL:-sqlite:///./nomad_hub.db}
```

- Simpan `DATABASE_URL` Supabase di file `.env` server (folder yang sama dengan compose):

```
DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:6543/postgres?sslmode=require
```

- Recreate backend:

```
docker compose up -d --build --force-recreate backend
```

## Verifikasi Koneksi DB di Container

```
docker compose exec backend python -c "from backend.core.database import DATABASE_URL; print(DATABASE_URL)"
docker compose exec backend python -c "from sqlalchemy import text; from backend.core.database import engine; c=engine.connect(); print(c.execute(text('select 1')).scalar()); c.close()"
docker compose exec backend python -c "from backend.core.database import engine; print(engine.url.drivername, engine.url.host, engine.url.port)"
```

Expected:
- `DATABASE_URL` menampilkan `postgresql+psycopg://...`
- `select 1` output `1`
- driver `postgresql+psycopg`

## Jika Backend Restart Terus

Gejala umum:
- `docker compose ps` status `Restarting`
- log berisi `ModuleNotFoundError: No module named 'backend'`

Penyebab umum:
- volume backend salah mount ke `/app` sehingga package path tertimpa.

Perbaikan mount yang benar:

```
volumes:
  - ./backend:/app/backend
  - ./backend/kuiper.db:/app/backend/kuiper.db
  - ./backend/config:/app/backend/config
  - ./backend/logs:/app/backend/logs
  - ./projects:/app/projects
  - ./video_projects:/app/video_projects
  - ./upload_queue:/app/upload_queue
```

Lalu jalankan:

```
docker compose down
docker compose up -d --build backend
docker compose logs --tail=120 backend
```

## Sync `chrome_profile` dan Persistensi

- Sinkron dari lokal ke server bisa pakai `sync_chrome_profile_server.bat`.
- Warning `tar: Ignoring unknown extended header keyword 'SCHILY.fflags'` aman.
- Data `chrome_profile` tidak hilang saat rebuild/recreate container selama volume ini tetap ada:

```
./chrome_profile:/app/chrome_profile
```

- Cek profile sesudah rebuild:

```
ls -lah chrome_profile | head
docker compose exec backend ls -lah /app/chrome_profile | head
```
