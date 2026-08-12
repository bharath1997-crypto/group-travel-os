"use client";

import { useEffect, useRef } from "react";
import { RotateCcw, X } from "lucide-react";
import type { FlightFilters } from "@/lib/flight-format";
import type { FlightJourney } from "@/lib/flight-types";
import FlightFilterPanel from "@/components/travel/FlightFilterPanel";

type Props = {
  open: boolean;
  title: string;
  filters: FlightFilters;
  draftFilters: FlightFilters;
  airlines: string[];
  maxPrice: number;
  minPriceNonstop?: number | null;
  minPriceOneStop?: number | null;
  currency?: string;
  maxDuration?: number;
  journeys?: FlightJourney[];
  resultCount: number;
  onChangeDraft: (next: FlightFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
};

export default function FlightMobileFiltersDrawer({
  open,
  title,
  draftFilters,
  airlines,
  maxPrice,
  minPriceNonstop,
  minPriceOneStop,
  currency,
  maxDuration,
  journeys = [],
  resultCount,
  onChangeDraft,
  onApply,
  onReset,
  onClose,
}: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close drawer backdrop" className="absolute inset-0" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-slate-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-base font-bold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">Refine live results</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-3 py-3">
          <FlightFilterPanel
            filters={draftFilters}
            airlines={airlines}
            maxPrice={maxPrice}
            maxDuration={maxDuration}
            journeys={journeys}
            minPriceNonstop={minPriceNonstop}
            minPriceOneStop={minPriceOneStop}
            currency={currency}
            onChange={onChangeDraft}
            embedded
          />
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={onApply}
              className="inline-flex min-h-11 flex-[2] items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-bold text-white"
            >
              Apply · {resultCount} {resultCount === 1 ? "flight" : "flights"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
