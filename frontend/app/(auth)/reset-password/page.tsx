"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";

import { AuthInput } from "@/components/auth/AuthInput";
import { GradientHeader } from "@/components/auth/GradientHeader";
import { apiFetch } from "@/lib/api";

const ORANGE_GRADIENT = "linear-gradient(135deg, #FF6B35, #FF8E53)";
const GREEN_GRADIENT = "linear-gradient(135deg, #11998e, #38ef7d)";

function LockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function EyeIcon({ show }: { show: boolean }) {
  if (show) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const tokenFromUrl = useMemo(
    () => searchParams.get("token")?.trim() ?? "",
    [searchParams],
  );
  const hasToken = tokenFromUrl.length > 0;

  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateFields(): boolean {
    let ok = true;
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      ok = false;
    } else {
      setPasswordError(undefined);
    }
    if (confirm !== password) {
      setConfirmError("Passwords do not match");
      ok = false;
    } else {
      setConfirmError(undefined);
    }
    return ok;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validateFields()) return;
    if (!hasToken) return;

    setSubmitting(true);
    try {
      await apiFetch<{ message?: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: tokenFromUrl,
          new_password: password,
        }),
      });
      setSuccess(true);
    } catch {
      setSubmitError("Link expired or invalid. Request a new one.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasToken) {
    return (
      <div className="flex min-h-svh flex-col bg-slate-100">
        <GradientHeader
          gradient={ORANGE_GRADIENT}
          title=""
          subtitle="This reset link is missing a token. Use the link from your email or request a new reset."
          height={120}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
            <LockIcon />
          </div>
        </GradientHeader>
        <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-3xl bg-white px-4 pb-10 pt-6 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] sm:mx-auto sm:mb-8 sm:max-w-lg sm:rounded-2xl sm:px-8">
          <p className="text-center text-sm font-medium text-red-600" role="alert">
            Invalid or incomplete reset link.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#FF8E53] py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-svh flex-col bg-slate-100">
        <GradientHeader
          gradient={GREEN_GRADIENT}
          title=""
          subtitle="You can now sign in with your new password"
          height={150}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/25 text-3xl shadow-inner" aria-hidden>
            ✓
          </div>
          <p className="mt-3 text-xl font-bold leading-tight text-white">Password reset!</p>
        </GradientHeader>
        <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-3xl bg-white px-4 pb-10 pt-8 text-center shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] sm:mx-auto sm:mb-8 sm:max-w-lg sm:rounded-2xl sm:px-8">
          <Link
            href="/login"
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95"
            style={{ background: GREEN_GRADIENT }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-slate-100">
      <GradientHeader
        gradient={ORANGE_GRADIENT}
        title=""
        subtitle="Reset your password"
        height={120}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
          <LockIcon />
        </div>
      </GradientHeader>

      <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-3xl bg-white px-4 pb-10 pt-6 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] sm:mx-auto sm:mb-8 sm:max-w-lg sm:rounded-2xl sm:px-8">
        <h1 className="sr-only">Reset your password</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <AuthInput
            id="reset-new-password"
            type={showPassword ? "text" : "password"}
            icon={<LockIcon />}
            placeholder="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(undefined);
              setSubmitError(null);
            }}
            onBlur={() => {
              if (password.length > 0 && password.length < 8) {
                setPasswordError("Password must be at least 8 characters");
              }
            }}
            error={passwordError}
            disabled={submitting}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={submitting}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1E3A5F]/50 hover:bg-slate-100"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon show={showPassword} />
              </button>
            }
          />

          <AuthInput
            id="reset-confirm-password"
            type={showConfirm ? "text" : "password"}
            icon={<LockIcon />}
            placeholder="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setConfirmError(undefined);
              setSubmitError(null);
            }}
            onBlur={() => {
              if (confirm.length > 0 && confirm !== password) {
                setConfirmError("Passwords do not match");
              }
            }}
            error={confirmError}
            disabled={submitting}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                disabled={submitting}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1E3A5F]/50 hover:bg-slate-100"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                <EyeIcon show={showConfirm} />
              </button>
            }
          />

          {submitError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5 text-center text-sm text-red-800" role="alert">
              <p>{submitError}</p>
              <Link href="/forgot-password" className="mt-2 inline-block font-semibold text-[#667eea] underline-offset-2 hover:underline">
                Request a new reset link
              </Link>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#FF8E53] py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? "Resetting…" : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh flex-col items-center justify-center bg-slate-100">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#FF6B35] border-t-transparent" aria-hidden />
          <p className="mt-3 text-sm text-[#1E3A5F]/70">Loading…</p>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
