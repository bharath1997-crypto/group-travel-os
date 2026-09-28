import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-app pb-8 text-text">{children}</div>
  );
}
