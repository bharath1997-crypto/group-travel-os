"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Fades and lifts page content in when the route changes. Keyed on the pathname only, so
 * query-string changes on the same page (filters, tabs) do not replay it. Motion rules live in
 * globals.css (.rovvy-page-enter); reduced motion is handled by the global media query there.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="rovvy-page-enter w-full">
      {children}
    </div>
  );
}
