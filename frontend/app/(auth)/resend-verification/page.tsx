"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { AppLogo } from "@/components/AppLogo";
import { apiFetch } from "@/lib/api";

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

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
    <div className="flex min-h-svh flex-col items-center justify-center bg-white px-4 py-10">
      <div className="mb-8 text-center">
        <AppLogo variant="onLight" className="mx-auto h-9 w-auto max-w-[200px]" />
        <p className="mt-3 text-2xl" aria-hidden>
          ✉️
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-slate-900">
          Resend verification email
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          We&apos;ll send a new link if an account exists for this address.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-[#DC2626] text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Submit"}
          </button>
        </form>

        {ok ? (
          <p
            className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-800"
            role="status"
          >
            Check your inbox!
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <Link
          href="/login"
          className="mt-8 block text-center text-sm font-semibold text-[#DC2626] hover:underline"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
