"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Clapperboard, ListOrdered, Globe, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Studio", href: "/video", icon: Clapperboard },
    { label: "Runs", href: "/runs", icon: ListOrdered },
    { label: "Scraper", href: "/scraper", icon: Globe },
    { label: "Settings", href: "/settings", icon: Settings },
];

export function BottomTabBar() {
    const pathname = usePathname();

    const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--bottomnav-h)] items-center justify-around border-t border-border bg-background/95 px-2 backdrop-blur md:hidden">
            {TABS.map((tab) => {
                const active = isActive(tab.href);
                const Icon = tab.icon;

                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                            "flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-muted-foreground transition-colors",
                            active ? "text-primary" : "hover:text-foreground"
                        )}
                    >
                        <Icon className="h-5 w-5 shrink-0" />
                        {active && <span className="truncate text-[11px] font-medium">{tab.label}</span>}
                    </Link>
                );
            })}
        </nav>
    );
}
