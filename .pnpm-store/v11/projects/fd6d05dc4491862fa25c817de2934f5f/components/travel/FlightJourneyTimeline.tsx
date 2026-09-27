"use client";

import { useState } from "react";
import type { FlightConnectionDetail, FlightJourneySlice } from "@/lib/flight-types";
import {
  baggageTransferLabel,
  connectionProtectionLabelFromEnum,
  connectionWarnings,
  selfTransferExplanation,
  selfTransferWhyExplanation,
  ticketTypeLabel,
} from "@/lib/flight-disclosure-ui";
import { formatClock, formatDuration } from "@/lib/flight-format";
import { sliceHeading } from "@/lib/flight-journey-ui";

type Props = {
  slices: FlightJourneySlice[];
  roundTrip?: boolean;
  compact?: boolean;
  providerName?: string;
};

function LayoverRow({
  connection,
  providerName,
}: {
  connection: FlightConnectionDetail;
  providerName?: string;
}) {
  const warnings = connectionWarnings(connection);
  const showSelfTransfer = connection.baggage_transfer === "self_transfer";
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-amber-200" aria-hidden />
      <div className="space-y-2">
        <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">Layover at {connection.airport_name || connection.airport}</p>
          <p className="mt-0.5 text-amber-800">
            {connection.layover_minutes != null ? formatDuration(connection.layover_minutes) : "Layover duration not confirmed"}
            {warnings.length > 0 ? ` · ${warnings.join(" · ")}` : ""}
          </p>
          <p className="mt-1 text-amber-800">
            {connectionProtectionLabelFromEnum(connection.connection_protection || "unknown")}
          </p>
          <p className="mt-0.5 text-amber-800">
            {baggageTransferLabel(connection.baggage_transfer || "unknown", providerName)}
          </p>
          {connection.provider_disclosure_text ? (
            <p className="mt-1 text-amber-900">{connection.provider_disclosure_text}</p>
          ) : null}
        </div>

        {showSelfTransfer ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            <p className="font-bold">Self-transfer required</p>
            <p className="mt-1">{selfTransferExplanation()}</p>
            <button
              type="button"
              onClick={() => setWhyOpen((open) => !open)}
              className="mt-2 font-semibold text-rose-800 underline"
            >
              Why?
            </button>
            {whyOpen ? <p className="mt-2 text-rose-800">{selfTransferWhyExplanation()}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function FlightJourneyTimeline({ slices, roundTrip = false, compact = false, providerName }: Props) {
  return (
    <div className={`space-y-4 ${compact ? "" : "mt-1"}`}>
      {slices.map((slice, sliceIdx) => (
        <div key={`${slice.origin}-${sliceIdx}`} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {sliceHeading(sliceIdx, slices.length, roundTrip)} · {slice.origin} → {slice.destination}
            </p>
            <p className="text-xs font-medium text-slate-500">
              {formatDuration(slice.duration_minutes)} · {slice.stops === 0 ? "Nonstop" : `${slice.stops} connection${slice.stops === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="space-y-2">
            {slice.segments.map((segment, segIdx) => (
              <div key={`${segment.flight_number}-${segIdx}`} className="relative pl-8">
                <div className="absolute left-2.5 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary shadow-xs" aria-hidden />
                <div className={`${segIdx < slice.segments.length - 1 ? "pb-2" : ""}`}>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Flight {segIdx + 1}: {segment.origin} → {segment.destination}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-800">
                          {segment.airline_name || segment.airline_code} {segment.flight_number}
                        </p>
                        {segment.operating_airline_code &&
                        segment.operating_airline_code !== segment.airline_code ? (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Operated by {segment.operating_airline_name || segment.operating_airline_code}
                          </p>
                        ) : null}
                      </div>
                      {segment.aircraft ? (
                        <p className="text-[11px] text-slate-500">{segment.aircraft}</p>
                      ) : null}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{formatClock(segment.departure_at)}</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {segment.origin}
                          {segment.origin_terminal ? ` · T${segment.origin_terminal}` : " · Terminal not supplied by the provider"}
                        </p>
                      </div>
                      <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
                        {formatDuration(segment.duration_minutes)}
                      </p>
                      <div className="sm:text-right">
                        <p className="text-sm font-bold text-slate-900">{formatClock(segment.arrival_at)}</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {segment.destination}
                          {segment.destination_terminal ? ` · T${segment.destination_terminal}` : " · Terminal not supplied by the provider"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {slice.connections[segIdx] ? (
                  <LayoverRow connection={slice.connections[segIdx]} providerName={providerName} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function JourneyDisclosureSummary({
  ticketType,
  connectionProtection,
  baggageTransfer,
  providerName,
}: {
  ticketType?: string;
  connectionProtection?: string;
  baggageTransfer?: string;
  providerName?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <p>{ticketTypeLabel((ticketType as "unknown") || "unknown")}</p>
      <p className="mt-1">{connectionProtectionLabelFromEnum((connectionProtection as "unknown") || "unknown")}</p>
      <p className="mt-1">{baggageTransferLabel((baggageTransfer as "unknown") || "unknown", providerName)}</p>
    </div>
  );
}
