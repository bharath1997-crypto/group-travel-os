"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

import { AppLogo } from "@/components/AppLogo";
import { AuthMapBackground } from "@/components/AuthMapBackground";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { startFacebookOAuth, startGoogleOAuth } from "@/lib/oauth";

type LoginResponse = {
  user: { full_name: string; email: string };
  token: { access_token: string; token_type: string; expires_in: number };
};

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

const FLOAT_ICONS: { emoji: string; style: CSSProperties }[] = [
  { emoji: "📍", style: { top: "8%", left: "6%", fontSize: 28, animationDuration: "5s", animationDelay: "0.2s" } },
  { emoji: "✈️", style: { top: "14%", right: "12%", fontSize: 36, animationDuration: "4s", animationDelay: "1s" } },
  { emoji: "🧭", style: { top: "42%", left: "4%", fontSize: 32, animationDuration: "6s", animationDelay: "0s" } },
  { emoji: "👥", style: { top: "28%", right: "8%", fontSize: 26, animationDuration: "5.5s", animationDelay: "2.1s" } },
  { emoji: "✏️", style: { top: "55%", left: "18%", fontSize: 24, animationDuration: "3.5s", animationDelay: "0.8s" } },
  { emoji: "🗺️", style: { top: "62%", right: "22%", fontSize: 30, animationDuration: "7s", animationDelay: "1.5s" } },
  { emoji: "⭐", style: { top: "18%", left: "44%", fontSize: 22, animationDuration: "4.2s", animationDelay: "2.8s" } },
  { emoji: "💬", style: { bottom: "28%", left: "10%", fontSize: 34, animationDuration: "5s", animationDelay: "0.5s" } },
  { emoji: "✈️", style: { bottom: "22%", right: "6%", fontSize: 28, animationDuration: "3.8s", animationDelay: "1.2s" } },
  { emoji: "📍", style: { top: "48%", right: "38%", fontSize: 26, animationDuration: "6.2s", animationDelay: "2.4s" } },
];

function SlateCharacterWithForm({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const svgCls = compact
    ? "mx-auto block w-[140px] max-w-[min(42vw,160px)] shrink-0"
    : "mx-auto block w-[200px] max-w-[min(55vw,220px)] shrink-0";
  const slateMt = compact ? "-mt-[52px] sm:-mt-[56px]" : "-mt-[72px] sm:-mt-[80px]";
  const pad = compact ? "p-4" : "p-6";
  return (
    <div
      className="auth-char-enter relative z-10 mx-auto flex w-full max-w-[380px] flex-col items-center px-3 sm:px-0"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <div className="relative w-full">
        <svg
          viewBox="0 0 320 200"
          className={svgCls}
          aria-hidden
        >
          <title>Traveler</title>
          {/* Backpack */}
          <ellipse cx="108" cy="128" rx="22" ry="28" fill="#1E3A5F" opacity="0.9" />
          <rect x="95" y="98" width="26" height="36" rx="6" fill="#334155" />
          {/* Body */}
          <ellipse cx="160" cy="130" rx="38" ry="44" fill="#3B82F6" />
          {/* Arms (behind slate visually — extend from sides) */}
          <path
            d="M 122 118 Q 95 125 78 135 Q 70 142 75 150"
            fill="none"
            stroke="#FDBCB4"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 198 118 Q 225 125 242 135 Q 250 142 245 150"
            fill="none"
            stroke="#FDBCB4"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Hands gripping slate corners */}
          <circle cx="82" cy="148" r="10" fill="#FDBCB4" />
          <circle cx="238" cy="148" r="10" fill="#FDBCB4" />
          {/* Pants */}
          <path d="M 142 168 L 138 195 L 152 198 L 160 172 L 168 198 L 182 195 L 178 168 Z" fill="#1E293B" />
          {/* Neck */}
          <rect x="150" y="88" width="20" height="14" rx="4" fill="#FDBCB4" />
          {/* Head */}
          <circle cx="160" cy="72" r="36" fill="#FDBCB4" />
          {/* Hair */}
          <path
            d="M 128 58 Q 132 28 160 26 Q 188 28 192 58 Q 188 48 160 44 Q 132 48 128 58 Z"
            fill="#4A3728"
          />
          {/* Face */}
          <circle cx="148" cy="70" r="3" fill="#292524" />
          <circle cx="172" cy="70" r="3" fill="#292524" />
          <path d="M 148 82 Q 160 90 172 82" fill="none" stroke="#292524" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* Slate / form card — overlaps character hands */}
        <div className={`relative w-full ${slateMt}`}>
          <div
            className={`rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.15)] ${pad}`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
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

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailOrUser, setEmailOrUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const o = searchParams.get("oauth_error");
    if (o) {
      setError(decodeURIComponent(o.replace(/\+/g, " ")));
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
      }
      const params = new URLSearchParams(window.location.search);
      const next = safeNextPath(params.get("next"));
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page relative h-svh max-h-[100dvh] overflow-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes auth-float {
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}
.auth-float-icon {
  animation: auth-float ease-in-out infinite;
  position: absolute;
  opacity: 0.6;
  pointer-events: none;
  user-select: none;
}
@media (max-width: 1023px) {
  .auth-float-icon { display: none; }
}
@keyframes auth-char-up {
  from { transform: translateY(100%); opacity: 0.85; }
  to { transform: translateY(0); opacity: 1; }
}
.auth-char-enter {
  animation: auth-char-up 0.8s ease-out both;
}
`,
        }}
      />

      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0F172A] to-[#1E3A5F]"
        aria-hidden
      />
      <AuthMapBackground />

      {FLOAT_ICONS.map(({ emoji, style }, i) => (
        <span key={i} className="auth-float-icon" style={style}>
          {emoji}
        </span>
      ))}

      <div className="relative flex h-full min-h-0 flex-col items-center justify-center py-2 sm:py-4">
        <SlateCharacterWithForm compact>
          <div className="text-center">
            <div className="flex justify-center">
              <AppLogo variant="onLight" className="h-9 w-auto max-w-[min(85%,220px)] sm:h-10" />
            </div>
            <p className="mt-2 text-xs text-gray-600 sm:text-sm">
              Welcome back, traveler!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-left sm:mt-5">
            <div>
              <label htmlFor="login-identifier" className="block text-xs font-semibold uppercase tracking-wide text-gray-700">
                Email or Username
              </label>
              <input
                id="login-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-sm outline-none ring-blue-500/30 transition focus:border-blue-500 focus:ring-2"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wide text-gray-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-2.5 pr-10 text-sm text-gray-900 shadow-sm outline-none ring-blue-500/30 transition focus:border-blue-500 focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>
            </div>

            {error ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-600 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>Sign In →</>
              )}
            </button>
          </form>

          <div className="my-3 flex items-center gap-2 sm:my-4">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] font-medium text-gray-500">or</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => startGoogleOAuth()}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brands/google.svg"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] shrink-0"
              />
              <span className="truncate">Google</span>
            </button>
            <button
              type="button"
              onClick={() => startFacebookOAuth()}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brands/facebook.svg"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] shrink-0"
              />
              <span className="truncate">Facebook</span>
            </button>
          </div>

          <p className="mt-2 text-center text-[10px] leading-snug text-gray-500">
            Google and Facebook verify your email — one tap, no separate codes.
          </p>

          <p className="mt-2 text-center text-xs text-gray-600">
            New here?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Create your account
            </Link>
          </p>
        </SlateCharacterWithForm>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-svh items-center justify-center bg-[#0F172A] text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
