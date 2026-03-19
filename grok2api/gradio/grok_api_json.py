import json
from typing import Any, Dict, Tuple, List, Optional

import requests
import gradio as gr


def _join_url(base_url: str, path: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        base = "http://localhost:8000"
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def fetch_openapi(base_url: str) -> Tuple[Dict[str, Any], List[str]]:
    url = _join_url(base_url, "/openapi.json")
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    spec = r.json()

    items: List[str] = []
    paths = spec.get("paths", {}) or {}
    for path, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        for method, meta in methods.items():
            if method.lower() not in {"get", "post", "put", "patch", "delete", "options", "head"}:
                continue
            summary = ""
            if isinstance(meta, dict):
                summary = meta.get("summary") or meta.get("operationId") or ""
            label = f"{method.upper()} {path}"
            if summary:
                label += f" — {summary}"
            items.append(label)

    items.sort()
    return spec, items


def _parse_json(text: str, default: Any) -> Any:
    raw = (text or "").strip()
    if not raw:
        return default
    return json.loads(raw)


def call_api(
    base_url: str,
    route_label: str,
    bearer_token: str,
    query_json: str,
    headers_json: str,
    body_json: str,
    timeout_sec: int,
) -> Tuple[str, str, str]:
    if not route_label or " " not in route_label:
        return "Error", "", "Pilih route dulu (klik Fetch OpenAPI)."

    first = route_label.split("—", 1)[0].strip()
    method, path = first.split(" ", 1)
    method = method.strip().upper()
    path = path.strip()

    query: Dict[str, Any] = _parse_json(query_json, {})
    headers: Dict[str, str] = _parse_json(headers_json, {})
    body: Any = _parse_json(body_json, None)

    token = (bearer_token or "").strip()
    if token and "authorization" not in {k.lower() for k in headers.keys()}:
        if token.lower().startswith("bearer "):
            headers["Authorization"] = token
        else:
            headers["Authorization"] = f"Bearer {token}"

    url = _join_url(base_url, path)

    try:
        r = requests.request(
            method=method,
            url=url,
            params=query if isinstance(query, dict) else None,
            headers=headers if isinstance(headers, dict) else None,
            json=body,
            timeout=max(1, int(timeout_sec or 30)),
        )
    except Exception as e:
        return "Request Error", "", str(e)

    status_line = f"{r.status_code} {r.reason}"
    resp_headers = json.dumps(dict(r.headers), indent=2, ensure_ascii=False)

    content_type = (r.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            resp_body = json.dumps(r.json(), indent=2, ensure_ascii=False)
        except Exception:
            resp_body = r.text
    else:
        resp_body = r.text

    return status_line, resp_headers, resp_body


def preset_chat() -> Tuple[str, str, str, str]:
    return (
        "POST /v1/chat/completions",
        "{}",
        "{}",
        json.dumps(
            {
                "model": "grok-2",
                "messages": [{"role": "user", "content": "Halo"}],
                "stream": False,
            },
            indent=2,
            ensure_ascii=False,
        ),
    )


def preset_models() -> Tuple[str, str, str, str]:
    return ("GET /v1/models", "{}", "{}", "")


with gr.Blocks(title="Grok2API API Caller") as demo:
    spec_state = gr.State({})

    gr.Markdown("Grok2API API Caller (ambil daftar endpoint dari /openapi.json)")

    with gr.Row():
        base_url = gr.Textbox(label="Base URL", value="http://localhost:8000")
        bearer = gr.Textbox(label="Bearer Token (opsional)", placeholder="contoh: <app.api_key> atau <app.app_key>")

    with gr.Row():
        fetch_btn = gr.Button("Fetch OpenAPI", variant="primary")
        route = gr.Dropdown(label="Route", choices=[], allow_custom_value=True)

    with gr.Row():
        preset_chat_btn = gr.Button("Preset: Chat Completions")
        preset_models_btn = gr.Button("Preset: Models")

    with gr.Row():
        query_json = gr.Textbox(label="Query (JSON)", value="{}", lines=4)
        headers_json = gr.Textbox(label="Headers (JSON)", value="{}", lines=4)

    body_json = gr.Textbox(label="Body JSON (untuk POST)", value="", lines=12)

    with gr.Row():
        timeout_sec = gr.Number(label="Timeout (detik)", value=30, precision=0)
        call_btn = gr.Button("Call API", variant="primary")

    status_out = gr.Textbox(label="Status")
    headers_out = gr.Textbox(label="Response Headers", lines=10)
    body_out = gr.Textbox(label="Response Body", lines=18)

    def _on_fetch(base: str):
        spec, items = fetch_openapi(base)
        return spec, gr.update(choices=items, value=(items[0] if items else None))

    fetch_btn.click(_on_fetch, inputs=[base_url], outputs=[spec_state, route])

    preset_chat_btn.click(
        preset_chat,
        inputs=[],
        outputs=[route, query_json, headers_json, body_json],
    )
    preset_models_btn.click(
        preset_models,
        inputs=[],
        outputs=[route, query_json, headers_json, body_json],
    )

    call_btn.click(
        call_api,
        inputs=[base_url, route, bearer, query_json, headers_json, body_json, timeout_sec],
        outputs=[status_out, headers_out, body_out],
    )

demo.launch(server_name="127.0.0.1", server_port=7860)