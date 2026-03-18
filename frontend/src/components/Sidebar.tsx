"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    BookOpen, Youtube, Globe, Settings, Zap, Wand2, Image as ImageIcon,
    ChevronDown, Share2, ListPlus, Terminal, Menu, X, Scissors,
    PanelLeftClose, PanelLeftOpen, Sun, Moon, Volume2, Layout, LayoutDashboard,
    ListOrdered
} from "lucide-react";
import { useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useTheme } from "@/context/ThemeContext";

interface NavItem {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
    disabled?: boolean;
    children?: NavItem[];
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        label: "Dashboard",
        items: [
            { label: "Dashboard", icon: LayoutDashboard, href: "/" },
        ],
    },
    {
        label: "Create",
        items: [
            {
                label: "Book & KDP",
                icon: BookOpen,
                href: "/kdp",
                children: [
                    { label: "Ideation", icon: Wand2, href: "/kdp/ideation" },
                    { label: "Curation", icon: ImageIcon, href: "/kdp/curation" },
                ],
            },
            {
                label: "Video Gen",
                icon: Youtube,
                href: "/video",
                children: [
                    { label: "Ideation", icon: Wand2, href: "/video/ideation" },
                    { label: "Curation", icon: ImageIcon, href: "/video/curation" },
                    { label: "Muxing", icon: Scissors, href: "/video/muxing" },
                    { label: "Creator Studio", icon: Layout, href: "/video/creator-studio" },
                ],
            },
            {
                label: "Audio Gen",
                icon: Volume2,
                href: "/audio",
                children: [
                    { label: "Kokoro TTS", icon: Wand2, href: "/audio/kokoro" },
                ],
            },
            {
                label: "Scraper",
                icon: Globe,
                href: "/scraper",
            },
        ],
    },
    {
        label: "Operate",
        items: [
            {
                label: "Project Manager",
                icon: ListPlus,
                href: "/project-manager",
            },
            {
                label: "Runs",
                icon: ListOrdered,
                href: "/runs",
            },
            {
                label: "Queue Builder",
                icon: Share2,
                href: "/publisher",
            },
        ],
    },
    {
        label: "Assets",
        items: [
            {
                label: "Drive Explorer",
                icon: BookOpen,
                href: "/drive",
            },
        ],
    },
    {
        label: "Settings",
        items: [
            {
                label: "Settings",
                icon: Settings,
                href: "/settings",
            },
            {
                label: "System Logs",
                icon: Terminal,
                href: "/logs",
            },
        ],
    },

];

export function Sidebar() {
    const pathname = usePathname();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ "/kdp": true, "/video": true, "/audio": true });
    const [mobileOpen, setMobileOpen] = useState(false);
    const { isCollapsed, toggle } = useSidebar();
    const { theme, toggleTheme } = useTheme();

    const toggleGroup = (href: string) => {
        setExpandedGroups((prev) => ({ ...prev, [href]: !prev[href] }));
    };

    const sidebarWidth = isCollapsed ? "w-[60px]" : "w-64";
    const isItemActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

    const renderNavItem = (item: NavItem) => {
        const isActive = isItemActive(item.href);
        const Icon = item.icon;
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedGroups[item.href] ?? isActive;

        if (hasChildren) {
            if (isCollapsed) {
                return (
                    <div key={item.href} className="relative group/tooltip">
                        <button
                            onClick={() => toggleGroup(item.href)}
                            className={cn(
                                "w-full flex items-center justify-center p-2.5 rounded-lg transition-all duration-150",
                                isActive
                                    ? "bg-primary/20 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                        >
                            <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                        </button>
                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg border border-border">
                            {item.label}
                        </div>
                        {isExpanded && (
                            <div className="absolute left-full top-0 ml-1.5 bg-card border border-border rounded-lg shadow-xl py-1.5 min-w-[140px] z-50">
                                {item.children!.map((child) => {
                                    const isChildActive = pathname === child.href;
                                    const ChildIcon = child.icon;
                                    return (
                                        <Link
                                            key={child.href}
                                            href={child.href}
                                            className={cn(
                                                "flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all",
                                                isChildActive
                                                    ? "text-primary bg-primary/10"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                            )}
                                        >
                                            <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                                            <span>{child.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div key={item.href}>
                    <button
                        onClick={() => toggleGroup(item.href)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                            isActive
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                    >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                            className={cn(
                                "w-3.5 h-3.5 transition-transform duration-200 shrink-0",
                                isExpanded && "rotate-180"
                            )}
                        />
                    </button>
                    {isExpanded && (
                        <div className="ml-4 pl-3 border-l border-border space-y-0.5 mt-0.5 mb-1">
                            {item.children!.map((child) => {
                                const isChildActive = pathname === child.href;
                                const ChildIcon = child.icon;
                                return (
                                    <Link
                                        key={child.href}
                                        href={child.href}
                                        className={cn(
                                            "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150",
                                            isChildActive
                                                ? "bg-primary/20 text-primary"
                                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        )}
                                    >
                                        <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                                        <span>{child.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }

        if (isCollapsed) {
            return (
                <div key={item.href} className="relative group/tooltip">
                    <Link
                        href={item.disabled ? "#" : item.href}
                        className={cn(
                            "flex items-center justify-center p-2.5 rounded-lg transition-all duration-150",
                            isActive
                                ? "bg-primary/20 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent",
                            item.disabled && "opacity-40 cursor-not-allowed"
                        )}
                    >
                        <Icon className="w-[18px] h-[18px]" />
                    </Link>
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg border border-border">
                        {item.label}
                        {item.disabled && <span className="ml-1 text-muted-foreground">Soon</span>}
                    </div>
                </div>
            );
        }

        return (
            <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    item.disabled && "cursor-not-allowed opacity-40"
                )}
            >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.disabled && (
                    <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        Soon
                    </span>
                )}
            </Link>
        );
    };

    return (
        <>
            {/* Mobile toggle button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed top-2 left-2 z-50 p-2 text-muted-foreground hover:text-foreground bg-surface rounded-lg border border-border"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 h-full bg-background border-r border-border flex flex-col z-50 transition-all duration-300 ease-in-out md:translate-x-0 outline-none overflow-hidden",
                    sidebarWidth,
                    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                {/* Logo / Brand */}
                <div className={cn(
                    "flex items-center border-b border-border shrink-0 transition-all duration-300",
                    isCollapsed ? "justify-center px-0 py-4" : "justify-between px-5 py-4"
                )}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
                                <Zap className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground tracking-tight whitespace-nowrap">AIO Super App</p>
                                <p className="text-[10px] text-muted-foreground whitespace-nowrap">Automation Command Center</p>
                            </div>
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
                            <Zap className="w-4 h-4 text-primary-foreground" />
                        </div>
                    )}
                    {/* Mobile close */}
                    {mobileOpen && !isCollapsed && (
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="md:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className={cn("flex-1 py-4 overflow-y-auto overflow-x-hidden", isCollapsed ? "px-1.5" : "px-3")}>
                    {NAV_GROUPS.map((group, index) => (
                        <div
                            key={group.label}
                            className={cn(
                                "space-y-0.5",
                                !isCollapsed && index > 0 && "mt-3 pt-3 border-t border-border/60"
                            )}
                        >
                            {!isCollapsed && (
                                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    {group.label}
                                </p>
                            )}
                            {group.items.map((item) => renderNavItem(item))}
                        </div>
                    ))}
                </nav>

                {/* Footer: theme toggle + collapse button */}
                <div className={cn(
                    "border-t border-border shrink-0 transition-all duration-300",
                    isCollapsed ? "px-1.5 py-3 flex flex-col items-center gap-2" : "px-3 py-3 flex items-center justify-between"
                )}>
                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        className={cn(
                            "flex items-center gap-2 rounded-lg text-xs font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-accent",
                            isCollapsed ? "p-2.5 justify-center" : "px-2 py-2 flex-1"
                        )}
                    >
                        {theme === "dark" ? (
                            <Sun className="w-4 h-4 shrink-0 text-amber-500" />
                        ) : (
                            <Moon className="w-4 h-4 shrink-0 text-primary" />
                        )}
                        {!isCollapsed && (
                            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                        )}
                    </button>

                    {/* Collapse toggle — desktop only */}
                    <button
                        onClick={toggle}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className={cn(
                            "hidden md:flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all",
                            isCollapsed ? "p-2.5" : "p-2"
                        )}
                    >
                        {isCollapsed ? (
                            <PanelLeftOpen className="w-4 h-4" />
                        ) : (
                            <PanelLeftClose className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </aside>
        </>
    );
}
