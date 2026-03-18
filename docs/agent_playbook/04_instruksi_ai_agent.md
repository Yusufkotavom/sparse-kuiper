# 04 — Mandatory Instructions for AI Agents

## Execution rules
1. Always read AGENTS.md in the scope of changed files.
2. Follow existing file style (avoid mass reformatting).
3. For frontend, prioritize reusable components + shadcn/ui primitives.
4. For frontend API usage, route calls through `frontend/src/lib/api.ts`.
5. For DB migrations, keep changes idempotent and safe to rerun.

## Validation rules
- every change includes verification commands,
- results are reported as pass/warning/fail,
- environment limitations are explicitly stated.

## PR output rules
- change summary,
- system impact,
- test evidence,
- rollback plan for schema/runtime changes.

## Anti-patterns
- adding ad-hoc page-level fetch calls,
- combining large refactors with new features in one PR,
- schema changes without rollback planning.
