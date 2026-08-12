"use client";

import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import type { FlightSortMode } from "@/lib/flight-types";

type Props = {
  sortMode: FlightSortMode;
  activeFilterCount: number;
  resultCount: number;
  onOpenFilters: () => void;
  onOpenSort: () => void;
};

export default function FlightResultsToolbar({
  sortMode,
  activeFilterCount,
  resultCount,
  onOpenFilters,
  onOpenSort,
}: Props) {
  const sortLabel =
    sortMode === "best"
      ? "Rovvy Recommended"
      : sortMode === "cheapest"
        ? "Cheapest"
        : sortMode === "fastest"
          ? "Fastest"
          : "Earliest";

  return (
    <div className="sticky top-16 z-20 -mx-1 rounded-xl border border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-sm lg:hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800"
        >
          <SlidersHorizontal className="h-4 w-4 text-teal-600" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onOpenSort}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800"
        >
          <ArrowUpDown className="h-4 w-4 text-teal-600" />
          {sortLabel}
        </button>
      </div>
      <p className="mt-2 px-1 text-center text-[11px] font-medium text-slate-500">
        {resultCount} live {resultCount === 1 ? "fare" : "fares"} shown
      </p>
    </div>
  );
}
