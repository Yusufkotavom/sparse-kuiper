# Agent Playbook (Step-by-Step)

This playbook breaks the request into 5 separate documents so execution is clear and incremental:

1. [01_peninjauan_kode.md](./01_peninjauan_kode.md)
2. [02_skill_rekomendasi.md](./02_skill_rekomendasi.md)
3. [03_workflow_wajib.md](./03_workflow_wajib.md)
4. [04_instruksi_ai_agent.md](./04_instruksi_ai_agent.md)
5. [05_migrasi_db_pillar_ke_realtime.md](./05_migrasi_db_pillar_ke_realtime.md)

Recommended execution order:
- Run 01 → 02 → 03 → 04 first.
- Run 05 after workflow and guardrails are established.
