---
name: nextjs-ui-integrator
description: Implement frontend pages/components in Next.js App Router using shadcn/ui-first and centralized API access patterns. Use for UI feature work in this repository.
---

# Next.js UI Integrator

## Use when
- Adding or refactoring frontend routes/components.
- Connecting UI actions to backend APIs.

## Workflow
1. Reuse existing shared components/patterns first.
2. Keep API calls centralized in `frontend/src/lib/api.ts`.
3. Apply design tokens and consistent layout spacing.
4. Handle loading/empty/error states explicitly.
5. Verify type-safe builds and lint pass.
6. Capture screenshots for visible UI changes.

## Required output
- Route/component changes summary.
- Reused components and tokens.
- Build/lint results.
- Screenshot artifact references when applicable.
