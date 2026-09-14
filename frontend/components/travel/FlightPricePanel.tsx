"use client";

import { ArrowRight, Luggage, RefreshCw } from "lucide-react";
import type { FlightJourney } from "@/lib/flight-types";
import { formatExpiresIn, formatPrice } from "@/lib/flight-format";

type Props = {
  journey: FlightJourney;
  travelerCount: number;
  onSelect: () => void;
  expired?: boolean;
  optionCount?: number;
};

function baggageSummary(journey: FlightJourney): string {
  const parts: string[] = [];
  if (journey.carry_on_included === true) parts.push("Carry-on included");
  if (journey.checked_bag_included === true) parts.push("Checked bag included");
  return parts.length > 0 ? parts.join(" · ") : "Not confirmed";
}

function flexibilitySummary(journey: FlightJourney): string {
  const parts: string[] = [];
  if (journey.changeable === true) parts.push("Changeable");
  if (journey.refundable === true) parts.push("Refundable");
  return parts.length > 0 ? parts.join(" · ") : "Not confirmed";
}

export default function FlightPricePanel({
  journey,
  travelerCount,
  onSelect,
  expired = false,
  optionCount = 1,
}: Props) {
  const checkedAt = new Date(journey.checked_at);
  const checkedLabel = Number.isNaN(checkedAt.getTime())
    ? "Price checked recently"
    : `Price checked ${checkedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  const primaryLabel = optionCount > 1 ? "View options" : "View options";

  return (
    <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[220px] lg:text-right">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          From · {travelerCount} {travelerCount === 1 ? "traveler" : "travelers"}
        </p>
        <p className="text-2xl font-extrabold tracking-tight text-slate-900">
          {formatPrice(journey.currency, journey.price)}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">Compare seller options before you continue</p>
      </div>

      <div className="space-y-1 text-[11px] text-slate-600">
        <p className="inline-flex items-center gap-1 font-medium text-emerald-700">
          <RefreshCw className="h-3 w-3" />
          {checkedLabel}
        </p>
        <p>{formatExpiresIn(journey.expires_at)}</p>
        <p className="inline-flex items-start gap-1">
          <Luggage className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{baggageSummary(journey)}</span>
        </p>
        <p>{flexibilitySummary(journey)}</p>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={onSelect}
          disabled={expired}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {primaryLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-[11px] text-slate-500 lg:text-right">
          You&apos;ll complete booking with the selected provider.
        </p>
      </div>
    </div>
  );
}
