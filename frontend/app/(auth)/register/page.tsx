"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plane } from "lucide-react";
import {
  Suspense,
  type FormEvent,
  useEffect,
  useState,
} from "react";

import { AuthInput } from "@/components/auth/AuthInput";
import { GradientHeader } from "@/components/auth/GradientHeader";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { AppLogo } from "@/components/AppLogo";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { syncLocalProfileCache } from "@/lib/profileCache";
import {
  oauthErrorToRegisterAlert,
  type OauthLoginAlert,
} from "@/lib/oauthLoginErrors";

type RegisterResponse = {
  user: {
    full_name: string;
    email: string;
    is_verified?: boolean;
    email_verified?: boolean;
    avatar_url?: string | null;
  };
  token: { access_token: string; token_type: string; expires_in: number };
};

function ageFromDob(isoDate: string): number {
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return -1;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
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

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromOauth = searchParams.get("from") === "oauth";

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [dobError, setDobError] = useState<string | undefined>();
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [oauthAlert, setOauthAlert] = useState<OauthLoginAlert | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [socialToast, setSocialToast] = useState<string | null>(null);
  const [checkEmailFor, setCheckEmailFor] = useState<string | null>(null);
  const isBusy = submitting || oauthBusy;

  useEffect(() => {
    const oauthErr = searchParams.get("oauth_error");
    if (!oauthErr) return;
    setOauthAlert(oauthErrorToRegisterAlert(oauthErr));
    setError(null);
    const from = searchParams.get("from");
    const qs = new URLSearchParams();
    if (from === "oauth") qs.set("from", "oauth");
    router.replace(qs.toString() ? `/register?${qs.toString()}` : "/register", {
      scroll: false,
    });
  }, [searchParams, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOauthAlert(null);
    setDobError(undefined);

    const age = ageFromDob(dob);
    if (age < 18) {
      setDobError("You must be 18 or older to use Travello");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim() || undefined,
          email: email.trim(),
          password,
          date_of_birth: dob,
        }),
      });
      saveToken(data.token.access_token);
      if (typeof window !== "undefined") {
        const em = data.user.email.trim();
        localStorage.setItem("pending_verification_email", em);
        localStorage.setItem(
          "gt_user_name",
          data.user.full_name.trim() || "Traveler",
        );
        syncLocalProfileCache(data.user);
      }
      setCheckEmailFor(data.user.email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  const personIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
  const atIcon = (
    <span className="text-base font-bold" aria-hidden>
      @
    </span>
  );
  const mailIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
  const lockIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
  const calIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" />
    </svg>
  );

  if (checkEmailFor) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-white px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <AppLogo variant="onLight" className="h-8 w-auto max-w-[180px]" />
            <span className="inline-flex text-slate-800" aria-hidden>
              <Plane className="h-7 w-7" strokeWidth={1.5} />
            </span>
          </div>
          <div className="reg-envelope-wrap relative flex justify-center" aria-hidden>
            <style
              dangerouslySetInnerHTML={{
                __html: `
@keyframes reg-envelope-flap {
  0%, 100% { transform: rotateX(0deg); }
  50% { transform: rotateX(-18deg); }
}
.reg-envelope-flap { transform-origin: top center; animation: reg-envelope-flap 2.2s ease-in-out infinite; }
`,
              }}
            />
            <svg
              className="h-20 w-20 text-[#DC2626]"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="6"
                y="18"
                width="52"
                height="36"
                rx="4"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="white"
              />
              <path
                className="reg-envelope-flap"
                d="M8 20 L32 36 L56 20"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="white"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">
            Check your email
          </h1>
          <p className="mt-2 text-center text-slate-500">We sent a link to</p>
          <div className="mt-2 flex justify-center">
            <span className="inline-flex rounded-full bg-red-50 px-4 py-1.5 text-sm font-semibold text-[#DC2626]">
              {checkEmailFor}
            </span>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span className="text-emerald-600">Register ✓</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-[#DC2626]">Verify email</span>
            <span className="text-slate-300">|</span>
            <span>Start planning</span>
          </div>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Link
              href="/resend-verification"
              className="text-sm font-medium text-slate-500 hover:text-[#DC2626] hover:underline"
            >
              Resend email
            </Link>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-xs text-slate-400 transition hover:text-slate-600"
            >
              Skip for now →
            </button>
          </div>
          <Link
            href="/login"
            className="mt-6 block text-center text-sm text-slate-400 hover:text-slate-600"
          >
            Sign in instead
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-slate-100">
      <GradientHeader
        gradient="linear-gradient(135deg, #E94560, #FF6B6B, #FF6B9D)"
        title=""
        subtitle="Create your account"
        height={120}
      >
        <AppLogo variant="onLight" className="mx-auto h-9 w-auto max-w-[200px]" />
      </GradientHeader>

      <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-3xl bg-white px-4 pb-8 pt-6 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] sm:mx-auto sm:mb-8 sm:max-w-lg sm:rounded-2xl sm:px-8">
        {fromOauth ? (
          <p className="mb-4 rounded-2xl border border-[#667eea]/20 bg-[#667eea]/5 px-3 py-2 text-center text-xs text-[#1E3A5F]">
            Finish creating your Travello account below, or continue with Google or Facebook.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthInput
            id="reg-full-name"
            icon={personIcon}
            placeholder="Full name"
            autoComplete="name"
            required
            minLength={2}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isBusy}
          />
          <AuthInput
            id="reg-username"
            icon={atIcon}
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={50}
            disabled={isBusy}
          />
          <AuthInput
            id="reg-email"
            type="email"
            icon={mailIcon}
            placeholder="Email address"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isBusy}
          />

          <div>
            <AuthInput
              id="reg-password"
              type={showPassword ? "text" : "password"}
              icon={lockIcon}
              placeholder="Password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isBusy}
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isBusy}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1E3A5F]/50 hover:bg-slate-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon show={showPassword} />
                </button>
              }
            />
          </div>

          <div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[#1E3A5F]/55" aria-hidden>
                {calIcon}
              </span>
              <input
                id="reg-dob"
                type="date"
                required
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  setDobError(undefined);
                }}
                disabled={isBusy}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-3 text-sm text-[#1E3A5F] shadow-sm outline-none focus:border-[#667eea]/60 focus:ring-2 focus:ring-[#667eea]/20 disabled:opacity-70"
              />
            </div>
            {dobError ? (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {dobError}
              </p>
            ) : null}
          </div>

          {oauthAlert ? (
            <div
              className="rounded-2xl border border-red-200/80 bg-red-50 px-3 py-2.5 text-sm text-red-900"
              role="alert"
            >
              {oauthAlert.title ? (
                <p className="font-semibold">{oauthAlert.title}</p>
              ) : null}
              <p className={oauthAlert.title ? "mt-1" : ""}>{oauthAlert.body}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isBusy}
            className="mt-1 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#E94560] to-[#FF6B6B] py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating…
              </>
            ) : (
              "Create Account"
            )}
          </button>
          {error ? (
            <p className="text-center text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            or sign up with
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <OAuthButtons
          mode="register"
          disabled={isBusy}
          onBusyChange={setOauthBusy}
          onInstagramClick={() => {
            setSocialToast("Instagram login coming soon");
            window.setTimeout(() => setSocialToast(null), 3200);
          }}
        />

        {socialToast ? (
          <p
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-950"
            role="status"
          >
            {socialToast}
          </p>
        ) : null}

        <p className="mt-8 text-center text-sm text-[#1E3A5F]/80">
          Already have account?{" "}
          <Link href="/login" className="font-bold text-[#667eea] underline-offset-4 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-slate-100">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#E94560] border-t-transparent" />
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
