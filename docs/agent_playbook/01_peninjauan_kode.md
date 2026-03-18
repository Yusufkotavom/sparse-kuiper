# 01 — Code Review

## Goal
Create a baseline view of the codebase so follow-up changes have clear priorities.

## Key findings
- Backend structure is modular (`routers`, `services`, `models`).
- Database migration style is mixed (auto-create + manual startup helpers).
- Frontend already has centralized API access (`frontend/src/lib/api.ts`) and should keep it.
- Documentation exists but should be further operationalized into explicit execution checklists.

## Improvement priorities
1. **Data stability**
   - ensure every schema change is idempotent.
2. **Delivery consistency**
   - enforce a mandatory workflow before merge.
3. **Agent governance**
   - define explicit and auditable AI-agent instructions.

## Required output from this stage
- Risk areas (DB, API, worker, UI).
- Quick wins (1–2 sprints).
- Larger multi-sprint changes + mitigation.
