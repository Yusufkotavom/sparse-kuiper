# CLAUDE.md — AI Coding Instructions for Nomad Hub

> This file gives AI assistant (Claude, Gemini, etc.) all the context needed to work effectively on this project. Read this before making any changes.

## Project Overview

**Nomad Hub** is a full-stack automation dashboard built with:
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Lucide React
- **Backend**: FastAPI + Python 3.11+
- **Database**: SQLite via SQLAlchemy (default); configurable to PostgreSQL via `DATABASE_URL`
- **AI**: Groq API (`llama-3.3-70b-versatile` model)
- **Automation**: Playwright (headless browser for TikTok)

## Monorepo Structure

```
sparse-kuiper/                # Project root
├── frontend/                 # Next.js app (App Router)
│   └── src/
│       ├── app/              # Pages (one directory = one route)
│       │   ├── kdp/          # KDP Studio (image generation + PDF)
│       │   ├── video/        # Video Gen (Grok AI automation)
│       │   ├── queue-manager/ # Media Library & Queue
│       │   ├── publisher/    # Social Media Publisher
│       │   ├── accounts/     # Social Media Accounts Management
│       │   └── settings/     # App Settings & Templates
│       ├── components/       # Shared UI components
│       └── lib/api.ts        # ALL frontend API calls (single source of truth)
│
├── backend/                  # FastAPI app
│   ├── main.py               # App entry point, DB init, CORS, static mounts
│   ├── core/
│   │   ├── config.py         # Settings, env vars, path constants
│   │   ├── database.py       # SQLAlchemy engine, SessionLocal, get_db
│   │   ├── migrations.py     # Auto-seeder from legacy JSON files
│   │   └── logger.py         # Centralized logger
│   ├── models/               # SQLAlchemy ORM models
│   │   ├── account.py        # Account table
│   │   ├── upload_queue.py   # UploadQueueItem table
│   │   └── project_config.py # ProjectConfig table
│   ├── routers/              # FastAPI routers (one file = one feature area)
│   │   ├── accounts.py       # /api/v1/accounts/*
│   │   ├── publisher.py      # /api/v1/publisher/*
│   │   ├── video.py          # /api/v1/video/*
│   │   ├── kdp.py            # /api/v1/kdp/*
│   │   └── settings.py       # /api/v1/settings/*
│   └── services/             # Business logic & automation bots
│       ├── bot_worker.py     # KDP image bot (Playwright)
│       ├── video_worker.py   # Video gen bot (Playwright, Grok)
│       ├── tiktok_upload_worker.py
│       ├── uploaders/tiktok_uploader.py
│       ├── playwright_login.py
│       └── pdf_engine.py
│
├── video_projects/           # User video projects (not in git)
├── projects/                 # User KDP projects (not in git)
├── upload_queue/             # Publisher queue folder (not in git)
├── data/                     # Accounts + session data (not in git)
├── nomad_hub.db              # SQLite database (auto-created, not in git)
└── config.json               # Legacy config — still used for Groq API key
```

## Key Conventions

### Backend: Adding a New Router
1. Create `backend/routers/my_feature.py`
2. Define `router = APIRouter()`
3. Add endpoints with `@router.get/post/delete(...)`
4. Use `db: Session = Depends(get_db)` for DB access
5. Register in `backend/main.py`

### Backend: Using the Database (SQLAlchemy)
```python
from fastapi import Depends
from sqlalchemy.orm import Session
from backend.core.database import get_db
from backend.models.account import Account

@router.get("/")
async def get_accounts(db: Session = Depends(get_db)):
    return db.query(Account).all()
```

### Backend: Adding a New Model
1. Create `backend/models/my_model.py` with a class inheriting `Base`
2. Import it in `backend/models/__init__.py`
3. `create_all_tables()` picks it up automatically on next startup

### Frontend: Adding an API Call
All API calls live in `frontend/src/lib/api.ts`. The `fetchApi` utility prepends `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).

### Frontend: Page Structure
- Each page file lives in `frontend/src/app/<route>/page.tsx`
- Must include `"use client"` at the top
- Import icons from `lucide-react`
- Use `@/components/ui/button`, `@/components/ui/card` for UI

## Environment Variables
| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | — | Required: Groq AI API key |
| `DATABASE_URL` | `sqlite:///./nomad_hub.db` | SQLite or PostgreSQL URL |
| `ENVIRONMENT` | `development` | App environment |

## Running Locally

```bash
# Backend
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Backend: `http://localhost:8000` · Frontend: `http://localhost:3000`

## Common Pitfalls

1. **Don't use `status.json` or `accounts.json`** — Legacy. All data is now in SQLite via SQLAlchemy.
2. **Always use `Depends(get_db)`** — Never instantiate `SessionLocal()` directly in a route handler.
3. **Background tasks need their own DB session** — Always create a new `SessionLocal()` inside background task functions.
4. **Static files** — `video_projects/` → `/api/v1/video_projects_static/`, `upload_queue/` → `/api/v1/upload_queue_static/`
5. **Playwright bots run as subprocesses** — Not as coroutines, to avoid blocking the FastAPI event loop.
