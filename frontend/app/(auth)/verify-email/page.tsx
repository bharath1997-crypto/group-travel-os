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

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
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
      ? "Invalid or expired verification link"
      : legacyErr === "missing_token"
        ? "The verification link was incomplete."
        : null,
  );
  const [user, setUser] = useState<UserOut | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendOk, setResendOk] = useState(false);
  const ranRef = useRef(false);

  const runVerify = useCallback(async (t: string) => {
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
  }, [router]);

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
@keyframes verify-pop {
  0% { opacity: 0; transform: scale(0.94); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes confetti-burst {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: var(--tx) scale(0.3); }
}
.verify-animate { animation: verify-pop 300ms ease-out forwards; }
.confetti-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  left: 50%;
  top: 50%;
  margin-left: -5px;
  margin-top: -5px;
  opacity: 0;
  animation: confetti-burst 1.5s ease-out forwards;
}
`,
        }}
      />

      <div className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-2 text-center verify-animate">
          <AppLogo variant="onLight" className="h-9 w-auto max-w-[200px]" />
          <span className="text-3xl" aria-hidden>
            ✈️
          </span>
        </div>

        <div
          className="verify-animate w-full max-w-md rounded-2xl bg-white p-12 shadow-sm ring-1 ring-slate-200/80"
          style={{ transition: "opacity 300ms, transform 300ms" }}
        >
          {view === "loading" ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div
                className="h-10 w-10 animate-spin rounded-full border-4 border-[#DC2626] border-t-transparent"
                style={{ width: 40, height: 40 }}
                aria-hidden
              />
              <p className="mt-6 text-center text-base text-gray-500">
                Verifying your email...
              </p>
            </div>
          ) : null}

          {view === "success" ? (
            <div className="relative flex flex-col items-center text-center">
              <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#22C55E] text-4xl text-white">
                ✓
                <span
                  className="confetti-dot bg-amber-400"
                  style={{ "--tx": "translate(48px, -72px)" } as React.CSSProperties}
                />
                <span
                  className="confetti-dot bg-pink-500"
                  style={{ animationDelay: "0.05s", "--tx": "translate(-52px, -60px)" } as React.CSSProperties}
                />
                <span
                  className="confetti-dot bg-sky-500"
                  style={{ animationDelay: "0.1s", "--tx": "translate(60px, 40px)" } as React.CSSProperties}
                />
                <span
                  className="confetti-dot bg-violet-500"
                  style={{ animationDelay: "0.12s", "--tx": "translate(-48px, 52px)" } as React.CSSProperties}
                />
                <span
                  className="confetti-dot bg-lime-400"
                  style={{ animationDelay: "0.08s", "--tx": "translate(0px, -80px)" } as React.CSSProperties}
                />
                <span
                  className="confetti-dot bg-red-400"
                  style={{ animationDelay: "0.15s", "--tx": "translate(-70px, 10px)" } as React.CSSProperties}
                />
                <span
                  className="confetti-dot bg-teal-400"
                  style={{ animationDelay: "0.18s", "--tx": "translate(72px, 8px)" } as React.CSSProperties}
                />
                <span
                  className="confetti-dot bg-orange-400"
                  style={{ animationDelay: "0.2s", "--tx": "translate(0px, 70px)" } as React.CSSProperties}
                />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Email verified!</h1>
              <p className="mt-3 text-base text-gray-500">
                Your Travello account is ready. Start planning your first trip!
              </p>
              {user?.email ? (
                <p className="mt-2 text-sm text-gray-400">{user.email}</p>
              ) : null}
              <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#DC2626] px-6 text-sm font-bold text-white shadow hover:opacity-95"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/profile"
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  Complete your profile
                </Link>
              </div>
            </div>
          ) : null}

          {view === "error" || view === "missing" ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl font-bold text-red-600">
                ✕
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {view === "missing" ? "No verification token" : "Link expired or invalid"}
              </h1>
              <p className="mt-3 text-base text-gray-500">
                {view === "missing"
                  ? "Open the link from your email, or request a new verification message below."
                  : errorMsg ?? "This link is no longer valid."}
              </p>

              <form
                onSubmit={onResend}
                className="mt-8 w-full space-y-3 text-left"
              >
                <label className="block text-sm font-medium text-slate-700">
                  Request new verification email
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20"
                  />
                </label>
                <button
                  type="submit"
                  disabled={resendBusy}
                  className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-[#DC2626] text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {resendBusy ? "Sending…" : "Send verification link"}
                </button>
              </form>
              {resendOk ? (
                <p className="mt-4 text-sm font-medium text-green-600" role="status">
                  Check your inbox for a new link
                </p>
              ) : null}
              <Link
                href="/login"
                className="mt-8 text-sm font-semibold text-slate-500 hover:text-slate-800"
              >
                ← Back to login
              </Link>
            </div>
          ) : null}
        </div>
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
