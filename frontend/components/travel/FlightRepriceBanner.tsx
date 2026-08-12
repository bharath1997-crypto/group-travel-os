"use client";

import type { FlightOfferPriceResult } from "@/lib/flight-types";
import { formatPriceExact } from "@/lib/flight-format";

type Props = {
  reprice: FlightOfferPriceResult;
  onContinue: () => void;
  onChooseAnother: () => void;
};

export default function FlightRepriceBanner({ reprice, onContinue, onChooseAnother }: Props) {
  if (!reprice.price_changed) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
      <p className="font-semibold">Fare update</p>
      <p className="mt-1">{reprice.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700"
        >
          Continue at {formatPriceExact(reprice.currency, reprice.current_price)}
        </button>
        <button
          type="button"
          onClick={onChooseAnother}
          className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          Choose another flight
        </button>
      </div>
    </div>
  );
}
