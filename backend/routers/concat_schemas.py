from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class TrimPoint(BaseModel):
    """
    Trim point for a video clip.
    
    Validates: Requirements 6.1, 6.2
    """
    start: float = Field(..., ge=0, description="Start time in seconds")
    end: float = Field(..., gt=0, description="End time in seconds")


class ConcatRunRequest(BaseModel):
    """
    Request schema for starting a video concatenation job.
    
    Validates: Requirements 1.1, 2.1-2.4, 3.1-3.4, 6.1, 6.2, 7.1-7.11
    """
    project: str = Field(..., description="Project name")
    files: List[str] = Field(..., min_length=2, description="List of relative file paths to concatenate")
    trim_settings: Optional[Dict[str, TrimPoint]] = Field(None, description="Trim settings per file path")
    output_suffix: str = Field("_concat", description="Suffix for output filename")
    transition_type: str = Field("cut", description="Transition type: cut | crossfade | dip_to_black | glitch")
    transition_duration: float = Field(1.0, ge=0.5, le=3.0, description="Transition duration in seconds")
    resolution: str = Field("original", description="Output resolution: original | 1080p | 720p | 480p")
    quality: str = Field("high", description="Output quality: high | medium | low")
    mute_original_audio: bool = Field(False, description="Mute original audio from all videos")
    enable_audio_fade: bool = Field(True, description="Enable audio fade in/out")
    audio_fade_duration: float = Field(2.0, ge=0.5, le=5.0, description="Audio fade duration in seconds")
    background_music_file: Optional[str] = Field(None, description="Relative path to background music file")
    background_music_volume: int = Field(50, ge=0, le=100, description="Background music volume (0-100)")


class ConcatRunResponse(BaseModel):
    """
    Response schema for concat job creation.
    
    Validates: Requirements 4.1
    """
    job_id: str = Field(..., description="Unique job identifier")
    message: str = Field(..., description="Status message")


class ConcatStatusResponse(BaseModel):
    """
    Response schema for concat job status polling.
    
    Validates: Requirements 4.2, 4.3, 4.4, 4.6, 4.7
    """
    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Job status: pending | running | done | error")
    progress: int = Field(..., ge=0, le=100, description="Progress percentage (0-100)")
    stage: int = Field(..., description="Current processing stage (1-4)")
    stage_label: str = Field(..., description="Human-readable stage description")
    current_video: Optional[str] = Field(None, description="Currently processing video file")
    output_path: Optional[str] = Field(None, description="Output file path (set when done)")
    error: Optional[str] = Field(None, description="Error message (set when status=error)")
    finished_at: Optional[float] = Field(None, description="Completion timestamp")
