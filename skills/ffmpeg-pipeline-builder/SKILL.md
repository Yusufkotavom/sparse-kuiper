---
name: ffmpeg-pipeline-builder
description: Design and implement ffmpeg-based media commands for trimming, scaling, concatenation, audio mix, subtitles, and optimized exports. Use for low-level encoding pipeline tasks.
---

# FFmpeg Pipeline Builder

## Use when
- Building command-level media processing features.
- Troubleshooting codec/container/quality issues.

## Workflow
1. Capture exact media objective and constraints.
2. Choose codecs, container, and compatibility target.
3. Build ffmpeg command with explicit flags.
4. Add deterministic output naming and paths.
5. Validate media integrity with ffprobe checks.
6. Record performance trade-offs (quality vs speed).

## Required output
- Final ffmpeg command(s).
- Explanation of key options.
- ffprobe validation summary.
- Fallback command for broader compatibility.
