dikerjakan di windows os

# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` contains the Next.js (App Router) UI:
  - `frontend/src/app/` contains route pages (`<route>/page.tsx`)
  - `frontend/src/components/` contains shared UI components (Sidebar, wrappers, atoms, shadcn-style `ui/` primitives)
  - `frontend/src/components/queue-builder/QueueBuilderPage.tsx` is the current main implementation for the publishing flow UI
  - `frontend/src/lib/api.ts` centralizes all frontend API calls and uses `NEXT_PUBLIC_API_URL`
- `backend/` contains the FastAPI server:
  - `backend/main.py` registers routers, mounts static dirs, and runs startup DB init/migrations
  - `backend/routers/` contains API route modules (accounts, kdp, video, publisher, scraper, logs, settings)
  - `backend/models/` contains SQLAlchemy models
  - `backend/services/` contains background workers, platform uploaders, and shared integrations/notifiers (Playwright, yt-dlp, Groq helpers, Telegram notifier, dll.)
  - `backend/services/publisher_dispatcher.py` is the current lightweight DB polling dispatcher for queued/scheduled jobs
- `docs/` contains project documentation (overview, deployment, architecture, API reference).
- `skills/` dan `frontend/skills/` berisi skill internal project yang harus diprioritaskan saat task cocok dengan skill tersebut.
- Runtime/data directories at repo root (usually gitignored): `projects/`, `video_projects/`, `upload_queue/`, `data/`, `chrome_profile/`, `global_profiles/`.

## Current Product Direction
- Tujuan utama project sekarang adalah flow yang sederhana dan user friendly:
  - `Assets -> Queue Builder -> Runs`
- Untuk tahap awal create/brief, entry point utama sekarang adalah:
  - `Ideation Hub` di `/ideation`
- `Ideation Hub` dipakai sebagai jembatan utama bersama untuk video dan image sebelum user bercabang ke prompt builder, generator, project assets, atau runs.
- Untuk tahap review/selection, entry point utama sekarang adalah:
  - `Curation Hub` di `/curation`
- `Curation Hub` dipakai sebagai jembatan review bersama sebelum user lanjut ke project assets, queue builder, runs, atau workspace review spesifik.
- Shared shell untuk hub sekarang ada di:
  - `frontend/src/components/organisms/FlowHubShell.tsx`
- Jika mengembangkan hub baru, prioritaskan reuse shell ini daripada membuat layout hub baru dari nol.
- Halaman project video sekarang juga menyediakan:
  - `Manual Upload` untuk fast-track dari file lokal ke project dan opsional langsung ke Queue Builder
- Route frontend utama untuk publishing flow adalah:
  - `/queue-builder`
- Route `/publisher` dipertahankan sebagai compatibility redirect.
- Untuk status implementasi terbaru dan ringkasan perubahan besar, baca:
  - `CHANGELOG.md`
  - `docs/queue_job_worker_recommendations.md`
  - `docs/architecture.md`
- Saat mengerjakan area queue/job, anggap Queue Builder sebagai flow utama, dan anggap endpoint/route `publisher` sebagai layer kompatibilitas yang masih hidup.

## Build, Test, and Development Commands
- Backend (from repo root):
  - `pip install -r backend/requirements.txt`
  - `playwright install chromium firefox`
  - `python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend (from `frontend/`):
  - `npm install`
  - `npm run dev` (dev server)
  - `npm run build` (typecheck + production build)
  - `npm run start` (serve production build)
  - `npm run lint`
- Quick smoke checks after feature changes:
  - frontend UI/API changes: `cd frontend && npm run build`
  - backend syntax/import safety: `python -c "import backend.main; print('ok')"`
- Convenience (Windows):
  - `setup_local.bat` sets up backend venv + frontend deps
  - `run_local.bat` runs backend + frontend in separate terminals

## Coding Style & Naming Conventions
- Follow the existing style of the edited file (formatting is not fully uniform across the repo).
- UI pages live under `frontend/src/app/<route>/page.tsx` and should include `"use client"` when using client-side hooks.
- Centralize API calls in `frontend/src/lib/api.ts` (do not scatter raw `fetch()` calls across pages).
- SHADCN-FIRST policy: UI should always use standardized shadcn/ui primitives from `frontend/src/components/ui/*` (Button, Card, Input, Textarea, Label, Dialog, dll.) before considering custom HTML.
- REUSE-FIRST policy: before adding a new component, check and reuse existing shared components in `frontend/src/components/atoms/*` and `frontend/src/components/organisms/*`.
- Layout and visual tokens should reuse the existing design tokens from `frontend/src/app/globals.css` (spacing via `--section-px/py`, `--card-p`, `--gap-base`; warna via `--background`, `--surface`, `--elevated`, `--border`, `--primary`, `--muted-foreground`, dll.) supaya tampilan konsisten di seluruh halaman.
- Komponen tingkat-atas (seperti PageHeader, StatusBadge, EmptyState, ProjectDrawer) harus dibangun di atas primitive `ui/*` tersebut, bukan langsung memakai HTML + class acak di setiap halaman.
- Prefer reusable UI patterns: `PageHeader`, `EmptyState`, `StatusBadge`, `ViewToggle`, `SegmentedTabs`, `KpiCard`, dan `ProjectDrawer` untuk menjaga konsistensi lintas halaman.
- Refer to `docs/shadcn_first_ui.md` before implementing or refactoring frontend UI.
- Untuk settings/integrations, utamakan pola existing di `frontend/src/app/settings/page.tsx` dan route settings di `backend/routers/settings.py`.
- Untuk integrasi eksternal atau notifikasi, utamakan shared service di `backend/services/*` daripada memanggil HTTP/API langsung dari banyak router.

## Skill Usage Rules
- Sebelum implementasi fitur yang tidak trivial, periksa skill yang relevan di `skills/*/SKILL.md` dan/atau `frontend/skills/*/SKILL.md`.
- Jika task menyentuh area spesifik, baca skill yang paling dekat dulu, misalnya:
  - FastAPI/backend feature: `skills/fastapi-feature-builder/SKILL.md`
  - Next.js/shadcn UI: `skills/nextjs-ui-integrator/SKILL.md`
  - Queue/publisher/job reliability: `skills/queue-workflow-reliability/SKILL.md`
  - Upload rollout: `skills/upload-feature-rollout/SKILL.md`
  - Telegram notification/integration: `skills/telegram-notification-integration/SKILL.md`
- Jangan load semua skill sekaligus. Baca secukupnya yang relevan dengan task aktif agar konteks tetap ramping.
- Jika menambah workflow reusable baru, pertimbangkan update skill terkait atau tambahkan skill baru agar pengetahuan project tidak hilang.

## Testing Guidelines
- No unit-test runner is configured yet.
- For smoke checks:
  - `frontend`: run `npm run build` (this will typecheck)
  - `backend`: start `uvicorn` and verify `/docs` loads
- Untuk perubahan settings/integrations, verifikasi endpoint settings terkait tersedia di `/docs` dan UI settings tetap bisa dibuka/build.
- If you add tests, document the command and keep naming consistent.

## Commit & Pull Request Guidelines
- Recent history follows a Conventional Commits pattern: `type(scope): message` (e.g., `chore(build): update config`). Keep it consistent.
- Write concise, present-tense commit messages and keep commits scoped to one change.
- PRs should include: a brief description, linked issues (if any), testing performed (commands), and screenshots for UI changes.

## Security & Configuration Tips
- Avoid committing secrets and local data:
  - `config.json` (may contain `groq_api_key`)
  - `config.json` juga bisa berisi `telegram.bot_token` dan `telegram.chat_id`
  - `config/youtube_secrets/*` (OAuth client secrets)
  - `data/`, `chrome_profile/`, `global_profiles/`, `*.db`
- For production deployments, do not expose the API publicly without authentication/rate limits.
- Saat menampilkan status setting sensitif di UI/API, mask token/key dan jangan kirim nilai utuh kembali ke frontend.
