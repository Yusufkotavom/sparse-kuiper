from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.core.config import settings, PROJECTS_DIR, VIDEO_PROJECTS_DIR, UPLOAD_QUEUE_DIR
from backend.core.logger import logger
import os

app = FastAPI(
    title=settings.app_name,
    description="Backend API for Nomad Hub — KDP Studio, Video Gen, Social Media Publisher",
    version="2.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure projects directory exists and serve it as static files
if not PROJECTS_DIR.exists():
    os.makedirs(PROJECTS_DIR, exist_ok=True)
if not VIDEO_PROJECTS_DIR.exists():
    os.makedirs(VIDEO_PROJECTS_DIR, exist_ok=True)
if not UPLOAD_QUEUE_DIR.exists():
    os.makedirs(UPLOAD_QUEUE_DIR, exist_ok=True)

app.mount("/api/v1/projects_static", StaticFiles(directory=str(PROJECTS_DIR)), name="projects_static")
app.mount("/api/v1/video_projects_static", StaticFiles(directory=str(VIDEO_PROJECTS_DIR)), name="video_projects_static")
app.mount("/api/v1/upload_queue_static", StaticFiles(directory=str(UPLOAD_QUEUE_DIR)), name="upload_queue_static")


@app.on_event("startup")
async def startup_event():
    """Initialize database tables and run idempotent migration bootstrap."""
    logger.info("[Startup] Initializing database...")
    from backend.core.database import create_all_tables, SessionLocal
    from backend.core.migrations import run_migrations
    from backend.services.publisher_dispatcher import start_publisher_dispatcher

    # 1. Create tables (idempotent — safe to run every time)
    create_all_tables()
    logger.info("[Startup] Database tables ready.")

    # 2. Run idempotent migration bootstrap for legacy JSON/SQLite sources
    db = SessionLocal()
    try:
        run_migrations(db)
    finally:
        db.close()

    start_publisher_dispatcher()


@app.on_event("shutdown")
async def shutdown_event():
    from backend.services.publisher_dispatcher import stop_publisher_dispatcher

    stop_publisher_dispatcher()


@app.get("/")
def read_root():
    logger.info("Health check endpoint accessed")
    return {"status": "ok", "app": settings.app_name, "version": "2.0.0"}


# Include App Routers
from backend.routers import kdp
from backend.routers import settings as app_settings
from backend.routers import video
from backend.routers import publisher
from backend.routers import accounts
from backend.routers import logs
from backend.routers import scraper
from backend.routers import scraper_projects
from backend.routers import services
from backend.routers import looper
from backend.routers import concat
from backend.routers import drive
from backend.routers import backup
from backend.routers import internal_playwright
from backend.routers import generation
from backend.routers import realtime

app.include_router(kdp.router)
app.include_router(app_settings.router)
app.include_router(video.router)
app.include_router(publisher.router, prefix="/api/v1/publisher", tags=["publisher"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["accounts"])
app.include_router(logs.router, prefix="/api/v1/logs", tags=["logs"])
app.include_router(scraper.router, prefix="/api/v1/scraper", tags=["scraper"])
app.include_router(scraper_projects.router, prefix="/api/v1/scraper-projects", tags=["scraper_projects"])
app.include_router(services.router)
app.include_router(looper.router)
app.include_router(concat.router)
app.include_router(drive.router)
app.include_router(backup.router)
app.include_router(internal_playwright.router)
app.include_router(generation.router)
app.include_router(realtime.router)
