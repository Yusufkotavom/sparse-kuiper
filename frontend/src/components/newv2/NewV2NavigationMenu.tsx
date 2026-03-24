"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NEWV2_MENU_ITEMS = [
  { href: "/newv2", label: "Overview" },
  { href: "/newv2/assets", label: "Assets" },
  { href: "/newv2/publisher", label: "Publisher" },
  { href: "/newv2/monitoring", label: "Monitoring" },
];

export function NewV2NavigationMenu() {
  const pathname = usePathname();

  return (
    <nav className="rounded-xl border border-border bg-surface/70 p-2">
      <div className="flex flex-wrap items-center gap-2">
        {NEWV2_MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: isActive ? "default" : "outline",
                })
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
