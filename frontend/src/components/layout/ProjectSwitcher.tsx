"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  Check, 
  ChevronsUpDown, 
  PlusCircle, 
  Video, 
  ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { videoApi, kdpApi } from "@/lib/api";

type ProjectSwitcherItem = {
  name: string;
  type: "video" | "kdp";
};

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSwitcherItem[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  // Determine current project from URL if any
  const projectMatch = pathname.match(/\/project-manager\/([^\/]+)/);
  const currentProjectName = projectMatch ? projectMatch[1] : null;

  useEffect(() => {
    async function loadProjects() {
      try {
        const [vids, kdps] = await Promise.all([
          videoApi.listProjects().catch(() => []),
          kdpApi.listProjects().catch(() => []),
        ]);
        
        const allProjects: ProjectSwitcherItem[] = [
          ...vids.map((p) => ({ name: p, type: "video" as const })),
          ...kdps.map((p) => ({ name: p, type: "kdp" as const })),
        ];
        setProjects(allProjects);
      } catch {}
    }
    loadProjects();
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between h-8 text-xs border-border bg-surface hover:bg-elevated"
          />
        }
      >
        <div className="flex items-center gap-2 truncate">
          {currentProjectName ? (
            <>
              <div className="w-4 h-4 rounded-sm bg-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">
                {projects.find(p => p.name === currentProjectName)?.type === "video" ? "V" : "K"}
              </div>
              <span className="truncate">{currentProjectName}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select project...</span>
          )}
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[260px] bg-surface border-border text-foreground">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Video Projects</DropdownMenuLabel>
          {projects.filter((p) => p.type === "video").map((project) => (
            <DropdownMenuItem
              key={project.name}
              onClick={() => {
                router.push(`/project-manager/${project.name}`);
                setOpen(false);
              }}
              className="text-xs cursor-pointer"
            >
              <Video className="mr-2 h-3.5 w-3.5 text-rose-500" />
              <span className="truncate flex-1">{project.name}</span>
              <Check className={cn("ml-auto h-3.5 w-3.5", currentProjectName === project.name ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Image Creation Projects</DropdownMenuLabel>
          {projects.filter((p) => p.type === "kdp").map((project) => (
            <DropdownMenuItem
              key={project.name}
              onClick={() => {
                router.push(`/project-manager/${project.name}`);
                setOpen(false);
              }}
              className="text-xs cursor-pointer"
            >
              <ImageIcon className="mr-2 h-3.5 w-3.5 text-amber-500" />
              <span className="truncate flex-1">{project.name}</span>
              <Check className={cn("ml-auto h-3.5 w-3.5", currentProjectName === project.name ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={() => {
            router.push("/video/creator-studio");
            setOpen(false);
          }}
          className="text-xs cursor-pointer"
        >
          <PlusCircle className="mr-2 h-3.5 w-3.5" />
          Create New Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
