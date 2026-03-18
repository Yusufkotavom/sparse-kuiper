# Implementation Task Bottleneck Audit (DB + Polling)

## Current bottlenecks observed
1. **In-memory job state risk**
   - If a process restarts, transient task state can be lost.
2. **Polling pressure**
   - Frequent polling against endpoints can increase DB/API load without backoff.
3. **Provider latency variance**
   - External AI providers (e.g., Replicate) have variable completion times.
4. **Weak task observability**
   - Without a persistent task table, it is hard to inspect historical failures and retry patterns.

## Implemented improvement
A persistent `generation_tasks` table is now used for image/video generation task tracking.

- API creates task rows with status `queued`.
- Background worker updates state to `running` and terminal states (`succeeded`, `failed`, `canceled`).
- Frontend/client can poll task status safely via DB-backed APIs.

## New APIs
- `POST /api/v1/generation/image`
- `POST /api/v1/generation/video`
- `GET /api/v1/generation/tasks/{task_id}`
- `GET /api/v1/generation/tasks`
- `POST /api/v1/generation/tasks/{task_id}/cancel`

## Replicate integration notes
- Required env: `REPLICATE_API_TOKEN`
- Optional defaults:
  - `REPLICATE_IMAGE_MODEL_VERSION`
  - `REPLICATE_VIDEO_MODEL_VERSION`
- You can override model version per request with `model_version`.

## Polling recommendations
- Client interval: start at 2s; backoff to 4–8s for long-running jobs.
- Stop polling at terminal status.
- Cap list query limit (`limit <= 200`) to avoid unnecessary load.
