"use client";

import { useSidebar } from "@/context/SidebarContext";
import { cn } from "@/lib/utils";

export function MainWrapper({ children }: { children: React.ReactNode }) {
    const { isCollapsed } = useSidebar();

    return (
        <main
            className={cn(
                "min-h-screen bg-background pt-[var(--topbar-h)] transition-all duration-300 ease-in-out",
                /* Padding Bottom for mobile tab bar */
                "pb-[calc(var(--bottomnav-h)+1rem)] md:pb-8",
                /* Left Margin for desktop sidebar */
                isCollapsed ? "md:ml-[var(--sidebar-collapsed-w)]" : "md:ml-[var(--sidebar-w)]"
            )}
        >
            <div className="px-[var(--section-px)] py-[var(--section-py)]">
                {children}
            </div>
        </main>
    );
}
