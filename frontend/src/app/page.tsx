"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Globe,
  MapPin,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setUser(null);
        return;
      }
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
    };

    loadSession();

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const navItems: Array<{ label: string; href: string }> = [
    { label: "Home", href: "#home" },
    { label: "Solusi", href: "#solutions" },
    { label: "Pricing", href: "#pricing" },
    { label: "About", href: "#about" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <div id="home" className="min-h-screen bg-gradient-to-b from-background via-background to-background/0">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="sticky top-0 z-40 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/70 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="inline-flex items-center gap-2 font-semibold text-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="truncate">Kotacom</span>
              </Link>
              <Separator orientation="vertical" className="h-5 hidden sm:block" />
              <nav className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                {navItems.map((it) => (
                  <a
                    key={it.href}
                    href={it.href}
                    className="rounded-md px-2 py-1 hover:bg-elevated hover:text-foreground transition-colors"
                  >
                    {it.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className={cn(buttonVariants({ size: "sm" }), "h-8 bg-primary text-primary-foreground hover:bg-primary/90")}
                  >
                    Dashboard
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8")}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className={cn(buttonVariants({ size: "sm" }), "h-8 bg-primary text-primary-foreground hover:bg-primary/90")}
                  >
                    Mulai
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mt-10 flex-1 space-y-14 lg:mt-14">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] items-start">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>Surabaya, Indonesia</span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="text-[10px] text-muted-foreground/80">Our company: Kotacom</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-balance text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Full automation untuk
                  <span className="block bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                    konten, produksi, dan publish.
                  </span>
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Kotacom bantu tim kamu membuat pipeline konten end-to-end: generate ide, kelola asset, siapkan metadata,
                  jadwalkan publish, dan monitor job—dalam satu dashboard.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      className={cn(buttonVariants({ size: "lg" }), "bg-primary text-primary-foreground hover:bg-primary/90 px-6")}
                    >
                      Buka Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                    <Link
                      href="/project-manager"
                      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-border hover:bg-elevated px-6")}
                    >
                      Lihat Demo Produk
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/register"
                      className={cn(buttonVariants({ size: "lg" }), "bg-primary text-primary-foreground hover:bg-primary/90 px-6")}
                    >
                      Request Demo
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                    <a
                      href="#pricing"
                      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-border hover:bg-elevated px-6")}
                    >
                      Lihat Pricing
                    </a>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Workflow siap pakai</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1">
                  <Globe className="h-3.5 w-3.5 text-sky-400" />
                  <span>Multi-platform publish</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1">
                  <Star className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Operasional rapi</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="border-border bg-surface/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Apa yang kamu dapat</CardTitle>
                  <CardDescription className="text-xs">
                    Semua modul disatukan supaya tim fokus produksi, bukan urus tools.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Bullet>Manajemen project & asset</Bullet>
                  <Bullet>Auto metadata (judul, deskripsi, hashtag)</Bullet>
                  <Bullet>Queue builder + scheduler</Bullet>
                  <Bullet>Integrasi scraper & drive</Bullet>
                  <Bullet>Monitoring job + log</Bullet>
                </CardContent>
              </Card>

              <a
                href="#solutions"
                className="group flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 text-xs text-muted-foreground hover:bg-elevated transition-colors"
              >
                <span>Lihat solusi lengkap</span>
                <span className="inline-flex items-center gap-1 text-foreground">
                  Scroll
                  <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                </span>
              </a>
            </div>
          </section>

          <section id="solutions" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Solusi</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Kotacom dirancang untuk tim yang butuh output tinggi dengan proses yang konsisten.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <InfoCard
                title="Content Studio"
                desc="Generate ide, prompt, dan konsep konten. Simpan sebagai template biar tim satu suara."
                bullets={["Prompt library", "Template metadata", "Workflow ideation → draft"]}
              />
              <InfoCard
                title="Asset & Queue Manager"
                desc="Kelola file dari berbagai sumber (drive/scrape/upload) dan jalankan job publish terjadwal."
                bullets={["Queue lintas project", "Sidecar metadata", "Bulk actions & tags"]}
              />
              <InfoCard
                title="Queue Builder Ops"
                desc="Atur account, jadwal, dan job publish per platform dengan monitoring status yang mudah diaudit."
                bullets={["Account mapping", "Schedule per platform", "Job status & logs"]}
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <KpiCard kpi="10x" title="Lebih cepat" desc="Kurangi kerja repetitif lewat pipeline terstruktur." />
            <KpiCard kpi="1" title="Satu dashboard" desc="Tools digabung supaya operasional lebih rapih." />
            <KpiCard kpi="24/7" title="Siap jalan" desc="Scheduler + worker lokal untuk publish kapan saja." />
          </section>

          <section id="pricing" className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Pricing plan</h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Pilih paket sesuai kebutuhan tim. Upgrade kapan saja.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Harga bisa disesuaikan untuk enterprise & custom flow.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <PricingCard
                name="Starter"
                price="Rp 1.490k"
                period="/bulan"
                desc="Untuk creator atau tim kecil yang butuh workflow rapi."
                highlight={false}
                features={[
                  "Project & asset management",
                  "Metadata generator",
                  "Queue + basic scheduler",
                  "1 workspace",
                ]}
                cta={user ? { label: "Buka Dashboard", href: "/dashboard" } : { label: "Mulai Starter", href: "/register" }}
              />
              <PricingCard
                name="Growth"
                price="Rp 3.990k"
                period="/bulan"
                desc="Untuk tim yang publish rutin dan butuh kontrol campaign."
                highlight
                features={[
                  "Semua fitur Starter",
                  "Account mapping per platform",
                  "Bulk config + bulk run",
                  "Campaign tagging",
                  "Prioritas support",
                ]}
                cta={user ? { label: "Buka Runs", href: "/runs" } : { label: "Request Demo", href: "/register" }}
              />
              <PricingCard
                name="Enterprise"
                price="Custom"
                period=""
                desc="Untuk organisasi yang butuh integrasi & SOP khusus."
                highlight={false}
                features={[
                  "Integrasi custom (Drive/Storage)",
                  "SSO & policy akses",
                  "SLA & onboarding",
                  "Dedicated support",
                ]}
                cta={{ label: "Hubungi Sales", href: "#contact" }}
              />
            </div>
          </section>

          <section id="about" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">About Kotacom</h2>
              <p className="text-sm text-muted-foreground">
                Kotacom adalah tim product & automation dari Surabaya, Indonesia. Fokus kami: bantu bisnis mempercepat
                produksi konten dan proses publish lewat sistem yang terukur.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="bg-surface border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Misi</CardTitle>
                    <CardDescription className="text-xs">Biar tim kamu kerja lebih fokus.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Mengurangi kerja repetitif dan meningkatkan konsistensi produksi.
                  </CardContent>
                </Card>
                <Card className="bg-surface border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Nilai</CardTitle>
                    <CardDescription className="text-xs">Operational excellence.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Transparan, bisa diaudit, dan mudah dipakai oleh tim.
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card id="contact" className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-sm">Kontak</CardTitle>
                <CardDescription className="text-xs">
                  Kirim kebutuhan kamu, nanti kami siapkan demo flow yang relevan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <MapPin className="h-4 w-4 text-primary" />
                  Surabaya, Indonesia
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/register"
                    className={cn(buttonVariants({ size: "lg" }), "bg-primary text-primary-foreground hover:bg-primary/90")}
                  >
                    Request Demo
                  </Link>
                  <a
                    href="#pricing"
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-border hover:bg-elevated")}
                  >
                    Lihat Paket
                  </a>
                </div>
                {user && (
                  <p className="text-xs text-muted-foreground">
                    Signed in as{" "}
                    <span className="font-medium text-foreground">
                      {user.user_metadata?.full_name || user.email}
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <section id="faq" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">FAQ</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Pertanyaan yang sering muncul sebelum mulai.
              </p>
            </div>

            <div className="space-y-3">
              <FaqItem
                q="Kotacom ini cocok untuk siapa?"
                a="Cocok untuk creator, agency, atau tim internal yang butuh pipeline konten yang konsisten: dari ide, asset, metadata, sampai publish."
              />
              <FaqItem
                q="Apakah bisa pakai file dari Drive dan hasil scrape sekaligus?"
                a="Bisa. Asset bisa datang dari beberapa sumber, lalu tetap dikelola dalam project yang sama dan bisa masuk ke queue builder."
              />
              <FaqItem
                q="Apakah ada scheduling publish?"
                a="Ada. Kamu bisa set jadwal dan mapping akun per platform, lalu jalankan job secara manual atau batch."
              />
              <FaqItem
                q="Bisa custom workflow untuk tim saya?"
                a="Bisa. Paket Enterprise mendukung integrasi, SOP, dan kebutuhan akses/policy yang lebih kompleks."
              />
            </div>
          </section>
        </main>

        <footer className="mt-12 space-y-4 border-t border-border/60 pt-6 text-[11px] text-muted-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Kotacom</p>
              <p className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Surabaya, Indonesia
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {navItems.map((it) => (
                <a key={it.href} href={it.href} className="hover:text-foreground transition-colors">
                  {it.label}
                </a>
              ))}
            </div>
          </div>
          <p>© {new Date().getFullYear()} Kotacom. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
        <Check className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

function InfoCard({ title, desc, bullets }: { title: string; desc: string; bullets: string[] }) {
  return (
    <Card className="border-border bg-surface/70 hover:bg-surface transition-colors">
      <CardHeader className="space-y-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        {bullets.map((b) => (
          <div key={b} className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/70" />
            <span>{b}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function KpiCard({ kpi, title, desc }: { kpi: string; title: string; desc: string }) {
  return (
    <Card className="border-border bg-surface/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl font-black tracking-tight text-foreground">{kpi}</CardTitle>
        <CardDescription className="text-xs">{title}</CardDescription>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{desc}</CardContent>
    </Card>
  );
}

function PricingCard({
  name,
  price,
  period,
  desc,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: { label: string; href: string };
  highlight: boolean;
}) {
  return (
    <Card className={cn("border-border bg-surface/70", highlight && "ring-1 ring-primary/40 bg-surface")}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">{name}</CardTitle>
          {highlight && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Popular
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black tracking-tight text-foreground">{price}</span>
          {period && <span className="text-xs text-muted-foreground">{period}</span>}
        </div>
        <CardDescription className="text-xs leading-relaxed">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {features.map((f) => (
            <div key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 text-emerald-400" />
              <span>{f}</span>
            </div>
          ))}
        </div>
        <Link
          href={cta.href}
          className={cn(
            buttonVariants({ size: "lg", variant: highlight ? "default" : "outline" }),
            "w-full justify-center",
            highlight
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border-border hover:bg-elevated"
          )}
        >
          {cta.label}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <Collapsible className="rounded-xl border border-border bg-surface/60 px-4 py-3">
      <CollapsibleTrigger className="w-full text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{q}</p>
            <p className="text-xs text-muted-foreground">Klik untuk lihat jawaban</p>
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 text-sm text-muted-foreground leading-relaxed">
        {a}
      </CollapsibleContent>
    </Collapsible>
  );
}
