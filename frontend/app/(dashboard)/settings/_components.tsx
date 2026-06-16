"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IconArrowLeft, IconChevronRight, IconSearch, type IconComponent } from "@/components/icons";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// ── Accent colour palette ────────────────────────────────────────────────────
// Use string keys so hub pages can pass e.g. accentColor="teal".
// Actual CSS values are used via inline styles so Tailwind purging is never an issue.
const ACCENT = {
  teal:   { bg: "#F0FDFA", fg: "#0F766E" },
  blue:   { bg: "#EFF6FF", fg: "#2563EB" },
  purple: { bg: "#F5F3FF", fg: "#7C3AED" },
  green:  { bg: "#F0FDF4", fg: "#16A34A" },
  orange: { bg: "#FFF7ED", fg: "#EA580C" },
  indigo: { bg: "#EEF2FF", fg: "#4338CA" },
  amber:  { bg: "#FFFBEB", fg: "#D97706" },
  slate:  { bg: "#F8FAFC", fg: "#475569" },
  pink:   { bg: "#FDF2F8", fg: "#DB2777" },
  red:    { bg: "#FEF2F2", fg: "#DC2626" },
} as const;

export type AccentColor = keyof typeof ACCENT;

// ── SettingsScreenHeader ──────────────────────────────────────────────────────
export function SettingsScreenHeader({
  title,
  backHref,
}: {
  title: string;
  backHref: string;
}) {
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[44px_1fr_44px] items-center border-b border-stone-200 bg-white/95 px-1 py-2.5 backdrop-blur-md">
      <Link
        href={backHref}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#1e2a3a] transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
        aria-label="Back"
      >
        <IconArrowLeft size={20} />
      </Link>
      <h1 className="truncate text-center text-[16px] font-bold text-[#1e2a3a]">
        {title}
      </h1>
      <span aria-hidden className="inline-block w-10" />
    </header>
  );
}

// ── SettingsSectionTitle ──────────────────────────────────────────────────────
export function SettingsSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-4 pb-2.5 pt-6 text-[11.5px] font-semibold uppercase tracking-wide text-stone-400">
      {children}
    </h2>
  );
}

// ── SettingsLinkRow ───────────────────────────────────────────────────────────
export function SettingsLinkRow({
  href,
  icon: Icon,
  label,
  sublabel,
  trailing,
  onClick,
}: {
  href?: string;
  icon?: IconComponent;
  label: string;
  sublabel?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {Icon ? (
          <Icon size={24} className="shrink-0" />
        ) : null}
        <div className="min-w-0">
          <p className="text-[15px] leading-snug text-neutral-900">{label}</p>
          {sublabel ? (
            <p className="mt-0.5 text-xs leading-snug text-stone-500">
              {sublabel}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-stone-400">
        {trailing}
        <IconChevronRight size={18} />
      </div>
    </>
  );
  const cls =
    "flex w-full items-start gap-2 border-b border-stone-100 px-4 py-3.5 text-left transition-all duration-150 hover:bg-stone-50 active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

// ── SettingsToggleRow ─────────────────────────────────────────────────────────
export function SettingsToggleRow({
  icon: Icon,
  label,
  sublabel,
  checked,
  busy,
  onToggle,
}: {
  icon?: IconComponent;
  label: string;
  sublabel?: string;
  checked: boolean;
  busy?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
      {Icon ? (
        <Icon size={24} className="shrink-0" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-neutral-900">{label}</p>
        {sublabel ? (
          <p className="mt-0.5 text-xs text-stone-500">{sublabel}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={busy}
        className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-50"
        style={{ background: checked ? "#1d9e75" : "#ccc" }}
        onClick={() => onToggle(!checked)}
      >
        <span
          className="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 26 : 4 }}
        />
      </button>
    </div>
  );
}

// ── SettingsHubCard (main /settings page) ────────────────────────────────────
export function SettingsHubCard({
  href,
  icon: Icon,
  iconBg,
  title,
  description,
  count,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  iconBg: string;
  title: string;
  description: string;
  count?: number;
  badge?: "Coming Soon" | "Beta" | "New";
}) {
  return (
    <Link
      href={href}
      aria-label={`${title} — ${description}`}
      className={[
        "group flex items-center gap-4 rounded-2xl border bg-white px-4 py-4",
        "shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg",
        "active:scale-[0.98] active:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
        "border-stone-100",
      ].join(" ")}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
        style={{ background: iconBg }}
      >
        <Icon size={22} className="text-white" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-semibold text-neutral-900">{title}</p>
          {badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={
                badge === "Beta"
                  ? { background: "#FFF7ED", color: "#C2410C" }
                  : badge === "New"
                  ? { background: "#ECFDF5", color: "#065F46" }
                  : { background: "#F1F5F9", color: "#64748B" }
              }
            >
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-stone-500">{description}</p>
        {count !== undefined && (
          <p className="mt-1 text-[11px] text-stone-400">
            {count} settings
          </p>
        )}
      </div>
      <ChevronRight
        size={18}
        className="shrink-0 text-stone-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-teal-400"
      />
    </Link>
  );
}

// ── SettingsHubRow (rows inside hub subpages) ─────────────────────────────────
export function SettingsHubRow({
  href,
  onClick,
  icon: Icon,
  label,
  sublabel,
  badge,
  danger,
  accentColor,
}: {
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  label: string;
  sublabel?: string;
  badge?: "Coming Soon" | "Beta" | "New";
  danger?: boolean;
  accentColor?: AccentColor;
}) {
  // Resolve icon container & icon tint colours
  const iconBg  = danger ? ACCENT.red.bg  : accentColor ? ACCENT[accentColor].bg  : "#F3F4F6";
  const iconFg  = danger ? ACCENT.red.fg  : accentColor ? ACCENT[accentColor].fg  : "#6B7280";

  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {Icon && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: iconBg }}
          >
            <Icon size={16} strokeWidth={1.8} style={{ color: iconFg }} />
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-[14px] leading-snug ${danger ? "text-red-600" : "text-neutral-900"}`}>
            {label}
          </p>
          {sublabel && (
            <p className="mt-0.5 text-xs leading-snug text-stone-400">{sublabel}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={
              badge === "Beta"
                ? { background: "#FFF7ED", color: "#C2410C" }
                : badge === "New"
                ? { background: "#F0FDF4", color: "#166534" }
                : { background: "#F1F5F9", color: "#94A3B8" }
            }
          >
            {badge}
          </span>
        ) : (
          !danger && (
            <ChevronRight
              size={16}
              className="text-stone-300 transition-transform duration-150 group-hover:translate-x-0.5"
            />
          )
        )}
      </div>
    </>
  );

  const baseClass =
    "group flex w-full items-center gap-2 border-b border-stone-100 px-4 py-3.5 text-left transition-all duration-150";

  if (badge === "Coming Soon") {
    return (
      <div
        className={`${baseClass} cursor-default opacity-50`}
        role="presentation"
        aria-hidden="true"
      >
        {inner}
      </div>
    );
  }

  const interactiveClass = `${baseClass} hover:bg-stone-50 active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500`;

  if (href) {
    return (
      <Link href={href} className={interactiveClass}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={interactiveClass} onClick={onClick}>
      {inner}
    </button>
  );
}

// ── SettingsSearchInput ───────────────────────────────────────────────────────
export function SettingsSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-3 pb-2 pt-3">
      <div className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5">
        <IconSearch size={20} className="shrink-0 text-stone-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search settings"
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-stone-400"
          autoComplete="off"
        />
      </div>
    </div>
  );
}

// ── SettingsPageFooter ────────────────────────────────────────────────────────
export function SettingsPageFooter() {
  return (
    <div className="mt-10 pb-8 text-center">
      <p className="text-[11px] text-stone-400">Rovvy v2.0 &bull; Group Travel OS</p>
      <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
        <a
          href="/privacy"
          className="transition-colors hover:text-stone-600 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          Privacy
        </a>
        <span aria-hidden="true" className="text-stone-300">&bull;</span>
        <a
          href="/terms"
          className="transition-colors hover:text-stone-600 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          Terms
        </a>
        <span aria-hidden="true" className="text-stone-300">&bull;</span>
        <a
          href="/cookie-policy"
          className="transition-colors hover:text-stone-600 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          Cookies
        </a>
      </p>
    </div>
  );
}
