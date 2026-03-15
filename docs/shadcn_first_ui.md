# Shadcn-First UI Guidelines

Dokumen ini jadi acuan utama untuk menjaga konsistensi UI frontend.

## Prinsip Utama

- Shadcn-first: selalu pakai komponen dari `frontend/src/components/ui/*` terlebih dulu.
- Reuse-first: cek komponen reusable di `frontend/src/components/atoms/*` dan `frontend/src/components/organisms/*` sebelum membuat komponen baru.
- Token-first: gunakan token di `frontend/src/app/globals.css` (`--background`, `--surface`, `--elevated`, `--border`, `--primary`, `--muted-foreground`, `--section-px/py`, `--card-p`, `--gap-base`).
- Hindari style inline dan hardcode warna berbasis `zinc-*` jika ada padanan token.

## Komponen Reusable yang Wajib Diprioritaskan

- `PageHeader`: header halaman + actions + badge.
- `EmptyState`: state kosong konsisten.
- `StatusBadge`: status chip konsisten.
- `ViewToggle`: list/grid view toggle.
- `SegmentedTabs`: tab/filter segmented berbasis `Button`.
- `KpiCard`: kartu statistik ringkas.
- `ProjectDrawer`: detail asset/project action panel.

## Mapping Pola ke Komponen Shadcn

- Action toolbar: `Button`, `Input`, `Label`, `Separator`, `Tooltip`.
- Filter/tab: `SegmentedTabs` atau `Tabs`.
- Summary stats: `KpiCard` + `Card`.
- Confirm action (delete/archive): `AlertDialog`.
- Row action menu: `DropdownMenu`.
- Expand/collapse detail: `Collapsible` atau `Accordion`.
- Loading state: `Skeleton`.
- Form metadata: `Field`, `Input`, `Textarea`, `Label`.

## Aturan Saat Menambah Halaman Baru

- Wajib mulai dari `PageHeader` + container spacing token.
- Semua tombol wajib `Button`, bukan `<button>` mentah kecuali kebutuhan khusus.
- Semua input wajib `Input`/`Textarea` + `Label`.
- Semua kartu wajib `Card` atau turunan reusable card.
- Semua state kosong wajib `EmptyState`.

## Checklist PR UI

- Komponen baru reusable dan tidak duplikatif.
- Import mengikuti `@/components/ui/*` atau `@/components/atoms/*`.
- Tidak ada hardcode warna yang melanggar token.
- Lolos `npm run lint` dan `npm run build`.
