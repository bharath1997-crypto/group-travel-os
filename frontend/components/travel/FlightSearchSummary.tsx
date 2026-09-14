"use client";

import Link from "next/link";
import { Edit2, Plane } from "lucide-react";
import type { FlightSearchParams } from "@/lib/flight-types";
import { CABIN_LABELS, travelerSummary } from "@/lib/flight-types";
import { formatShortDate } from "@/lib/flight-format";
import { buildFlightSearchQuery } from "@/lib/flight-search-params";

type Props = {
  params: FlightSearchParams;
  resultCount?: number;
  loading?: boolean;
};

export default function FlightSearchSummary({ params, resultCount, loading = false }: Props) {
  const fromName = params.fromLabel?.split(",")[0] || params.from;
  const toName = params.toLabel?.split(",")[0] || params.to;
  const editHref = `/flights?${buildFlightSearchQuery(params).toString()}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white shadow-lg shadow-slate-950/10 md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft0 text-white">
          <Plane className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-white md:text-lg">
            {fromName} <span className="font-normal text-slate-400">→</span> {toName}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300 md:text-sm">
            <span>{formatShortDate(params.depart)}</span>
            {params.return ? <span>– {formatShortDate(params.return)}</span> : null}
            <span className="text-slate-300">·</span>
            <span>{travelerSummary(params)}</span>
            <span className="text-slate-300">·</span>
            <span>{CABIN_LABELS[params.cabin]}</span>
            {loading ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-300">Searching live fares…</span>
              </>
            ) : resultCount !== undefined ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-teal-300">
                  {resultCount} {resultCount === 1 ? "flight" : "flights"}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <Link
        href={editHref}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:border-teal-400 hover:bg-slate-700"
      >
        <Edit2 className="h-4 w-4" />
        Edit search
      </Link>
    </div>
  );
}
