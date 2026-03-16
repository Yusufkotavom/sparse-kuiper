"""
looper_worker.py
================
Pure-Python looper pipeline extracted from services/autocrop/app.py.
No Streamlit dependency — callable from FastAPI BackgroundTasks.

Pipeline stages:
  1. Load & validate video (ffprobe metadata)
  2. Cut start + crossfade (MoviePy)
  3. Calculate duration & loop count
  4. Render 1x loop (MoviePy → libx264)
  5. Duplicate via FFmpeg concat (instant copy)
  6. Audio fade & final trim / mux
"""

from __future__ import annotations

import math
import os
import shutil
import random
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from backend.core.logger import logger

# ─── Job Registry (in-memory) ────────────────────────────────────────────────

STAGE_LABELS = [
    "Memuat & Validasi Video",
    "Potong / Mixer / Transisi",
    "Kalkulasi Durasi",
    "Render Video (MoviePy)",
    "Finalisasi (FFmpeg)",
    "Postprocess Output",
]


@dataclass
class LooperJobStatus:
    job_id: str
    status: str = "pending"          # pending | running | done | error
    progress: int = 0               # 0–100
    stage: int = 0                  # 1–6
    stage_label: str = ""
    output_path: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    cancel_requested: bool = False

    def update(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
    
    def fail(self, message: str):
        self.status = "error"
        self.error = message
        self.finished_at = time.time()
        logger.error(f"[LooperWorker] Job {self.job_id} failed: {message}")


# Global registry
JOBS: Dict[str, LooperJobStatus] = {}


def create_job() -> LooperJobStatus:
    job_id = str(uuid.uuid4())
    job = LooperJobStatus(job_id=job_id)
    JOBS[job_id] = job
    return job


def get_job(job_id: str) -> Optional[LooperJobStatus]:
    return JOBS.get(job_id)


# ─── Resolution Map ──────────────────────────────────────────────────────────

RESOLUTION_MAP: Dict[str, Optional[str]] = {
    "original": None,
    "1080p":    "1920:1080",
    "1080p_p":  "1080:1920",
    "720p":     "1280:720",
    "720p_p":   "720:1280",
    "480p":     "854:480",
    "480p_p":   "480:854",
}

CRF_MAP: Dict[str, str] = {
    "high":   "18",
    "medium": "23",
    "low":    "28",
}


def _even(value: int) -> int:
    v = int(value)
    return v if v % 2 == 0 else max(2, v - 1)


def _build_scene_mixer_clip(
    clip,
    *,
    clip_count: int,
    order: str,
    full_duration: bool,
    max_duration: float,
    transition_type: str,
    crossfade_duration: float,
    vfx,
    concatenate_videoclips,
):
    duration = float(max(0.0, clip.duration))
    if duration <= 0:
        return clip

    safe_clip_count = max(1, int(clip_count))
    use_random = order == "random"
    use_crossfade = transition_type == "crossfade" and safe_clip_count > 1
    segment_max = duration if full_duration else min(duration, max(0.3, float(max_duration)))
    crossfade_sec = min(max(0.0, float(crossfade_duration)), 1.0)

    mixed_segments = []
    cursor = 0.0

    for i in range(safe_clip_count):
        if full_duration:
            seg_duration = duration
        else:
            lower = min(1.2, segment_max)
            seg_duration = random.uniform(max(0.3, lower), segment_max) if segment_max > lower else segment_max

        if duration <= seg_duration + 0.05:
            start = 0.0
        elif use_random:
            start = random.uniform(0.0, max(0.0, duration - seg_duration))
        else:
            max_start = max(0.0, duration - seg_duration)
            start = min(max_start, cursor)
            cursor = start + seg_duration
            if cursor >= max_start:
                cursor = 0.0

        end = min(duration, start + seg_duration)
        segment = clip.subclipped(start, end)

        if transition_type == "dip_to_black":
            fade_sec = min(0.25, segment.duration / 3)
            if fade_sec > 0:
                segment = segment.with_effects([vfx.FadeIn(fade_sec), vfx.FadeOut(fade_sec)])

        if use_crossfade and i > 0:
            segment = segment.with_effects([vfx.CrossFadeIn(crossfade_sec)])

        mixed_segments.append(segment)

    if len(mixed_segments) == 1:
        return mixed_segments[0]

    if use_crossfade:
        return concatenate_videoclips(mixed_segments, padding=-crossfade_sec, method="compose")
    return concatenate_videoclips(mixed_segments, method="compose")


def _build_scene_mixer_from_pool(
    clips,
    *,
    clip_count: int,
    order: str,
    full_duration: bool,
    max_duration: float,
    transition_type: str,
    crossfade_duration: float,
    vfx,
    concatenate_videoclips,
):
    valid_clips = [c for c in clips if getattr(c, "duration", 0) and c.duration > 0]
    if not valid_clips:
        raise RuntimeError("Pool scene mixer kosong")

    if len(valid_clips) == 1:
        return _build_scene_mixer_clip(
            valid_clips[0],
            clip_count=clip_count,
            order=order,
            full_duration=full_duration,
            max_duration=max_duration,
            transition_type=transition_type,
            crossfade_duration=crossfade_duration,
            vfx=vfx,
            concatenate_videoclips=concatenate_videoclips,
        )

    safe_clip_count = max(1, int(clip_count))
    use_random = order == "random"
    use_crossfade = transition_type == "crossfade" and safe_clip_count > 1
    crossfade_sec = min(max(0.0, float(crossfade_duration)), 1.0)
    cursors = [0.0] * len(valid_clips)
    mixed_segments = []

    for i in range(safe_clip_count):
        clip_idx = random.randrange(len(valid_clips)) if use_random else (i % len(valid_clips))
        source_clip = valid_clips[clip_idx]
        duration = float(max(0.0, source_clip.duration))

        if full_duration:
            seg_duration = duration
        else:
            segment_max = min(duration, max(0.3, float(max_duration)))
            lower = min(1.2, segment_max)
            seg_duration = random.uniform(max(0.3, lower), segment_max) if segment_max > lower else segment_max

        if duration <= seg_duration + 0.05:
            start = 0.0
        elif use_random:
            start = random.uniform(0.0, max(0.0, duration - seg_duration))
        else:
            max_start = max(0.0, duration - seg_duration)
            start = min(max_start, cursors[clip_idx])
            cursors[clip_idx] = start + seg_duration
            if cursors[clip_idx] >= max_start:
                cursors[clip_idx] = 0.0

        end = min(duration, start + seg_duration)
        segment = source_clip.subclipped(start, end)

        if transition_type == "dip_to_black":
            fade_sec = min(0.25, segment.duration / 3)
            if fade_sec > 0:
                segment = segment.with_effects([vfx.FadeIn(fade_sec), vfx.FadeOut(fade_sec)])

        if use_crossfade and i > 0:
            segment = segment.with_effects([vfx.CrossFadeIn(crossfade_sec)])

        mixed_segments.append(segment)

    if len(mixed_segments) == 1:
        return mixed_segments[0]

    if use_crossfade:
        return concatenate_videoclips(mixed_segments, padding=-crossfade_sec, method="compose")
    return concatenate_videoclips(mixed_segments, method="compose")


def _collect_scene_mixer_paths(input_path: str) -> List[str]:
    base = Path(input_path)
    parent = base.parent
    if not parent.exists():
        return [str(base)]

    allowed_ext = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
    candidates = []
    for p in sorted(parent.iterdir()):
        if not p.is_file():
            continue
        if p.suffix.lower() not in allowed_ext:
            continue
        if p.name.startswith("_temp"):
            continue
        candidates.append(str(p))
    if str(base) not in candidates:
        candidates.insert(0, str(base))
    return candidates[:24]


def _download_watermark_temp(source: str) -> Optional[str]:
    try:
        parsed = urllib.parse.urlparse(source)
        suffix = Path(parsed.path).suffix or ".png"
        fd, temp_path = tempfile.mkstemp(prefix="looper_wm_", suffix=suffix)
        os.close(fd)
        urllib.request.urlretrieve(source, temp_path)
        return temp_path
    except Exception as e:
        logger.warning(f"[LooperWorker] Gagal download watermark URL: {e}")
        return None


def _build_scale_pad_filter(scale_filter: str) -> str:
    return (
        f"scale={scale_filter}:force_original_aspect_ratio=decrease,"
        f"pad={scale_filter}:(ow-iw)/2:(oh-ih)/2,setsar=1"
    )


VIDEO_WATERMARK_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"}


def _postprocess_final_video(
    *,
    ffmpeg_exe: str,
    input_path: str,
    output_path: str,
    crf_str: str,
    scale_filter: Optional[str] = None,
    watermark_path: Optional[str] = None,
    scale_pct: int = 50,
    watermark_opacity: int = 100,
    watermark_position: str = "bottom_right",
    watermark_margin_x: int = 24,
    watermark_margin_y: int = 24,
    watermark_key_black: bool = False,
    watermark_key_green: bool = False,
) -> None:
    if not scale_filter and not watermark_path:
        os.replace(input_path, output_path)
        return

    cmd = [ffmpeg_exe, "-y", "-i", input_path]
    filter_steps = []
    if scale_filter:
        filter_steps.append(_build_scale_pad_filter(scale_filter))
    else:
        filter_steps.append("setsar=1")

    if watermark_path:
        watermark_ext = Path(urllib.parse.urlparse(watermark_path).path).suffix.lower()
        is_remote_watermark = watermark_path.startswith(("http://", "https://"))
        if watermark_ext in VIDEO_WATERMARK_EXTENSIONS and not is_remote_watermark:
            cmd += ["-stream_loop", "-1"]
        cmd += ["-i", watermark_path]
        scale_ratio = max(1, min(100, int(scale_pct))) / 100.0
        opacity = max(0, min(100, int(watermark_opacity))) / 100.0
        margin_x = max(0, int(watermark_margin_x))
        margin_y = max(0, int(watermark_margin_y))
        position = (watermark_position or "bottom_right").strip().lower()
        overlay_map = {
            "top_left": (f"{margin_x}", f"{margin_y}"),
            "top_center": ("(W-w)/2", f"{margin_y}"),
            "top_right": (f"W-w-{margin_x}", f"{margin_y}"),
            "center_left": (f"{margin_x}", "(H-h)/2"),
            "center": ("(W-w)/2", "(H-h)/2"),
            "center_right": (f"W-w-{margin_x}", "(H-h)/2"),
            "bottom_left": (f"{margin_x}", f"H-h-{margin_y}"),
            "bottom_center": ("(W-w)/2", f"H-h-{margin_y}"),
            "bottom_right": (f"W-w-{margin_x}", f"H-h-{margin_y}"),
        }
        overlay_x, overlay_y = overlay_map.get(position, overlay_map["bottom_right"])
        key_steps = []
        if watermark_key_black:
            key_steps.append("colorkey=black:0.22:0.0")
        if watermark_key_green:
            key_steps.append("colorkey=0x00FF00:0.22:0.0")
        key_part = ",".join(key_steps)
        wm_chain = f"format=rgba,colorchannelmixer=aa={opacity}"
        if key_part:
            wm_chain = f"{wm_chain},{key_part}"
        filter_complex = (
            f"[0:v]{','.join(filter_steps)}[vbase];"
            f"[1:v]{wm_chain}[wmin];"
            f"[wmin][vbase]scale2ref=w=main_w*{scale_ratio}:h=main_h*{scale_ratio}:force_original_aspect_ratio=decrease[wm][vbase2];"
            f"[vbase2][wm]overlay={overlay_x}:{overlay_y}[vout]"
        )
        cmd += [
            "-filter_complex", filter_complex,
            "-map", "[vout]",
        ]
    else:
        cmd += [
            "-vf", ",".join(filter_steps),
            "-map", "0:v:0",
        ]

    cmd += [
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", crf_str,
        "-c:a", "copy",
        output_path,
    ]

    subprocess.run(
        cmd,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _apply_watermark(
    *,
    ffmpeg_exe: str,
    input_path: str,
    output_path: str,
    watermark_path: str,
    scale_pct: int,
    crf_str: str,
) -> None:
    _postprocess_final_video(
        ffmpeg_exe=ffmpeg_exe,
        input_path=input_path,
        output_path=output_path,
        crf_str=crf_str,
        watermark_path=watermark_path,
        scale_pct=scale_pct,
    )


# ─── Main Worker ─────────────────────────────────────────────────────────────

def run_looper_job(
    job: LooperJobStatus,
    input_path: str,
    output_path: str,
    *,
    mode: str = "manual",               # manual | target | audio
    default_loops: int = 3,
    target_duration: float = 15.0,
    cut_start: float = 3.0,
    disable_crossfade: bool = False,
    crossfade_duration: float = 1.5,
    quality: str = "high",
    resolution: str = "original",
    mute_original_audio: bool = False,
    enable_audio_fade: bool = True,
    audio_fade_duration: float = 2.0,
    custom_audio_path: Optional[str] = None,
    enable_looper: bool = True,
    enable_scene_mixer: bool = False,
    scene_mixer_source: str = "original",
    scene_mixer_selected_paths: Optional[List[str]] = None,
    scene_mixer_clip_count: int = 10,
    scene_mixer_order: str = "random",
    scene_mixer_full_duration: bool = False,
    scene_mixer_max_duration: float = 5.0,
    effect_zoom_crop: bool = False,
    effect_zoom_mode: str = "random",
    effect_zoom_percent: float = 90.0,
    effect_mirror: bool = False,
    effect_speed_ramping: bool = False,
    effect_color_tweaking: bool = False,
    effect_film_grain: bool = False,
    effect_pulsing_vignette: bool = False,
    transition_type: str = "none",
    watermark_source: Optional[str] = None,
    watermark_scale: int = 50,
    watermark_opacity: int = 100,
    watermark_position: str = "bottom_right",
    watermark_margin_x: int = 24,
    watermark_margin_y: int = 24,
    watermark_key_black: bool = False,
    watermark_key_green: bool = False,
) -> None:
    """
    Runs the full looper pipeline synchronously.
    Designed to be called inside run_in_executor / BackgroundTasks thread.
    Updates `job` in-place throughout.
    """
    try:
        _pipeline(
            job=job,
            input_path=input_path,
            output_path=output_path,
            mode=mode,
            default_loops=default_loops,
            target_duration=target_duration,
            cut_start=cut_start,
            disable_crossfade=disable_crossfade,
            crossfade_duration=crossfade_duration,
            quality=quality,
            resolution=resolution,
            mute_original_audio=mute_original_audio,
            enable_audio_fade=enable_audio_fade,
            audio_fade_duration=audio_fade_duration,
            custom_audio_path=custom_audio_path,
            enable_looper=enable_looper,
            enable_scene_mixer=enable_scene_mixer,
            scene_mixer_source=scene_mixer_source,
            scene_mixer_selected_paths=scene_mixer_selected_paths,
            scene_mixer_clip_count=scene_mixer_clip_count,
            scene_mixer_order=scene_mixer_order,
            scene_mixer_full_duration=scene_mixer_full_duration,
            scene_mixer_max_duration=scene_mixer_max_duration,
            effect_zoom_crop=effect_zoom_crop,
            effect_zoom_mode=effect_zoom_mode,
            effect_zoom_percent=effect_zoom_percent,
            effect_mirror=effect_mirror,
            effect_speed_ramping=effect_speed_ramping,
            effect_color_tweaking=effect_color_tweaking,
            effect_film_grain=effect_film_grain,
            effect_pulsing_vignette=effect_pulsing_vignette,
            transition_type=transition_type,
            watermark_source=watermark_source,
            watermark_scale=watermark_scale,
            watermark_opacity=watermark_opacity,
            watermark_position=watermark_position,
            watermark_margin_x=watermark_margin_x,
            watermark_margin_y=watermark_margin_y,
            watermark_key_black=watermark_key_black,
            watermark_key_green=watermark_key_green,
        )
    except Exception as exc:
        job.status = "error"
        job.error = str(exc)
        job.finished_at = time.time()
        logger.error(f"[LooperWorker] Job {job.job_id} failed: {exc}", exc_info=True)


def _update_stage(job: LooperJobStatus, stage: int, detail: str = "") -> None:
    job.stage = stage
    idx = max(0, min(stage - 1, len(STAGE_LABELS) - 1))
    label = STAGE_LABELS[idx]
    job.stage_label = f"{label}" + (f" — {detail}" if detail else "")
    job.progress = int(((stage - 1) / len(STAGE_LABELS)) * 100)
    job.status = "running"
    logger.info(f"[LooperWorker] Job {job.job_id} | Stage {stage}/6 — {job.stage_label}")


def _pipeline(
    job: LooperJobStatus,
    input_path: str,
    output_path: str,
    mode: str,
    default_loops: int,
    target_duration: float,
    cut_start: float,
    disable_crossfade: bool,
    crossfade_duration: float,
    quality: str,
    resolution: str,
    mute_original_audio: bool,
    enable_audio_fade: bool,
    audio_fade_duration: float,
    custom_audio_path: Optional[str],
    enable_looper: bool,
    enable_scene_mixer: bool,
    scene_mixer_source: str,
    scene_mixer_selected_paths: Optional[List[str]],
    scene_mixer_clip_count: int,
    scene_mixer_order: str,
    scene_mixer_full_duration: bool,
    scene_mixer_max_duration: float,
    effect_zoom_crop: bool,
    effect_zoom_mode: str,
    effect_zoom_percent: float,
    effect_mirror: bool,
    effect_speed_ramping: bool,
    effect_color_tweaking: bool,
    effect_film_grain: bool,
    effect_pulsing_vignette: bool,
    transition_type: str,
    watermark_source: Optional[str],
    watermark_scale: int,
    watermark_opacity: int,
    watermark_position: str,
    watermark_margin_x: int,
    watermark_margin_y: int,
    watermark_key_black: bool,
    watermark_key_green: bool,
) -> None:
    import imageio_ffmpeg

    crf_str    = CRF_MAP.get(quality, "18")
    scale_filter = RESOLUTION_MAP.get(resolution, None)
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    # ── STAGE 1: Load & Validate ──────────────────────────────────────────────
    _update_stage(job, 1)
    if job.cancel_requested:
        job.fail("Cancelled"); return

    info = get_file_info(input_path)
    if not info:
        job.fail("Gagal membaca metadata file (ffprobe error)"); return

    original_duration = info.get("duration", 0)
    original_fps      = info.get("fps", 0.0)

    if original_duration <= 0:
        job.fail("File video tidak valid atau durasi 0"); return

    if enable_looper and cut_start >= original_duration:
        job.fail(f"Cut start ({cut_start}s) melebihi durasi video ({original_duration:.1f}s)"); return

    has_visual_effects = bool(
        effect_zoom_crop
        or effect_mirror
        or effect_speed_ramping
        or effect_color_tweaking
        or effect_film_grain
        or effect_pulsing_vignette
        or (transition_type or "").strip().lower() == "glitch"
    )

    if (not enable_looper) and (not enable_scene_mixer) and (not custom_audio_path) and (not mute_original_audio) and (not has_visual_effects):
        if not scale_filter and not watermark_source:
            _update_stage(job, 6, "skip render — copy original")
            try:
                shutil.copy2(input_path, output_path)
            except Exception as e:
                job.fail(f"Gagal copy file: {e}"); return

            job.status = "done"
            job.progress = 100
            job.stage_label = "Selesai!"
            job.output_path = output_path
            job.finished_at = time.time()
            return

        _update_stage(job, 6, "skip MoviePy — postprocess FFmpeg")
        watermark_download_path: Optional[str] = None
        resolved_watermark: Optional[str] = None
        try:
            if watermark_source:
                resolved_watermark = watermark_source
                if watermark_source.startswith(("http://", "https://")):
                    watermark_download_path = _download_watermark_temp(watermark_source)
                    if not watermark_download_path:
                        raise RuntimeError("Download watermark gagal")
                    resolved_watermark = watermark_download_path

            _postprocess_final_video(
                ffmpeg_exe=ffmpeg_exe,
                input_path=input_path,
                output_path=output_path,
                crf_str=crf_str,
                scale_filter=scale_filter,
                watermark_path=resolved_watermark,
                scale_pct=watermark_scale,
                watermark_opacity=watermark_opacity,
                watermark_position=watermark_position,
                watermark_margin_x=watermark_margin_x,
                watermark_margin_y=watermark_margin_y,
                watermark_key_black=watermark_key_black,
                watermark_key_green=watermark_key_green,
            )
        except Exception as e:
            job.fail(f"Gagal proses final output: {e}")
            _cleanup([watermark_download_path])
            return
        finally:
            _cleanup([watermark_download_path])

        job.status = "done"
        job.progress = 100
        job.stage_label = "Selesai!"
        job.output_path = output_path
        job.finished_at = time.time()
        return

    from moviepy import VideoFileClip, AudioFileClip, concatenate_videoclips, concatenate_audioclips, vfx, afx

    try:
        video = VideoFileClip(input_path)
    except Exception as e:
        job.fail(f"Gagal memuat video: {e}"); return
    mixer_extra_clips = []

    logger.info(
        f"[LooperWorker] Video info: {video.size[0]}x{video.size[1]} "
        f"@ {original_fps} fps, {original_duration:.2f}s"
    )

    effective_cut_start = max(0.0, cut_start if enable_looper else 0.0)
    margin = 0.5 if disable_crossfade else (crossfade_duration + 0.5)
    if enable_looper and original_duration <= (effective_cut_start + margin):
        job.status = "error"
        job.error = (
            f"Video terlalu pendek ({original_duration:.1f}s) untuk dipotong {effective_cut_start}s "
            f"dengan margin {margin}s."
        )
        job.finished_at = time.time()
        video.close()
        return

    if mute_original_audio:
        video = video.without_audio()

    # ── STAGE 2: Cut + Crossfade ──────────────────────────────────────────────
    _update_stage(job, 2)
    if job.cancel_requested:
        for clip in mixer_extra_clips:
            try:
                clip.close()
            except Exception:
                pass
        video.close(); job.status = "error"; job.error = "Cancelled"; return

    video_cut = video.subclipped(effective_cut_start, video.duration)

    if enable_scene_mixer:
        scene_count = max(1, int(scene_mixer_clip_count))
        mixer_source = (scene_mixer_source or "original").strip().lower()
        try:
            if mixer_source == "folder":
                candidate_paths = _collect_scene_mixer_paths(input_path)
                source_clips = [video]
                for p in candidate_paths:
                    if Path(p).resolve() == Path(input_path).resolve():
                        continue
                    try:
                        c = VideoFileClip(p)
                        if c.duration > 0:
                            source_clips.append(c)
                            mixer_extra_clips.append(c)
                    except Exception as e:
                        logger.warning(f"[LooperWorker] Skip source mixer '{p}': {e}")
                logger.info(f"[LooperWorker] Scene mixer source=folder, candidates={len(source_clips)}")
                video_cut = _build_scene_mixer_from_pool(
                    source_clips,
                    clip_count=scene_count,
                    order=(scene_mixer_order or "random").strip().lower(),
                    full_duration=bool(scene_mixer_full_duration),
                    max_duration=max(0.3, float(scene_mixer_max_duration or 5.0)),
                    transition_type=(transition_type or "none").strip().lower(),
                    crossfade_duration=max(0.1, float(crossfade_duration)),
                    vfx=vfx,
                    concatenate_videoclips=concatenate_videoclips,
                )
            elif mixer_source == "selected" and scene_mixer_selected_paths:
                source_clips = [video]
                for p in scene_mixer_selected_paths[:24]:
                    if Path(p).resolve() == Path(input_path).resolve():
                        continue
                    try:
                        c = VideoFileClip(p)
                        if c.duration > 0:
                            source_clips.append(c)
                            mixer_extra_clips.append(c)
                    except Exception as e:
                        logger.warning(f"[LooperWorker] Skip source mixer '{p}': {e}")
                logger.info(f"[LooperWorker] Scene mixer source=selected, candidates={len(source_clips)}")
                if len(source_clips) <= 1:
                    video_cut = _build_scene_mixer_clip(
                        video_cut,
                        clip_count=scene_count,
                        order=(scene_mixer_order or "random").strip().lower(),
                        full_duration=bool(scene_mixer_full_duration),
                        max_duration=max(0.3, float(scene_mixer_max_duration or 5.0)),
                        transition_type=(transition_type or "none").strip().lower(),
                        crossfade_duration=max(0.1, float(crossfade_duration)),
                        vfx=vfx,
                        concatenate_videoclips=concatenate_videoclips,
                    )
                else:
                    video_cut = _build_scene_mixer_from_pool(
                        source_clips,
                        clip_count=scene_count,
                        order=(scene_mixer_order or "random").strip().lower(),
                        full_duration=bool(scene_mixer_full_duration),
                        max_duration=max(0.3, float(scene_mixer_max_duration or 5.0)),
                        transition_type=(transition_type or "none").strip().lower(),
                        crossfade_duration=max(0.1, float(crossfade_duration)),
                        vfx=vfx,
                        concatenate_videoclips=concatenate_videoclips,
                    )
            else:
                video_cut = _build_scene_mixer_clip(
                    video_cut,
                    clip_count=scene_count,
                    order=(scene_mixer_order or "random").strip().lower(),
                    full_duration=bool(scene_mixer_full_duration),
                    max_duration=max(0.3, float(scene_mixer_max_duration or 5.0)),
                    transition_type=(transition_type or "none").strip().lower(),
                    crossfade_duration=max(0.1, float(crossfade_duration)),
                    vfx=vfx,
                    concatenate_videoclips=concatenate_videoclips,
                )
        except Exception as e:
            logger.warning(f"[LooperWorker] Scene mixer fallback ke clip original: {e}")

    if not enable_looper:
        video_loop_1x = video_cut
    elif disable_crossfade:
        video_loop_1x = video_cut
    else:
        bagian_a      = video_cut.subclipped(0, crossfade_duration)
        bagian_b      = video_cut.subclipped(crossfade_duration, video_cut.duration)
        bagian_a_fade = bagian_a.with_effects([vfx.CrossFadeIn(crossfade_duration)])
        video_loop_1x = concatenate_videoclips(
            [bagian_b, bagian_a_fade],
            padding=-crossfade_duration,
            method="compose",
        )

    base_duration = video_loop_1x.duration

    # ── STAGE 3: Calculate Duration ───────────────────────────────────────────
    _update_stage(job, 3)

    audio_dur = 0.0
    if custom_audio_path:
        try:
            tmp_a    = AudioFileClip(custom_audio_path)
            audio_dur = tmp_a.duration
            tmp_a.close()
        except Exception as e:
            logger.warning(f"[LooperWorker] Failed to read custom audio: {e}")

    if not enable_looper:
        num_loops = 1
        final_target = base_duration
    elif mode == "audio" and audio_dur > 0:
        final_target = audio_dur
        num_loops    = math.ceil(audio_dur / base_duration)
    elif mode == "target":
        final_target = target_duration
        num_loops    = math.ceil(target_duration / base_duration)
    else:  # manual
        num_loops    = default_loops
        final_target = base_duration * num_loops

    logger.info(
        f"[LooperWorker] Mode={mode}, loops={num_loops}, target={final_target:.1f}s"
    )

    # ── STAGE 4: Render 1x Loop ───────────────────────────────────────────────
    _update_stage(job, 4, "encoding — mohon tunggu…")
    if job.cancel_requested:
        video.close(); job.status = "error"; job.error = "Cancelled"; return

    temp_dir      = Path(output_path).parent
    temp_1x_path  = str(temp_dir / f"_temp1x_{job.job_id}.mp4")

    ffmpeg_params = ["-crf", crf_str, "-preset", "fast"]
    visual_filters = []
    target_width = int(info.get("width") or video.size[0] or 1280)
    target_height = int(info.get("height") or video.size[1] or 720)
    if scale_filter:
        scale_w, scale_h = scale_filter.split(":")
        target_width = int(scale_w)
        target_height = int(scale_h)

    if effect_zoom_crop:
        mode_zoom = (effect_zoom_mode or "random").strip().lower()
        if mode_zoom == "manual":
            percent = max(50.0, min(200.0, float(effect_zoom_percent or 90.0)))
            zoom_factor = 100.0 / percent
        else:
            zoom_factor = random.uniform(1.04, 1.15)

        if zoom_factor >= 1.0:
            zoom_w = _even(int(target_width * zoom_factor))
            zoom_h = _even(int(target_height * zoom_factor))
            visual_filters.append(f"scale={zoom_w}:{zoom_h},crop={_even(target_width)}:{_even(target_height)}")
        else:
            zoom_w = _even(max(2, int(target_width * zoom_factor)))
            zoom_h = _even(max(2, int(target_height * zoom_factor)))
            visual_filters.append(
                f"scale={zoom_w}:{zoom_h},pad={_even(target_width)}:{_even(target_height)}:(ow-iw)/2:(oh-ih)/2"
            )
    if effect_mirror:
        visual_filters.append("hflip")
    if effect_speed_ramping:
        visual_filters.append("setpts=0.95*PTS")
    if effect_color_tweaking:
        visual_filters.append("eq=contrast=1.06:saturation=1.14:brightness=0.02")
    if effect_film_grain:
        visual_filters.append("noise=alls=7:allf=t+u")
    if effect_pulsing_vignette:
        visual_filters.append("vignette=PI/6+0.08*sin(2*PI*t/6)")
    if (transition_type or "").strip().lower() == "glitch":
        visual_filters.append("eq=saturation=1.2:contrast=1.1")

    if visual_filters:
        ffmpeg_params += ["-vf", ",".join(visual_filters)]

    try:
        video_loop_1x.write_videofile(
            temp_1x_path,
            codec="libx264",
            audio_codec="aac" if not mute_original_audio else None,
            fps=original_fps,
            ffmpeg_params=ffmpeg_params,
            logger=None,
        )
    except Exception as e:
        job.status = "error"
        job.error  = f"Gagal render 1x loop: {e}"
        job.finished_at = time.time()
        for clip in mixer_extra_clips:
            try:
                clip.close()
            except Exception:
                pass
        return
    finally:
        video_loop_1x.close()
        video.close()
        for clip in mixer_extra_clips:
            try:
                clip.close()
            except Exception:
                pass

    # ── STAGE 5: FFmpeg Concat Duplicate ─────────────────────────────────────
    if num_loops <= 1:
        _update_stage(job, 5, "skip duplicate (1×)")
    else:
        _update_stage(job, 5, f"menggandakan {num_loops}x via FFmpeg")
    if job.cancel_requested:
        _cleanup([temp_1x_path]); job.status = "error"; job.error = "Cancelled"; return

    list_file_path: Optional[str] = None
    temp_multi_path: str
    if num_loops <= 1:
        temp_multi_path = temp_1x_path
    else:
        list_file_path  = str(temp_dir / f"_templist_{job.job_id}.txt")
        temp_multi_path = str(temp_dir / f"_tempmulti_{job.job_id}.mp4")

        with open(list_file_path, "w", encoding="utf-8") as f:
            for _ in range(num_loops):
                f.write(f"file '{temp_1x_path}'\n")

        try:
            subprocess.run(
                [ffmpeg_exe, "-y", "-f", "concat", "-safe", "0",
                 "-i", list_file_path, "-c", "copy", temp_multi_path],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as e:
            job.status = "error"
            job.error  = f"Gagal menggandakan video: {e}"
            job.finished_at = time.time()
            _cleanup([temp_1x_path, list_file_path])
            return

    # ── STAGE 6: Audio Fade & Final Trim ─────────────────────────────────────
    _update_stage(job, 6)

    final_audio_temp: Optional[str] = None
    temp_output_path = str(temp_dir / f"_tempfinal_{job.job_id}.mp4")
    watermark_download_path: Optional[str] = None

    if custom_audio_path:
        try:
            new_audio = AudioFileClip(custom_audio_path)

            if new_audio.duration < final_target:
                loops_needed = math.ceil(final_target / new_audio.duration)
                new_audio = concatenate_audioclips([new_audio] * loops_needed)

            new_audio = new_audio.subclipped(0, final_target)

            if enable_audio_fade:
                fade_d    = min(audio_fade_duration, final_target / 4)
                new_audio = new_audio.with_effects([
                    afx.AudioFadeIn(fade_d),
                    afx.AudioFadeOut(fade_d),
                ])

            final_audio_temp = str(temp_dir / f"_tempaudio_{job.job_id}.wav")
            new_audio.write_audiofile(final_audio_temp, logger=None)
            new_audio.close()

            subprocess.run(
                [
                    ffmpeg_exe, "-y",
                    "-i", temp_multi_path,
                    "-i", final_audio_temp,
                    "-c:v", "copy", "-c:a", "aac",
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-t", str(final_target),
                    temp_output_path,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as e:
            job.status = "error"
            job.error  = f"Gagal muxing audio: {e}"
            job.finished_at = time.time()
            _cleanup([temp_1x_path, list_file_path, temp_multi_path, final_audio_temp])
            return
    else:
        if num_loops <= 1:
            temp_output_path = temp_multi_path
        else:
            try:
                subprocess.run(
                    [
                        ffmpeg_exe, "-y",
                        "-i", temp_multi_path,
                        "-c", "copy",
                        "-t", str(final_target),
                        temp_output_path,
                    ],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception as e:
                job.status = "error"
                job.error  = f"Gagal trim final: {e}"
                job.finished_at = time.time()
                _cleanup([temp_1x_path, list_file_path, temp_multi_path])
                return

    try:
        resolved_watermark: Optional[str] = None
        if watermark_source:
            resolved_watermark = watermark_source
            if watermark_source.startswith(("http://", "https://")):
                watermark_download_path = _download_watermark_temp(watermark_source)
                if not watermark_download_path:
                    raise RuntimeError("Download watermark gagal")
                resolved_watermark = watermark_download_path

        _postprocess_final_video(
            ffmpeg_exe=ffmpeg_exe,
            input_path=temp_output_path,
            output_path=output_path,
            crf_str=crf_str,
            scale_filter=scale_filter,
            watermark_path=resolved_watermark,
            scale_pct=watermark_scale,
            watermark_opacity=watermark_opacity,
            watermark_position=watermark_position,
            watermark_margin_x=watermark_margin_x,
            watermark_margin_y=watermark_margin_y,
            watermark_key_black=watermark_key_black,
            watermark_key_green=watermark_key_green,
        )
    except Exception as e:
        job.status = "error"
        job.error = f"Gagal proses final output: {e}"
        job.finished_at = time.time()
        _cleanup([temp_1x_path, list_file_path, temp_multi_path, final_audio_temp, temp_output_path, watermark_download_path])
        return

    # ── Cleanup ───────────────────────────────────────────────────────────────
    _cleanup([temp_1x_path, list_file_path, temp_multi_path, final_audio_temp, temp_output_path, watermark_download_path])

    # ── Done ──────────────────────────────────────────────────────────────────
    job.status      = "done"
    job.progress    = 100
    job.stage_label = "Selesai!"
    job.output_path = output_path
    job.finished_at = time.time()
    logger.info(f"[LooperWorker] Job {job.job_id} completed → {output_path}")


def _cleanup(paths: list) -> None:
    for p in paths:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass


# ─── File Info (ffprobe) ──────────────────────────────────────────────────────

def get_file_info(file_path: str) -> dict:
    """
    Returns basic video metadata using ffprobe.
    Returns empty dict on failure.
    """
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    # ffprobe is usually next to ffmpeg
    ffprobe_exe = ffmpeg_exe.replace("ffmpeg", "ffprobe")
    if not os.path.exists(ffprobe_exe):
        # fallback: try system ffprobe
        ffprobe_exe = "ffprobe"

    try:
        import json as _json
        result = subprocess.run(
            [
                ffprobe_exe, "-v", "quiet",
                "-print_format", "json",
                "-show_streams", "-show_format",
                file_path,
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        data = _json.loads(result.stdout)
        video_stream = next(
            (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
            {},
        )
        fmt = data.get("format", {})
        duration = float(fmt.get("duration", 0))
        size_bytes = int(fmt.get("size", 0))

        # Parse fps from avg_frame_rate "30000/1001" → 29.97
        fps_raw = video_stream.get("avg_frame_rate", "0/1")
        try:
            num, den = fps_raw.split("/")
            fps = round(int(num) / int(den), 2) if int(den) else 0
        except Exception:
            fps = 0

        return {
            "duration": round(duration, 3),
            "width": video_stream.get("width", 0),
            "height": video_stream.get("height", 0),
            "fps": fps,
            "size_mb": round(size_bytes / 1024 / 1024, 2),
        }
    except Exception as e:
        logger.warning(f"[LooperWorker] ffprobe failed for {file_path}: {e}")
        return {}
