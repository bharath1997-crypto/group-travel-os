"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LogOut, Compass, ArrowRight } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { clearLocalProfileCache } from "@/lib/profileCache";
import {
  authLinkClass,
  authPrimaryBtnClass,
  AUTH_FORM_MAX_TAB,
} from "@/components/auth/AuthExploreLayout";

function TravelBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[#F0FDFA] via-[#F8FAFC] to-[#ECFEFF]" />
      <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-[#99F6E4]/30 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[#0F766E]/10 blur-3xl" />
    </div>
  );
}

export default function LogoutPage() {
  useEffect(() => {
    clearToken();
    clearLocalProfileCache();
    if (typeof window !== "undefined") {
      localStorage.removeItem("gt_user_name");
    }
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col text-stone-800">
      <TravelBackground />

      <header className="relative z-10 flex h-14 items-center justify-center border-b border-stone-200/60 bg-white/70 px-4 backdrop-blur-md">
        <Link href="/explore" className="text-sm font-semibold text-[#0F766E] hover:text-[#0D635C]">
          Back to Explore
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className={`w-full ${AUTH_FORM_MAX_TAB} rounded-2xl border border-stone-200/80 bg-white p-8 shadow-lg shadow-stone-900/5 text-center sm:p-10`}>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#0F766E]">
            <LogOut size={26} strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight sm:text-2xl">
            You&apos;ve signed out
          </h1>
          <p className="mt-2 text-sm text-stone-500 leading-relaxed">
            Thanks for using Rovvy. Sign in again anytime to continue planning group adventures.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link href="/login" className={`${authPrimaryBtnClass} no-underline`}>
              Sign in again
            </Link>
            <Link
              href="/explore"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
            >
              <Compass size={16} />
              Continue exploring
              <ArrowRight size={14} />
            </Link>
          </div>

          <p className="mt-6 text-xs text-stone-500">
            New to Rovvy?{" "}
            <Link href="/register" className={authLinkClass}>
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
