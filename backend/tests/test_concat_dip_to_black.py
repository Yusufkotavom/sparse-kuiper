"""
Unit tests for dip to black transition implementation.

Tests cover:
- _apply_transitions() function generates correct fade filters for dip to black
- Fade out and fade in timing calculations
- Multiple video dip to black chaining

Validates: Requirements 2.3, 2.8
"""

import sys
from pathlib import Path
from unittest.mock import patch

# Add parent directory to path for imports
root_dir = Path(__file__).parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import pytest
from backend.services.concat_worker import (
    _apply_transitions,
    _build_dip_to_black_filter,
    _build_ffmpeg_concat,
)


class TestDipToBlackTransition:
    """Tests for dip to black transition implementation"""
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_dip_to_black_two_videos(self, mock_get_file_info):
        """
        Test dip to black transition between two videos
        Validates: Requirements 2.3, 2.8
        """
        # Mock video durations: 10s each
        mock_get_file_info.side_effect = [
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        video_labels = ["[v0]", "[v1]"]
        transition_duration = 1.0
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="dip_to_black",
            transition_duration=transition_duration,
        )
        
        # Expected fade duration: 1.0 / 2 = 0.5s
        # [v0]fade=t=out:st=9.5:d=0.5[v0f];
        # [v1]fade=t=in:st=0:d=0.5[v1f];
        # [v0f][v1f]concat=n=2:v=1:a=0[vout]
        
        assert "fade=t=out" in filter_str
        assert "fade=t=in" in filter_str
        assert "st=9.5" in filter_str  # Fade out starts at 10.0 - 0.5
        assert "st=0" in filter_str  # Fade in starts at 0
        assert "d=0.5" in filter_str  # Fade duration
        assert "[v0f][v1f]concat" in filter_str
        assert "[vout]" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_dip_to_black_three_videos(self, mock_get_file_info):
        """
        Test dip to black transition between three videos
        Validates: Requirements 2.3, 2.8
        """
        # Mock video durations: 10s each
        mock_get_file_info.side_effect = [
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = [
            "/path/to/video1.mp4",
            "/path/to/video2.mp4",
            "/path/to/video3.mp4",
        ]
        video_labels = ["[v0]", "[v1]", "[v2]"]
        transition_duration = 1.0
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="dip_to_black",
            transition_duration=transition_duration,
        )
        
        # First video: fade out only
        assert "[v0]fade=t=out:st=9.5:d=0.5[v0f]" in filter_str
        
        # Middle video: fade in and fade out
        assert "[v1]fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v1f]" in filter_str
        
        # Last video: fade in only
        assert "[v2]fade=t=in:st=0:d=0.5[v2f]" in filter_str
        
        # Concat all faded videos
        assert "[v0f][v1f][v2f]concat=n=3:v=1:a=0[vout]" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_dip_to_black_different_durations(self, mock_get_file_info):
        """
        Test dip to black with videos of different durations
        Validates: Requirements 2.3, 2.8
        """
        # Mock video durations: 5s, 15s
        mock_get_file_info.side_effect = [
            {"duration": 5.0, "width": 1920, "height": 1080},
            {"duration": 15.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        video_labels = ["[v0]", "[v1]"]
        transition_duration = 2.0
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="dip_to_black",
            transition_duration=transition_duration,
        )
        
        # Fade duration: 2.0 / 2 = 1.0s
        # First video fade out starts at: 5.0 - 1.0 = 4.0
        assert "st=4.0" in filter_str
        assert "d=1.0" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_dip_to_black_single_video(self, mock_get_file_info):
        """
        Test dip to black with single video (no transition needed)
        Validates: Requirements 2.3
        """
        mock_get_file_info.return_value = {
            "duration": 10.0,
            "width": 1920,
            "height": 1080,
        }
        
        input_paths = ["/path/to/video1.mp4"]
        video_labels = ["[v0]"]
        transition_duration = 1.0
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="dip_to_black",
            transition_duration=transition_duration,
        )
        
        # Should just copy the video without transitions
        assert "[v0]copy[vout]" in filter_str
        assert "fade" not in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_dip_to_black_handles_missing_duration(self, mock_get_file_info):
        """
        Test dip to black handles videos with missing duration info
        Validates: Requirements 2.3, 2.8
        """
        # Mock missing duration (returns empty dict)
        mock_get_file_info.side_effect = [
            {},  # No duration info
            {"duration": 10.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        video_labels = ["[v0]", "[v1]"]
        transition_duration = 1.0
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="dip_to_black",
            transition_duration=transition_duration,
        )
        
        # Should use default duration of 10s for missing info
        # Fade out starts at: 10.0 - 0.5 = 9.5
        assert "st=9.5" in filter_str
        assert "fade" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_dip_to_black_four_videos(self, mock_get_file_info):
        """
        Test dip to black transition between four videos
        Validates: Requirements 2.3, 2.8
        """
        # Mock video durations: 10s each
        mock_get_file_info.side_effect = [
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = [
            "/path/to/video1.mp4",
            "/path/to/video2.mp4",
            "/path/to/video3.mp4",
            "/path/to/video4.mp4",
        ]
        video_labels = ["[v0]", "[v1]", "[v2]", "[v3]"]
        transition_duration = 1.0
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="dip_to_black",
            transition_duration=transition_duration,
        )
        
        # First video: fade out only
        assert "[v0]fade=t=out" in filter_str
        
        # Middle videos: fade in and fade out
        assert "[v1]fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v1f]" in filter_str
        assert "[v2]fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v2f]" in filter_str
        
        # Last video: fade in only
        assert "[v3]fade=t=in" in filter_str
        
        # Concat all faded videos
        assert "[v0f][v1f][v2f][v3f]concat=n=4:v=1:a=0[vout]" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_dip_to_black_short_transition(self, mock_get_file_info):
        """
        Test dip to black with short transition duration (0.5s)
        Validates: Requirements 2.8
        """
        mock_get_file_info.side_effect = [
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        video_labels = ["[v0]", "[v1]"]
        transition_duration = 0.5
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="dip_to_black",
            transition_duration=transition_duration,
        )
        
        # Fade duration: 0.5 / 2 = 0.25s
        # Fade out starts at: 10.0 - 0.25 = 9.75
        assert "d=0.2" in filter_str or "d=0.25" in filter_str
        assert "st=9.8" in filter_str or "st=9.75" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_dip_to_black_long_transition(self, mock_get_file_info):
        """
        Test dip to black with long transition duration (3.0s)
        Validates: Requirements 2.8
        """
        mock_get_file_info.side_effect = [
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        video_labels = ["[v0]", "[v1]"]
        transition_duration = 3.0
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="dip_to_black",
            transition_duration=transition_duration,
        )
        
        # Fade duration: 3.0 / 2 = 1.5s
        # Fade out starts at: 10.0 - 1.5 = 8.5
        assert "d=1.5" in filter_str
        assert "st=8.5" in filter_str


class TestDipToBlackIntegration:
    """Integration tests for dip to black in full FFmpeg command"""
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_ffmpeg_command_includes_dip_to_black(self, mock_get_file_info):
        """
        Test that FFmpeg command includes dip to black filter when specified
        Validates: Requirements 2.3, 2.8
        """
        mock_get_file_info.side_effect = [
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=None,
            transition_type="dip_to_black",
            transition_duration=1.0,
            scale_filter=None,
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use complex concat (no temp file)
        assert temp_file is None
        
        # Verify filter_complex is in command
        assert "-filter_complex" in cmd
        
        # Get filter_complex string
        filter_idx = cmd.index("-filter_complex")
        filter_str = cmd[filter_idx + 1]
        
        # Verify fade filters are in filter
        assert "fade=t=out" in filter_str
        assert "fade=t=in" in filter_str
        assert "d=0.5" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_ffmpeg_command_dip_to_black_with_scaling(self, mock_get_file_info):
        """
        Test dip to black works with video scaling
        Validates: Requirements 2.3, 3.8
        """
        mock_get_file_info.side_effect = [
            {"duration": 10.0, "width": 1920, "height": 1080},
            {"duration": 10.0, "width": 1280, "height": 720},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=None,
            transition_type="dip_to_black",
            transition_duration=1.5,
            scale_filter="1920:1080",
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Get filter_complex string
        filter_idx = cmd.index("-filter_complex")
        filter_str = cmd[filter_idx + 1]
        
        # Verify both scaling and dip to black are present
        assert "scale=1920:1080" in filter_str
        assert "fade=t=out" in filter_str
        assert "fade=t=in" in filter_str
        
        # Verify scaled video labels are used in fade
        assert "[v0]fade" in filter_str
        assert "[v1]fade" in filter_str


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
