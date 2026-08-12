"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info, Sparkles } from "lucide-react";
import type { FlightJourney } from "@/lib/flight-types";
import { formatClock, formatDuration, stopsLabel } from "@/lib/flight-format";
import {
  connectionAirportCodes,
  connectionProtectionLabel,
  getConnectionProtectionStatus,
  isOfferExpired,
  isRecommendedJourney,
  sliceHeading,
} from "@/lib/flight-journey-ui";
import AirlineIdentity from "@/components/travel/AirlineIdentity";
import FlightJourneyTimeline from "@/components/travel/FlightJourneyTimeline";
import FlightPricePanel from "@/components/travel/FlightPricePanel";

type Props = {
  journey: FlightJourney;
  roundTrip?: boolean;
  sortedJourneys: FlightJourney[];
  sortMode: import("@/lib/flight-types").FlightSortMode;
  onSelect: () => void;
  onDetails?: () => void;
  travelerCount?: number;
};

function ProtectionBadge({ journey }: { journey: FlightJourney }) {
  const status = getConnectionProtectionStatus(journey);
  if (!status) return null;

  const tone =
    status === "protected"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "not_confirmed"
        ? "border-slate-200 bg-slate-50 text-slate-600"
        : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {connectionProtectionLabel(status)}
    </span>
  );
}

function SliceSummary({
  slice,
  label,
}: {
  slice: FlightJourney["slices"][number];
  label: string;
}) {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;

  const connectionCodes = slice.connections.map((connection) => connection.airport).filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-[11px] font-medium text-slate-500">
          {formatDuration(slice.duration_minutes)} · {stopsLabel(slice.stops)}
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{formatClock(first.departure_at)}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{first.origin}</p>
        </div>
        <div className="text-center text-[10px] font-medium text-slate-500">
          {connectionCodes.length > 0 ? `via ${connectionCodes.join(", ")}` : "Direct"}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{formatClock(last.arrival_at)}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{last.destination}</p>
        </div>
      </div>
    </div>
  );
}

export default function FlightOfferCard({
  journey,
  roundTrip = false,
  sortedJourneys,
  sortMode,
  onSelect,
  onDetails,
  travelerCount = 1,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const recommended = isRecommendedJourney(journey, sortedJourneys, sortMode);
  const expired = isOfferExpired(journey.expires_at);
  const primarySegment = journey.slices[0]?.segments[0];
  const operatingName =
    primarySegment?.operating_airline_name || primarySegment?.operating_airline_code || undefined;

  return (
    <article
      className={`relative rounded-xl border bg-white p-4 md:p-5 transition-colors ${
        recommended ? "border-teal-400 ring-1 ring-teal-500/15" : "border-slate-200 hover:border-teal-200"
      }`}
    >
      {recommended ? (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-teal-600 px-3 py-0.5 text-[11px] font-bold text-white">
          <Sparkles className="h-3 w-3" />
          <span>Rovvy Recommended</span>
          {journey.recommendation_reason ? (
            <span className="sr-only">{journey.recommendation_reason}</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <AirlineIdentity
              airlineCodes={journey.airlines}
              primaryName={primarySegment?.airline_name}
              operatingName={operatingName}
              flightNumber={primarySegment?.flight_number}
            />
            <ProtectionBadge journey={journey} />
          </div>

          {journey.slices.length > 1 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {journey.slices.map((slice, index) => (
                <SliceSummary
                  key={`${slice.origin}-${index}`}
                  slice={slice}
                  label={sliceHeading(index, journey.slices.length, roundTrip)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <p className="text-lg font-bold text-slate-900">{formatClock(journey.departure_at)}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{journey.origin}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-slate-500">
                  {formatDuration(journey.total_duration_minutes || journey.duration_minutes)}
                </p>
                <p className="text-[11px] font-semibold text-slate-600">{stopsLabel(journey.stops)}</p>
                {connectionAirportCodes(journey).length > 0 ? (
                  <p className="text-[10px] text-slate-500">{connectionAirportCodes(journey).join(", ")}</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">{formatClock(journey.arrival_at)}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{journey.destination}</p>
              </div>
            </div>
          )}

          {recommended && journey.recommendation_reason ? (
            <p className="text-xs leading-relaxed text-teal-700">{journey.recommendation_reason}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Hide segment timeline" : "View segment timeline"}
            </button>
            {onDetails ? (
              <button
                type="button"
                onClick={onDetails}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
              >
                <Info className="h-4 w-4" />
                Fare details
              </button>
            ) : null}
          </div>

          {expanded ? (
            <FlightJourneyTimeline slices={journey.slices} roundTrip={roundTrip} compact />
          ) : null}
        </div>

        <FlightPricePanel
          journey={journey}
          travelerCount={travelerCount}
          onSelect={onSelect}
          expired={expired}
        />
      </div>
    </article>
  );
}
