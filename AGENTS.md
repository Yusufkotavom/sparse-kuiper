# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` contains the Next.js (App Router) UI:
  - `frontend/src/app/` contains route pages (`<route>/page.tsx`)
  - `frontend/src/components/` contains shared UI components (Sidebar, wrappers, atoms, shadcn-style `ui/` primitives)
  - `frontend/src/lib/api.ts` centralizes all frontend API calls and uses `NEXT_PUBLIC_API_URL`
- `backend/` contains the FastAPI server:
  - `backend/main.py` registers routers, mounts static dirs, and runs startup DB init/migrations
  - `backend/routers/` contains API route modules (accounts, kdp, video, publisher, scraper, logs, settings)
  - `backend/models/` contains SQLAlchemy models
  - `backend/services/` contains background workers and platform uploaders (Playwright, yt-dlp, Groq helpers)
- `docs/` contains project documentation (overview, deployment, architecture, API reference).
- Runtime/data directories at repo root (usually gitignored): `projects/`, `video_projects/`, `upload_queue/`, `data/`, `chrome_profile/`, `global_profiles/`.

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

## Testing Guidelines
- No unit-test runner is configured yet.
- For smoke checks:
  - `frontend`: run `npm run build` (this will typecheck)
  - `backend`: start `uvicorn` and verify `/docs` loads
- If you add tests, document the command and keep naming consistent.

## Commit & Pull Request Guidelines
- Recent history follows a Conventional Commits pattern: `type(scope): message` (e.g., `chore(build): update config`). Keep it consistent.
- Write concise, present-tense commit messages and keep commits scoped to one change.
- PRs should include: a brief description, linked issues (if any), testing performed (commands), and screenshots for UI changes.

## Security & Configuration Tips
- Avoid committing secrets and local data:
  - `config.json` (may contain `groq_api_key`)
  - `config/youtube_secrets/*` (OAuth client secrets)
  - `data/`, `chrome_profile/`, `global_profiles/`, `*.db`
- For production deployments, do not expose the API publicly without authentication/rate limits.
