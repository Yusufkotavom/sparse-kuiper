"use client";

import { createContext, useContext, useEffect, useState } from "react";

type SidebarState = "expanded" | "collapsed";

interface SidebarContextValue {
    state: SidebarState;
    toggle: () => void;
    isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextValue>({
    state: "expanded",
    toggle: () => {},
    isCollapsed: false,
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    // Read initial value synchronously from localStorage to avoid flash/mismatch
    const [state, setState] = useState<SidebarState>(() => {
        if (typeof window === "undefined") return "expanded";
        return (localStorage.getItem("sidebarState") as SidebarState) ?? "expanded";
    });

    useEffect(() => {
        localStorage.setItem("sidebarState", state);
    }, [state]);

    const toggle = () => {
        setState((s) => (s === "expanded" ? "collapsed" : "expanded"));
    };

    return (
        <SidebarContext.Provider value={{ state, toggle, isCollapsed: state === "collapsed" }}>
            {children}
        </SidebarContext.Provider>
    );
}

export const useSidebar = () => useContext(SidebarContext);
