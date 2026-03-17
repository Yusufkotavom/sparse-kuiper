from typing import List, Optional
from pydantic import BaseModel


class LooperRunRequest(BaseModel):
    project: str
    file: str
    custom_audio_file: Optional[str] = None
    output_suffix: str = "_loop"
    mode: str = "manual"
    default_loops: int = 3
    target_duration: float = 15.0
    cut_start: float = 3.0
    disable_crossfade: bool = False
    crossfade_duration: float = 1.5
    quality: str = "high"
    resolution: str = "original"
    mute_original_audio: bool = False
    enable_audio_fade: bool = True
    audio_fade_duration: float = 2.0
    enable_looper: Optional[bool] = True
    enable_scene_mixer: Optional[bool] = False
    scene_mixer_source: Optional[str] = "original"
    scene_mixer_selected_files: Optional[List[str]] = None
    scene_mixer_clip_count: Optional[int] = 10
    scene_mixer_order: Optional[str] = "random"
    scene_mixer_full_duration: Optional[bool] = False
    scene_mixer_max_duration: Optional[float] = 5.0
    effect_zoom_crop: Optional[bool] = False
    effect_zoom_mode: Optional[str] = "random"
    effect_zoom_percent: Optional[float] = 90.0
    effect_mirror: Optional[bool] = False
    effect_speed_ramping: Optional[bool] = False
    effect_color_tweaking: Optional[bool] = False
    effect_film_grain: Optional[bool] = False
    effect_pulsing_vignette: Optional[bool] = False
    transition_type: Optional[str] = "none"
    watermark_url: Optional[str] = None
    watermark_scale: Optional[int] = 50
    watermark_opacity: Optional[int] = 100
    watermark_position: Optional[str] = "bottom_right"
    watermark_margin_x: Optional[int] = 24
    watermark_margin_y: Optional[int] = 24
    watermark_key_black: Optional[bool] = False
    watermark_key_green: Optional[bool] = False


class LooperRunResponse(BaseModel):
    job_id: str
    message: str


class LooperStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    stage: int
    stage_label: str
    output_path: Optional[str] = None
    error: Optional[str] = None
    finished_at: Optional[float] = None


class LooperWatermarkUploadResponse(BaseModel):
    relative_path: str
    static_url: str
    filename: str
