"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Eye, EyeOff } from "lucide-react";

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
import {
  oauthErrorToRegisterAlert,
  type OauthLoginAlert,
} from "@/lib/oauthLoginErrors";
import BrandedLoading from "@/components/BrandedLoading";
import { authHref, authReturnPathFromParams, rememberAuthReturnPath } from "@/lib/auth-return";

/** Fixed sizing for auth pages only — does not scale with viewport */
const FIELD_SHELL =
  "flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 shadow-sm transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/15";
const FIELD_INPUT =
  "min-w-0 flex-1 bg-transparent text-[13px] font-normal leading-none text-stone-800 outline-none placeholder:text-[12px] placeholder:text-stone-400 [color-scheme:light]";
const FIELD_LABEL = "mb-1 block text-[12px] font-medium leading-none text-stone-600";
const PRIMARY_BTN =
  "flex h-10 w-full shrink-0 items-center justify-center rounded-lg bg-primary text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60";

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

function maxDobFor18Plus(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden className="shrink-0">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function MailIcon() {
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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden className="shrink-0">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}

function SignupField({
  label,
  icon,
  endAdornment,
  error,
  ...inputProps
}: {
  label: string;
  icon: ReactNode;
  endAdornment?: ReactNode;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block shrink-0">
      <span className={FIELD_LABEL}>{label}</span>
      <span className={FIELD_SHELL}>
        {icon}
        <input {...inputProps} className={FIELD_INPUT} />
        {endAdornment}
      </span>
      {error ? (
        <span className="mt-0.5 block text-[11px] font-medium text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function RegisterPageInner() {
  useAuthPageLockScroll();

  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = authReturnPathFromParams(searchParams);
  const fromOauth = searchParams.get("from") === "oauth";
  const maxDob = useMemo(() => maxDobFor18Plus(), []);

  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [dobError, setDobError] = useState<string | undefined>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [oauthAlert, setOauthAlert] = useState<OauthLoginAlert | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
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
        if (result.status === "valid") {
          router.replace(nextPath);
          return;
        }
        if (result.status === "invalid") {
          clearToken();
        } else {
          router.replace(nextPath);
        }
      } catch {
        if (!cancelled) router.replace(nextPath);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  useEffect(() => {
    const oauthErr = searchParams.get("oauth_error");
    if (!oauthErr) return;
    setOauthAlert(oauthErrorToRegisterAlert(oauthErr));
    setError(null);
    const from = searchParams.get("from");
    const qs = new URLSearchParams();
    if (from === "oauth") qs.set("from", "oauth");
    qs.set("next", nextPath);
    router.replace(qs.toString() ? `/register?${qs.toString()}` : "/register", {
      scroll: false,
    });
  }, [searchParams, router, nextPath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOauthAlert(null);
    setDobError(undefined);
    setUsernameError(undefined);
    setAgreeError(null);

    let hasError = false;

    if (!agreed) {
      setAgreeError("Please agree to the Terms and Privacy Policy");
      hasError = true;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setUsernameError("Username is required");
      hasError = true;
    } else if (trimmedUsername.length < 2) {
      setUsernameError("Username must be at least 2 characters");
      hasError = true;
    }

    if (!dob) {
      setDobError("Required");
      hasError = true;
    } else if (ageFromDob(dob) < 18) {
      setDobError("You must be 18 or older");
      hasError = true;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      hasError = true;
    }

    if (hasError) return;

    setSubmitting(true);
    try {
      const { data, status } = await apiFetchWithStatus<RegisterResponse>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            full_name: trimmedUsername,
            username: trimmedUsername,
            email: email.trim(),
            password,
            date_of_birth: dob,
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
        setError("Registration failed. Check your details and try again.");
        return;
      }

      saveToken(data.token.access_token);
      if (typeof window !== "undefined") {
        const em = data.user.email.trim();
        localStorage.setItem("pending_verification_email", em);
        localStorage.setItem("rovvy_pending_email", em);
        localStorage.setItem("gt_user_name", trimmedUsername);
        syncLocalProfileCache(data.user);
      }
      rememberAuthReturnPath(nextPath);
      router.push(authHref("/verify", nextPath));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function goGoogle() {
    setOauthBusy(true);
    setOauthAlert(null);
    setError(null);
    try {
      rememberAuthReturnPath(nextPath);
      await startGoogleOAuth("signup");
    } catch (err) {
      setOauthBusy(false);
      setOauthAlert({
        variant: "error",
        title: "Registration failed",
        body: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function goFacebook() {
    setOauthBusy(true);
    setOauthAlert(null);
    setError(null);
    try {
      rememberAuthReturnPath(nextPath);
      await startFacebookOAuth("signup");
    } catch (err) {
      setOauthBusy(false);
      setOauthAlert({
        variant: "error",
        title: "Registration failed",
        body: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (checkingSession && isLoggedIn()) {
    return <BrandedLoading fullScreen={true} />;
  }

  return (
    <AuthExploreLayout
      variant="signup"
      title="Create your account"
      subtitle="Join Rovvy and start planning group trips."
      heroTitle="Plan trips together"
      heroSubtitle="Discover places, coordinate live, and explore the world with your group."
      footer={
        <>
          Already have an account?{" "}
          <Link href={authHref("/login", nextPath)} className={authLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex max-h-full flex-col overflow-hidden">
        {fromOauth ? (
          <p className={`mb-2 shrink-0 ${authAlertNeutralClass} text-center text-[11px]`}>
            Finish your account below, or continue with Google or Facebook.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex shrink-0 flex-col gap-2.5">
          <SignupField
            label="Username"
            id="reg-username"
            icon={<UserIcon />}
            type="text"
            placeholder="Username"
            autoComplete="username"
            required
            minLength={2}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setUsernameError(undefined);
            }}
            disabled={isBusy}
            error={usernameError}
          />

          <SignupField
            label="Email address"
            id="reg-email"
            type="email"
            icon={<MailIcon />}
            placeholder="you@email.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isBusy}
          />

          <SignupField
            label="Password"
            id="reg-password"
            type={showPassword ? "text" : "password"}
            icon={<LockIcon />}
            placeholder="Min. 8 characters"
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
                className={authToggleBtnClass}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            }
          />

          <SignupField
            label="Confirm password"
            id="reg-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            icon={<LockIcon />}
            placeholder="Confirm password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isBusy}
            endAdornment={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                disabled={isBusy}
                className={authToggleBtnClass}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            }
          />

          <SignupField
            label="Date of birth"
            id="reg-dob"
            type="date"
            icon={<CalendarIcon />}
            required
            max={maxDob}
            value={dob}
            onChange={(e) => {
              setDob(e.target.value);
              setDobError(undefined);
            }}
            disabled={isBusy}
            error={dobError}
          />

          {oauthAlert ? (
            <div
              className={`shrink-0 text-[11px] ${
                oauthAlert.variant === "info" ? authAlertInfoClass : authAlertErrorClass
              }`}
              role="alert"
            >
              {oauthAlert.title ? <p className="font-semibold">{oauthAlert.title}</p> : null}
              <p className={oauthAlert.title ? "mt-0.5" : ""}>{oauthAlert.body}</p>
            </div>
          ) : null}

          <label className="flex shrink-0 cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              id="agree-checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setAgreeError(null);
              }}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-stone-300 text-primary"
            />
            <span className="text-[11px] leading-snug text-stone-600">
              I agree to the{" "}
              <Link href="/terms" target="_blank" className={authLinkClass}>
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className={authLinkClass}>
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {agreeError ? (
            <p className="shrink-0 text-[11px] font-medium text-red-600" role="alert">
              {agreeError}
            </p>
          ) : null}

          <button type="submit" disabled={isBusy} className={PRIMARY_BTN}>
            {submitting ? "Creating account…" : "Create account"}
          </button>

          {error ? (
            <p className="shrink-0 text-center text-[12px] font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <div className="mt-2.5 shrink-0">
          <AuthSocialButtons
            mode="signup"
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<BrandedLoading fullScreen={true} />}>
      <RegisterPageInner />
    </Suspense>
  );
}
