# Implementation Plan: Video Concat

## Overview

Implementasi fitur Video Concat untuk menggabungkan multiple video files menjadi satu output dengan dukungan transisi, trimming, audio mixing, dan konfigurasi output yang fleksibel. Fitur ini mengikuti pola arsitektur yang sama dengan Looper (background job processing, preset management, FFmpeg-based processing).

## Tasks

- [ ] 1. Backend Foundation - Job Registry and API Endpoints
  - [x] 1.1 Create concat_worker.py with job registry and main pipeline
    - Create `backend/services/concat_worker.py`
    - Implement `ConcatJobStatus` dataclass with fields: job_id, status, progress, stage, stage_label, current_video, output_path, error, created_at, finished_at, cancel_requested
    - Implement in-memory job registry: `JOBS: Dict[str, ConcatJobStatus] = {}`
    - Implement `create_job()` function to generate unique job_id and register job
    - Implement `get_job(job_id: str)` function to retrieve job status
    - Implement `run_concat_job()` main pipeline function with stages: validate, build command, execute, finalize
    - Implement `_validate_inputs()` function for file existence, format, and permission validation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.1, 11.2, 11.3_

  - [x] 1.2 Write property test for job ID uniqueness
    - **Property 10: Job ID Uniqueness**
    - **Validates: Requirements 4.1, 9.3**

  - [x] 1.3 Create concat API schemas
    - Create `backend/routers/concat_schemas.py`
    - Define `TrimPoint` model with start and end fields (float)
    - Define `ConcatRunRequest` model with all configuration fields (project, files, trim_settings, output_suffix, transition_type, transition_duration, resolution, quality, audio settings)
    - Define `ConcatRunResponse` model with job_id and message
    - Define `ConcatStatusResponse` model with job status fields
    - _Requirements: 1.1, 2.1-2.4, 3.1-3.4, 6.1, 6.2, 7.1-7.11_

  - [x] 1.4 Create concat API router with core endpoints
    - Create `backend/routers/concat.py`
    - Implement POST `/api/v1/concat/run` endpoint to start concat job
    - Implement GET `/api/v1/concat/status/{job_id}` endpoint to poll job progress
    - Implement POST `/api/v1/concat/cancel/{job_id}` endpoint to cancel running job
    - Implement GET `/api/v1/concat/file-info` endpoint to get video metadata
    - Implement `_normalize_project_file()` helper for path normalization and security
    - _Requirements: 4.1, 4.3, 4.4, 4.8, 11.10_

  - [x] 1.5 Write unit tests for API endpoints
    - Test POST /run with valid configuration returns job_id
    - Test GET /status returns correct job status
    - Test POST /cancel sets cancel_requested flag
    - Test GET /file-info returns video metadata
    - Test error responses (404, 400, 500)
    - _Requirements: 4.1, 4.3, 4.8_

  - [x] 1.6 Add concat preset support to settings
    - Update `backend/routers/settings_schemas.py` to add `ConcatPreset` model
    - Update `backend/routers/settings.py` to add GET `/api/v1/settings/concat-presets` endpoint
    - Add POST `/api/v1/settings/concat-presets` endpoint to create preset
    - Add PUT `/api/v1/settings/concat-presets/{name}` endpoint to update preset
    - Add DELETE `/api/v1/settings/concat-presets/{name}` endpoint to delete preset
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 1.7 Write property test for preset round-trip persistence
    - **Property 18: Preset Round-Trip Persistence**
    - **Validates: Requirements 5.5, 5.8**

  - [x] 1.8 Write property test for preset name validation
    - **Property 19: Preset Name Validation**
    - **Validates: Requirements 5.10**

  - [x] 1.9 Register concat router in main.py
    - Update `backend/main.py` to import concat router
    - Add `app.include_router(concat.router)` to register endpoints
    - Verify backend smoke test passes: `python -c "import backend.main; print('ok')"`
    - _Requirements: 10.6_

- [x] 2. Checkpoint - Backend Foundation Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. FFmpeg Command Implementation - Simple Concat and Transitions
  - [x] 3.1 Implement simple concat without transitions
    - In `concat_worker.py`, implement `_build_ffmpeg_concat()` function
    - Implement simple concat using concat demuxer (fast, copy codec)
    - Generate concat list file with all input videos
    - Build FFmpeg command: `ffmpeg -f concat -safe 0 -i concat_list.txt -c copy output.mp4`
    - _Requirements: 1.1, 1.2, 1.3, 2.1_

  - [x] 3.2 Write unit test for simple concat command
    - Test that simple concat (no transitions, no trim) uses concat demuxer
    - Test that command includes `-c copy` for fast processing
    - _Requirements: 2.1_

  - [x] 3.3 Implement crossfade transition
    - Implement `_apply_transitions()` function for transition filter generation
    - Implement crossfade using xfade filter in filter_complex
    - Calculate offset times based on video durations and transition duration
    - Generate filter: `[v0][v1]xfade=transition=fade:duration=1.0:offset=9.0[vx01]`
    - _Requirements: 2.2, 2.6, 2.7_

  - [x] 3.4 Write property test for transition application
    - **Property 6: Transition Application Between Clips**
    - **Validates: Requirements 2.5**

  - [x] 3.5 Implement dip to black transition
    - In `_apply_transitions()`, add dip_to_black case
    - Use fade filter for fade out and fade in effects
    - Generate filter: `[v0]fade=t=out:st=9.5:d=0.5[v0f]; [v1]fade=t=in:st=0:d=0.5[v1f]`
    - _Requirements: 2.3, 2.8_

  - [-] 3.6 Implement glitch transition (optional)
    - In `_apply_transitions()`, add glitch case
    - Implement basic glitch effect using custom filter
    - _Requirements: 2.4_

  - [~] 3.7 Write property test for transition duration validation
    - **Property 5: Transition Duration Validation**
    - **Validates: Requirements 2.6**

- [ ] 4. FFmpeg Command Implementation - Trim and Resolution
  - [~] 4.1 Implement trim support
    - Implement `_apply_trim()` function to generate trim parameters
    - Add `-ss` (start time) and `-t` (duration) flags per input video
    - Calculate trimmed duration: `end - start`
    - _Requirements: 6.1, 6.2, 6.4, 6.10_

  - [~] 4.2 Write property test for trim point validation
    - **Property 20: Trim Point Validation**
    - **Validates: Requirements 6.5, 6.6**

  - [~] 4.3 Write property test for trim application in output
    - **Property 22: Trim Application in Output**
    - **Validates: Requirements 6.4, 6.10**

  - [~] 4.4 Implement resolution scaling and padding
    - Add resolution mapping: original, 1080p (1920:1080), 720p (1280:720), 480p (854:480)
    - Generate scale and pad filter: `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1`
    - Apply scaling to all input videos before concat
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.8, 3.9_

  - [~] 4.5 Write property test for resolution scaling consistency
    - **Property 8: Resolution Scaling Consistency**
    - **Validates: Requirements 3.8, 3.9**

  - [~] 4.6 Implement quality presets
    - Add CRF mapping: high (18), medium (23), low (28)
    - Add encoding parameters: `-c:v libx264 -preset fast -crf {crf}`
    - _Requirements: 3.5, 3.6, 3.7_

- [ ] 5. FFmpeg Command Implementation - Audio Mixing
  - [~] 5.1 Implement audio preservation (default)
    - Implement `_mix_audio()` function for audio filter generation
    - Concatenate audio streams from all videos: `[0:a][1:a][2:a]concat=n=3:v=0:a=1[aout]`
    - _Requirements: 7.1_

  - [~] 5.2 Write property test for audio preservation
    - **Property 24: Audio Preservation by Default**
    - **Validates: Requirements 7.1**

  - [~] 5.3 Implement audio muting
    - In `_mix_audio()`, add mute_original_audio case
    - Remove original audio streams from output
    - _Requirements: 7.2_

  - [~] 5.4 Write property test for audio muting
    - **Property 25: Audio Muting**
    - **Validates: Requirements 7.2**

  - [~] 5.5 Implement background music mixing
    - Add background music as additional input: `-i background_music.mp3`
    - Mix original audio with background music using amerge filter
    - Apply volume adjustment: `pan=stereo|c0<c0+0.5*c2|c1<c1+0.5*c3`
    - _Requirements: 7.3, 7.4, 7.5, 7.8_

  - [~] 5.6 Write property test for background music mixing
    - **Property 26: Background Music Mixing**
    - **Validates: Requirements 7.4**

  - [~] 5.7 Implement background music looping and trimming
    - Add aloop filter for music shorter than video: `aloop=loop=-1:size=2e+09`
    - Add atrim filter for music longer than video: `atrim=0:30`
    - _Requirements: 7.6, 7.7_

  - [~] 5.8 Write property test for background music looping
    - **Property 28: Background Music Looping**
    - **Validates: Requirements 7.6**

  - [~] 5.9 Implement audio fade in/out
    - Add afade filter for fade-in at start: `afade=t=in:st=0:d=2.0`
    - Add afade filter for fade-out at end: `afade=t=out:st=28:d=2.0`
    - _Requirements: 7.9, 7.10, 7.11_

  - [~] 5.10 Write property test for audio fade application
    - **Property 30: Audio Fade Application**
    - **Validates: Requirements 7.9, 7.10**

- [ ] 6. Checkpoint - FFmpeg Implementation Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. FFmpeg Progress Monitoring and Error Handling
  - [~] 7.1 Implement FFmpeg progress monitoring
    - Parse FFmpeg stderr output in real-time
    - Extract time progress using regex: `time=(\d+):(\d+):(\d+\.\d+)`
    - Calculate progress percentage: `(current_time / total_duration) * 100`
    - Update job.progress and job.stage_label every 2 seconds
    - _Requirements: 4.3, 4.4, 4.5, 8.1, 8.2, 8.6_

  - [~] 7.2 Write property test for progress range invariant
    - **Property 11: Progress Range Invariant**
    - **Validates: Requirements 4.3**

  - [~] 7.3 Implement job cancellation
    - Check job.cancel_requested flag between pipeline stages
    - Terminate FFmpeg subprocess gracefully (SIGTERM)
    - Force kill if not terminated in 5 seconds (SIGKILL)
    - Clean up temporary files on cancellation
    - _Requirements: 4.8, 4.9_

  - [~] 7.4 Write property test for job cancellation
    - **Property 15: Job Cancellation**
    - **Validates: Requirements 4.8**

  - [~] 7.5 Implement error handling and capture
    - Capture FFmpeg stderr output on failure
    - Set job.status to "error" and job.error to stderr content
    - Handle FileNotFoundError, PermissionError, subprocess.CalledProcessError
    - _Requirements: 4.7, 11.4, 11.5, 11.6_

  - [~] 7.6 Write property test for FFmpeg error capture
    - **Property 36: FFmpeg Error Capture**
    - **Validates: Requirements 11.6**

  - [~] 7.7 Implement input validation
    - Validate minimum 2 videos selected
    - Validate file existence and format (MP4, MOV, AVI, MKV, WEBM, M4V)
    - Validate path traversal prevention (reject ../ and ..\)
    - Validate output directory is writable
    - Check disk space before starting
    - _Requirements: 11.1, 11.2, 11.3, 11.7, 11.8, 11.9, 11.10_

  - [~] 7.8 Write property test for path traversal prevention
    - **Property 35: Path Traversal Prevention**
    - **Validates: Requirements 11.10**

  - [~] 7.9 Write property test for minimum video count validation
    - **Property 34: Minimum Video Count Validation**
    - **Validates: Requirements 11.9**

- [ ] 8. Frontend - Main Page and State Management
  - [x] 8.1 Create concat page with state management
    - Create `frontend/src/app/concat/page.tsx`
    - Add "use client" directive for client-side hooks
    - Implement state: selectedVideos, trimSettings, concatConfig, jobId, jobStatus, presets, selectedPreset
    - Implement handleRun() to start concat job
    - Implement handleCancel() to cancel running job
    - Implement pollJobStatus() to poll every 2 seconds
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.8, 8.6_

  - [~] 8.2 Add project selection and video loading
    - Get project name from URL query parameter
    - Load video files from project using API
    - Filter videos by search query
    - _Requirements: 1.1, 10.4_

  - [~] 8.3 Write component test for page state management
    - Test that video selection updates state
    - Test that config changes update state
    - Test that job polling updates status
    - _Requirements: 1.2, 1.5_

- [ ] 9. Frontend - Asset Selection and Reordering
  - [~] 9.1 Enhance StudioAssetSelector with drag-and-drop
    - Update `frontend/src/components/studio/StudioAssetSelector.tsx`
    - Install @dnd-kit/core and @dnd-kit/sortable: `npm install @dnd-kit/core @dnd-kit/sortable`
    - Wrap video list with DndContext and SortableContext
    - Implement handleDragEnd to reorder selectedVideos array
    - _Requirements: 1.4, 1.5_

  - [~] 9.2 Write property test for video reordering
    - **Property 2: Video Reordering Updates Sequence**
    - **Validates: Requirements 1.4, 1.5**

  - [~] 9.3 Add video metadata display to asset selector
    - Fetch video metadata (duration, resolution, file size) using /file-info endpoint
    - Display metadata below each video thumbnail
    - Format duration as MM:SS
    - _Requirements: 1.6, 1.7_

  - [~] 9.4 Write property test for metadata display completeness
    - **Property 4: Metadata Display Completeness**
    - **Validates: Requirements 1.7**

  - [~] 9.5 Add remove button for selected videos
    - Add X button to each selected video
    - Implement handleRemove to remove video from selectedVideos
    - _Requirements: 1.9_

  - [~] 9.6 Write property test for video removal
    - **Property 3: Video Removal from Sequence**
    - **Validates: Requirements 1.9**

  - [~] 9.7 Add empty state message
    - Show EmptyState component when no videos selected
    - Display message: "Select at least 2 videos to concatenate"
    - _Requirements: 1.8_

- [ ] 10. Frontend - Configuration Components
  - [~] 10.1 Create ConcatConfig component
    - Create `frontend/src/components/studio/ConcatConfig.tsx`
    - Use shadcn/ui Card, Select, Slider, Switch, Input components
    - Implement TransitionSection with transition type select and duration slider
    - Implement OutputSection with resolution select, quality select, and filename suffix input
    - _Requirements: 2.1-2.6, 3.1-3.7, 3.10_

  - [~] 10.2 Write component test for ConcatConfig
    - Test transition type selection updates config
    - Test transition duration slider updates config
    - Test resolution selection updates config
    - _Requirements: 2.5, 3.1_

  - [~] 10.3 Create TrimSection with per-video trim editor
    - In ConcatConfig, add TrimSection component
    - For each selected video, show TrimEditor with start and end time inputs
    - Implement handleTrimChange to update trimSettings map
    - Add reset button to clear trim points
    - Validate start < end and within video duration
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.9_

  - [~] 10.4 Write property test for trim reset round-trip
    - **Property 23: Trim Reset Round-Trip**
    - **Validates: Requirements 6.9**

  - [~] 10.5 Create AudioSection with audio mixing controls
    - In ConcatConfig, add AudioSection component
    - Add Switch for mute_original_audio
    - Add Switch for enable_audio_fade with fade duration slider
    - Add FileUpload for background music (accept MP3, WAV, M4A, AAC)
    - Add Slider for background music volume (0-100)
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.8, 7.9, 7.11_

  - [~] 10.6 Write component test for AudioSection
    - Test mute switch updates config
    - Test fade switch updates config
    - Test volume slider updates config
    - _Requirements: 7.2, 7.5_

- [ ] 11. Frontend - Preview and Progress Components
  - [~] 11.1 Create ConcatPreviewPanel component
    - Create `frontend/src/components/studio/ConcatPreviewPanel.tsx`
    - Fetch metadata for all selected videos using /file-info endpoint
    - Calculate estimated duration: sum of (trimmed) video durations minus transition overlaps
    - Display video count, estimated duration (MM:SS), estimated file size
    - Show warning Alert if duration > 10 minutes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

  - [~] 11.2 Write property test for duration calculation correctness
    - **Property 7: Duration Calculation Correctness**
    - **Validates: Requirements 2.9, 12.1, 12.2, 12.3, 12.5, 12.6, 12.7**

  - [~] 11.3 Write property test for duration format display
    - **Property 40: Duration Format Display**
    - **Validates: Requirements 12.4**

  - [~] 11.4 Create VideoMetadataList component
    - In ConcatPreviewPanel, add VideoMetadataList to show per-video details
    - For each video, display thumbnail, duration, resolution, file size
    - Show trimmed duration if trim points are set
    - _Requirements: 1.6, 1.7, 6.7_

  - [~] 11.5 Create ConcatRunProgress component
    - Create `frontend/src/components/studio/ConcatRunProgress.tsx`
    - Display Progress bar with percentage (0-100)
    - Display stage label and current video being processed
    - Show success Alert with output path when done
    - Show error Alert with error message when failed
    - Add Cancel button (visible when running)
    - Add Reset button (visible when done or error)
    - _Requirements: 4.3, 4.4, 4.6, 4.7, 8.1, 8.2, 8.3, 8.4, 8.7, 8.8, 8.9, 8.10_

  - [~] 11.6 Write component test for ConcatRunProgress
    - Test progress bar displays correct percentage
    - Test success alert shows output path
    - Test error alert shows error message
    - _Requirements: 8.2, 8.7, 8.8_

- [ ] 12. Checkpoint - Frontend Components Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Frontend - Preset Management and API Integration
  - [~] 13.1 Add preset management to StudioRunBar
    - StudioRunBar already supports preset dropdown, save, and delete
    - Load concat presets using settingsApi.listConcatPresets()
    - Implement handleLoadPreset to apply preset config
    - Implement handleSavePreset to create new preset
    - Implement handleDeletePreset to remove preset
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 5.7_

  - [~] 13.2 Write component test for preset management
    - Test loading preset applies config
    - Test saving preset creates new preset
    - Test deleting preset removes preset
    - _Requirements: 5.5, 5.6, 5.7_

  - [~] 13.3 Update frontend API client
    - Update `frontend/src/lib/api.ts`
    - Add concatApi.run() method
    - Add concatApi.status() method
    - Add concatApi.cancel() method
    - Add concatApi.fileInfo() method
    - Add settingsApi.listConcatPresets() method
    - Add settingsApi.createConcatPreset() method
    - Add settingsApi.updateConcatPreset() method
    - Add settingsApi.deleteConcatPreset() method
    - Use NEXT_PUBLIC_API_URL environment variable
    - _Requirements: 10.6_

  - [~] 13.4 Verify frontend build passes
    - Run `cd frontend && npm run build`
    - Fix any TypeScript errors
    - Fix any linting errors
    - _Requirements: 10.9_

- [ ] 14. Integration Testing and End-to-End Workflows
  - [~] 14.1 Write integration test for full concat workflow (cut transition)
    - Test selecting 2 videos, configuring cut transition, running concat
    - Verify job completes successfully and output file exists
    - _Requirements: 1.1-1.10, 2.1, 4.1-4.10_

  - [~] 14.2 Write integration test for full concat workflow (crossfade transition)
    - Test selecting 3 videos, configuring crossfade transition, running concat
    - Verify transitions are applied correctly
    - _Requirements: 2.2, 2.5, 2.7_

  - [~] 14.3 Write integration test for concat with trim points
    - Test setting trim points on all videos, running concat
    - Verify trimmed durations are used in output
    - _Requirements: 6.1-6.10_

  - [~] 14.4 Write integration test for concat with background music
    - Test adding background music, mixing with original audio, running concat
    - Verify audio mixing is correct
    - _Requirements: 7.3, 7.4, 7.5_

  - [~] 14.5 Write integration test for job cancellation
    - Test starting concat job, cancelling mid-process
    - Verify job status changes to cancelled and FFmpeg process terminates
    - _Requirements: 4.8, 4.9_

  - [~] 14.6 Write integration test for batch processing
    - Test starting multiple concat jobs simultaneously
    - Verify all jobs have unique IDs and run concurrently
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 15. Checkpoint - Integration Testing Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Documentation and Error Messages
  - [~] 16.1 Add validation error messages
    - Add descriptive error messages for all validation failures
    - Transition duration out of range: "Transition duration must be between 0.5 and 3.0 seconds"
    - Fewer than 2 videos: "At least 2 videos are required for concatenation"
    - Invalid trim points: "Start time must be less than end time"
    - Path traversal: "Path traversal not allowed"
    - _Requirements: 11.1-11.10_

  - [~] 16.2 Add help tooltips to configuration options
    - Add Tooltip to transition type select explaining each type
    - Add Tooltip to quality select explaining CRF values
    - Add Tooltip to audio fade explaining fade-in/fade-out
    - _Requirements: 2.1-2.4, 3.5-3.7, 7.9-7.11_

  - [~] 16.3 Update API documentation
    - Verify OpenAPI docs at /docs include all concat endpoints
    - Add example requests and responses
    - Document error codes and messages
    - _Requirements: 10.6_

- [ ] 17. Performance Optimization and Polish
  - [~] 17.1 Optimize FFmpeg command generation
    - Use concat demuxer (copy codec) when no transitions or trims
    - Only use filter_complex when necessary
    - _Requirements: 2.1, 2.10_

  - [~] 17.2 Optimize frontend re-renders
    - Use React.memo for expensive components
    - Use useMemo for duration calculations
    - Use useCallback for event handlers
    - _Requirements: 12.5, 12.6, 12.7_

  - [~] 17.3 Add loading states
    - Show loading spinner while fetching video metadata
    - Show loading spinner while starting job
    - Disable Run button while job is running
    - _Requirements: 8.6_

  - [~] 17.4 Add disk space check before starting
    - Estimate output file size based on quality and duration
    - Check available disk space using shutil.disk_usage()
    - Reject job if insufficient space (HTTP 507)
    - _Requirements: 11.8_

- [ ] 18. Batch Processing UI (Optional)
  - [ ] 18.1 Add batch job list component
    - Create BatchJobList component to display all active jobs
    - Show progress for each job
    - Allow cancelling individual jobs
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 18.2 Write property test for individual job cancellation
    - **Property 39: Individual Job Cancellation**
    - **Validates: Requirements 9.6**

  - [ ] 18.3 Add batch completion notification
    - Show summary of successful and failed jobs
    - Integrate with Telegram notifier if configured
    - _Requirements: 9.9, 9.10_

  - [ ] 18.4 Write property test for batch job unique filenames
    - **Property 38: Batch Job Unique Filenames**
    - **Validates: Requirements 9.8**

- [ ] 19. Final Checkpoint - Feature Complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- Phase 1-7 are high priority (core functionality)
- Phase 8-15 are high priority (frontend and integration)
- Phase 16-17 are medium priority (polish and optimization)
- Phase 18 is low priority (optional batch processing UI)
