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
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden">
            <div className="mx-auto grid w-full max-w-xl grid-cols-5 gap-1">
                {TABS.map((tab) => {
                    const active = isActive(tab.href);
                    const Icon = tab.icon;

                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={cn(
                                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors",
                                active ? "bg-primary/10 text-primary" : "hover:bg-accent/50 hover:text-foreground"
                            )}
                            aria-label={tab.label}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{tab.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
