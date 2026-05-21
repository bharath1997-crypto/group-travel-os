"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { MapPin, Plane, Receipt } from "lucide-react";

import { RovvyLogo } from "@/components/RovvyLogo";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { startFacebookOAuth, startGoogleOAuth } from "@/lib/oauth";
import { syncLocalProfileCache } from "@/lib/profileCache";
import {
  oauthErrorToRegisterAlert,
  type OauthLoginAlert,
} from "@/lib/oauthLoginErrors";
import BrandedLoading from "@/components/BrandedLoading";

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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 8l10 6 10-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
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
  label: ReactNode;
  icon: ReactNode;
  endAdornment?: ReactNode;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] sm:text-xs font-medium text-[#94A3B8]">
        {label}
      </span>
      <span className="flex h-[40px] sm:h-[42px] items-center gap-2 rounded-[8px] border border-[#334155] bg-[#1E293B] px-3 transition focus-within:border-[#0F766E] focus-within:ring-1 focus-within:ring-[#0F766E]">
        {icon}
        <input
          {...inputProps}
          className="min-w-0 flex-1 bg-transparent text-[13px] sm:text-sm text-white outline-none placeholder:text-[#94A3B8] disabled:cursor-not-allowed disabled:opacity-60 py-1.5 sm:py-2"
        />
        {endAdornment}
      </span>
      {error ? (
        <span className="mt-0.5 block text-[11px] sm:text-xs font-medium text-[#E8619A]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
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
    <svg viewBox="0 0 24 24" width="18" height="18" fill="white" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.74 3.15.8 1.2-.24 2.35-.93 3.64-.84 1.54.12 2.7.72 3.46 1.83-3.16 1.9-2.41 6.06.52 7.23-.61 1.62-1.43 3.22-2.77 4.86zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
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
      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#334155] bg-[#1E293B] text-xs font-medium text-white transition hover:bg-[#334155] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function GoogleSignUpButton({
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
      className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#334155] bg-[#1E293B] px-4 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#334155] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (
        <>
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Signing up…
        </>
      ) : (
        <>
          <GoogleIcon />
          <span>Sign up with Google</span>
        </>
      )}
    </button>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromOauth = searchParams.get("from") === "oauth";

  const [fullName, setFullName] = useState("");
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
  const [checkEmailFor, setCheckEmailFor] = useState<string | null>(null);
  const isBusy = submitting || oauthBusy;

  // Read-tracking states
  const [termsRead, setTermsRead] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);

  useEffect(() => {
    const checkReadStatus = () => {
      if (typeof window !== "undefined") {
        const terms = localStorage.getItem("rovvy_terms_read") === "true";
        const privacy = localStorage.getItem("rovvy_privacy_read") === "true";
        setTermsRead(terms);
        setPrivacyRead(privacy);
      }
    };

    checkReadStatus();

    // Listen to focus changes to update when coming back from other tabs
    window.addEventListener("focus", checkReadStatus);
    return () => {
      window.removeEventListener("focus", checkReadStatus);
    };
  }, []);

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
    setUsernameError(undefined);
    setAgreeError(null);

    let hasError = false;

    // Check Terms and Privacy agreements
    if (!termsRead || !privacyRead || !agreed) {
      setAgreeError("Please agree to our Terms and Privacy Policy to continue");
      hasError = true;
    }

    if (!username.trim()) {
      setUsernameError("This field is required");
      hasError = true;
    }
    if (!dob) {
      setDobError("This field is required");
      hasError = true;
    } else {
      const age = ageFromDob(dob);
      if (age < 18) {
        setDobError("You must be 18 or older to use Rovvy");
        hasError = true;
      }
    }

    if (hasError) {
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          password,
          date_of_birth: dob,
        }),
      });
      saveToken(data.token.access_token);
      if (typeof window !== "undefined") {
        const em = data.user.email.trim();
        localStorage.setItem("pending_verification_email", em);
        localStorage.setItem("rovvy_pending_email", em);
        localStorage.setItem(
          "gt_user_name",
          data.user.full_name.trim() || "Traveler",
        );
        syncLocalProfileCache(data.user);
      }
      router.push("/verify");
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
      await startGoogleOAuth("signup");
    } catch (err) {
      setOauthBusy(false);
      setOauthAlert({
        variant: "error",
        title: "Registration Failed",
        body: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function goFacebook() {
    setOauthBusy(true);
    setOauthAlert(null);
    setError(null);
    try {
      await startFacebookOAuth("signup");
    } catch (err) {
      setOauthBusy(false);
      setOauthAlert({
        variant: "error",
        title: "Registration Failed",
        body: err instanceof Error ? err.message : String(err),
      });
    }
  }



  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-[#0F172A]">
      <aside className="relative hidden w-[38%] xl:w-[42%] flex-col justify-between overflow-hidden bg-[#0F172A] p-6 xl:p-9 md:flex">
        <span className="absolute -left-10 -top-10 h-[180px] w-[180px] rounded-full border border-[rgba(255,255,255,0.08)]" aria-hidden />
        <span className="absolute -right-5 bottom-[60px] h-[120px] w-[120px] rounded-full border border-[rgba(232,97,154,0.2)]" aria-hidden />
        <span className="absolute bottom-[100px] left-10 h-[60px] w-[60px] rounded-full bg-[rgba(232,97,154,0.08)]" aria-hidden />
        <div className="relative z-[1] flex flex-col items-start">
          <RovvyLogo variant="dark" size="lg" showTagline={true} />
        </div>
        <div className="relative z-[1] max-w-sm my-auto">
          <h1 className="text-[22px] font-medium leading-tight text-white">
            Your next adventure starts here.
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-white/55">
            Join thousands of groups planning trips together.
          </p>
          <ul className="mt-8 space-y-4">
            {INTRO_FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-[#5EEAD4]" aria-hidden>
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-white">{title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-white/55">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-[1] flex gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-[#E8619A]" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        </div>
      </aside>

      <main className="flex w-full flex-1 flex-col justify-center bg-[#0F172A] px-4 py-6 md:px-8 xl:px-12 md:overflow-y-auto">
        <div className="mx-auto w-full max-w-[480px] p-2 xs:p-4 md:p-6 page-wrapper">
          <div className="mb-6 flex flex-col items-center md:items-start">
            <RovvyLogo variant="white" size="md" showTagline={false} />
          </div>
          <h2 className="text-center text-lg sm:text-xl font-semibold text-white md:text-left">
            Create your account
          </h2>
          <p className="mb-4 sm:mb-5 mt-1 text-center text-xs sm:text-[13px] text-[#94A3B8] md:text-left">
            Start planning your first group trip
          </p>

          <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-6 sm:p-8">
            {fromOauth ? (
              <p className="mb-3 rounded-[8px] border border-[#E8619A]/30 bg-[#0F172A] px-3 py-2 text-center text-xs text-white">
                Finish creating your Rovvy account below, or continue with Google or Facebook.
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <SignupField
                  label="Full name"
                  id="reg-full-name"
                  icon={<UserIcon />}
                  type="text"
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isBusy}
                />
                <SignupField
                  label={
                    <>
                      Username <span className="text-[#E8619A]">*</span>
                    </>
                  }
                  id="reg-username"
                  icon={<UserIcon />}
                  type="text"
                  placeholder="Choose a username"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError(undefined);
                  }}
                  onInvalid={(e) => {
                    e.preventDefault();
                    setUsernameError("This field is required");
                  }}
                  disabled={isBusy}
                  error={usernameError}
                />
              </div>

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

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <SignupField
                  label="Password"
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  icon={<LockIcon />}
                  placeholder="Create a password"
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
                      className="flex h-8 w-8 items-center justify-center text-[#94A3B8] transition hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon show={showPassword} />
                    </button>
                  }
                />
                <SignupField
                  label="Confirm password"
                  id="reg-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  icon={<LockIcon />}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isBusy}
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      disabled={isBusy}
                      className="flex h-8 w-8 items-center justify-center text-[#94A3B8] transition hover:text-white"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      <EyeIcon show={showConfirmPassword} />
                    </button>
                  }
                />
              </div>

              <SignupField
                label={
                  <>
                    Date of Birth <span className="text-[#E8619A]">*</span>
                  </>
                }
                id="reg-dob"
                type="date"
                icon={<CalendarIcon />}
                required
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  setDobError(undefined);
                }}
                onInvalid={(e) => {
                  e.preventDefault();
                  setDobError("This field is required");
                }}
                disabled={isBusy}
                error={dobError}
              />

              {oauthAlert ? (
                <div
                  className="rounded-[8px] border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs sm:text-sm text-slate-200"
                  role="alert"
                >
                  {oauthAlert.title ? (
                    <p className="font-semibold text-white">{oauthAlert.title}</p>
                  ) : null}
                  <p className={oauthAlert.title ? "mt-1" : ""}>{oauthAlert.body}</p>
                </div>
              ) : null}

              {/* Terms & Privacy checkbox tracking */}
              <div className="flex flex-col gap-1.5 mt-1 mb-2">
                <label className={`flex items-start gap-2 text-xs text-[#94A3B8] select-none ${!(termsRead && privacyRead) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                  }`}>
                  <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      id="agree-checkbox"
                      disabled={!(termsRead && privacyRead)}
                      checked={agreed}
                      onChange={(e) => {
                        setAgreed(e.target.checked);
                        if (e.target.checked) setAgreeError(null);
                      }}
                      className={`h-4 w-4 appearance-none rounded border border-[#334155] bg-[#1E293B] transition checked:bg-[#0F766E] checked:border-[#0F766E] disabled:bg-slate-900 disabled:border-[#334155] ${!(termsRead && privacyRead) ? "cursor-not-allowed" : "cursor-pointer focus:ring-1 focus:ring-[#0F766E]"
                        }`}
                    />
                    {agreed && (
                      <svg className="absolute pointer-events-none h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="leading-normal text-[11px] sm:text-xs text-[#94A3B8]">
                    I agree to the{" "}
                    <Link href="/terms" target="_blank" className="font-semibold text-[#0F766E] hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" className="font-semibold text-[#0F766E] hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {!(termsRead && privacyRead) ? (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 font-medium bg-[#1E293B] border border-[#334155] p-1.5 rounded-md">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#94A3B8] shrink-0">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                    Please read our Terms and Privacy Policy first to unlock this checkbox.
                  </p>
                ) : !agreed ? (
                  <p className="text-[10px] text-[#0F766E] flex items-center gap-1 font-medium bg-[#0F766E]/10 border border-[#0F766E]/20 p-1.5 rounded-md">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#0F766E] shrink-0">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4.13-5.69z" clipRule="evenodd" />
                    </svg>
                    Checkbox unlocked! Please check the box to continue.
                  </p>
                ) : null}

                {agreeError && (
                  <p className="text-[10px] sm:text-[11px] font-medium text-red-400" role="alert">
                    {agreeError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isBusy}
                onClick={() => {
                  if (!username.trim()) {
                    setUsernameError("This field is required");
                  }
                  if (!dob) {
                    setDobError("This field is required");
                  }
                  if (!agreed) {
                    setAgreeError("Please agree to our Terms and Privacy Policy to continue");
                  }
                }}
                className={`flex h-[40px] sm:h-11 w-full items-center justify-center rounded-[8px] text-[13px] sm:text-sm font-medium tracking-[0.3px] text-white transition-all ${isBusy
                    ? "bg-[#0F766E]/60 cursor-not-allowed"
                    : !agreed
                      ? "bg-[#0F766E]/50 cursor-not-allowed hover:bg-[#0F766E]/50"
                      : "bg-[#0F766E] hover:bg-[#0D6B63] cursor-pointer"
                  }`}
              >
                {submitting ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating…
                  </>
                ) : (
                  "Create account"
                )}
              </button>
              {error ? (
                <p className="text-center text-sm font-medium text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
            </form>

            <div className="my-4 sm:my-5 flex items-center gap-3">
              <hr className="flex-1 border-0 border-t border-[#334155]" />
              <span className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                or continue with
              </span>
              <hr className="flex-1 border-0 border-t border-[#334155]" />
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <GoogleSignUpButton onClick={goGoogle} disabled={isBusy} busy={oauthBusy} />
              <div className="flex gap-3">
                <SocialButton label="Sign up with Facebook" onClick={goFacebook} disabled={isBusy}>
                  <FacebookIcon />
                  <span className="hidden sm:inline">Facebook</span>
                </SocialButton>
                <SocialButton label="Sign up with Apple" disabled={isBusy}>
                  <AppleIcon />
                  <span className="hidden sm:inline">Apple</span>
                </SocialButton>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-white">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#0F766E] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:rounded-sm focus-visible:outline-[#0F766E]"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={<BrandedLoading fullScreen={true} />}
    >
      <RegisterPageInner />
    </Suspense>
  );
}
