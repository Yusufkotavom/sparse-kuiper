---
name: fastapi-feature-builder
description: Add or refactor FastAPI endpoints, schemas, dependencies, and service wiring with production-safe patterns (validation, errors, DB session usage). Use for API feature work.
---

# FastAPI Feature Builder

## Use when
- Creating new API endpoints.
- Refactoring routers/schemas/service orchestration.
- Updating API contracts with backward compatibility.

## Workflow
1. Define request/response schemas first.
2. Implement router handlers with dependency injection.
3. Keep business logic in services (not bloated routes).
4. Ensure DB session handling follows project pattern.
5. Add error mapping and response consistency.
6. Validate endpoint behavior and docs exposure.

## Required output
- Endpoint contract summary.
- Router/service/schema file changes.
- Compatibility and migration notes (if any).
- Smoke commands executed.
