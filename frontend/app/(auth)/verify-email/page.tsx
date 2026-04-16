"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AppLogo } from "@/components/AppLogo";
import { apiFetch } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { requestVerificationEmail } from "@/lib/verification";

type Me = {
  full_name: string;
  email: string;
  is_verified?: boolean;
};

const successGradient = "linear-gradient(135deg, #11998e, #38ef7d)";
const errorGradient = "linear-gradient(135deg, #f5576c, #f093fb)";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errParam = searchParams.get("error");
  const isVerifyCallback =
    searchParams.get("verified") === "1" ||
    errParam === "invalid_or_expired" ||
    errParam === "missing_token";

  useEffect(() => {
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<Me>("/auth/me");
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const verified = searchParams.get("verified");
    const err = searchParams.get("error");
    if (verified === "1") {
      setBanner({
        kind: "success",
        text: isLoggedIn()
          ? "Your email is verified. You can continue using the app."
          : "Your email is verified. Sign in with your password to continue.",
      });
      void (async () => {
        if (isLoggedIn()) {
          try {
            const me = await apiFetch<Me>("/auth/me");
            setUser(me);
          } catch {
            /* ignore */
          }
        }
        router.replace("/verify-email", { scroll: false });
      })();
      return;
    }
    if (err === "invalid_or_expired") {
      setBanner({
        kind: "error",
        text: "That verification link is invalid or has expired. Request a new one below if you're signed in.",
      });
      router.replace("/verify-email", { scroll: false });
      return;
    }
    if (err === "missing_token") {
      setBanner({
        kind: "error",
        text: "The verification link was incomplete. Use Resend below if you're signed in.",
      });
      router.replace("/verify-email", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (loading) return;
    if (!user?.is_verified) return;
    if (searchParams.get("verified") || searchParams.get("error")) return;
    router.replace("/dashboard");
  }, [loading, user, router, searchParams]);

  async function onResend() {
    setStatus(null);
    setBusy(true);
    try {
      const r = await requestVerificationEmail();
      setStatus(
        r.ok
          ? "Check your inbox for a verification link. It may take a minute to arrive."
          : r.message ??
              "Verification email could not be sent. Check that the server has SMTP configured.",
      );
      await apiFetch<Me>("/auth/me").then(setUser).catch(() => {});
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "Could not send email right now. Try again later.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !isVerifyCallback && !banner) {
    return (
      <div className="flex min-h-svh flex-col bg-slate-100">
        <div
          className="flex min-h-[120px] items-center justify-center rounded-b-3xl text-white"
          style={{ background: successGradient }}
        >
          <p className="text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (user?.is_verified) {
    return (
      <div className="flex min-h-svh flex-col bg-slate-100">
        <div
          className="flex min-h-[100px] items-center justify-center rounded-b-3xl text-white"
          style={{ background: successGradient }}
        >
          <p className="text-sm font-medium">Redirecting…</p>
        </div>
      </div>
    );
  }

  const hasSession = isLoggedIn();
  const accountReady = user !== null;
  const waitingForAccount = hasSession && !accountReady && loading;
  const loggedIn = Boolean(user && hasSession);

  const headerStyle =
    banner?.kind === "error" ? errorGradient : successGradient;

  return (
    <div className="flex min-h-svh flex-col bg-slate-100">
      <div
        className="relative flex min-h-[140px] flex-col items-center justify-center rounded-b-3xl px-4 pb-8 pt-10 text-center text-white shadow-lg"
        style={{ background: headerStyle }}
      >
        {banner?.kind === "success" ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/25 text-3xl shadow-inner" aria-hidden>
            ✓
          </div>
        ) : banner?.kind === "error" ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/25 text-3xl font-bold shadow-inner" aria-hidden>
            ✕
          </div>
        ) : (
          <AppLogo variant="onLight" className="h-9 w-auto max-w-[200px]" />
        )}
        <h1 className="mt-4 text-lg font-bold leading-snug">
          {banner?.kind === "success"
            ? "Email verified! Welcome to Travello"
            : banner?.kind === "error"
              ? "Verification issue"
              : "Verify your email"}
        </h1>
      </div>

      <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-3xl bg-white px-4 pb-10 pt-6 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] sm:mx-auto sm:mb-8 sm:max-w-lg sm:rounded-2xl sm:px-8">
        {banner && banner.kind === "error" ? (
          <div
            role="status"
            className="rounded-2xl border border-red-100 bg-red-50/90 px-3 py-2.5 text-sm leading-relaxed text-red-900"
          >
            {banner.text}
          </div>
        ) : null}

        {banner?.kind === "success" ? (
          <p className="text-center text-sm leading-relaxed text-[#1E3A5F]/85">{banner.text}</p>
        ) : null}

        {waitingForAccount && (isVerifyCallback || banner) ? (
          <p className="mt-4 text-center text-sm text-[#1E3A5F]/80">Loading your account…</p>
        ) : loggedIn ? (
          <>
            {!banner ? (
              <>
                <p className="text-center text-sm leading-relaxed text-[#1E3A5F]/85">
                  We&apos;ll use <span className="font-semibold">{user?.email}</span> to secure your account.
                  Complete verification to unlock all features.
                </p>
                <p className="mt-3 text-center text-sm text-[#1E3A5F]/80">
                  Open the link we send to your inbox. You can resend if you didn&apos;t get the message.
                </p>
              </>
            ) : null}
            {banner?.kind === "success" ? (
              <Link
                href="/dashboard"
                className="mt-6 flex w-full items-center justify-center rounded-2xl py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95"
                style={{ background: successGradient }}
              >
                Go to dashboard
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onResend}
                className="mt-6 w-full rounded-2xl py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
                style={{ background: successGradient }}
              >
                {busy ? "Sending…" : "Resend verification email"}
              </button>
            )}
            {status ? (
              <p className="mt-3 text-center text-sm text-[#1E3A5F]/80" role="status">
                {status}
              </p>
            ) : null}
            {!banner?.kind || banner.kind === "error" ? (
              <Link
                href="/dashboard"
                className="mt-6 inline-block w-full text-center text-sm font-semibold text-[#667eea] hover:underline"
              >
                ← Back to dashboard
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-center text-sm leading-relaxed text-[#1E3A5F]/85">
              {banner?.kind === "success"
                ? "You can close this tab and sign in on the device where you use Travello."
                : "Sign in to resend a verification email, or open the link from your inbox if you haven't yet."}
            </p>
            {banner?.kind === "error" ? (
              <button
                type="button"
                disabled={busy}
                onClick={onResend}
                className="mt-6 w-full rounded-2xl py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
                style={{ background: errorGradient }}
              >
                {busy ? "Sending…" : "Resend verification email"}
              </button>
            ) : null}
            <Link
              href="/login?verified=1"
              className="mt-6 flex w-full items-center justify-center rounded-2xl py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95"
              style={{ background: successGradient }}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="mt-4 block w-full text-center text-sm font-medium text-[#1E3A5F]/70 hover:text-[#667eea]"
            >
              Create an account
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-slate-100">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#11998e] border-t-transparent" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
