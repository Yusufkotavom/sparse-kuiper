"""
Unit tests for concat API endpoints.

Tests cover:
- POST /api/v1/concat/run with valid configuration
- GET /api/v1/concat/status/{job_id} for job status
- POST /api/v1/concat/cancel/{job_id} for cancellation
- GET /api/v1/concat/file-info for video metadata
- Error responses (404, 400, 500)

Validates: Requirements 4.1, 4.3, 4.8
"""

import sys
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import tempfile
import os

# Add parent directory to path for imports
root_dir = Path(__file__).parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.concat_worker import JOBS, ConcatJobStatus


@pytest.fixture
def client():
    """Create FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def temp_project_dir():
    """Create temporary project directory with test video files"""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_path = Path(tmpdir) / "test_project"
        project_path.mkdir()
        
        # Create raw subdirectory
        raw_dir = project_path / "raw"
        raw_dir.mkdir()
        
        # Create dummy video files
        video1 = raw_dir / "video1.mp4"
        video2 = raw_dir / "video2.mp4"
        music = raw_dir / "music.mp3"
        
        # Write some dummy content
        video1.write_bytes(b"fake video content 1")
        video2.write_bytes(b"fake video content 2")
        music.write_bytes(b"fake music content")
        
        yield project_path


@pytest.fixture(autouse=True)
def clear_jobs():
    """Clear job registry before and after each test"""
    JOBS.clear()
    yield
    JOBS.clear()


class TestConcatRunEndpoint:
    """Tests for POST /api/v1/concat/run endpoint"""
    
    def test_run_returns_job_id_with_valid_config(self, client, temp_project_dir):
        """
        Test POST /run with valid configuration returns job_id
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            with patch("backend.services.concat_worker.run_concat_job"):
                payload = {
                    "project": "test_project",
                    "files": ["raw/video1.mp4", "raw/video2.mp4"],
                    "output_suffix": "_test",
                    "transition_type": "cut",
                    "transition_duration": 1.0,
                    "resolution": "original",
                    "quality": "high",
                    "mute_original_audio": False,
                    "enable_audio_fade": True,
                    "audio_fade_duration": 2.0,
                    "background_music_volume": 50,
                }
                
                response = client.post("/api/v1/concat/run", json=payload)
                
                assert response.status_code == 200
                data = response.json()
                assert "job_id" in data
                assert "message" in data
                assert len(data["job_id"]) > 0
                assert "Job dimulai" in data["message"]
    
    def test_run_fails_with_nonexistent_project(self, client, temp_project_dir):
        """
        Test POST /run with nonexistent project returns 404
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            payload = {
                "project": "nonexistent_project",
                "files": ["raw/video1.mp4", "raw/video2.mp4"],
            }
            
            response = client.post("/api/v1/concat/run", json=payload)
            
            assert response.status_code == 404
            assert "tidak ditemukan" in response.json()["detail"]
    
    def test_run_fails_with_nonexistent_file(self, client, temp_project_dir):
        """
        Test POST /run with nonexistent file returns 404
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            payload = {
                "project": "test_project",
                "files": ["raw/video1.mp4", "raw/nonexistent.mp4"],
            }
            
            response = client.post("/api/v1/concat/run", json=payload)
            
            assert response.status_code == 404
            assert "tidak ditemukan" in response.json()["detail"]
    
    def test_run_fails_with_single_file(self, client, temp_project_dir):
        """
        Test POST /run with single file returns 422 (validation error)
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            payload = {
                "project": "test_project",
                "files": ["raw/video1.mp4"],  # Only one file
            }
            
            response = client.post("/api/v1/concat/run", json=payload)
            
            # Pydantic validation should fail (min_length=2)
            assert response.status_code == 422
    
    def test_run_fails_with_empty_file_path(self, client, temp_project_dir):
        """
        Test POST /run with empty file path returns 400
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            payload = {
                "project": "test_project",
                "files": ["", "raw/video2.mp4"],
            }
            
            response = client.post("/api/v1/concat/run", json=payload)
            
            assert response.status_code == 400
            assert "tidak boleh kosong" in response.json()["detail"]
    
    def test_run_prevents_path_traversal(self, client, temp_project_dir):
        """
        Test POST /run prevents path traversal attacks
        Validates: Requirements 11.10
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            payload = {
                "project": "test_project",
                "files": ["../../../etc/passwd", "raw/video2.mp4"],
            }
            
            response = client.post("/api/v1/concat/run", json=payload)
            
            assert response.status_code == 400
            assert "tidak diizinkan" in response.json()["detail"]
    
    def test_run_with_background_music(self, client, temp_project_dir):
        """
        Test POST /run with background music file
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            with patch("backend.services.concat_worker.run_concat_job"):
                payload = {
                    "project": "test_project",
                    "files": ["raw/video1.mp4", "raw/video2.mp4"],
                    "background_music_file": "raw/music.mp3",
                    "background_music_volume": 75,
                }
                
                response = client.post("/api/v1/concat/run", json=payload)
                
                assert response.status_code == 200
                data = response.json()
                assert "job_id" in data
    
    def test_run_fails_with_nonexistent_background_music(self, client, temp_project_dir):
        """
        Test POST /run with nonexistent background music returns 404
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            payload = {
                "project": "test_project",
                "files": ["raw/video1.mp4", "raw/video2.mp4"],
                "background_music_file": "raw/nonexistent_music.mp3",
            }
            
            response = client.post("/api/v1/concat/run", json=payload)
            
            assert response.status_code == 404
            assert "Background music tidak ditemukan" in response.json()["detail"]


class TestConcatStatusEndpoint:
    """Tests for GET /api/v1/concat/status/{job_id} endpoint"""
    
    def test_status_returns_correct_job_status(self, client):
        """
        Test GET /status returns correct job status
        Validates: Requirements 4.3
        """
        # Create a mock job
        job = ConcatJobStatus(
            job_id="test-job-123",
            status="running",
            progress=50,
            stage=2,
            stage_label="Menjalankan Concat",
            current_video="video1.mp4",
        )
        JOBS[job.job_id] = job
        
        response = client.get(f"/api/v1/concat/status/{job.job_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == "test-job-123"
        assert data["status"] == "running"
        assert data["progress"] == 50
        assert data["stage"] == 2
        assert data["stage_label"] == "Menjalankan Concat"
        assert data["current_video"] == "video1.mp4"
        assert data["output_path"] is None
        assert data["error"] is None
    
    def test_status_returns_completed_job(self, client):
        """
        Test GET /status returns completed job with output_path
        Validates: Requirements 4.3
        """
        job = ConcatJobStatus(
            job_id="test-job-456",
            status="done",
            progress=100,
            stage=4,
            stage_label="Selesai!",
            output_path="/path/to/output.mp4",
            finished_at=1234567890.0,
        )
        JOBS[job.job_id] = job
        
        response = client.get(f"/api/v1/concat/status/{job.job_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "done"
        assert data["progress"] == 100
        assert data["output_path"] == "/path/to/output.mp4"
        assert data["finished_at"] == 1234567890.0
    
    def test_status_returns_error_job(self, client):
        """
        Test GET /status returns error job with error message
        Validates: Requirements 4.3
        """
        job = ConcatJobStatus(
            job_id="test-job-789",
            status="error",
            progress=30,
            error="FFmpeg failed: invalid codec",
            finished_at=1234567890.0,
        )
        JOBS[job.job_id] = job
        
        response = client.get(f"/api/v1/concat/status/{job.job_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"
        assert data["error"] == "FFmpeg failed: invalid codec"
        assert data["finished_at"] == 1234567890.0
    
    def test_status_returns_404_for_nonexistent_job(self, client):
        """
        Test GET /status returns 404 for nonexistent job
        Validates: Requirements 4.3
        """
        response = client.get("/api/v1/concat/status/nonexistent-job-id")
        
        assert response.status_code == 404
        assert "tidak ditemukan" in response.json()["detail"]


class TestConcatCancelEndpoint:
    """Tests for POST /api/v1/concat/cancel/{job_id} endpoint"""
    
    def test_cancel_sets_cancel_requested_flag(self, client):
        """
        Test POST /cancel sets cancel_requested flag
        Validates: Requirements 4.8
        """
        job = ConcatJobStatus(
            job_id="test-job-cancel-1",
            status="running",
            progress=40,
        )
        JOBS[job.job_id] = job
        
        response = client.post(f"/api/v1/concat/cancel/{job.job_id}")
        
        assert response.status_code == 200
        assert "Permintaan pembatalan dikirim" in response.json()["message"]
        assert job.cancel_requested is True
    
    def test_cancel_pending_job(self, client):
        """
        Test POST /cancel works for pending job
        Validates: Requirements 4.8
        """
        job = ConcatJobStatus(
            job_id="test-job-cancel-2",
            status="pending",
            progress=0,
        )
        JOBS[job.job_id] = job
        
        response = client.post(f"/api/v1/concat/cancel/{job.job_id}")
        
        assert response.status_code == 200
        assert job.cancel_requested is True
    
    def test_cancel_completed_job_returns_message(self, client):
        """
        Test POST /cancel on completed job returns appropriate message
        Validates: Requirements 4.8
        """
        job = ConcatJobStatus(
            job_id="test-job-cancel-3",
            status="done",
            progress=100,
        )
        JOBS[job.job_id] = job
        
        response = client.post(f"/api/v1/concat/cancel/{job.job_id}")
        
        assert response.status_code == 200
        assert "tidak bisa dibatalkan" in response.json()["message"]
        assert job.cancel_requested is False  # Should not set flag
    
    def test_cancel_error_job_returns_message(self, client):
        """
        Test POST /cancel on error job returns appropriate message
        Validates: Requirements 4.8
        """
        job = ConcatJobStatus(
            job_id="test-job-cancel-4",
            status="error",
            progress=50,
            error="Some error",
        )
        JOBS[job.job_id] = job
        
        response = client.post(f"/api/v1/concat/cancel/{job.job_id}")
        
        assert response.status_code == 200
        assert "tidak bisa dibatalkan" in response.json()["message"]
    
    def test_cancel_returns_404_for_nonexistent_job(self, client):
        """
        Test POST /cancel returns 404 for nonexistent job
        Validates: Requirements 4.8
        """
        response = client.post("/api/v1/concat/cancel/nonexistent-job-id")
        
        assert response.status_code == 404
        assert "tidak ditemukan" in response.json()["detail"]


class TestConcatFileInfoEndpoint:
    """Tests for GET /api/v1/concat/file-info endpoint"""
    
    def test_file_info_returns_video_metadata(self, client, temp_project_dir):
        """
        Test GET /file-info returns video metadata
        Validates: Requirements 11.10
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            with patch("backend.routers.concat.get_file_info") as mock_get_file_info:
                mock_get_file_info.return_value = {
                    "duration": 120.5,
                    "width": 1920,
                    "height": 1080,
                    "fps": 30.0,
                    "size_mb": 45.2,
                }
                
                response = client.get(
                    "/api/v1/concat/file-info",
                    params={"project": "test_project", "file": "raw/video1.mp4"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data["duration"] == 120.5
                assert data["width"] == 1920
                assert data["height"] == 1080
                assert data["fps"] == 30.0
                assert data["size_mb"] == 45.2
    
    def test_file_info_returns_404_for_nonexistent_file(self, client, temp_project_dir):
        """
        Test GET /file-info returns 404 for nonexistent file
        Validates: Requirements 11.10
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            response = client.get(
                "/api/v1/concat/file-info",
                params={"project": "test_project", "file": "raw/nonexistent.mp4"}
            )
            
            assert response.status_code == 404
            assert "tidak ditemukan" in response.json()["detail"]
    
    def test_file_info_returns_500_when_ffprobe_fails(self, client, temp_project_dir):
        """
        Test GET /file-info returns 500 when ffprobe fails
        Validates: Requirements 11.10
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            with patch("backend.routers.concat.get_file_info") as mock_get_file_info:
                mock_get_file_info.return_value = None  # Simulate ffprobe failure
                
                response = client.get(
                    "/api/v1/concat/file-info",
                    params={"project": "test_project", "file": "raw/video1.mp4"}
                )
                
                assert response.status_code == 500
                assert "Gagal membaca metadata" in response.json()["detail"]
    
    def test_file_info_prevents_path_traversal(self, client, temp_project_dir):
        """
        Test GET /file-info prevents path traversal attacks
        Validates: Requirements 11.10
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            response = client.get(
                "/api/v1/concat/file-info",
                params={"project": "test_project", "file": "../../../etc/passwd"}
            )
            
            assert response.status_code == 400
            assert "tidak diizinkan" in response.json()["detail"]
    
    def test_file_info_handles_empty_file_parameter(self, client, temp_project_dir):
        """
        Test GET /file-info handles empty file parameter
        Validates: Requirements 11.10
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            response = client.get(
                "/api/v1/concat/file-info",
                params={"project": "test_project", "file": ""}
            )
            
            assert response.status_code == 400
            assert "tidak boleh kosong" in response.json()["detail"]
    
    def test_file_info_normalizes_path_with_video_projects_prefix(self, client, temp_project_dir):
        """
        Test GET /file-info normalizes paths with /video_projects/ prefix
        Validates: Requirements 11.10
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            with patch("backend.routers.concat.get_file_info") as mock_get_file_info:
                mock_get_file_info.return_value = {
                    "duration": 60.0,
                    "width": 1280,
                    "height": 720,
                    "fps": 24.0,
                    "size_mb": 20.5,
                }
                
                # Test with /video_projects/ prefix
                response = client.get(
                    "/api/v1/concat/file-info",
                    params={
                        "project": "test_project",
                        "file": "/video_projects/test_project/raw/video1.mp4"
                    }
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data["duration"] == 60.0


class TestConcatErrorHandling:
    """Tests for error handling across concat endpoints"""
    
    def test_run_handles_missing_required_fields(self, client):
        """
        Test POST /run handles missing required fields
        Validates: Requirements 4.1
        """
        payload = {
            "project": "test_project",
            # Missing 'files' field
        }
        
        response = client.post("/api/v1/concat/run", json=payload)
        
        assert response.status_code == 422  # Validation error
    
    def test_run_handles_invalid_transition_duration(self, client, temp_project_dir):
        """
        Test POST /run handles invalid transition duration
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            payload = {
                "project": "test_project",
                "files": ["raw/video1.mp4", "raw/video2.mp4"],
                "transition_duration": 5.0,  # Exceeds max of 3.0
            }
            
            response = client.post("/api/v1/concat/run", json=payload)
            
            assert response.status_code == 422  # Validation error
    
    def test_run_handles_invalid_background_music_volume(self, client, temp_project_dir):
        """
        Test POST /run handles invalid background music volume
        Validates: Requirements 4.1
        """
        with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
            payload = {
                "project": "test_project",
                "files": ["raw/video1.mp4", "raw/video2.mp4"],
                "background_music_volume": 150,  # Exceeds max of 100
            }
            
            response = client.post("/api/v1/concat/run", json=payload)
            
            assert response.status_code == 422  # Validation error
