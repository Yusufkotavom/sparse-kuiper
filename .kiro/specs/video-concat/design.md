# Video Concat Design Document

## Overview

Video Concat adalah fitur untuk menggabungkan beberapa video menjadi satu file output dengan dukungan transisi, trimming, audio mixing, dan konfigurasi output yang fleksibel. Fitur ini dibangun dengan pola arsitektur yang sama dengan Looper, menggunakan background job processing dengan FFmpeg sebagai video processing engine.

### Key Design Goals

1. **Reusability**: Memanfaatkan komponen existing (StudioAssetSelector, StudioRunBar, job queue pattern)
2. **Performance**: Background processing dengan progress tracking real-time
3. **Flexibility**: Mendukung berbagai kombinasi transisi, trimming, dan audio mixing
4. **Consistency**: Mengikuti pola API, database, dan UI yang sudah ada di Looper

### Core Capabilities

- Menggabungkan 2+ video files menjadi satu output
- Transisi antar video (cut, crossfade, dip_to_black, glitch)
- Trimming individual videos sebelum concat
- Audio mixing (preserve, mute, background music)
- Output configuration (resolution, quality, filename)
- Preset management untuk reusable configurations
- Batch processing untuk multiple concat operations

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  /concat/page.tsx                                            │
│    ├─ StudioAssetSelector (video selection & ordering)      │
│    ├─ ConcatConfig (transition, trim, audio, output)        │
│    ├─ ConcatPreviewPanel (duration estimate, metadata)      │
│    ├─ StudioRunBar (start, cancel, preset management)       │
│    └─ ConcatRunProgress (progress tracking, status)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                         │
├─────────────────────────────────────────────────────────────┤
│  /api/v1/concat/*                                            │
│    ├─ POST /run          → Start concat job                 │
│    ├─ GET  /status/{id}  → Poll job progress                │
│    ├─ POST /cancel/{id}  → Cancel running job               │
│    └─ GET  /file-info    → Get video metadata               │
│                                                              │
│  /api/v1/settings/*                                          │
│    ├─ GET    /concat-presets     → List presets             │
│    ├─ POST   /concat-presets     → Create preset            │
│    ├─ PUT    /concat-presets/{n} → Update preset            │
│    └─ DELETE /concat-presets/{n} → Delete preset            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Services Layer                              │
├─────────────────────────────────────────────────────────────┤
│  concat_worker.py                                            │
│    ├─ Job registry (in-memory JOBS dict)                    │
│    ├─ run_concat_job() → Main pipeline orchestrator         │
│    ├─ _validate_inputs() → File validation                  │
│    ├─ _build_ffmpeg_concat() → FFmpeg command builder       │
│    ├─ _apply_transitions() → Transition logic               │
│    ├─ _apply_trim() → Trim logic                            │
│    └─ _mix_audio() → Audio mixing logic                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database (PostgreSQL)                       │
├─────────────────────────────────────────────────────────────┤
│  app_settings table                                          │
│    ├─ setting_type = "concat_preset"                        │
│    ├─ name (unique per type)                                │
│    └─ payload (JSON: resolution, quality, transition, etc)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  FFmpeg (Video Processing)                   │
├─────────────────────────────────────────────────────────────┤
│  - Concat demuxer (concat protocol)                          │
│  - Filter complex (transitions, scaling, padding)            │
│  - Audio mixing (amerge, volume, afade)                      │
│  - Encoding (libx264, CRF-based quality)                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User selects videos** → StudioAssetSelector updates Video_Sequence state
2. **User configures settings** → ConcatConfig updates configuration state
3. **User clicks Run** → POST /api/v1/concat/run with full configuration
4. **Backend creates job** → Unique job_id, status="pending"
5. **Background worker starts** → run_concat_job() in thread pool executor
6. **Worker validates inputs** → Check file existence, format, permissions
7. **Worker builds FFmpeg command** → Based on configuration (transitions, trim, audio)
8. **Worker executes FFmpeg** → Subprocess with progress monitoring
9. **Frontend polls status** → GET /api/v1/concat/status/{job_id} every 2s
10. **Job completes** → status="done", output_path set
11. **Frontend displays result** → Success message with download link



## Components and Interfaces

### Frontend Components

#### 1. ConcatPage (`frontend/src/app/concat/page.tsx`)

Main page component yang mengintegrasikan semua sub-components.

**State Management:**
```typescript
const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
const [trimSettings, setTrimSettings] = useState<Map<string, TrimPoint>>({});
const [concatConfig, setConcatConfig] = useState<ConcatConfig>({
  transition_type: "cut",
  transition_duration: 1.0,
  resolution: "original",
  quality: "high",
  output_suffix: "_concat",
  mute_original_audio: false,
  enable_audio_fade: true,
  audio_fade_duration: 2.0,
  background_music_file: null,
  background_music_volume: 50,
});
const [jobId, setJobId] = useState<string | null>(null);
const [jobStatus, setJobStatus] = useState<ConcatJobStatus | null>(null);
const [presets, setPresets] = useState<ConcatPreset[]>([]);
const [selectedPreset, setSelectedPreset] = useState<string>("");
```

**Key Methods:**
- `handleRun()`: Start concat job
- `handleCancel()`: Cancel running job
- `handleSavePreset()`: Save current config as preset
- `handleLoadPreset()`: Load preset configuration
- `pollJobStatus()`: Poll job progress every 2s

#### 2. ConcatConfig (`frontend/src/components/studio/ConcatConfig.tsx`)

Configuration panel untuk transition, trim, audio, dan output settings.

**Props:**
```typescript
interface ConcatConfigProps {
  config: ConcatConfig;
  onChange: (config: ConcatConfig) => void;
  selectedVideos: string[];
  trimSettings: Map<string, TrimPoint>;
  onTrimChange: (videoPath: string, trim: TrimPoint) => void;
  projectName: string;
}
```

**Sections:**
- Transition settings (type, duration)
- Trim editor (per-video start/end times)
- Audio settings (mute, fade, background music)
- Output settings (resolution, quality, filename suffix)

#### 3. ConcatPreviewPanel (`frontend/src/components/studio/ConcatPreviewPanel.tsx`)

Preview panel yang menampilkan estimated duration, file size, dan metadata.

**Props:**
```typescript
interface ConcatPreviewPanelProps {
  selectedVideos: string[];
  trimSettings: Map<string, TrimPoint>;
  config: ConcatConfig;
  projectName: string;
}
```

**Displays:**
- Total video count
- Estimated total duration (with transitions and trims)
- Estimated output file size
- Per-video metadata (duration, resolution, size)
- Warning for long durations (>10 minutes)

#### 4. ConcatRunProgress (`frontend/src/components/studio/ConcatRunProgress.tsx`)

Progress tracking component (reuse pattern dari LooperRunProgress).

**Props:**
```typescript
interface ConcatRunProgressProps {
  jobStatus: ConcatJobStatus | null;
  onCancel: () => void;
  onReset: () => void;
}
```

**Displays:**
- Progress bar (0-100%)
- Current stage label
- Current video being processed
- Estimated time remaining
- Success/error messages
- Cancel/Reset buttons

### Backend API Endpoints

#### POST /api/v1/concat/run

Start a new concat job.

**Request Body:**
```python
class ConcatRunRequest(BaseModel):
    project: str
    files: List[str]  # List of relative file paths
    trim_settings: Optional[Dict[str, TrimPoint]] = None
    output_suffix: str = "_concat"
    transition_type: str = "cut"  # cut | crossfade | dip_to_black | glitch
    transition_duration: float = 1.0
    resolution: str = "original"  # original | 1080p | 720p | 480p
    quality: str = "high"  # high | medium | low
    mute_original_audio: bool = False
    enable_audio_fade: bool = True
    audio_fade_duration: float = 2.0
    background_music_file: Optional[str] = None
    background_music_volume: int = 50  # 0-100
```

**Response:**
```python
class ConcatRunResponse(BaseModel):
    job_id: str
    message: str
```

#### GET /api/v1/concat/status/{job_id}

Poll job status and progress.

**Response:**
```python
class ConcatStatusResponse(BaseModel):
    job_id: str
    status: str  # pending | running | done | error
    progress: int  # 0-100
    stage: int  # 1-5
    stage_label: str
    current_video: Optional[str] = None
    output_path: Optional[str] = None
    error: Optional[str] = None
    finished_at: Optional[float] = None
```

#### POST /api/v1/concat/cancel/{job_id}

Cancel a running job.

**Response:**
```python
{"message": "Cancellation requested"}
```

#### GET /api/v1/concat/file-info

Get video metadata for preview.

**Query Parameters:**
- `project`: Project name
- `file`: Relative file path

**Response:**
```python
{
    "duration": float,
    "width": int,
    "height": int,
    "fps": float,
    "size_bytes": int,
    "format": str
}
```

### Backend Services

#### concat_worker.py

Main worker service untuk concat processing.

**Job Registry:**
```python
@dataclass
class ConcatJobStatus:
    job_id: str
    status: str = "pending"
    progress: int = 0
    stage: int = 0
    stage_label: str = ""
    current_video: Optional[str] = None
    output_path: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    cancel_requested: bool = False

JOBS: Dict[str, ConcatJobStatus] = {}
```

**Main Pipeline:**
```python
def run_concat_job(
    job: ConcatJobStatus,
    input_paths: List[str],
    output_path: str,
    *,
    trim_settings: Optional[Dict[str, TrimPoint]],
    transition_type: str,
    transition_duration: float,
    resolution: str,
    quality: str,
    mute_original_audio: bool,
    enable_audio_fade: bool,
    audio_fade_duration: float,
    background_music_path: Optional[str],
    background_music_volume: int,
) -> None:
    """
    Pipeline stages:
    1. Validate inputs (file existence, format, permissions)
    2. Build FFmpeg concat command
    3. Execute FFmpeg with progress monitoring
    4. Finalize output
    """
```

**Key Functions:**
```python
def _validate_inputs(input_paths: List[str]) -> None:
    """Validate file existence, format, and readability"""

def _build_ffmpeg_concat(
    input_paths: List[str],
    output_path: str,
    trim_settings: Optional[Dict[str, TrimPoint]],
    transition_type: str,
    transition_duration: float,
    resolution: str,
    quality: str,
    mute_original_audio: bool,
    enable_audio_fade: bool,
    audio_fade_duration: float,
    background_music_path: Optional[str],
    background_music_volume: int,
) -> List[str]:
    """Build FFmpeg command with all filters"""

def _apply_transitions(
    transition_type: str,
    transition_duration: float,
    video_count: int,
) -> str:
    """Generate filter_complex for transitions"""

def _apply_trim(
    input_path: str,
    trim: TrimPoint,
) -> str:
    """Generate trim filter for input"""

def _mix_audio(
    video_count: int,
    mute_original: bool,
    background_music_path: Optional[str],
    background_music_volume: int,
    enable_fade: bool,
    fade_duration: float,
    total_duration: float,
) -> str:
    """Generate audio mixing filter_complex"""
```



## Data Models

### Database Schema

#### AppSetting Model (Existing, Reused)

Concat presets disimpan di tabel `app_settings` dengan `setting_type = "concat_preset"`.

```python
class AppSetting(Base):
    __tablename__ = "app_settings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    setting_type = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    payload = Column(JSON_VALUE, nullable=False, default=dict)
    created_at = Column(UTC_DATETIME, server_default=func.now())
    updated_at = Column(UTC_DATETIME, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint("setting_type", "name", name="uq_setting_type_name"),
    )
```

**Concat Preset Payload Structure:**
```json
{
  "description": "High quality 1080p concat with crossfade",
  "transition_type": "crossfade",
  "transition_duration": 1.5,
  "resolution": "1080p",
  "quality": "high",
  "mute_original_audio": false,
  "enable_audio_fade": true,
  "audio_fade_duration": 2.0,
  "background_music_volume": 50
}
```

### Pydantic Schemas

#### ConcatPreset (Settings Schema)

```python
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
```

#### TrimPoint

```python
class TrimPoint(BaseModel):
    start: float  # seconds
    end: float    # seconds
```

#### ConcatRunRequest

```python
class ConcatRunRequest(BaseModel):
    project: str
    files: List[str]
    trim_settings: Optional[Dict[str, TrimPoint]] = None
    output_suffix: str = "_concat"
    transition_type: str = "cut"
    transition_duration: float = 1.0
    resolution: str = "original"
    quality: str = "high"
    mute_original_audio: bool = False
    enable_audio_fade: bool = True
    audio_fade_duration: float = 2.0
    background_music_file: Optional[str] = None
    background_music_volume: int = 50
```

#### ConcatJobStatus (In-Memory)

```python
@dataclass
class ConcatJobStatus:
    job_id: str
    status: str = "pending"  # pending | running | done | error
    progress: int = 0        # 0-100
    stage: int = 0           # 1-5
    stage_label: str = ""
    current_video: Optional[str] = None
    output_path: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    cancel_requested: bool = False
```

### TypeScript Types (Frontend)

```typescript
interface ConcatConfig {
  transition_type: "cut" | "crossfade" | "dip_to_black" | "glitch";
  transition_duration: number;
  resolution: "original" | "1080p" | "720p" | "480p";
  quality: "high" | "medium" | "low";
  output_suffix: string;
  mute_original_audio: boolean;
  enable_audio_fade: boolean;
  audio_fade_duration: number;
  background_music_file: string | null;
  background_music_volume: number;
}

interface TrimPoint {
  start: number;
  end: number;
}

interface ConcatPreset {
  name: string;
  description?: string;
  transition_type: string;
  transition_duration: number;
  resolution: string;
  quality: string;
  mute_original_audio: boolean;
  enable_audio_fade: boolean;
  audio_fade_duration: number;
  background_music_volume: number;
}

interface ConcatJobStatus {
  job_id: string;
  status: "pending" | "running" | "done" | "error";
  progress: number;
  stage: number;
  stage_label: string;
  current_video?: string;
  output_path?: string;
  error?: string;
  finished_at?: number;
}
```

## FFmpeg Command Structure

### Concat Strategy

Video concat menggunakan FFmpeg dengan dua pendekatan tergantung kompleksitas:

1. **Simple Concat (No Transitions, No Trim)**: Menggunakan concat demuxer (fast, copy codec)
2. **Complex Concat (With Transitions/Trim)**: Menggunakan filter_complex (re-encode)

### Simple Concat Command

```bash
# Create concat list file
file 'video1.mp4'
file 'video2.mp4'
file 'video3.mp4'

# FFmpeg command
ffmpeg -f concat -safe 0 -i concat_list.txt \
  -c copy \
  output.mp4
```

### Complex Concat with Transitions

#### Crossfade Transition

```bash
ffmpeg -i video1.mp4 -i video2.mp4 -i video3.mp4 \
  -filter_complex "\
    [0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v0]; \
    [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v1]; \
    [2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v2]; \
    [v0][v1]xfade=transition=fade:duration=1.0:offset=9.0[vx01]; \
    [vx01][v2]xfade=transition=fade:duration=1.0:offset=18.0[vout]; \
    [0:a][1:a][2:a]concat=n=3:v=0:a=1[aout]" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset fast -crf 18 \
  -c:a aac -b:a 192k \
  output.mp4
```

#### Dip to Black Transition

```bash
# Using fade filter for dip to black effect
[v0]fade=t=out:st=9.5:d=0.5[v0f]; \
[v1]fade=t=in:st=0:d=0.5[v1f]; \
[v0f][v1f]concat=n=2:v=1:a=0[vout]
```

### Trim Support

```bash
# Trim individual videos before concat
ffmpeg -ss 5.0 -i video1.mp4 -t 10.0 \
       -ss 2.0 -i video2.mp4 -t 15.0 \
  -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[vout]; \
                   [0:a][1:a]concat=n=2:v=0:a=1[aout]" \
  -map "[vout]" -map "[aout]" \
  output.mp4
```

### Audio Mixing

#### Preserve Original Audio with Fade

```bash
-filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1,afade=t=in:st=0:d=2.0,afade=t=out:st=28:d=2.0[aout]"
```

#### Mix Background Music

```bash
# Loop background music to match video duration
-filter_complex "\
  [0:a][1:a][2:a]concat=n=3:v=0:a=1[original]; \
  [3:a]aloop=loop=-1:size=2e+09[bgm]; \
  [original][bgm]amerge=inputs=2,pan=stereo|c0<c0+0.5*c2|c1<c1+0.5*c3[aout]"
```

#### Mute Original Audio

```bash
# Use only background music
-filter_complex "[3:a]aloop=loop=-1:size=2e+09,atrim=0:30[aout]"
```

### Resolution and Quality

```bash
# Resolution mapping
RESOLUTION_MAP = {
    "original": None,  # No scaling
    "1080p": "1920:1080",
    "720p": "1280:720",
    "480p": "854:480",
}

# Quality mapping (CRF values)
CRF_MAP = {
    "high": "18",
    "medium": "23",
    "low": "28",
}

# Scale and pad filter
scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1
```

### Progress Monitoring

FFmpeg progress dapat dimonitor dengan parsing stderr output:

```python
# Parse FFmpeg stderr for progress
# Example output: frame= 1234 fps= 30 q=28.0 size= 10240kB time=00:00:41.13 bitrate=2038.4kbits/s speed=1.2x

import re

def parse_ffmpeg_progress(line: str, total_duration: float) -> int:
    """Parse FFmpeg stderr line and return progress percentage"""
    match = re.search(r'time=(\d+):(\d+):(\d+\.\d+)', line)
    if match:
        hours, minutes, seconds = match.groups()
        current_time = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
        progress = int((current_time / total_duration) * 100)
        return min(100, max(0, progress))
    return 0
```

### Command Builder Pattern

```python
def _build_ffmpeg_concat(
    input_paths: List[str],
    output_path: str,
    trim_settings: Optional[Dict[str, TrimPoint]],
    transition_type: str,
    transition_duration: float,
    resolution: str,
    quality: str,
    mute_original_audio: bool,
    enable_audio_fade: bool,
    audio_fade_duration: float,
    background_music_path: Optional[str],
    background_music_volume: int,
) -> List[str]:
    """Build FFmpeg command based on configuration"""
    
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ffmpeg_exe, "-y"]
    
    # Add input files
    for path in input_paths:
        if trim_settings and path in trim_settings:
            trim = trim_settings[path]
            cmd += ["-ss", str(trim.start), "-t", str(trim.end - trim.start)]
        cmd += ["-i", path]
    
    # Add background music if specified
    if background_music_path:
        cmd += ["-i", background_music_path]
    
    # Build filter_complex
    filter_parts = []
    
    # Video scaling and padding
    scale_filter = RESOLUTION_MAP.get(resolution)
    if scale_filter:
        for i in range(len(input_paths)):
            filter_parts.append(
                f"[{i}:v]scale={scale_filter}:force_original_aspect_ratio=decrease,"
                f"pad={scale_filter}:(ow-iw)/2:(oh-ih)/2,setsar=1[v{i}]"
            )
    
    # Video transitions
    if transition_type == "crossfade":
        filter_parts.append(_build_crossfade_filter(len(input_paths), transition_duration))
    elif transition_type == "dip_to_black":
        filter_parts.append(_build_dip_to_black_filter(len(input_paths), transition_duration))
    else:  # cut or glitch
        filter_parts.append(_build_concat_filter(len(input_paths)))
    
    # Audio mixing
    filter_parts.append(_build_audio_filter(
        len(input_paths),
        mute_original_audio,
        background_music_path,
        background_music_volume,
        enable_audio_fade,
        audio_fade_duration,
    ))
    
    cmd += ["-filter_complex", ";".join(filter_parts)]
    cmd += ["-map", "[vout]", "-map", "[aout]"]
    
    # Encoding settings
    crf = CRF_MAP.get(quality, "18")
    cmd += [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", crf,
        "-c:a", "aac",
        "-b:a", "192k",
        output_path,
    ]
    
    return cmd
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies and consolidations:

**Redundancy Analysis:**

1. **Resolution/Quality Support Properties (3.1-3.7)**: All testing that specific presets are supported can be consolidated into single properties that test the configuration system accepts valid values.

2. **Duration Calculation Properties (12.1-12.3, 12.5-12.7)**: Multiple properties about duration updates can be consolidated into a single property about duration calculation correctness.

3. **Preset CRUD Properties (5.1, 5.6, 5.7)**: Save, update, delete operations can be tested through round-trip properties rather than individual operations.

4. **Audio Mixing Properties (7.1-7.4)**: Multiple audio properties can be consolidated into properties about audio track presence/absence.

5. **Validation Properties (6.5, 6.6, 11.1, 11.2)**: Input validation can be consolidated into error condition properties.

**Consolidated Properties:**

After reflection, the following properties provide unique validation value without redundancy:

### Property 1: Video Selection Adds to Sequence

*For any* video file in the project folder, selecting it should add it to the Video_Sequence.

**Validates: Requirements 1.2, 1.3**

### Property 2: Video Reordering Updates Sequence

*For any* Video_Sequence and any valid reordering operation, the sequence order should be updated to match the new arrangement.

**Validates: Requirements 1.4, 1.5**

### Property 3: Video Removal from Sequence

*For any* video in the Video_Sequence, removing it should result in the video no longer being present in the sequence.

**Validates: Requirements 1.9**

### Property 4: Metadata Display Completeness

*For any* selected video file, the displayed metadata should contain duration, resolution, and file size fields.

**Validates: Requirements 1.7**

### Property 5: Transition Duration Validation

*For any* transition duration value, the system should accept values between 0.5 and 3.0 seconds and reject values outside this range.

**Validates: Requirements 2.6**

### Property 6: Transition Application Between Clips

*For any* video sequence with N videos and any transition type, the system should apply N-1 transitions between consecutive clips.

**Validates: Requirements 2.5**

### Property 7: Duration Calculation Correctness

*For any* video sequence, trim settings, and transition configuration, the estimated total duration should equal the sum of trimmed video durations minus transition overlaps.

**Validates: Requirements 2.9, 12.1, 12.2, 12.3, 12.5, 12.6, 12.7**

### Property 8: Resolution Scaling Consistency

*For any* set of videos with different resolutions and any target output resolution, all videos in the output should be scaled to match the target resolution with appropriate padding.

**Validates: Requirements 3.8, 3.9**

### Property 9: Output Filename Suffix

*For any* valid suffix string, the output filename should include that suffix before the file extension.

**Validates: Requirements 3.10**

### Property 10: Job ID Uniqueness

*For any* set of concat operations started simultaneously, all job IDs should be unique.

**Validates: Requirements 4.1, 9.3**

### Property 11: Progress Range Invariant

*For any* concat job at any point in time, the progress percentage should always be in the range 0-100.

**Validates: Requirements 4.3**

### Property 12: Valid Processing Stage

*For any* concat job at any point in time, the current stage should be one of the valid stages (analyzing, concatenating, encoding, finalizing).

**Validates: Requirements 4.4**

### Property 13: Successful Completion Status

*For any* concat job that completes without errors, the final status should be "done" and an output_path should be set.

**Validates: Requirements 4.6, 4.10**

### Property 14: Error Status with Message

*For any* concat job that fails, the status should be "error" and an error message should be present.

**Validates: Requirements 4.7**

### Property 15: Job Cancellation

*For any* running concat job, requesting cancellation should set the cancel_requested flag to true.

**Validates: Requirements 4.8**

### Property 16: Preset Name Uniqueness

*For any* attempt to create a preset with a name that already exists, the system should reject the operation with an error.

**Validates: Requirements 5.2**

### Property 17: Preset Field Completeness

*For any* saved preset, it should contain all required configuration fields (resolution, quality, transition_type, transition_duration, audio settings).

**Validates: Requirements 5.3**

### Property 18: Preset Round-Trip Persistence

*For any* valid configuration, saving it as a preset then loading that preset should restore the same configuration values.

**Validates: Requirements 5.5, 5.8**

### Property 19: Preset Name Validation

*For any* preset name containing SQL injection or path traversal patterns, the system should reject it with a validation error.

**Validates: Requirements 5.10**

### Property 20: Trim Point Validation

*For any* trim point where start >= end or where either value is outside the video duration, the system should reject it with a validation error.

**Validates: Requirements 6.5, 6.6**

### Property 21: Trimmed Duration Calculation

*For any* video with trim points set, the displayed trimmed duration should equal (end - start).

**Validates: Requirements 6.7**

### Property 22: Trim Application in Output

*For any* video with trim points, the FFmpeg command should include trim parameters (-ss and -t flags) for that video.

**Validates: Requirements 6.4, 6.10**

### Property 23: Trim Reset Round-Trip

*For any* video with trim points, resetting the trim should restore the full video duration.

**Validates: Requirements 6.9**

### Property 24: Audio Preservation by Default

*For any* video sequence with default audio settings (mute_original_audio=false), the output should contain audio tracks from all input videos.

**Validates: Requirements 7.1**

### Property 25: Audio Muting

*For any* video sequence with mute_original_audio=true, the output should not contain audio from the original videos.

**Validates: Requirements 7.2**

### Property 26: Background Music Mixing

*For any* video sequence with background music added, the output should contain both original video audio and background music tracks.

**Validates: Requirements 7.4**

### Property 27: Background Music Volume Range

*For any* background music volume value, the system should accept values between 0 and 100 and reject values outside this range.

**Validates: Requirements 7.5**

### Property 28: Background Music Looping

*For any* background music shorter than total video duration, the FFmpeg command should include aloop filter to repeat the music.

**Validates: Requirements 7.6**

### Property 29: Background Music Trimming

*For any* background music longer than total video duration, the FFmpeg command should include atrim filter to cut the music.

**Validates: Requirements 7.7**

### Property 30: Audio Fade Application

*For any* concat output with enable_audio_fade=true, the FFmpeg command should include afade filters for both fade-in and fade-out.

**Validates: Requirements 7.9, 7.10**

### Property 31: Audio Fade Duration Range

*For any* audio fade duration value, the system should accept values between 0.5 and 5.0 seconds and reject values outside this range.

**Validates: Requirements 7.11**

### Property 32: File Existence Validation

*For any* file path provided in the concat request, the system should validate that the file exists and reject non-existent paths with an error.

**Validates: Requirements 11.1**

### Property 33: File Format Validation

*For any* file path provided in the concat request, the system should validate that the file has a supported video format extension and reject unsupported formats.

**Validates: Requirements 11.2**

### Property 34: Minimum Video Count Validation

*For any* concat request with fewer than 2 videos selected, the system should reject the request with a validation error.

**Validates: Requirements 11.9**

### Property 35: Path Traversal Prevention

*For any* file path containing path traversal patterns (../, ..\), the system should reject it with a security error.

**Validates: Requirements 11.10**

### Property 36: FFmpeg Error Capture

*For any* FFmpeg process that fails, the system should capture stderr output and include it in the error message.

**Validates: Requirements 11.6**

### Property 37: Output Directory Validation

*For any* concat job, if the output directory is not writable, the system should fail with a permission error before starting FFmpeg.

**Validates: Requirements 11.7**

### Property 38: Batch Job Unique Filenames

*For any* set of concurrent concat jobs in the same project, all output filenames should be unique.

**Validates: Requirements 9.8**

### Property 39: Individual Job Cancellation

*For any* job in a batch of running jobs, cancelling that job should not affect the status of other jobs.

**Validates: Requirements 9.6**

### Property 40: Duration Format Display

*For any* calculated duration value, the displayed format should be MM:SS.

**Validates: Requirements 12.4**

### Property 41: Video Count Display

*For any* Video_Sequence, the displayed count should equal the number of videos in the sequence.

**Validates: Requirements 12.9**



## Error Handling

### Error Categories

#### 1. Input Validation Errors

**File Validation:**
- Non-existent files → HTTP 404 with descriptive message
- Unsupported file formats → HTTP 400 with list of supported formats
- Corrupted video files → HTTP 400 with ffprobe error details
- Path traversal attempts → HTTP 400 with security warning

**Configuration Validation:**
- Invalid transition duration → HTTP 400 with valid range
- Invalid audio fade duration → HTTP 400 with valid range
- Invalid background music volume → HTTP 400 with valid range (0-100)
- Fewer than 2 videos selected → HTTP 400 with minimum requirement message

**Trim Validation:**
- Start time >= end time → HTTP 400 with validation message
- Trim points outside video duration → HTTP 400 with video duration info
- Negative trim values → HTTP 400 with validation message

**Preset Validation:**
- Duplicate preset name → HTTP 400 with conflict message
- Empty preset name → HTTP 400 with requirement message
- SQL injection patterns → HTTP 400 with security warning

#### 2. Permission and Resource Errors

**File System:**
- Output directory not writable → HTTP 500 with permission error
- Insufficient disk space → HTTP 507 with space requirement
- File read permission denied → HTTP 403 with file path

**System Resources:**
- FFmpeg not found → HTTP 500 with installation instructions
- Thread pool exhausted → HTTP 503 with retry-after header

#### 3. Processing Errors

**FFmpeg Errors:**
- Encoding failure → Capture stderr, set job status to "error"
- Codec not supported → Include codec info in error message
- Filter complex syntax error → Include filter string in error

**Job Errors:**
- Job not found → HTTP 404 with job_id
- Job already completed → HTTP 409 with current status
- Cancellation timeout → Log warning, force terminate process

#### 4. Network and External Errors

**Background Music Upload:**
- Upload failed → HTTP 500 with upload error details
- Invalid audio format → HTTP 400 with supported formats
- File too large → HTTP 413 with size limit

### Error Response Format

```python
class ErrorResponse(BaseModel):
    error: str
    detail: str
    error_code: str
    timestamp: float
```

**Example:**
```json
{
  "error": "Validation Error",
  "detail": "Transition duration must be between 0.5 and 3.0 seconds. Got: 5.0",
  "error_code": "INVALID_TRANSITION_DURATION",
  "timestamp": 1704067200.0
}
```

### Error Handling Patterns

#### Backend Router Level

```python
@router.post("/run")
async def concat_run(req: ConcatRunRequest, background_tasks: BackgroundTasks):
    try:
        # Validate inputs
        if len(req.files) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 videos are required for concatenation"
            )
        
        # Validate file existence
        for file_path in req.files:
            normalized = _normalize_project_file(req.project, file_path)
            full_path = VIDEO_PROJECTS_DIR / req.project / normalized
            if not full_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"File not found: {req.project}/{normalized}"
                )
        
        # Validate transition duration
        if not (0.5 <= req.transition_duration <= 3.0):
            raise HTTPException(
                status_code=400,
                detail=f"Transition duration must be between 0.5 and 3.0 seconds. Got: {req.transition_duration}"
            )
        
        # Create and start job
        job = create_job()
        background_tasks.add_task(_run_async, job, req)
        
        return ConcatRunResponse(job_id=job.job_id, message="Job started")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Concat run error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
```

#### Worker Level

```python
def run_concat_job(job: ConcatJobStatus, ...):
    try:
        # Stage 1: Validate
        _update_stage(job, 1, "Validating inputs")
        _validate_inputs(input_paths)
        
        # Stage 2: Build command
        _update_stage(job, 2, "Building FFmpeg command")
        cmd = _build_ffmpeg_concat(...)
        
        # Stage 3: Execute
        _update_stage(job, 3, "Processing videos")
        _execute_ffmpeg(cmd, job)
        
        # Stage 4: Finalize
        _update_stage(job, 4, "Finalizing output")
        _finalize_output(output_path)
        
        # Success
        job.status = "done"
        job.progress = 100
        job.output_path = output_path
        job.finished_at = time.time()
        
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode() if e.stderr else "No error output"
        job.fail(f"FFmpeg error: {stderr}")
    except FileNotFoundError as e:
        job.fail(f"File not found: {e}")
    except PermissionError as e:
        job.fail(f"Permission denied: {e}")
    except Exception as e:
        job.fail(f"Unexpected error: {e}")
        logger.error(f"Concat job {job.job_id} failed", exc_info=True)
```

#### Frontend Error Display

```typescript
// API error handling
try {
  const response = await concatApi.run(config);
  setJobId(response.job_id);
} catch (error) {
  if (error.response?.status === 400) {
    toast.error(`Validation Error: ${error.response.data.detail}`);
  } else if (error.response?.status === 404) {
    toast.error(`File Not Found: ${error.response.data.detail}`);
  } else if (error.response?.status === 500) {
    toast.error(`Server Error: ${error.response.data.detail}`);
  } else {
    toast.error(`Unexpected Error: ${error.message}`);
  }
}

// Job status error handling
if (jobStatus?.status === "error") {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Concat Failed</AlertTitle>
      <AlertDescription>
        {jobStatus.error}
      </AlertDescription>
    </Alert>
  );
}
```

### Logging Strategy

```python
# Structured logging with context
logger.info(
    f"[Concat] Job {job_id} started",
    extra={
        "job_id": job_id,
        "project": project,
        "video_count": len(files),
        "transition_type": transition_type,
    }
)

logger.error(
    f"[Concat] Job {job_id} failed: {error}",
    extra={
        "job_id": job_id,
        "stage": job.stage,
        "progress": job.progress,
        "error": str(error),
    },
    exc_info=True
)
```

### Retry and Recovery

**Job Cancellation:**
- Set `cancel_requested` flag
- Check flag between pipeline stages
- Terminate FFmpeg subprocess gracefully (SIGTERM)
- If not terminated in 5s, force kill (SIGKILL)
- Clean up temporary files

**Temporary File Cleanup:**
```python
def _cleanup_temp_files(temp_files: List[str]):
    """Clean up temporary files on error or completion"""
    for path in temp_files:
        try:
            if path and Path(path).exists():
                Path(path).unlink()
        except Exception as e:
            logger.warning(f"Failed to cleanup temp file {path}: {e}")
```

**Disk Space Check:**
```python
def _check_disk_space(output_dir: Path, estimated_size: int):
    """Check if sufficient disk space is available"""
    stat = shutil.disk_usage(output_dir)
    available = stat.free
    required = estimated_size * 1.2  # 20% buffer
    
    if available < required:
        raise RuntimeError(
            f"Insufficient disk space. Required: {required / 1e9:.2f}GB, "
            f"Available: {available / 1e9:.2f}GB"
        )
```



## Testing Strategy

### Dual Testing Approach

The video-concat feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Both are complementary and necessary for comprehensive coverage

### Unit Testing

Unit tests focus on specific examples, integration points, and edge cases:

**Test Categories:**

1. **API Endpoint Tests**
   - POST /api/v1/concat/run with valid configuration
   - GET /api/v1/concat/status/{job_id} returns correct status
   - POST /api/v1/concat/cancel/{job_id} sets cancel flag
   - GET /api/v1/concat/file-info returns video metadata
   - Error responses for invalid inputs (404, 400, 500)

2. **Preset Management Tests**
   - GET /api/v1/settings/concat-presets lists all presets
   - POST /api/v1/settings/concat-presets creates new preset
   - PUT /api/v1/settings/concat-presets/{name} updates preset
   - DELETE /api/v1/settings/concat-presets/{name} removes preset
   - Duplicate name rejection
   - Empty state returns default preset

3. **FFmpeg Command Builder Tests**
   - Simple concat (no transitions, no trim) uses concat demuxer
   - Crossfade transition generates correct xfade filter
   - Dip to black transition generates correct fade filters
   - Trim settings generate correct -ss and -t flags
   - Resolution scaling generates correct scale+pad filter
   - Audio muting removes original audio tracks
   - Background music generates correct amerge filter

4. **Edge Cases**
   - Empty video selection shows empty state message
   - Single video selection disables concat (minimum 2 required)
   - Very long duration (>10 minutes) shows warning
   - Corrupted video file shows error message
   - Non-writable output directory shows permission error
   - Insufficient disk space shows error before starting

5. **Integration Tests**
   - Full concat pipeline with 2 videos, cut transition
   - Full concat pipeline with 3 videos, crossfade transition
   - Concat with trim points on all videos
   - Concat with background music mixing
   - Concat with audio muting
   - Job cancellation during processing

### Property-Based Testing

Property tests verify universal properties across randomized inputs. Each property test should run minimum 100 iterations.

**Property Test Library:** Use `hypothesis` for Python backend tests.

**Configuration:**
```python
from hypothesis import given, settings, strategies as st

@settings(max_examples=100)
@given(
    video_count=st.integers(min_value=2, max_value=10),
    transition_duration=st.floats(min_value=0.5, max_value=3.0),
)
def test_property_transition_application(video_count, transition_duration):
    """
    Feature: video-concat, Property 6: Transition Application Between Clips
    
    For any video sequence with N videos and any transition type,
    the system should apply N-1 transitions between consecutive clips.
    """
    # Test implementation
```

**Key Property Tests:**

1. **Property 7: Duration Calculation Correctness**
   ```python
   @given(
       videos=st.lists(st.floats(min_value=1.0, max_value=60.0), min_size=2, max_size=10),
       transition_duration=st.floats(min_value=0.5, max_value=3.0),
       transition_type=st.sampled_from(["cut", "crossfade", "dip_to_black"]),
   )
   def test_duration_calculation(videos, transition_duration, transition_type):
       """
       Feature: video-concat, Property 7: Duration Calculation Correctness
       
       For any video sequence, trim settings, and transition configuration,
       the estimated total duration should equal the sum of trimmed video
       durations minus transition overlaps.
       """
   ```

2. **Property 10: Job ID Uniqueness**
   ```python
   @given(job_count=st.integers(min_value=2, max_value=20))
   def test_job_id_uniqueness(job_count):
       """
       Feature: video-concat, Property 10: Job ID Uniqueness
       
       For any set of concat operations started simultaneously,
       all job IDs should be unique.
       """
   ```

3. **Property 18: Preset Round-Trip Persistence**
   ```python
   @given(
       preset_name=st.text(min_size=1, max_size=50, alphabet=st.characters(blacklist_characters="'\";--")),
       transition_type=st.sampled_from(["cut", "crossfade", "dip_to_black", "glitch"]),
       resolution=st.sampled_from(["original", "1080p", "720p", "480p"]),
       quality=st.sampled_from(["high", "medium", "low"]),
   )
   def test_preset_round_trip(preset_name, transition_type, resolution, quality):
       """
       Feature: video-concat, Property 18: Preset Round-Trip Persistence
       
       For any valid configuration, saving it as a preset then loading
       that preset should restore the same configuration values.
       """
   ```

4. **Property 20: Trim Point Validation**
   ```python
   @given(
       start=st.floats(min_value=-10.0, max_value=100.0),
       end=st.floats(min_value=-10.0, max_value=100.0),
       video_duration=st.floats(min_value=1.0, max_value=60.0),
   )
   def test_trim_validation(start, end, video_duration):
       """
       Feature: video-concat, Property 20: Trim Point Validation
       
       For any trim point where start >= end or where either value is
       outside the video duration, the system should reject it with
       a validation error.
       """
   ```

5. **Property 35: Path Traversal Prevention**
   ```python
   @given(
       malicious_path=st.text(min_size=1, max_size=100).filter(
           lambda x: "../" in x or "..\\" in x
       )
   )
   def test_path_traversal_prevention(malicious_path):
       """
       Feature: video-concat, Property 35: Path Traversal Prevention
       
       For any file path containing path traversal patterns (../, ..\\),
       the system should reject it with a security error.
       """
   ```

### Test Data Generation

**Video File Generators:**
```python
# Generate test video files with FFmpeg
def generate_test_video(
    duration: float,
    resolution: str,
    output_path: str,
):
    """Generate a test video file with specified properties"""
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", f"testsrc=duration={duration}:size={resolution}:rate=30",
        "-f", "lavfi",
        "-i", f"sine=frequency=1000:duration={duration}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
```

**Hypothesis Strategies:**
```python
# Custom strategies for video-concat domain
video_path_strategy = st.text(
    min_size=1,
    max_size=100,
    alphabet=st.characters(
        whitelist_categories=("Lu", "Ll", "Nd"),
        whitelist_characters="_-./",
        blacklist_characters="'\";",
    )
)

trim_point_strategy = st.builds(
    TrimPoint,
    start=st.floats(min_value=0.0, max_value=50.0),
    end=st.floats(min_value=0.1, max_value=60.0),
).filter(lambda tp: tp.start < tp.end)

concat_config_strategy = st.builds(
    ConcatConfig,
    transition_type=st.sampled_from(["cut", "crossfade", "dip_to_black", "glitch"]),
    transition_duration=st.floats(min_value=0.5, max_value=3.0),
    resolution=st.sampled_from(["original", "1080p", "720p", "480p"]),
    quality=st.sampled_from(["high", "medium", "low"]),
    mute_original_audio=st.booleans(),
    enable_audio_fade=st.booleans(),
    audio_fade_duration=st.floats(min_value=0.5, max_value=5.0),
    background_music_volume=st.integers(min_value=0, max_value=100),
)
```

### Frontend Testing

**Component Tests (React Testing Library):**
```typescript
describe("ConcatConfig", () => {
  it("should update transition type when selected", () => {
    const onChange = jest.fn();
    render(<ConcatConfig config={defaultConfig} onChange={onChange} />);
    
    const select = screen.getByLabelText("Transition Type");
    fireEvent.change(select, { target: { value: "crossfade" } });
    
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ transition_type: "crossfade" })
    );
  });
  
  it("should validate transition duration range", () => {
    const onChange = jest.fn();
    render(<ConcatConfig config={defaultConfig} onChange={onChange} />);
    
    const input = screen.getByLabelText("Transition Duration");
    fireEvent.change(input, { target: { value: "5.0" } });
    
    expect(screen.getByText(/must be between 0.5 and 3.0/i)).toBeInTheDocument();
  });
});
```

**Integration Tests (Playwright):**
```typescript
test("full concat workflow", async ({ page }) => {
  await page.goto("/concat?project=test-project");
  
  // Select videos
  await page.click('[data-testid="video-1"]');
  await page.click('[data-testid="video-2"]');
  
  // Configure settings
  await page.selectOption('[data-testid="transition-type"]', "crossfade");
  await page.fill('[data-testid="transition-duration"]', "1.5");
  
  // Start concat
  await page.click('[data-testid="run-button"]');
  
  // Wait for completion
  await page.waitForSelector('[data-testid="success-message"]', { timeout: 60000 });
  
  // Verify output
  const outputPath = await page.textContent('[data-testid="output-path"]');
  expect(outputPath).toContain("_concat");
});
```

### Test Execution

**Backend Tests:**
```bash
# Run all tests
pytest backend/tests/

# Run specific test file
pytest backend/tests/test_concat_worker.py

# Run property tests only
pytest backend/tests/test_concat_properties.py

# Run with coverage
pytest --cov=backend/services/concat_worker --cov-report=html
```

**Frontend Tests:**
```bash
# Run all tests
cd frontend && npm test

# Run specific test file
npm test -- ConcatConfig.test.tsx

# Run with coverage
npm test -- --coverage
```

### Continuous Integration

**GitHub Actions Workflow:**
```yaml
name: Test Video Concat

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r backend/requirements.txt
      - run: pip install pytest hypothesis pytest-cov
      - run: pytest backend/tests/test_concat*.py --cov
  
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install
      - run: cd frontend && npm test -- --coverage
```



## Frontend Component Structure

### Component Hierarchy

```
ConcatPage (page.tsx)
├─ PageHeader
│  └─ Title: "Video Concat"
├─ StudioAssetSelector
│  ├─ Video file list (from project)
│  ├─ Multi-select checkboxes
│  ├─ Drag-and-drop reordering
│  └─ Remove buttons
├─ ConcatConfig
│  ├─ TransitionSection
│  │  ├─ Select (transition type)
│  │  └─ Slider (transition duration)
│  ├─ TrimSection
│  │  └─ TrimEditor (per video)
│  │     ├─ Input (start time)
│  │     ├─ Input (end time)
│  │     └─ Button (reset)
│  ├─ AudioSection
│  │  ├─ Switch (mute original)
│  │  ├─ Switch (enable fade)
│  │  ├─ Slider (fade duration)
│  │  ├─ FileUpload (background music)
│  │  └─ Slider (music volume)
│  └─ OutputSection
│     ├─ Select (resolution)
│     ├─ Select (quality)
│     └─ Input (filename suffix)
├─ ConcatPreviewPanel
│  ├─ Card (estimated duration)
│  ├─ Card (estimated file size)
│  ├─ Card (video count)
│  └─ VideoMetadataList
│     └─ VideoMetadataItem (per video)
│        ├─ Thumbnail
│        ├─ Duration
│        ├─ Resolution
│        └─ File size
├─ StudioRunBar
│  ├─ PresetSelector
│  │  ├─ Select (preset dropdown)
│  │  ├─ Button (save preset)
│  │  └─ Button (delete preset)
│  ├─ Button (Run)
│  └─ Button (Cancel)
└─ ConcatRunProgress
   ├─ ProgressBar
   ├─ StageLabel
   ├─ CurrentVideo
   ├─ EstimatedTimeRemaining
   └─ Alert (success/error)
```

### State Management

**Page-Level State:**
```typescript
// Video selection
const [rawVideos, setRawVideos] = useState<string[]>([]);
const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
const [search, setSearch] = useState("");

// Trim settings (per video)
const [trimSettings, setTrimSettings] = useState<Map<string, TrimPoint>>(new Map());

// Concat configuration
const [concatConfig, setConcatConfig] = useState<ConcatConfig>({
  transition_type: "cut",
  transition_duration: 1.0,
  resolution: "original",
  quality: "high",
  output_suffix: "_concat",
  mute_original_audio: false,
  enable_audio_fade: true,
  audio_fade_duration: 2.0,
  background_music_file: null,
  background_music_volume: 50,
});

// Preset management
const [presets, setPresets] = useState<ConcatPreset[]>([]);
const [selectedPreset, setSelectedPreset] = useState<string>("");

// Job tracking
const [jobId, setJobId] = useState<string | null>(null);
const [jobStatus, setJobStatus] = useState<ConcatJobStatus | null>(null);
const [isRunning, setIsRunning] = useState(false);
const [isCancelling, setIsCancelling] = useState(false);

// Dialogs
const [saveDialogOpen, setSaveDialogOpen] = useState(false);
const [newPresetName, setNewPresetName] = useState("");
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
```

**State Update Handlers:**
```typescript
const handleVideoSelect = (videoPath: string) => {
  setSelectedVideos(prev => 
    prev.includes(videoPath)
      ? prev.filter(v => v !== videoPath)
      : [...prev, videoPath]
  );
};

const handleVideoReorder = (startIndex: number, endIndex: number) => {
  setSelectedVideos(prev => {
    const result = Array.from(prev);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  });
};

const handleTrimChange = (videoPath: string, trim: TrimPoint) => {
  setTrimSettings(prev => new Map(prev).set(videoPath, trim));
};

const handleConfigChange = (updates: Partial<ConcatConfig>) => {
  setConcatConfig(prev => ({ ...prev, ...updates }));
};
```

### API Integration

**API Client (frontend/src/lib/api.ts):**
```typescript
export const concatApi = {
  async run(config: ConcatRunRequest): Promise<ConcatRunResponse> {
    const response = await fetch(`${API_URL}/api/v1/concat/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async status(jobId: string): Promise<ConcatStatusResponse> {
    const response = await fetch(`${API_URL}/api/v1/concat/status/${jobId}`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async cancel(jobId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/concat/cancel/${jobId}`, {
      method: "POST",
    });
    if (!response.ok) throw new Error(await response.text());
  },

  async fileInfo(project: string, file: string): Promise<VideoMetadata> {
    const params = new URLSearchParams({ project, file });
    const response = await fetch(`${API_URL}/api/v1/concat/file-info?${params}`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
};

export const settingsApi = {
  async listConcatPresets(): Promise<ConcatPreset[]> {
    const response = await fetch(`${API_URL}/api/v1/settings/concat-presets`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },

  async createConcatPreset(preset: ConcatPreset): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/settings/concat-presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preset),
    });
    if (!response.ok) throw new Error(await response.text());
  },

  async updateConcatPreset(name: string, preset: ConcatPreset): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/settings/concat-presets/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preset),
    });
    if (!response.ok) throw new Error(await response.text());
  },

  async deleteConcatPreset(name: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/settings/concat-presets/${name}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(await response.text());
  },
};
```

### Reusable Components

**StudioAssetSelector (Reused from Looper):**
- Already supports multi-select
- Already supports search/filter
- Needs enhancement: drag-and-drop reordering
- Needs enhancement: display video metadata

**StudioRunBar (Reused from Looper):**
- Already supports preset dropdown
- Already supports save/delete preset
- Already supports run/cancel buttons
- No changes needed

**ConcatConfig (New Component):**
```typescript
interface ConcatConfigProps {
  config: ConcatConfig;
  onChange: (config: Partial<ConcatConfig>) => void;
  selectedVideos: string[];
  trimSettings: Map<string, TrimPoint>;
  onTrimChange: (videoPath: string, trim: TrimPoint) => void;
  projectName: string;
}

export function ConcatConfig({
  config,
  onChange,
  selectedVideos,
  trimSettings,
  onTrimChange,
  projectName,
}: ConcatConfigProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <TransitionSection
          type={config.transition_type}
          duration={config.transition_duration}
          onChange={onChange}
        />
        <TrimSection
          videos={selectedVideos}
          trimSettings={trimSettings}
          onChange={onTrimChange}
          projectName={projectName}
        />
        <AudioSection
          config={config}
          onChange={onChange}
          projectName={projectName}
        />
        <OutputSection
          config={config}
          onChange={onChange}
        />
      </CardContent>
    </Card>
  );
}
```

**ConcatPreviewPanel (New Component):**
```typescript
interface ConcatPreviewPanelProps {
  selectedVideos: string[];
  trimSettings: Map<string, TrimPoint>;
  config: ConcatConfig;
  projectName: string;
}

export function ConcatPreviewPanel({
  selectedVideos,
  trimSettings,
  config,
  projectName,
}: ConcatPreviewPanelProps) {
  const [metadata, setMetadata] = useState<Map<string, VideoMetadata>>(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch metadata for all selected videos
  useEffect(() => {
    const fetchMetadata = async () => {
      setLoading(true);
      const newMetadata = new Map<string, VideoMetadata>();
      for (const video of selectedVideos) {
        try {
          const info = await concatApi.fileInfo(projectName, video);
          newMetadata.set(video, info);
        } catch (error) {
          console.error(`Failed to fetch metadata for ${video}:`, error);
        }
      }
      setMetadata(newMetadata);
      setLoading(false);
    };
    
    if (selectedVideos.length > 0) {
      fetchMetadata();
    }
  }, [selectedVideos, projectName]);

  // Calculate estimated duration
  const estimatedDuration = useMemo(() => {
    let total = 0;
    for (const video of selectedVideos) {
      const meta = metadata.get(video);
      if (!meta) continue;
      
      const trim = trimSettings.get(video);
      const duration = trim ? (trim.end - trim.start) : meta.duration;
      total += duration;
    }
    
    // Subtract transition overlaps
    if (config.transition_type !== "cut" && selectedVideos.length > 1) {
      const transitionCount = selectedVideos.length - 1;
      total -= transitionCount * config.transition_duration;
    }
    
    return total;
  }, [selectedVideos, metadata, trimSettings, config]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Video Count"
            value={selectedVideos.length.toString()}
          />
          <KpiCard
            label="Estimated Duration"
            value={formatDuration(estimatedDuration)}
          />
          <KpiCard
            label="Estimated Size"
            value="~150 MB"
          />
        </div>
        
        {estimatedDuration > 600 && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Long Duration</AlertTitle>
            <AlertDescription>
              The estimated duration exceeds 10 minutes. Processing may take a while.
            </AlertDescription>
          </Alert>
        )}
        
        <VideoMetadataList
          videos={selectedVideos}
          metadata={metadata}
          trimSettings={trimSettings}
          loading={loading}
        />
      </CardContent>
    </Card>
  );
}
```

**ConcatRunProgress (Adapted from LooperRunProgress):**
```typescript
interface ConcatRunProgressProps {
  jobStatus: ConcatJobStatus | null;
  onCancel: () => void;
  onReset: () => void;
}

export function ConcatRunProgress({
  jobStatus,
  onCancel,
  onReset,
}: ConcatRunProgressProps) {
  if (!jobStatus) return null;

  const isRunning = jobStatus.status === "running" || jobStatus.status === "pending";
  const isDone = jobStatus.status === "done";
  const isError = jobStatus.status === "error";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{jobStatus.stage_label}</span>
            <span>{jobStatus.progress}%</span>
          </div>
          <Progress value={jobStatus.progress} />
        </div>

        {jobStatus.current_video && (
          <p className="text-sm text-muted-foreground">
            Processing: {jobStatus.current_video}
          </p>
        )}

        {isDone && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Concat Complete!</AlertTitle>
            <AlertDescription>
              Output saved to: {jobStatus.output_path}
            </AlertDescription>
          </Alert>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Concat Failed</AlertTitle>
            <AlertDescription>{jobStatus.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          {isRunning && (
            <Button onClick={onCancel} variant="destructive">
              Cancel
            </Button>
          )}
          {(isDone || isError) && (
            <Button onClick={onReset} variant="outline">
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```



## Integration with Existing System

### Looper Pattern Reuse

Video Concat follows the same architectural patterns as Looper for consistency:

#### 1. Job Queue Pattern

**In-Memory Job Registry:**
```python
# backend/services/concat_worker.py
JOBS: Dict[str, ConcatJobStatus] = {}

def create_job() -> ConcatJobStatus:
    job_id = str(uuid.uuid4())
    job = ConcatJobStatus(job_id=job_id)
    JOBS[job_id] = job
    return job

def get_job(job_id: str) -> Optional[ConcatJobStatus]:
    return JOBS.get(job_id)
```

**Same as Looper:**
- In-memory job tracking (no database persistence for job status)
- UUID-based job IDs
- Status enum: pending | running | done | error
- Progress tracking: 0-100%
- Stage tracking with labels

#### 2. Background Processing

**Thread Pool Executor:**
```python
# backend/routers/concat.py
@router.post("/run")
async def concat_run(req: ConcatRunRequest, background_tasks: BackgroundTasks):
    job = create_job()
    
    async def _run_async():
        import asyncio
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _run)
    
    def _run():
        run_concat_job(job=job, ...)
    
    background_tasks.add_task(_run_async)
    return ConcatRunResponse(job_id=job.job_id, message="Job started")
```

**Same as Looper:**
- FastAPI BackgroundTasks for async execution
- run_in_executor for CPU-bound FFmpeg operations
- Non-blocking API responses

#### 3. Progress Polling

**Frontend Polling Pattern:**
```typescript
// Poll job status every 2 seconds
useEffect(() => {
  if (!jobId || !isRunning) return;
  
  const pollInterval = setInterval(async () => {
    try {
      const status = await concatApi.status(jobId);
      setJobStatus(status);
      
      if (status.status === "done" || status.status === "error") {
        setIsRunning(false);
        clearInterval(pollInterval);
      }
    } catch (error) {
      console.error("Failed to poll job status:", error);
    }
  }, 2000);
  
  return () => clearInterval(pollInterval);
}, [jobId, isRunning]);
```

**Same as Looper:**
- 2-second polling interval
- Stop polling on completion or error
- Cleanup on unmount

#### 4. Preset Management

**Database Storage:**
```python
# Reuse app_settings table with setting_type = "concat_preset"
# Same pattern as looper_preset

@router.get("/concat-presets")
async def list_concat_presets(db: Session = Depends(get_db)):
    rows = (
        db.query(AppSetting)
        .filter(AppSetting.setting_type == "concat_preset")
        .order_by(AppSetting.name.asc())
        .all()
    )
    return [_setting_to_dict(row) for row in rows]
```

**Same as Looper:**
- Store presets in app_settings table
- JSON payload for configuration
- CRUD endpoints in settings router
- Unique constraint on (setting_type, name)

### Shared Services

#### FFmpeg Service

**Reuse FFmpeg Utilities:**
```python
# backend/services/concat_worker.py
import imageio_ffmpeg

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# Reuse resolution and quality maps from looper_worker
RESOLUTION_MAP = {
    "original": None,
    "1080p": "1920:1080",
    "720p": "1280:720",
    "480p": "854:480",
}

CRF_MAP = {
    "high": "18",
    "medium": "23",
    "low": "28",
}
```

**Same as Looper:**
- imageio_ffmpeg for cross-platform FFmpeg binary
- Consistent resolution and quality presets
- Same CRF values for quality levels

#### File Validation

**Reuse Path Normalization:**
```python
# backend/routers/concat.py
def _normalize_project_file(project: str, file_value: str) -> str:
    """Same normalization logic as looper.py"""
    raw = (file_value or "").strip().replace("\\", "/")
    # ... (same implementation as looper)
    return "/".join(normalized_parts)
```

**Same as Looper:**
- Path traversal prevention
- Windows/Unix path normalization
- Project-relative path resolution

#### Logger

**Reuse Structured Logging:**
```python
# backend/services/concat_worker.py
from backend.core.logger import logger

logger.info(f"[Concat] Job {job_id} started", extra={
    "job_id": job_id,
    "project": project,
    "video_count": len(files),
})
```

**Same as Looper:**
- Structured logging with extra fields
- Consistent log prefixes ([Concat], [Looper])
- Same log levels and formatting

### Frontend Component Reuse

#### StudioAssetSelector

**Enhancements Needed:**
```typescript
// Add drag-and-drop reordering
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

// Add metadata display
interface AssetMetadata {
  duration: number;
  resolution: string;
  size: number;
}
```

**Reused Features:**
- Multi-select checkboxes
- Search/filter functionality
- Project-based file listing
- Thumbnail display

#### StudioRunBar

**No Changes Needed:**
- Preset dropdown selector
- Save preset dialog
- Delete preset confirmation
- Run/Cancel buttons
- All functionality works as-is for concat

#### UI Primitives

**Reuse shadcn/ui Components:**
- Button, Card, Input, Label, Select
- Dialog, AlertDialog, Alert
- Progress, Slider, Switch
- Separator, Tooltip

**Reuse Atoms:**
- PageHeader (page title and description)
- EmptyState (no videos selected)
- StatusBadge (job status display)
- KpiCard (metrics display)

### API Endpoint Pattern

**Consistent URL Structure:**
```
Looper:
  POST   /api/v1/looper/run
  GET    /api/v1/looper/status/{job_id}
  POST   /api/v1/looper/cancel/{job_id}
  GET    /api/v1/looper/file-info

Concat:
  POST   /api/v1/concat/run
  GET    /api/v1/concat/status/{job_id}
  POST   /api/v1/concat/cancel/{job_id}
  GET    /api/v1/concat/file-info

Settings:
  GET    /api/v1/settings/looper-presets
  POST   /api/v1/settings/looper-presets
  PUT    /api/v1/settings/looper-presets/{name}
  DELETE /api/v1/settings/looper-presets/{name}

  GET    /api/v1/settings/concat-presets
  POST   /api/v1/settings/concat-presets
  PUT    /api/v1/settings/concat-presets/{name}
  DELETE /api/v1/settings/concat-presets/{name}
```

**Same Patterns:**
- RESTful resource naming
- Consistent HTTP methods
- Same response formats
- Same error handling

### File Structure

**Project Folder Layout:**
```
video_projects/
└── {project_name}/
    ├── raw/              # Source videos
    ├── final/            # Concat outputs (same as looper)
    ├── watermarks/       # Watermark assets (shared with looper)
    └── audio/            # Background music files (new)
```

**Output Naming:**
```python
# Same pattern as looper
output_dir = project_dir / "final"
output_path = output_dir / f"{stem}{suffix}_{unique_token}.mp4"

# Example: video1_concat_a1b2c3d4.mp4
```

### Database Schema

**Reuse app_settings Table:**
```sql
-- No schema changes needed
-- Concat presets use same table as looper presets

SELECT * FROM app_settings 
WHERE setting_type = 'concat_preset';

SELECT * FROM app_settings 
WHERE setting_type = 'looper_preset';
```

### Configuration

**Reuse Environment Variables:**
```bash
# .env (no new variables needed)
DATABASE_URL=postgresql://...
VIDEO_PROJECTS_DIR=./video_projects
```

**Reuse Config File:**
```json
// config.json (no new fields needed)
{
  "concat_presets": {
    "default": {
      "description": "Default concat settings",
      "transition_type": "cut",
      "resolution": "original",
      "quality": "high"
    }
  }
}
```

### Migration Path

**No Database Migrations:**
- Reuse existing app_settings table
- No new tables or columns needed

**Backend Registration:**
```python
# backend/main.py
from backend.routers import concat

app.include_router(concat.router)
```

**Frontend Route:**
```typescript
// frontend/src/app/concat/page.tsx
// New route, no changes to existing routes
```

### Differences from Looper

While concat follows the same patterns, there are key differences:

| Aspect | Looper | Concat |
|--------|--------|--------|
| Input | Single video | Multiple videos (2+) |
| Primary Operation | Loop + effects | Concatenate + transitions |
| Trim Support | Cut start only | Per-video start/end |
| Scene Mixer | Yes (optional) | No |
| Visual Effects | Yes (zoom, mirror, etc) | No |
| Transitions | Crossfade only | Cut, crossfade, dip_to_black, glitch |
| Audio Mixing | Replace or mix | Preserve, mute, or mix |
| Output Count | 1 per job | 1 per job |
| Batch Support | No | Yes (multiple jobs) |

### Integration Testing

**Test Looper + Concat Workflow:**
```python
def test_looper_then_concat():
    """Test using looper output as concat input"""
    # 1. Run looper on video1
    looper_job = run_looper_job(...)
    assert looper_job.status == "done"
    looper_output = looper_job.output_path
    
    # 2. Run looper on video2
    looper_job2 = run_looper_job(...)
    assert looper_job2.status == "done"
    looper_output2 = looper_job2.output_path
    
    # 3. Concat both looper outputs
    concat_job = run_concat_job(
        input_paths=[looper_output, looper_output2],
        ...
    )
    assert concat_job.status == "done"
    assert Path(concat_job.output_path).exists()
```

**Test Preset Isolation:**
```python
def test_preset_isolation():
    """Test that looper and concat presets don't conflict"""
    # Create looper preset
    create_looper_preset(name="test", ...)
    
    # Create concat preset with same name
    create_concat_preset(name="test", ...)
    
    # Both should exist independently
    looper_presets = list_looper_presets()
    concat_presets = list_concat_presets()
    
    assert any(p["name"] == "test" for p in looper_presets)
    assert any(p["name"] == "test" for p in concat_presets)
```



## Implementation Roadmap

### Phase 1: Backend Foundation (Priority: High)

**Tasks:**
1. Create `backend/services/concat_worker.py`
   - Job registry (JOBS dict)
   - ConcatJobStatus dataclass
   - create_job(), get_job() functions
   - run_concat_job() main pipeline
   - _validate_inputs() function
   - _build_ffmpeg_concat() command builder

2. Create `backend/routers/concat_schemas.py`
   - ConcatRunRequest
   - ConcatRunResponse
   - ConcatStatusResponse
   - TrimPoint

3. Create `backend/routers/concat.py`
   - POST /run endpoint
   - GET /status/{job_id} endpoint
   - POST /cancel/{job_id} endpoint
   - GET /file-info endpoint
   - _normalize_project_file() helper

4. Update `backend/routers/settings_schemas.py`
   - Add ConcatPreset model

5. Update `backend/routers/settings.py`
   - Add concat-presets endpoints (GET, POST, PUT, DELETE)

6. Register concat router in `backend/main.py`

**Acceptance Criteria:**
- All API endpoints return correct responses
- Job creation and status tracking works
- FFmpeg command builder generates valid commands
- Preset CRUD operations work
- Backend smoke test passes: `python -c "import backend.main; print('ok')"`

### Phase 2: FFmpeg Command Implementation (Priority: High)

**Tasks:**
1. Implement simple concat (no transitions)
   - Concat demuxer with file list
   - Copy codec for fast processing

2. Implement transition filters
   - Crossfade using xfade filter
   - Dip to black using fade filters
   - Glitch effect (optional, can defer)

3. Implement trim support
   - -ss and -t flags per input
   - Duration calculation with trims

4. Implement audio mixing
   - Preserve original audio (concat audio streams)
   - Mute original audio
   - Mix background music (amerge filter)
   - Audio fade (afade filter)
   - Music looping (aloop filter)

5. Implement resolution scaling
   - Scale and pad filter
   - Aspect ratio preservation

6. Implement progress monitoring
   - Parse FFmpeg stderr
   - Update job progress percentage
   - Track current video being processed

**Acceptance Criteria:**
- Simple concat produces valid output
- All transition types work correctly
- Trim points are applied accurately
- Audio mixing produces correct output
- Progress updates during processing
- FFmpeg errors are captured and reported

### Phase 3: Frontend Components (Priority: High)

**Tasks:**
1. Create `frontend/src/app/concat/page.tsx`
   - Page layout and state management
   - Integration of all sub-components
   - Job polling logic
   - Preset management logic

2. Create `frontend/src/components/studio/ConcatConfig.tsx`
   - TransitionSection
   - TrimSection with TrimEditor
   - AudioSection
   - OutputSection

3. Create `frontend/src/components/studio/ConcatPreviewPanel.tsx`
   - Duration calculation
   - File size estimation
   - Video metadata display
   - Warning for long durations

4. Create `frontend/src/components/studio/ConcatRunProgress.tsx`
   - Progress bar
   - Stage label display
   - Current video display
   - Success/error alerts

5. Enhance `frontend/src/components/studio/StudioAssetSelector.tsx`
   - Add drag-and-drop reordering (dnd-kit)
   - Add metadata display per video

6. Update `frontend/src/lib/api.ts`
   - Add concatApi methods
   - Add concat preset methods to settingsApi

**Acceptance Criteria:**
- All components render correctly
- Video selection and reordering works
- Configuration changes update state
- Preview panel shows correct estimates
- Progress tracking displays updates
- Frontend build passes: `cd frontend && npm run build`

### Phase 4: Testing (Priority: Medium)

**Tasks:**
1. Write backend unit tests
   - API endpoint tests
   - FFmpeg command builder tests
   - Preset CRUD tests
   - Input validation tests

2. Write backend property tests
   - Duration calculation property
   - Job ID uniqueness property
   - Preset round-trip property
   - Trim validation property
   - Path traversal prevention property

3. Write frontend component tests
   - ConcatConfig component tests
   - ConcatPreviewPanel component tests
   - ConcatRunProgress component tests

4. Write integration tests
   - Full concat workflow (2 videos, cut)
   - Full concat workflow (3 videos, crossfade)
   - Concat with trim points
   - Concat with background music
   - Job cancellation

**Acceptance Criteria:**
- All unit tests pass
- All property tests pass (100 iterations each)
- All component tests pass
- All integration tests pass
- Test coverage > 80%

### Phase 5: Documentation and Polish (Priority: Low)

**Tasks:**
1. Update API documentation
   - Add concat endpoints to OpenAPI docs
   - Add example requests/responses

2. Create user documentation
   - How to use concat feature
   - Transition types explained
   - Trim editor guide
   - Audio mixing guide

3. Add error messages and tooltips
   - Validation error messages
   - Help tooltips for settings
   - Warning messages for edge cases

4. Performance optimization
   - Optimize FFmpeg command generation
   - Optimize frontend re-renders
   - Add loading states

5. Accessibility improvements
   - Keyboard navigation
   - Screen reader support
   - Focus management

**Acceptance Criteria:**
- API docs are complete and accurate
- User documentation is clear and helpful
- All error messages are descriptive
- Performance is acceptable (no lag)
- Accessibility audit passes

### Phase 6: Batch Processing (Priority: Low, Optional)

**Tasks:**
1. Add batch job management UI
   - List of active jobs
   - Progress for each job
   - Cancel individual jobs

2. Add batch completion notification
   - Summary of successful/failed jobs
   - Telegram notification integration

3. Add batch preset support
   - Apply same preset to multiple concat operations

**Acceptance Criteria:**
- Multiple jobs can run simultaneously
- Each job has independent progress tracking
- Batch completion notification works
- Batch preset application works

## Performance Considerations

### FFmpeg Optimization

**Fast Concat (No Re-encoding):**
- Use concat demuxer when possible
- Copy codec instead of re-encoding
- Significantly faster for simple concat

**Parallel Processing:**
- Thread pool executor allows concurrent jobs
- Each job runs in separate thread
- System resources distributed fairly

**Progress Monitoring:**
- Parse FFmpeg stderr in real-time
- Update progress every 2 seconds
- Minimal overhead on processing

### Frontend Optimization

**State Management:**
- Use useMemo for expensive calculations
- Use useCallback for event handlers
- Minimize re-renders with React.memo

**API Calls:**
- Debounce metadata fetching
- Cache video metadata
- Cancel pending requests on unmount

**Large Video Lists:**
- Virtualize video list for 100+ videos
- Lazy load thumbnails
- Paginate if necessary

### Database Optimization

**Preset Queries:**
- Index on (setting_type, name)
- Limit preset count per user
- Cache preset list in memory

## Security Considerations

### Input Validation

**Path Traversal Prevention:**
```python
def _normalize_project_file(project: str, file_value: str) -> str:
    # Remove path traversal patterns
    if any(part == ".." for part in normalized_parts):
        raise HTTPException(status_code=400, detail="Path traversal not allowed")
```

**SQL Injection Prevention:**
- Use parameterized queries (SQLAlchemy ORM)
- Validate preset names (no special characters)
- Escape user input in error messages

**Command Injection Prevention:**
- Use subprocess with list arguments (not shell=True)
- Validate all FFmpeg parameters
- Sanitize file paths

### Resource Limits

**Disk Space:**
- Check available space before starting
- Estimate output size based on quality
- Clean up temporary files on error

**Memory:**
- Stream FFmpeg output (don't buffer)
- Limit concurrent jobs
- Monitor memory usage

**CPU:**
- Use thread pool executor (limited threads)
- Set FFmpeg preset to "fast" (not "ultrafast" or "veryslow")
- Allow job cancellation

### Authentication

**API Endpoints:**
- Add authentication middleware (future)
- Rate limiting per user (future)
- Audit logging for sensitive operations (future)

**File Access:**
- Validate project ownership (future)
- Restrict access to project files only
- No access to system files

## Monitoring and Observability

### Logging

**Structured Logs:**
```python
logger.info("[Concat] Job started", extra={
    "job_id": job_id,
    "project": project,
    "video_count": len(files),
    "transition_type": transition_type,
    "resolution": resolution,
    "quality": quality,
})
```

**Log Levels:**
- INFO: Job lifecycle events
- WARNING: Recoverable errors, fallbacks
- ERROR: Job failures, exceptions
- DEBUG: FFmpeg commands, detailed progress

### Metrics

**Job Metrics:**
- Total jobs started
- Jobs completed successfully
- Jobs failed
- Average processing time
- Average output file size

**System Metrics:**
- Active job count
- Thread pool utilization
- Disk space usage
- Memory usage

### Alerting

**Error Alerts:**
- FFmpeg failures (high rate)
- Disk space low
- Thread pool exhausted

**Performance Alerts:**
- Processing time > 5 minutes
- Output file size > 1GB
- Memory usage > 80%

## Future Enhancements

### Advanced Transitions

- Custom transition effects (wipe, slide, zoom)
- Transition preview in UI
- Per-transition configuration (different between each pair)

### Advanced Audio

- Per-video audio volume control
- Audio normalization
- Audio effects (reverb, echo, etc)
- Multiple background music tracks

### Advanced Trimming

- Visual timeline editor
- Frame-accurate trimming
- Keyframe detection
- Thumbnail scrubbing

### Batch Operations

- Batch preset application
- Queue management
- Priority scheduling
- Retry failed jobs

### Export Options

- Multiple output formats (MP4, MOV, WEBM)
- Multiple quality levels in one job
- Thumbnail generation
- Metadata embedding

### Collaboration

- Share concat configurations
- Template library
- Preset marketplace
- Collaborative editing

