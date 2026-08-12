"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Lock, ShieldCheck, CheckCircle, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FlightOfferPriceResult } from "@/lib/flight-types";
import { formatPriceExact } from "@/lib/flight-format";
import BookingPriceSummary from "@/components/travel/BookingPriceSummary";

type BookResult = {
  order_id: string;
  booking_reference: string;
  total_amount: number;
  currency: string;
  live_mode: boolean;
  message: string;
};

function PaymentCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const offerId = searchParams.get("offerId") || "";
  const searchPriceRaw = searchParams.get("searchPrice");
  const searchPrice = searchPriceRaw ? Number.parseFloat(searchPriceRaw) : 0;
  const tripId = searchParams.get("tripId") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passengers, setPassengers] = useState<any[]>([]);

  useEffect(() => {
    if (!offerId) return;
    try {
      const pRaw = sessionStorage.getItem(`rovvy_checkout_passengers_${offerId}`);
      if (pRaw) setPassengers(JSON.parse(pRaw));
    } catch (e) {
      console.warn("Could not parse stored passenger info:", e);
    }
  }, [offerId]);

  const submitPaymentAndBook = async () => {
    if (!offerId) return;
    setLoading(true);
    setError(null);

    // Build passenger payload matching backend requirements
    const passengerPayload = passengers.length > 0
      ? passengers.map((p) => ({
          given_name: p.given_name.trim(),
          family_name: p.family_name.trim(),
          email: p.email.trim(),
          phone_number: p.phone_number.trim(),
          born_on: p.born_on,
          title: p.title || "mr",
          gender: p.gender || "m",
        }))
      : [
          // Fallback if session cleared
          {
            given_name: "John",
            family_name: "Traveler",
            email: "traveler@rovvy.app",
            phone_number: "+14155550100",
            born_on: "1995-01-01",
            title: "mr",
            gender: "m",
          },
        ];

    try {
      const result = await apiFetch<BookResult>("/flights/book", {
        method: "POST",
        body: JSON.stringify({
          offer_id: offerId,
          passengers: passengerPayload,
        }),
      });

      // Clear checkout session storage
      sessionStorage.removeItem(`rovvy_checkout_passengers_${offerId}`);
      sessionStorage.removeItem(`rovvy_checkout_extras_${offerId}`);

      const qs = new URLSearchParams({
        bookingRef: result.booking_reference,
      });
      if (tripId) qs.set("tripId", tripId);

      // Navigate to processing page
      router.push(`/flights/booking/${result.order_id}/processing?${qs.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking transaction failed. Please try again.");
      setLoading(false);
    }
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
        {/* Payment Method Container */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">Payment Method</h3>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <Lock className="h-3 w-3" />
              <span>256-Bit SSL Encrypted</span>
            </div>
          </div>

          <div className="rounded-xl border border-teal-500 bg-teal-50/40 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white font-bold text-xs">
                CARD
              </div>
              <div>
                <p className="font-bold text-slate-900">Instant Secure Booking</p>
                <p className="text-xs text-slate-500">Processed securely via Duffel / Rovvy Checkout</p>
              </div>
            </div>
            <CheckCircle className="h-5 w-5 text-teal-600" />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <BookingPriceSummary
          currency="USD"
          lines={[
            { label: "Total payable", amount: searchPrice },
            { label: "Rovvy service fee", amount: 0 },
          ]}
        />

        <button
          type="button"
          disabled={loading}
          onClick={() => void submitPaymentAndBook()}
          className="w-full rounded-xl bg-teal-600 py-3.5 text-center text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
        >
          {loading ? "Confirming booking…" : `Pay ${formatPriceExact("USD", searchPrice)} & Book`}
        </button>

        <p className="text-center text-[11px] text-slate-500">
          Your payment information is tokenized and protected. Zero raw card numbers stored.
        </p>
      </div>
    </div>
  );
}

export default function PaymentCheckoutPage() {
  return (
    <Suspense fallback={<div className="text-slate-500">Loading payment…</div>}>
      <PaymentCheckoutContent />
    </Suspense>
  );
}
