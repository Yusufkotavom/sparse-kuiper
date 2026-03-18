# 02 — Recommended Skills (Required)

## 1) repo-auditor
**Purpose:** architecture/dependency audit and technical debt hotspot mapping.

**Output checklist:**
- module risk map,
- coupling hotspots,
- phased refactor suggestions.

## 2) migration-designer
**Purpose:** safe and reversible schema migration planning.

**Output checklist:**
- migration steps,
- rollback plan,
- compatibility matrix (old/new consumers).

## 3) release-guardian
**Purpose:** quality gate before merge.

**Output checklist:**
- lint/build/typecheck,
- backend/frontend smoke checks,
- breaking-change notes.

## 4) agent-policy-checker
**Purpose:** AGENTS.md and repository policy compliance review.

**Output checklist:**
- policy violations,
- severity levels,
- corrective actions.

## Minimum definition of done
A skill is considered production-ready when it has:
- a standard input/output contract,
- usage examples,
- consistent invocation in PR workflow.
