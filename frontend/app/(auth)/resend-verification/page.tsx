"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { AppLogo } from "@/components/AppLogo";
import { apiFetch } from "@/lib/api";

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p = localStorage.getItem("pending_verification_email");
      if (p) setEmail(p);
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setBusy(true);
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center bg-white px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <AppLogo variant="onLight" className="h-9 w-auto max-w-[200px]" />
        </div>

        {!ok ? (
          <>
            <div className="flex justify-center text-[#DC2626]" aria-hidden>
              <svg
                className="h-16 w-16"
                viewBox="0 0 64 64"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <rect x="8" y="16" width="48" height="36" rx="4" />
                <path d="M8 20 L32 38 L56 20" strokeLinejoin="round" />
                <path
                  d="M22 8 L28 16 M36 10 L40 18 M46 8 L50 14"
                  className="opacity-60"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">
              Didn&apos;t get the email?
            </h1>
            <p className="mt-2 text-center text-slate-500">
              Enter your email and we&apos;ll send a new verification link
            </p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#DC2626] text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send new link"}
              </button>
            </form>
            {error ? (
              <p className="mt-4 text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </>
        ) : (
          <div
            className="flex flex-col items-center text-center"
            style={{ animation: "fadeSlide 0.45s ease-out" }}
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `
@keyframes fadeSlide {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`,
              }}
            />
            <div className="text-[#22c55e]" aria-hidden>
              <svg className="mx-auto h-20 w-20" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="18" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
                <path d="M8 22 L32 36 L56 22" stroke="currentColor" strokeWidth="2" />
                <circle cx="48" cy="14" r="3" fill="currentColor" opacity="0.5" />
                <circle cx="40" cy="10" r="2" fill="currentColor" opacity="0.4" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#15803D]">Check your inbox!</h2>
            <span className="mt-3 inline-flex rounded-full bg-[#f0fdf4] px-4 py-2 text-sm font-semibold text-[#166534]">
              {email}
            </span>
            <p className="mt-3 text-[13px] text-slate-500">Link expires in 24 hours</p>
            <Link
              href="/login"
              className="mt-8 text-sm font-semibold text-[#DC2626] hover:underline"
            >
              Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
