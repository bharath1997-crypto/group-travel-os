"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Mail, MapPin, Plane, Receipt } from "lucide-react";

import { RovvyLogo } from "@/components/RovvyLogo";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { startFacebookOAuth, startGoogleOAuth } from "@/lib/oauth";
import { syncLocalProfileCache } from "@/lib/profileCache";
import { oauthErrorToAlert, type OauthLoginAlert } from "@/lib/oauthLoginErrors";
import BrandedLoading from "@/components/BrandedLoading";

type LoginResponse = {
  user: {
    full_name: string;
    email: string;
    avatar_url?: string | null;
    email_verified?: boolean;
    is_verified?: boolean;
  };
  token: { access_token: string; token_type: string; expires_in: number };
};

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/explore";
  return raw;
}

function EyeIcon({ show }: { show: boolean }) {
  if (show) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function LoginField({
  id,
  label,
  icon,
  endAdornment,
  ...props
}: {
  id: string;
  label: string;
  icon: ReactNode;
  endAdornment?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="flex h-11 sm:h-12 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 transition focus-within:border-[#E94560] focus-within:ring-1 focus-within:ring-[#E94560]">
        {icon}
        <input
          id={id}
          className="min-w-0 flex-1 bg-transparent text-[13px] sm:text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 py-1.5 sm:py-2"
          {...props}
        />
        {endAdornment}
      </span>
    </label>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 8l10 6 10-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-7.1z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-1 6.7-2.6l-3.2-2.4c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.5C4.6 19.9 8.1 22 12 22z" fill="#34A853" />
      <path d="M6.2 13.7c-.2-.6-.3-1.2-.3-1.7s.1-1.2.3-1.7V7.8H2.9C2.3 9 2 10.5 2 12s.3 3 .9 4.2l3.3-2.5z" fill="#FBBC05" />
      <path d="M12 6.6c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 3.6 14.7 2.6 12 2.6c-3.9 0-7.4 2.1-9.1 5.2l3.3 2.5C7 8.4 9.3 6.6 12 6.6z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7C18.3 21.1 22 17 22 12z" fill="#1877F2" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="text-slate-900" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.74 3.15.8(1.2-.24 2.35-.93 3.64-.84 1.54.12 2.7.72 3.46 1.83-3.16 1.9-2.41 6.06.52 7.23-.61 1.62-1.43 3.22-2.77 4.86zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

const INTRO_FEATURES = [
  {
    icon: Plane,
    title: "Plan together",
    body: "Build itineraries, vote on stops, and keep everyone aligned.",
  },
  {
    icon: Receipt,
    title: "Split fairly",
    body: "Track shared costs and settle up without the spreadsheet chaos.",
  },
  {
    icon: MapPin,
    title: "Move in sync",
    body: "Coordinate live location, updates, and decisions from one hub.",
  },
] as const;

function SocialButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94560] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function GoogleSignInButton({
  onClick,
  disabled,
  busy,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94560] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (
        <>
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" aria-hidden />
          Connecting to Google…
        </>
      ) : (
        <>
          <GoogleIcon />
          Continue with Google
        </>
      )}
    </button>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailOrUser, setEmailOrUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthAlert, setOauthAlert] = useState<OauthLoginAlert | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [verifiedNotice, setVerifiedNotice] = useState(false);
  const [unverifiedBanner, setUnverifiedBanner] = useState(false);
  const [pendingNext, setPendingNext] = useState<string | null>(null);

  const isBusy = submitting || oauthBusy;

  useEffect(() => {
    const oauthErr = searchParams.get("oauth_error");
    if (!oauthErr) return;

    if (oauthErr === "oauth_email_not_registered") {
      setOauthAlert({
        variant: "warning",
        title: "Account not found",
        body: "No Rovvy account found for this Google account. Would you like to create one?",
        showCreateAccount: true,
      });
    } else {
      setOauthAlert(oauthErrorToAlert(oauthErr));
    }
    setError(null);

    const next = searchParams.get("next");
    const qs = new URLSearchParams();
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      qs.set("next", next);
    }
    const path = qs.toString() ? `/login?${qs.toString()}` : "/login";
    router.replace(path, { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    if (searchParams.get("verified") !== "1") return;

    setVerifiedNotice(true);
    const next = searchParams.get("next");
    const qs = new URLSearchParams();
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      qs.set("next", next);
    }
    const path = qs.toString() ? `/login?${qs.toString()}` : "/login";
    router.replace(path, { scroll: false });
  }, [searchParams, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setOauthAlert(null);
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: emailOrUser.trim(),
          password,
        }),
      }, 30000);
      saveToken(data.token.access_token);
      if (typeof window !== "undefined") {
        localStorage.setItem("gt_user_name", data.user.full_name.trim() || "Traveler");
        syncLocalProfileCache(data.user);
      }
      const params = new URLSearchParams(window.location.search);
      const next = safeNextPath(params.get("next"));
      const verified =
        data.user.email_verified !== false && data.user.is_verified !== false;
      if (!verified) {
        setPendingNext(next);
        setUnverifiedBanner(true);
        return;
      }
      router.replace(next);
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  async function goGoogle() {
    setOauthBusy(true);
    setOauthAlert(null);
    setError(null);
    try {
      await startGoogleOAuth("login");
      // same-tab redirect: page is navigating — no further state update needed
    } catch (err) {
      setOauthBusy(false);
      setOauthAlert({
        variant: "error",
        title: "Login Failed",
        body: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function goFacebook() {
    setOauthBusy(true);
    setOauthAlert(null);
    setError(null);
    try {
      await startFacebookOAuth("login");
      // same-tab redirect: page is navigating — no further state update needed
    } catch (err) {
      setOauthBusy(false);
      setOauthAlert({
        variant: "error",
        title: "Login Failed",
        body: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="auth-shell grid min-h-dvh overflow-y-auto bg-slate-50 lg:grid-cols-2 lg:min-h-dvh">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-white border-r border-slate-200 px-10 py-12 xl:px-14 xl:py-16 lg:flex">
        <span className="absolute -left-16 -top-16 h-[220px] w-[220px] rounded-full border border-slate-100" aria-hidden />
        <span className="absolute -right-8 bottom-24 h-[140px] w-[140px] rounded-full border border-teal-500/10" aria-hidden />
        <span className="absolute bottom-32 left-12 h-[72px] w-[72px] rounded-full bg-teal-50" aria-hidden />

        <div className="relative z-[1]">
          <RovvyLogo variant="dark" size="lg" showTagline={true} />
        </div>

        <div className="relative z-[1] max-w-lg">
          <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight text-slate-900 xl:text-4xl">
            Your group travel command center.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-500">
            Plan trips, align decisions, and move together — without losing the thread in group chats.
          </p>
          <ul className="mt-10 space-y-5">
            {INTRO_FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-[#0F766E]" aria-hidden>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-500">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-[1] text-sm text-slate-400">
          Trusted by travelers planning together worldwide.
        </p>
      </aside>

      <main className="auth-main flex flex-col justify-start bg-slate-50 px-5 pt-8 pb-8 sm:px-8 sm:pt-12 sm:pb-10 lg:px-12 lg:pt-16 lg:pb-12 xl:px-16 xl:pt-20 xl:pb-16">
        <div className="mx-auto my-auto w-full max-w-[480px] page-wrapper">
          <div className="mb-8 flex flex-col items-center text-center lg:mb-10 lg:items-start lg:text-left">
            <RovvyLogo variant="dark" size="md" showTagline={false} className="items-center lg:items-start" />
            <h2 className="auth-title mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
              Welcome back
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 sm:text-[15px]">
              Sign in to pick up your trips, groups, and plans right where you left off.
            </p>
            <ul className="mt-6 flex flex-wrap gap-3 text-left justify-center lg:hidden">
              {INTRO_FEATURES.map(({ icon: Icon, title }) => (
                <li
                  key={title}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[#0F766E]" strokeWidth={1.75} aria-hidden />
                  <span className="font-semibold text-slate-800">{title}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            {verifiedNotice ? (
              <div
                className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-750"
                role="status"
              >
                Your email is verified. Sign in with your password to continue.
              </div>
            ) : null}

            {oauthAlert ? (
              <div
                className={`mb-5 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 ${
                  oauthAlert.variant === "info"
                    ? "border border-teal-200 bg-teal-50 text-teal-800"
                    : "border border-red-200 bg-red-50 text-red-800"
                }`}
                role="alert"
              >
                {oauthAlert.title ? <p className="font-bold text-slate-900">{oauthAlert.title}</p> : null}
                <p className={oauthAlert.title ? "mt-1" : ""}>{oauthAlert.body}</p>
                {oauthAlert.showCreateAccount ? (
                  <div className="mt-2">
                    <Link
                      href="/register"
                      className="inline-flex h-7 items-center justify-center rounded-md bg-[#E94560] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#D83A56]"
                    >
                      Create account
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <LoginField
                label="Email address"
                id="login-email"
                icon={<EnvelopeIcon />}
                type="text"
                placeholder="you@email.com"
                autoComplete="username"
                required
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                disabled={isBusy}
              />

              <LoginField
                label="Password"
                id="login-password"
                type={showPassword ? "text" : "password"}
                icon={<LockIcon />}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBusy}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isBusy}
                    className="flex h-8 w-8 items-center justify-center text-slate-400 transition hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon show={showPassword} />
                  </button>
                }
              />

              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-semibold text-[#0F766E] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {unverifiedBanner ? (
                <div
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800"
                  role="status"
                >
                  <p className="flex items-center gap-2 font-bold text-slate-900">
                    <Mail className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    Please verify your email address
                  </p>
                  <Link
                    href="/resend-verification"
                    className="mt-1 inline-block text-xs sm:text-sm font-bold text-[#E94560] underline-offset-2 hover:underline"
                  >
                    Resend verification link
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingNext) router.replace(pendingNext);
                    }}
                    className="mt-1.5 block w-full text-left text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                  >
                    Skip for now
                  </button>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isBusy}
                className="flex h-11 sm:h-12 w-full items-center justify-center rounded-lg bg-[#E94560] text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#D83A56] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94560] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>

              {error ? (
                <p className="text-center text-sm font-semibold text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
            </form>

            <div className="mt-6 flex items-center gap-3">
              <hr className="flex-1 border-0 border-t border-slate-200" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                or continue with
              </span>
              <hr className="flex-1 border-0 border-t border-slate-200" />
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <GoogleSignInButton onClick={goGoogle} disabled={isBusy} busy={oauthBusy} />
              <div className="flex gap-3">
                <SocialButton label="Continue with Facebook" onClick={goFacebook} disabled={isBusy}>
                  <FacebookIcon />
                  <span className="hidden sm:inline">Facebook</span>
                </SocialButton>
                <SocialButton label="Continue with Apple" disabled={isBusy}>
                  <AppleIcon />
                  <span className="hidden sm:inline">Apple</span>
                </SocialButton>
              </div>
            </div>

          </div>

          <p className="mt-8 text-center text-sm text-slate-650 lg:text-left">
            New here?{" "}
            <Link
              href="/register"
              className="font-bold text-[#E94560] hover:text-[#D83A56] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:rounded-sm focus-visible:outline-[#E94560]"
            >
              Create account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<BrandedLoading fullScreen={true} />}
    >
      <LoginPageInner />
    </Suspense>
  );
}
