---
name: plan-checklist-monitor
description: Skill untuk menjalankan implementation plan berbasis todolist yang terukur, termasuk status in-progress/blocked/done dan monitoring harian.
---

# Plan Checklist Monitor

Gunakan skill ini ketika user meminta:
- implementation plan detail,
- todolist eksekusi yang jelas,
- monitoring progres pekerjaan yang sedang berjalan.

## Workflow

1. Definisikan milestone (mingguan/sprint).
2. Turunkan milestone menjadi task checklist.
3. Beri status setiap task:
   - `todo`
   - `in_progress`
   - `blocked`
   - `done`
4. Catat owner, target date, blocker, dan next action.
5. Review harian: update status + ringkasan progres.

## Template Task

- `id`:
- `title`:
- `priority`: P0/P1/P2
- `status`: todo/in_progress/blocked/done
- `owner`:
- `eta`:
- `blocker`:
- `next_action`:

## Guardrail

- Maksimal 1 task `in_progress` per owner pada satu waktu.
- Task `blocked` wajib punya `next_action`.
- Tiap akhir hari harus ada update monitoring.
- Task yang selesai harus menyertakan evidence (command/screenshot/link PR).

## Output Wajib

- **Implementation Plan**: milestone + exit criteria.
- **Todolist**: P0/P1/P2.
- **Monitoring Board**: ringkasan status (todo/in_progress/blocked/done).
- **Daily Notes**: blocker + keputusan + next step.
