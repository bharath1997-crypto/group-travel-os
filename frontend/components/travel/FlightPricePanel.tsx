"use client";

import { ArrowRight, Luggage, RefreshCw, ShieldCheck } from "lucide-react";
import type { FlightJourney } from "@/lib/flight-types";
import { formatExpiresIn, formatPrice } from "@/lib/flight-format";

type Props = {
  journey: FlightJourney;
  travelerCount: number;
  onSelect: () => void;
  expired?: boolean;
};

function baggageSummary(journey: FlightJourney): string {
  const parts: string[] = [];
  if (journey.carry_on_included === true) parts.push("Carry-on included");
  if (journey.checked_bag_included === true) parts.push("Checked bag included");
  return parts.length > 0 ? parts.join(" · ") : "Baggage not confirmed";
}

function flexibilitySummary(journey: FlightJourney): string {
  const parts: string[] = [];
  if (journey.changeable === true) parts.push("Changeable");
  if (journey.refundable === true) parts.push("Refundable");
  return parts.length > 0 ? parts.join(" · ") : "Fare flexibility not confirmed";
}

export default function FlightPricePanel({ journey, travelerCount, onSelect, expired = false }: Props) {
  const checkedAt = new Date(journey.checked_at);
  const checkedLabel = Number.isNaN(checkedAt.getTime())
    ? "Price checked live"
    : `Price checked ${checkedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  return (
    <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[220px] lg:text-right">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Total price · {travelerCount} {travelerCount === 1 ? "traveler" : "travelers"}
        </p>
        <p className="text-2xl font-extrabold tracking-tight text-slate-900">
          {formatPrice(journey.currency, journey.price)}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">Review the final price breakdown before booking</p>
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
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Book with Rovvy
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="inline-flex items-center justify-start gap-1 text-[11px] text-slate-500 lg:justify-end">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
          Review fare details before booking
        </p>
        <p className="text-[11px] text-slate-400 lg:text-right">
          Additional booking options may become available as Rovvy adds supported partners.
        </p>
      </div>
    </div>
  );
}
