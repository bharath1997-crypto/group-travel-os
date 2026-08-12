"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Edit3, Plane, User, Luggage, ShieldAlert, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FlightOfferDetail, FlightOfferPriceResult } from "@/lib/flight-types";
import { formatClock, formatDuration, formatPriceExact } from "@/lib/flight-format";
import BookingPriceSummary from "@/components/travel/BookingPriceSummary";

type PassengerFormData = {
  given_name: string;
  family_name: string;
  email: string;
  phone_number: string;
  born_on: string;
  title: string;
  gender: string;
};

type ExtrasData = {
  seats?: any[];
  extraBagsCount?: number;
  seatTotal?: number;
  baggageTotal?: number;
  grandTotal?: number;
};

function ReviewCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const offerId = searchParams.get("offerId") || "";
  const searchPriceRaw = searchParams.get("searchPrice");
  const initialPrice = searchPriceRaw ? Number.parseFloat(searchPriceRaw) : null;
  const tripId = searchParams.get("tripId") || "";

  const [offer, setOffer] = useState<FlightOfferDetail | null>(null);
  const [reprice, setReprice] = useState<FlightOfferPriceResult | null>(null);
  const [passengers, setPassengers] = useState<PassengerFormData[]>([]);
  const [extras, setExtras] = useState<ExtrasData>({});
  const [loading, setLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [repriceWarning, setRepriceWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;

    // Retrieve passenger data from sessionStorage
    try {
      const pRaw = sessionStorage.getItem(`rovvy_checkout_passengers_${offerId}`);
      if (pRaw) setPassengers(JSON.parse(pRaw));

      const eRaw = sessionStorage.getItem(`rovvy_checkout_extras_${offerId}`);
      if (eRaw) setExtras(JSON.parse(eRaw));
    } catch (e) {
      console.warn("Error reading stored checkout details:", e);
    }

    (async () => {
      setLoading(true);
      try {
        const detail = await apiFetch<FlightOfferDetail>(`/flights/offers/${encodeURIComponent(offerId)}`);
        if (cancelled) return;
        setOffer(detail);

        // Final mandatory production repricing check before payment
        const qs = initialPrice !== null ? `?previous_price=${initialPrice}` : "";
        const priceRes = await apiFetch<FlightOfferPriceResult>(
          `/flights/offers/${encodeURIComponent(offerId)}/price${qs}`,
          { method: "POST" }
        );
        if (cancelled) return;
        setReprice(priceRes);
        if (priceRes.price_changed) {
          setRepriceWarning(priceRes.message);
        }
      } catch (e) {
        console.warn("Offer fetch error during review:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offerId, initialPrice]);

  const basePrice = offer?.price ?? initialPrice ?? 0;
  const seatTotal = extras.seatTotal ?? 0;
  const baggageTotal = extras.baggageTotal ?? 0;
  const currentTotal = (reprice?.current_price ?? basePrice) + seatTotal + baggageTotal;
  const currency = reprice?.currency ?? offer?.currency ?? "USD";

  const proceedToPayment = () => {
    if (!termsAccepted) return;

    const qs = new URLSearchParams({
      offerId,
      searchPrice: String(currentTotal),
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
      depart: searchParams.get("depart") || "",
    });
    if (tripId) qs.set("tripId", tripId);

    router.push(`/flights/checkout/payment?${qs.toString()}`);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-8 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Reprice Warning if live price shifted */}
        {repriceWarning ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
            {repriceWarning}
          </div>
        ) : null}

        {/* 1. Flight Itinerary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">1. Flight Itinerary</h3>
            </div>
          </div>

          {offer?.slices.map((slice, sIdx) => (
            <div key={sIdx} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {sIdx === 0 ? "Outbound" : "Return"} · {slice.origin} → {slice.destination}
              </p>
              {slice.segments.map((seg, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>
                      {seg.airline_name || seg.airline_code} {seg.flight_number}
                    </span>
                    <span>{formatDuration(seg.duration_minutes)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-slate-600">
                    <span>
                      {formatClock(seg.departure_at)} {seg.origin}
                    </span>
                    <span>→</span>
                    <span>
                      {formatClock(seg.arrival_at)} {seg.destination}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 2. Travelers */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">2. Travelers</h3>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          </div>

          {passengers.length > 0 ? (
            passengers.map((p, idx) => (
              <div key={idx} className="text-xs text-slate-700">
                <p className="font-bold text-slate-900">
                  {p.title.toUpperCase()} {p.given_name} {p.family_name}
                </p>
                <p className="text-slate-500">
                  {p.email} · {p.phone_number} · DOB: {p.born_on}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">Traveler details saved.</p>
          )}
        </div>

        {/* 3. Baggage & Extras */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Luggage className="h-5 w-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">3. Baggage & Extras</h3>
          </div>
          <ul className="space-y-1 text-xs text-slate-700">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-teal-600" />
              <span>Personal item & cabin baggage included</span>
            </li>
            {extras.extraBagsCount ? (
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-teal-600" />
                <span>{extras.extraBagsCount} Extra checked bag(s) added</span>
              </li>
            ) : null}
            {extras.seats && extras.seats.length > 0 ? (
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-teal-600" />
                <span>
                  Seats assigned: {extras.seats.map((s) => s.seatDesignator).join(", ")}
                </span>
              </li>
            ) : null}
          </ul>
        </div>

        {/* 4. Terms Acknowledgement */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs text-slate-600">
              I acknowledge the fare rules, ticket change/cancellation terms, and Rovvy booking terms. I confirm traveler names match official travel documents.
            </span>
          </label>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <BookingPriceSummary
          currency={currency}
          lines={[
            { label: "Base flight fare", amount: offer?.price ?? initialPrice ?? 0 },
            { label: "Selected seats", amount: seatTotal },
            { label: "Extra baggage", amount: baggageTotal },
            { label: "Rovvy service fee", amount: 0 },
          ]}
        />

        <button
          type="button"
          disabled={!termsAccepted}
          onClick={proceedToPayment}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
        >
          <span>Proceed to payment</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function ReviewCheckoutPage() {
  return (
    <Suspense fallback={<div className="text-slate-500">Loading review…</div>}>
      <ReviewCheckoutContent />
    </Suspense>
  );
}
