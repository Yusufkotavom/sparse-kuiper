"use client";

import { ThemeProvider } from "@/context/ThemeContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { SystemUiProvider } from "@/components/system/SystemUiProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <SystemUiProvider>
                <SidebarProvider>
                    {children}
                </SidebarProvider>
            </SystemUiProvider>
        </ThemeProvider>
    );
}
