import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-white pb-8 text-neutral-900">{children}</div>
  );
}
