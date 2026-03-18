"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SegmentedTabItem<T extends string> = {
  value: T;
  label: string;
};

type SegmentedTabsProps<T extends string> = {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  itemClassName?: string;
  size?: "xs" | "sm" | "default";
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  itemClassName,
  size = "sm",
}: SegmentedTabsProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-1", className)}>
      {items.map((item) => (
        <Button
          key={item.value}
          size={size}
          variant={value === item.value ? "default" : "ghost"}
          onClick={() => onChange(item.value)}
          className={cn(
            "rounded-lg",
            value === item.value ? "shadow-sm shadow-primary/20" : "text-muted-foreground hover:text-foreground",
            itemClassName
          )}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
