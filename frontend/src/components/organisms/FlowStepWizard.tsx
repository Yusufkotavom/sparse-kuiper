"use client";

import { type LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/atoms/StatusBadge";

export type FlowStepItem = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  hint?: string;
  required?: boolean;
  completed?: boolean;
};

type FlowStepWizardProps = {
  steps: FlowStepItem[];
  columnsClassName?: string;
};

export function FlowStepWizard({ steps, columnsClassName = "md:grid-cols-4" }: FlowStepWizardProps) {
  return (
    <div className={`grid gap-3 ${columnsClassName}`}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const status = step.completed ? "completed" : step.required ? "active" : "pending";
        return (
          <Card key={step.id} className="border-border bg-surface/70">
            <CardHeader className="pb-2">
              <CardDescription>Step {index + 1}</CardDescription>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4" /> {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{step.description}</p>
              {(step.hint || step.required) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {step.hint ? (
                    <>
                      Label: <span className="font-medium text-foreground">{step.hint}</span>
                    </>
                  ) : null}
                </p>
              )}
              <div className="mt-2">
                <StatusBadge status={status} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
