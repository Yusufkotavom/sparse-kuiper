"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { HelpCircle, PencilLine } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
};

type SystemUiContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const SystemUiContext = createContext<SystemUiContextValue | null>(null);

export function SystemUiProvider({ children }: { children: React.ReactNode }) {
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const promptResolverRef = useRef<((value: string | null) => void) | null>(null);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const [promptState, setPromptState] = useState<(PromptOptions & { open: boolean }) | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const value = useMemo<SystemUiContextValue>(
    () => ({
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          confirmResolverRef.current = resolve;
          setConfirmState({ ...options, open: true });
        }),
      prompt: (options) =>
        new Promise<string | null>((resolve) => {
          promptResolverRef.current = resolve;
          setPromptValue(options.defaultValue ?? "");
          setPromptState({ ...options, open: true });
        }),
    }),
    []
  );

  const closeConfirm = (result: boolean) => {
    confirmResolverRef.current?.(result);
    confirmResolverRef.current = null;
    setConfirmState(null);
  };

  const closePrompt = (result: string | null) => {
    promptResolverRef.current?.(result);
    promptResolverRef.current = null;
    setPromptState(null);
    setPromptValue("");
  };

  return (
    <SystemUiContext.Provider value={value}>
      {children}

      <AlertDialog
        open={Boolean(confirmState?.open)}
        onOpenChange={(open) => {
          if (!open) closeConfirm(false);
        }}
      >
        <AlertDialogContent
          className="overflow-hidden border border-[color:color-mix(in_srgb,var(--border)_75%,white)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface)_90%,white)_0%,var(--background)_100%)] p-0 shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
          size="default"
        >
          <div className="h-1.5 bg-[linear-gradient(90deg,#0a84ff_0%,#63a9ff_100%)]" />
          <div className="p-5">
            <AlertDialogHeader className="items-start text-left">
              <AlertDialogMedia className="mb-3 size-11 rounded-xl bg-[color:color-mix(in_srgb,var(--primary)_18%,transparent)] text-primary ring-1 ring-[color:color-mix(in_srgb,var(--primary)_28%,transparent)]">
                <HelpCircle className="size-5" />
              </AlertDialogMedia>
              <AlertDialogTitle className="text-[15px] font-semibold tracking-tight">
                {confirmState?.title}
              </AlertDialogTitle>
              {confirmState?.description ? (
                <AlertDialogDescription className="text-sm leading-6">
                  {confirmState.description}
                </AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="border-t border-border/80 bg-[color:color-mix(in_srgb,var(--surface)_88%,transparent)] px-5 py-4">
            <AlertDialogCancel onClick={() => closeConfirm(false)}>
              {confirmState?.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeConfirm(true)}
              variant={confirmState?.destructive ? "destructive" : "default"}
            >
              {confirmState?.confirmLabel ?? "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(promptState?.open)}
        onOpenChange={(open) => {
          if (!open) closePrompt(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden border border-[color:color-mix(in_srgb,var(--border)_75%,white)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface)_90%,white)_0%,var(--background)_100%)] p-0 shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
        >
          <div className="h-1.5 bg-[linear-gradient(90deg,#0a84ff_0%,#63a9ff_100%)]" />
          <div className="space-y-4 p-5">
            <DialogHeader className="space-y-2">
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--primary)_18%,transparent)] text-primary ring-1 ring-[color:color-mix(in_srgb,var(--primary)_28%,transparent)]">
                <PencilLine className="size-5" />
              </div>
              <DialogTitle className="text-[15px] font-semibold tracking-tight">
                {promptState?.title}
              </DialogTitle>
              {promptState?.description ? (
                <DialogDescription className="text-sm leading-6">
                  {promptState.description}
                </DialogDescription>
              ) : null}
            </DialogHeader>
            <Input
              autoFocus
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              placeholder={promptState?.placeholder}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  closePrompt(promptValue.trim() || null);
                }
              }}
            />
          </div>
          <DialogFooter className="border-t border-border/80 bg-[color:color-mix(in_srgb,var(--surface)_88%,transparent)] px-5 py-4">
            <Button variant="outline" onClick={() => closePrompt(null)}>
              {promptState?.cancelLabel ?? "Cancel"}
            </Button>
            <Button onClick={() => closePrompt(promptValue.trim() || null)}>
              {promptState?.submitLabel ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SystemUiContext.Provider>
  );
}

export function useSystemUi() {
  const context = useContext(SystemUiContext);
  if (!context) {
    throw new Error("useSystemUi must be used within a SystemUiProvider");
  }
  return context;
}
