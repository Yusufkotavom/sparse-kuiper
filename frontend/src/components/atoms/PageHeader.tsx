"use client";

import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    badge?: string;
}

export function PageHeader({ title, description, actions, badge }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                    {badge && (
                        <span className="inline-flex items-center rounded-full border border-border bg-elevated px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {badge}
                        </span>
                    )}
                </div>
                {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
