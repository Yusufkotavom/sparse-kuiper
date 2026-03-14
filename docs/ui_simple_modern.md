# Nomad Hub — Simple Modern UI Direction

> Inspired by: Vercel Dashboard, Linear, Raycast
> Prinsip: **Less chrome, more content. Dark by default. Every pixel has purpose.**

---

## 🎯 Core Philosophy: "Vercel-style"

Vercel berhasil karena satu hal — **UI-nya tidak pernah berusaha terlihat keren, tapi hasilnya keren.**

Nomad Hub harus mengikuti prinsip yang sama:

| ❌ Hindari | ✅ Lakukan |
|---|---|
| Gradients mencolok di mana-mana | Gradients hanya di accent kecil |
| Glassmorphism berlebihan | Flat surface, subtle border |
| Shadow tebal di semua card | Hampir zero shadow, pakai border tipis |
| Warna brand di headline | Warna brand hanya di CTA dan status aktif |
| Animasi di mana-mana | Animasi hanya saat state berubah |
| Sidebar penuh ikon + label | Sidebar tipis, label tersembunyi |

---

## 🎨 Visual Direction: "Zinc Dark"

Palet warna yang sangat sederhana — **hampir monokrom**, aksen hanya di satu warna:

```
Background    hsl(0, 0%, 4%)     →  #0a0a0a  (hampir hitam, seperti Linear)
Surface       hsl(0, 0%, 8%)     →  #141414  (card, sidebar)
Elevated      hsl(0, 0%, 11%)    →  #1c1c1c  (dropdown, hover)
Border        hsl(0, 0%, 16%)    →  #292929  (tipis, subtle)
Text Primary  hsl(0, 0%, 93%)    →  #ededed
Text Muted    hsl(0, 0%, 42%)    →  #6b6b6b
Accent        hsl(212, 100%, 60%) → #3b82f6  (biru — satu warna saja)
Success       hsl(142, 60%, 45%) →  #22c55e
Error         hsl(0, 70%, 55%)   →  #ef4444
```

> **Kuncinya**: Pakai warna zinc/gray hampir hitam. Satu accent color (biru) saja. Tidak ada indigo, tidak ada violet.

---

## 🧱 Layout: Vercel-style 3-Zone

```
┌──────────────────────────────────────────────────────────────┐
│  TopBar  [≡] [Logo]    breadcrumb               [🔍] [👤]   │  ← 48px height
├──────┬───────────────────────────────────────────────────────┤
│      │                                                       │
│  S   │              MAIN CONTENT                            │
│  I   │                                                       │
│  D   │   ┌──────────────────────────────────────────────┐   │
│  E   │   │  Page Header: Title    [action buttons]      │   │
│  B   │   └──────────────────────────────────────────────┘   │
│  A   │                                                       │
│  R   │   [content grid / list / kanban]                     │
│      │                                                       │
│ 60px │                                                 8px  │
└──────┴───────────────────────────────────────────────────────┘
```

- **Sidebar**: 60px lebar (icon only), hover expand jadi 220px
- **TopBar**: 48px (lebih tipis dari biasanya — terasa premium)
- **Content padding** : 24px all sides
- **No background decoration** — konten adalah dekorasi

---

## 📐 Component Sketches (Simple Version)

### TopBar — Super Minimal

```
┌──────────────────────────────────────────────────────────────┐
│  ⊞  Nomad Hub / Studio / Project Alpha      🔍    JD        │
└──────────────────────────────────────────────────────────────┘
     logo  ← breadcrumb di tengah kiri →      search  avatar
```

- Tidak ada tombol extra di topbar (settings, notif di sidebar)
- Breadcrumb auto-generate dari route
- Avatar: initial huruf user ("JD" untuk John Doe) — tidak perlu foto

---

### Sidebar — Icon-first, No Labels

```
┌──────┐
│  ⊞   │  ← Logo / home
├──────┤
│  ⊟   │  ← Dashboard      (tooltip saat hover: "Dashboard")
│  ⬡   │  ← Studio
│  ↑   │  ← Publisher
│  ⊕   │  ← Scraper
├──────┤
│  ⚙   │  ← Settings       (below separator)
│  📋  │  ← Logs
└──────┘
```

- Active state: small vertical bar di kiri ikon (warna accent)
- Hover state: background `hsl(0,0%,11%)` — sangat subtle
- Tooltip pops to the right saat hover

---

### Card — Border, No Shadow

```css
.card {
  background: hsl(0, 0%, 8%);
  border: 1px solid hsl(0, 0%, 16%);
  border-radius: 8px;
  /* NO box-shadow */
}

.card:hover {
  border-color: hsl(0, 0%, 24%);  /* border sedikit lebih terang */
}
```

Hasilnya: card terlihat "solid" bukan "floating". Seperti Vercel project cards.

---

### Status Indicators — Dot Only

Daripada badge berwarna besar, pakai **dot 6px** + label kecil:

```
● Active      ← hijau
● Uploading   ← biru berkedip (pulse animation)
● Failed      ← merah
● Queued      ← abu-abu
● Scheduled   ← kuning
```

---

### Queue Table — Clean Rows

```
#  Asset                    Platform     Status        —
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1  video_reel_001.mp4       TikTok       ● Pending     ···
2  video_reel_002.mp4       YouTube      ● Pending     ···
3  kdp_cover_040.mp4        TikTok       ⏰ Mar 15     ···
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Row height: 44px
- No card border around table, just divider lines (`border-bottom`)
- Hover row: background `hsl(0,0%,9%)` — barely there
- Action `···` button: muncul hanya saat hover

---

### Account Cards — Compact Grid

```
┌────────────────────┐  ┌────────────────────┐
│ TikTok             │  │ YouTube            │
│ @nomad.demo   ●   │  │ Nomad YT      ●   │
│ 12.4K followers    │  │ 4.3K subs          │
└────────────────────┘  └────────────────────┘

┌────────────────────┐  ┌────────────────────┐
│ Instagram          │  │ Facebook           │
│ @nomad.ig     ⚠   │  │ Nomad Page    ●   │
│ Needs re-login     │  │ 2.1K followers     │
└────────────────────┘  └────────────────────┘
```

Grid 4 kolom desktop, 2 kolom tablet, 1 kolom mobile.
Ukuran card kecil, tidak ada gambar besar — hanya teks + dot status.

---

## 📱 Mobile: Navigation Bawah — 5 Tab

```
┌─────────────────────────────────────────────────────┐
│                   [Content Area]                    │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│    ⊟     │    ⬡     │    ↑     │    ⊕     │   ⚙    │
│  Home    │ Studio   │  Queue   │ Scrape   │Settings │
└──────────┴──────────┴──────────┴──────────┴─────────┘
```

- Tab aktif: ikon + label muncul (yang lain hanya ikon)
- Tidak ada background tebal, hanya border atas tipis
- Active indicator: titik kecil di atas ikon  

---

## ✏️ Typography: Satu Font, Tiga Weight

```
Font: "Geist" (font resmi Vercel) atau fallback "Inter"

Heading   : 14px / weight 500 / letter-spacing: -0.01em
Body      : 13px / weight 400 / line-height: 1.5
Small     : 11px / weight 400 / color: muted
Mono      : 12px / font: "Geist Mono" (untuk filename, stat numbers)
```

> Semua text kecil — tapi tidak terasa sempit karena line-height yang tepat.

---

## ⚡ Micro-interactions: Minimal but Meaningful

Hanya 3 tipe animasi yang perlu ada:

1. **Fade + slide 150ms** → saat drawer/panel buka-tutup
2. **Pulse dot** → upload sedang berjalan (CSS animation, bukan JS)
3. **Row shift dengan ease** → saat drag reorder queue

**Tidak perlu**: page transition, skeleton shimmer yang terlalu panjang, hover scale pada cards.

---

## 🔑 3 Aturan Desain Nomad Hub

> Simpan ini sebagai north star selama development:

1. **"Would Vercel ship this?"** — kalau terlalu fancy, terlalu banyak warna, atau terlalu ramai, jawabannya tidak.
2. **Content > chrome** — konten (data project, video, status) harus menjadi titik fokus, bukan UI element di sekitarnya.
3. **Buka 5 detik, tau segalanya** — dalam 5 detik user buka dashboard, dia harus tahu: berapa project aktif, apa yang sedang di-upload, ada yang error tidak.
