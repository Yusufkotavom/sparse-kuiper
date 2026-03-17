from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import os
import sys
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from backend.core.config import BASE_DIR, VIDEO_PROJECTS_DIR, PROJECTS_DIR
from backend.services.playwright_session_guard import check_grok_session, check_whisk_session


router = APIRouter(prefix="/api/v1/internal/playwright", tags=["internal_playwright"])

def _is_local_host(host: Optional[str]) -> bool:
    if not host:
        return False
    h = host.strip().lower()
    return h in ("127.0.0.1", "::1", "localhost")


def _ensure_internal_access(request: Request):
    allow_remote = (os.getenv("ALLOW_INTERNAL_TOOLS_REMOTE") or "").strip().lower() in ("1", "true", "yes", "y", "on")
    if allow_remote:
        return
    if not _is_local_host(getattr(request.client, "host", None)):
        raise HTTPException(status_code=403, detail="Internal endpoint is restricted to localhost")


def _safe_child_dir(base: Path, name: str) -> Path:
    base_resolved = base.resolve()
    candidate = (base_resolved / name).resolve()
    if base_resolved == candidate or base_resolved not in candidate.parents:
        raise HTTPException(status_code=400, detail="Invalid project_name")
    return candidate


def _validate_http_url(url: str) -> str:
    if len(url) > 2048:
        raise HTTPException(status_code=400, detail="url is too long")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="url must use http or https")
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="url is invalid")
    return url


class GrokRunRequest(BaseModel):
    project_name: str
    use_reference: bool = True
    headless_mode: bool = True


class WhiskRunRequest(BaseModel):
    project_name: str


class ProbeRequest(BaseModel):
    url: str
    selectors: List[str] = []
    wait_ms: int = 1000
    headless: bool = True


@router.post("/grok/run-project")
async def run_grok_project(req: GrokRunRequest, request: Request):
    _ensure_internal_access(request)
    project = (req.project_name or "").strip()
    if not project:
        raise HTTPException(status_code=400, detail="project_name is required")
    project_dir = _safe_child_dir(VIDEO_PROJECTS_DIR, project)
    prompts_file = project_dir / "prompts.json"
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project not found: {project}")
    if not prompts_file.exists():
        raise HTTPException(status_code=400, detail="prompts.json not found")
    import anyio
    ok, reason = await anyio.to_thread.run_sync(check_grok_session)
    if not ok:
        raise HTTPException(status_code=409, detail=f"session expired, re-login required ({reason})")

    script = BASE_DIR / "backend" / "services" / "video_worker.py"
    if not script.exists():
        raise HTTPException(status_code=500, detail="worker script not found")
    kwargs = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    proc = subprocess.Popen(
        [
            sys.executable,
            str(script),
            project,
            str(req.use_reference).lower(),
            str(req.headless_mode).lower(),
        ],
        cwd=str(BASE_DIR),
        **kwargs,
    )
    return {"status": "queued", "pid": proc.pid, "project": project, "worker": "grok_video_worker"}


@router.post("/whisk/run-project")
async def run_whisk_project(req: WhiskRunRequest, request: Request):
    _ensure_internal_access(request)
    project = (req.project_name or "").strip()
    if not project:
        raise HTTPException(status_code=400, detail="project_name is required")
    project_dir = _safe_child_dir(PROJECTS_DIR, project)
    prompts_file = project_dir / "prompts.json"
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project not found: {project}")
    if not prompts_file.exists():
        raise HTTPException(status_code=400, detail="prompts.json not found")
    import anyio
    ok, reason = await anyio.to_thread.run_sync(check_whisk_session)
    if not ok:
        raise HTTPException(status_code=409, detail=f"session expired, re-login required ({reason})")

    script = BASE_DIR / "backend" / "services" / "bot_worker.py"
    if not script.exists():
        raise HTTPException(status_code=500, detail="worker script not found")
    kwargs = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    proc = subprocess.Popen([sys.executable, str(script), project], cwd=str(BASE_DIR), **kwargs)
    return {"status": "queued", "pid": proc.pid, "project": project, "worker": "whisk_flow_worker"}


@router.post("/probe")
async def playwright_probe(req: ProbeRequest, request: Request):
    _ensure_internal_access(request)
    url = (req.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")
    url = _validate_http_url(url)
    selectors = [s.strip() for s in (req.selectors or []) if s and s.strip()]
    if len(selectors) > 50:
        raise HTTPException(status_code=400, detail="selectors is too long")
    selectors = [s[:200] for s in selectors]
    if req.wait_ms < 0:
        raise HTTPException(status_code=400, detail="wait_ms must be >= 0")
    if req.wait_ms > 60000:
        raise HTTPException(status_code=400, detail="wait_ms is too large")

    def _probe_sync():
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=bool(req.headless))
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=120000)
            if req.wait_ms:
                page.wait_for_timeout(req.wait_ms)
            title = page.title()
            current_url = page.url
            selector_result = []
            for sel in selectors:
                loc = page.locator(sel)
                count = loc.count()
                visible = False
                if count > 0:
                    try:
                        visible = loc.first.is_visible()
                    except Exception:
                        visible = False
                selector_result.append({"selector": sel, "count": count, "visible": visible})
            browser.close()
        return {"status": "ok", "title": title, "url": current_url, "selectors": selector_result}

    try:
        import anyio

        return await anyio.to_thread.run_sync(_probe_sync)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
