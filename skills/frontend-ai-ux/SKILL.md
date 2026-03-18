---
name: frontend-ai-ux
description: Pedoman UX untuk fitur AI di frontend (loading states, streaming, retry, error clarity). Gunakan saat membangun atau memperbaiki interaksi AI pada UI.
---

# Frontend AI UX

## Tujuan
Membuat pengalaman pengguna tetap jelas walau AI bersifat probabilistik.

## Workflow
1. Tampilkan status proses yang eksplisit (idle/loading/success/failed).
2. Sediakan cancel/retry pada request panjang.
3. Tampilkan partial/streamed result jika memungkinkan.
4. Pisahkan pesan error teknis vs petunjuk tindakan user.
5. Simpan history interaksi penting.

## Checklist Minimum
- [ ] Tombol tidak double-submit saat loading.
- [ ] Error message memberi next action.
- [ ] Ada empty state dan skeleton/loading state.
- [ ] Ada indikator sumber model/provider (opsional tapi disarankan).

## Anti-Pattern
- UI freeze tanpa feedback.
- Menyembunyikan kegagalan request.
