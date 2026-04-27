"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Mail } from "lucide-react";

import { AuthInput } from "@/components/auth/AuthInput";
import { GradientHeader } from "@/components/auth/GradientHeader";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { AppLogo } from "@/components/AppLogo";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { syncLocalProfileCache } from "@/lib/profileCache";
import { oauthErrorToAlert, type OauthLoginAlert } from "@/lib/oauthLoginErrors";

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
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
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
  const [oauthHints, setOauthHints] = useState<{
    google: string | null;
    fb: string | null;
    photo: string | null;
  }>({ google: null, fb: null, photo: null });
  const [socialToast, setSocialToast] = useState<string | null>(null);
  const [unverifiedBanner, setUnverifiedBanner] = useState(false);
  const [pendingNext, setPendingNext] = useState<string | null>(null);

  const isBusy = submitting || oauthBusy;

  useEffect(() => {
    const oauthErr = searchParams.get("oauth_error");
    if (!oauthErr) return;

    setOauthAlert(oauthErrorToAlert(oauthErr));
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
    if (typeof window === "undefined") return;
    try {
      setOauthHints({
        google: localStorage.getItem("travello_google_hint"),
        fb: localStorage.getItem("travello_fb_hint"),
        photo: localStorage.getItem("travello_google_photo"),
      });
    } catch {
      /* ignore */
    }
  }, []);

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
      });
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

  return (
    <div className="relative flex min-h-svh flex-col bg-slate-100">
      <style
        dangerouslySetInnerHTML={{
          __html: `
.login-float-dot {
  position: absolute;
  border-radius: 9999px;
  background: rgba(255,255,255,0.35);
  animation: login-dot-float 6s ease-in-out infinite;
}
@keyframes login-dot-float {
  0%, 100% { transform: translate(0, 0); opacity: 0.5; }
  50% { transform: translate(6px, -10px); opacity: 0.85; }
}
@keyframes login-verify-slide {
  0% { opacity: 0; transform: translateY(-8px); }
  100% { opacity: 1; transform: translateY(0); }
}
.login-verify-slide { animation: login-verify-slide 0.35s ease-out forwards; }
`,
        }}
      />

      <div className="relative overflow-hidden" style={{ minHeight: 140 }}>
        <div
          className="absolute inset-0 rounded-b-3xl"
          style={{
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            minHeight: 140,
          }}
        />
        <span className="login-float-dot left-[8%] top-[20%] h-2 w-2" style={{ animationDelay: "0s" }} aria-hidden />
        <span className="login-float-dot left-[22%] top-[60%] h-3 w-3" style={{ animationDelay: "0.5s" }} aria-hidden />
        <span className="login-float-dot right-[15%] top-[25%] h-2.5 w-2.5" style={{ animationDelay: "1s" }} aria-hidden />
        <span className="login-float-dot right-[28%] top-[55%] h-2 w-2" style={{ animationDelay: "1.5s" }} aria-hidden />
        <span className="login-float-dot left-[45%] top-[12%] h-1.5 w-1.5" style={{ animationDelay: "0.3s" }} aria-hidden />

        <GradientHeader
          gradient="transparent"
          title=""
          subtitle="Welcome back, traveler!"
          height={140}
        >
          <AppLogo variant="onLight" className="mx-auto h-10 w-auto max-w-[220px]" />
        </GradientHeader>
      </div>

      <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-3xl bg-white px-4 pb-10 pt-6 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] sm:mx-auto sm:mb-8 sm:max-w-lg sm:rounded-2xl sm:px-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthInput
            id="login-email"
            icon={mailIcon}
            placeholder="Email or username"
            autoComplete="username"
            required
            value={emailOrUser}
            onChange={(e) => setEmailOrUser(e.target.value)}
            disabled={isBusy}
          />

          <div>
            <AuthInput
              id="login-password"
              type={showPassword ? "text" : "password"}
              icon={lockIcon}
              placeholder="Password"
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1E3A5F]/50 hover:bg-slate-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon show={showPassword} />
                </button>
              }
            />
            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-[#667eea] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {verifiedNotice ? (
            <div
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950"
              role="status"
            >
              Your email is verified. Sign in with your password to continue.
            </div>
          ) : null}

          {oauthAlert ? (
            <div
              className={`rounded-2xl border px-3 py-2.5 text-sm shadow-sm ${
                oauthAlert.variant === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
              role="alert"
            >
              {oauthAlert.title ? <p className="font-semibold">{oauthAlert.title}</p> : null}
              <p className={oauthAlert.title ? "mt-1" : ""}>{oauthAlert.body}</p>
              {oauthAlert.showCreateAccount ? (
                <p className="mt-2 text-xs">
                  <Link href="/register?from=oauth" className="font-semibold text-amber-900 underline-offset-2 hover:underline">
                    Create account
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          {unverifiedBanner ? (
            <div
              className="login-verify-slide mt-1 rounded-xl border border-[#f59e0b] bg-[#fffbeb] px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              <p className="flex items-center gap-2 font-medium text-[#92400e]">
                <Mail className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                Please verify your email address
              </p>
              <Link
                href="/resend-verification"
                className="mt-1 inline-block text-sm font-bold text-[#b45309] underline-offset-2 hover:underline"
              >
                Resend verification link
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (pendingNext) router.replace(pendingNext);
                }}
                className="mt-2 block w-full text-left text-xs font-medium text-amber-800/90 hover:underline"
              >
                Skip for now →
              </button>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isBusy}
            className="mt-1 flex min-h-[52px] w-full items-center justify-center rounded-2xl py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)",
            }}
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
            <p className="text-center text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            or continue with
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <OAuthButtons
          mode="login"
          disabled={isBusy}
          onBusyChange={setOauthBusy}
          googleHint={oauthHints.google}
          googlePhotoUrl={oauthHints.photo}
          facebookHint={oauthHints.fb}
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
          New here?{" "}
          <Link href="/register" className="font-bold text-[#667eea] underline-offset-4 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-slate-100">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#667eea] border-t-transparent" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
