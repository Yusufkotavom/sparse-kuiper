---
name: realtime-rollout-planner
description: Rancang rollout fitur real-time secara bertahap dari sistem snapshot/polling ke event-driven dengan fallback aman. Gunakan saat perencanaan migrasi real-time end-to-end.
---

# Realtime Rollout Planner

## Kapan dipakai
- User meminta migrasi batch/pillar ke real-time.
- Ada kebutuhan menurunkan polling dan latency update.

## Workflow
1. Definisikan event model dan sumber perubahan state.
2. Rancang outbox/event store + index query.
3. Tentukan strategi dual-write bertahap.
4. Tentukan consumer strategy (last_seen_id/cursor).
5. Tetapkan fallback ke snapshot path.
6. Definisikan observability (latency, drop, duplicate).

## Format output wajib
- **Arsitektur target** (producer, event store, consumer).
- **Rencana rollout fase A-E**.
- **Rollback/fallback**.
- **SLO metrik real-time** yang harus dipantau.
