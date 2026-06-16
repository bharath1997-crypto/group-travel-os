"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IconArrowLeft, IconChevronRight, IconSearch, type IconComponent } from "@/components/icons";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

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
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#1e2a3a] hover:bg-stone-100"
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

export function SettingsSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-4 pb-1 pt-5 text-[13px] font-semibold text-stone-500">
      {children}
    </h2>
  );
}

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
    "flex w-full items-start gap-2 border-b border-stone-100 px-4 py-3.5 text-left transition-colors hover:bg-stone-50 active:bg-stone-100";
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

// ── Hub card used on the main /settings page ─────────────────────────────────
export function SettingsHubCard({
  href,
  icon: Icon,
  iconBg,
  title,
  description,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  iconBg: string;
  title: string;
  description: string;
  badge?: "Coming Soon" | "Beta" | "New";
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-stone-100 bg-white px-4 py-4 shadow-sm transition-all hover:border-stone-200 hover:shadow-md active:scale-[0.98]"
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
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
                  ? { background: "#F0FDF4", color: "#166534" }
                  : { background: "#F1F5F9", color: "#64748B" }
              }
            >
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-stone-500">{description}</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-stone-300 transition-colors group-hover:text-stone-400" />
    </Link>
  );
}

// ── Row used inside hub subpages ──────────────────────────────────────────────
export function SettingsHubRow({
  href,
  onClick,
  icon: Icon,
  label,
  sublabel,
  badge,
  danger,
}: {
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  label: string;
  sublabel?: string;
  badge?: "Coming Soon" | "Beta" | "New";
  danger?: boolean;
}) {
  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
            <Icon size={16} className={danger ? "text-red-500" : "text-stone-600"} strokeWidth={1.8} />
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-[14px] leading-snug ${danger ? "text-red-600" : "text-neutral-900"}`}>{label}</p>
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
          !danger && <ChevronRight size={16} className="text-stone-300" />
        )}
      </div>
    </>
  );

  const cls = `flex w-full items-center gap-2 border-b border-stone-100 px-4 py-3.5 text-left transition-colors ${
    badge === "Coming Soon"
      ? "cursor-default opacity-60"
      : "hover:bg-stone-50 active:bg-stone-100"
  }`;

  if (badge === "Coming Soon") {
    return <div className={cls}>{inner}</div>;
  }
  if (href) {
    return <Link href={href} className={cls}>{inner}</Link>;
  }
  return (
    <button type="button" className={cls} onClick={onClick}>{inner}</button>
  );
}

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
        <IconSearch size={20} className="shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search"
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-stone-400"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
