"""
Unit tests for resolution scaling and padding.

Tests cover:
- Resolution mapping (original, 1080p, 720p, 480p)
- Scale and pad filter generation
- Aspect ratio preservation with letterboxing/pillarboxing
- Complex concat uses scaling when resolution specified

Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.8, 3.9
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
root_dir = Path(__file__).parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import pytest
from backend.services.concat_worker import (
    RESOLUTION_MAP,
    _build_ffmpeg_concat,
    _build_complex_concat,
)


class TestResolutionMapping:
    """Tests for resolution mapping constants"""
    
    def test_resolution_map_has_original(self):
        """
        Test that RESOLUTION_MAP supports 'original' resolution
        Validates: Requirements 3.1
        """
        assert "original" in RESOLUTION_MAP
        assert RESOLUTION_MAP["original"] is None
    
    def test_resolution_map_has_1080p(self):
        """
        Test that RESOLUTION_MAP supports '1080p' resolution
        Validates: Requirements 3.2
        """
        assert "1080p" in RESOLUTION_MAP
        assert RESOLUTION_MAP["1080p"] == "1920:1080"
    
    def test_resolution_map_has_720p(self):
        """
        Test that RESOLUTION_MAP supports '720p' resolution
        Validates: Requirements 3.3
        """
        assert "720p" in RESOLUTION_MAP
        assert RESOLUTION_MAP["720p"] == "1280:720"
    
    def test_resolution_map_has_480p(self):
        """
        Test that RESOLUTION_MAP supports '480p' resolution
        Validates: Requirements 3.4
        """
        assert "480p" in RESOLUTION_MAP
        assert RESOLUTION_MAP["480p"] == "854:480"
    
    def test_resolution_map_values_are_correct_format(self):
        """
        Test that resolution values are in correct W:H format
        Validates: Requirements 3.2, 3.3, 3.4
        """
        for key, value in RESOLUTION_MAP.items():
            if value is not None:
                # Should be in format "width:height"
                parts = value.split(":")
                assert len(parts) == 2
                assert parts[0].isdigit()
                assert parts[1].isdigit()
                assert int(parts[0]) > 0
                assert int(parts[1]) > 0


class TestScaleAndPadFilter:
    """Tests for scale and pad filter generation"""
    
    def test_scale_filter_includes_force_original_aspect_ratio(self):
        """
        Test that scale filter preserves aspect ratio
        Validates: Requirements 3.9
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        cmd = _build_complex_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=None,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter="1920:1080",
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Find filter_complex argument
        filter_complex_idx = cmd.index("-filter_complex")
        filter_complex_str = cmd[filter_complex_idx + 1]
        
        # Verify scale filter includes force_original_aspect_ratio=decrease
        assert "scale=1920:1080:force_original_aspect_ratio=decrease" in filter_complex_str
    
    def test_scale_filter_includes_padding(self):
        """
        Test that scale filter includes padding for letterboxing/pillarboxing
        Validates: Requirements 3.9
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        cmd = _build_complex_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=None,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter="1920:1080",
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Find filter_complex argument
        filter_complex_idx = cmd.index("-filter_complex")
        filter_complex_str = cmd[filter_complex_idx + 1]
        
        # Verify pad filter with centered positioning
        assert "pad=1920:1080:(ow-iw)/2:(oh-ih)/2" in filter_complex_str
    
    def test_scale_filter_includes_setsar(self):
        """
        Test that scale filter includes setsar=1 to fix aspect ratio
        Validates: Requirements 3.9
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        cmd = _build_complex_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=None,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter="1920:1080",
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Find filter_complex argument
        filter_complex_idx = cmd.index("-filter_complex")
        filter_complex_str = cmd[filter_complex_idx + 1]
        
        # Verify setsar=1 is included
        assert "setsar=1" in filter_complex_str
    
    def test_scale_filter_applied_to_all_videos(self):
        """
        Test that scale filter is applied to all input videos
        Validates: Requirements 3.8
        """
        input_paths = [
            "/path/to/video1.mp4",
            "/path/to/video2.mp4",
            "/path/to/video3.mp4",
        ]
        output_path = "/path/to/output.mp4"
        
        cmd = _build_complex_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=None,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter="1920:1080",
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Find filter_complex argument
        filter_complex_idx = cmd.index("-filter_complex")
        filter_complex_str = cmd[filter_complex_idx + 1]
        
        # Verify scale filter is applied to each video (v0, v1, v2)
        assert "[0:v]scale=1920:1080" in filter_complex_str
        assert "[1:v]scale=1920:1080" in filter_complex_str
        assert "[2:v]scale=1920:1080" in filter_complex_str
        
        # Verify output labels (v0, v1, v2)
        assert "[v0]" in filter_complex_str
        assert "[v1]" in filter_complex_str
        assert "[v2]" in filter_complex_str


class TestResolutionInFFmpegCommand:
    """Tests for resolution parameter in FFmpeg command building"""
    
    def test_original_resolution_no_scaling(self):
        """
        Test that 'original' resolution does not apply scaling
        Validates: Requirements 3.1
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",