"""
Unit tests for crossfade transition implementation.

Tests cover:
- _apply_transitions() function generates correct xfade filters
- Crossfade offset calculation based on video durations
- Multiple video crossfade chaining

Validates: Requirements 2.2, 2.5, 2.6, 2.7
"""

import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
root_dir = Path(__file__).parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import pytest
from backend.services.concat_worker import (
    _apply_transitions,
    _build_crossfade_filter,
    _build_ffmpeg_concat,
)


class TestCrossfadeTransition:
    """Tests for crossfade transition implementation"""
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_crossfade_two_videos(self, mock_get_file_info):
        """
        Test crossfade transition between two videos
        Validates: Requirements 2.2, 2.6, 2.7
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
            transition_type="crossfade",
            transition_duration=transition_duration,
        )
        
        # Expected: [v0][v1]xfade=transition=fade:duration=1.0:offset=9.0[vout]
        assert "xfade" in filter_str
        assert "transition=fade" in filter_str
        assert "duration=1.0" in filter_str
        assert "offset=9.0" in filter_str
        assert "[v0][v1]" in filter_str
        assert "[vout]" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_crossfade_three_videos(self, mock_get_file_info):
        """
        Test crossfade transition between three videos
        Validates: Requirements 2.2, 2.5, 2.6, 2.7
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
            transition_type="crossfade",
            transition_duration=transition_duration,
        )
        
        # Expected:
        # [v0][v1]xfade=transition=fade:duration=1.0:offset=9.0[vx01];
        # [vx01][v2]xfade=transition=fade:duration=1.0:offset=18.0[vout]
        
        # Verify first transition
        assert "[v0][v1]xfade" in filter_str
        assert "offset=9.0[vx01]" in filter_str
        
        # Verify second transition
        assert "[vx01][v2]xfade" in filter_str
        assert "offset=18.0[vout]" in filter_str
        
        # Verify filter chaining with semicolon
        assert ";" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_crossfade_different_durations(self, mock_get_file_info):
        """
        Test crossfade with videos of different durations
        Validates: Requirements 2.2, 2.6, 2.7
        """
        # Mock video durations: 5s, 15s, 8s
        mock_get_file_info.side_effect = [
            {"duration": 5.0, "width": 1920, "height": 1080},
            {"duration": 15.0, "width": 1920, "height": 1080},
            {"duration": 8.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = [
            "/path/to/video1.mp4",
            "/path/to/video2.mp4",
            "/path/to/video3.mp4",
        ]
        video_labels = ["[v0]", "[v1]", "[v2]"]
        transition_duration = 1.5
        
        filter_str = _apply_transitions(
            input_paths=input_paths,
            video_labels=video_labels,
            transition_type="crossfade",
            transition_duration=transition_duration,
        )
        
        # First transition offset: 5.0 - 1.5 = 3.5
        assert "offset=3.5[vx01]" in filter_str
        
        # Second transition offset: (5.0 - 1.5) + 15.0 - 1.5 = 17.0
        assert "offset=17.0[vout]" in filter_str
        
        # Verify transition duration
        assert "duration=1.5" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_crossfade_single_video(self, mock_get_file_info):
        """
        Test crossfade with single video (no transition needed)
        Validates: Requirements 2.2
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
            transition_type="crossfade",
            transition_duration=transition_duration,
        )
        
        # Should just copy the video without transitions
        assert "[v0]copy[vout]" in filter_str
        assert "xfade" not in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_crossfade_handles_missing_duration(self, mock_get_file_info):
        """
        Test crossfade handles videos with missing duration info
        Validates: Requirements 2.2, 2.6
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
            transition_type="crossfade",
            transition_duration=transition_duration,
        )
        
        # Should use default duration of 10s for missing info
        # Offset: 10.0 - 1.0 = 9.0
        assert "offset=9.0[vout]" in filter_str
        assert "xfade" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_crossfade_four_videos(self, mock_get_file_info):
        """
        Test crossfade transition between four videos
        Validates: Requirements 2.2, 2.5
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
            transition_type="crossfade",
            transition_duration=transition_duration,
        )
        
        # Should have 3 transitions (N-1 for N videos)
        assert filter_str.count("xfade") == 3
        
        # Verify all transitions
        assert "[v0][v1]xfade" in filter_str
        assert "offset=9.0[vx01]" in filter_str
        
        assert "[vx01][v2]xfade" in filter_str
        assert "offset=18.0[vx12]" in filter_str
        
        assert "[vx12][v3]xfade" in filter_str
        assert "offset=27.0[vout]" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_crossfade_short_transition(self, mock_get_file_info):
        """
        Test crossfade with short transition duration (0.5s)
        Validates: Requirements 2.6
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
            transition_type="crossfade",
            transition_duration=transition_duration,
        )
        
        # Offset: 10.0 - 0.5 = 9.5
        assert "duration=0.5" in filter_str
        assert "offset=9.5" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_crossfade_long_transition(self, mock_get_file_info):
        """
        Test crossfade with long transition duration (3.0s)
        Validates: Requirements 2.6
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
            transition_type="crossfade",
            transition_duration=transition_duration,
        )
        
        # Offset: 10.0 - 3.0 = 7.0
        assert "duration=3.0" in filter_str
        assert "offset=7.0" in filter_str


class TestCrossfadeIntegration:
    """Integration tests for crossfade in full FFmpeg command"""
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_ffmpeg_command_includes_crossfade(self, mock_get_file_info):
        """
        Test that FFmpeg command includes crossfade filter when specified
        Validates: Requirements 2.2, 2.7
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
            transition_type="crossfade",
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
        
        # Verify crossfade is in filter
        assert "xfade" in filter_str
        assert "transition=fade" in filter_str
        assert "duration=1.0" in filter_str
        assert "offset=9.0" in filter_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_ffmpeg_command_crossfade_with_scaling(self, mock_get_file_info):
        """
        Test crossfade works with video scaling
        Validates: Requirements 2.2, 3.8
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
            transition_type="crossfade",
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
        
        # Verify both scaling and crossfade are present
        assert "scale=1920:1080" in filter_str
        assert "xfade" in filter_str
        assert "duration=1.5" in filter_str
        
        # Verify scaled video labels are used in xfade
        assert "[v0][v1]xfade" in filter_str


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
