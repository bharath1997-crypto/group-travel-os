"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useRef, useState, useCallback } from "react";
import { Check, Mail, Lock, RefreshCw, AlertCircle, ArrowLeft } from "lucide-react";

import { RovvyLogo } from "@/components/RovvyLogo";
import { apiFetch } from "@/lib/api";
import { authReturnPathFromParams, recalledAuthReturnPath } from "@/lib/auth-return";

function VerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = authReturnPathFromParams(searchParams, recalledAuthReturnPath("/dashboard"));

  // Basic verification state
  const [success, setSuccess] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Flow control
  const [flow, setFlow] = useState<"auto" | "manual">("manual");
  const [autoVerifying, setAutoVerifying] = useState(false);

  // OTP inputs
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer & cooldown states
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15:00 countdown
  const [resendCooldown, setResendCooldown] = useState(0); // 60s cooldown
  const [resendsRemaining, setResendsRemaining] = useState(2); // 2 more times (total 3 tries)
  const [attemptsRemaining, setAttemptsRemaining] = useState(3); // 3 manual verify attempts
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Load pending email from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const email =
        localStorage.getItem("rovvy_pending_email") ||
        localStorage.getItem("pending_verification_email") ||
        "your inbox";
      setPendingEmail(email);
    }
  }, []);

  // Flow A: Auto link verification
  const runAutoVerification = useCallback(async (token: string) => {
    setAutoVerifying(true);
    setOtpError(null);
    try {
      await apiFetch(`/auth/verify-email?token=${token}`);
      setSuccess(true);
      setTimeout(() => {
        router.replace(recalledAuthReturnPath(nextPath, true));
      }, 2000);
    } catch (err) {
      setOtpError("This link has expired or is invalid. Please enter your OTP below.");
      setFlow("manual");
      // Focus first input box
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setAutoVerifying(false);
    }
  }, [router, nextPath]);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setFlow("auto");
      void runAutoVerification(token);
    } else {
      setFlow("manual");
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [searchParams, runAutoVerification]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // OTP box event handlers
  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    const char = value.slice(-1);
    newOtp[index] = char;
    setOtp(newOtp);

    setOtpError(null);

    // Auto-advance
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split("");
    setOtp(digits);
    inputRefs.current[5]?.focus();
  };

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    const filledOtp = otp.join("");
    if (filledOtp.length === 6 && !verifying && !success) {
      void handleVerifyOtp(filledOtp);
    }
  }, [otp]);

  // Submit manual OTP
  const handleVerifyOtp = async (code: string) => {
    if (timeLeft <= 0) {
      setOtpError("Code expired. Request a new one.");
      return;
    }
    if (attemptsRemaining <= 0) {
      setOtpError("Too many attempts. Please request a new code.");
      return;
    }

    setVerifying(true);
    setOtpError(null);
    try {
      await apiFetch("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: pendingEmail,
          otp: code,
        }),
      });
      setSuccess(true);
      setTimeout(() => {
        router.replace(recalledAuthReturnPath(nextPath, true));
      }, 2000);
    } catch (err) {
      const nextAttempts = attemptsRemaining - 1;
      setAttemptsRemaining(nextAttempts);
      setOtp(Array(6).fill(""));
      inputRefs.current[0]?.focus();

      if (nextAttempts > 0) {
        setOtpError(`Invalid code. ${nextAttempts} attempts remaining.`);
      } else {
        setOtpError("Too many attempts. Please request a new code.");
      }
    } finally {
      setVerifying(false);
    }
  };

  // Resend fresh OTP
  const handleResendCode = async () => {
    if (resendsRemaining <= 0) {
      setOtpError("Maximum resends reached. Please try again in 1 hour.");
      return;
    }

    setResending(true);
    setOtpError(null);
    try {
      await apiFetch("/auth/resend-verification", {
        method: "POST",
      });
      setResendsRemaining((prev) => prev - 1);
      setResendCooldown(60);
      setTimeLeft(15 * 60); // reset to 15:00
      setAttemptsRemaining(3); // reset verification attempts
      setOtp(Array(6).fill(""));
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 50);
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        setOtpError("Too many resend attempts. Please wait before trying again.");
      } else {
        setOtpError(err instanceof Error ? err.message : "Failed to resend code");
      }
    } finally {
      setResending(false);
    }
  };

  // UI state blocks
  if (autoVerifying) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-navy px-4 text-center">
        <div className="flex flex-col items-center gap-6">
          <RovvyLogo variant="white" size="md" />
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-base font-medium text-slate-300">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-navy px-4 py-12 text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes verify-pop {
              0% { transform: scale(0.9); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            .verify-card {
              animation: verify-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `,
        }}
      />

      <div className="verify-card w-full max-w-md rounded-2xl border border-slate-800 bg-[#1E293B] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex justify-center">
          <RovvyLogo variant="white" size="md" />
        </div>

        {success ? (
          <div className="flex flex-col items-center text-center py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981] text-white shadow-lg animate-bounce">
              <Check className="h-9 w-9" strokeWidth={3} />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-white">Email verified!</h2>
            <p className="mt-2 text-sm text-slate-400">Redirecting you to dashboard...</p>
          </div>
        ) : (
          <div>
            <h1 className="text-center text-2xl font-bold text-white tracking-tight">
              Verify your email
            </h1>
            <p className="mt-2 text-center text-xs sm:text-sm text-slate-400 leading-relaxed">
              Enter the 6-digit code sent to{" "}
              <span className="font-semibold text-slate-200 block sm:inline break-all">{pendingEmail}</span>
            </p>

            {/* OTP Grid */}
            <div className="mt-8 flex justify-between gap-2.5" onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  disabled={timeLeft <= 0 || attemptsRemaining <= 0}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  onChange={(e) => handleOtpChange(e.target.value, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className={`h-12 w-full text-center text-lg font-bold rounded-lg bg-slate-900 border text-white transition focus:outline-none focus:ring-2 ${
                    otpError
                      ? "border-[#E8619A] focus:border-[#E8619A] focus:ring-[#E8619A]/20"
                      : "border-slate-700 focus:border-primary focus:ring-[#0F766E]/20"
                  }`}
                />
              ))}
            </div>

            {/* Error notifications */}
            {otpError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#E8619A]/10 border border-[#E8619A]/20 p-3 text-left">
                <AlertCircle className="h-4.5 w-4.5 text-[#E8619A] shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-[#E8619A]" role="alert">
                  {otpError}
                </p>
              </div>
            )}

            {/* Countdown expiring timer */}
            <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium">
                {timeLeft > 0 ? (
                  <>
                    Code expires in{" "}
                    <span className="font-mono font-semibold text-white">
                      {formatTime(timeLeft)}
                    </span>
                  </>
                ) : (
                  <span className="text-[#E8619A] font-semibold">Code expired</span>
                )}
              </span>

              <span>
                {attemptsRemaining > 0 ? (
                  `${attemptsRemaining} attempts left`
                ) : (
                  <span className="text-[#E8619A]">Locked out</span>
                )}
              </span>
            </div>

            {/* Action buttons */}
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending || resendCooldown > 0 || resendsRemaining <= 0}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Resending…
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend in ${resendCooldown}s`
                ) : (
                  "Resend code"
                )}
              </button>

              <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
                <span>
                  {resendsRemaining > 0
                    ? `You can resend ${resendsRemaining} more time${
                        resendsRemaining > 1 ? "s" : ""
                      }`
                    : "No resends remaining"}
                </span>

                <Link
                  href="/login"
                  className="flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to login
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh flex-col items-center justify-center bg-navy px-4 text-center">
          <div className="flex flex-col items-center gap-4">
            <RovvyLogo variant="white" size="md" />
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
