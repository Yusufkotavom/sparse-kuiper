---
name: test-and-debug-runner
description: Run practical validation and debugging loops (build, smoke, runtime checks, root-cause notes) before commit/PR. Use for stabilization and confidence checks.
---

# Test and Debug Runner

## Use when
- A feature is implemented and must be validated.
- Regression risk is non-trivial.

## Workflow
1. Select checks based on touched stack.
2. Execute commands and capture outcomes.
3. Investigate failures to root cause.
4. Apply minimal fixes and re-run checks.
5. Produce concise verification report.

## Required output
- Command matrix (pass/warn/fail).
- Root-cause notes for failures.
- Residual risk list.
