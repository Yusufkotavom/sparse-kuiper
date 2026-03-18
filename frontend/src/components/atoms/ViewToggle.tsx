 "use client";
 
 import { cn } from "@/lib/utils";
 import { Button } from "@/components/ui/button";
 import { LayoutGrid, List } from "lucide-react";
 
 type Mode = "list" | "grid";
 
 interface ViewToggleProps {
     value: Mode;
     onChange: (mode: Mode) => void;
     storageKey?: string;
     className?: string;
 }
 
 export function ViewToggle({ value, onChange, storageKey = "view-mode", className }: ViewToggleProps) {
     const setMode = (mode: Mode) => {
         onChange(mode);
         try {
             if (typeof window !== "undefined") {
                 localStorage.setItem(storageKey, mode);
             }
         } catch {}
     };
 
     return (
         <div className={cn("flex items-center gap-1 p-1 rounded-lg border border-border bg-elevated", className)}>
             <Button
                 variant={value === "list" ? "default" : "ghost"}
                 size="sm"
                 className={value === "list" ? "bg-zinc-700 text-white" : "text-zinc-400"}
                 onClick={() => setMode("list")}
                 aria-pressed={value === "list"}
                 title="List view"
             >
                 <List className="w-4 h-4 mr-1" /> List
             </Button>
             <Button
                 variant={value === "grid" ? "default" : "ghost"}
                 size="sm"
                 className={value === "grid" ? "bg-zinc-700 text-white" : "text-zinc-400"}
                 onClick={() => setMode("grid")}
                 aria-pressed={value === "grid"}
                 title="Grid view"
             >
                 <LayoutGrid className="w-4 h-4 mr-1" /> Grid
             </Button>
         </div>
     );
 }
