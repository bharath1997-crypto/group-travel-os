"use client";

import type { ReactNode } from "react";

import { LIVE_MAP_NOTICE_STACK_POSITION } from "./live-layout";

type Props = {
  children: ReactNode;
};

/** Bottom-right map notices — toasts, status, cross-border, pick hints (never over the search bar). */
export function LiveMapNoticeStack({ children }: Props) {
  return (
    <div className={`${LIVE_MAP_NOTICE_STACK_POSITION} pointer-events-none flex flex-col items-stretch gap-2`}>
      {children}
    </div>
  );
}

export function LiveMapNoticeToast({ children }: { children: ReactNode }) {
  return (
    <div
      className="pointer-events-auto rounded-xl bg-stone-900/92 px-3 py-2 text-left text-sm leading-snug text-white shadow-[0_4px_20px_rgba(15,23,42,0.35)] backdrop-blur-md"
      role="status"
    >
      {children}
    </div>
  );
}

export function LiveMapNoticeStatusPill({
  label,
  className,
  dotClassName,
  dimmed = false,
}: {
  label: string;
  className: string;
  dotClassName: string;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-current/10 px-3.5 text-xs font-semibold shadow-[0_4px_18px_rgba(15,23,42,0.12)] backdrop-blur-md transition-opacity duration-200 ${className} ${
        dimmed ? "opacity-80" : "opacity-100"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`} />
      {label}
    </div>
  );
}

type CrossBorderAlert = {
  fromCountry: string | null;
  toCountry: string | null;
};

export function LiveMapCrossBorderNotice({
  alert,
  routeHasCrossings,
  hasRouteLine,
}: {
  alert: CrossBorderAlert;
  routeHasCrossings: boolean;
  hasRouteLine: boolean;
}) {
  let routeHint = " Route preview will show the immigration checkpoint on the road.";
  if (routeHasCrossings) {
    routeHint = " Immigration check is marked on your driving route.";
  } else if (hasRouteLine) {
    routeHint = " Calculating immigration checkpoint on your route…";
  }

  return (
    <div
      className="pointer-events-auto rounded-xl border border-amber-300/90 bg-amber-50/95 px-3 py-2.5 text-left text-[11px] font-medium leading-snug text-amber-950 shadow-[0_4px_20px_rgba(245,158,11,0.28)] backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold text-amber-900">
        Cross-border travel
        {alert.fromCountry && alert.toCountry
          ? ` (${alert.fromCountry} → ${alert.toCountry})`
          : ""}
      </p>
      <p className="mt-1 text-amber-900/90">
        Expect passport checks and immigration inspection at the border.
        {routeHint}
      </p>
    </div>
  );
}
