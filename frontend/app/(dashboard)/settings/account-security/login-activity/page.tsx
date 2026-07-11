"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  History,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  MapPin,
  Monitor,
  RefreshCw,
  Shield,
  ShieldAlert,
  Smartphone,
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

// ─────────────────────────────────────────────
// Browser / OS detection from userAgent
// ─────────────────────────────────────────────
function parseUA(ua: string): { browser: string; os: string; isMobile: boolean } {
  let browser = "Web Browser";
  let os      = "Unknown OS";

  if      (/Edg\//.test(ua))                               browser = "Microsoft Edge";
  else if (/OPR\/|Opera/.test(ua))                          browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua))     browser = "Chrome";
  else if (/Firefox\//.test(ua))                            browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua))     browser = "Safari";
  else if (/MSIE|Trident/.test(ua))                         browser = "Internet Explorer";

  const isMobile = /iPhone|iPad|Android|Mobile/.test(ua);

  if      (/Windows NT 10/.test(ua))                        os = "Windows 11/10";
  else if (/Windows NT 6\.3/.test(ua))                      os = "Windows 8.1";
  else if (/Windows NT/.test(ua))                           os = "Windows";
  else if (/iPhone/.test(ua))                               os = "iPhone (iOS)";
  else if (/iPad/.test(ua))                                 os = "iPad (iPadOS)";
  else if (/Android/.test(ua))                              os = "Android";
  else if (/Mac OS X/.test(ua))                             os = "macOS";
  else if (/Linux/.test(ua))                                os = "Linux";

  return { browser, os, isMobile };
}

// ─────────────────────────────────────────────
// Decode JWT `iat` from localStorage
// ─────────────────────────────────────────────
function jwtIssuedAt(token: string | null): Date | null {
  if (!token) return null;
  try {
    const b64 = token.split(".")[1];
    if (!b64) return null;
    const payload = JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.iat ? new Date(payload.iat * 1000) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Location hint from IANA timezone
// ─────────────────────────────────────────────
function timezoneCity(): { city: string; tz: string } {
  const tz   = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "America/Chicago"
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  return { city, tz };
}

// ─────────────────────────────────────────────
// Relative time helper
// ─────────────────────────────────────────────
function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec  = Math.floor(diff / 1000);
  const min  = Math.floor(sec / 60);
  const hr   = Math.floor(min / 60);
  const day  = Math.floor(hr / 24);
  if (sec < 60)  return "Just now";
  if (min < 60)  return `${min}m ago`;
  if (hr  < 24)  return `${hr}h ago`;
  if (day <  7)  return `${day}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────
// Device icon
// ─────────────────────────────────────────────
function DeviceIcon({ isMobile, os }: { isMobile: boolean; os: string }) {
  if (isMobile) return <Smartphone size={16} strokeWidth={1.8} className="text-teal-700" />;
  if (/macOS|iPad/.test(os)) return <Laptop size={16} strokeWidth={1.8} className="text-teal-700" />;
  return <Monitor size={16} strokeWidth={1.8} className="text-teal-700" />;
}

// ─────────────────────────────────────────────
// Current session data (client-only)
// ─────────────────────────────────────────────
interface SessionData {
  browser:   string;
  os:        string;
  isMobile:  boolean;
  city:      string;
  tz:        string;
  signedIn:  Date | null;
}

function useCurrentSession(): SessionData | null {
  const [session, setSession] = useState<SessionData | null>(null);
  useEffect(() => {
    const { browser, os, isMobile } = parseUA(navigator.userAgent);
    const { city, tz }              = timezoneCity();
    const token                     = localStorage.getItem("gt_token");
    const signedIn                  = jwtIssuedAt(token);
    setSession({ browser, os, isMobile, city, tz, signedIn });
  }, []);
  return session;
}

// ─────────────────────────────────────────────
// Current session card
// ─────────────────────────────────────────────
function CurrentSessionCard({ session }: { session: SessionData }) {
  return (
    <div className="mx-1 overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-teal-400 to-teal-600" aria-hidden="true" />

      <div className="px-4 py-4">
        {/* Device row */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-white shadow-sm">
            <DeviceIcon isMobile={session.isMobile} os={session.os} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold text-neutral-900">
                {session.browser}
              </p>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-teal-700">
                CURRENT SESSION
              </span>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">{session.os}</p>
          </div>
        </div>

        {/* Detail grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2.5">
            <MapPin size={13} className="shrink-0 text-teal-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Location
              </p>
              <p className="truncate text-[12px] font-semibold text-neutral-800">
                {session.city}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2.5">
            <Globe size={13} className="shrink-0 text-teal-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Timezone
              </p>
              <p className="truncate text-[12px] font-semibold text-neutral-800">
                {session.tz.split("/")[0]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2.5">
            <Clock size={13} className="shrink-0 text-teal-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Signed in
              </p>
              <p className="truncate text-[12px] font-semibold text-neutral-800">
                {session.signedIn ? relativeTime(session.signedIn) : "Active now"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2.5">
            <CheckCircle2 size={13} className="shrink-0 text-teal-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Status
              </p>
              <p className="truncate text-[12px] font-semibold text-teal-700">Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// History empty state
// ─────────────────────────────────────────────
function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100">
        <History size={26} className="text-stone-400" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-neutral-900">
        No sign-in history yet
      </p>
      <p className="mt-1.5 max-w-[240px] text-sm leading-snug text-stone-500">
        Your recent sign-in locations, devices, and timestamps will appear here
        once login tracking is available.
      </p>
      <div className="mt-5 flex items-center gap-1.5 rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5">
        <RefreshCw size={13} className="shrink-0 text-stone-400" />
        <p className="text-[12px] text-stone-500">
          Login history tracking — <span className="font-semibold">coming soon</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Suspicious activity notice
// ─────────────────────────────────────────────
function SuspiciousNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="mx-3 mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-100 bg-white">
          <AlertTriangle size={15} strokeWidth={1.8} className="text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-amber-800">
            Notice something unfamiliar?
          </p>
          <p className="mt-0.5 text-xs leading-snug text-amber-700">
            If you see a sign-in you don&apos;t recognize, change your password and
            enable two-factor authentication immediately.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/settings/account-security/password-signin"
              className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-800 hover:bg-amber-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <KeyRound size={12} /> Change password
            </a>
            <a
              href="/settings/account-security/two-factor"
              className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-800 hover:bg-amber-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Shield size={12} /> Enable 2FA
            </a>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg px-3 py-1.5 text-[12px] text-amber-600 hover:underline focus-visible:outline-none"
              aria-label="Dismiss security notice"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Security action row
// ─────────────────────────────────────────────
function ActionRow({
  icon: Icon,
  label,
  sublabel,
  href,
  danger,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  href?: string;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const iconCls = danger
    ? "border-red-100 bg-red-50"
    : "border-teal-100 bg-teal-50";
  const iconColor = danger ? "text-red-500" : "text-teal-700";
  const disabledCls = disabled
    ? "cursor-default select-none opacity-70 pointer-events-none"
    : "";
  const comingSoonBadge = disabled ? (
    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
      Coming Soon
    </span>
  ) : (
    <svg
      className="h-4 w-4 shrink-0 text-stone-300 transition-transform duration-150 group-hover:translate-x-0.5"
      fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  );

  const inner = (
    <>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconCls}`}>
        <Icon size={16} strokeWidth={1.8} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-medium ${danger ? "text-red-600" : "text-neutral-900"}`}>
          {label}
        </p>
        <p className="mt-0.5 text-xs text-stone-400">{sublabel}</p>
      </div>
      {comingSoonBadge}
    </>
  );

  if (href && !disabled) {
    return (
      <a
        href={href}
        className={`group flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 transition-all duration-150 hover:bg-stone-50 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${disabledCls}`}
      >
        {inner}
      </a>
    );
  }

  if (onClick && !disabled) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 text-left transition-all duration-150 hover:bg-stone-50 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${disabledCls}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 last:border-b-0 ${disabledCls}`}
      aria-disabled={disabled ? "true" : undefined}
      role={disabled ? "button" : undefined}
      tabIndex={disabled ? -1 : undefined}
    >
      {inner}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function LoginActivityPage() {
  const session = useCurrentSession();

  const handleSignOutAll = () => {
    if (!window.confirm("Sign out of all devices? You will also be signed out of this session.")) return;
    localStorage.removeItem("gt_token");
    localStorage.removeItem("user");
    window.location.href = "/explore";
  };

  return (
    <>
      <SettingsScreenHeader
        title="Login Activity"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb
        crumbs={nestedCrumbs("account-security", "Login Activity")}
      />

      {/* Page description */}
      <p className="px-4 pb-1 pt-2 text-xs text-stone-500">
        Review where your Rovvy account is currently signed in and monitor recent login events.
      </p>

      {/* ── Current session ──────────────────────── */}
      <div className="mt-3 px-3">
        <p className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-stone-400">
          Current session
        </p>
        {session ? (
          <CurrentSessionCard session={session} />
        ) : (
          /* SSR / hydration skeleton */
          <div className="h-[176px] animate-pulse rounded-2xl border border-stone-100 bg-stone-50" />
        )}
      </div>

      {/* ── Recent sign-ins ───────────────────────── */}
      <div className="mt-4 bg-white">
        <SettingsSectionTitle>Recent sign-ins</SettingsSectionTitle>
        <HistoryEmptyState />
      </div>

      {/* ── Suspicious activity notice ────────────── */}
      <SuspiciousNotice />

      {/* ── Security actions ──────────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Security actions</SettingsSectionTitle>

        <ActionRow
          icon={KeyRound}
          label="Change password"
          sublabel="Update your password if you suspect account compromise"
          href="/settings/account-security/password-signin"
        />
        <ActionRow
          icon={Shield}
          label="Two-factor authentication"
          sublabel="Add a second layer of protection to your sign-in"
          href="/settings/account-security/two-factor"
        />
        <ActionRow
          icon={Smartphone}
          label="Trusted devices"
          sublabel="Review and remove devices that have access to your account"
          href="/settings/account-security/devices"
        />
        <ActionRow
          icon={RefreshCw}
          label="Sign out other sessions"
          sublabel="Revoke access from every device except this one"
          disabled
        />
        <ActionRow
          icon={Lock}
          label="Lock account temporarily"
          sublabel="Pause access while you investigate suspicious activity"
          disabled
        />
      </div>

      {/* ── Sign out all ──────────────────────────── */}
      <div className="mx-3 mt-4 mb-2">
        <button
          type="button"
          onClick={handleSignOutAll}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-left transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label="Sign out of all devices"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-white">
            <LogOut size={17} strokeWidth={1.8} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-red-600">
              Sign out of all devices
            </p>
            <p className="mt-0.5 text-xs text-red-400">
              Immediately ends every active Rovvy session.
            </p>
          </div>
          <ShieldAlert size={16} className="shrink-0 text-red-300" />
        </button>
      </div>

      {/* ── Security tips ─────────────────────────── */}
      <div className="mx-3 mt-3 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3.5">
        <p className="mb-2 text-[12px] font-semibold text-teal-800">
          Keep your account safe
        </p>
        <ul className="space-y-1.5" role="list">
          {[
            "Never share your password or OTP codes with anyone.",
            "Sign out from devices you no longer use.",
            "Enable two-factor authentication for extra protection.",
            "Regularly review connected accounts and active sessions.",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-teal-500" />
              <p className="text-[11px] leading-snug text-teal-700">{tip}</p>
            </li>
          ))}
        </ul>
      </div>

      <SettingsPageFooter />
    </>
  );
}
