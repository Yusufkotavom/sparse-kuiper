import type { ReactNode } from "react";

import { NewV2NavigationMenu } from "@/components/newv2/NewV2NavigationMenu";

export default function NewV2Layout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-1 pb-8">
      <NewV2NavigationMenu />
      {children}
    </div>
  );
}
