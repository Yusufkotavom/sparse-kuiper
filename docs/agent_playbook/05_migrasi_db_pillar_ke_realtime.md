# 05 — Database Migration: Pillar/Batch to Real-time

## Objective
Move status consumption from periodic snapshots to event-driven incremental updates.

## Migration phases

### Phase A — Preparation
- identify source-of-truth state tables,
- define key events: `created`, `updated`, `failed`, `completed`.

### Phase B — Outbox Event Table
Create a dedicated event table (example: `realtime_events`) with:
- `id` (monotonic key),
- `stream`,
- `event_type`,
- `entity_id`,
- `payload`,
- `created_at`.

Minimum indexes:
- `stream`,
- `entity_id`,
- `created_at`.

### Phase C — Dual Write
- keep updating primary tables,
- append events to outbox in the same workflow.

### Phase D — Consumer Rollout
- frontend/backend consumers read incrementally (`id > last_seen_id`),
- fallback to snapshot path if consumer fails.

### Phase E — Stabilization
- monitor latency, event loss, and duplicate handling,
- gradually reduce polling dependency.

## Done criteria
- stable real-time stream,
- snapshot path remains available as fallback,
- rollback procedure is tested.

## Rollback plan
- disable real-time consumer,
- return to snapshot endpoints,
- keep outbox for audit without disrupting legacy flow.
