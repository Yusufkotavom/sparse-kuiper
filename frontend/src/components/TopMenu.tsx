"use client";

import { usePathname } from "next/navigation";
import { Bot, Wifi } from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/kdp": "KDP Coloring Studio",
  "/video": "Video Generator",
  "/video/muxing": "Video Muxing",
  "/scraper": "Web Scraper",
  "/runs": "Runs",
  "/publisher": "Publisher",
  "/accounts": "Accounts",
  "/drive": "Drive Explorer",
  "/settings": "Settings",
  "/logs": "System Logs",
};

export function TopMenu() {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();

  const title =
    Object.entries(pageTitles)
      .filter(([key]) => pathname === key || pathname.startsWith(key + "/"))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "AIO Super App";

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-14 z-30 flex items-center justify-between px-4 md:px-6 pl-14 md:pl-6 transition-all duration-300 ease-in-out",
        "bg-background/80 backdrop-blur",
        "border-b border-border",
        isCollapsed ? "md:left-[60px]" : "md:left-64",
        "left-0"
      )}
    >
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
          <Wifi className="w-3 h-3" />
          <span>API Online</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
          <Bot className="w-3 h-3" />
          <span>Idle</span>
        </div>
      </div>
    </header>
  );
}
