"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Plane, AlertTriangle, ShieldCheck, Check, Clock, X, Luggage, ArrowRight, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FlightOfferDetail, FlightOfferPriceResult } from "@/lib/flight-types";
import { formatClock, formatDuration, formatPriceExact, stopsLabel } from "@/lib/flight-format";
import BookingPriceSummary from "@/components/travel/BookingPriceSummary";
import { safeAuthReturnPath } from "@/lib/auth-return";

function SegmentTimeline({ segments }: { segments: FlightOfferDetail["slices"][0]["segments"] }) {
  return (
    <div className="space-y-0">
      {segments.map((seg, idx) => {
        const isCodeshare =
          seg.airline_name &&
          seg.airline_code &&
          seg.airline_name.toLowerCase() !== seg.airline_code.toLowerCase();

        const prevSeg = idx > 0 ? segments[idx - 1] : null;
        const layoverMin = prevSeg
          ? Math.max(0, Math.round((new Date(seg.departure_at).getTime() - new Date(prevSeg.arrival_at).getTime()) / 60_000))
          : 0;

        return (
          <div key={`${seg.flight_number}-${idx}`}>
            {/* Layover connector */}
            {prevSeg && layoverMin > 0 ? (
              <div className="flex items-center gap-3 py-3 px-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <div className="text-xs font-bold text-amber-700">
                  Layover at {seg.origin} · {formatDuration(layoverMin)}
                </div>
              </div>
            ) : null}

            {/* Segment Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              {/* Airline Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 border border-teal-100 text-teal-700">
                    <Plane className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {seg.airline_name || seg.airline_code} · {seg.flight_number}
                    </p>
                    {isCodeshare ? (
                      <p className="text-xs text-slate-500">Operated by {seg.airline_name}</p>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  {seg.aircraft ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {seg.aircraft}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Flight Timeline */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                {/* Departure */}
                <div>
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{formatClock(seg.departure_at)}</p>
                  <p className="text-base font-extrabold text-slate-800">{seg.origin}</p>
                  {seg.origin_name ? <p className="text-xs text-slate-500">{seg.origin_name}</p> : null}
                  {seg.origin_terminal ? (
                    <p className="mt-0.5 text-xs font-bold text-slate-400">Terminal {seg.origin_terminal}</p>
                  ) : null}
                </div>

                {/* Duration Arrow */}
                <div className="flex flex-col items-center gap-1 px-2">
                  <span className="text-xs font-bold text-slate-500">{formatDuration(seg.duration_minutes)}</span>
                  <div className="relative flex w-20 items-center">
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-300 to-teal-400" />
                    <Plane className="h-3.5 w-3.5 -mr-1 text-teal-500 shrink-0" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direct</span>
                </div>

                {/* Arrival */}
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900 tracking-tight">{formatClock(seg.arrival_at)}</p>
                  <p className="text-base font-extrabold text-slate-800">{seg.destination}</p>
                  {seg.destination_name ? <p className="text-xs text-slate-500">{seg.destination_name}</p> : null}
                  {seg.destination_terminal ? (
                    <p className="mt-0.5 text-xs font-bold text-slate-400">Terminal {seg.destination_terminal}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OfferDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const offerId = (params.offerId as string) || "";
  const initialPriceRaw = searchParams.get("searchPrice");
  const initialPrice = initialPriceRaw ? Number.parseFloat(initialPriceRaw) : null;
  const restoredAfterAuth = searchParams.get("restored") === "1";
  const searchReturnPath = safeAuthReturnPath(searchParams.get("searchReturn"), "/flights");

  const [offer, setOffer] = useState<FlightOfferDetail | null>(null);
  const [reprice, setReprice] = useState<FlightOfferPriceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [priceAcknowledged, setPriceAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setExpired(false);
      try {
        const detail = await apiFetch<FlightOfferDetail>(`/flights/offers/${encodeURIComponent(offerId)}`);
        if (cancelled) return;
        setOffer(detail);

        const qs = initialPrice !== null ? `?previous_price=${initialPrice}` : "";
        const priceRes = await apiFetch<FlightOfferPriceResult>(
          `/flights/offers/${encodeURIComponent(offerId)}/price${qs}`,
          { method: "POST" }
        );
        if (cancelled) return;
        setReprice(priceRes);
        if (!priceRes.price_changed) {
          setPriceAcknowledged(true);
        }
      } catch (e) {
        if (!cancelled) {
          setExpired(true);
          setError(e instanceof Error ? e.message : "This flight fare is no longer available.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offerId, initialPrice]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 py-8">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          <div className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (expired || !offer) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="mt-5 text-xl font-black text-slate-900">This fare is no longer available</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-slate-600">
          Airline fares and seat availability update in real time. Please search again for the latest prices.
        </p>
        <button
          type="button"
          onClick={() => router.push(searchReturnPath)}
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Search flights again
        </button>
      </div>
    );
  }

  const currentPrice = reprice?.current_price ?? offer.price;
  const currency = reprice?.currency ?? offer.currency;
  const hasPriceChanged = Boolean(reprice?.price_changed && !priceAcknowledged);

  const proceedToTravelers = () => {
    const qs = new URLSearchParams({
      offerId: offer.id,
      searchPrice: String(currentPrice),
      from: offer.origin,
      to: offer.destination,
      depart: offer.departure_at.slice(0, 10),
    });
    router.push(`/flights/checkout/travelers?${qs.toString()}`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      {restoredAfterAuth ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900" role="status">
          Welcome back — your selected flight has been restored and its price was checked again.
        </div>
      ) : null}
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 md:text-3xl">
          {offer.origin} <span className="text-teal-600">→</span> {offer.destination}
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {stopsLabel(offer.stops)} · {offer.cabin_class} · Review fare before booking
        </p>
      </div>

      {/* Price Change Warning Banner */}
      {hasPriceChanged && reprice ? (
        <div className="rounded-3xl border border-amber-300/80 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-amber-900">Your fare has changed</p>
              <p className="mt-1 text-sm text-amber-800">
                Previous fare:{" "}
                <span className="line-through font-medium">{formatPriceExact(currency, reprice.previous_price ?? offer.price)}</span>
                {"  "}→{"  "}
                <strong className="text-amber-950 text-base">{formatPriceExact(currency, currentPrice)}</strong>
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setPriceAcknowledged(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700 transition-all"
                >
                  <Check className="h-4 w-4" />
                  Continue for {formatPriceExact(currency, currentPrice)}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/flights")}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50 transition-all"
                >
                  <X className="h-4 w-4" />
                  Choose another flight
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main: Flight Slices */}
        <div className="space-y-6">
          {offer.slices.map((slice, sliceIdx) => (
            <div key={`${slice.origin}-${sliceIdx}`} className="space-y-3">
              {offer.slices.length > 1 ? (
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-900 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-white">
                    {sliceIdx === 0 ? "Outbound" : "Return"}
                  </span>
                  <span className="text-sm font-bold text-slate-700">
                    {slice.origin} → {slice.destination} · {formatDuration(slice.duration_minutes)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                  <span>{formatDuration(slice.duration_minutes)} total</span>
                  <span className="text-slate-300">·</span>
                  <span>{stopsLabel(slice.stops)}</span>
                </div>
              )}
              <SegmentTimeline segments={slice.segments} />
            </div>
          ))}

          {/* Fare Features */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="mb-4 flex items-center gap-2">
              <Luggage className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Fare features &amp; baggage
              </h3>
              <span className="rounded-full bg-teal-600 px-2.5 py-0.5 text-[11px] font-black text-white ml-auto">
                {offer.fare_brand || "Standard"}
              </span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                { text: offer.carry_on_included ?? true ? "Cabin bag included" : "Personal item only" },
                { text: offer.checked_bag_included ? "Checked baggage included" : "Add checked bag at extras step" },
                { text: offer.refundable ? "Refundable before departure" : "Non-refundable fare" },
                { text: offer.changeable ? "Ticket changes permitted" : "Change restrictions apply" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2 text-xs text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <span className="font-medium">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar: Price & CTA */}
        <div className="space-y-4">
          <BookingPriceSummary
            currency={currency}
            lines={[
              { label: "Base fare", amount: currentPrice * 0.85 },
              { label: "Taxes & carrier surcharges", amount: currentPrice * 0.15 },
              { label: "Rovvy service fee", amount: 0 },
            ]}
          />

          <div className="rounded-3xl border border-slate-100 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              <span>SSL-encrypted &amp; Duffel-backed booking</span>
            </div>
            <button
              type="button"
              disabled={hasPriceChanged}
              onClick={proceedToTravelers}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-4 text-sm font-black text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.99] disabled:opacity-50 transition-all duration-200"
            >
              <span>Continue to travelers</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-center text-[11px] text-slate-400 font-medium">
              No charge until payment step
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OfferDetailPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] rounded-3xl border border-slate-200/80 bg-app p-6 text-slate-800 shadow-sm md:p-8 lg:p-10">
      <Suspense fallback={
        <div className="flex min-h-64 items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
            <p className="text-sm font-medium text-slate-500">Loading offer details…</p>
          </div>
        </div>
      }>
        <OfferDetailContent />
      </Suspense>
    </div>
  );
}
