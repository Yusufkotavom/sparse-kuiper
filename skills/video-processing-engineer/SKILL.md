---
name: video-processing-engineer
description: Build or refactor video-processing features (ingest, transcode, trim, merge, thumbnail, metadata) for backend services and automation workers. Use when implementing media pipelines.
---

# Video Processing Engineer

## Use when
- Adding video ingest/transcode flows.
- Implementing clip/merge/thumbnail/metadata operations.
- Improving queue-based media processing reliability.

## Workflow
1. Define input format, output format, and quality targets.
2. Design pipeline stages (decode, transform, encode, persist).
3. Implement processing service with explicit parameters.
4. Add progress/state updates for queue visibility.
5. Validate outputs (duration, codec, resolution, bitrate).
6. Document performance limits and fallback behavior.

## Required output
- Pipeline stage map.
- Commands/options used for processing.
- Validation checklist for media correctness.
- Error handling matrix.
