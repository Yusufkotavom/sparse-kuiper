"use client"

import * as React from "react"
import { AudioLinesIcon, BookOpenIcon, BotIcon, GalleryVerticalEndIcon, SettingsIcon, TerminalIcon, WandSparklesIcon } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { TeamSwitcherCompact } from "@/components/team-switcher-compact"
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Admin User",
    email: "admin@nomad-hub.local",
    avatar: "",
  },
  teams: [
    { name: "Nomad Hub", logo: <GalleryVerticalEndIcon />, plan: "Core" },
    { name: "AIO Tools", logo: <AudioLinesIcon />, plan: "Automation" },
    { name: "Ops Team", logo: <TerminalIcon />, plan: "Internal" },
  ],
  navMain: [
    {
      title: "Create",
      url: "/ideation",
      icon: <WandSparklesIcon />,
      isActive: true,
      items: [
        { title: "Ideation Hub", url: "/ideation" },
        { title: "Video Prompt Builder", url: "/video/ideation" },
        { title: "Curation Hub", url: "/curation" },
        { title: "Video Curation Workspace", url: "/video/curation" },
        { title: "Image Prompt Builder", url: "/kdp/ideation" },
        { title: "Image Curation Workspace", url: "/kdp/curation" },
        { title: "Audio Kokoro", url: "/audio/kokoro" },
        { title: "Scraper", url: "/scraper" },
        { title: "Pipeline Templates", url: "/pipeline-templates" },
      ],
    },
    {
      title: "Operate",
      url: "/runs",
      icon: <BotIcon />,
      items: [
        { title: "Dashboard", url: "/" },
        { title: "Runs", url: "/runs" },
        { title: "Project Manager", url: "/project-manager" },
        { title: "Looper Studio", url: "/looper" },
      ],
    },
    {
      title: "Assets",
      url: "/drive",
      icon: <BookOpenIcon />,
      items: [
        { title: "Drive Explorer", url: "/drive" },
        { title: "Published", url: "/published" },
        { title: "Accounts", url: "/accounts" },
      ],
    },
    {
      title: "Settings",
      url: "/settings",
      icon: <SettingsIcon />,
      items: [
        { title: "Settings", url: "/settings" },
        { title: "System Logs", url: "/logs" },
        { title: "Docs", url: "/docs" },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-2">
        <TeamSwitcherCompact teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
