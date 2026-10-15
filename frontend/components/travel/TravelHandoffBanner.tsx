"use client";

import Link from "next/link";
import { MapPin, Route } from "lucide-react";
import type { TravelHandoffContext } from "@/lib/travel-handoff";
import { buildTravelHandoffPath } from "@/lib/travel-handoff";

type Props = {
  handoff: TravelHandoffContext;
  className?: string;
};

export default function TravelHandoffBanner({ handoff, className = "" }: Props) {
  const originLabel = handoff.origin.city || handoff.origin.name;
  const destLabel = handoff.destination.city || handoff.destination.name;
  const routesHref = buildTravelHandoffPath(
    "routes",
    {
      name: handoff.destination.name,
      city: handoff.destination.city,
      state: handoff.destination.state,
      country: handoff.destination.country,
      lat: handoff.destination.lat ?? 0,
      lng: handoff.destination.lng ?? 0,
    },
    handoff.origin,
  );

  return (
    <div
      className={`rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/90 to-white px-4 py-3 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-primary">
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
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Link href="/live" className="text-[11px] font-semibold text-primary hover:underline">
            Back to Live map
          </Link>
          <Link
            href={routesHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <Route className="h-3.5 w-3.5 text-teal-700" />
            Open directions in Routes
          </Link>
        </div>
      </div>
    </div>
  );
}
