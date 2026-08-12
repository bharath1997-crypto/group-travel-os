"use client";

import { Sparkles, Info, ArrowDownRight, CheckCircle2 } from "lucide-react";
import { formatPrice } from "@/lib/flight-format";

type Props = {
  lowestPrice: number;
  averagePrice?: number;
  currency?: string;
};

export default function FlightPriceInsightsBanner({ lowestPrice, averagePrice = lowestPrice * 1.25, currency = "USD" }: Props) {
  const diff = Math.max(0, Math.round(averagePrice - lowestPrice));
  const isGreatDeal = diff > 25;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/80 via-emerald-50/40 to-white p-4 shadow-xs">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="flex-1 text-xs text-slate-700">
        <p className="font-bold text-slate-900 text-sm">
          {isGreatDeal ? "Prices are lower than usual for this route!" : "Typical flight prices for these dates"}
        </p>
        <p className="mt-0.5 text-slate-600">
          The cheapest fare found is <strong className="text-slate-900">{formatPrice(currency, lowestPrice)}</strong>.
          {isGreatDeal ? (
            <span className="ml-1 text-emerald-700 font-semibold inline-flex items-center gap-0.5">
              <ArrowDownRight className="h-3.5 w-3.5" />
              Save approx. {formatPrice(currency, diff)} compared to typical rates.
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
