"use client";

import { useState } from "react";
import { Info, ShieldCheck, Sparkles } from "lucide-react";
import type { ProviderStatusRecord } from "@/lib/flight-types";

type Props = {
  environment?: "test" | "live" | null;
  liveMode?: boolean | null;
  providerStatuses?: ProviderStatusRecord[];
  partialResults?: boolean;
};

function providerName(providerId: string): string {
  if (providerId === "duffel") return "Duffel";
  if (providerId === "amadeus") return "Amadeus";
  return providerId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function providerSourceLabel(statuses: ProviderStatusRecord[], isTest: boolean): string {
  const successful = statuses.filter((status) => status.status === "ok");
  const contributing = successful.filter((status) => status.offer_count > 0);
  if (contributing.length === 1) {
    const name = providerName(contributing[0].provider_id);
    if (successful.length > 1) {
      return `${name} returned offers · ${successful.length} providers checked`;
    }
    return isTest ? `Powered by ${name} sandbox` : `Offers from ${name}`;
  }
  if (contributing.length > 1) return `Offers from ${contributing.length} authorized providers`;
  if (successful.length > 0) return `${successful.length} authorized providers checked`;
  return "Authorized provider search";
}

export default function FlightTrustStrip({
  environment = null,
  liveMode = null,
  providerStatuses = [],
  partialResults = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isTest = environment === "test" || liveMode === false;
  const sourceLabel = providerSourceLabel(providerStatuses, isTest);

  return (
    <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {isTest ? "Test airline offers" : "Compare available airline offers"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Prices from authorized providers
          </span>
          <span className="text-slate-500">{sourceLabel}</span>
          {partialResults ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">
              Some providers are temporarily unavailable
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary-soft"
        >
          <Info className="h-3.5 w-3.5" />
          How pricing works
        </button>
      </div>
      {expanded ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {isTest
            ? "These are provider sandbox offers for testing. No real booking will be created."
            : "Rovvy compares flight offers from authorized providers. Availability and prices may change until you complete booking with the selected seller."}
        </p>
      ) : null}
    </section>
  );
}
