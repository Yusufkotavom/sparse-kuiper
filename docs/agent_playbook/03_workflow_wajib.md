# 03 — Mandatory Workflow

## Stage 1: Discovery
- validate impacted file scope,
- read applicable AGENTS.md instructions,
- record change risks.

## Stage 2: Design
- write a short plan (schema/API/UI),
- ensure backward compatibility.

## Stage 3: Implement
- make small, atomic changes,
- avoid mixing unrelated domains in a single commit.

## Stage 4: Validate
- backend smoke: run service and verify docs endpoint,
- frontend smoke: build + typecheck,
- document executed commands.

## Stage 5: Document
- update impacted documentation,
- include risk and fallback notes.

## Stage 6: Release Discipline
- use conventional commit format,
- PR body includes summary, testing, risk, and rollback.
