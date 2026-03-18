"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string | number;
  valueClassName?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function KpiCard({ label, value, valueClassName, className, size = "md" }: KpiCardProps) {
  const sizeClasses = {
    sm: "p-3",
    md: "p-4", 
    lg: "p-6"
  };
  
  const labelSizes = {
    sm: "text-[10px]",
    md: "text-xs", 
    lg: "text-sm"
  };
  
  const valueSizes = {
    sm: "text-lg",
    md: "text-2xl", 
    lg: "text-3xl"
  };

  return (
    <Card className={cn("border-border bg-surface", className)}>
      <CardContent className={cn(sizeClasses[size])}>
        <p className={cn("font-semibold uppercase tracking-wide text-muted-foreground", labelSizes[size])}>
          {label}
        </p>
        <p className={cn("mt-1 font-bold text-foreground", valueSizes[size], valueClassName)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}