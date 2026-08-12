"use client";

import { SlidersHorizontal, RotateCcw } from "lucide-react";
import type { FlightFilters } from "@/lib/flight-format";
import { createDefaultFilters, formatDuration, formatPrice } from "@/lib/flight-format";
import type { FlightJourney } from "@/lib/flight-types";

type Props = {
  filters: FlightFilters;
  airlines: string[];
  maxPrice: number;
  maxDuration?: number;
  journeys?: FlightJourney[];
  minPriceNonstop?: number | null;
  minPriceOneStop?: number | null;
  currency?: string;
  onChange: (next: FlightFilters) => void;
  embedded?: boolean;
};

const BUCKETS: Array<{ id: FlightFilters["departureBuckets"][number]; label: string; time: string }> = [
  { id: "morning", label: "Morning", time: "05:00 - 11:59" },
  { id: "afternoon", label: "Afternoon", time: "12:00 - 17:59" },
  { id: "evening", label: "Evening", time: "18:00 - 21:59" },
  { id: "night", label: "Night", time: "22:00 - 04:59" },
];

export default function FlightFilterPanel({
  filters,
  airlines,
  maxPrice,
  maxDuration = 24 * 60,
  journeys = [],
  minPriceNonstop,
  minPriceOneStop,
  currency = "USD",
  onChange,
  embedded = false,
}: Props) {
  const toggleAirline = (code: string) => {
    const set = new Set(filters.airlines);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    onChange({ ...filters, airlines: [...set] });
  };

  const toggleBucket = (id: FlightFilters["departureBuckets"][number]) => {
    const set = new Set(filters.departureBuckets);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...filters, departureBuckets: [...set] });
  };

  const resetFilters = () => onChange(createDefaultFilters());

  const hasActiveFilters =
    filters.nonstopOnly ||
    filters.maxStops !== null ||
    filters.airlines.length > 0 ||
    filters.departureBuckets.length > 0 ||
    filters.maxPrice !== null ||
    filters.maxDurationMinutes !== null ||
    filters.baggageIncluded ||
    filters.refundableOnly ||
    filters.changeableOnly;

  const hasBaggageData = journeys.some(
    (journey) => journey.carry_on_included !== null || journey.checked_bag_included !== null,
  );
  const hasFlexData = journeys.some(
    (journey) => journey.refundable !== null || journey.changeable !== null,
  );

  return (
    <div
      className={
        embedded
          ? "space-y-6"
          : "space-y-6 rounded-xl border border-slate-200 bg-white p-4 md:p-5"
      }
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Filters</h3>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-bold text-teal-700 hover:text-teal-800"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Stops</p>
        <div className="space-y-2 text-xs font-medium text-slate-700">
          <label className="flex cursor-pointer items-center justify-between rounded-lg p-1.5 hover:bg-slate-50">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.nonstopOnly}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    nonstopOnly: e.target.checked,
                    maxStops: e.target.checked ? 0 : null,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Nonstop only</span>
            </div>
            {minPriceNonstop ? (
              <span className="text-[11px] font-bold text-slate-500">{formatPrice(currency, minPriceNonstop)}</span>
            ) : (
              <span className="text-[10px] text-slate-400">—</span>
            )}
          </label>

          <label className={`flex cursor-pointer items-center justify-between rounded-lg p-1.5 hover:bg-slate-50 ${filters.nonstopOnly ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.maxStops === 1}
                disabled={filters.nonstopOnly}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    maxStops: e.target.checked ? 1 : null,
                    nonstopOnly: false,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
              />
              <span>1 stop max</span>
            </div>
            {minPriceOneStop ? (
              <span className="text-[11px] font-bold text-slate-500">{formatPrice(currency, minPriceOneStop)}</span>
            ) : (
              <span className="text-[10px] text-slate-400">—</span>
            )}
          </label>
        </div>
      </div>

      <div className="space-y-2.5 border-t border-slate-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Outbound departure</p>
        <div className="grid grid-cols-2 gap-2 text-xs font-medium">
          {BUCKETS.map((bucket) => {
            const isSelected = filters.departureBuckets.includes(bucket.id);
            return (
              <button
                key={bucket.id}
                type="button"
                onClick={() => toggleBucket(bucket.id)}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition ${
                  isSelected
                    ? "bg-teal-600 font-bold text-white"
                    : "bg-slate-100/90 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{bucket.label}</span>
                <span className={`mt-0.5 text-[9px] ${isSelected ? "text-teal-100" : "text-slate-400"}`}>
                  {bucket.time}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {airlines.length > 0 ? (
        <div className="space-y-2.5 border-t border-slate-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Airlines</p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1 text-xs font-medium text-slate-700">
            {airlines.map((code) => (
              <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg p-1 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={filters.airlines.includes(code)}
                  onChange={() => toggleAirline(code)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>{code}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2.5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="uppercase tracking-wider text-slate-500">Max budget</span>
          <span className="text-slate-900">{formatPrice(currency, filters.maxPrice ?? Math.ceil(maxPrice))}</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.ceil(maxPrice)}
          value={filters.maxPrice ?? maxPrice}
          onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer accent-teal-600"
        />
      </div>

      <div className="space-y-2.5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="uppercase tracking-wider text-slate-500">Max duration</span>
          <span className="text-slate-900">
            {formatDuration(filters.maxDurationMinutes ?? maxDuration)}
          </span>
        </div>
        <input
          type="range"
          min={60}
          max={maxDuration}
          step={30}
          value={filters.maxDurationMinutes ?? maxDuration}
          onChange={(e) => onChange({ ...filters, maxDurationMinutes: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer accent-teal-600"
        />
      </div>

      {hasBaggageData || hasFlexData ? (
        <div className="space-y-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-700">
          {hasBaggageData ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={filters.baggageIncluded}
                onChange={(e) => onChange({ ...filters, baggageIncluded: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Baggage included</span>
            </label>
          ) : null}
          {hasFlexData ? (
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={filters.refundableOnly}
                  onChange={(e) => onChange({ ...filters, refundableOnly: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Refundable only</span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={filters.changeableOnly}
                  onChange={(e) => onChange({ ...filters, changeableOnly: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>Changeable only</span>
              </label>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
