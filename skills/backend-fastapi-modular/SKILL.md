---
name: backend-fastapi-modular
description: Pola arsitektur FastAPI modular untuk endpoint baru (router, service, schema, dependency) tanpa mengacaukan kode inti.
---

# Backend FastAPI Modular

## Workflow
1. Pisahkan `router`, `service`, dan `schema` per domain fitur.
2. Hindari business logic tebal di router.
3. Gunakan dependency injection untuk config/client eksternal.
4. Standarkan response dan error model.

## Checklist Minimum
- [ ] Endpoint baru berada di module domain yang tepat.
- [ ] Logic reusable ditempatkan di service.
- [ ] Validasi payload ada di schema.
- [ ] Unit/integration test tersedia untuk route baru.
