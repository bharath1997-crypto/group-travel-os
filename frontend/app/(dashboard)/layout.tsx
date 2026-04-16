import type { ReactNode } from "react";

import { DashboardShell } from "@/components/DashboardShell";
import { DashboardUserProvider } from "@/contexts/dashboard-user-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardUserProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardUserProvider>
  );
}
