"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { GradientHeader } from "@/components/auth/GradientHeader";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { syncLocalProfileCache } from "@/lib/profileCache";

const RESEND_SECONDS = 42;

const DIAL_OPTIONS = [
  { value: "91", label: "India (+91)" },
  { value: "1", label: "United States (+1)" },
  { value: "44", label: "United Kingdom (+44)" },
  { value: "61", label: "Australia (+61)" },
  { value: "971", label: "UAE (+971)" },
] as const;

type VerifyResponse = {
  user: { full_name: string; email: string; avatar_url?: string | null };
  token: { access_token: string; token_type: string; expires_in: number };
};

export default function PhoneOtpPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [dial, setDial] = useState("91");
  const [national, setNational] = useState("");
  const [fullPhone, setFullPhone] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [digits, setDigits] = useState<string[]>(() => Array(6).fill(""));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [remaining, setRemaining] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const otp = digits.join("");

  useEffect(() => {
    if (step !== 2) return;
    setRemaining(RESEND_SECONDS);
    setCanResend(false);
    const t = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(t);
          setCanResend(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [step]);

  async function sendOtp() {
    let phone: string;
    if (step === 2 && fullPhone) {
      phone = fullPhone;
    } else {
      const d = national.replace(/\D/g, "");
      if (d.length < 6) {
        setSendError("Enter a valid phone number.");
        return;
      }
      phone = `+${dial}${d}`;
      setFullPhone(phone);
    }
    setSendError(null);
    setBusy(true);
    try {
      await apiFetch("/auth/phone/send", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setStep(2);
      setDigits(Array(6).fill(""));
      setVerifyError(null);
    } catch (e) {
      setSendError(
        e instanceof Error ? e.message : "Could not send OTP. Try again later.",
      );
    } finally {
      setBusy(false);
    }
  }

  const verify = useCallback(async () => {
    if (otp.length !== 6 || !fullPhone) return;
    setVerifyError(null);
    setBusy(true);
    try {
      const data = await apiFetch<VerifyResponse>("/auth/phone/verify", {
        method: "POST",
        body: JSON.stringify({ phone: fullPhone, otp }),
      });
      saveToken(data.token.access_token);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "gt_user_name",
          data.user.full_name.trim() || "Traveler",
        );
        syncLocalProfileCache(data.user);
      }
      router.replace("/dashboard");
    } catch (e) {
      setVerifyError(
        e instanceof Error ? e.message : "Verification failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [fullPhone, otp, router]);

  const autoOtpKey = useRef<string | null>(null);
  useEffect(() => {
    if (otp.length < 6) autoOtpKey.current = null;
  }, [otp]);

  useEffect(() => {
    if (step !== 2 || otp.length !== 6 || busy) return;
    if (autoOtpKey.current === otp) return;
    autoOtpKey.current = otp;
    void verify();
  }, [step, otp, busy, verify]);

  function setDigit(i: number, val: string) {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) {
      inputsRef.current[i + 1]?.focus();
    }
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = 1 - remaining / RESEND_SECONDS;

  return (
    <div className="flex min-h-svh flex-col bg-slate-100">
      <GradientHeader
        gradient="linear-gradient(135deg, #4facfe, #00f2fe)"
        title=""
        subtitle={
          step === 1
            ? "Sign in with your phone"
            : `Enter the OTP sent to ${fullPhone}`
        }
        height={step === 1 ? 120 : 140}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="h-8 w-8"
            aria-hidden
          >
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </div>
      </GradientHeader>

      <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-3xl bg-white px-4 pb-10 pt-6 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.12)] sm:mx-auto sm:mb-8 sm:max-w-lg sm:rounded-2xl sm:px-8">
        {step === 1 ? (
          <>
            <label className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]/70">
              Phone number
            </label>
            <div className="mt-2 flex gap-2">
              <select
                value={dial}
                onChange={(e) => setDial(e.target.value)}
                className="shrink-0 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-sm font-semibold text-[#1E3A5F] shadow-sm"
                disabled={busy}
              >
                {DIAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9876543210"
                value={national}
                onChange={(e) => setNational(e.target.value.replace(/[^\d]/g, ""))}
                disabled={busy}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-3 text-sm text-[#1E3A5F] shadow-sm outline-none focus:border-[#4facfe] focus:ring-2 focus:ring-[#4facfe]/25"
              />
            </div>
            {sendError ? (
              <p className="mt-3 text-sm font-medium text-red-600" role="alert">
                {sendError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={busy}
              className="mt-8 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#4facfe] to-[#00f2fe] py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <div className="mt-2">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#4facfe] to-[#00f2fe] transition-all duration-1000"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="mt-3 text-center text-sm text-[#1E3A5F]/80">
                {canResend ? (
                  <button
                    type="button"
                    className="font-semibold text-[#4facfe] underline-offset-2 hover:underline"
                    onClick={() => void sendOtp()}
                    disabled={busy}
                  >
                    Resend OTP
                  </button>
                ) : (
                  <>
                    Resend in {mm}:{ss}
                  </>
                )}
              </p>
            </div>

            <div className="mt-6 flex justify-center gap-2 sm:gap-3">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  disabled={busy}
                  className="h-12 w-10 rounded-xl border border-slate-200 text-center text-lg font-bold text-[#1E3A5F] shadow-sm outline-none focus:border-[#4facfe] focus:ring-2 focus:ring-[#4facfe]/25 sm:h-14 sm:w-12"
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            {verifyError ? (
              <p className="mt-4 text-center text-sm font-medium text-red-600" role="alert">
                {verifyError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void verify()}
              disabled={busy || otp.length !== 6}
              className="mt-8 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#4facfe] to-[#00f2fe] py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify and Continue"}
            </button>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500">
              By continuing, you agree to Travello&apos;s Terms of Service and Privacy Policy.
            </p>

            <Link
              href="/login"
              className="mt-4 block text-center text-sm font-semibold text-[#1E3A5F]/80 underline-offset-4 hover:underline"
            >
              Use Email / Password instead
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
