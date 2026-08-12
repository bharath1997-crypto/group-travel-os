"use client";

import { LIVE_DATA_DISCLAIMER, WAYRA_DATA_DISCLAIMER } from "./wiki-about-display";

type Props = {
  variant?: "verified" | "ai" | "area";
  className?: string;
};

const VARIANTS = {
  verified: {
    badge: "Verified source",
    badgeClass: "bg-teal-50 text-primary",
    detail: "OpenStreetMap / Rovvy Places",
  },
  ai: {
    badge: "AI estimate",
    badgeClass: "bg-violet-50 text-violet-800",
    detail: "Generated guidance — verify before booking",
  },
  area: {
    badge: "Area info",
    badgeClass: "bg-amber-100 text-amber-900",
    detail: "Regional context — may not match this exact pin",
  },
} as const;

export function LiveDataTrustBadge({ variant = "verified", className = "" }: Props) {
  const row = VARIANTS[variant];
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${row.badgeClass}`}
      >
        {row.badge}
      </span>
      <span className="text-[10px] text-stone-500">{row.detail}</span>
    </div>
  );
}

export function LiveDataTrustFooter({
  showWayraNote = false,
  className = "",
}: {
  showWayraNote?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-1 border-t border-stone-100 pt-2 ${className}`}>
      <p className="text-[10px] leading-snug text-stone-500">{LIVE_DATA_DISCLAIMER}</p>
      {showWayraNote ? (
        <p className="text-[10px] leading-snug text-stone-500">{WAYRA_DATA_DISCLAIMER}</p>
      ) : null}
    </div>
  );
}
