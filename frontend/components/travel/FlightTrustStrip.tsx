"use client";

import { useState } from "react";
import { Info, ShieldCheck, Sparkles } from "lucide-react";

export default function FlightTrustStrip() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            Live airline offers
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
            Secure booking through Rovvy
          </span>
          <span className="text-slate-500">Powered by Duffel</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
        >
          <Info className="h-3.5 w-3.5" />
          How pricing works
        </button>
      </div>
      {expanded ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Rovvy displays live flight offers supplied by its connected booking partners. Availability and
          prices may change until booking is confirmed.
        </p>
      ) : null}
    </section>
  );
}
