"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AppLogo } from "@/components/AppLogo";
import { apiFetch } from "@/lib/api";

type UserOut = {
  id: string;
  email: string;
  full_name: string;
  email_verified?: boolean;
  is_verified?: boolean;
};

type VerifySuccess = {
  message: string;
  user: UserOut;
};

type ViewState = "loading" | "success" | "error" | "missing";

const CONFETTI_COLORS = [
  "#dc2626",
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

function firstName(full: string | undefined): string {
  if (!full?.trim()) return "Traveler";
  return full.trim().split(/\s+/)[0] ?? "Traveler";
}

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const legacyVerified = searchParams.get("verified") === "1";
  const legacyErr = searchParams.get("error");

  const [view, setView] = useState<ViewState>(() => {
    if (legacyVerified) return "success";
    if (!token) return legacyErr ? "error" : "missing";
    return "loading";
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(() =>
    legacyErr === "invalid_or_expired"
      ? "Invalid or expired link"
      : legacyErr === "missing_token"
        ? "The verification link was incomplete."
        : null,
  );
  const [user, setUser] = useState<UserOut | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendOk, setResendOk] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p = localStorage.getItem("pending_verification_email");
      if (p) setResendEmail(p);
    } catch {
      /* ignore */
    }
  }, []);

  const runVerify = useCallback(
    async (t: string) => {
      setView("loading");
      setErrorMsg(null);
      try {
        const data = await apiFetch<VerifySuccess>("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token: t }),
        });
        setUser(data.user);
        setView("success");
        router.replace("/verify-email", { scroll: false });
      } catch (e) {
        setErrorMsg(extractErrorMessage(e));
        setView("error");
      }
    },
    [router],
  );

  useEffect(() => {
    if (legacyVerified) {
      setView("success");
      router.replace("/verify-email", { scroll: false });
      return;
    }
    if (!token) {
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;
    void runVerify(token);
  }, [token, legacyVerified, router, runVerify]);

  async function onResend(e: React.FormEvent) {
    e.preventDefault();
    setResendOk(false);
    setResendBusy(true);
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      setResendOk(true);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes verify-plane-fly {
  0% { transform: translateX(-20px) rotate(-5deg); opacity: 0; }
  50% { transform: translateX(0) rotate(0deg); opacity: 1; }
  100% { transform: translateX(20px) rotate(5deg); opacity: 0; }
}
.verify-plane { animation: verify-plane-fly 1.5s ease-in-out infinite; }
@keyframes verify-dots { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }
.verify-dot-1 { animation: verify-dots 1.2s ease-in-out infinite; }
.verify-dot-2 { animation: verify-dots 1.2s ease-in-out 0.2s infinite; }
.verify-dot-3 { animation: verify-dots 1.2s ease-in-out 0.4s infinite; }
@keyframes verify-check-pop {
  0% { transform: scale(0); }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
.verify-check-pop { animation: verify-check-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes confetti-burst {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: var(--burst) scale(0.3); }
}
.confetti-piece {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 9999px;
  margin-left: -6px;
  margin-top: -6px;
  opacity: 0;
  animation: confetti-burst 1.5s ease-out forwards;
}
`,
        }}
      />

      <header className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
        <AppLogo variant="onLight" className="h-8 w-auto max-w-[180px]" />
        <span className="text-2xl" aria-hidden>
          ✈️
        </span>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-73px)] max-w-md flex-col justify-center px-4 py-8">
        {view === "loading" ? (
          <div className="flex flex-col items-center text-center">
            <svg
              className="verify-plane h-16 w-16 text-slate-800"
              viewBox="0 0 64 64"
              fill="currentColor"
              aria-hidden
            >
              <path d="M52 8L28 32l-8-4-8 4 12 12-4 8 20-8 12-20-8-4zm-4 4l-6 10-4-2 10-6-4-2z" />
            </svg>
            <p className="mt-6 text-lg font-medium text-slate-600">
              Verifying your email
              <span className="inline-block w-6 text-left">
                <span className="verify-dot-1">.</span>
                <span className="verify-dot-2">.</span>
                <span className="verify-dot-3">.</span>
              </span>
            </p>
          </div>
        ) : null}

        {view === "success" ? (
          <div className="w-full">
            <div
              className="relative overflow-hidden rounded-2xl px-6 py-10 text-center"
              style={{
                background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
              }}
            >
              <div className="relative inline-flex">
                <div
                  className="verify-check-pop flex h-24 w-24 items-center justify-center rounded-full bg-[#22C55E] text-white shadow-lg"
                >
                  <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {[
                  "translate(48px, -72px)",
                  "translate(-52px, -60px)",
                  "translate(60px, 40px)",
                  "translate(-48px, 52px)",
                  "translate(0px, -80px)",
                  "translate(-70px, 10px)",
                  "translate(72px, 8px)",
                  "translate(0px, 70px)",
                  "translate(-36px, -48px)",
                  "translate(40px, 56px)",
                  "translate(-60px, 24px)",
                  "translate(28px, -36px)",
                ].map((burst, i) => (
                  <span
                    key={i}
                    className="confetti-piece pointer-events-none h-2.5 w-2.5 md:h-3 md:w-3"
                    style={
                      {
                        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                        animationDelay: `${i * 0.04}s`,
                        ["--burst" as string]: burst,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
              <h1 className="mt-6 text-[28px] font-bold text-[#15803D]">Email verified!</h1>
              <p className="mt-2 text-base text-[#166534]">
                Welcome to Travello, {firstName(user?.full_name)}!
              </p>
            </div>
            <div className="mt-8 flex gap-3">
              {[
                { icon: "✈️", label: "Plan trips" },
                { icon: "👥", label: "Invite friends" },
                { icon: "💰", label: "Split costs" },
              ].map((c) => (
                <div
                  key={c.label}
                  className="flex flex-1 flex-col items-center rounded-xl border border-slate-200 bg-white py-4 text-center"
                >
                  <span className="text-xl" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">{c.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#DC2626] text-sm font-semibold text-white transition hover:opacity-95"
              >
                Start planning →
              </Link>
              <Link
                href="/profile"
                className="flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-[#DC2626] bg-white text-sm font-semibold text-[#DC2626] transition hover:bg-red-50"
              >
                Complete your profile
              </Link>
            </div>
          </div>
        ) : null}

        {view === "error" || view === "missing" ? (
          <div className="w-full max-w-md">
            <div className="rounded-2xl bg-[#fef2f2] px-6 py-10 text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#ef4444] text-4xl font-bold text-white">
                ×
              </div>
              <h1 className="mt-6 text-2xl font-bold text-[#991b1b]">
                {view === "missing" ? "No verification token" : "Link expired"}
              </h1>
              <p className="mt-3 text-[15px] text-[#b91c1c]">
                {view === "missing"
                  ? "Open the link from your email, or request a new verification message below."
                  : errorMsg ?? "This link is no longer valid."}
              </p>
            </div>

            <p className="mt-6 text-center text-base text-slate-500">
              Get a new verification link
            </p>
            <form onSubmit={onResend} className="mt-3 space-y-3">
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20"
              />
              <button
                type="submit"
                disabled={resendBusy}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#DC2626] text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
              >
                {resendBusy ? "Sending…" : "Resend email"}
              </button>
            </form>
            {resendOk ? (
              <div
                className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800"
                role="status"
              >
                Check your inbox! New link sent to {resendEmail}
              </div>
            ) : null}
            <Link
              href="/login"
              className="mt-8 block text-center text-sm text-slate-500 hover:text-slate-800"
            >
              Back to login
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-white">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-[#DC2626] border-t-transparent"
            style={{ width: 40, height: 40 }}
          />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
