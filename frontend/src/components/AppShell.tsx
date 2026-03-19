"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProjectSwitcher } from "@/components/layout/ProjectSwitcher";
import { Moon, Sun, Monitor, LogOut, User, ListTree, Command } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target.closest("[contenteditable=\"true\"]"));
}

function toLabel(segment: string) {
  if (!segment) return "Dashboard";
  return segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);


  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  const quickActions = useMemo(() => [
    { label: "Buka Runs", href: "/runs", keywords: ["runs", "queue", "jobs", "monitor"] },
    { label: "Buka Queue Builder", href: "/queue-builder", keywords: ["publish", "upload", "queue builder"] },
    { label: "Buka Pipeline Templates", href: "/pipeline-templates", keywords: ["pipeline", "template", "video", "kdp"] },
    { label: "Buka Project Manager", href: "/project-manager", keywords: ["project", "manager"] },
    { label: "Buka Drive Explorer", href: "/drive", keywords: ["drive", "assets"] },
    { label: "Buka Settings", href: "/settings", keywords: ["settings", "config"] },
    { label: "Buka System Logs", href: "/logs", keywords: ["logs", "system", "error"] },
  ], []);

  const filteredActions = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return quickActions;
    return quickActions.filter((action) =>
      action.label.toLowerCase().includes(query) ||
      action.href.toLowerCase().includes(query) ||
      action.keywords.some((keyword) => keyword.includes(query))
    );
  }, [commandQuery, quickActions]);

  const openAndResetCommand = () => {
    setCommandQuery("");
    setCommandOpen(true);
  };

  const navigateFromCommand = (href: string) => {
    setCommandOpen(false);
    setCommandQuery("");
    router.push(href);
  };

  useEffect(() => {
    const getUser = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getUser();

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut || isTypingTarget(event.target)) return;
      event.preventDefault();
      setCommandQuery("");
      setCommandOpen((prev) => !prev);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/");
    router.refresh();
  };

  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isLanding = pathname === "/";

  if (isAuthRoute || isLanding) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbItems = segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join("/")}`,
    label: toLabel(segment),
  }));

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 md:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <SidebarTrigger className="-ml-1 h-8 w-8 rounded-md border border-border/70 hover:bg-accent md:border-transparent" />
          <Separator orientation="vertical" className="mr-1 hidden data-vertical:h-4 data-vertical:self-auto md:block" />
          
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
            <nav className="hidden items-center text-xs text-muted-foreground whitespace-nowrap md:flex">
              <Link href="/" className="font-medium text-foreground hover:text-primary transition-colors">
                Dashboard
              </Link>
              {breadcrumbItems.map((item) => (
                <div key={item.href} className="flex items-center">
                  <span className="mx-2 text-muted-foreground/40">/</span>
                  <Link href={item.href} className="hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </div>
              ))}
            </nav>
            
            <Separator orientation="vertical" className="hidden h-4 opacity-50 md:block" />
            
            <div className="min-w-0 flex-1 md:flex-none">
              <ProjectSwitcher />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            <Button variant="outline" size="sm" className="hidden md:inline-flex h-8 text-xs" onClick={openAndResetCommand}>
              <Command className="mr-1 h-3.5 w-3.5" /> Command
              <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl+K</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md border border-border/70 md:hidden" onClick={openAndResetCommand}>
              <Command className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-md border border-border/70 text-muted-foreground hover:text-foreground md:border-transparent" />}>
                <ListTree className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-surface border-border">
                <DropdownMenuItem onClick={() => router.push("/")} className="cursor-pointer text-xs">Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/queue-builder")} className="cursor-pointer text-xs">Queue Builder</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/accounts")} className="cursor-pointer text-xs">Accounts</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/drive")} className="cursor-pointer text-xs">Drive Explorer</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/runs")} className="cursor-pointer text-xs">Runs</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer text-xs">Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/logs")} className="cursor-pointer text-xs">System Logs</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="hidden h-8 w-8 text-muted-foreground hover:text-foreground md:inline-flex" />}>
                <Monitor className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-surface border-border">
                <DropdownMenuItem onClick={() => theme !== "light" && toggleTheme()} className="cursor-pointer">
                  <Sun className="mr-2 h-4 w-4" /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => theme !== "dark" && toggleTheme()} className="cursor-pointer">
                  <Moon className="mr-2 h-4 w-4" /> Dark
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="mx-1 hidden h-4 md:block" />
            
            {!loading && (
              user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-md px-1.5 text-muted-foreground hover:text-foreground md:px-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <span className="hidden max-w-[100px] truncate text-xs font-medium md:block">
                        {user.user_metadata?.full_name || user.email}
                      </span>
                    </Button>
                  }>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-surface border-border">
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground truncate">
                        {user.user_metadata?.full_name || user.email}
                      </p>
                      <p className="truncate">
                        {user.email}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">
                        id: {user.id.slice(0, 8)}…
                      </p>
                    </div>
                    <Separator className="my-1 opacity-50" />
                    <DropdownMenuItem
                      onClick={() => { router.push("/settings/account"); router.refresh(); }}
                      className="cursor-pointer text-xs flex items-center"
                    >
                      <User className="mr-2 h-4 w-4" /> Account settings
                    </DropdownMenuItem>
                    <Separator className="my-1 opacity-50" />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive text-xs">
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors">
                    Login
                  </Link>
                  <Link href="/register" className={cn(buttonVariants({ size: "sm" }), "h-8 bg-primary text-primary-foreground hover:bg-primary/90")}>
                    Register
                  </Link>
                </div>
              )
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="px-[var(--section-px)] py-[var(--section-py)] pb-[calc(var(--section-py)+var(--bottomnav-h)+env(safe-area-inset-bottom))] md:pb-[var(--section-py)]">{children}</div>
        </main>
        <BottomTabBar />

        <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
          <DialogContent className="sm:max-w-lg bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-sm">Command Palette</DialogTitle>
            </DialogHeader>
            <Input
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const first = filteredActions[0];
                if (!first) return;
                event.preventDefault();
                navigateFromCommand(first.href);
              }}
              placeholder="Cari aksi... (contoh: runs, queue builder, logs)"
              className="mt-1"
              autoFocus
            />
            <div className="mt-3 max-h-72 space-y-1 overflow-auto">
              {filteredActions.map((action) => (
                <button
                  key={action.href}
                  onClick={() => navigateFromCommand(action.href)}
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-elevated"
                >
                  <p className="font-medium text-foreground">{action.label}</p>
                  <p className="text-muted-foreground">{action.href}</p>
                </button>
              ))}
              {filteredActions.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Tidak ada command yang cocok.
                </p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
