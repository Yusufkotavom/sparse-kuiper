# AGENTS.md Improvement Spec

Audit date: 2026-06  
Auditor: Ona (AI agent)  
Files reviewed: `AGENTS.md`, `CLAUDE.md`, `skills/*/SKILL.md`, `frontend/skills/*/SKILL.md`, `docs/agent_skills.md`, `docs/architecture.md`, `docs/shadcn_first_ui.md`, `CHANGELOG.md`, `.kiro/specs/video-concat/`

---

## 1. What Is Good

| Area | Observation |
|---|---|
| **Structure** | AGENTS.md is well-organized into clear sections (Project Structure, Product Direction, Build Commands, Coding Style, Skill Usage, Testing, Commit/PR, Security). |
| **Product direction** | The `Assets → Queue Builder → Runs` flow and the hub routing model (`/ideation`, `/curation`) are clearly stated with concrete file paths. |
| **Skill routing** | Skill Usage Rules section maps task types to specific skill files. The "don't load all skills at once" instruction is good for context efficiency. |
| **Security** | Secrets-to-avoid list is explicit (config.json, youtube_secrets, *.db). The masking rule for token display is stated. |
| **Smoke check commands** | Both frontend (`npm run build`) and backend (`python -c "import backend.main"`) smoke checks are documented. |
| **Skill library** | 37 skills across `skills/` and `frontend/skills/` cover a wide range: FastAPI, Next.js, queue reliability, upload rollout, Telegram, security, migration, video processing, debugging, release gating, and more. |
| **Skill quality** | Each skill has a consistent frontmatter (`name`, `description`), a `## Use when` / `## Workflow` / `## Checklist` / `## Anti-Pattern` structure, and a `## Required output` section. |
| **docs/agent_skills.md** | Provides recommended skill combinations per task type — a useful orchestration guide that AGENTS.md does not currently reference. |

---

## 2. What Is Missing

### 2.1 AGENTS.md does not reference `docs/agent_skills.md`
The file `docs/agent_skills.md` contains skill combination recipes (e.g., "Add a new AI agent" → which skills to chain). AGENTS.md only lists individual skill paths; it never points agents to this orchestration guide.

### 2.2 No agent decision tree for common task types
AGENTS.md lists skills but gives no guidance on *when to pick which skill combination*. An agent starting a task must infer this from context. The combinations already exist in `docs/agent_skills.md` but are not surfaced in AGENTS.md.

### 2.3 No explicit "read before touching" file list per domain
When an agent touches the queue/publisher area, it should read `CHANGELOG.md`, `docs/queue_job_worker_recommendations.md`, and `docs/architecture.md`. This is mentioned for queue/job work but not generalized to other domains (video, KDP, scraper, settings).

### 2.4 No `.kiro/specs/` awareness
AGENTS.md does not mention `.kiro/specs/` at all. The `video-concat` spec there contains a full requirements doc, design doc, and task checklist. An agent implementing video concat would miss this entirely.

### 2.5 No `frontend/skills/` vs `skills/` distinction
AGENTS.md says "check `skills/*/SKILL.md` and/or `frontend/skills/*/SKILL.md`" but does not explain the difference. In practice, `frontend/skills/` is a subset mirror of `skills/` (same skill names, same content). This creates confusion about which to read.

### 2.6 No guidance on the `docs/` reference hierarchy
There are 18 files in `docs/`. AGENTS.md only mentions three (`CHANGELOG.md`, `docs/queue_job_worker_recommendations.md`, `docs/architecture.md`). High-value files like `docs/shadcn_first_ui.md`, `docs/progress_loading_standard.md`, `docs/ui_code_separation_audit_2026_03.md`, and `docs/implementation_plan.md` are not surfaced.

### 2.7 No "do not touch" or "deprecated path" list
AGENTS.md mentions `/publisher` is a compatibility redirect but does not list other deprecated or frozen paths/files that agents should not modify (e.g., legacy `config.json` structure, old queue-manager routes).

### 2.8 No environment/OS context for tool invocation
The file starts with `dikerjakan di windows os` (one line, no heading). This is critical context — Windows path separators, `.bat` scripts, no `&&` chaining in cmd.exe — but it is buried as an unlabeled first line with no actionable guidance.

### 2.9 No agent self-check / policy gate reference
The `skills/agent-policy-checker/SKILL.md` and `skills/release-guardian/SKILL.md` exist but AGENTS.md never instructs agents to run a policy check before committing. The `skills/README.md` has a PR checklist but it is not linked from AGENTS.md.

### 2.10 No description of the `internal_tools/` directory
`internal_tools/` appears in the repo root but is not mentioned anywhere in AGENTS.md or CLAUDE.md.

---

## 3. What Is Wrong

### 3.1 AGENTS.md structure map is stale
The monorepo structure in AGENTS.md lists routes like `queue-manager/` and `publisher/` as primary pages. Per CHANGELOG.md, these are now legacy redirects. The current primary routes (`/queue-builder`, `/ideation`, `/curation`, `/runs`) are only mentioned in the Product Direction section, not in the structure map.

### 3.2 CLAUDE.md and AGENTS.md are near-duplicates with drift
`CLAUDE.md` and `AGENTS.md` contain almost identical content (project overview, structure, conventions, commands). They have drifted: CLAUDE.md still lists `queue-manager/` as a primary route and does not mention `/ideation`, `/curation`, or `FlowHubShell`. An agent reading only CLAUDE.md gets an outdated picture. There is no single source of truth.

### 3.3 `frontend/skills/` is a partial mirror with no explanation
`frontend/skills/` contains 24 skills; `skills/` contains 37. The 13 skills only in `skills/` (e.g., `repo-auditor`, `agent-policy-checker`, `ai-agent-bootstrap`, `release-guardian`, `realtime-rollout-planner`, `social-media-platform-expansion`, `ffmpeg-pipeline-builder`, `video-processing-engineer`, `python-feature-coder`, `test-and-debug-runner`, `nextjs-modular-component`, `ai-observability-evaluation`, `mcp-tool-usage`) are not in `frontend/skills/`. There is no documented reason for the split.

### 3.4 `skills/README.md` PR checklist is disconnected
`skills/README.md` has a mandatory PR checklist (UI Planning Review, API contract, regression test, observability, E2E, staged rollout). This checklist is not referenced from AGENTS.md, so agents will never see it unless they happen to read the README.

### 3.5 Windows OS note is not actionable
`dikerjakan di windows os` at line 1 of AGENTS.md is a note, not a rule. It does not tell agents what to do differently (e.g., use `run_local.bat` instead of shell scripts, avoid Unix-only commands, use `\` path separators in bat files).

### 3.6 Testing section understates the gap
"No unit-test runner is configured yet" is accurate but gives no guidance on what to do when a change is risky and smoke checks are insufficient. There is no mention of the `playwright-e2e-ui-validation` skill or when to use it.

---

## 4. Improvement Spec

Each item below is a concrete, actionable change to AGENTS.md (and where noted, to supporting files).

---

### SPEC-01 — Fix the structure map to reflect current routes

**File:** `AGENTS.md` → `## Project Structure & Module Organization`

**Change:** Replace the route list under `frontend/src/app/` with the current primary routes. Mark legacy routes explicitly.

```
frontend/src/app/
  ideation/         # Ideation Hub (primary entry for video + image creation)
  curation/         # Curation Hub (primary entry for review + selection)
  queue-builder/    # Queue Builder (primary publishing flow)
  runs/             # Runs (operational job monitor)
  video/            # Video workspace (branched from Ideation Hub)
  kdp/              # KDP workspace (branched from Ideation Hub)
  accounts/         # Social media account management
  settings/         # App settings & integrations
  scraper/          # Scraper projects
  looper/           # Looper async jobs
  logs/             # Observability logs
  publisher/        # LEGACY — redirects to /queue-builder
  queue-manager/    # LEGACY — redirects to /queue-builder
  queue/            # LEGACY — redirects to /queue-builder
  jobs/             # LEGACY — redirects to /queue-builder
```

---

### SPEC-02 — Add a Windows OS section with actionable rules

**File:** `AGENTS.md` → new `## Runtime Environment` section (replace the bare first line)

**Content to add:**

```markdown
## Runtime Environment

- OS: Windows. Use `.bat` scripts for local setup/run.
- Use `run_local.bat` to start backend + frontend in separate terminals.
- Use `setup_local.bat` for first-time dependency setup.
- Avoid Unix-only shell syntax (e.g., `&&` chains in cmd.exe, `export VAR=`).
- Path separators in bat/PowerShell scripts: use `\`. In Python and Node config: `/` is safe.
- PowerShell scripts (e.g., `kill_api.ps1`) are available for process management.
```

---

### SPEC-03 — Add a "Docs Reference Map" section

**File:** `AGENTS.md` → new `## Key Docs Reference` section

Map task types to the docs file an agent should read first:

```markdown
## Key Docs Reference

Read the relevant doc before starting work in that area:

| Area | Read first |
|---|---|
| Architecture overview | `docs/architecture.md` |
| Queue / job / publisher work | `docs/queue_job_worker_recommendations.md`, `CHANGELOG.md` |
| UI component conventions | `docs/shadcn_first_ui.md` |
| Progress / loading patterns | `docs/progress_loading_standard.md` |
| UI domain separation | `docs/ui_code_separation_audit_2026_03.md` |
| DB migration | `docs/architecture.md` (Catatan Arsitektur Terkini section) |
| Deployment | `docs/deployment.md` |
| API reference | `docs/api_reference.md` |
| Skill combinations | `docs/agent_skills.md` |
```

---

### SPEC-04 — Reference `docs/agent_skills.md` for skill combinations

**File:** `AGENTS.md` → `## Skill Usage Rules`

**Add after the existing skill routing list:**

```markdown
For recommended skill combinations per task type (e.g., "add a new AI agent", 
"add video processing", "frontend-connected feature"), read:
  `docs/agent_skills.md`
```

---

### SPEC-05 — Add `.kiro/specs/` awareness

**File:** `AGENTS.md` → `## Project Structure & Module Organization`

**Add:**

```markdown
- `.kiro/specs/` contains feature specs (requirements, design, task checklists) for 
  planned or in-progress features. Before implementing a feature that may have a spec, 
  check this directory first (e.g., `.kiro/specs/video-concat/`).
```

---

### SPEC-06 — Add a pre-commit policy gate instruction

**File:** `AGENTS.md` → `## Commit & Pull Request Guidelines`

**Add:**

```markdown
Before committing non-trivial changes:
1. Run the applicable smoke checks (see Build, Test, and Development Commands).
2. Verify changes comply with AGENTS.md conventions using `skills/agent-policy-checker/SKILL.md`.
3. For PR finalization, run the full quality gate in `skills/release-guardian/SKILL.md`.
4. All PRs must satisfy the checklist in `skills/README.md` before merge.
```

---

### SPEC-07 — Clarify `frontend/skills/` vs `skills/` split

**File:** `AGENTS.md` → `## Skill Usage Rules`

**Replace the current vague reference with:**

```markdown
Skills live in two locations:
- `skills/*/SKILL.md` — full skill library (37 skills, all domains).
- `frontend/skills/*/SKILL.md` — frontend-focused subset mirror (24 skills).

When working on frontend tasks, either location works for overlapping skills.
For backend, video processing, migration, release, or agent-bootstrap tasks, 
use `skills/` — those skills are not mirrored in `frontend/skills/`.
```

---

### SPEC-08 — Add a "Deprecated / Frozen Paths" section

**File:** `AGENTS.md` → new `## Deprecated & Frozen Paths` section

```markdown
## Deprecated & Frozen Paths

Do not add new logic to these paths. They exist for backward compatibility only.

| Path / File | Status | Replacement |
|---|---|---|
| `frontend/src/app/publisher/` | Legacy redirect | `/queue-builder` |
| `frontend/src/app/queue-manager/` | Legacy redirect | `/queue-builder` |
| `frontend/src/app/queue/` | Legacy redirect | `/queue-builder` |
| `frontend/src/app/jobs/` | Legacy redirect | `/queue-builder` |
| `config.json` (direct edits) | Legacy config | Settings API (`/api/v1/settings`) |
| `backend/routers/publisher.py` (new endpoints) | Compatibility layer | `backend/routers/queue_builder.py` or equivalent |
```

---

### SPEC-09 — Expand the Testing section with E2E guidance

**File:** `AGENTS.md` → `## Testing Guidelines`

**Add:**

```markdown
For UI changes with non-trivial interaction flows, use `skills/playwright-e2e-ui-validation/SKILL.md` 
to plan and run E2E checks. This is required for changes to Queue Builder, Ideation Hub, 
Curation Hub, and account/upload flows.

When smoke checks are insufficient (e.g., risky refactor, new background worker), 
use `skills/test-and-debug-runner/SKILL.md` for a structured validation loop.
```

---

### SPEC-10 — Consolidate or deprecate CLAUDE.md

**File:** `CLAUDE.md`

**Problem:** CLAUDE.md is a near-duplicate of AGENTS.md but is stale (lists old routes, missing new hubs). Maintaining two files creates drift.

**Options (choose one):**

- **Option A (preferred):** Reduce CLAUDE.md to a one-paragraph summary + pointer to AGENTS.md. Remove the duplicated structure/convention content.
- **Option B:** Delete CLAUDE.md and add a note in AGENTS.md that it supersedes CLAUDE.md.
- **Option C:** Keep both but add a header to CLAUDE.md: `> This file is superseded by AGENTS.md. Read AGENTS.md for current conventions.`

Option C is the lowest-risk immediate fix. Option A is the correct long-term state.

---

### SPEC-11 — Document `internal_tools/`

**File:** `AGENTS.md` → `## Project Structure & Module Organization`

**Add:**

```markdown
- `internal_tools/` — internal utility scripts and helpers not part of the main 
  application. Check contents before reimplementing similar utilities.
```

---

## 5. Priority Order

| Priority | Spec | Effort | Impact |
|---|---|---|---|
| P0 | SPEC-01 (fix stale route map) | Low | High — agents navigate to wrong files |
| P0 | SPEC-02 (Windows OS rules) | Low | High — prevents broken commands on Windows |
| P0 | SPEC-10 (consolidate CLAUDE.md) | Low | High — eliminates conflicting source of truth |
| P1 | SPEC-03 (docs reference map) | Low | High — agents find relevant docs faster |
| P1 | SPEC-04 (reference agent_skills.md) | Trivial | Medium — surfaces existing orchestration guide |
| P1 | SPEC-05 (.kiro/specs awareness) | Trivial | Medium — prevents duplicate spec work |
| P1 | SPEC-06 (pre-commit policy gate) | Low | Medium — enforces existing skills/README.md checklist |
| P2 | SPEC-07 (skills/ split clarification) | Low | Medium — reduces confusion on skill location |
| P2 | SPEC-08 (deprecated paths section) | Low | Medium — prevents agents adding logic to dead routes |
| P2 | SPEC-09 (E2E testing guidance) | Low | Medium — surfaces playwright skill for UI work |
| P2 | SPEC-11 (internal_tools doc) | Trivial | Low — completeness |
