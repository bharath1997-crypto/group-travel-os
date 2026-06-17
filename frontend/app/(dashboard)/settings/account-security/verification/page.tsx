"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

import {
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import {
  SettingsBreadcrumb,
  nestedCrumbs,
} from "@/components/settings/SettingsBreadcrumb";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface UserProfile {
  email: string;
  phone: string | null;
  whatsapp_number: string | null;
  whatsapp_verified: boolean;
  is_verified: boolean;
  email_verified: boolean;
}

type PhoneStep = "idle" | "enter-phone" | "enter-otp" | "success";

// ─────────────────────────────────────────────
// Retry-aware fetch
// ─────────────────────────────────────────────
async function fetchWithRetry<T>(url: string, opts?: RequestInit, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try { return (await apiFetch(url, opts)) as T; }
    catch (e) {
      lastErr = e;
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────
// Compact OTP input (6 boxes)
// ─────────────────────────────────────────────
function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null)); // eslint-disable-line react-hooks/rules-of-hooks

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
    }
  };

  const handleChange = (idx: number, v: string) => {
    const digit = v.replace(/\D/, "").slice(-1);
    const arr = value.padEnd(6, " ").split("");
    arr[idx] = digit || " ";
    const next = arr.join("").trimEnd();
    onChange(next);
    if (digit && idx < 5) refs[idx + 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste) { onChange(paste); refs[Math.min(paste.length, 5)].current?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2" role="group" aria-label="6-digit verification code">
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={refs[idx]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[idx]?.trim() ?? ""}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKey(idx, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${idx + 1}`}
          className="h-11 w-10 rounded-xl border border-stone-200 bg-white text-center text-[17px] font-semibold text-neutral-900 caret-teal-500 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Inline phone-verification flow card
// ─────────────────────────────────────────────
function PhoneVerifyCard({
  step,
  phoneInput,
  otpInput,
  loading,
  error,
  onPhoneChange,
  onOtpChange,
  onSend,
  onVerify,
  onDismiss,
}: {
  step: PhoneStep;
  phoneInput: string;
  otpInput: string;
  loading: boolean;
  error: string;
  onPhoneChange: (v: string) => void;
  onOtpChange: (v: string) => void;
  onSend: () => void;
  onVerify: () => void;
  onDismiss: () => void;
}) {
  if (step === "idle") return null;

  return (
    <div className="mx-3 mt-3 overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Phone size={15} strokeWidth={1.8} className="text-teal-600" />
          <p className="text-[13px] font-semibold text-neutral-900">
            {step === "success" ? "Phone verified" : "Verify phone number"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {step === "success" ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
              <CheckCircle2 size={24} className="text-teal-600" />
            </div>
            <p className="mt-3 text-[14px] font-semibold text-neutral-900">
              Phone number verified!
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Your number has been saved to your Rovvy account.
            </p>
            <button
              onClick={onDismiss}
              className="mt-4 rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Done
            </button>
          </div>
        ) : step === "enter-phone" ? (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              Enter your mobile number. We will send a 6-digit code via SMS.
            </p>
            <div>
              <label htmlFor="phone-input" className="mb-1 block text-[12px] font-medium text-stone-600">
                Phone number (include country code, e.g. +1)
              </label>
              <input
                id="phone-input"
                type="tel"
                value={phoneInput}
                onChange={(e) => onPhoneChange(e.target.value)}
                placeholder="+1 555 000 0000"
                autoComplete="tel"
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-stone-300 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle size={12} /> {error}
              </p>
            )}
            <button
              onClick={onSend}
              disabled={loading || !phoneInput.trim()}
              className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {loading ? "Sending…" : "Send Code"}
            </button>
          </div>
        ) : (
          /* step === "enter-otp" */
          <div className="space-y-4">
            <div>
              <p className="text-xs text-stone-500">
                Enter the 6-digit code sent to{" "}
                <span className="font-semibold text-neutral-700">{phoneInput}</span>
              </p>
            </div>
            <OtpBoxes value={otpInput} onChange={onOtpChange} />
            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle size={12} /> {error}
              </p>
            )}
            <button
              onClick={onVerify}
              disabled={loading || otpInput.replace(/\s/g, "").length < 6}
              className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {loading ? "Verifying…" : "Verify Code"}
            </button>
            <button
              type="button"
              onClick={() => onSend()}
              disabled={loading}
              className="w-full text-center text-[12px] text-teal-600 hover:underline disabled:opacity-40"
            >
              Resend code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Summary banner
// ─────────────────────────────────────────────
function SummaryBanner({
  emailVerified,
  phoneVerified,
  idVerified,
}: {
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
}) {
  const count = [emailVerified, phoneVerified, idVerified].filter(Boolean).length;
  const total = 3;

  if (count === total) {
    return (
      <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-white px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-white">
          <ShieldCheck size={20} className="text-teal-600" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-teal-800">Fully verified</p>
          <p className="mt-0.5 text-xs text-teal-600">
            All verification steps complete — you are a trusted traveler.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-stone-100 bg-white px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50">
            <Shield size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-neutral-900">
              {count === 0 ? "Not yet verified" : "Partially verified"}
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              {count} of {total} verification steps complete
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-semibold text-amber-600">
          {count}/{total}
        </span>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-teal-500 transition-all duration-500"
          style={{ width: `${Math.round((count / total) * 100)}%` }}
          role="progressbar"
          aria-valuenow={count}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${count} of ${total} verification steps complete`}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton row
// ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 last:border-b-0">
      <div className="h-8 w-8 animate-pulse rounded-lg bg-stone-100" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-28 animate-pulse rounded bg-stone-100" />
        <div className="h-2.5 w-40 animate-pulse rounded bg-stone-100" />
      </div>
      <div className="h-5 w-16 animate-pulse rounded-full bg-stone-100" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Tier row
// ─────────────────────────────────────────────
type TierStatus = "verified" | "unverified" | "coming-soon";

function TierRow({
  icon: Icon,
  label,
  detail,
  status,
  action,
  last,
}: {
  icon: React.ElementType;
  label: string;
  detail: string;
  status: TierStatus;
  action?: React.ReactNode;
  last?: boolean;
}) {
  const isDisabled = status === "coming-soon";
  const iconCls =
    status === "verified"
      ? "border-teal-100 bg-teal-50"
      : isDisabled
      ? "border-teal-100 bg-teal-50 opacity-70"
      : "border-amber-100 bg-amber-50";
  const iconColor =
    status === "verified"
      ? "text-teal-700"
      : isDisabled
      ? "text-teal-400"
      : "text-amber-600";

  return (
    <div
      className={`flex items-center gap-3.5 px-4 py-3.5 ${last ? "" : "border-b border-stone-100"} ${
        isDisabled ? "cursor-default select-none opacity-80 pointer-events-none" : ""
      }`}
      aria-disabled={isDisabled ? "true" : undefined}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconCls}`}>
        <Icon size={16} strokeWidth={1.8} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs text-stone-400">{detail}</p>
      </div>

      {status === "verified" && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-600">
          <CheckCircle2 size={10} /> Verified
        </span>
      )}
      {status === "unverified" && !action && (
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
          Not verified
        </span>
      )}
      {status === "coming-soon" && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
          Coming Soon
        </span>
      )}
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────
// Info benefit row
// ─────────────────────────────────────────────
function BenefitRow({
  icon: Icon,
  label,
  body,
  last,
}: {
  icon: React.ElementType;
  label: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div className={`px-4 py-3.5 ${last ? "" : "border-b border-stone-100"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
          <Icon size={16} strokeWidth={1.8} className="text-teal-700" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-neutral-900">{label}</p>
          <p className="mt-0.5 text-xs leading-snug text-stone-400">{body}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function VerificationPage() {
  const [user, setUser]         = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [fetchErr, setFetchErr] = useState("");

  // Phone flow
  const [phoneStep, setPhoneStep]   = useState<PhoneStep>("idle");
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput]     = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError]     = useState("");

  // ── Load user ────────────────────────────────
  const loadUser = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    setFetchErr("");
    try {
      const data = await fetchWithRetry<UserProfile>("/api/v1/auth/me");
      setUser(data);
    } catch (err: unknown) {
      setFetchErr(err instanceof Error ? err.message : "Could not load account data.");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => { void loadUser(false); }, [loadUser]);

  // ── Phone flow handlers ──────────────────────
  const handleSend = useCallback(async () => {
    setPhoneError("");
    setPhoneLoading(true);
    try {
      await apiFetch("/api/v1/auth/phone/send", {
        method: "POST",
        body: JSON.stringify({ phone: phoneInput.trim() }),
      });
      setOtpInput("");
      setPhoneStep("enter-otp");
    } catch (err: unknown) {
      setPhoneError(err instanceof Error ? err.message : "Failed to send code. Check the number and try again.");
    } finally {
      setPhoneLoading(false);
    }
  }, [phoneInput]);

  const handleVerify = useCallback(async () => {
    setPhoneError("");
    setPhoneLoading(true);
    try {
      await apiFetch("/api/v1/auth/phone/verify", {
        method: "POST",
        body: JSON.stringify({ phone: phoneInput.trim(), otp: otpInput.replace(/\s/g, "") }),
      });
      setPhoneStep("success");
      // Refresh user so the phone row updates
      setUser((prev) => prev ? { ...prev, phone: phoneInput.trim() } : prev);
    } catch (err: unknown) {
      setPhoneError(err instanceof Error ? err.message : "Invalid or expired code. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  }, [phoneInput, otpInput]);

  const handleDismiss = useCallback(() => {
    setPhoneStep("idle");
    setPhoneInput("");
    setOtpInput("");
    setPhoneError("");
    // If success, reload full user to pick up any server-side changes
    if (phoneStep === "success") void loadUser(false);
  }, [phoneStep, loadUser]);

  // ── Derived state ────────────────────────────
  const emailVerified = user?.email_verified ?? false;
  const phoneVerified = !!user?.phone;
  const idVerified    = user?.is_verified ?? false;

  return (
    <>
      <SettingsScreenHeader
        title="Verification"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("account-security", "Verification")}
      />

      {/* ── Summary banner ──────────────────────── */}
      {loading ? (
        <div className="mx-3 mt-3 h-16 animate-pulse rounded-2xl bg-stone-100" />
      ) : fetchErr ? (
        <div className="mx-3 mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-xs text-amber-700">{fetchErr}</p>
              <button
                onClick={() => loadUser(true)}
                disabled={retrying}
                className="mt-1.5 text-[12px] font-semibold text-amber-700 hover:underline disabled:opacity-50"
              >
                {retrying ? "Retrying…" : "Try again"}
              </button>
            </div>
          </div>
        </div>
      ) : user ? (
        <SummaryBanner
          emailVerified={emailVerified}
          phoneVerified={phoneVerified}
          idVerified={idVerified}
        />
      ) : null}

      {/* ── Verification tiers ───────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Verification steps</SettingsSectionTitle>

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {/* Email */}
            <TierRow
              icon={Mail}
              label="Email address"
              detail={user?.email ?? "Your registered email address"}
              status={emailVerified ? "verified" : "unverified"}
              action={
                !emailVerified ? (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600">
                    Check inbox
                  </span>
                ) : undefined
              }
            />

            {/* Phone */}
            <TierRow
              icon={Phone}
              label="Phone number"
              detail={
                phoneVerified
                  ? user?.phone ?? "Phone verified"
                  : "Add a mobile number to verify your account"
              }
              status={phoneVerified ? "verified" : "unverified"}
              action={
                !phoneVerified && phoneStep === "idle" ? (
                  <button
                    onClick={() => setPhoneStep("enter-phone")}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    aria-label="Add and verify phone number"
                  >
                    Add &amp; Verify <ChevronRight size={10} />
                  </button>
                ) : undefined
              }
              last
            />

            {/* Government ID */}
            <TierRow
              icon={FileCheck2}
              label="Government ID"
              detail="Verify your identity with an official document"
              status="coming-soon"
              last
            />
          </>
        )}
      </div>

      {/* ── Phone verification flow (inline) ──────── */}
      {phoneStep !== "idle" && (
        <PhoneVerifyCard
          step={phoneStep}
          phoneInput={phoneInput}
          otpInput={otpInput}
          loading={phoneLoading}
          error={phoneError}
          onPhoneChange={setPhoneInput}
          onOtpChange={setOtpInput}
          onSend={handleSend}
          onVerify={handleVerify}
          onDismiss={handleDismiss}
        />
      )}

      {/* ── Trusted Traveler progress ─────────────── */}
      {!loading && user && (
        <div className="mt-3 bg-white">
          <SettingsSectionTitle>Trusted Traveler progress</SettingsSectionTitle>
          <div className="px-4 py-3.5">
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Mail,      label: "Email",    done: emailVerified },
                { icon: Phone,     label: "Phone",    done: phoneVerified },
                { icon: Shield,    label: "Identity", done: idVerified    },
              ].map(({ icon: Icon, label, done }) => (
                <div
                  key={label}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 ${
                    done
                      ? "border-teal-100 bg-teal-50"
                      : "border-stone-100 bg-stone-50"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    done ? "border-teal-100 bg-white" : "border-stone-200 bg-white"
                  }`}>
                    <Icon size={15} strokeWidth={1.8} className={done ? "text-teal-600" : "text-stone-300"} />
                  </div>
                  <span className={`text-[11px] font-semibold ${done ? "text-teal-700" : "text-stone-400"}`}>
                    {label}
                  </span>
                  {done ? (
                    <CheckCircle2 size={12} className="text-teal-500" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border-2 border-stone-200" />
                  )}
                </div>
              ))}
            </div>

            {emailVerified && phoneVerified && idVerified ? (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5">
                <Award size={16} className="text-teal-600" />
                <p className="text-[13px] font-semibold text-teal-700">
                  Trusted Traveler badge earned!
                </p>
              </div>
            ) : (
              <p className="mt-3 text-center text-[11px] text-stone-400">
                Complete all steps to earn your Trusted Traveler badge.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Benefits ─────────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Why verify?</SettingsSectionTitle>
        <BenefitRow
          icon={Star}
          label="Verified traveler badge"
          body="A badge on your public profile shows other members you are a trusted Rovvy traveler."
        />
        <BenefitRow
          icon={ShieldCheck}
          label="Higher trust level"
          body="Verified accounts get faster trip approvals, higher expense limits, and fewer access restrictions."
        />
        <BenefitRow
          icon={Award}
          label="Trusted Traveler status"
          body="Complete all three steps to unlock the Trusted Traveler badge and full account privileges."
          last
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
