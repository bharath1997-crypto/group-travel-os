"use client";

import Link from "next/link";
import { MapPin, Plane, ExternalLink } from "lucide-react";
import type { TravelHandoffContext } from "@/lib/travel-handoff";
import { buildSkyscannerSearchUrl, skyscannerAffiliateConfigured } from "@/lib/travel-handoff";

type Props = {
  handoff: TravelHandoffContext;
  showSkyscanner?: boolean;
  className?: string;
};

export default function TravelHandoffBanner({
  handoff,
  showSkyscanner = true,
  className = "",
}: Props) {
  const skyscannerUrl = showSkyscanner ? buildSkyscannerSearchUrl(handoff) : null;
  const originLabel = handoff.origin.city || handoff.origin.name;
  const destLabel = handoff.destination.city || handoff.destination.name;

  return (
    <div
      className={`rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/90 to-white px-4 py-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-teal-700">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            From Live map
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {originLabel} → {destLabel}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {handoff.destination.name}
            {handoff.destination.country ? ` · ${handoff.destination.country}` : ""}
          </p>
          {handoff.originIata && handoff.destinationIata ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Flight search pre-filled: {handoff.originIata} → {handoff.destinationIata}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-amber-800">
              Enter airport codes if needed — ground legs use city names below.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Link
            href="/live"
            className="text-[11px] font-semibold text-teal-700 hover:underline"
          >
            Back to Live map
          </Link>
          {skyscannerUrl ? (
            <a
              href={skyscannerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <Plane className="h-3.5 w-3.5 text-sky-600" />
              Compare on Skyscanner
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          ) : null}
        </div>
      </div>
      {showSkyscanner && !skyscannerAffiliateConfigured() && skyscannerUrl ? (
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          Skyscanner opens in a new tab (no API key). Add{" "}
          <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SKYSCANNER_AFFILIATE_URL</code>{" "}
          from your Impact partner dashboard to enable affiliate tracking.
        </p>
      ) : null}
    </div>
  );
}
