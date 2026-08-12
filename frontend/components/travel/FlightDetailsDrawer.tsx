"use client";

import { X } from "lucide-react";
import type { FlightOfferDetail } from "@/lib/flight-types";
import { formatClock, formatDuration, formatPriceExact, stopsLabel } from "@/lib/flight-format";

type Props = {
  offer: FlightOfferDetail | null;
  loading?: boolean;
  onClose: () => void;
};

function LayoverBlock({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  return (
    <div className="my-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">
      Layover · {formatDuration(minutes)}
    </div>
  );
}

export default function FlightDetailsDrawer({ offer, loading = false, onClose }: Props) {
  if (!offer && !loading) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-slate-900/40">
      <button type="button" aria-label="Close details" className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Flight details</h2>
            {offer ? (
              <p className="text-xs text-slate-500">
                {offer.origin} → {offer.destination}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-24 rounded bg-slate-100" />
            </div>
          ) : offer ? (
            <>
              {offer.slices.map((slice, sliceIdx) => (
                <div key={`${slice.origin}-${sliceIdx}`} className="mb-6">
                  {offer.slices.length > 1 ? (
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {sliceIdx === 0 ? "Outbound" : "Return"} · {slice.origin} → {slice.destination}
                    </p>
                  ) : null}
                  {slice.segments.map((seg, idx) => {
                    const prev = idx > 0 ? slice.segments[idx - 1] : null;
                    let layoverMin = 0;
                    if (prev) {
                      const arrive = new Date(prev.arrival_at).getTime();
                      const depart = new Date(seg.departure_at).getTime();
                      layoverMin = Math.max(0, Math.round((depart - arrive) / 60_000));
                    }
                    return (
                      <div key={`${seg.flight_number}-${idx}`}>
                        {idx > 0 ? <LayoverBlock minutes={layoverMin} /> : null}
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-sm font-bold text-slate-900">
                            {seg.airline_name || seg.airline_code} {seg.flight_number}
                          </p>
                          {seg.airline_name && seg.airline_code && seg.airline_name.toLowerCase() !== seg.airline_code.toLowerCase() ? (
                            <p className="mt-0.5 text-xs text-slate-500 font-medium">
                              Operated by {seg.airline_name}
                            </p>
                          ) : null}
                          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-3 text-sm">

                            <div>
                              <p className="font-bold text-slate-900">{formatClock(seg.departure_at)}</p>
                              <p className="text-slate-600">{seg.origin}</p>
                              {seg.origin_terminal ? (
                                <p className="text-xs text-slate-500">Terminal {seg.origin_terminal}</p>
                              ) : null}
                            </div>
                            <div className="pt-1 text-center text-xs text-slate-500">
                              ↓
                              <br />
                              {formatDuration(seg.duration_minutes)}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-900">{formatClock(seg.arrival_at)}</p>
                              <p className="text-slate-600">{seg.destination}</p>
                              {seg.destination_terminal ? (
                                <p className="text-xs text-slate-500">Terminal {seg.destination_terminal}</p>
                              ) : null}
                            </div>
                          </div>
                          {seg.aircraft ? (
                            <p className="mt-2 text-xs text-slate-500">Aircraft: {seg.aircraft}</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <p className="mt-2 text-xs text-slate-500">{stopsLabel(slice.stops)} total</p>
                </div>
              ))}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">{formatPriceExact(offer.currency, offer.price)} total</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  <li>Cabin: {offer.cabin_class}</li>
                  {offer.carry_on_included !== null ? (
                    <li>{offer.carry_on_included ? "Carry-on included" : "Carry-on not included"}</li>
                  ) : null}
                  {offer.checked_bag_included !== null ? (
                    <li>{offer.checked_bag_included ? "Checked bag included" : "Checked bag not included"}</li>
                  ) : null}
                  {offer.refundable !== null ? (
                    <li>{offer.refundable ? "Refundable fare" : "Non-refundable"}</li>
                  ) : null}
                  {offer.changeable !== null ? (
                    <li>{offer.changeable ? "Changes allowed" : "Changes restricted"}</li>
                  ) : null}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
