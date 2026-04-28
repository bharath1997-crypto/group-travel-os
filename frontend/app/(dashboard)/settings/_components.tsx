"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
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
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
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
  icon?: LucideIcon;
  label: string;
  sublabel?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {Icon ? (
          <Icon className="h-6 w-6 shrink-0 text-neutral-800" strokeWidth={1.5} />
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
        <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2} />
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
  icon?: LucideIcon;
  label: string;
  sublabel?: string;
  checked: boolean;
  busy?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
      {Icon ? (
        <Icon className="h-6 w-6 shrink-0 text-neutral-800" strokeWidth={1.5} />
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
        <span className="text-stone-400" aria-hidden>
          🔍
        </span>
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
