# Nomad Hub — Implementation Plan

> **Codebase baseline** (hasil audit):
> - ✅ Next.js App Router
> - ✅ Geist Font sudah di-load di [layout.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/layout.tsx)
> - ✅ Sidebar dengan collapse/expand logic (`SidebarContext`)
> - ✅ ThemeContext (dark/light)
> - ✅ shadcn/ui: `button`, `card`, `dialog`, `input`, `label`, `textarea`
> - ✅ Lucide React icons
> - ⚠️ Sidebar nav items masih flat/scattered (Project Manager, Queue Manager, Publisher terpisah)
> - ⚠️ Belum ada: TopBar breadcrumb, Bottom Tab Bar mobile, DataTable, CommandPalette
> - ⚠️ Belum ada: Queue reorder, SSE events, batch upload backend

---

## 📋 Ringkasan Fase

| # | Fase | Fokus | Deliverable Utama |
|---|---|---|---|
| 1 | **Foundation** | Design tokens + CSS | [globals.css](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/globals.css) overhaul, CSS vars |
| 2 | **Shell & Navigation** | Layout, TopBar, Mobile nav | `AppShell`, `TopBar`, `BottomTabBar`, Sidebar regroup |
| 3 | **Atoms & Molecules** | Komponen reusable | `StatusBadge`, `PageHeader`, `ProjectCard`, `AccountCard` |
| 4 | **Feature Screens** | Lifecycle Board, Queue | `LifecycleBoard`, `QueueTable`, `PublishedHistory` |
| 5 | **Drawers & Overlays** | Inline editing, power features | `MetadataDrawer`, `CommandPalette`, `WorkerWidget` |
| 6 | **Backend & Polish** | API baru, SSE, PWA | Schema migration, endpoints, PWA manifest |

---

## Phase 1 — Foundation: Design System Overhaul

**Tujuan**: Menetapkan palet warna, spacing, dan CSS variables sebagai "single source of truth" sebelum menyentuh komponen apapun.

**Prinsip**: Zinc Dark (seperti Vercel). Satu accent color. No shadow, pakai border.

### 1.1 Update [globals.css](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/globals.css)

**File**: [frontend/src/app/globals.css](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/globals.css)

```css
/* Ganti semua CSS variables dengan zinc dark palette */
:root {
  /* Backgrounds */
  --background: 0 0% 4%;          /* #0a0a0a */
  --surface: 0 0% 8%;             /* #141414 */
  --elevated: 0 0% 11%;           /* #1c1c1c */

  /* Borders */
  --border: 0 0% 16%;             /* #292929 */
  --border-hover: 0 0% 24%;       /* #3d3d3d */

  /* Text */
  --foreground: 0 0% 93%;         /* #ededed */
  --muted-foreground: 0 0% 42%;   /* #6b6b6b */

  /* Accent (single color = biru) */
  --primary: 212 100% 60%;        /* #3b82f6 */
  --primary-foreground: 0 0% 100%;

  /* State colors */
  --success: 142 60% 45%;         /* #22c55e */
  --warning: 38 95% 55%;          /* #f59e0b */
  --error: 0 70% 55%;             /* #ef4444 */

  /* Layout dimensions */
  --topbar-h: 48px;
  --sidebar-w: 220px;
  --sidebar-collapsed-w: 60px;
  --bottomnav-h: 64px;
}
```

### 1.2 Update `tailwind.config`

**File**: `frontend/tailwind.config.ts`

Tambahkan extend untuk custom height/width dari CSS vars di atas.

### ✅ Acceptance Criteria Phase 1
- [ ] Dark background `#0a0a0a` tampil di semua halaman
- [ ] Satu warna accent (biru) konsisten di button primary
- [ ] Card tidak memiliki box-shadow, hanya border tipis
- [ ] Font Geist aktif (verifikasi sudah ada)

---

## Phase 2 — Shell & Navigation

**Tujuan**: Restructure layout utama. Sidebar nav dikelompokkan. TopBar baru. Mobile bottom nav.

### 2.1 Reorganize Sidebar Nav Items

**File**: [frontend/src/components/Sidebar.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/components/Sidebar.tsx)

```typescript
// SEBELUM (flat, 10 items scattered)
// SESUDAH (4 group dengan separator label):

const NAV_GROUPS = [
  {
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    ]
  },
  {
    label: "Create",
    items: [
      { label: "Studio", icon: Clapperboard, href: "/studio",
        children: [
          { label: "Video", icon: Film, href: "/video" },
          { label: "KDP / Books", icon: BookOpen, href: "/kdp" },
          { label: "Audio (TTS)", icon: Volume2, href: "/audio" },
        ]
      },
      { label: "Scraper", icon: Globe, href: "/scraper" },
    ]
  },
  {
    label: "Publish",
    items: [
      { label: "Queue", icon: ListOrdered, href: "/queue-manager" },
      { label: "Publisher", icon: Share2, href: "/publisher" },
      { label: "Published", icon: CheckCircle, href: "/published" },
      { label: "Accounts", icon: Users, href: "/accounts" },
    ]
  },
  {
    label: "System",
    items: [
      { label: "Settings", icon: Settings, href: "/settings" },
      { label: "Logs", icon: Terminal, href: "/logs" },
    ]
  }
]
// Project Manager (Standalone) dihilangkan — fungsinya DIKONSOLIDASI ke:
// 1. Dashboard (Lifecycle Board) untuk High-level management
// 2. MetadataDrawer (Project Context) untuk Asset management & Settings
```

### 2.2 Buat `TopBar.tsx`

**File baru**: `frontend/src/components/layout/TopBar.tsx`

```typescript
interface TopBarProps {
  title?: string
  actions?: React.ReactNode  // tombol kontekstual per halaman
}

// Layout:
// [≡ toggle]  [breadcrumb auto dari usePathname()]   [...actions]  [🔍]  [avatar "NH"]
// Height: var(--topbar-h) = 48px
// Border bottom: 1px solid var(--border)
```

### 2.3 Update [MainWrapper.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/components/MainWrapper.tsx)

Tambahkan padding offset untuk TopBar dan BottomTabBar:

```tsx
// padding-top: var(--topbar-h)         → 48px
// padding-left: var(--sidebar-collapsed-w)  → 60px (desktop)
// padding-bottom: var(--bottomnav-h)   → 64px (MOBILE ONLY)
```

### 2.4 Buat `BottomTabBar.tsx`

**File baru**: `frontend/src/components/layout/BottomTabBar.tsx`

```typescript
// Visible HANYA di mobile (md:hidden)
// 5 tab fix: Dashboard | Studio | Queue | Scraper | Settings
// Active: icon + label muncul, inactive: icon only
// Fixed bottom, full width, border-top tipis
```

### 2.5 Update [layout.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/layout.tsx)

```tsx
<Providers>
  <Sidebar />
  <TopBar />        {/* ← baru */}
  <MainWrapper>
    {children}
  </MainWrapper>
  <BottomTabBar />  {/* ← baru */}
</Providers>
```

### ✅ Acceptance Criteria Phase 2
- [ ] Sidebar menampilkan 4 group dengan label separator tipis
- [ ] TopBar muncul di semua halaman dengan breadcrumb otomatis
- [ ] Mobile (≤768px): Sidebar hidden, Bottom Tab Bar muncul
- [ ] Desktop: Bottom Tab Bar tidak terlihat (md:hidden)
- [ ] MainWrapper tidak overlap dengan TopBar

---

## Phase 3 — Atoms & Molecules

**Tujuan**: Library komponen reusable. Buat sekali, dipakai di semua halaman.

### 3.1 `StatusBadge`

**File**: `frontend/src/components/atoms/StatusBadge.tsx`

```typescript
type Status = "active"|"pending"|"uploading"|"completed"|
              "failed"|"scheduled"|"needs_login"|"generating"|"queued"

// Visual: dot 6px + label text-xs
// "uploading": dot pulse animation (CSS only)
```

### 3.2 `PageHeader`

**File**: `frontend/src/components/atoms/PageHeader.tsx`

```typescript
interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  badge?: string  // "20 items"
}
// Dipakai di SETIAP halaman untuk standardisasi heading
```

### 3.3 `EmptyState`

**File**: `frontend/src/components/atoms/EmptyState.tsx`

```typescript
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}
```

### 3.4 `ProjectCard`

**File**: `frontend/src/components/molecules/ProjectCard.tsx`

```typescript
variant "grid": thumbnail + title + StatusBadge + 3 mini stats
variant "list": single compact row
// Dipakai di: Dashboard LifecycleBoard
```

### 3.5 `AccountCard` + Demo Accounts

**File**: `frontend/src/components/molecules/AccountCard.tsx`

```typescript
// variant "full": platform icon + name + followers + StatusBadge + actions
// isDemo → badge "DEMO" amber kanan atas
```

**File**: `frontend/src/lib/constants.ts`

```typescript
export const DEMO_ACCOUNTS = [
  { id:"demo_tiktok_01", name:"@nomad.tiktok", platform:"tiktok",
    status:"active", followers:12400, isDemo:true },
  { id:"demo_youtube_01", name:"Nomad YT", platform:"youtube",
    status:"active", followers:4380, isDemo:true },
  { id:"demo_instagram_01", name:"@nomad.ig", platform:"instagram",
    status:"needs_login", followers:8920, isDemo:true },
  { id:"demo_facebook_01", name:"Nomad Page", platform:"facebook",
    status:"active", followers:2150, isDemo:true },
]
// Toggle: NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true
```

### ✅ Acceptance Criteria Phase 3
- [x] `StatusBadge` dengan 9 status berbeda tampil konsisten
- [x] `PageHeader` digunakan di semua halaman (*sudah diawali di /accounts)
- [x] `AccountCard` tampil di `/accounts` sebagai grid 4 kolom
- [x] Demo accounts dengan badge DEMO amber terlihat

---

## Phase 4 — Feature Screens

**Tujuan**: Halaman-halaman utama di-revamp total dengan preservasi fungsi 100%.

### 4.1 Dashboard — Lifecycle Board (Project Hub)

**File**: [frontend/src/app/page.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/page.tsx)

**Preservasi Fungsi**:
- **CRUD**: Tombol [➕ Proyek Baru] ada di PageHeader Dashboard.
- **Search**: Global search di TopBar memfilter kartu di board.
- **Metrics**: Stats row di atas board menggantikan stats per-project (aggregate).

**Struktur**:
1. Stats row (4 card mini): Total | Generating | In Queue | Published This Month
2. LifecycleBoard.tsx — Kanban 6 kolom horizontal scroll
   Kolom: Ideating → Generating → Curating → In Queue → Published → Archived
   Per kolom: list ProjectCard variant "kanban"
   **Action**: Klik kartu → Buka `ProjectDrawer` (Metadata + Asset Browser)

### 4.2 Metadata & Asset Drawer (Project Context)

**File baru**: `frontend/src/components/organisms/ProjectDrawer.tsx`
*Gabungan dari MetadataDrawer dan Asset Browser lama*

**Fungsi Migrasi**:
- **Asset Browser**: Tree view untuk file images/video/audio (seperti di tab_projects.py).
- **Metadata Editor**: Edit Title, Desc, Tags.
- **Stats**: Scene count, size MB, duration per project.
- **Actions**: Rename, Duplicate, Delete, Download All Assets.
- **Open in Studio**: Tombol shortcut langsung ke /video atau /kdp dengan project ter-load.

**Install**:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 4.3 Queue Manager — Ordered + Reorderable ✅ (COMPLETED)

**File**: `frontend/src/app/publisher/page.tsx`

```
Struktur baru:
1. Publisher Page: Queue upload sidebar + detail form
2. Drag & Drop: Terintegrasi dengan dnd-kit
3. QueueTable/List:
   Kolom: ⠿ (drag) | Thumbnail | Asset name | Status | Actions
   Row height: Flex items dengan shadow/border states
   Select/Multi-select mode untuk auto-sync urutan batch upload
4. Single upload confirm trigger
5. Batch upload trigger (auto-schedule sequencing)
```

### 4.4 Published History — Halaman Baru

**File baru**: `frontend/src/app/published/page.tsx`

```
1. PageHeader "Published" + [Export CSV]
2. DataTable: Date | Asset | Platforms (emoji icons) | Result | [View Links] [Retry]
3. Upload Result Drawer: per-platform URL + copy button + Retry
```

### 4.5 Accounts — Grid View

**File**: [frontend/src/app/accounts/page.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/accounts/page.tsx)

```
Grid 4 kolom AccountCard
Demo accounts via NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS
Status dot: ● Active / ⚠ Needs Login
```

### ✅ Acceptance Criteria Phase 4
- [ ] Dashboard Lifecycle Board tampil dengan 6 kolom
- [ ] ProjectDrawer terbuka saat klik kartu di board
- [ ] Queue tabel menampilkan nomor urut #1-N
- [ ] Drag handle berfungsi untuk reorder
- [ ] Filter tidak menghapus item (badge "Showing X of Y")
- [ ] Halaman `/published` bisa diakses
- [ ] Accounts grid dengan AccountCard dan demo accounts

---

## Phase 5 — Drawers & Overlays

**Tujuan**: Zero page navigation untuk editing. Power user tools.

### 5.1 `MetadataDrawer`

**File**: `frontend/src/components/organisms/MetadataDrawer.tsx`

```
Dibuka dari: QueueTable, Publisher, Scraper Downloads
Konten:
- Video preview thumbnail
- Form: Title | Description | Tags (pills)
- [✨ Generate with AI] → /api/v1/publisher/generate-metadata
- Platform selector (compact AccountCard)
- Schedule date-time picker (inline popover)
- [Save] | [Save & Upload]
```

**Install**:
```bash
npm install vaul   # drawer dengan swipe-to-close support
```

### 5.2 `CommandPalette` (Ctrl+K)

**File**: `frontend/src/components/organisms/CommandPalette.tsx`

```bash
npm install cmdk
```

```
Commands default:
- Dashboard, Queue Manager, Publisher, Accounts, Settings
- "New Video Project", "Upload All Pending", "Check Bot Status"
Mount Ctrl+K listener di layout.tsx
```

### 5.3 `WorkerStatusWidget`

**File**: `frontend/src/components/organisms/WorkerStatusWidget.tsx`

```
Fixed: bottom-4 right-4
Collapsed: pill "2 tasks running" + spinner dot
Expanded: list dengan progress bar per task
Data: SSE EventSource ke /api/v1/events (Phase 6)
```

### ✅ Acceptance Criteria Phase 5
- [ ] MetadataDrawer terbuka dari queue row tanpa navigasi
- [ ] AI Generate mengisi form title/description/tags
- [ ] Ctrl+K CommandPalette terbuka di semua halaman
- [ ] WorkerWidget muncul saat upload aktif, hilang saat idle

---

## Phase 6 — Backend & Polish

**Tujuan**: API baru, SSE real-time, PWA.

### 6.1 Schema Migration

**File**: `backend/models.py`

```python
class UploadQueueItem(Base):
    # Tambah kolom:
    order_index  = Column(Integer, default=0, nullable=False)
    batch_id     = Column(String, nullable=True)
    skip_on_fail = Column(Boolean, default=True)
```

### 6.2 Endpoint Baru

**File**: [backend/routers/publisher.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/routers/publisher.py)

```python
PATCH /api/v1/publisher/queue/reorder
  # Bulk update order_index
  # Body: [{"id": "file.mp4", "order": 1}, ...]

GET /api/v1/publisher/queue
  # Query params: ?platform=tiktok&status=pending&sort=order

POST /api/v1/publisher/upload/batch
  # Body: {"items": ["f1.mp4"], "skip_on_fail": true}
  # Upload sequential, emit SSE per item
```

### 6.3 SSE Events

**File baru**: `backend/routers/events.py`

```python
GET /api/v1/events   # EventSource endpoint
# Emit: {"type":"upload_progress","jobId":"x","progress":68,"eta":45}
# Emit: {"type":"worker_status","count":2}
```

### 6.4 PWA Manifest

**File**: `frontend/public/manifest.json`

```json
{
  "name": "Nomad Hub",
  "short_name": "Nomad",
  "theme_color": "#0a0a0a",
  "background_color": "#0a0a0a",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192" },
    { "src": "/icon-512.png", "sizes": "512x512" }
  ]
}
```

### ✅ Acceptance Criteria Phase 6
- [ ] Queue order tersimpan ke DB dan persist setelah refresh
- [ ] Filter `?platform=tiktok` mengembalikan subset yang benar
- [ ] WorkerWidget update real-time via SSE
- [ ] Batch upload sequential, skip on fail
- [ ] "Add to Home Screen" berfungsi di mobile browser

---

## 📦 Dependency Summary

```bash
# Baru perlu di-install:
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities  # drag & drop
npm install vaul                                                   # mobile-friendly drawer
npm install cmdk                                                   # command palette
npm install qrcode.react                                           # QR connect (opsional)
npm install @tanstack/react-query                                  # data fetching + cache

# Sudah ada — jangan duplikasi:
# lucide-react ✅  tailwindcss ✅  shadcn/ui ✅  next ✅
```

---

## 🗓️ Estimasi Waktu

| Fase | Estimasi | Catatan |
|---|---|---|
| Phase 1 — Foundation | 2–3 jam | Murni CSS, impact langsung terasa |
| Phase 2 — Shell & Nav | 4–6 jam | Sidebar regroup sudah 70% ada |
| Phase 3 — Atoms | 4–5 jam | Komponen kecil, bisa paralel |
| Phase 4 — Screens | 8–12 jam | QueueTable + dnd-kit paling kompleks |
| Phase 5 — Drawers | 6–8 jam | MetadataDrawer + cmdk butuh waktu |
| Phase 6 — Backend | 6–8 jam | 3 endpoint + SSE + PWA |
| **Total** | **~30–42 jam** | ~1 minggu kerja fokus |

---

## 🔗 File Map Lengkap

### Di-EDIT:
| File | Perubahan |
|---|---|
| [frontend/src/app/globals.css](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/globals.css) | Zinc dark design tokens |
| [frontend/src/app/layout.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/layout.tsx) | Tambah TopBar, BottomTabBar |
| [frontend/src/app/page.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/page.tsx) | Ganti jadi Lifecycle Board |
| [frontend/src/app/accounts/page.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/accounts/page.tsx) | Grid AccountCard |
| [frontend/src/app/queue-manager/page.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/queue-manager/page.tsx) | Ordered QueueTable |
| [frontend/src/app/settings/page.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/settings/page.tsx) | Tambah QR code section |
| [frontend/src/components/Sidebar.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/components/Sidebar.tsx) | Regroup nav items |
| [frontend/src/components/MainWrapper.tsx](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/components/MainWrapper.tsx) | Update padding offset |
| `frontend/src/lib/constants.ts` | Tambah DEMO_ACCOUNTS |
| `backend/models.py` | Kolom order_index, batch_id |
| [backend/core/migrations.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/core/migrations.py) | Migration kolom baru |
| [backend/routers/publisher.py](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/backend/routers/publisher.py) | 3 endpoint baru |

### Di-CREATE:
```
frontend/src/components/
├── atoms/
│   ├── StatusBadge.tsx
│   ├── PageHeader.tsx
│   └── EmptyState.tsx
├── molecules/
│   ├── ProjectCard.tsx
│   └── AccountCard.tsx
├── organisms/
│   ├── LifecycleBoard.tsx
│   ├── QueueTable.tsx
│   ├── MetadataDrawer.tsx
│   ├── CommandPalette.tsx
│   └── WorkerStatusWidget.tsx
└── layout/
    ├── TopBar.tsx
    └── BottomTabBar.tsx

frontend/src/app/published/page.tsx
frontend/public/manifest.json

backend/routers/events.py
```

---

> **🚀 Start Sekarang**: Jalankan Phase 1 dulu — edit [globals.css](file:///c:/Users/admin/Desktop/New%20folder%20%284%29/sparse-kuiper/frontend/src/app/globals.css).
> Hasilnya langsung terlihat di semua halaman tanpa perlu buat komponen baru.
> Kalau sudah cocok dengan arah visual-nya, lanjut ke Phase 2.
