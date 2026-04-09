"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";

import { AuthMapBackground } from "@/components/AuthMapBackground";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { startFacebookOAuth, startGoogleOAuth } from "@/lib/oauth";

type RegisterResponse = {
  user: { full_name: string; email: string };
  token: { access_token: string; token_type: string; expires_in: number };
};

function SlateCharacterWithForm({ children }: { children: ReactNode }) {
  return (
    <div
      className="auth-char-enter relative z-10 mx-auto flex w-full max-w-[380px] flex-col items-center px-2 sm:px-0"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <div className="relative w-full">
        <svg
          viewBox="0 0 320 200"
          className="mx-auto block w-[120px] max-w-[36vw] shrink-0 sm:w-[132px]"
          aria-hidden
        >
          <ellipse cx="108" cy="128" rx="22" ry="28" fill="#1E3A5F" opacity="0.9" />
          <rect x="95" y="98" width="26" height="36" rx="6" fill="#334155" />
          <ellipse cx="160" cy="130" rx="38" ry="44" fill="#3B82F6" />
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
          <circle cx="82" cy="148" r="10" fill="#FDBCB4" />
          <circle cx="238" cy="148" r="10" fill="#FDBCB4" />
          <path d="M 142 168 L 138 195 L 152 198 L 160 172 L 168 198 L 182 195 L 178 168 Z" fill="#1E293B" />
          <rect x="150" y="88" width="20" height="14" rx="4" fill="#FDBCB4" />
          <circle cx="160" cy="72" r="36" fill="#FDBCB4" />
          <path
            d="M 128 58 Q 132 28 160 26 Q 188 28 192 58 Q 188 48 160 44 Q 132 48 128 58 Z"
            fill="#4A3728"
          />
          <circle cx="148" cy="70" r="3" fill="#292524" />
          <circle cx="172" cy="70" r="3" fill="#292524" />
          <path d="M 148 82 Q 160 90 172 82" fill="none" stroke="#292524" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <div className="relative -mt-[40px] w-full sm:-mt-[48px]">
          <div className="rounded-2xl bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.15)] sm:p-4">
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
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      };
      const u = username.trim();
      if (u) body.username = u;

      const data = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      saveToken(data.token.access_token);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "gt_user_name",
          data.user.full_name.trim() || "Traveler",
        );
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldCls =
    "mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 shadow-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-1";

  return (
    <div className="auth-page relative h-svh max-h-[100dvh] overflow-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
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

      <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] to-[#1E3A5F]" aria-hidden />
      <AuthMapBackground />

      <div className="relative flex h-full min-h-0 flex-col items-center justify-center px-1 py-1 sm:py-2">
        <SlateCharacterWithForm>
          <div className="text-center">
            <p className="text-base font-bold leading-tight text-gray-900 sm:text-lg">
              <span aria-hidden>✈️</span> Group Travel OS
            </p>
            <p className="mt-0.5 text-[11px] text-gray-600 sm:text-xs">Join the adventure!</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-2 space-y-2 text-left sm:mt-3">
            <div>
              <label htmlFor="reg-name" className="text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                Full Name
              </label>
              <input
                id="reg-name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={fieldCls}
              />
            </div>

            <div>
              <label htmlFor="reg-username" className="text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                Username <span className="font-normal normal-case text-gray-500">(optional)</span>
              </label>
              <input
                id="reg-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={50}
                className={fieldCls}
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                Email
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldCls}
              />
            </div>

            <div>
              <label htmlFor="reg-phone" className="text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                Phone <span className="font-normal normal-case text-gray-500">(optional)</span>
              </label>
              <input
                id="reg-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={fieldCls}
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                Password
              </label>
              <div className="relative mt-0.5">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldCls} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>
            </div>

            {error ? (
              <p className="text-xs font-medium text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-600 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                  Creating…
                </>
              ) : (
                <>Create Account →</>
              )}
            </button>
          </form>

          <div className="my-2 flex items-center gap-2">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] font-medium text-gray-500">or verify with</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => startGoogleOAuth()}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2 text-[11px] font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brands/google.svg"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
              />
              <span className="truncate">Google</span>
            </button>
            <button
              type="button"
              onClick={() => startFacebookOAuth()}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2 text-[11px] font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brands/facebook.svg"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
              />
              <span className="truncate">Facebook</span>
            </button>
          </div>

          <p className="mt-1.5 text-center text-[10px] leading-snug text-gray-500">
            Google and Facebook sign-in confirms your email in one step (no separate email/SMS codes).
          </p>

          <p className="mt-1.5 text-center text-[11px] text-gray-600">
            Already a partner?{" "}
            <Link href="/login" className="font-semibold text-blue-600 hover:underline">
              Login
            </Link>
          </p>
        </SlateCharacterWithForm>
      </div>
    </div>
  );
}
