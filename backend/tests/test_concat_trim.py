"""
Unit tests for trim support in video concatenation.

Tests cover:
- Trim settings applied using -ss (start time) and -t (duration) flags
- Trim settings for individual videos in the sequence
- Trim settings with transitions
- Trim settings with scaling

Validates: Requirements 6.1, 6.2, 6.4, 6.10
"""

import sys
from pathlib import Path
from unittest.mock import patch

# Add parent directory to path for imports
root_dir = Path(__file__).parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import pytest
from backend.services.concat_worker import _build_ffmpeg_concat, _build_complex_concat


class TestTrimSupport:
    """Tests for trim support in video concatenation"""
    
    def test_trim_single_video_start_and_end(self):
        """
        Test trim with both start and end times specified
        Validates: Requirements 6.1, 6.2, 6.4, 6.10
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Trim first video: start at 5s, end at 15s (duration = 10s)
        trim_settings = {
            "/path/to/video1.mp4": {"start": 5.0, "end": 15.0}
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter=None,
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use complex concat (no temp file) because trim is specified
        assert temp_file is None
        
        # Verify -ss and -t flags are present for first video
        assert "-ss" in cmd
        assert "5.0" in cmd
        assert "-t" in cmd
        assert "10.0" in cmd  # duration = end - start = 15 - 5 = 10
        
        # Verify input file follows trim flags
        ss_idx = cmd.index("-ss")
        assert cmd[ss_idx + 1] == "5.0"
        t_idx = cmd.index("-t")
        assert cmd[t_idx + 1] == "10.0"
        i_idx = cmd.index("-i", ss_idx)
        assert cmd[i_idx + 1] == "/path/to/video1.mp4"
    
    def test_trim_multiple_videos(self):
        """
        Test trim settings for multiple videos
        Validates: Requirements 6.1, 6.2, 6.4, 6.10
        """
        input_paths = [
            "/path/to/video1.mp4",
            "/path/to/video2.mp4",
            "/path/to/video3.mp4",
        ]
        output_path = "/path/to/output.mp4"
        
        # Trim all videos with different settings
        trim_settings = {
            "/path/to/video1.mp4": {"start": 2.0, "end": 12.0},
            "/path/to/video2.mp4": {"start": 5.0, "end": 20.0},
            "/path/to/video3.mp4": {"start": 0.0, "end": 8.0},
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter=None,
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use complex concat
        assert temp_file is None
        
        # Count -ss and -t flags (should have 3 pairs)
        ss_count = cmd.count("-ss")
        t_count = cmd.count("-t")
        assert ss_count == 3
        assert t_count == 3
        
        # Verify first video trim: start=2.0, duration=10.0
        cmd_str = " ".join(cmd)
        assert "-ss 2.0 -t 10.0 -i /path/to/video1.mp4" in cmd_str
        
        # Verify second video trim: start=5.0, duration=15.0
        assert "-ss 5.0 -t 15.0 -i /path/to/video2.mp4" in cmd_str
        
        # Verify third video trim: start=0.0, duration=8.0
        assert "-ss 0.0 -t 8.0 -i /path/to/video3.mp4" in cmd_str
    
    def test_trim_only_start_time(self):
        """
        Test trim with only start time specified (no end time)
        Validates: Requirements 6.1, 6.4, 6.10
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Trim first video: start at 5s, no end time (use full remaining duration)
        trim_settings = {
            "/path/to/video1.mp4": {"start": 5.0}
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter=None,
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use complex concat
        assert temp_file is None
        
        # Verify -ss flag is present but -t is not for first video
        cmd_str = " ".join(cmd)
        assert "-ss 5.0 -i /path/to/video1.mp4" in cmd_str
        
        # Second video should not have trim flags
        assert "-i /path/to/video2.mp4" in cmd_str
    
    def test_trim_partial_videos(self):
        """
        Test trim settings for some videos but not all
        Validates: Requirements 6.1, 6.2, 6.4, 6.10
        """
        input_paths = [
            "/path/to/video1.mp4",
            "/path/to/video2.mp4",
            "/path/to/video3.mp4",
        ]
        output_path = "/path/to/output.mp4"
        
        # Trim only first and third videos
        trim_settings = {
            "/path/to/video1.mp4": {"start": 2.0, "end": 10.0},
            "/path/to/video3.mp4": {"start": 5.0, "end": 15.0},
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter=None,
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use complex concat
        assert temp_file is None
        
        cmd_str = " ".join(cmd)
        
        # First video should have trim
        assert "-ss 2.0 -t 8.0 -i /path/to/video1.mp4" in cmd_str
        
        # Second video should NOT have trim
        # Find the second -i flag
        i_indices = [i for i, x in enumerate(cmd) if x == "-i"]
        assert len(i_indices) == 3
        second_i_idx = i_indices[1]
        # Check that there's no -ss or -t immediately before second -i
        assert cmd[second_i_idx - 1] != "-t"
        assert cmd[second_i_idx - 2] != "-ss"
        
        # Third video should have trim
        assert "-ss 5.0 -t 10.0 -i /path/to/video3.mp4" in cmd_str
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_trim_with_crossfade_transition(self, mock_get_file_info):
        """
        Test trim settings work with crossfade transitions
        Validates: Requirements 6.4, 6.10, 2.2
        """
        # Mock video durations (these are the ORIGINAL durations before trim)
        mock_get_file_info.side_effect = [
            {"duration": 20.0, "width": 1920, "height": 1080},
            {"duration": 30.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Trim both videos
        trim_settings = {
            "/path/to/video1.mp4": {"start": 5.0, "end": 15.0},  # 10s duration
            "/path/to/video2.mp4": {"start": 10.0, "end": 25.0},  # 15s duration
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
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
        
        # Should use complex concat
        assert temp_file is None
        
        # Verify trim flags are present
        cmd_str = " ".join(cmd)
        assert "-ss 5.0 -t 10.0 -i /path/to/video1.mp4" in cmd_str
        assert "-ss 10.0 -t 15.0 -i /path/to/video2.mp4" in cmd_str
        
        # Verify crossfade filter is present
        assert "-filter_complex" in cmd
        filter_idx = cmd.index("-filter_complex")
        filter_str = cmd[filter_idx + 1]
        assert "xfade" in filter_str
        assert "transition=fade" in filter_str
    
    def test_trim_with_scaling(self):
        """
        Test trim settings work with video scaling
        Validates: Requirements 6.4, 6.10, 3.8
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Trim first video
        trim_settings = {
            "/path/to/video1.mp4": {"start": 3.0, "end": 13.0},
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter="1920:1080",  # Scale to 1080p
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use complex concat
        assert temp_file is None
        
        # Verify trim flags are present
        cmd_str = " ".join(cmd)
        assert "-ss 3.0 -t 10.0 -i /path/to/video1.mp4" in cmd_str
        
        # Verify scaling filter is present
        assert "-filter_complex" in cmd
        filter_idx = cmd.index("-filter_complex")
        filter_str = cmd[filter_idx + 1]
        assert "scale=1920:1080" in filter_str
    
    def test_trim_zero_start_time(self):
        """
        Test trim with start time of 0 (trim from beginning)
        Validates: Requirements 6.1, 6.2, 6.4, 6.10
        """
        input_paths = ["/path/to/video1.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Trim from start: 0s to 10s
        trim_settings = {
            "/path/to/video1.mp4": {"start": 0.0, "end": 10.0},
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter=None,
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use complex concat
        assert temp_file is None
        
        # Verify trim flags
        cmd_str = " ".join(cmd)
        assert "-ss 0.0 -t 10.0 -i /path/to/video1.mp4" in cmd_str
    
    def test_trim_forces_complex_concat(self):
        """
        Test that presence of trim settings forces complex concat even without other features
        Validates: Requirements 6.4, 6.10
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Trim settings present
        trim_settings = {
            "/path/to/video1.mp4": {"start": 1.0, "end": 5.0},
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",  # No transitions
            transition_duration=1.0,
            scale_filter=None,  # No scaling
            crf_str="18",
            mute_original_audio=False,  # No audio processing
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use complex concat (no temp file) because trim is specified
        assert temp_file is None
        
        # Should NOT use concat demuxer
        assert "-f" not in cmd or "concat" not in cmd[cmd.index("-f") + 1] if "-f" in cmd else True
        
        # Should use filter_complex
        assert "-filter_complex" in cmd
    
    def test_no_trim_uses_simple_concat(self):
        """
        Test that absence of trim settings allows simple concat when no other features
        Validates: Requirements 2.1
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        # No trim settings
        trim_settings = None
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",  # No transitions
            transition_duration=1.0,
            scale_filter=None,  # No scaling
            crf_str="18",
            mute_original_audio=False,  # No audio processing
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use simple concat (temp file present)
        assert temp_file is not None
        
        # Should use concat demuxer
        assert "-f" in cmd
        assert "concat" in cmd
        assert "-c" in cmd
        assert "copy" in cmd
        
        # Clean up temp file
        import os
        os.remove(temp_file)
    
    def test_empty_trim_settings_dict(self):
        """
        Test that empty trim settings dict is treated as no trim
        Validates: Requirements 6.4, 6.10
        """
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Empty trim settings dict
        trim_settings = {}
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter=None,
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Should use simple concat (temp file present) because no actual trim values
        assert temp_file is not None
        
        # Clean up temp file
        import os
        os.remove(temp_file)


class TestTrimEdgeCases:
    """Edge case tests for trim functionality"""
    
    def test_trim_with_fractional_seconds(self):
        """
        Test trim with fractional second values
        Validates: Requirements 6.1, 6.2, 6.4, 6.10
        """
        input_paths = ["/path/to/video1.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Trim with fractional seconds
        trim_settings = {
            "/path/to/video1.mp4": {"start": 2.5, "end": 12.75},
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
            transition_type="cut",
            transition_duration=1.0,
            scale_filter=None,
            crf_str="18",
            mute_original_audio=False,
            enable_audio_fade=False,
            audio_fade_duration=2.0,
            background_music_path=None,
            background_music_volume=50,
        )
        
        # Verify fractional values are preserved
        cmd_str = " ".join(cmd)
        assert "-ss 2.5" in cmd_str
        assert "-t 10.25" in cmd_str  # duration = 12.75 - 2.5 = 10.25
    
    @patch('backend.services.concat_worker.get_file_info')
    def test_trim_with_dip_to_black_transition(self, mock_get_file_info):
        """
        Test trim settings work with dip to black transitions
        Validates: Requirements 6.4, 6.10, 2.3
        """
        # Mock video durations
        mock_get_file_info.side_effect = [
            {"duration": 20.0, "width": 1920, "height": 1080},
            {"duration": 25.0, "width": 1920, "height": 1080},
        ]
        
        input_paths = ["/path/to/video1.mp4", "/path/to/video2.mp4"]
        output_path = "/path/to/output.mp4"
        
        # Trim both videos
        trim_settings = {
            "/path/to/video1.mp4": {"start": 5.0, "end": 15.0},
            "/path/to/video2.mp4": {"start": 5.0, "end": 20.0},
        }
        
        cmd, temp_file = _build_ffmpeg_concat(
            ffmpeg_exe="ffmpeg",
            input_paths=input_paths,
            output_path=output_path,
            trim_settings=trim_settings,
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
        
        # Should use complex concat
        assert temp_file is None
        
        # Verify trim flags
        cmd_str = " ".join(cmd)
        assert "-ss 5.0 -t 10.0 -i /path/to/video1.mp4" in cmd_str
        assert "-ss 5.0 -t 15.0 -i /path/to/video2.mp4" in cmd_str
        
        # Verify dip to black filter is present
        assert "-filter_complex" in cmd
        filter_idx = cmd.index("-filter_complex")
        filter_str = cmd[filter_idx + 1]
        assert "fade" in filter_str


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
