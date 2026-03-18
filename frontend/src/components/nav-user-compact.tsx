"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, SparklesIcon, BadgeCheckIcon, CreditCardIcon, BellIcon, LogOutIcon, UserIcon } from "lucide-react"

type NavUserCompactProps = {
  user: {
    name: string
    email: string
    avatar: string
  }
}

export function NavUserCompact({ user }: NavUserCompactProps) {
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === "collapsed"
  
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
                <Avatar className="h-5 w-5">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="text-xs">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                {!isCollapsed && (
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium truncate">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
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
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-xs">
                <SparklesIcon className="mr-2 h-3 w-3" />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-xs">
                <BadgeCheckIcon className="mr-2 h-3 w-3" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs">
                <CreditCardIcon className="mr-2 h-3 w-3" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs">
                <BellIcon className="mr-2 h-3 w-3" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs">
              <LogOutIcon className="mr-2 h-3 w-3" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}