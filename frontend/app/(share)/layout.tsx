import Link from "next/link";
import type { ReactNode } from "react";

import { AppLogo } from "@/components/AppLogo";

/**
 * Minimal shell for shareable pages (trip preview) so they work without a login.
 */
export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-block outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            <AppLogo variant="onLight" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/login"
              className="font-medium text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
