---
name: ai-agent-bootstrap
description: Create and integrate a new AI agent module with clear interfaces, configuration, safety boundaries, and task orchestration in this monorepo. Use when users ask to add a new AI agent capability.
---

# AI Agent Bootstrap

## Use when
- A new AI agent must be added (assistant, worker, planner, or orchestrator).
- Existing agent logic needs a clean contract and lifecycle.

## Workflow
1. Define agent purpose and input/output contract.
2. Add config and environment requirements (safe defaults).
3. Implement service module with deterministic entrypoints.
4. Wire API/router trigger and status reporting.
5. Add failure handling, retry strategy, and logging.
6. Document setup, usage, and operational constraints.

## Required output
- Agent design summary.
- File-level implementation plan.
- Validation commands and runtime checks.
- Rollback or disable path.
