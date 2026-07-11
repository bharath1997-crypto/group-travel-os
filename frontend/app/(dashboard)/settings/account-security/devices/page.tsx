"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Globe,
  Laptop,
  LayoutGrid,
  Lock,
  LogOut,
  MapPin,
  Monitor,
  RefreshCw,
  Shield,
  Smartphone,
  Trash2,
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
// Browser / OS detection
// ─────────────────────────────────────────────
interface DeviceInfo {
  browser:  string;
  os:       string;
  type:     "desktop" | "laptop" | "mobile" | "tablet";
  raw:      string;
}

function detectDevice(ua: string): DeviceInfo {
  let browser = "Web Browser";
  if      (/Edg\//.test(ua))                             browser = "Microsoft Edge";
  else if (/OPR\/|Opera/.test(ua))                       browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua))  browser = "Chrome";
  else if (/Firefox\//.test(ua))                         browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua))  browser = "Safari";
  else if (/MSIE|Trident/.test(ua))                      browser = "Internet Explorer";

  let os = "Unknown";
  if      (/Windows NT 10/.test(ua))   os = "Windows 11/10";
  else if (/Windows NT 6\.3/.test(ua)) os = "Windows 8.1";
  else if (/Windows NT/.test(ua))      os = "Windows";
  else if (/iPhone/.test(ua))          os = "iPhone (iOS)";
  else if (/iPad/.test(ua))            os = "iPad (iPadOS)";
  else if (/Android/.test(ua))         os = "Android";
  else if (/Mac OS X/.test(ua))        os = "macOS";
  else if (/Linux/.test(ua))           os = "Linux";

  let type: DeviceInfo["type"] = "desktop";
  if (/iPhone/.test(ua))                type = "mobile";
  else if (/iPad|Android.*Tablet/.test(ua)) type = "tablet";
  else if (/Android/.test(ua))          type = "mobile";
  else if (/macOS|Mac OS X/.test(os) || /Laptop/.test(ua)) type = "laptop";

  return { browser, os, type, raw: ua };
}

function timezoneCity() {
  const tz   = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  return { tz, city };
}

function jwtIssuedAt(token: string | null): Date | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.iat ? new Date(payload.iat * 1000) : null;
  } catch { return null; }
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec  = Math.floor(diff / 1000);
  const min  = Math.floor(sec / 60);
  const hr   = Math.floor(min / 60);
  const day  = Math.floor(hr / 24);
  if (sec < 60)  return "Just now";
  if (min < 60)  return `${min}m ago`;
  if (hr  < 24)  return `${hr}h ago`;
  if (day < 7)   return `${day}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────
// Device icon
// ─────────────────────────────────────────────
function DeviceIcon({
  type,
  className = "text-teal-700",
  size = 18,
}: {
  type: DeviceInfo["type"];
  className?: string;
  size?: number;
}) {
  const props = { size, strokeWidth: 1.8, className };
  if (type === "mobile")  return <Smartphone {...props} />;
  if (type === "tablet")  return <Smartphone {...props} />;
  if (type === "laptop")  return <Laptop     {...props} />;
  return                         <Monitor    {...props} />;
}

// ─────────────────────────────────────────────
// Current device card
// ─────────────────────────────────────────────
interface CurrentDevice {
  info:     DeviceInfo;
  city:     string;
  tz:       string;
  signedIn: Date | null;
}

function CurrentDeviceCard({ device }: { device: CurrentDevice }) {
  const { info, city, tz, signedIn } = device;

  return (
    <div className="mx-1 overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white">
      {/* Accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-teal-400 to-teal-600" aria-hidden="true" />

      <div className="px-4 py-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-white shadow-sm">
            <DeviceIcon type={info.type} size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-neutral-900">
                {info.browser}
              </p>
              <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-teal-700">
                THIS DEVICE
              </span>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">{info.os}</p>
          </div>
        </div>

        {/* Detail grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2.5">
            <MapPin size={13} className="shrink-0 text-teal-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Location</p>
              <p className="truncate text-[12px] font-semibold text-neutral-800">{city}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2.5">
            <Globe size={13} className="shrink-0 text-teal-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Timezone</p>
              <p className="truncate text-[12px] font-semibold text-neutral-800">{tz.split("/")[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2.5">
            <Clock size={13} className="shrink-0 text-teal-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Signed in</p>
              <p className="truncate text-[12px] font-semibold text-neutral-800">
                {signedIn ? relativeTime(signedIn) : "Active now"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-white px-3 py-2.5">
            <CheckCircle2 size={13} className="shrink-0 text-teal-500" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Status</p>
              <p className="truncate text-[12px] font-semibold text-teal-700">Active</p>
            </div>
          </div>
        </div>

        {/* Device type label */}
        <div className="mt-3 flex items-center gap-2">
          <DeviceIcon type={info.type} size={13} className="text-stone-400" />
          <p className="text-[11px] text-stone-400 capitalize">
            {info.type === "mobile" ? "Mobile device" : info.type === "tablet" ? "Tablet" : info.type === "laptop" ? "Laptop / portable" : "Desktop computer"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Mock "other device" placeholder row
// (shows what the UI will look like when backend arrives)
// ─────────────────────────────────────────────
function MockDeviceRow({
  icon,
  browser,
  os,
  location,
  lastSeen,
}: {
  icon: DeviceInfo["type"];
  browser: string;
  os: string;
  location: string;
  lastSeen: string;
}) {
  return (
    <div
      className="flex cursor-default select-none items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 opacity-50 last:border-b-0"
      aria-hidden="true"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-50">
        <DeviceIcon type={icon} size={16} className="text-stone-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-neutral-700">{browser}</p>
        <p className="mt-0.5 text-xs text-stone-400">
          {os} · {location} · {lastSeen}
        </p>
      </div>
      <button
        type="button"
        disabled
        aria-label="Remove device (not yet available)"
        className="flex h-7 w-7 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-300"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Disabled action row
// ─────────────────────────────────────────────
function ComingSoonRow({
  icon: Icon,
  label,
  sublabel,
  last,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  last?: boolean;
}) {
  return (
    <div
      role="button"
      aria-disabled="true"
      tabIndex={-1}
      className={`flex cursor-default select-none items-center gap-3.5 px-4 py-3.5 opacity-80 pointer-events-none ${last ? "" : "border-b border-stone-100"}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
        <Icon size={16} strokeWidth={1.8} className="text-teal-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-neutral-900/80">{label}</p>
        <p className="mt-0.5 text-xs text-stone-400/80">{sublabel}</p>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
        Coming Soon
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Custom hook — read device info client-side
// ─────────────────────────────────────────────
function useCurrentDevice(): CurrentDevice | null {
  const [device, setDevice] = useState<CurrentDevice | null>(null);
  useEffect(() => {
    const info     = detectDevice(navigator.userAgent);
    const { city, tz } = timezoneCity();
    const token    = localStorage.getItem("gt_token");
    const signedIn = jwtIssuedAt(token);
    setDevice({ info, city, tz, signedIn });
  }, []);
  return device;
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function DevicesPage() {
  const device = useCurrentDevice();

  const handleSignOutAll = () => {
    if (!window.confirm("Sign out of all devices? You will also be signed out of this session.")) return;
    localStorage.removeItem("gt_token");
    localStorage.removeItem("user");
    window.location.href = "/explore";
  };

  return (
    <>
      <SettingsScreenHeader
        title="Trusted Devices"
        backHref="/settings/account-security"
      />
      <SettingsBreadcrumb crumbs={nestedCrumbs("account-security", "Devices")} />

      <p className="px-4 pb-1 pt-2 text-xs text-stone-500">
        See the devices currently signed in to your Rovvy account and manage access.
      </p>

      {/* ── This device ──────────────────────────── */}
      <div className="mt-3 px-3">
        <p className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-stone-400">
          This device
        </p>
        {device ? (
          <CurrentDeviceCard device={device} />
        ) : (
          <div className="h-[196px] animate-pulse rounded-2xl border border-stone-100 bg-stone-50" />
        )}
      </div>

      {/* ── Other trusted devices ────────────────── */}
      <div className="mt-4 bg-white">
        <SettingsSectionTitle>Other trusted devices</SettingsSectionTitle>

        {/* Preview of future layout with mock rows */}
        <MockDeviceRow
          icon="mobile"
          browser="Safari"
          os="iPhone (iOS)"
          location="Chicago"
          lastSeen="2 days ago"
        />
        <MockDeviceRow
          icon="laptop"
          browser="Chrome"
          os="macOS"
          location="New York"
          lastSeen="5 days ago"
        />

        {/* Overlay explaining this is a preview */}
        <div className="border-t border-stone-100 px-4 py-4">
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3">
            <RefreshCw size={14} className="mt-0.5 shrink-0 text-stone-400" />
            <div>
              <p className="text-[12px] font-semibold text-stone-600">
                Device list preview
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-stone-400">
                The rows above show how your other signed-in devices will
                appear. Real device tracking and removal will be available
                when session management launches.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Device management actions ─────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Device management</SettingsSectionTitle>
        <ComingSoonRow
          icon={Trash2}
          label="Remove individual device"
          sublabel="Sign out and remove a specific device from your account"
        />
        <ComingSoonRow
          icon={RefreshCw}
          label="Sign out other devices"
          sublabel="Revoke access from every device except this one"
        />
        <ComingSoonRow
          icon={LayoutGrid}
          label="Trusted device list"
          sublabel="Approve new devices before granting full account access"
          last
        />
      </div>

      {/* ── About trusted devices ─────────────────── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>About device security</SettingsSectionTitle>

        <div className="border-b border-stone-100 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <Laptop size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">What is a trusted device?</p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                A trusted device is any browser or app where you are currently signed in
                to Rovvy. Each active session represents one device.
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-stone-100 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <Lock size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">JWT session security</p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                Sessions are secured with signed JSON Web Tokens. Removing a device
                invalidates its token so it can no longer access your account.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50">
              <Shield size={16} strokeWidth={1.8} className="text-teal-700" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-neutral-900">Protect lost devices immediately</p>
              <p className="mt-0.5 text-xs leading-snug text-stone-400">
                If a device is lost or stolen, change your password right away. This
                will invalidate all existing sessions across every device.
              </p>
            </div>
          </div>
        </div>
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
            <p className="text-[14px] font-semibold text-red-600">Sign out of all devices</p>
            <p className="mt-0.5 text-xs text-red-400">
              Ends every active session — including this one.
            </p>
          </div>
        </button>
      </div>

      {/* ── Security tips ─────────────────────────── */}
      <div className="mx-3 mt-3 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3.5">
        <p className="mb-2 text-[12px] font-semibold text-teal-800">Security tips</p>
        <ul className="space-y-1.5" role="list">
          {[
            "Sign out of Rovvy on shared or public computers.",
            "If you lose a device, change your password immediately.",
            "Enable two-factor authentication to prevent unauthorised logins.",
            "Review this page regularly to check for unfamiliar devices.",
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
