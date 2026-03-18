"use client";

import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
    secondaryAction?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction }: EmptyStateProps) {
    return (
        <div className="rounded-xl border border-dashed border-border bg-elevated/40 py-16 text-center">
            <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/70" />
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description && <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>}
            {(action || secondaryAction) && (
                <div className="mt-4 flex items-center justify-center gap-2">
                    {action ? (
                        <Button onClick={action.onClick} variant="default" size="sm">
                            {action.label}
                        </Button>
                    ) : null}
                    {secondaryAction ? (
                        <Button onClick={secondaryAction.onClick} variant="outline" size="sm">
                            {secondaryAction.label}
                        </Button>
                    ) : null}
                </div>
            )}
        </div>
    );
}
