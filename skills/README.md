# Skills

## Workflow Wajib Project

Semua PR wajib memenuhi checklist berikut sebelum merge:

- [ ] UI Planning Review selesai
- [ ] Contract API/Schema disetujui
- [ ] Regression test old/new path ada
- [ ] Observability minimum (request-id/log/metric) aktif
- [ ] E2E/screenshot untuk perubahan UI
- [ ] Staged rollout plan tersedia

## Track khusus: DB Migration ke Supabase

- [ ] DATABASE_URL backend sudah mengarah ke Supabase Postgres pooled.
- [ ] Seed migrasi legacy JSON/SQLite bisa rerun tanpa duplikasi data.
- [ ] Event outbox `realtime_events` aktif untuk stream prioritas.
- [ ] Endpoint observability realtime (`/health`, `/events`) tervalidasi.
- [ ] UI kritikal pakai snapshot API + incremental realtime + fallback refetch.
