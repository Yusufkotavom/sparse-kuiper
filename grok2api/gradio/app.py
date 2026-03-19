import base64
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import gradio as gr
import requests


DEFAULT_BASE_URL = os.getenv("GROK2API_BASE_URL", "http://localhost:8000").rstrip("/")
DEFAULT_API_KEY = os.getenv("GROK2API_API_KEY", "").strip()

OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

IMAGE_SIZE_CHOICES = [
    ("Square 1024x1024", "1024x1024"),
    ("Landscape 1792x1024", "1792x1024"),
    ("Portrait 1024x1792", "1024x1792"),
    ("Wide 1280x720", "1280x720"),
    ("Tall 720x1280", "720x1280"),
]

VIDEO_SIZE_CHOICES = [
    ("Landscape 1792x1024", "1792x1024"),
    ("Portrait 1024x1792", "1024x1792"),
    ("Square 1024x1024", "1024x1024"),
    ("Wide 1280x720", "1280x720"),
    ("Tall 720x1280", "720x1280"),
]

CHAT_MODEL_CHOICES = [
    "grok-4",
    "grok-4-thinking",
    "grok-4.1-fast",
    "grok-4.1-thinking",
    "grok-3",
    "grok-3-thinking",
]

IMAGE_PROMPT_SUGGESTIONS = [
    "street fashion editorial, rainy neon alley, cinematic lighting",
    "brutalist tea house on a cliff, morning fog, architectural photography",
    "retro sci-fi motorcycle concept, studio background, product render",
    "indonesian tropical resort poster, warm sunlight, graphic design style",
]


def _now_label() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _append_log(existing: str, message: str) -> str:
    line = f"[{_now_label()}] {message}".strip()
    if not existing.strip():
        return line
    return f"{line}\n{existing}".strip()


def _make_headers(api_key: str, content_type: str = "application/json") -> dict[str, str]:
    headers = {"Content-Type": content_type}
    if api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    return headers


def _safe_name(prefix: str, suffix: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    return OUTPUT_DIR / f"{prefix}-{stamp}.{suffix}"


def _error_text(response: requests.Response) -> str:
    body = response.text.strip()
    if not body:
        return f"HTTP {response.status_code}"
    return f"HTTP {response.status_code}: {body[:2000]}"


def _extract_chat_text(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if not choices:
        return json.dumps(data, indent=2, ensure_ascii=False)

    message = (choices[0] or {}).get("message") or {}
    content = message.get("content")

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text" and item.get("text"):
                chunks.append(str(item["text"]))
        if chunks:
            return "\n\n".join(chunks)

    if message.get("tool_calls"):
        return json.dumps(message["tool_calls"], indent=2, ensure_ascii=False)

    return json.dumps(message or data, indent=2, ensure_ascii=False)


def _extract_image_urls_from_markdown(text: str) -> list[str]:
    if not isinstance(text, str):
        return []
    return re.findall(r"!\[[^\]]*\]\(([^)\s]+)\)", text)


def _extract_video_reference_id(value: str) -> str:
    if not isinstance(value, str):
        return ""
    candidate = value.strip()
    if not candidate:
        return ""
    match = re.search(r"/generated/([0-9a-fA-F-]{32,36})/", candidate)
    if match:
        return match.group(1)
    match = re.search(r"\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b", candidate)
    if match:
        return match.group(1)
    return candidate


def _save_b64_image(raw_b64: str) -> str | None:
    if not raw_b64:
        return None
    out_path = _safe_name("image", "png")
    out_path.write_bytes(base64.b64decode(raw_b64))
    return str(out_path)


def _save_image_from_url(url: str, timeout: int = 180) -> str | None:
    if not url:
        return None
    out_path = _safe_name("image", "png")
    response = requests.get(url, timeout=timeout)
    response.raise_for_status()
    out_path.write_bytes(response.content)
    return str(out_path)


def _list_recent_images(limit: int = 24) -> list[str]:
    files = sorted(
        OUTPUT_DIR.glob("image-*.*"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    return [str(path) for path in files[:limit]]


def _generate_images_standard(
    *,
    base_url: str,
    api_key: str,
    prompt: str,
    size: str,
    image_count: int,
) -> list[str]:
    payload = {
        "model": "grok-imagine-1.0",
        "prompt": prompt,
        "n": image_count,
        "size": size,
        "response_format": "b64_json",
        "stream": False,
    }

    response = requests.post(
        f"{base_url.rstrip('/')}/v1/images/generations",
        headers=_make_headers(api_key),
        json=payload,
        timeout=240,
    )
    if not response.ok:
        raise RuntimeError(_error_text(response))

    data = response.json()
    paths: list[str] = []
    for item in data.get("data", []):
        if not isinstance(item, dict):
            continue
        saved = _save_b64_image(str(item.get("b64_json", "")))
        if saved:
            paths.append(saved)
    return paths


def _generate_images_fast(
    *,
    base_url: str,
    api_key: str,
    prompt: str,
    rounds: int,
) -> list[str]:
    results: list[str] = []
    for _ in range(max(1, rounds)):
        payload = {
            "model": "grok-imagine-1.0-fast",
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }

        response = requests.post(
            f"{base_url.rstrip('/')}/v1/chat/completions",
            headers=_make_headers(api_key),
            json=payload,
            timeout=240,
        )
        if not response.ok:
            raise RuntimeError(_error_text(response))

        data = response.json()
        content = _extract_chat_text(data)
        urls = _extract_image_urls_from_markdown(content)
        if not urls:
            raise RuntimeError(f"Respons fast image tidak berisi markdown image: {content[:1000]}")
        for url in urls:
            saved = _save_image_from_url(url, timeout=240)
            if saved:
                results.append(saved)
    return results


def chat_ui(
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    system_prompt: str,
    reasoning_effort: str,
    temperature: float,
) -> tuple[list[dict[str, str]], str, str]:
    if not prompt.strip():
        msg = "Chat gagal: prompt tidak boleh kosong."
        return [], msg, _append_log("", msg)

    messages: list[dict[str, Any]] = []
    if system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt.strip()})
    messages.append({"role": "user", "content": prompt.strip()})

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "temperature": temperature,
    }
    if reasoning_effort != "default":
        payload["reasoning_effort"] = reasoning_effort

    try:
        response = requests.post(
            f"{base_url.rstrip('/')}/v1/chat/completions",
            headers=_make_headers(api_key),
            json=payload,
            timeout=180,
        )
        if not response.ok:
            raise RuntimeError(_error_text(response))

        data = response.json()
        answer = _extract_chat_text(data)
        history = [
            {"role": "user", "content": prompt.strip()},
            {"role": "assistant", "content": answer},
        ]
        status = "Chat request berhasil."
        log = _append_log(
            "",
            f"Chat OK | model={model} | endpoint=/v1/chat/completions",
        )
        return history, status, log
    except Exception as exc:
        status = f"Error chat: {exc}"
        log = _append_log(
            "",
            f"Chat ERROR | model={model} | endpoint=/v1/chat/completions | {exc}",
        )
        return [], status, log


def generate_image_ui(
    base_url: str,
    api_key: str,
    prompt: str,
    size: str,
    image_model: str,
    image_count: int,
    fast_rounds: int,
) -> tuple[list[str], list[str], str, str]:
    if not prompt.strip():
        recent = _list_recent_images()
        msg = "Image gagal: prompt tidak boleh kosong."
        return [], recent, msg, _append_log("", msg)

    try:
        if image_model == "grok-imagine-1.0-fast":
            paths = _generate_images_fast(
                base_url=base_url,
                api_key=api_key,
                prompt=prompt.strip(),
                rounds=fast_rounds,
            )
            note = (
                "Mode fast memakai /v1/chat/completions. "
                "Jumlah gambar mengikuti hasil server per ronde."
            )
        else:
            paths = _generate_images_standard(
                base_url=base_url,
                api_key=api_key,
                prompt=prompt.strip(),
                size=size,
                image_count=image_count,
            )
            note = f"Mode standard memakai /v1/images/generations dengan n={image_count}."

        if not paths:
            raise RuntimeError("Tidak ada gambar yang berhasil disimpan.")

        recent = _list_recent_images()
        status = f"Berhasil membuat {len(paths)} gambar. {note}"
        log = _append_log(
            "",
            f"Image OK | model={image_model} | size={size} | hasil={len(paths)}",
        )
        return paths, recent, status, log
    except Exception as exc:
        recent = _list_recent_images()
        status = f"Error image: {exc}"
        log = _append_log(
            "",
            f"Image ERROR | model={image_model} | size={size} | {exc}",
        )
        return [], recent, status, log


def refresh_recent_images_ui() -> tuple[list[str], str, str]:
    recent = _list_recent_images()
    status = f"Memuat {len(recent)} gambar terbaru."
    log = _append_log("", f"Recent gallery refresh | total={len(recent)}")
    return recent, status, log


def use_image_prompt(prompt: str) -> str:
    return prompt


def generate_video_ui(
    base_url: str,
    api_key: str,
    prompt: str,
    image_url: str,
    size: str,
    seconds: int,
    quality: str,
) -> tuple[str | None, str, str, str]:
    if not prompt.strip():
        msg = "Video gagal: prompt tidak boleh kosong."
        return None, "", msg, _append_log("", msg)

    out_path = _safe_name("video", "mp4")
    payload: dict[str, Any] = {
        "model": "grok-imagine-1.0-video",
        "prompt": prompt.strip(),
        "size": size,
        "seconds": int(seconds),
        "quality": quality,
    }
    if image_url.strip():
        payload["image_reference"] = {"image_url": image_url.strip()}

    try:
        response = requests.post(
            f"{base_url.rstrip('/')}/v1/videos",
            headers=_make_headers(api_key),
            json=payload,
            timeout=900,
        )
        if not response.ok:
            raise RuntimeError(_error_text(response))

        data = response.json()
        video_url = data.get("url", "")
        if not video_url:
            raise RuntimeError(f"Respons video tidak berisi url: {data}")

        video_response = requests.get(video_url, timeout=900)
        video_response.raise_for_status()
        out_path.write_bytes(video_response.content)

        status = f"Video berhasil dibuat dan disimpan ke {out_path}."
        log = _append_log(
            "",
            f"Video OK | size={size} | seconds={seconds} | quality={quality} | url={video_url}",
        )
        return str(out_path), video_url, status, log
    except Exception as exc:
        status = f"Error video: {exc}"
        log = _append_log(
            "",
            f"Video ERROR | size={size} | seconds={seconds} | quality={quality} | {exc}",
        )
        return None, "", status, log


def extend_video_ui(
    base_url: str,
    api_key: str,
    source_video: str,
    prompt: str,
    start_time: float,
    ratio: str,
    length: int,
    resolution: str,
) -> tuple[str | None, str, str, str, str]:
    if not prompt.strip():
        msg = "Video edit gagal: prompt tidak boleh kosong."
        return None, "", "", msg, _append_log("", msg)

    reference_id = _extract_video_reference_id(source_video)
    if not reference_id:
        msg = "Video edit gagal: source video / reference_id tidak valid."
        return None, "", "", msg, _append_log("", msg)

    out_path = _safe_name("video-edit", "mp4")
    payload = {
        "prompt": prompt.strip(),
        "reference_id": reference_id,
        "start_time": float(start_time),
        "ratio": ratio,
        "length": int(length),
        "resolution": resolution,
    }

    try:
        response = requests.post(
            f"{base_url.rstrip('/')}/v1/video/extend",
            headers=_make_headers(api_key),
            json=payload,
            timeout=900,
        )
        if not response.ok:
            raise RuntimeError(_error_text(response))

        data = response.json()
        video_url = data.get("url", "")
        if not video_url:
            raise RuntimeError(f"Respons extend video tidak berisi url: {data}")

        video_response = requests.get(video_url, timeout=900)
        video_response.raise_for_status()
        out_path.write_bytes(video_response.content)

        status = f"Video edit/extend berhasil dibuat dan disimpan ke {out_path}."
        log = _append_log(
            "",
            f"Video EDIT OK | ref={reference_id} | start={start_time} | ratio={ratio} | length={length} | resolution={resolution}",
        )
        return str(out_path), video_url, reference_id, status, log
    except Exception as exc:
        status = f"Error video edit: {exc}"
        log = _append_log(
            "",
            f"Video EDIT ERROR | ref={reference_id} | start={start_time} | ratio={ratio} | length={length} | resolution={resolution} | {exc}",
        )
        return None, "", reference_id, status, log


def fetch_models_ui(base_url: str, api_key: str) -> tuple[list[list[str]], str, str]:
    try:
        response = requests.get(
            f"{base_url.rstrip('/')}/v1/models",
            headers=_make_headers(api_key),
            timeout=60,
        )
        if not response.ok:
            raise RuntimeError(_error_text(response))

        data = response.json()
        rows = []
        for item in data.get("data", []):
            rows.append(
                [
                    str(item.get("id", "")),
                    str(item.get("owned_by", "")),
                    str(item.get("object", "")),
                ]
            )
        status = f"Berhasil memuat {len(rows)} model."
        log = _append_log("", f"Models OK | total={len(rows)} | endpoint=/v1/models")
        return rows, status, log
    except Exception as exc:
        status = f"Error models: {exc}"
        log = _append_log("", f"Models ERROR | endpoint=/v1/models | {exc}")
        return [], status, log


custom_css = """
.gradio-container {
    max-width: 1440px !important;
}
.hero {
    padding: 20px 24px;
    border: 1px solid #d9e3ef;
    border-radius: 18px;
    background: linear-gradient(135deg, #f6fbff 0%, #fff8ef 100%);
    margin-bottom: 12px;
}
.hero h1 {
    margin: 0 0 8px 0;
    font-size: 2rem;
}
.hero p {
    margin: 0;
    color: #425466;
}
.hint {
    padding: 12px 14px;
    border-radius: 14px;
    background: #f7fafc;
    border: 1px solid #e2e8f0;
}
footer {
    display: none !important;
}
"""


with gr.Blocks(title="Grok2API Focus UI", theme=gr.themes.Soft(), css=custom_css) as demo:
    gr.HTML(
        """
        <div class="hero">
            <h1>Grok2API Focus UI</h1>
            <p>Fokus utama sekarang di image generation: cepat, banyak hasil, dan enak discroll sebagai gallery.</p>
        </div>
        """
    )

    with gr.Accordion("Koneksi API", open=True):
        with gr.Row():
            base_url_input = gr.Textbox(
                label="Base URL",
                value=DEFAULT_BASE_URL,
                placeholder="http://localhost:8000",
            )
            api_key_input = gr.Textbox(
                label="API Key",
                value=DEFAULT_API_KEY,
                type="password",
                placeholder="Kosongkan jika server tidak memakai API key",
            )

    with gr.Tabs():
        with gr.Tab("Image First"):
            gr.HTML(
                """
                <div class="hint">
                    Gunakan <b>grok-imagine-1.0</b> jika ingin banyak variasi sekaligus.
                    Gunakan <b>grok-imagine-1.0-fast</b> jika ingin pola generate cepat ala chat/completions.
                </div>
                """
            )
            with gr.Row():
                with gr.Column(scale=4):
                    image_model = gr.Dropdown(
                        label="Model",
                        choices=["grok-imagine-1.0", "grok-imagine-1.0-fast"],
                        value="grok-imagine-1.0",
                    )
                    image_prompt = gr.Textbox(
                        label="Prompt",
                        lines=6,
                        placeholder="Contoh: high-end sneaker campaign, reflective floor, hard flash photography, premium ad look",
                    )
                    with gr.Row():
                        image_size = gr.Dropdown(
                            label="Size",
                            choices=IMAGE_SIZE_CHOICES,
                            value="1024x1024",
                        )
                        image_count = gr.Slider(
                            label="Jumlah Hasil",
                            minimum=1,
                            maximum=8,
                            value=4,
                            step=1,
                        )
                    fast_rounds = gr.Slider(
                        label="Fast Rounds",
                        minimum=1,
                        maximum=6,
                        value=3,
                        step=1,
                        info="Khusus mode fast. UI akan meminta beberapa ronde untuk mengumpulkan lebih banyak hasil.",
                    )
                    generate_image_btn = gr.Button("Generate Image Set", variant="primary")
                    gr.Examples(
                        examples=[[prompt] for prompt in IMAGE_PROMPT_SUGGESTIONS],
                        inputs=image_prompt,
                        label="Prompt cepat",
                    )
                with gr.Column(scale=6):
                    image_gallery = gr.Gallery(
                        label="Hasil Batch Sekarang",
                        columns=3,
                        rows=2,
                        height=540,
                        object_fit="cover",
                    )
                    image_status = gr.Textbox(label="Status", interactive=False)
                    image_log = gr.Textbox(label="Log", lines=7, interactive=False)

            with gr.Row():
                refresh_recent_btn = gr.Button("Refresh Recent Gallery")
            recent_gallery = gr.Gallery(
                value=_list_recent_images(),
                label="Recent Images",
                columns=6,
                rows=2,
                height=280,
                object_fit="cover",
            )
            recent_status = gr.Textbox(
                value="Recent gallery dimuat dari folder outputs.",
                label="Recent Status",
                interactive=False,
            )

            generate_image_btn.click(
                fn=generate_image_ui,
                inputs=[
                    base_url_input,
                    api_key_input,
                    image_prompt,
                    image_size,
                    image_model,
                    image_count,
                    fast_rounds,
                ],
                outputs=[image_gallery, recent_gallery, image_status, image_log],
            ).then(
                fn=lambda current: "Recent gallery diperbarui setelah generate.\n" + current if current else "Recent gallery diperbarui setelah generate.",
                inputs=[recent_status],
                outputs=recent_status,
            )

            refresh_recent_btn.click(
                fn=refresh_recent_images_ui,
                outputs=[recent_gallery, recent_status, image_log],
            )

        with gr.Tab("Chat"):
            with gr.Row():
                with gr.Column(scale=4):
                    chat_model = gr.Dropdown(
                        label="Model",
                        choices=CHAT_MODEL_CHOICES,
                        value="grok-4",
                    )
                    chat_system = gr.Textbox(
                        label="System Prompt",
                        lines=3,
                        placeholder="Opsional. Contoh: Jawab singkat dan fokus ke implementasi.",
                    )
                    chat_prompt = gr.Textbox(
                        label="User Prompt",
                        lines=7,
                        placeholder="Tulis pertanyaan atau instruksi untuk Grok di sini.",
                    )
                    with gr.Row():
                        chat_reasoning = gr.Dropdown(
                            label="Reasoning Effort",
                            choices=["default", "none", "minimal", "low", "medium", "high", "xhigh"],
                            value="default",
                        )
                        chat_temp = gr.Slider(
                            label="Temperature",
                            minimum=0,
                            maximum=2,
                            value=0.8,
                            step=0.1,
                        )
                    chat_btn = gr.Button("Kirim Chat", variant="primary")
                with gr.Column(scale=5):
                    chat_output = gr.Chatbot(label="Hasil Chat", type="messages", height=520)
                    chat_status = gr.Textbox(label="Status", interactive=False)
                    chat_log = gr.Textbox(label="Log", lines=7, interactive=False)

            chat_btn.click(
                fn=chat_ui,
                inputs=[
                    base_url_input,
                    api_key_input,
                    chat_model,
                    chat_prompt,
                    chat_system,
                    chat_reasoning,
                    chat_temp,
                ],
                outputs=[chat_output, chat_status, chat_log],
            )

        with gr.Tab("Video"):
            with gr.Row():
                with gr.Column(scale=4):
                    video_prompt = gr.Textbox(
                        label="Prompt",
                        lines=5,
                        placeholder="Contoh: cinematic drone shot melewati kota cyberpunk saat malam.",
                    )
                    video_image_url = gr.Textbox(
                        label="Image URL",
                        lines=2,
                        placeholder="Opsional. Isi jika ingin image-to-video.",
                    )
                    video_size = gr.Radio(
                        label="Size",
                        choices=VIDEO_SIZE_CHOICES,
                        value="1792x1024",
                    )
                    with gr.Row():
                        video_seconds = gr.Dropdown(
                            label="Durasi",
                            choices=[6, 10, 15, 20, 30],
                            value=6,
                        )
                        video_quality = gr.Dropdown(
                            label="Resolution",
                            choices=[
                                ("420p (alias ke 480p)", "standard"),
                                ("480p", "standard"),
                                ("720p", "high"),
                            ],
                            value="standard",
                        )
                    video_btn = gr.Button("Generate Video", variant="primary")
                with gr.Column(scale=5):
                    video_output = gr.Video(label="Preview", height=420)
                    video_url_output = gr.Textbox(label="Video URL", interactive=False)
                    video_status = gr.Textbox(label="Status", interactive=False)
                    video_log = gr.Textbox(label="Log", lines=7, interactive=False)

            video_btn.click(
                fn=generate_video_ui,
                inputs=[
                    base_url_input,
                    api_key_input,
                    video_prompt,
                    video_image_url,
                    video_size,
                    video_seconds,
                    video_quality,
                ],
                outputs=[video_output, video_url_output, video_status, video_log],
            )

        with gr.Tab("Video Edit"):
            gr.HTML(
                """
                <div class="hint">
                    Alur ini memakai endpoint <b>/v1/video/extend</b>. Anda bisa tempel URL video hasil Grok
                    atau langsung tempel <b>reference_id</b>, lalu beri prompt perubahan seperti gaya chat edit.
                </div>
                """
            )
            with gr.Row():
                with gr.Column(scale=4):
                    edit_source = gr.Textbox(
                        label="Source Video URL / Reference ID",
                        lines=2,
                        placeholder="Tempel URL video Grok atau reference_id dari video sebelumnya",
                    )
                    edit_prompt = gr.Textbox(
                        label="Edit Prompt",
                        lines=5,
                        placeholder="Contoh: buat gerakan kamera lebih pelan, tambahkan kabut tipis, tone lebih sinematik",
                    )
                    with gr.Row():
                        edit_start = gr.Number(
                            label="Start Time (detik)",
                            value=0,
                            precision=2,
                        )
                        edit_length = gr.Dropdown(
                            label="Length",
                            choices=[6, 10, 15, 20, 30],
                            value=6,
                        )
                    with gr.Row():
                        edit_ratio = gr.Dropdown(
                            label="Ratio",
                            choices=["16:9", "9:16", "3:2", "2:3", "1:1"],
                            value="3:2",
                        )
                        edit_resolution = gr.Dropdown(
                            label="Resolution",
                            choices=["420p", "480p", "720p"],
                            value="420p",
                        )
                    edit_btn = gr.Button("Apply Video Edit", variant="primary")
                with gr.Column(scale=5):
                    edit_video_output = gr.Video(label="Edited Video", height=420)
                    edit_video_url = gr.Textbox(label="Edited Video URL", interactive=False)
                    edit_reference = gr.Textbox(label="Resolved Reference ID", interactive=False)
                    edit_status = gr.Textbox(label="Status", interactive=False)
                    edit_log = gr.Textbox(label="Log", lines=7, interactive=False)

            edit_btn.click(
                fn=extend_video_ui,
                inputs=[
                    base_url_input,
                    api_key_input,
                    edit_source,
                    edit_prompt,
                    edit_start,
                    edit_ratio,
                    edit_length,
                    edit_resolution,
                ],
                outputs=[
                    edit_video_output,
                    edit_video_url,
                    edit_reference,
                    edit_status,
                    edit_log,
                ],
            )

        with gr.Tab("Models"):
            with gr.Row():
                models_btn = gr.Button("Refresh Models", variant="primary")
            models_table = gr.Dataframe(
                headers=["id", "owned_by", "object"],
                datatype=["str", "str", "str"],
                row_count=10,
                col_count=(3, "fixed"),
                interactive=False,
                label="Model List",
            )
            models_status = gr.Textbox(label="Status", interactive=False)
            models_log = gr.Textbox(label="Log", lines=7, interactive=False)

            models_btn.click(
                fn=fetch_models_ui,
                inputs=[base_url_input, api_key_input],
                outputs=[models_table, models_status, models_log],
            )

    gr.Markdown(
        """
        Catatan:
        - Jalankan server `grok2api` lebih dulu.
        - Tab image sekarang dibuat sebagai fokus utama dengan gallery hasil dan recent outputs.
        - `grok-imagine-1.0-fast` dipanggil lewat `/v1/chat/completions`, karena itu jalur yang memang didukung backend ini.
        """
    )


if __name__ == "__main__":
    demo.launch(share=False, server_name="0.0.0.0", server_port=7860)
