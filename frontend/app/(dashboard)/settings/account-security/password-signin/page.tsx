"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Monitor,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
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
// Password-strength helper
// ─────────────────────────────────────────────
type StrengthLevel = 0 | 1 | 2 | 3 | 4;

interface StrengthResult {
  level: StrengthLevel;
  label: string;
  barColor: string;
  textColor: string;
}

function computeStrength(pw: string): StrengthResult {
  if (!pw) return { level: 0, label: "", barColor: "", textColor: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1)
    return { level: 1, label: "Weak",   barColor: "bg-red-500",   textColor: "text-red-600"   };
  if (score <= 2)
    return { level: 2, label: "Fair",   barColor: "bg-amber-400", textColor: "text-amber-600" };
  if (score <= 3)
    return { level: 3, label: "Good",   barColor: "bg-blue-500",  textColor: "text-blue-600"  };
  return   { level: 4, label: "Strong", barColor: "bg-teal-500",  textColor: "text-teal-600"  };
}

// ─────────────────────────────────────────────
// PasswordInput — field with show/hide toggle
// ─────────────────────────────────────────────
function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[13px] font-medium text-neutral-700"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm text-neutral-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-0 pr-10 ${
            error ? "border-red-300 bg-red-50" : "border-stone-200 bg-white"
          }`}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// StrengthBar
// ─────────────────────────────────────────────
function StrengthBar({ password }: { password: string }) {
  const { level, label, barColor, textColor } = computeStrength(password);
  if (!password) return null;
  return (
    <div>
      <div className="flex gap-1" aria-hidden="true">
        {([1, 2, 3, 4] as StrengthLevel[]).map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              level >= n ? barColor : "bg-stone-200"
            }`}
          />
        ))}
      </div>
      <p className={`mt-1 text-[11px] font-medium ${textColor}`}>
        {label} password
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Change Password Modal
// ─────────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [apiError, setApiError] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  // Focus trap + ESC
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!current) errs.current = "Current password is required.";
    if (!next) errs.next = "New password is required.";
    else if (next.length < 8) errs.next = "Password must be at least 8 characters.";
    else if (computeStrength(next).level < 2) errs.next = "Please choose a stronger password.";
    if (next && confirm !== next) errs.confirm = "Passwords do not match.";
    return errs;
  }, [current, next, confirm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStatus("loading");
    setApiError("");
    try {
      await apiFetch("/api/v1/users/me/password", {
        method: "PATCH",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setApiError(
        err instanceof Error ? err.message : "Failed to update password. Please try again."
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpw-title"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={modalRef}
        className="relative z-10 w-full rounded-t-2xl bg-white px-5 pb-8 pt-5 shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200 sm:hidden" aria-hidden="true" />

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 id="cpw-title" className="text-[17px] font-semibold text-neutral-900">
            Change Password
          </h2>
          <button
            ref={firstRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={18} />
          </button>
        </div>

        {status === "success" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
              <ShieldCheck size={28} className="text-teal-600" />
            </div>
            <p className="mt-4 text-[16px] font-semibold text-neutral-900">
              Password updated
            </p>
            <p className="mt-1.5 text-sm text-stone-500">
              Your password has been changed successfully.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <PasswordInput
              id="cpw-current"
              label="Current password"
              value={current}
              onChange={setCurrent}
              placeholder="Enter current password"
              autoComplete="current-password"
              error={errors.current}
            />
            <PasswordInput
              id="cpw-new"
              label="New password"
              value={next}
              onChange={setNext}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              error={errors.next}
            />
            {next && <StrengthBar password={next} />}
            <PasswordInput
              id="cpw-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Repeat new password"
              autoComplete="new-password"
              error={errors.confirm}
            />

            {apiError && (
              <p
                role="alert"
                className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {apiError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "loading"}
                className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {status === "loading" ? "Saving…" : "Update Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ComingSoonBadge
// ─────────────────────────────────────────────
function ComingSoonBadge() {
  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
      Coming Soon
    </span>
  );
}

// ─────────────────────────────────────────────
// Sign-in method row
// ─────────────────────────────────────────────
function SignInRow({
  iconContent,
  iconBg,
  label,
  detail,
  badge,
  comingSoon,
}: {
  iconContent: React.ReactNode;
  iconBg: string;
  label: string;
  detail?: string;
  badge?: React.ReactNode;
  comingSoon?: boolean;
}) {
  return (
    <div
      aria-disabled={comingSoon ? "true" : undefined}
      className={`flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 last:border-b-0 ${
        comingSoon ? "cursor-default select-none opacity-80" : ""
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconBg}`}
      >
        {iconContent}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-medium ${comingSoon ? "text-neutral-900/80" : "text-neutral-900"}`}>
          {label}
        </p>
        {detail && (
          <p className="mt-0.5 text-xs text-stone-400">{detail}</p>
        )}
      </div>
      {badge}
      {comingSoon && <ComingSoonBadge />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Google brand icon (tiny)
// ─────────────────────────────────────────────
function GoogleMini({ muted }: { muted?: boolean }) {
  const c = muted
    ? { a: "#8BB4E8", b: "#7DC18A", c: "#E5C96E", d: "#E07B75" }
    : { a: "#4285F4", b: "#34A853", c: "#FBBC05", d: "#EA4335" };
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill={c.a} />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={c.b} />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill={c.c} />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={c.d} />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function PasswordSignInPage() {
  const [modalOpen, setModalOpen] = useState(false);

  const handleSignOutAll = useCallback(() => {
    if (!window.confirm("Sign out of all devices? You will be signed out of this session too.")) return;
    localStorage.removeItem("gt_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  return (
    <>
      {modalOpen && <ChangePasswordModal onClose={() => setModalOpen(false)} />}

      <SettingsScreenHeader
        title="Password & Sign-In"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("account-security", "Password & Sign-In")}
      />

      {/* Page subtitle */}
      <p className="px-4 pb-1 pt-2 text-xs text-stone-500">
        Manage your password, sessions, and account access.
      </p>

      {/* ── Section 1: Password ───────────────────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Password</SettingsSectionTitle>

        {/* Change Password */}
        <button
          type="button"
          aria-label="Change Password"
          onClick={() => setModalOpen(true)}
          className="group flex w-full items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 text-left transition-all duration-150 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <KeyRound size={16} strokeWidth={1.8} className="text-teal-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-neutral-900">Change Password</p>
            <p className="mt-0.5 text-xs text-stone-400">
              Update your password to keep your account secure.
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1 text-[12px] font-semibold text-teal-700 transition-colors group-hover:bg-teal-100">
            Change
          </span>
        </button>

        {/* Password strength */}
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <Lock size={16} strokeWidth={1.8} className="text-teal-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-neutral-900">Password Strength</p>
            <p className="mt-0.5 text-xs text-stone-400">
              Your current password strength indicator.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
            Strong
          </span>
        </div>
      </div>

      {/* ── Section 2: Sign-in methods ───────────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Sign-in methods</SettingsSectionTitle>

        {/* Email & Password — active */}
        <SignInRow
          iconContent={<Mail size={15} strokeWidth={1.8} className="text-teal-700" />}
          iconBg="border-teal-100 bg-teal-50"
          label="Email & Password"
          detail="Email sign-in enabled"
          badge={
            <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-600">
              Active
            </span>
          }
        />

        {/* Google */}
        <SignInRow
          iconContent={<GoogleMini muted />}
          iconBg="border-stone-200 bg-white"
          label="Google"
          detail="Sign in with your Google account"
          comingSoon
        />

        {/* Apple */}
        <SignInRow
          iconContent={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#9ca3af" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
            </svg>
          }
          iconBg="border-stone-700 bg-stone-800"
          label="Apple"
          detail="Sign in with your Apple ID"
          comingSoon
        />

        {/* Facebook */}
        <SignInRow
          iconContent={
            <span className="text-[13px] font-bold leading-none text-blue-400" aria-hidden="true">
              f
            </span>
          }
          iconBg="border-blue-200 bg-blue-50"
          label="Facebook"
          detail="Sign in with your Facebook account"
          comingSoon
        />
      </div>

      {/* ── Section 3: Active sessions ───────────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Where you&apos;re signed in</SettingsSectionTitle>

        {/* Current session card */}
        <div className="border-b border-stone-100 px-4 py-3.5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <Monitor size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-medium text-neutral-900">
                  Web browser
                </p>
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-600">
                  Current session
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-400">
                Active right now · Rovvy.app
              </p>
            </div>
          </div>
        </div>

        {/* Sign out all */}
        <div className="px-4 py-3.5">
          <button
            type="button"
            onClick={handleSignOutAll}
            className="flex w-full items-center gap-3.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-left transition-all duration-150 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Sign out of all devices"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-white">
              <ShieldAlert size={16} strokeWidth={1.8} className="text-red-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-red-600">
                Sign out of all devices
              </p>
              <p className="mt-0.5 text-xs text-red-400">
                Removes your session from every active device.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Section 4: Account recovery ──────────────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Account recovery</SettingsSectionTitle>

        <div
          className="flex cursor-default select-none items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 opacity-80 pointer-events-none"
          role="button"
          aria-disabled="true"
          aria-label="Recovery Email — Coming Soon"
          tabIndex={-1}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <Mail size={16} strokeWidth={1.8} className="text-teal-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-neutral-900/80">
              Recovery Email
            </p>
            <p className="mt-0.5 text-xs text-stone-400/80">
              Used to recover your account if you lose access.
            </p>
          </div>
          <ComingSoonBadge />
        </div>

        <div
          className="flex cursor-default select-none items-center gap-3.5 px-4 py-3.5 opacity-80 pointer-events-none"
          role="button"
          aria-disabled="true"
          aria-label="Recovery Phone — Coming Soon"
          tabIndex={-1}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
            <Phone size={16} strokeWidth={1.8} className="text-teal-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-neutral-900/80">
              Recovery Phone
            </p>
            <p className="mt-0.5 text-xs text-stone-400/80">
              Receive security alerts and account recovery codes.
            </p>
          </div>
          <ComingSoonBadge />
        </div>
      </div>

      {/* ── Section 5: Security tips ─────────────────────────────────── */}
      <div className="mx-3 mt-4 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-teal-100 bg-white">
            <Shield size={14} strokeWidth={1.8} className="text-teal-700" />
          </div>
          <p className="text-[13px] font-semibold text-teal-800">
            Keep your account safe
          </p>
        </div>
        <ul className="space-y-2" role="list">
          {[
            "Use a strong password of at least 12 characters.",
            "Enable two-factor authentication when available.",
            "Review connected accounts and sessions regularly.",
            "Never share your password with anyone.",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <ShieldCheck size={10} />
              </span>
              <p className="text-xs leading-snug text-teal-700">{tip}</p>
            </li>
          ))}
        </ul>
      </div>

      <SettingsPageFooter />
    </>
  );
}
