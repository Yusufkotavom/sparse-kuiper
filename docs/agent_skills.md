# AI Agent Skills for Sparse Kuiper

This document lists the recommended skill pack for ongoing engineering work in this project.

## Core governance and delivery skills
- `skills/repo-auditor/SKILL.md`
- `skills/migration-designer/SKILL.md`
- `skills/release-guardian/SKILL.md`
- `skills/agent-policy-checker/SKILL.md`
- `skills/realtime-rollout-planner/SKILL.md`

## New implementation-focused coding skills
- `skills/ai-agent-bootstrap/SKILL.md` (add a new AI agent)
- `skills/video-processing-engineer/SKILL.md` (video processing features)
- `skills/python-feature-coder/SKILL.md` (Python module/service development)
- `skills/fastapi-feature-builder/SKILL.md` (FastAPI endpoint and schema work)
- `skills/telegram-notification-integration/SKILL.md` (Telegram bot settings + notifier wiring)
- `skills/ffmpeg-pipeline-builder/SKILL.md` (ffmpeg command pipelines)
- `skills/nextjs-ui-integrator/SKILL.md` (Next.js + shadcn/ui frontend implementation)
- `skills/test-and-debug-runner/SKILL.md` (validation and debugging loop)

## Recommended combinations
1. **Add a new AI agent**
   - `ai-agent-bootstrap` → `python-feature-coder` → `fastapi-feature-builder` → `agent-policy-checker` → `release-guardian`
2. **Add video processing functionality**
   - `video-processing-engineer` → `ffmpeg-pipeline-builder` → `python-feature-coder` → `test-and-debug-runner`
3. **Database or real-time evolution**
   - `migration-designer` → `realtime-rollout-planner` → `agent-policy-checker` → `release-guardian`
4. **Frontend-connected feature**
   - `nextjs-ui-integrator` → `fastapi-feature-builder` → `test-and-debug-runner`
5. **Operational notifications and alerting**
   - `telegram-notification-integration` → `queue-workflow-reliability` → `fastapi-feature-builder` → `nextjs-ui-integrator`
