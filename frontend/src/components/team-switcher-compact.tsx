"use client"

import * as React from "react"
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon } from "lucide-react"

type Team = {
  name: string
  logo: React.ReactNode
  plan: string
}

type TeamSwitcherCompactProps = {
  teams: Team[]
}

export function TeamSwitcherCompact({ teams }: TeamSwitcherCompactProps) {
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const [activeTeam, setActiveTeam] = React.useState(teams[0])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton 
                size="sm" 
                className="h-8 px-2 aria-expanded:bg-muted group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
              >
                <div className="flex aspect-square size-5 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  {activeTeam.logo}
                </div>
                
                {!isCollapsed && (
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium truncate">{activeTeam.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{activeTeam.plan}</p>
                  </div>
                )}
                
                {!isCollapsed && <ChevronsUpDownIcon className="h-3 w-3" />}
              </SidebarMenuButton>
            }
          />
          
          <DropdownMenuContent
            className="min-w-48 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs">Teams</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => setActiveTeam(team)}
                className="text-xs gap-2"
              >
                <div className="flex size-4 items-center justify-center rounded-sm border">
                  {team.logo}
                </div>
                {team.name}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {team.plan}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}