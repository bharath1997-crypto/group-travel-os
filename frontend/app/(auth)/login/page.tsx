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
import { Eye, EyeOff, Mail } from "lucide-react";

import {
  AuthExploreLayout,
  authAlertErrorClass,
  authAlertInfoClass,
  authAlertNeutralClass,
  authLinkClass,
} from "@/components/auth/AuthExploreLayout";
import { AuthSocialButtons, authToggleBtnClass } from "@/components/auth/AuthSocialButtons";
import { apiFetchWithStatus } from "@/lib/api";
import { clearToken, isLoggedIn, saveToken } from "@/lib/auth";
import { startFacebookOAuth, startGoogleOAuth } from "@/lib/oauth";
import { syncLocalProfileCache } from "@/lib/profileCache";
import { checkSession } from "@/lib/sessionValidation";
import { oauthErrorToAlert, type OauthLoginAlert } from "@/lib/oauthLoginErrors";
import BrandedLoading from "@/components/BrandedLoading";

/** Fixed sizing for auth pages only — does not scale with viewport */
const FIELD_SHELL =
  "flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 shadow-sm transition focus-within:border-[#0F766E] focus-within:ring-1 focus-within:ring-[#0F766E]/15";
const FIELD_INPUT =
  "min-w-0 flex-1 bg-transparent text-[13px] font-normal leading-none text-stone-800 outline-none placeholder:text-[12px] placeholder:text-stone-400";
const FIELD_LABEL = "mb-1 block text-[12px] font-medium leading-none text-stone-600";
const PRIMARY_BTN =
  "flex h-10 w-full shrink-0 items-center justify-center rounded-lg bg-[#0F766E] text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0D635C] disabled:cursor-not-allowed disabled:opacity-60";

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

function useAuthPageLockScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);
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
    <label className="block shrink-0">
      <span className={FIELD_LABEL}>{label}</span>
      <span className={FIELD_SHELL}>
        {icon}
        <input id={id} className={FIELD_INPUT} {...props} />
        {endAdornment}
      </span>
    </label>
  );
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden className="shrink-0">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 8l10 6 10-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden className="shrink-0">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function LoginPageInner() {
  useAuthPageLockScroll();

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
  const [checkingSession, setCheckingSession] = useState(true);

  const isBusy = submitting || oauthBusy;

  useEffect(() => {
    if (!isLoggedIn()) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await checkSession();
        if (cancelled) return;

        const next = safeNextPath(searchParams.get("next"));

        if (result.status === "valid") {
          syncLocalProfileCache(result.user);
          router.replace(next);
          return;
        }

        if (result.status === "invalid") {
          clearToken();
          return;
        }

        router.replace(next);
      } catch {
        if (!cancelled) {
          router.replace(safeNextPath(searchParams.get("next")));
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

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
      const { data, status } = await apiFetchWithStatus<LoginResponse>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: emailOrUser.trim(),
            password,
          }),
        },
        45000,
      );

      if (status === 408 || status === 0) {
        setError(
          "The server is slow or offline. Start the backend (port 8000) and try again.",
        );
        return;
      }

      if (status !== 200 || !data) {
        setError("Invalid email or password");
        return;
      }

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
      setError("Could not sign in. Check that the backend is running and try again.");
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
    } catch (err) {
      setOauthBusy(false);
      setOauthAlert({
        variant: "error",
        title: "Login Failed",
        body: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (checkingSession && isLoggedIn()) {
    return <BrandedLoading fullScreen={true} />;
  }

  return (
    <AuthExploreLayout
      variant="login"
      title="Welcome back"
      subtitle="Sign in to plan trips and roam together with your group."
      heroTitle="Roam together"
      heroSubtitle="Pick up your trips, explore new places, and stay in sync with your group."
      heroFooter="Group travel coordination — built for adventure."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className={authLinkClass}>
            Create account
          </Link>
        </>
      }
    >
      <div className="flex max-h-full flex-col overflow-hidden">
        {verifiedNotice ? (
          <div className={`mb-2 shrink-0 text-[11px] ${authAlertNeutralClass}`} role="status">
            Your email is verified. Sign in with your password to continue.
          </div>
        ) : null}

        {oauthAlert ? (
          <div
            className={`mb-2 shrink-0 text-[11px] ${
              oauthAlert.variant === "info" ? authAlertInfoClass : authAlertErrorClass
            }`}
            role="alert"
          >
            {oauthAlert.title ? <p className="font-semibold">{oauthAlert.title}</p> : null}
            <p className={oauthAlert.title ? "mt-0.5" : ""}>{oauthAlert.body}</p>
            {oauthAlert.showCreateAccount ? (
              <div className="mt-1.5">
                <Link
                  href="/register"
                  className="inline-flex h-7 items-center justify-center rounded-md bg-[#0F766E] px-2.5 text-[11px] font-semibold text-white hover:bg-[#0D635C]"
                >
                  Create account
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex shrink-0 flex-col gap-2.5">
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

          <div className="shrink-0">
            <div className="mb-1 flex items-center justify-between">
              <span className={FIELD_LABEL}>Password</span>
              <Link href="/forgot-password" className={`${authLinkClass} text-[11px]`}>
                Forgot password?
              </Link>
            </div>
            <span className={FIELD_SHELL}>
              <LockIcon />
              <input
                id="login-password"
                className={FIELD_INPUT}
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBusy}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isBusy}
                className={authToggleBtnClass}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </span>
          </div>

          {unverifiedBanner ? (
            <div className={`shrink-0 text-[11px] ${authAlertErrorClass}`} role="status">
              <p className="flex items-center gap-1.5 font-semibold">
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                Please verify your email address
              </p>
              <Link href="/resend-verification" className={`mt-0.5 inline-block text-[11px] ${authLinkClass}`}>
                Resend verification link
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (pendingNext) router.replace(pendingNext);
                }}
                className="mt-0.5 block text-left text-[11px] text-stone-500 hover:underline"
              >
                Skip for now
              </button>
            </div>
          ) : null}

          <button type="submit" disabled={isBusy} className={PRIMARY_BTN}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          {error ? (
            <p className="shrink-0 text-center text-[12px] font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <div className="mt-2.5 shrink-0">
          <AuthSocialButtons
            mode="login"
            disabled={isBusy}
            googleBusy={oauthBusy}
            onGoogle={goGoogle}
            onFacebook={goFacebook}
          />
        </div>
      </div>
    </AuthExploreLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<BrandedLoading fullScreen={true} />}>
      <LoginPageInner />
    </Suspense>
  );
}
