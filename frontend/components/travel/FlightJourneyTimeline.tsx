"use client";

import type { FlightJourneySlice } from "@/lib/flight-types";
import { formatClock, formatDuration } from "@/lib/flight-format";
import { sliceHeading } from "@/lib/flight-journey-ui";

type Props = {
  slices: FlightJourneySlice[];
  roundTrip?: boolean;
  compact?: boolean;
};

function LayoverRow({
  airport,
  layoverMinutes,
  overnight,
  airportChange,
  terminalChange,
}: {
  airport: string;
  layoverMinutes: number | null;
  overnight: boolean | null;
  airportChange: boolean | null;
  terminalChange: boolean | null;
}) {
  const warnings: string[] = [];
  if (overnight) warnings.push("Overnight");
  if (airportChange) warnings.push("Airport change");
  if (terminalChange) warnings.push("Terminal change");

  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-amber-200" aria-hidden />
      <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
        <p className="font-semibold">Connection at {airport}</p>
        <p className="mt-0.5 text-amber-800">
          {layoverMinutes != null ? formatDuration(layoverMinutes) : "Layover duration not confirmed"}
          {warnings.length > 0 ? ` · ${warnings.join(" · ")}` : ""}
        </p>
      </div>
    </div>
  );
}

export default function FlightJourneyTimeline({ slices, roundTrip = false, compact = false }: Props) {
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
                <div className="absolute left-2.5 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal-600 shadow-xs" aria-hidden />
                <div className={`${segIdx < slice.segments.length - 1 ? "pb-2" : ""}`}>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {segment.airline_code} {segment.flight_number}
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
                          {segment.origin_terminal ? ` · T${segment.origin_terminal}` : ""}
                        </p>
                      </div>
                      <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
                        {formatDuration(segment.duration_minutes)}
                      </p>
                      <div className="sm:text-right">
                        <p className="text-sm font-bold text-slate-900">{formatClock(segment.arrival_at)}</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {segment.destination}
                          {segment.destination_terminal ? ` · T${segment.destination_terminal}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {slice.connections[segIdx] ? (
                  <LayoverRow
                    airport={slice.connections[segIdx].airport}
                    layoverMinutes={slice.connections[segIdx].layover_minutes}
                    overnight={slice.connections[segIdx].overnight}
                    airportChange={slice.connections[segIdx].airport_change}
                    terminalChange={slice.connections[segIdx].terminal_change}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
