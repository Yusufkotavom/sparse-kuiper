"""
concat_worker.py
================
Video concatenation worker for combining multiple videos into one output.
Follows the same pattern as looper_worker.py with background job processing.

Pipeline stages:
  1. Validate inputs (file existence, format, permissions)
  2. Build FFmpeg concat command
  3. Execute FFmpeg with progress monitoring
  4. Finalize output
"""

from __future__ import annotations

import os
import subprocess
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from backend.core.logger import logger

# ─── Job Registry (in-memory) ────────────────────────────────────────────────

STAGE_LABELS = [
    "Validasi Input",
    "Membangun Perintah FFmpeg",
    "Menjalankan Concat",
    "Finalisasi Output",
]


@dataclass
class ConcatJobStatus:
    job_id: str
    status: str = "pending"          # pending | running | done | error
    progress: int = 0                # 0–100
    stage: int = 0                   # 1–4
    stage_label: str = ""
    current_video: Optional[str] = None
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
        logger.error(f"[ConcatWorker] Job {self.job_id} failed: {message}")


# Global registry
JOBS: Dict[str, ConcatJobStatus] = {}


def create_job() -> ConcatJobStatus:
    """Create a new concat job with unique ID and register it."""
    job_id = str(uuid.uuid4())
    job = ConcatJobStatus(job_id=job_id)
    JOBS[job_id] = job
    return job


def get_job(job_id: str) -> Optional[ConcatJobStatus]:
    """Retrieve job status by job ID."""
    return JOBS.get(job_id)


# ─── Resolution & Quality Maps ───────────────────────────────────────────────

RESOLUTION_MAP: Dict[str, Optional[str]] = {
    "original": None,
    "1080p": "1920:1080",
    "720p": "1280:720",
    "480p": "854:480",
}

CRF_MAP: Dict[str, str] = {
    "high": "18",
    "medium": "23",
    "low": "28",
}

SUPPORTED_VIDEO_FORMATS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


# ─── Validation Functions ────────────────────────────────────────────────────

def _validate_inputs(input_paths: List[str]) -> None:
    """
    Validate input files for existence, format, and readability.
    Raises RuntimeError if validation fails.
    
    Validates: Requirements 11.1, 11.2, 11.3
    """
    if not input_paths or len(input_paths) < 2:
        raise RuntimeError("At least 2 video files are required for concatenation")
    
    for path in input_paths:
        # Check file existence
        if not os.path.exists(path):
            raise RuntimeError(f"File not found: {path}")
        
        # Check if it's a file (not directory)
        if not os.path.isfile(path):
            raise RuntimeError(f"Not a file: {path}")
        
        # Check file format
        file_ext = Path(path).suffix.lower()
        if file_ext not in SUPPORTED_VIDEO_FORMATS:
            raise RuntimeError(
                f"Unsupported video format: {file_ext}. "
                f"Supported formats: {', '.join(SUPPORTED_VIDEO_FORMATS)}"
            )
        
        # Check file readability
        if not os.access(path, os.R_OK):
            raise RuntimeError(f"File is not readable: {path}")
        
        # Check file size (not empty)
        if os.path.getsize(path) == 0:
            raise RuntimeError(f"File is empty: {path}")


# ─── Main Worker ─────────────────────────────────────────────────────────────

def run_concat_job(
    job: ConcatJobStatus,
    input_paths: List[str],
    output_path: str,
    *,
    trim_settings: Optional[Dict[str, dict]] = None,
    transition_type: str = "cut",
    transition_duration: float = 1.0,
    resolution: str = "original",
    quality: str = "high",
    mute_original_audio: bool = False,
    enable_audio_fade: bool = True,
    audio_fade_duration: float = 2.0,
    background_music_path: Optional[str] = None,
    background_music_volume: int = 50,
) -> None:
    """
    Main pipeline function for video concatenation.
    Runs synchronously in a background thread.
    Updates job status in-place throughout execution.
    
    Pipeline stages:
    1. Validate inputs (file existence, format, permissions)
    2. Build FFmpeg concat command
    3. Execute FFmpeg with progress monitoring
    4. Finalize output
    
    Validates: Requirements 4.1, 4.2, 4.3, 4.4
    """
    try:
        _pipeline(
            job=job,
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type=transition_type,
            transition_duration=transition_duration,
            resolution=resolution,
            quality=quality,
            mute_original_audio=mute_original_audio,
            enable_audio_fade=enable_audio_fade,
            audio_fade_duration=audio_fade_duration,
            background_music_path=background_music_path,
            background_music_volume=background_music_volume,
        )
    except Exception as exc:
        job.status = "error"
        job.error = str(exc)
        job.finished_at = time.time()
        logger.error(f"[ConcatWorker] Job {job.job_id} failed: {exc}", exc_info=True)


def _update_stage(job: ConcatJobStatus, stage: int, detail: str = "") -> None:
    """Update job stage and progress."""
    job.stage = stage
    idx = max(0, min(stage - 1, len(STAGE_LABELS) - 1))
    label = STAGE_LABELS[idx]
    job.stage_label = f"{label}" + (f" — {detail}" if detail else "")
    job.progress = int(((stage - 1) / len(STAGE_LABELS)) * 100)
    job.status = "running"
    logger.info(f"[ConcatWorker] Job {job.job_id} | Stage {stage}/{len(STAGE_LABELS)} — {job.stage_label}")


def _pipeline(
    job: ConcatJobStatus,
    input_paths: List[str],
    output_path: str,
    trim_settings: Optional[Dict[str, dict]],
    transition_type: str,
    transition_duration: float,
    resolution: str,
    quality: str,
    mute_original_audio: bool,
    enable_audio_fade: bool,
    audio_fade_duration: float,
    background_music_path: Optional[str],
    background_music_volume: int,
) -> None:
    """Internal pipeline implementation."""
    import imageio_ffmpeg

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    crf_str = CRF_MAP.get(quality, "18")
    scale_filter = RESOLUTION_MAP.get(resolution)

    # ── STAGE 1: Validate Inputs ──────────────────────────────────────────────
    _update_stage(job, 1)
    if job.cancel_requested:
        job.fail("Cancelled")
        return

    try:
        _validate_inputs(input_paths)
    except RuntimeError as e:
        job.fail(str(e))
        return

    logger.info(f"[ConcatWorker] Validated {len(input_paths)} input files")

    # ── STAGE 2: Build FFmpeg Command ─────────────────────────────────────────
    _update_stage(job, 2)
    if job.cancel_requested:
        job.fail("Cancelled")
        return

    temp_file_to_cleanup = None
    try:
        cmd, temp_file_to_cleanup = _build_ffmpeg_concat(
            ffmpeg_exe=ffmpeg_exe,
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type=transition_type,
            transition_duration=transition_duration,
            scale_filter=scale_filter,
            crf_str=crf_str,
            mute_original_audio=mute_original_audio,
            enable_audio_fade=enable_audio_fade,
            audio_fade_duration=audio_fade_duration,
            background_music_path=background_music_path,
            background_music_volume=background_music_volume,
        )
    except Exception as e:
        job.fail(f"Failed to build FFmpeg command: {e}")
        return

    logger.info(f"[ConcatWorker] FFmpeg command built successfully")

    # ── STAGE 3: Execute FFmpeg ───────────────────────────────────────────────
    _update_stage(job, 3, "processing videos...")
    if job.cancel_requested:
        job.fail("Cancelled")
        # Clean up temp file if it exists
        if temp_file_to_cleanup:
            try:
                os.remove(temp_file_to_cleanup)
            except Exception:
                pass
        return

    try:
        # Execute FFmpeg command
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        # Monitor progress (simplified - just wait for completion)
        stdout, stderr = process.communicate()

        if process.returncode != 0:
            error_msg = stderr[-500:] if stderr else "Unknown FFmpeg error"
            raise RuntimeError(f"FFmpeg failed: {error_msg}")

        logger.info(f"[ConcatWorker] FFmpeg execution completed successfully")

    except Exception as e:
        job.fail(f"FFmpeg execution failed: {e}")
        return
    finally:
        # Clean up temp file if it exists
        if temp_file_to_cleanup:
            try:
                os.remove(temp_file_to_cleanup)
                logger.debug(f"[ConcatWorker] Cleaned up temp file: {temp_file_to_cleanup}")
            except Exception as cleanup_err:
                logger.warning(f"[ConcatWorker] Failed to clean up temp file: {cleanup_err}")

    # ── STAGE 4: Finalize ─────────────────────────────────────────────────────
    _update_stage(job, 4)
    if job.cancel_requested:
        job.fail("Cancelled")
        return

    # Verify output file exists
    if not os.path.exists(output_path):
        job.fail("Output file was not created")
        return

    # Success!
    job.status = "done"
    job.progress = 100
    job.stage_label = "Selesai!"
    job.output_path = output_path
    job.finished_at = time.time()
    logger.info(f"[ConcatWorker] Job {job.job_id} completed successfully: {output_path}")


def _build_ffmpeg_concat(
    *,
    ffmpeg_exe: str,
    input_paths: List[str],
    output_path: str,
    trim_settings: Optional[Dict[str, dict]],
    transition_type: str,
    transition_duration: float,
    scale_filter: Optional[str],
    crf_str: str,
    mute_original_audio: bool,
    enable_audio_fade: bool,
    audio_fade_duration: float,
    background_music_path: Optional[str],
    background_music_volume: int,
) -> tuple[List[str], Optional[str]]:
    """
    Build FFmpeg command for video concatenation.
    
    Strategy:
    - Simple concat (no transitions, no trim): Use concat demuxer (fast, copy codec)
    - Complex concat (with transitions/trim): Use filter_complex (re-encode)
    
    Returns:
        tuple: (command list, temp_file_path to clean up or None)
    """
    # Determine if we need complex filtering
    has_transitions = transition_type != "cut"
    has_trim = trim_settings and any(trim_settings.values())
    has_scaling = scale_filter is not None
    has_audio_processing = mute_original_audio or background_music_path or enable_audio_fade
    
    needs_complex_filter = has_transitions or has_trim or has_scaling or has_audio_processing

    if not needs_complex_filter:
        # Simple concat using concat demuxer (fast path)
        return _build_simple_concat(
            ffmpeg_exe=ffmpeg_exe,
            input_paths=input_paths,
            output_path=output_path,
        )
    else:
        # Complex concat using filter_complex
        cmd = _build_complex_concat(
            ffmpeg_exe=ffmpeg_exe,
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type=transition_type,
            transition_duration=transition_duration,
            scale_filter=scale_filter,
            crf_str=crf_str,
            mute_original_audio=mute_original_audio,
            enable_audio_fade=enable_audio_fade,
            audio_fade_duration=audio_fade_duration,
            background_music_path=background_music_path,
            background_music_volume=background_music_volume,
        )
        return cmd, None


def _build_simple_concat(
    *,
    ffmpeg_exe: str,
    input_paths: List[str],
    output_path: str,
    trim_settings: Optional[Dict[str, dict]] = None,
) -> tuple[List[str], Optional[str]]:
    """
    Build simple concat command using concat demuxer.
    Fast path - copies streams without re-encoding.
    
    Note: If trim_settings are provided, this function will NOT apply them
    because concat demuxer doesn't support trimming. The caller should use
    complex concat instead.
    
    Returns:
        tuple: (command list, temp_file_path to clean up after execution)
    
    Validates: Requirements 1.1, 1.2, 1.3, 2.1
    """
    import tempfile
    
    # Create concat list file
    fd, concat_list_path = tempfile.mkstemp(suffix=".txt", prefix="concat_")
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            for path in input_paths:
                # Escape single quotes and wrap in quotes
                escaped_path = path.replace("'", "'\\''")
                f.write(f"file '{escaped_path}'\n")
        
        cmd = [
            ffmpeg_exe,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_list_path,
            "-c", "copy",
            output_path,
        ]
        
        return cmd, concat_list_path
    except Exception:
        # Clean up temp file on error
        try:
            os.remove(concat_list_path)
        except Exception:
            pass
        raise


def _apply_transitions(
    *,
    input_paths: List[str],
    video_labels: List[str],
    transition_type: str,
    transition_duration: float,
) -> str:
    """
    Generate filter_complex string for video transitions.
    
    For crossfade transitions, uses xfade filter to blend consecutive videos.
    Calculates offset times based on video durations and transition duration.
    
    Args:
        input_paths: List of input video file paths
        video_labels: List of video stream labels (e.g., ["[v0]", "[v1]", "[v2]"])
        transition_type: Type of transition ("crossfade", "dip_to_black", "glitch")
        transition_duration: Duration of transition in seconds
    
    Returns:
        Filter string for transitions ending with [vout] label
    
    Validates: Requirements 2.2, 2.5, 2.6, 2.7
    """
    if transition_type == "crossfade":
        return _build_crossfade_filter(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_duration=transition_duration,
        )
    elif transition_type == "dip_to_black":
        return _build_dip_to_black_filter(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_duration=transition_duration,
        )
    else:
        # Fallback to simple concat for unsupported transition types
        return "".join(video_labels) + f"concat=n={len(video_labels)}:v=1:a=0[vout]"


def _build_crossfade_filter(
    *,
    input_paths: List[str],
    video_labels: List[str],
    transition_duration: float,
) -> str:
    """
    Build crossfade transition filter using xfade.
    
    For N videos, creates N-1 xfade filters that blend consecutive videos.
    Offset for each transition is calculated as:
        offset = (duration of previous video) - (transition_duration)
    
    Example for 3 videos (10s, 10s, 10s) with 1.0s crossfade:
        [v0][v1]xfade=transition=fade:duration=1.0:offset=9.0[vx01];
        [vx01][v2]xfade=transition=fade:duration=1.0:offset=18.0[vout]
    
    Args:
        input_paths: List of input video file paths (to get durations)
        video_labels: List of video stream labels
        transition_duration: Duration of crossfade in seconds
    
    Returns:
        Filter string with xfade filters
    
    Validates: Requirements 2.2, 2.6, 2.7
    """
    if len(video_labels) < 2:
        # Single video, no transitions needed
        return f"{video_labels[0]}copy[vout]"
    
    # Get video durations
    durations = []
    for path in input_paths:
        info = get_file_info(path)
        duration = info.get("duration", 0)
        if duration == 0:
            logger.warning(f"[ConcatWorker] Could not get duration for {path}, using default 10s")
            duration = 10.0
        durations.append(duration)
    
    # Build xfade filters
    filter_parts = []
    cumulative_time = 0.0
    
    for i in range(len(video_labels) - 1):
        # Calculate offset: when to start the transition
        # Offset is the cumulative time minus the transition duration
        offset = cumulative_time + durations[i] - transition_duration
        
        # Input labels for this transition
        if i == 0:
            # First transition: use original video labels
            input_a = video_labels[i]
            input_b = video_labels[i + 1]
        else:
            # Subsequent transitions: use output from previous xfade
            input_a = f"[vx{i-1}{i}]"
            input_b = video_labels[i + 1]
        
        # Output label for this transition
        if i == len(video_labels) - 2:
            # Last transition: output to [vout]
            output_label = "[vout]"
        else:
            # Intermediate transition: output to temporary label
            output_label = f"[vx{i}{i+1}]"
        
        # Build xfade filter
        xfade_filter = (
            f"{input_a}{input_b}xfade=transition=fade:"
            f"duration={transition_duration}:offset={offset:.1f}{output_label}"
        )
        filter_parts.append(xfade_filter)
        
        # Update cumulative time (subtract transition overlap)
        cumulative_time += durations[i] - transition_duration
    
    return ";".join(filter_parts)


def _build_dip_to_black_filter(
    *,
    input_paths: List[str],
    video_labels: List[str],
    transition_duration: float,
) -> str:
    """
    Build dip to black transition filter using fade filters.
    
    For N videos, creates fade-out and fade-in effects between consecutive videos.
    Each transition consists of:
    - Fade out to black at the end of the first video
    - Fade in from black at the start of the second video
    
    The transition_duration is split in half:
    - First half: fade out duration
    - Second half: fade in duration
    
    Example for 2 videos (10s each) with 1.0s dip to black:
        [v0]fade=t=out:st=9.5:d=0.5[v0f];
        [v1]fade=t=in:st=0:d=0.5[v1f];
        [v0f][v1f]concat=n=2:v=1:a=0[vout]
    
    Args:
        input_paths: List of input video file paths (to get durations)
        video_labels: List of video stream labels
        transition_duration: Duration of dip to black transition in seconds
    
    Returns:
        Filter string with fade filters and concat
    
    Validates: Requirements 2.3, 2.8
    """
    if len(video_labels) < 2:
        # Single video, no transitions needed
        return f"{video_labels[0]}copy[vout]"
    
    # Get video durations
    durations = []
    for path in input_paths:
        info = get_file_info(path)
        duration = info.get("duration", 0)
        if duration == 0:
            logger.warning(f"[ConcatWorker] Could not get duration for {path}, using default 10s")
            duration = 10.0
        durations.append(duration)
    
    # Split transition duration in half for fade out and fade in
    fade_duration = transition_duration / 2.0
    
    # Build fade filters for each video
    filter_parts = []
    faded_labels = []
    
    for i, label in enumerate(video_labels):
        # Remove brackets from label (e.g., "[v0]" -> "v0")
        label_name = label.strip("[]")
        faded_label = f"[{label_name}f]"
        
        if i == 0:
            # First video: only fade out at the end
            fade_out_start = durations[i] - fade_duration
            filter_parts.append(
                f"{label}fade=t=out:st={fade_out_start:.1f}:d={fade_duration:.1f}{faded_label}"
            )
        elif i == len(video_labels) - 1:
            # Last video: only fade in at the start
            filter_parts.append(
                f"{label}fade=t=in:st=0:d={fade_duration:.1f}{faded_label}"
            )
        else:
            # Middle videos: fade in at start and fade out at end
            fade_out_start = durations[i] - fade_duration
            filter_parts.append(
                f"{label}fade=t=in:st=0:d={fade_duration:.1f},"
                f"fade=t=out:st={fade_out_start:.1f}:d={fade_duration:.1f}{faded_label}"
            )
        
        faded_labels.append(faded_label)
    
    # Concatenate all faded videos
    concat_filter = "".join(faded_labels) + f"concat=n={len(faded_labels)}:v=1:a=0[vout]"
    filter_parts.append(concat_filter)
    
    return ";".join(filter_parts)


def _build_complex_concat(
    *,
    ffmpeg_exe: str,
    input_paths: List[str],
    output_path: str,
    trim_settings: Optional[Dict[str, dict]],
    transition_type: str,
    transition_duration: float,
    scale_filter: Optional[str],
    crf_str: str,
    mute_original_audio: bool,
    enable_audio_fade: bool,
    audio_fade_duration: float,
    background_music_path: Optional[str],
    background_music_volume: int,
) -> List[str]:
    """
    Build complex concat command using filter_complex.
    Handles transitions, trimming, scaling, and audio mixing.
    
    Validates: Requirements 6.4, 6.10
    """
    cmd = [ffmpeg_exe, "-y"]
    
    # Add input files with trim settings if specified
    for path in input_paths:
        # Apply trim settings using -ss (start) and -t (duration) flags
        if trim_settings and path in trim_settings:
            trim = trim_settings[path]
            start = trim.get("start", 0)
            end = trim.get("end")
            
            if end is not None:
                duration = end - start
                cmd += ["-ss", str(start), "-t", str(duration)]
            else:
                # Only start time specified
                cmd += ["-ss", str(start)]
        
        cmd += ["-i", path]
    
    # Add background music if specified
    if background_music_path:
        cmd += ["-i", background_music_path]
    
    # Build filter_complex
    filter_parts = []
    
    # Video processing: scale and pad if needed
    if scale_filter:
        for i in range(len(input_paths)):
            filter_parts.append(
                f"[{i}:v]scale={scale_filter}:force_original_aspect_ratio=decrease,"
                f"pad={scale_filter}:(ow-iw)/2:(oh-ih)/2,setsar=1[v{i}]"
            )
        video_labels = [f"[v{i}]" for i in range(len(input_paths))]
    else:
        video_labels = [f"[{i}:v]" for i in range(len(input_paths))]
    
    # Video transitions
    if transition_type in ("crossfade", "dip_to_black"):
        transition_filter = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type=transition_type,
            transition_duration=transition_duration,
        )
        filter_parts.append(transition_filter)
    else:
        # Simple concat (cut transition)
        video_concat = "".join(video_labels) + f"concat=n={len(input_paths)}:v=1:a=0[vout]"
        filter_parts.append(video_concat)
    
    # Audio processing
    if mute_original_audio:
        # Use only background music or silence
        if background_music_path:
            filter_parts.append(f"[{len(input_paths)}:a]aloop=loop=-1:size=2e+09[aout]")
        else:
            filter_parts.append("anullsrc=channel_layout=stereo:sample_rate=44100[aout]")
    else:
        # Preserve original audio
        audio_labels = [f"[{i}:a]" for i in range(len(input_paths))]
        audio_concat = "".join(audio_labels) + f"concat=n={len(input_paths)}:v=0:a=1[aout]"
        filter_parts.append(audio_concat)
    
    # Combine filter parts
    filter_complex = ";".join(filter_parts)
    
    cmd += ["-filter_complex", filter_complex]
    cmd += ["-map", "[vout]", "-map", "[aout]"]
    
    # Encoding settings
    cmd += [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", crf_str,
        "-c:a", "aac",
        "-b:a", "192k",
        output_path,
    ]
    
    return cmd


# ─── File Info (ffprobe) ──────────────────────────────────────────────────────

def get_file_info(file_path: str) -> dict:
    """
    Returns basic video metadata using ffprobe.
    Returns empty dict on failure.
    
    Validates: Requirements 11.10
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
        logger.warning(f"[ConcatWorker] ffprobe failed for {file_path}: {e}")
        return {}
