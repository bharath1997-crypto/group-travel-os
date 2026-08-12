"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2, Plane, Calendar, Share2, PlusCircle, AlertCircle, X, RefreshCw,
  Settings2, ArrowRight
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FlightOrder, FlightCancelQuote, FlightCancelConfirm } from "@/lib/flight-types";
import { formatClock, formatDuration, formatPriceExact } from "@/lib/flight-format";

function ConfirmationBookingContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingId = (params.bookingId as string) || "";
  const initialBookingRef = searchParams.get("bookingRef") || "";
  const tripIdParam = searchParams.get("tripId") || "";

  const [order, setOrder] = useState<FlightOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const [associated, setAssociated] = useState(false);
  const [associating, setAssociating] = useState(false);
  const [assocMessage, setAssocMessage] = useState<string | null>(null);

  const [showManageModal, setShowManageModal] = useState(false);
  const [cancelQuote, setCancelQuote] = useState<FlightCancelQuote | null>(null);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelResult, setCancelResult] = useState<FlightCancelConfirm | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<FlightOrder>(`/flights/orders/${encodeURIComponent(bookingId)}`);
        if (!cancelled) setOrder(data);
      } catch (e) {
        console.warn("Could not fetch order details:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bookingId]);

  const pnr = order?.booking_reference || initialBookingRef || bookingId;

  const attachToTripSpace = async () => {
    if (!bookingId || !tripIdParam) return;
    setAssociating(true);
    setAssocMessage(null);
    try {
      const res = await apiFetch<{ message: string }>(
        `/flights/orders/${encodeURIComponent(bookingId)}/associate-trip`,
        { method: "POST", body: JSON.stringify({ trip_id: tripIdParam }) }
      );
      setAssociated(true);
      setAssocMessage(res.message);
    } catch (e) {
      setAssocMessage(e instanceof Error ? e.message : "Failed to associate booking.");
    } finally {
      setAssociating(false);
    }
  };

  const requestCancelQuote = async () => {
    if (!bookingId) return;
    setFetchingQuote(true);
    setCancelError(null);
    try {
      const quote = await apiFetch<FlightCancelQuote>(
        `/flights/orders/${encodeURIComponent(bookingId)}/cancel-quote`,
        { method: "POST" }
      );
      setCancelQuote(quote);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "This order cannot be cancelled online via API.");
    } finally {
      setFetchingQuote(false);
    }
  };

  const confirmCancellation = async () => {
    if (!bookingId || !cancelQuote) return;
    setConfirmingCancel(true);
    setCancelError(null);
    try {
      const result = await apiFetch<FlightCancelConfirm>(
        `/flights/orders/${encodeURIComponent(bookingId)}/cancel-confirm?cancellation_id=${encodeURIComponent(cancelQuote.cancellation_id)}`,
        { method: "POST" }
      );
      setCancelResult(result);
      if (order) setOrder({ ...order, status: "cancelled" });
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Cancellation confirmation failed.");
    } finally {
      setConfirmingCancel(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-5 py-8">
        <div className="h-48 animate-pulse rounded-3xl bg-teal-50 border border-teal-100" />
        <div className="h-64 animate-pulse rounded-3xl bg-white border border-slate-200" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ✅ Confirmation Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-teal-50/50 p-7 text-center shadow-sm md:p-10">
        {/* Decorative ring */}
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-teal-100/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-teal-100/30 blur-2xl pointer-events-none" />

        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-600 text-white shadow-lg shadow-teal-600/30 ring-4 ring-teal-100">
          <CheckCircle2 className="h-9 w-9" strokeWidth={2.5} />
        </div>

        <h1 className="relative mt-5 text-2xl font-black text-slate-900 md:text-3xl">
          Your flight is confirmed! 🎉
        </h1>
        <p className="relative mt-2 text-sm font-medium text-slate-600">
          A booking receipt &amp; itinerary have been registered in your Rovvy account.
        </p>

        {/* Booking Reference Grid */}
        <div className="relative mt-6 grid gap-4 rounded-2xl border border-teal-100/80 bg-white/80 p-5 text-left backdrop-blur-sm sm:grid-cols-3 shadow-xs">
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Airline PNR</span>
            <span className="mt-1 block text-2xl font-black tracking-widest text-teal-700">{pnr}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Rovvy Booking ID</span>
            <span className="mt-1 block truncate text-xs font-bold text-slate-700">{bookingId}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Total &amp; Status</span>
            <span className="mt-1 block text-sm font-extrabold text-slate-900">
              {order ? formatPriceExact(order.currency, order.total_amount) : "Confirmed"}
            </span>
            <span
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                order?.status === "cancelled"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-teal-100 text-teal-800"
              }`}
            >
              {order?.status || "confirmed"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {tripIdParam ? (
            <button
              type="button"
              disabled={associated || associating}
              onClick={() => void attachToTripSpace()}
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-70 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{associated ? "Attached to Trip Space ✓" : associating ? "Attaching…" : "Add to Trip Space"}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <Settings2 className="h-4 w-4" />
            Manage booking
          </button>

          <button
            type="button"
            onClick={() => router.push("/flights")}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-all"
          >
            <Plane className="h-4 w-4" />
            Book another flight
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              void navigator.share({ title: "Rovvy Flight Itinerary", text: `Flight booking PNR: ${pnr}`, url: window.location.href });
            } else {
              void navigator.clipboard.writeText(window.location.href);
              alert("Itinerary link copied to clipboard.");
            }
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>

      {assocMessage ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-bold text-teal-900">
          {assocMessage}
        </div>
      ) : null}

      {/* Itinerary */}
      {order && order.slices.length > 0 ? (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Calendar className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Flight Itinerary</h3>
          </div>
          <div className="space-y-6">
            {order.slices.map((slice, idx) => (
              <div key={idx} className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {idx === 0 ? "Outbound" : "Return"} · {slice.origin} → {slice.destination}
                </p>
                {slice.segments.map((seg, sIdx) => (
                  <div key={sIdx} className="rounded-2xl border border-slate-200/90 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4 text-teal-600" />
                        <span className="text-sm font-bold text-slate-900">
                          {seg.airline_name || seg.airline_code} · {seg.flight_number}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-400">{formatDuration(seg.duration_minutes)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-xs">
                      <div>
                        <p className="text-lg font-black text-slate-900">{formatClock(seg.departure_at)}</p>
                        <p className="font-bold text-slate-700">{seg.origin}</p>
                      </div>
                      <div className="flex items-center">
                        <div className="h-px w-8 bg-slate-300" />
                        <ArrowRight className="h-3 w-3 text-teal-500" />
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900">{formatClock(seg.arrival_at)}</p>
                        <p className="font-bold text-slate-700">{seg.destination}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Manage Booking Modal */}
      {showManageModal ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900">Manage Booking</h3>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="font-bold text-slate-500 uppercase tracking-wider">PNR</span>
                <span className="font-black text-slate-900 text-sm tracking-widest">{pnr}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Status</span>
                <span className={`font-black uppercase tracking-wider text-sm ${order?.status === "cancelled" ? "text-rose-600" : "text-teal-700"}`}>
                  {order?.status || "Confirmed"}
                </span>
              </div>
            </div>

            {cancelError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                {cancelError}
              </div>
            ) : null}

            {cancelResult ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 space-y-1 text-xs">
                <p className="font-extrabold text-teal-900 text-sm">{cancelResult.message}</p>
                <p className="text-teal-800 font-medium">
                  Refund amount: <strong>{formatPriceExact(cancelResult.currency, cancelResult.refund_amount)}</strong>
                </p>
              </div>
            ) : cancelQuote ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                <p className="font-black text-amber-900">Cancellation Quote</p>
                <p className="text-xs text-amber-800">
                  Estimated refund:{" "}
                  <strong className="text-slate-900 text-base">{formatPriceExact(cancelQuote.currency, cancelQuote.refund_amount)}</strong>
                </p>
                <p className="text-[11px] text-amber-600 font-medium">
                  Quote expires: {cancelQuote.expires_at?.slice(11, 19) ?? "soon"}
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    disabled={confirmingCancel}
                    onClick={() => void confirmCancellation()}
                    className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50 transition-all"
                  >
                    {confirmingCancel ? "Cancelling…" : "Confirm cancellation"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelQuote(null)}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={fetchingQuote || order?.status === "cancelled"}
                onClick={() => void requestCancelQuote()}
                className="w-full rounded-2xl border-2 border-rose-200 bg-rose-50 py-3.5 text-sm font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-all"
              >
                {fetchingQuote ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Fetching quote…
                  </span>
                ) : (
                  "Request cancellation quote"
                )}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ConfirmationBookingPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] rounded-3xl border border-slate-200/80 bg-app p-6 text-slate-800 shadow-sm md:p-8">
      <Suspense fallback={
        <div className="flex min-h-64 items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
            <p className="text-sm font-medium text-slate-500">Loading confirmation…</p>
          </div>
        </div>
      }>
        <ConfirmationBookingContent />
      </Suspense>
    </div>
  );
}
