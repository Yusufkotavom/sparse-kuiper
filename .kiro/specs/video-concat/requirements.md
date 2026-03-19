# Requirements Document

## Introduction

Video Concat adalah fitur untuk menggabungkan beberapa video menjadi satu file output dalam aplikasi video editing berbasis web. Fitur ini memungkinkan user untuk memilih multiple video files dari project, mengatur urutan, menambahkan transisi, dan menghasilkan video gabungan dengan kualitas yang dapat dikonfigurasi. Proses concat berjalan sebagai background job dengan progress tracking yang real-time.

## Glossary

- **Video_Concat_System**: Sistem yang menangani penggabungan multiple video files menjadi satu output file
- **Concat_Job**: Background job yang memproses penggabungan video dengan progress tracking
- **Video_Sequence**: Urutan video yang akan digabung sesuai dengan arrangement user
- **Transition_Engine**: Komponen yang menerapkan efek transisi antar video (crossfade, cut, dip to black, glitch)
- **Concat_Preset**: Konfigurasi tersimpan yang berisi pengaturan concat (resolution, quality, transition, audio)
- **Project_Folder**: Direktori project yang berisi raw videos dan output results
- **FFmpeg_Processor**: Service yang mengeksekusi perintah FFmpeg untuk video processing
- **Progress_Tracker**: Komponen yang melacak dan melaporkan progress concat job
- **Asset_Selector**: UI component untuk memilih dan mengatur urutan video files
- **Trim_Editor**: Komponen untuk memotong video sebelum concat
- **Audio_Mixer**: Komponen yang menangani audio dari multiple sources (original videos, background music)

## Requirements

### Requirement 1: Video Selection and Sequencing

**User Story:** As a video editor, I want to select multiple video files from my project and arrange them in a specific order, so that I can create a combined video with the desired sequence.

#### Acceptance Criteria

1. THE Asset_Selector SHALL display all available video files from the Project_Folder
2. WHEN a user clicks on a video file, THE Asset_Selector SHALL add it to the Video_Sequence
3. THE Asset_Selector SHALL support selecting multiple video files simultaneously
4. THE Asset_Selector SHALL provide drag-and-drop functionality to reorder videos in the Video_Sequence
5. WHEN a user reorders videos, THE Asset_Selector SHALL update the Video_Sequence immediately
6. THE Asset_Selector SHALL display a preview thumbnail for each selected video
7. THE Asset_Selector SHALL show video metadata (duration, resolution, file size) for each selected file
8. WHEN no videos are selected, THE Video_Concat_System SHALL display an empty state message
9. THE Asset_Selector SHALL allow removing individual videos from the Video_Sequence
10. THE Asset_Selector SHALL persist the Video_Sequence order during the session

### Requirement 2: Transition Configuration

**User Story:** As a video editor, I want to add transitions between concatenated videos, so that the final output has smooth visual flow between clips.

#### Acceptance Criteria

1. THE Transition_Engine SHALL support "cut" transition type (no transition effect)
2. THE Transition_Engine SHALL support "crossfade" transition with configurable duration
3. THE Transition_Engine SHALL support "dip_to_black" transition with configurable duration
4. THE Transition_Engine SHALL support "glitch" transition effect
5. WHEN a user selects a transition type, THE Video_Concat_System SHALL apply it between all video clips
6. THE Video_Concat_System SHALL allow configuring transition duration between 0.5 seconds and 3.0 seconds
7. WHEN crossfade transition is selected, THE Transition_Engine SHALL blend the end of one video with the start of the next
8. WHEN dip_to_black transition is selected, THE Transition_Engine SHALL fade to black then fade in to the next video
9. THE Video_Concat_System SHALL display estimated total duration including transition effects
10. THE Transition_Engine SHALL preserve video quality during transition rendering

### Requirement 3: Output Configuration

**User Story:** As a video editor, I want to configure the output resolution and quality settings, so that I can control the file size and visual quality of the concatenated video.

#### Acceptance Criteria

1. THE Video_Concat_System SHALL support "original" resolution (preserve source resolution)
2. THE Video_Concat_System SHALL support "1080p" output resolution (1920x1080)
3. THE Video_Concat_System SHALL support "720p" output resolution (1280x720)
4. THE Video_Concat_System SHALL support "480p" output resolution (854x480)
5. THE Video_Concat_System SHALL support "high" quality preset (CRF 18)
6. THE Video_Concat_System SHALL support "medium" quality preset (CRF 23)
7. THE Video_Concat_System SHALL support "low" quality preset (CRF 28)
8. WHEN videos have different resolutions, THE Video_Concat_System SHALL scale all videos to match the selected output resolution
9. WHEN videos have different aspect ratios, THE Video_Concat_System SHALL apply letterboxing or pillarboxing to maintain aspect ratio
10. THE Video_Concat_System SHALL allow user to specify custom output filename suffix

### Requirement 4: Background Job Processing

**User Story:** As a video editor, I want the concat process to run in the background with progress tracking, so that I can monitor the processing status without blocking the UI.

#### Acceptance Criteria

1. WHEN a user starts concat, THE Video_Concat_System SHALL create a Concat_Job with unique job ID
2. THE Concat_Job SHALL execute in a background thread pool executor
3. THE Progress_Tracker SHALL report progress percentage from 0 to 100
4. THE Progress_Tracker SHALL report current processing stage (analyzing, concatenating, encoding, finalizing)
5. THE Progress_Tracker SHALL update progress at least every 2 seconds
6. WHEN concat completes successfully, THE Concat_Job SHALL update status to "done"
7. WHEN concat fails, THE Concat_Job SHALL update status to "error" with descriptive error message
8. THE Video_Concat_System SHALL allow user to cancel a running Concat_Job
9. WHEN cancellation is requested, THE FFmpeg_Processor SHALL terminate the FFmpeg process within 5 seconds
10. THE Video_Concat_System SHALL store completed output file in the Project_Folder final subdirectory

### Requirement 5: Preset Management

**User Story:** As a video editor, I want to save and reuse concat configurations as presets, so that I can quickly apply consistent settings across multiple concat operations.

#### Acceptance Criteria

1. THE Video_Concat_System SHALL allow user to save current configuration as a Concat_Preset
2. THE Video_Concat_System SHALL require a unique name for each Concat_Preset
3. THE Concat_Preset SHALL store resolution, quality, transition type, transition duration, and audio settings
4. THE Video_Concat_System SHALL list all available Concat_Presets in a dropdown selector
5. WHEN a user selects a Concat_Preset, THE Video_Concat_System SHALL load all saved settings
6. THE Video_Concat_System SHALL allow user to delete existing Concat_Presets
7. THE Video_Concat_System SHALL allow user to update existing Concat_Presets
8. THE Video_Concat_System SHALL persist Concat_Presets in the database
9. WHEN no presets exist, THE Video_Concat_System SHALL provide a default preset
10. THE Video_Concat_System SHALL validate preset names to prevent SQL injection or path traversal

### Requirement 6: Video Trimming Before Concat

**User Story:** As a video editor, I want to trim individual videos before concatenating them, so that I can remove unwanted sections from each clip.

#### Acceptance Criteria

1. THE Trim_Editor SHALL allow user to set start time for each video in the Video_Sequence
2. THE Trim_Editor SHALL allow user to set end time for each video in the Video_Sequence
3. THE Trim_Editor SHALL display a timeline preview for each video
4. WHEN trim points are set, THE Video_Concat_System SHALL only include the trimmed portion in the final output
5. THE Trim_Editor SHALL validate that start time is less than end time
6. THE Trim_Editor SHALL validate that trim points are within video duration
7. THE Trim_Editor SHALL display trimmed duration for each video
8. THE Video_Concat_System SHALL update total estimated duration when trim points change
9. THE Trim_Editor SHALL allow resetting trim points to use full video duration
10. THE FFmpeg_Processor SHALL apply trim operations during concat processing

### Requirement 7: Audio Mixing

**User Story:** As a video editor, I want to control audio from concatenated videos and optionally add background music, so that I can create the desired audio experience.

#### Acceptance Criteria

1. THE Audio_Mixer SHALL preserve original audio from all concatenated videos by default
2. THE Audio_Mixer SHALL allow user to mute original audio from all videos
3. THE Audio_Mixer SHALL allow user to upload a background music file
4. WHEN background music is added, THE Audio_Mixer SHALL mix it with original video audio
5. THE Audio_Mixer SHALL allow adjusting background music volume from 0 to 100 percent
6. WHEN background music is shorter than total video duration, THE Audio_Mixer SHALL loop the music
7. WHEN background music is longer than total video duration, THE Audio_Mixer SHALL trim the music
8. THE Audio_Mixer SHALL support MP3, WAV, M4A, and AAC audio formats
9. THE Audio_Mixer SHALL apply audio fade-in at the start of the concatenated video
10. THE Audio_Mixer SHALL apply audio fade-out at the end of the concatenated video
11. THE Audio_Mixer SHALL allow configuring fade duration between 0.5 seconds and 5.0 seconds

### Requirement 8: Progress Tracking and Status Display

**User Story:** As a video editor, I want to see real-time progress and status updates during concat processing, so that I know how long the operation will take.

#### Acceptance Criteria

1. THE Progress_Tracker SHALL display current processing stage label
2. THE Progress_Tracker SHALL display progress percentage as a visual progress bar
3. THE Progress_Tracker SHALL display estimated time remaining
4. THE Progress_Tracker SHALL display current video being processed in multi-video concat
5. WHEN concat is pending, THE Progress_Tracker SHALL display "Waiting to start" message
6. WHEN concat is running, THE Progress_Tracker SHALL update progress at least every 2 seconds
7. WHEN concat completes, THE Progress_Tracker SHALL display success message with output file path
8. WHEN concat fails, THE Progress_Tracker SHALL display error message with failure reason
9. THE Progress_Tracker SHALL provide a cancel button during processing
10. THE Progress_Tracker SHALL provide a reset button after completion or error

### Requirement 9: Batch Processing

**User Story:** As a video editor, I want to create multiple concat operations with different video sets simultaneously, so that I can process multiple outputs efficiently.

#### Acceptance Criteria

1. THE Video_Concat_System SHALL allow user to define multiple concat configurations
2. THE Video_Concat_System SHALL allow user to start multiple Concat_Jobs simultaneously
3. THE Video_Concat_System SHALL assign unique job IDs to each Concat_Job
4. THE Video_Concat_System SHALL process Concat_Jobs concurrently up to system thread pool limit
5. THE Video_Concat_System SHALL display progress for all active Concat_Jobs
6. THE Video_Concat_System SHALL allow user to cancel individual Concat_Jobs
7. WHEN multiple jobs are running, THE Video_Concat_System SHALL distribute system resources fairly
8. THE Video_Concat_System SHALL generate unique output filenames for each Concat_Job
9. THE Video_Concat_System SHALL notify user when all batch jobs complete
10. THE Video_Concat_System SHALL display summary of successful and failed jobs in batch

### Requirement 10: Integration with Existing System

**User Story:** As a developer, I want the Video Concat feature to integrate seamlessly with existing Looper and Scene Mixer features, so that users have a consistent experience across all video editing tools.

#### Acceptance Criteria

1. THE Video_Concat_System SHALL reuse the existing job queue pattern from Looper
2. THE Video_Concat_System SHALL reuse the StudioAssetSelector component for video selection
3. THE Video_Concat_System SHALL reuse the StudioRunBar component for execution controls
4. THE Video_Concat_System SHALL store output files in the same Project_Folder structure as Looper
5. THE Video_Concat_System SHALL use the same FFmpeg_Processor service as Looper
6. THE Video_Concat_System SHALL follow the same API endpoint pattern as Looper (/api/v1/concat/*)
7. THE Video_Concat_System SHALL use the same database models pattern for job tracking
8. THE Video_Concat_System SHALL use the same preset management pattern as Looper
9. THE Video_Concat_System SHALL use shadcn/ui components consistent with existing UI
10. THE Video_Concat_System SHALL follow the same error handling and logging patterns as Looper

### Requirement 11: File Validation and Error Handling

**User Story:** As a video editor, I want the system to validate video files and provide clear error messages, so that I can understand and fix issues with my concat operations.

#### Acceptance Criteria

1. WHEN a user selects a video file, THE Video_Concat_System SHALL validate that the file exists
2. WHEN a user selects a video file, THE Video_Concat_System SHALL validate that the file is a supported video format
3. THE Video_Concat_System SHALL support MP4, MOV, AVI, MKV, WEBM, and M4V video formats
4. WHEN a video file is corrupted, THE Video_Concat_System SHALL display an error message
5. WHEN a video file cannot be read, THE Video_Concat_System SHALL display an error message with file path
6. WHEN FFmpeg processing fails, THE Video_Concat_System SHALL capture stderr output and display it to user
7. WHEN output directory is not writable, THE Video_Concat_System SHALL display permission error
8. WHEN disk space is insufficient, THE Video_Concat_System SHALL display disk space error before starting
9. THE Video_Concat_System SHALL validate that at least 2 videos are selected before allowing concat
10. THE Video_Concat_System SHALL prevent path traversal attacks in file path parameters

### Requirement 12: Duration Estimation and Preview

**User Story:** As a video editor, I want to see the estimated total duration of the concatenated video before processing, so that I can verify the output will meet my requirements.

#### Acceptance Criteria

1. THE Video_Concat_System SHALL calculate total duration by summing all video durations
2. WHEN trim points are set, THE Video_Concat_System SHALL calculate duration using trimmed lengths
3. WHEN transitions are enabled, THE Video_Concat_System SHALL subtract transition overlap from total duration
4. THE Video_Concat_System SHALL display estimated duration in MM:SS format
5. THE Video_Concat_System SHALL update estimated duration when Video_Sequence changes
6. THE Video_Concat_System SHALL update estimated duration when trim points change
7. THE Video_Concat_System SHALL update estimated duration when transition settings change
8. THE Video_Concat_System SHALL display estimated output file size based on quality settings
9. THE Video_Concat_System SHALL display total number of videos in the Video_Sequence
10. THE Video_Concat_System SHALL display warning when estimated duration exceeds 10 minutes
