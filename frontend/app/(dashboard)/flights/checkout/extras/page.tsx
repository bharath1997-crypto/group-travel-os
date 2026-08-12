"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Luggage, Armchair, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FlightSeatMap, PassengerSeatSelection } from "@/lib/flight-types";
import { formatPriceExact } from "@/lib/flight-format";
import BookingPriceSummary from "@/components/travel/BookingPriceSummary";

function ExtrasCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const offerId = searchParams.get("offerId") || "";
  const searchPriceRaw = searchParams.get("searchPrice");
  const basePrice = searchPriceRaw ? Number.parseFloat(searchPriceRaw) : 0;
  const tripId = searchParams.get("tripId") || "";

  const [seatMaps, setSeatMaps] = useState<FlightSeatMap[]>([]);
  const [loadingSeatMaps, setLoadingSeatMaps] = useState(true);
  const [selectedSeats, setSelectedSeats] = useState<PassengerSeatSelection[]>([]);
  const [extraBagsCount, setExtraBagsCount] = useState<number>(0);

  const bagPricePerUnit = 35.0; // Standard extra bag price estimate

  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;

    (async () => {
      setLoadingSeatMaps(true);
      try {
        const maps = await apiFetch<FlightSeatMap[]>(`/flights/offers/${encodeURIComponent(offerId)}/seatmaps`);
        if (!cancelled && Array.isArray(maps)) {
          setSeatMaps(maps);
        }
      } catch (e) {
        console.info("No seat maps available for this offer:", e);
      } finally {
        if (!cancelled) setLoadingSeatMaps(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offerId]);

  const seatTotal = selectedSeats.reduce((acc, s) => acc + s.price, 0);
  const baggageTotal = extraBagsCount * bagPricePerUnit;
  const grandTotal = basePrice + seatTotal + baggageTotal;

  const toggleSeatSelection = (seatDesignator: string, price: number) => {
    setSelectedSeats((prev) => {
      const exists = prev.some((s) => s.seatDesignator === seatDesignator);
      if (exists) {
        return prev.filter((s) => s.seatDesignator !== seatDesignator);
      } else {
        // Assign to first passenger without a seat
        return [
          ...prev,
          {
            passengerIndex: 0,
            passengerName: "Traveler 1",
            segmentIndex: 0,
            seatDesignator,
            price,
          },
        ];
      }
    });
  };

  const proceedToReview = () => {
    // Save selected extras to sessionStorage
    sessionStorage.setItem(
      `rovvy_checkout_extras_${offerId}`,
      JSON.stringify({
        seats: selectedSeats,
        extraBagsCount,
        seatTotal,
        baggageTotal,
        grandTotal,
      })
    );

    const qs = new URLSearchParams({
      offerId,
      searchPrice: String(grandTotal),
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
      depart: searchParams.get("depart") || "",
    });
    if (tripId) qs.set("tripId", tripId);

    router.push(`/flights/checkout/review?${qs.toString()}`);
  };

  if (!offerId) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        No flight selected.{" "}
        <button type="button" className="font-semibold underline" onClick={() => router.push("/flights")}>
          Search again
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Baggage Extras Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Luggage className="h-5 w-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">Baggage Options</h3>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900">Personal Item & Carry-on</p>
              <p className="text-xs text-slate-500">Fits under seat or overhead bin</p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">Included</span>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900">Additional Checked Bag (23 kg / 50 lbs)</p>
              <p className="text-xs text-slate-500">$35.00 USD per bag per leg</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={extraBagsCount <= 0}
                onClick={() => setExtraBagsCount((c) => Math.max(0, c - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                –
              </button>
              <span className="w-6 text-center font-bold text-slate-900">{extraBagsCount}</span>
              <button
                type="button"
                onClick={() => setExtraBagsCount((c) => c + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Seat Selection Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">Seat Selection</h3>
            </div>
            <span className="text-xs text-slate-500">Optional</span>
          </div>

          {loadingSeatMaps ? (
            <div className="animate-pulse py-8 text-center text-sm text-slate-500">Loading seat map…</div>
          ) : seatMaps.length > 0 ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">Select preferred seats for your itinerary:</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-6 gap-2 text-center text-xs">
                  {["12A", "12B", "12C", "12D", "12E", "12F", "14A", "14B", "14C", "14D", "14E", "14F"].map(
                    (seat) => {
                      const isSelected = selectedSeats.some((s) => s.seatDesignator === seat);
                      return (
                        <button
                          key={seat}
                          type="button"
                          onClick={() => toggleSeatSelection(seat, 15.0)}
                          className={`rounded-lg py-2 font-bold transition ${
                            isSelected
                              ? "bg-teal-600 text-white shadow-sm"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-teal-400"
                          }`}
                        >
                          {seat}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Seat selection is assigned automatically by the airline during check-in for this fare.
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <BookingPriceSummary
          currency="USD"
          lines={[
            { label: "Base flight fare", amount: basePrice },
            { label: "Selected seats", amount: seatTotal },
            { label: "Extra baggage", amount: baggageTotal },
            { label: "Rovvy service fee", amount: 0 },
          ]}
        />

        <button
          type="button"
          onClick={proceedToReview}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700"
        >
          <span>Continue to review</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={proceedToReview}
          className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Skip extras
        </button>
      </div>
    </div>
  );
}

export default function ExtrasCheckoutPage() {
  return (
    <Suspense fallback={<div className="text-slate-500">Loading extras…</div>}>
      <ExtrasCheckoutContent />
    </Suspense>
  );
}
