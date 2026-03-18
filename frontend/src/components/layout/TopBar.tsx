"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Search } from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";
import { cn } from "@/lib/utils";

interface TopBarAction {
    label: string;
    href: string;
}

const PAGE_LABELS: Record<string, string> = {
    "": "Dashboard",
    kdp: "Image Creation",
    video: "Video",
    audio: "Audio",
    scraper: "Scraper",
    settings: "Settings",
    accounts: "Accounts",
    "project-manager": "Project Manager",
    queue: "Runs",
    "queue-manager": "Runs",
    jobs: "Runs",
    runs: "Runs",
    publisher: "Publisher",
    logs: "Logs",
    published: "Published",
};

const ACTIONS_BY_ROUTE: Record<string, TopBarAction> = {
    "/": { label: "Open Runs", href: "/runs" },
    "/kdp": { label: "New Image Project", href: "/kdp/ideation" },
    "/video": { label: "New Video", href: "/video/ideation" },
    "/audio": { label: "Open TTS", href: "/audio/kokoro" },
    "/scraper": { label: "Open Downloads", href: "/scraper/downloads" },
    "/project-manager": { label: "Open Runs", href: "/runs" },
    "/queue-manager": { label: "Open Runs", href: "/runs" },
    "/queue": { label: "Open Runs", href: "/runs?intent=publisher" },
    "/jobs": { label: "Open Runs", href: "/runs?tab=scheduled" },
    "/runs": { label: "View Published", href: "/published" },
    "/publisher": { label: "View Accounts", href: "/accounts" },
    "/published": { label: "Back to Runs", href: "/runs" },
    "/accounts": { label: "Open Settings", href: "/settings" },
    "/settings": { label: "Open Logs", href: "/logs" },
    "/logs": { label: "Go Dashboard", href: "/" },
};

function toLabel(segment: string) {
    return PAGE_LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function TopBar() {
    const pathname = usePathname();
    const { isCollapsed, toggle } = useSidebar();

    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbItems = segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        return { href, label: toLabel(segment) };
    });

    const routeAction =
        Object.entries(ACTIONS_BY_ROUTE)
            .filter(([route]) => pathname === route || pathname.startsWith(`${route}/`))
            .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null;

    return (
        <header
            className={cn(
                "fixed top-0 right-0 z-40 h-[var(--topbar-h)] border-b border-border bg-background/95 backdrop-blur",
                "transition-all duration-300 ease-in-out",
                isCollapsed ? "md:left-[var(--sidebar-collapsed-w)]" : "md:left-[var(--sidebar-w)]",
                "left-0"
            )}
        >
            <div className="flex h-full items-center gap-2 px-3 md:px-4">
                <button
                    onClick={toggle}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <Menu className="h-4 w-4" />
                </button>

                <nav className="flex min-w-0 items-center text-xs text-muted-foreground">
                    <Link href="/" className="truncate font-medium text-foreground hover:text-primary">
                        Dashboard
                    </Link>
                    {breadcrumbItems.map((item) => (
                        <div key={item.href} className="flex min-w-0 items-center">
                            <ChevronRight className="mx-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <Link href={item.href} className="truncate hover:text-foreground">
                                {item.label}
                            </Link>
                        </div>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    {routeAction && (
                        <Link
                            href={routeAction.href}
                            className="hidden rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent md:inline-flex"
                        >
                            {routeAction.label}
                        </Link>
                    )}
                    <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        <Search className="h-4 w-4" />
                    </button>
                    <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-primary/15 px-2 text-xs font-semibold text-primary">
                        NH
                    </div>
                </div>
            </div>
        </header>
    );
}
