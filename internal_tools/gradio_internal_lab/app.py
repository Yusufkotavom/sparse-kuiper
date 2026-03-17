import os
import sys
import json
import time
import subprocess
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import gradio as gr
import requests


def _get_api_base() -> str:
    return (os.getenv("INTERNAL_API_BASE") or "http://localhost:8000").rstrip("/")


def _post_json(api_base: str, path: str, payload: Dict[str, Any], timeout_s: int = 120) -> Tuple[bool, Dict[str, Any]]:
    url = f"{api_base}{path}"
    try:
        resp = requests.post(url, json=payload, timeout=timeout_s)
    except Exception as e:
        return False, {"error": str(e), "url": url}
    if resp.status_code >= 400:
        try:
            data = resp.json()
        except Exception:
            data = {"detail": resp.text}
        return False, {"error": data.get("detail") or resp.text, "status_code": resp.status_code, "url": url}
    try:
        return True, resp.json()
    except Exception:
        return True, {"raw": resp.text}


def _run_grok(api_base: str, project_name: str, use_reference: bool, headless_mode: bool) -> str:
    project = (project_name or "").strip()
    if not project:
        return json.dumps({"ok": False, "error": "project_name wajib diisi"}, indent=2)
    ok, data = _post_json(
        api_base,
        "/api/v1/internal/playwright/grok/run-project",
        {"project_name": project, "use_reference": bool(use_reference), "headless_mode": bool(headless_mode)},
        timeout_s=60,
    )
    return json.dumps({"ok": ok, "result": data}, indent=2)


def _run_whisk(api_base: str, project_name: str) -> str:
    project = (project_name or "").strip()
    if not project:
        return json.dumps({"ok": False, "error": "project_name wajib diisi"}, indent=2)
    ok, data = _post_json(
        api_base,
        "/api/v1/internal/playwright/whisk/run-project",
        {"project_name": project},
        timeout_s=60,
    )
    return json.dumps({"ok": ok, "result": data}, indent=2)


def _probe(api_base: str, url: str, selectors_text: str, wait_ms: int, headless: bool) -> str:
    u = (url or "").strip()
    if not u:
        return json.dumps({"ok": False, "error": "url wajib diisi"}, indent=2)
    selectors = [s.strip() for s in (selectors_text or "").splitlines() if s.strip()]
    ok, data = _post_json(
        api_base,
        "/api/v1/internal/playwright/probe",
        {"url": u, "selectors": selectors, "wait_ms": int(wait_ms), "headless": bool(headless)},
        timeout_s=180,
    )
    return json.dumps({"ok": ok, "result": data}, indent=2)


@dataclass
class CodegenState:
    pid: Optional[int] = None
    started_at: Optional[float] = None
    cmd: Optional[List[str]] = None


def _launch_codegen(url: str, browser: str) -> Tuple[CodegenState, str]:
    u = (url or "").strip()
    if not u:
        return CodegenState(), json.dumps({"ok": False, "error": "url wajib diisi"}, indent=2)

    b = (browser or "chromium").strip().lower()
    if b not in ("chromium", "firefox", "webkit"):
        b = "chromium"

    cmd = [sys.executable, "-m", "playwright", "codegen", "--browser", b, u]
    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NEW_CONSOLE
    try:
        proc = subprocess.Popen(cmd, creationflags=creationflags)
    except Exception as e:
        return CodegenState(), json.dumps({"ok": False, "error": str(e), "cmd": cmd}, indent=2)

    state = CodegenState(pid=proc.pid, started_at=time.time(), cmd=cmd)
    return state, json.dumps({"ok": True, "pid": proc.pid, "cmd": cmd}, indent=2)


def _stop_process(pid: int) -> str:
    try:
        import psutil
    except Exception:
        psutil = None

    if not pid or pid <= 0:
        return json.dumps({"ok": False, "error": "pid tidak valid"}, indent=2)

    if psutil is None:
        return json.dumps({"ok": False, "error": "psutil tidak tersedia untuk stop process"}, indent=2)

    try:
        p = psutil.Process(pid)
    except Exception as e:
        return json.dumps({"ok": False, "error": str(e), "pid": pid}, indent=2)

    try:
        p.terminate()
        try:
            p.wait(timeout=3)
            return json.dumps({"ok": True, "pid": pid, "status": "terminated"}, indent=2)
        except Exception:
            p.kill()
            return json.dumps({"ok": True, "pid": pid, "status": "killed"}, indent=2)
    except Exception as e:
        return json.dumps({"ok": False, "error": str(e), "pid": pid}, indent=2)


def _playground_run(
    url: str,
    headless: bool,
    wait_ms: int,
    selectors_text: str,
    do_screenshot: bool,
    do_trace: bool,
    pwdebug: bool,
) -> Tuple[str, Optional[str]]:
    u = (url or "").strip()
    if not u:
        return json.dumps({"ok": False, "error": "url wajib diisi"}, indent=2), None

    selectors = [s.strip() for s in (selectors_text or "").splitlines() if s.strip()]
    if pwdebug and not headless:
        os.environ["PWDEBUG"] = "1"
    else:
        os.environ.pop("PWDEBUG", None)

    def _run_sync() -> Tuple[Dict[str, Any], Optional[str]]:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=bool(headless))
            context = browser.new_context()
            trace_path = None
            if do_trace:
                trace_path = os.path.abspath(os.path.join(os.getcwd(), f"pw_trace_{int(time.time())}.zip"))
                context.tracing.start(screenshots=True, snapshots=True, sources=True)
            page = context.new_page()
            page.goto(u, wait_until="domcontentloaded", timeout=120000)
            if wait_ms and wait_ms > 0:
                page.wait_for_timeout(int(wait_ms))
            result: Dict[str, Any] = {"status": "ok", "title": page.title(), "url": page.url, "selectors": []}
            for sel in selectors[:50]:
                loc = page.locator(sel)
                count = loc.count()
                visible = False
                if count > 0:
                    try:
                        visible = loc.first.is_visible()
                    except Exception:
                        visible = False
                result["selectors"].append({"selector": sel, "count": count, "visible": visible})
            screenshot_path = None
            if do_screenshot:
                screenshot_path = os.path.abspath(os.path.join(os.getcwd(), f"pw_shot_{int(time.time())}.png"))
                page.screenshot(path=screenshot_path, full_page=True)
            if trace_path:
                context.tracing.stop(path=trace_path)
                result["trace_zip"] = trace_path
            context.close()
            browser.close()
        return result, screenshot_path

    try:
        data, shot = _run_sync()
        return json.dumps({"ok": True, "result": data}, indent=2), shot
    except Exception as e:
        return json.dumps({"ok": False, "error": str(e)}, indent=2), None


def build_ui() -> gr.Blocks:
    codegen_state = gr.State(CodegenState())

    with gr.Blocks(title="Internal Playwright Lab (Gradio)") as demo:
        gr.Markdown("# Internal Playwright Lab (Gradio)")
        gr.Markdown("UI mandiri untuk trigger Grok/Whisk, probe selector, codegen, dan playground debug.")

        with gr.Row():
            with gr.Column(scale=3):
                api_base = gr.Textbox(label="FastAPI Base URL", value=_get_api_base())
            with gr.Column(scale=2):
                gr.Markdown("Contoh: `http://localhost:8000`")

        with gr.Tabs():
            with gr.Tab("Grok"):
                grok_project = gr.Textbox(label="Nama project video", placeholder="misal: my-video-project")
                grok_use_ref = gr.Checkbox(label="Use reference image antar prompt", value=True)
                grok_headless = gr.Checkbox(label="Headless mode", value=True)
                grok_btn = gr.Button("Run Grok (backend)", variant="primary")
                grok_out = gr.Code(label="Output", language="json")
                grok_btn.click(_run_grok, inputs=[api_base, grok_project, grok_use_ref, grok_headless], outputs=[grok_out])

            with gr.Tab("Whisk"):
                whisk_project = gr.Textbox(label="Nama project KDP", placeholder="misal: my-kdp-project")
                whisk_btn = gr.Button("Run Whisk (backend)", variant="primary")
                whisk_out = gr.Code(label="Output", language="json")
                whisk_btn.click(_run_whisk, inputs=[api_base, whisk_project], outputs=[whisk_out])

            with gr.Tab("Probe (via backend)"):
                probe_url = gr.Textbox(label="URL target", value="https://x.com/i/grok")
                probe_selectors = gr.Textbox(
                    label="Selector (1 baris 1 selector)",
                    value="textarea\nbutton:has-text('Download')",
                    lines=8,
                )
                probe_wait = gr.Number(label="wait_ms", value=1200, precision=0)
                probe_headless = gr.Checkbox(label="Headless mode", value=True)
                probe_btn = gr.Button("Jalankan Probe", variant="primary")
                probe_out = gr.Code(label="Output", language="json")
                probe_btn.click(_probe, inputs=[api_base, probe_url, probe_selectors, probe_wait, probe_headless], outputs=[probe_out])

            with gr.Tab("Codegen"):
                cg_url = gr.Textbox(label="URL untuk codegen", value="https://grok.com/imagine")
                cg_browser = gr.Dropdown(choices=["chromium", "firefox", "webkit"], value="chromium", label="Browser")
                with gr.Row():
                    cg_btn = gr.Button("Buka Playwright codegen", variant="primary")
                    cg_stop_btn = gr.Button("Stop codegen terakhir", variant="stop")
                cg_out = gr.Code(label="Output", language="json")

                def _cg_launch(url: str, browser: str):
                    st, out = _launch_codegen(url, browser)
                    return st, out

                def _cg_stop(st: CodegenState):
                    if not st or not st.pid:
                        return CodegenState(), json.dumps({"ok": False, "error": "belum ada codegen yang dijalankan"}, indent=2)
                    out = _stop_process(int(st.pid))
                    return CodegenState(), out

                cg_btn.click(_cg_launch, inputs=[cg_url, cg_browser], outputs=[codegen_state, cg_out])
                cg_stop_btn.click(_cg_stop, inputs=[codegen_state], outputs=[codegen_state, cg_out])

            with gr.Tab("Playground (lokal)"):
                pg_url = gr.Textbox(label="URL target", value="https://grok.com/imagine")
                with gr.Row():
                    pg_headless = gr.Checkbox(label="Headless mode", value=True)
                    pg_pwdebug = gr.Checkbox(label="Inspector (PWDEBUG=1, butuh headless=false)", value=False)
                pg_wait = gr.Number(label="wait_ms", value=1200, precision=0)
                pg_selectors = gr.Textbox(label="Selector (1 baris 1 selector)", value="textarea", lines=8)
                with gr.Row():
                    pg_screenshot = gr.Checkbox(label="Ambil screenshot", value=True)
                    pg_trace = gr.Checkbox(label="Simpan trace.zip", value=False)
                pg_btn = gr.Button("Run playground", variant="primary")
                pg_out = gr.Code(label="Output", language="json")
                pg_img = gr.Image(label="Screenshot", type="filepath")
                pg_btn.click(
                    _playground_run,
                    inputs=[pg_url, pg_headless, pg_wait, pg_selectors, pg_screenshot, pg_trace, pg_pwdebug],
                    outputs=[pg_out, pg_img],
                )

    return demo


def main():
    demo = build_ui()
    host = os.getenv("GRADIO_HOST") or "127.0.0.1"
    port = int(os.getenv("GRADIO_PORT") or "7860")
    demo.launch(server_name=host, server_port=port)


if __name__ == "__main__":
    main()
