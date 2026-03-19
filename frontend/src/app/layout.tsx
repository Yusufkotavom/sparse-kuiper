import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Kotacom",
  description: "Kotacom — automation suite untuk content pipeline: ideation, produksi, dan publish.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Toaster
          closeButton
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "system-toast",
              title: "system-toast-title",
              description: "system-toast-description",
              actionButton: "system-toast-action",
              cancelButton: "system-toast-cancel",
              closeButton: "system-toast-close",
            },
          }}
        />
        <Providers>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
