from pydantic import BaseModel
from typing import List, Optional


class TemplatePayload(BaseModel):
    name: str
    category: str = "custom"
    system_prompt: str = ""
    prefix: str = ""
    suffix: str = ""


class TemplateUpdatePayload(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    system_prompt: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None


class LooperPreset(BaseModel):
    name: str
    description: Optional[str] = ""
    mode: str = "manual"
    default_loops: int = 3
    target_duration: float = 15.0
    cut_start: float = 3.0
    disable_crossfade: bool = False
    crossfade_duration: float = 1.5
    quality: str = "high"
    resolution: str = "original"
    mute_original_audio: bool = False
    enable_audio_fade: bool = False
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


class SystemPromptPayload(BaseModel):
    value: str


class GroqKeyPayload(BaseModel):
    value: str


class OpenAIKeyPayload(BaseModel):
    value: str


class GeminiKeyPayload(BaseModel):
    value: str


class AzureOpenAIPayload(BaseModel):
    endpoint: Optional[str] = None
    api_key: Optional[str] = None
    deployment: Optional[str] = None
    api_version: Optional[str] = None


class TelegramSettingsPayload(BaseModel):
    enabled: bool = False
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None


class TelegramTestPayload(BaseModel):
    message: Optional[str] = None


class ConcatPreset(BaseModel):
    name: str
    description: Optional[str] = ""
    transition_type: str = "cut"
    transition_duration: float = 1.0
    resolution: str = "original"
    quality: str = "high"
    mute_original_audio: bool = False
    enable_audio_fade: bool = True
    audio_fade_duration: float = 2.0
    background_music_volume: int = 50
