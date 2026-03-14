# Nomad Hub — UI Revamp Extended: Project Management, Modular Design & Cross-Platform

> **Lanjutan dari** `ui_revamp_ideas.md`. Dokumen ini fokus pada lima pilar besar:  
> 1. **Efektivitas Manajemen Project**  
> 2. **Komponen Modular & Reusable**  
> 3. **Distribusi Mobile-First + Desktop** (TopBar, Bottom Nav, Responsive)  
> 4. **Upload Queue System** — Ordered, Reorderable, Batch/Single  
> 5. **Published View** — Statistik & History post-upload

---

## 📑 Daftar Isi
1. [Efektivitas Manajemen Project](#1)
2. [Komponen Modular & Reusable](#2)
3. [Distribusi Mobile + Desktop](#3)
   - [TopBar Design](#topbar)
   - [Mobile Bottom Navigation](#mobile-nav)
   - [Hardcoded Demo Accounts](#demo-accounts)
4. [Upload Queue System (Ordered)](#4)
5. [Published View](#5)
6. [Design System Tokens](#6)
7. [Struktur Folder](#7)
8. [Urutan Implementasi](#8)

---

## 🗂️ 1. Efektivitas Manajemen Project

### 1.1 Project sebagai "Hub" Terpusat

Masalah saat ini: project Video, KDP, dan Scraper hidup di "pulau-pulau" yang terpisah. User harus berpindah-pindah halaman untuk tahu status keseluruhan.

**Solusi: Universal Project Entity**

```
ProjectRecord {
  id: uuid
  name: string
  type: "video" | "kdp" | "scraper" | "mixed"
  status: "ideating" | "generating" | "curating" | "queued" | "published" | "archived"
  createdAt: ISO string
  tags: string[]            // untuk filter/search
  coverImage: string        // thumbnail project
  stats: {
    totalAssets: number
    curated: number
    queued: number
    published: number
  }
}
```

Semua project—baik video, KDP, maupun scraper—diwakili oleh satu entitas yang sama. UI kemudian merender tampilan yang sesuai berdasarkan `type`.

---

### 1.2 The Project Lifecycle Board (Kanban Horizontal)

Gantikan tampilan list biasa dengan **Lifecycle Board** horizontal yang menggambarkan alur kerja nyata:

```
[ Ideation ] → [ Generating ] → [ Curating ] → [ In Queue ] → [ Published ] → [ Archived ]
     │                │                │               │              │
  Project Card    Loading Card     Media Grid     Queue Card     Stats Card
```

**Interaction Model:**
- **Drag & Drop** kartu project antar kolom  
- Drop ke kolom `In Queue` → otomatis memunculkan dialog "Konfirmasi Tambah ke Queue" dengan pilihan platform  
- Drop ke kolom `Archived` → trigger soft-delete API  
- Klik project card → slide-out Project Inspector (detail + actions)

---

### 1.3 Project Inspector Panel (Slide-out Right Drawer)

Ketika user klik sebuah project card, drawer ini muncul dari kanan dengan tab-tab:

| Tab | Konten |
|-----|--------|
| **Overview** | Nama, tipe, status badge, cover, progress bar (assets/curated/queued) |
| **Assets** | Grid thumbnail semua file (raw + final) dengan status per-file |
| **Queue** | List file yang sudah di-queue + status upload per platform |
| **AI Prompts** | Semua prompt yang digunakan untuk generate project ini |
| **History** | Timeline: "Generated 12 videos", "Curated 8", "Uploaded 3 ke TikTok" |
| **Settings** | Edit nama, tag, tipe, cover |

> ✅ **Benefit**: User tidak perlu pindah halaman sama sekali. Semua konteks project ada dalam satu drawer.

---

### 1.4 Smart Filters & Project Search

Bar pencarian di atas Lifecycle Board dengan filter chipset:

```
🔍 [Search projects...]  [Type ▼]  [Status ▼]  [Platform ▼]  [Date Range ▼]  [Sort ▼]
```

Filter chipset yang aktif muncul sebagai pill yang bisa di-X:

```
✕ type:video   ✕ status:curating   ✕ tag:shorts
```

Implementasi: **TanStack Table** untuk sorting/filtering di backend dengan debounced search.

---

### 1.5 Bulk Actions & Multi-Select

- Checkbox muncul di setiap project card saat hover  
- Floating action bar muncul di bawah layar saat ada yang dipilih:

```
┌─────────────────────────────────────────────────────────┐
│  ✓ 3 projects selected   [Add to Queue] [Archive] [Tag] │
└─────────────────────────────────────────────────────────┘
```

---

### 1.6 Dashboard Widget: Project Health

Tambahkan di Dashboard `/` sebuah widget "Project Health" yang menampilkan KPI penting:

```
┌──────────────┬───────────────┬──────────────┬─────────────────┐
│  12 Projects │  3 Generating │  7 In Queue  │  48 Published   │
│   Total      │   (Active)    │  (Waiting)   │   This Month    │
└──────────────┴───────────────┴──────────────┴─────────────────┘
```

Klik card → langsung filter ke Lifecycle Board dengan status yang relevan.

---

## 🧩 2. Komponen Modular & Reusable

Ini adalah komponen-komponen yang dibuat **sekali** dan **dipakai di seluruh aplikasi**. Setiap komponen harus punya contract props yang jelas dan tidak bergantung pada state global.

### 2.1 `<ProjectCard />` — The Core Building Block

```tsx
// Digunakan di: Dashboard, Lifecycle Board, Publisher, Queue Manager
interface ProjectCardProps {
  project: ProjectRecord;
  variant: "kanban" | "grid" | "list" | "compact";
  onSelect?: (id: string) => void;
  onDrop?: (id: string, newStatus: ProjectStatus) => void;
  selected?: boolean;
  showCheckbox?: boolean;
}
```

**Variant breakdown:**
- `kanban` → Card vertikal dengan thumbnail besar, status badge, progress bar
- `grid` → Thumbnail-first card (seperti Netflix) untuk library view
- `list` → Row horizontal dengan info dense (nama, status, date, actions)
- `compact` → Pill kecil untuk referensi di sidebar atau drawers

---

### 2.2 `<StatusBadge />` — Satu Komponen untuk Semua Status

```tsx
// Digunakan di: ProjectCard, AssetItem, QueueRow, AccountCard
interface StatusBadgeProps {
  status: string;          // "pending" | "uploading" | "completed" | "failed" | "active" | ...
  pulse?: boolean;         // animasi pulse untuk status aktif
  size?: "sm" | "md" | "lg";
}

// Contoh penggunaan:
<StatusBadge status="uploading" pulse />    // 🔄 Animasi berputar
<StatusBadge status="completed" />          // ✅ Hijau
<StatusBadge status="failed" />             // ❌ Merah
<StatusBadge status="queued" />             // ⏳ Kuning
```

---

### 2.3 `<AssetGrid />` — Grid Media Universal

```tsx
// Digunakan di: Studio, KDP, Scraper Downloads, Publisher
interface AssetGridProps {
  assets: Asset[];
  selectable?: boolean;
  onSelect?: (ids: string[]) => void;
  onAction?: (action: "curate" | "archive" | "queue" | "preview", id: string) => void;
  filterPanel?: React.ReactNode;
  emptyState?: React.ReactNode;
}
```

Fitur built-in:
- `selectable` → checkbox multi-select per item
- Hover overlay dengan quick actions (Curate / Queue / Archive / Preview)
- Lazy loading dengan skeleton placeholder
- Virtualisasi untuk ribuan file (menggunakan `react-virtual`)

---

### 2.4 `<MetadataDrawer />` — Edit Metadata Terpusat

```tsx
// Digunakan di: Publisher, Scraper Downloads, Queue Manager
interface MetadataDrawerProps {
  asset: QueueItem | DownloadedFile;
  open: boolean;
  onClose: () => void;
  onSave: (metadata: AssetMetadata) => Promise<void>;
  onGenerateAI?: () => Promise<AssetMetadata>;
}
```

Konten drawer:
- Preview video thumbnail (hover → autoplay)
- Form: Title (rich-text), Description, Tags (tag input pill)
- Tombol "✨ Generate with AI" → trigger Groq API
- Platform-specific fields: Schedule picker (per platform)
- Tombol "Save & Add to Queue"

> ✅ Satu drawer ini menggantikan halaman edit metadata terpisah yang saat ini ada di Scraper/Downloads

---

### 2.5 `<PlatformSelector />` — Pilih Platform Upload

```tsx
// Digunakan di: MetadataDrawer, Publisher, QueueManager
interface PlatformSelectorProps {
  connectedAccounts: Account[];
  selected: string[];         // account IDs
  onChange: (ids: string[]) => void;
  showSchedule?: boolean;     // tambahkan date picker per platform
}
```

Tampilan: Grid icon platform (TikTok, YouTube, Instagram, Facebook) dengan label nama akun. Aktif = border highlight + checkmark.

---

### 2.6 `<WorkerStatusWidget />` — Real-time Background Jobs

```tsx
// Digunakan di: Layout global (pojok kanan bawah, persistent)
interface WorkerStatusWidgetProps {
  collapsed?: boolean;
  onToggle?: () => void;
}
```

Widget mini di pojok kanan bawah yang selalu terlihat:

```
┌─────────────────────────────────────────┐
│ ⚙ 2 Tasks Running              ▲ expand │
├─────────────────────────────────────────┤
│ 📤 Uploading "video_001.mp4"  [====70%] │
│ 🤖 Generating Project Alpha   [==30%]   │
└─────────────────────────────────────────┘
```

Data stream dari: **SSE (Server-Sent Events)** endpoint `/api/v1/events`. Backend emit progress updates, frontend subscribe via `EventSource`.

---

### 2.7 `<CommandPalette />` — Power User Tool (Ctrl+K)

```tsx
// Global overlay, mount di root Layout
// Gunakan: cmdk library
```

Command yang tersedia:
- `> new project video` → buat project video baru
- `> open [project name]` → langsung buka Project Inspector
- `> queue all curated` → batch queue semua aset final
- `> check bot status` → tampilkan status Playwright workers
- `> go to publisher` → navigasi langsung
- `> settings` → buka Settings

---

### 2.8 `<DataTable />` — Wrapper TanStack Table

```tsx
// Digunakan di: Queue Manager, Scraper list, Accounts list
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;      // search + filter bereaksi di atas tabel
  pagination?: boolean;
  selectable?: boolean;
}
```

Fitur default yang sudah built-in:
- Sorting multi-kolom
- Global filter input
- Column visibility toggle
- Row selection dengan counter
- Pagination dengan size selector

---

### 2.9 `<AccountCard />` — Kartu Akun Sosmed

```tsx
// Digunakan di: Accounts Hub (/accounts), PlatformSelector
interface AccountCardProps {
  account: Account;
  variant: "full" | "compact";
  onRelogin?: () => void;
  onDisconnect?: () => void;
}
```

`full` → kartu besar dengan avatar, platform icon, last login, status dot  
`compact` → versi kecil untuk di dalam PlatformSelector

---

### 2.10 Komponen Atom (Shared Primitives)

Komponen paling dasar yang jadi pondasi semua komponen di atas:

| Komponen | Fungsi |
|---|---|
| `<EmptyState icon title description action />` | Placeholder kosong yang konsisten di semua halaman |
| `<SkeletonCard />` | Loading placeholder untuk ProjectCard |
| `<ProgressBar value max animated />` | Progress bar yang digunakan di WorkerWidget, ProjectCard |
| `<ConfirmDialog />` | Dialog konfirmasi aksi destructive (archive, delete) |
| `<Toast />` | Notifikasi via `sonner` library |
| `<PageHeader title description actions />` | Header halaman yang konsisten |
| `<SectionLabel />` | Label seksi dengan divider, dipakai di drawer/form |

---

## 📱 3. Distribusi Mobile + Desktop

### 3.1 Strategi: "Web-First, App-Feel"

Karena backend sudah bisa diakses via LAN (`--host 0.0.0.0`), strategi terbaik adalah:

```
Jalur Desktop → Browser biasa (localhost:3000) atau dibungkus Tauri/Electron
Jalur Mobile  → Browser mobile via LAN ATAU dibungkus Capacitor (Progressive Web App)
```

---

### 3.2 Responsive Layout System

**Pendekatan: Adaptive Layout, bukan hanya Responsive**

Daripada hanya mengecilkan layar yang sama, buat layout yang **berubah perilaku** di mobile:

| Breakpoint | Desktop (≥1024px) | Tablet (768–1023px) | Mobile (≤767px) |
|---|---|---|---|
| Sidebar | Fixed sidebar kiri | Icons-only sidebar | Bottom navigation bar |
| Project Board | Kanban horizontal scroll | 2 kolom grid | Single column stack |
| Drawer | Slide dari kanan (40% width) | Slide dari kanan (70% width) | Full-screen bottom sheet |
| DataTable | Semua kolom | Kolom utama saja | Card list mode |
| WorkerWidget | Pojok kanan bawah | Pojok kanan bawah | Notifikasi bar atas |

---

### 3.3 Mobile-Specific Navigation: Bottom Tab Bar

Di mobile, gantikan sidebar dengan **Bottom Tab Bar** (seperti aplikasi native):

```
┌─────────────────────────────────────────────┐
│                                             │
│              [Content Area]                 │
│                                             │
├────────┬────────┬────────┬────────┬─────────┤
│   🏠   │   🎬   │   📤   │   🔍   │   ⚙️   │
│  Home  │ Studio │  Queue │ Scrape │ Settings│
└────────┴────────┴────────┴────────┴─────────┘
```

Implementasi: Deteksi breakpoint via Tailwind `md:` prefix atau `useMediaQuery` hook. Tab aktif diberi indikator pill animasi.

---

### 3.3b TopBar Design (Desktop + Mobile) {#topbar}

**TopBar** adalah komponen yang selalu terlihat di bagian atas layar, berfungsi sebagai command center dan navigasi kontekstual.

#### Desktop TopBar (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [≡ Nomad Hub]  🔍 Search / Ctrl+K...        [🔔 3] [⚙] [👤 Admin ▼]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Logo + Hamburguer**: Toggle sidebar collapse/expand (animasi smooth)
- **Search Bar** (tengah): Klik → buka Command Palette (`cmdk`). Placeholder: `Search projects, actions...  Ctrl+K`
- **Notification Bell** `🔔 3`: Dropdown riwayat terbaru — "Upload video_001 ke TikTok selesai", "Bot Alpha gagal"
- **Settings Icon** `⚙`: Shortcut ke halaman `/settings`
- **User Avatar** `👤 Admin ▼`: Dropdown mini — nama user, role, dark/light mode toggle, logout

#### Mobile TopBar (≤767px)

```
┌─────────────────────────────────────────────────────────┐
│ [≡]   Nomad Hub — Studio        [🔍]  [🔔]  [👤]       │
└─────────────────────────────────────────────────────────┘
```

- **Hamburguer** `[≡]`: Buka drawer sidebar (overlay dari kiri) atau **tidak ada** bila Bottom Tab Bar aktif
- **Page Title** (tengah): Nama halaman aktif — berubah dinamis saat navigasi
- **Search Icon** `[🔍]`: Tap → full-screen search overlay (bukan inline bar)
- **Notification** `[🔔]`: Sama seperti desktop, muncul sebagai bottom sheet di mobile
- **Avatar** `[👤]`: Bottom sheet profile menu

#### Implementasi `<TopBar />` Component

```tsx
interface TopBarProps {
  title?: string;             // override page title (fallback: route name)
  actions?: React.ReactNode;  // slot untuk tombol kontekstual halaman
  showSearch?: boolean;       // default true
  showBack?: boolean;         // mobile only: tampilkan tombol back arrow
}

// Contoh penggunaan di halaman Publisher:
<TopBar
  title="Publisher"
  actions={
    <>
      <Button variant="outline" size="sm">Filter</Button>
      <Button size="sm">+ Add to Queue</Button>
    </>
  }
/>
```

> ✅ Setiap halaman bisa meng-inject action button ke TopBar melalui prop `actions`, menjaga konsistensi layout tanpa duplikasi header per-halaman.

#### Breadcrumb untuk Halaman Nested

Untuk rute bersarang (misal: `/studio/video/project-alpha/curate`), TopBar menampilkan breadcrumb:

```
[≡]  Studio > Video Projects > Project Alpha > Curate    [🔍] [🔔] [👤]
```

Klik segmen breadcrumb → navigasi ke level tersebut.

---

### 3.3c Hardcoded Demo Accounts {#demo-accounts}

Untuk keperluan **development, demo, dan onboarding** user baru, sediakan akun-akun hardcoded yang langsung muncul tanpa perlu koneksi OAuth.

#### Definisi di `lib/constants.ts`

```ts
// lib/constants.ts
export const DEMO_ACCOUNTS: Account[] = [
  {
    id: "demo_tiktok_01",
    name: "@nomad.tiktok.demo",
    platform: "tiktok",
    auth_method: "playwright",
    status: "active",
    avatar: "/demo/tiktok-avatar.png",
    isDemo: true,
    followers: 12400,
    lastLogin: "2026-03-13T10:00:00Z",
  },
  {
    id: "demo_youtube_01",
    name: "Nomad Creative YT",
    platform: "youtube",
    auth_method: "oauth",
    status: "active",
    avatar: "/demo/yt-avatar.png",
    isDemo: true,
    followers: 4380,
    lastLogin: "2026-03-12T18:30:00Z",
  },
  {
    id: "demo_instagram_01",
    name: "@nomad.ig.demo",
    platform: "instagram",
    auth_method: "playwright",
    status: "needs_login",   // sengaja error untuk demo error state
    avatar: "/demo/ig-avatar.png",
    isDemo: true,
    followers: 8920,
    lastLogin: "2026-02-28T09:00:00Z",
  },
  {
    id: "demo_facebook_01",
    name: "Nomad Hub Page",
    platform: "facebook",
    auth_method: "api",
    status: "active",
    avatar: "/demo/fb-avatar.png",
    isDemo: true,
    followers: 2150,
    lastLogin: "2026-03-10T14:20:00Z",
  },
];
```

#### Tampilan AccountCard dengan Flag Demo

Akun demo diberi label **"DEMO"** badge berwarna amber di pojok kanan atas kartu:

```
┌──────────────────────────────────────┐
│ 🎵 TikTok          [● Active] [DEMO] │
│                                      │
│  👤 @nomad.tiktok.demo               │
│  12.4K followers                     │
│  Last login: 2 hours ago             │
│                                      │
│ [Re-login]              [Disconnect] │
└──────────────────────────────────────┘
```

#### Integrasi dengan PlatformSelector

Saat user membuka `<PlatformSelector />`, akun demo **muncul tapi interaksinya dibatasi**:
- Demo account bisa dipilih secara visual
- Saat user klik "Start Upload", tampilkan modal: *"Akun ini adalah demo. Hubungkan akun nyata di halaman Accounts."*

#### Toggle via Environment Variable

```env
# .env.local
NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true   # aktif di development
# Kosongkan/false untuk production
```

---

### 3.4 Touch Optimizations

Untuk layar sentuh, beberapa penyesuaian wajib:

- **Minimum tap target** 44×44px (sesuai Apple HIG / Material)
- **Swipe gestures** di Kanban Board untuk pindah antar kolom
- **Long-press** pada AssetCard untuk masuk ke mode multi-select (haptics feedback)
- **Pull-to-refresh** di halaman project list dan queue
- **Drawer** menggunakan `vaul` library (natively supports swipe-to-close)

---

### 3.5 Progressive Web App (PWA) untuk Mobile

Tambahkan PWA support di Next.js dengan `next-pwa`:

```
next.config.js → withPWA({...})
public/manifest.json → nama, icon, theme_color
```

Benefit:
- User bisa "Install" Nomad Hub ke Home Screen HP
- Bekerja offline untuk UI (koneksi ke backend tetap butuh LAN/internet)
- Full-screen mode tanpa browser chrome
- Icon shortcut di homescreen

---

### 3.6 Distribusi Desktop via Tauri (Recommended)

Untuk pengalaman desktop yang native, bungkus Next.js dengan **Tauri** (lebih ringan dari Electron):

```
Tauri benefits:
✅ Bundle size ~3MB (vs Electron ~150MB)
✅ Native system tray
✅ Auto-updater built-in
✅ Native file dialogs (buka folder, pilih file)
✅ Berjalan di Windows, macOS, Linux
✅ Bisa start/stop backend Python dari dalam app
```

**Alur distribusi:**

```
Developer → Build Next.js (static) → Tauri bundle → .exe / .dmg / .AppImage
User      → Install .exe → App buka → Tauri otomatis jalankan backend Python
```

Tauri bisa menjalankan `uvicorn` sebagai child process sehingga user tidak perlu membuka terminal.

---

### 3.7 Distribusi Mobile via Capacitor.js

Untuk distribusi ke Android/iOS (opsional):

```
Framework: Next.js + Capacitor
Output: .apk (Android) / .ipa (iOS)

Kapabilitas native yang bisa diaktifkan:
- Camera (untuk scan QR code konfigurasi, misalnya)
- Local Notifications (notif upload selesai)
- Biometrics (fingerprint login ke app)
- Share sheet (share langsung ke platform sosmed)
```

> ⚠️ **Catatan**: Mode Capacitor lebih cocok sebagai remote controller. Backend Python tetap jalan di komputer utama, mobile hanya sebagai klien/monitor.

---

### 3.8 Remote Access: QR Code Quick Connect

Fitur kecil tapi sangat powerful untuk workflow mobile:

Di halaman Settings, tampilkan **QR Code** yang berisi URL LAN backend:

```
Scan QR ini di HP kamu:
┌──────────────────────┐
│   ██  ████  ██  ██  │  → http://192.168.1.5:3000
│   ██ █████ ███  ██  │
│   ██████████████   │
└──────────────────────┘
✅ Terhubung ke: Nomad Hub v2.0 (DESKTOP-ABC)
```

Implementasi: `qrcode.react` library, QR berisi URL yang di-auto-detect dari `ip` Node.js module.

---

## 🎨 4. Design System Tokens (Untuk Konsistensi Cross-platform)

```css
:root {
  /* Color Palette */
  --color-brand-primary: hsl(248, 100%, 68%);     /* Neon Indigo */
  --color-brand-secondary: hsl(280, 70%, 60%);    /* Violet */
  --color-bg-base: hsl(222, 47%, 7%);             /* Deep dark */
  --color-bg-elevated: hsl(222, 40%, 12%);        /* Card surface */
  --color-bg-overlay: hsl(222, 35%, 16%);         /* Drawer, Modal */
  --color-text-primary: hsl(220, 30%, 96%);
  --color-text-secondary: hsl(220, 15%, 60%);
  --color-text-muted: hsl(220, 10%, 40%);
  --color-border: hsl(222, 30%, 20%);
  --color-success: hsl(142, 70%, 45%);
  --color-warning: hsl(38, 95%, 55%);
  --color-error: hsl(0, 80%, 60%);

  /* Spacing Scale (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Glassmorphism */
  --glass-bg: hsla(222, 40%, 12%, 0.7);
  --glass-border: hsla(255, 100%, 80%, 0.08);
  --glass-blur: blur(16px);

  /* Shadows */
  --shadow-card: 0 4px 24px hsla(248, 100%, 10%, 0.4);
  --shadow-drawer: -8px 0 48px hsla(248, 100%, 5%, 0.6);
  --shadow-modal: 0 24px 80px hsla(248, 100%, 5%, 0.8);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 📁 7. Struktur Folder Komponen yang Disarankan {#7}

```
frontend/src/
├── components/
│   ├── atoms/                    # Primitive building blocks
│   │   ├── StatusBadge.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── EmptyState.tsx
│   │   ├── SkeletonCard.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── Toast.tsx
│   │   ├── PageHeader.tsx
│   │   └── SectionLabel.tsx
│   │
│   ├── molecules/                # Composed components
│   │   ├── ProjectCard.tsx       # Kanban / Grid / List / Compact
│   │   ├── AssetCard.tsx         # Video / Image di grid
│   │   ├── AccountCard.tsx       # Full / Compact
│   │   ├── QueueRow.tsx          # Row di DataTable queue
│   │   └── PlatformSelector.tsx
│   │
│   ├── organisms/                # Complex, feature-specific components
│   │   ├── ProjectInspectorDrawer.tsx
│   │   ├── MetadataDrawer.tsx
│   │   ├── AssetGrid.tsx
│   │   ├── LifecycleBoard.tsx    # Kanban board
│   │   ├── DataTable.tsx         # TanStack Table wrapper
│   │   ├── WorkerStatusWidget.tsx
│   │   └── CommandPalette.tsx
│   │
│   └── layout/
│       ├── AppShell.tsx          # Root layout (sidebar + main)
│       ├── Sidebar.tsx           # Desktop sidebar
│       ├── BottomTabBar.tsx      # Mobile bottom navigation
│       ├── TopBar.tsx            # Header dengan Ctrl+K + notif + user
│       └── BottomTabBar.tsx     # Mobile bottom navigation
│
├── hooks/
│   ├── useProjects.ts            # Data fetching + mutations (TanStack Query)
│   ├── useQueue.ts               # Queue fetch + reorder mutation
│   ├── useWorkerEvents.ts        # SSE subscription
│   ├── useMediaQuery.ts          # Responsive breakpoint detection
│   ├── useCommandPalette.ts      # Ctrl+K state management
│   └── useUploadProgress.ts      # SSE upload progress per job
│
├── stores/
│   ├── appStore.ts               # Zustand: selected project, sidebar state
│   ├── queueStore.ts             # Zustand: queue order (optimistic update)
│   ├── workerStore.ts            # Zustand: background job progress
│   └── uiStore.ts                # Zustand: drawer open/close state
│
└── lib/
    ├── api.ts                    # (existing) API calls
    ├── constants.ts              # Status enums, platform lists, DEMO_ACCOUNTS
    ├── utils.ts                  # Helper functions
    └── queue-utils.ts            # Sortable order helpers, batch grouping
```

---

## 📋 4. Upload Queue System — Ordered, Reorderable, Batch/Single {#4}

Ini adalah **redesign penuh** dari Queue Manager yang saat ini ada. Konsepnya berubah dari sekadar "list pending uploads" menjadi **sistem antrian berurutan yang bisa dikelola**.

---

### 4.1 Konsep: Numbered Upload Queue

```
Upload Queue — 20 items

┌─────────────────────────────────────────────────────────────────────────────┐
│  #   Asset               Platform     Account        Schedule    Status     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⠿ 1  🎬 video_reel_001   🎵 TikTok    @nomad.demo   Now         [▶ Upload] │
│ ⠿ 2  🎬 video_reel_002   ▶ YouTube    Nomad YT      Now         [Pending]  │
│ ⠿ 3  🖼 kdp_cover_040    🎵 TikTok    @nomad.demo   Now         [Pending]  │
│ ⠿ 4  🎬 scraped_clip_01  📸 Instagram  @nomad.ig     Scheduled   [⏰ Mar 15]│
│ ⠿ 5  🎬 video_reel_003   🎵 TikTok    @nomad.demo   Now         [Pending]  │
│  ...                                                                        │
│ ⠿ 20 🎬 video_batch_20   ▶ YouTube    Nomad YT      Now         [Pending]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Kolom `⠿`** adalah **drag handle** — user drag baris tersebut untuk reorder.

---

### 4.2 Drag-to-Reorder (Prioritas Upload)

Implementasi menggunakan **`@dnd-kit/sortable`** (bukan react-beautiful-dnd yang deprecated).

```tsx
// Contoh UX:
// User drag item #5 ke posisi #1
// → antrian sekarang: 5, 1, 2, 3, 4, ...
// → upload worker akan mengerjakan item baru #1 lebih dulu

interface QueueItem {
  id: string;
  order: number;          // ← field baru untuk posisi antrian
  filename: string;
  platform: Platform;
  accountId: string;
  scheduledAt?: string;
  status: "pending" | "uploading" | "completed" | "failed" | "scheduled";
  addedAt: string;
  metadata: AssetMetadata;
}
```

**Visual feedback saat drag:**
- Item yang di-drag: semi-transparent dengan shadow terangkat  
- Item lain bergeser smooth (framer-motion `AnimatePresence`)  
- Setelah drop: badge berkedip sebentar menandai posisi baru  

**Persistensi:** Order disimpan di SQLite kolom `order_index` dan di-sync ke backend via `PATCH /api/v1/publisher/queue/reorder` (body: array of `{id, order}`).

---

### 4.3 Toolbar: Filter, Search, Batch Actions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 [Search filename...]  [Platform ▼]  [Account ▼]  [Status ▼]  [Sort ▼]  │
│                                                                             │
│ ✓ 5 selected:  [▶ Upload Selected]  [🗓 Schedule Selected]  [🗑 Remove]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Filter yang tersedia:**
- **Platform**: TikTok / YouTube / Instagram / Facebook / All
- **Account**: Dropdown akun per platform yang terkoneksi
- **Status**: Pending / Uploading / Scheduled / Completed / Failed
- **Sort**: By order (default) / By added date / By filename / By platform

**Filter tidak menghapus item dari antrian** — hanya menyembunyikan dari tampilan. Badge `"Showing 8 of 20"` muncul saat filter aktif.

---

### 4.4 Upload Modes: Single vs Batch

#### Single Upload

Hover pada satu baris → muncul tombol **`[▶ Upload Now]`** di kolom action.

Klik → dialog konfirmasi mini:

```
┌──────────────────────────────────────────────┐
│ Upload Sekarang?                              │
│                                              │
│ 🎬 video_reel_001                            │
│ Platform  : 🎵 TikTok — @nomad.demo          │
│ Schedule  : Immediately                      │
│                                              │
│              [Cancel]  [▶ Upload Now]        │
└──────────────────────────────────────────────┘
```

#### Batch Upload

1. User centang beberapa item (atau `Ctrl+A` untuk select all visible)
2. Floating action bar muncul:

```
┌─────────────────────────────────────────────────────────────┐
│  ✓ 8 items selected    [▶ Upload All]  [Schedule]  [Remove] │
└─────────────────────────────────────────────────────────────┘
```

3. Klik **`[▶ Upload All]`** → dialog batch konfirmasi:

```
┌──────────────────────────────────────────────────────┐
│ 🚀 Batch Upload — 8 Items                            │
│                                                      │
│  Platform breakdown:                                 │
│  🎵 TikTok (3 items)   — @nomad.demo                 │
│  ▶ YouTube (3 items)   — Nomad YT                    │
│  📸 Instagram (2 items) — @nomad.ig (⚠ needs login)  │
│                                                      │
│  ⚠ 1 akun butuh re-login. Skip atau batalkan?        │
│                                                      │
│  [Cancel]  [Skip Failed Accounts]  [Upload All]      │
└──────────────────────────────────────────────────────┘
```

**Behavior upload batch:**
- Upload berjalan **berurutan** sesuai `order` (bukan parallel) untuk menghindari rate limit platform
- Item yang sedang di-upload ditandai dengan spinner `🔄 Uploading...` dan progress bar inline
- Item berikutnya tetap visible di bawah, menunggu giliran
- Jika satu item gagal → **skip + log** → lanjut ke item berikutnya (tidak berhenti total)

---

### 4.5 Queue Item Expanded View

Klik chevron `▶` atau row → expand inline untuk lihat detail tanpa drawer:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⠿ 1  🎬 video_reel_001   🎵 TikTok    @nomad.demo   Now     [▶ Upload]  ▾  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Thumbnail]   Title: "5 Cara Produktif Kerja Remote #shorts"               │
│                Description: "Lorem ipsum..." (truncated, klik edit)         │
│                Tags: #shorts #remotework #productivity                      │
│                                                                             │
│     [✎ Edit Metadata]   [🗓 Schedule]   [↑ Move to Top]   [🗑 Remove]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.6 Live Upload Progress (SSE)

Saat upload berjalan, item di antrian berubah tampilan:

```
│ 🔄 1  🎬 video_reel_001   🎵 TikTok    @nomad.demo   Now    [Uploading...]  │
│       ████████████████████░░░░░░░░   68%  •  ETA: ~45s                      │
```

Data dari SSE endpoint: `GET /api/v1/events/upload-progress?jobId=xxx`

```json
// SSE payload
{ "jobId": "xxx", "progress": 68, "eta": 45, "status": "uploading" }
```

Bila selesai → baris bergerak animasi keluar dari queue (slide + fade) dan counter total berkurang.

---

### 4.7 Scheduled Uploads

Item dengan jadwal masa depan tampil berbeda:

```
│ ⠿ 4  🎬 scraped_001   📸 Instagram  @nomad.ig   🗓 Mar 15, 09:00   [Edit] │
│       Scheduled — in 2 days                                                 │
```

**Edit Schedule** → popover date-time picker langsung inline:

```
┌─────────────────────────┐
│  📅 Pilih Jadwal        │
│                         │
│  [March 2026  ◄  ►]   │
│  Mo Tu We Th Fr Sa Su  │
│  ...  15 [16] 17 ...   │
│                         │
│  ⏰ 09 : 00  [AM ▼]    │
│                         │
│  [Clear]  [Set Schedule]│
└─────────────────────────┘
```

---

### 4.8 Schema Update yang Diperlukan

```python
# backend/models.py - tambahkan ke UploadQueueItem
order_index   = Column(Integer, default=0)   # posisi antrian
batch_id      = Column(String, nullable=True) # group ID untuk batch upload
skip_on_fail  = Column(Boolean, default=True) # lanjut jika gagal di batch
```

```python
# backend/routers/publisher.py - endpoint baru
PATCH /api/v1/publisher/queue/reorder
  body: [{"id": "filename.mp4", "order": 1}, ...]
  → Update order_index semua item sekaligus

GET /api/v1/publisher/queue?platform=tiktok&status=pending&sort=order
  → Filter + sort server-side

POST /api/v1/publisher/upload/batch
  body: {"items": ["file1.mp4", "file2.mp4"], "skip_on_fail": true}
  → Jalankan upload berurutan sesuai order
```

---

## 🏆 5. Published View — Post-Upload Analytics {#5}

Saat project atau aset masuk ke status **Published**, tampilan berubah dari action-oriented menjadi **insight-oriented**.

---

### 5.1 Published Tab di Lifecycle Board

Kolom `Published` di Kanban Board menampilkan project cards dengan info berbeda:

```
┌──────────────────────────┐
│  Published               │
│  ━━━━━━━━━━━━━━━━━━━━━━  │
│                          │
│ [🎬 Project Alpha]       │
│  ✅ TikTok (12 Mar)      │
│  ✅ YouTube (12 Mar)     │
│  ❌ Instagram (failed)   │
│  [Retry Failed ↻]        │
│                          │
│ [🎬 Project Beta]        │
│  ✅ TikTok (10 Mar)      │
│  ✅ YouTube (10 Mar)     │
│  ✅ Instagram (10 Mar)   │
│                          │
└──────────────────────────┘
```

- **✅** = upload berhasil (klik → buka URL di platform baru)
- **❌** = gagal (klik → lihat error log + tombol Retry)
- **[Retry Failed ↻]** = single-click retry hanya untuk yang gagal

---

### 5.2 Published History Page (`/published`)

Halaman dedicated untuk melihat semua yang sudah pernah diupload:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Published History         [🔍 Search]  [Platform ▼]  [Date ▼]  [Export CSV]│
├─────────────────────────────────────────────────────────────────────────────┤
│  Date       Asset              Platforms             Result                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Mar 13     video_reel_001    🎵▶📸        ✅3/3      [View Links] [Re-use] │
│  Mar 12     kdp_cover_040     🎵            ✅1/1      [View Links]          │
│  Mar 11     scraped_clip_01   ▶📸           ✅1/1 ❌1/2 [View Links] [Retry]│
│  Mar 10     video_reel_002    🎵▶📸🅕        ✅4/4      [View Links]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Aksi per baris:**
- **[View Links]** → expand atau drawer yang menampilkan list URL per platform
- **[Retry]** → re-upload hanya platform yang gagal (tidak duplikasi yang sudah berhasil)
- **[Re-use]** → tambahkan kembali asset ini ke antrian queue dengan metadata yang tersimpan

---

### 5.3 Upload Result Drawer

Klik `[View Links]` → slide-out drawer:

```
┌───────────────────────────────────────────────────────────┐
│  📋 Upload Results — video_reel_001.mp4          [✕ Close] │
├───────────────────────────────────────────────────────────┤
│  Thumbnail  │  Title: "5 Cara Produktif Kerja Remote"      │
│             │  Uploaded: March 13, 2026 — 14:32            │
│             │  Duration: 0:43                              │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  🎵 TikTok — @nomad.demo                                  │
│     ✅ Published  •  youtu.be/abc123       [🔗 Open] [📋]  │
│                                                           │
│  ▶ YouTube — Nomad YT                                     │
│     ✅ Published  •  tiktok.com/@.../123   [🔗 Open] [📋]  │
│                                                           │
│  📸 Instagram — @nomad.ig                                 │
│     ❌ Failed — Cookie expired                            │
│     [↻ Retry Upload]   [ℹ View Error Log]                 │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

### 5.4 Dashboard Published Widget (Update)

Widget "Project Health" di Dashboard diperluas dengan tab Published:

```
┌──────────────────────────────────────────────────────┐
│  📊 Published This Month                             │
│                                                      │
│  48 total uploads  •  42 ✅ success  •  6 ❌ failed  │
│                                                      │
│  🎵 TikTok   ████████████████  18 uploads            │
│  ▶ YouTube  ████████████       14 uploads            │
│  📸 Instagram ██████             8 uploads           │
│  🅕 Facebook  ████               6 uploads           │
│                                    [View All Logs →] │
└──────────────────────────────────────────────────────┘
```

---

## 🎨 6. Design System Tokens (Untuk Konsistensi Cross-platform) {#6}

```css
:root {
  /* Color Palette */
  --color-brand-primary: hsl(248, 100%, 68%);     /* Neon Indigo */
  --color-brand-secondary: hsl(280, 70%, 60%);    /* Violet */
  --color-bg-base: hsl(222, 47%, 7%);             /* Deep dark */
  --color-bg-elevated: hsl(222, 40%, 12%);        /* Card surface */
  --color-bg-overlay: hsl(222, 35%, 16%);         /* Drawer, Modal */
  --color-text-primary: hsl(220, 30%, 96%);
  --color-text-secondary: hsl(220, 15%, 60%);
  --color-text-muted: hsl(220, 10%, 40%);
  --color-border: hsl(222, 30%, 20%);
  --color-success: hsl(142, 70%, 45%);
  --color-warning: hsl(38, 95%, 55%);
  --color-error: hsl(0, 80%, 60%);

  /* Spacing Scale (4px base) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px; --space-12: 48px;

  /* Border Radius */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-full: 9999px;

  /* Glassmorphism */
  --glass-bg: hsla(222, 40%, 12%, 0.7);
  --glass-border: hsla(255, 100%, 80%, 0.08);
  --glass-blur: blur(16px);

  /* Shadows */
  --shadow-card: 0 4px 24px hsla(248, 100%, 10%, 0.4);
  --shadow-drawer: -8px 0 48px hsla(248, 100%, 5%, 0.6);
  --shadow-modal: 0 24px 80px hsla(248, 100%, 5%, 0.8);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms cubic-bezier(0.16, 1, 0.3, 1);

  /* TopBar Height (critical for layout offset) */
  --topbar-height: 56px;          /* desktop */
  --bottomnav-height: 64px;       /* mobile bottom tab bar */
  --sidebar-width: 240px;
  --sidebar-collapsed-width: 60px;
}
```

---

## 🚀 8. Urutan Implementasi yang Disarankan {#8}

| Fase | Target | Komponen / Deliverable |
|---|---|---|
| **Fase 1** (Fondasi) | Design System + Layout | CSS tokens, `TopBar`, `Sidebar`, `BottomTabBar`, `AppShell` |
| **Fase 2** (Atoms) | Primitives | `StatusBadge`, `EmptyState`, `ProgressBar`, `SkeletonCard`, `PageHeader`, `ConfirmDialog` |
| **Fase 3** (Molecules) | Cards | `ProjectCard` (4 variant), `AssetCard`, `AccountCard` (+ Demo Accounts) |
| **Fase 4** (Organisms) | Core Views | `LifecycleBoard` (Kanban), `AssetGrid`, `DataTable` |
| **Fase 5** (Drawers) | Inline Editing | `ProjectInspectorDrawer`, `MetadataDrawer`, `UploadResultDrawer` |
| **Fase 6** (Queue) | Upload Queue System | `QueueTable` (drag-reorder `@dnd-kit`), batch upload, SSE progress, schema migration |
| **Fase 7** (Published) | Post-Upload | `PublishedHistory` page, retry logic, per-platform URL links |
| **Fase 8** (Global) | Power Features | `CommandPalette` (Ctrl+K), `WorkerStatusWidget` (SSE), QR Code connect |
| **Fase 9** (Mobile) | Responsiveness | Touch gestures, PWA manifest, mobile-specific UX polish |
| **Fase 10** (Desktop) | App Distribution | Tauri bundling, system tray, auto-start Python backend |

---

> **Prioritas Kritis**: Fase 1 → 6 adalah **core product** — harus selesai sebelum distribusi. Fase 7-10 adalah **polish & distribution layer** yang bisa dilakukan bertahap setelah core stabil.
>
> **Quick Win**: Fase 1-3 memberikan dampak visual terbesar dengan effort minimum. Mulai dari sini untuk memvalidasi design system sebelum membangun fitur kompleks.
>
> **Note khusus Queue**: Fase 6 (Upload Queue) adalah fitur terpenting untuk workflow harian. Implementasikan setelah Fase 4 selesai karena membutuhkan `DataTable` sebagai pondasi.
