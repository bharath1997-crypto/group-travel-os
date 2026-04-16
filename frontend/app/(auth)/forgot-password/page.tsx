"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AuthInput } from "@/components/auth/AuthInput";
import { GradientHeader } from "@/components/auth/GradientHeader";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitEmail() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submitEmail();
  }

  const mailIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );

  return (
    <div className="flex min-h-svh flex-col bg-slate-100">
      <GradientHeader
        gradient="linear-gradient(135deg, #E94560, #FF6B6B, #FF6B9D)"
        title=""
        subtitle={sent ? "We emailed you a link" : "Forgot Password?"}
        height={sent ? 100 : 120}
      />

      <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-3xl bg-white px-4 pb-10 pt-6 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] sm:mx-auto sm:mb-8 sm:max-w-lg sm:rounded-2xl sm:px-8">
        {!sent ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-[#1E3A5F]/85">
              Enter the email for your Travello account and we&apos;ll send you a reset link.
            </p>
            <AuthInput
              id="forgot-email"
              type="email"
              icon={mailIcon}
              placeholder="Email address"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
            {error ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#E94560] to-[#FF6B6B] py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="envelope-bob relative flex h-24 w-24 items-center justify-center">
              <style
                dangerouslySetInnerHTML={{
                  __html: `
@keyframes envelope-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.envelope-bob {
  animation: envelope-bob 2s ease-in-out infinite;
}
`,
                }}
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                className="h-20 w-20 text-[#E94560]"
                aria-hidden
              >
                <path
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#1E3A5F]">Check your inbox</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#1E3A5F]/80">
              We sent a reset link to <span className="font-semibold">{email}</span>
            </p>
            <button
              type="button"
              onClick={() => void submitEmail()}
              disabled={busy}
              className="mt-6 text-sm font-semibold text-[#667eea] underline-offset-4 hover:underline disabled:opacity-60"
            >
              Resend email
            </button>
            <Link
              href="/login"
              className="mt-4 text-sm font-semibold text-[#1E3A5F]/70 hover:text-[#1E3A5F]"
            >
              Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
