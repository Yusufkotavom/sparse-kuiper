---
name: python-feature-coder
description: Implement Python features with clean module boundaries, typed schemas, robust error handling, and maintainable service patterns. Use for backend/service/worker Python changes.
---

# Python Feature Coder

## Use when
- Adding or refactoring Python services, workers, or helpers.
- Converting ad-hoc scripts into maintainable modules.

## Workflow
1. Define function/class contracts and typed data structures.
2. Follow existing repository style and import patterns.
3. Keep side effects isolated (I/O, process, network).
4. Add structured logging and clear error surfaces.
5. Run compile/smoke checks after changes.
6. Document public entrypoints and assumptions.

## Required output
- Changed modules and their responsibilities.
- Validation commands + observed status.
- Known edge cases and constraints.
