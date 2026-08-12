"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FlightOrder } from "@/lib/flight-types";

function ProcessingBookingContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const bookingId = (params.bookingId as string) || "";
  const bookingRef = searchParams.get("bookingRef") || "";
  const tripId = searchParams.get("tripId") || "";

  const [step, setStep] = useState<number>(1);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;
    let attempts = 0;

    const timer1 = setTimeout(() => {
      if (!cancelled) setStep(2);
    }, 1500);

    const timer2 = setTimeout(() => {
      if (!cancelled) setStep(3);
    }, 3000);

    const checkStatus = async () => {
      try {
        const order = await apiFetch<FlightOrder>(`/flights/orders/${encodeURIComponent(bookingId)}`);
        if (!cancelled && (order.status === "confirmed" || order.booking_reference)) {
          setConfirmed(true);
          const qs = new URLSearchParams();
          if (bookingRef) qs.set("bookingRef", bookingRef);
          if (tripId) qs.set("tripId", tripId);
          setTimeout(() => {
            router.replace(`/flights/booking/${encodeURIComponent(bookingId)}/confirmation?${qs.toString()}`);
          }, 1200);
          return;
        }
      } catch (e) {
        console.info("Polling order status:", e);
      }

      attempts++;
      if (attempts < 10 && !cancelled) {
        setTimeout(checkStatus, 2000);
      } else if (!cancelled) {
        // Fallback navigate to confirmation page after max attempts
        const qs = new URLSearchParams();
        if (bookingRef) qs.set("bookingRef", bookingRef);
        if (tripId) qs.set("tripId", tripId);
        router.replace(`/flights/booking/${encodeURIComponent(bookingId)}/confirmation?${qs.toString()}`);
      }
    };

    const initialCheck = setTimeout(checkStatus, 3500);

    return () => {
      cancelled = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(initialCheck);
    };
  }, [bookingId, bookingRef, tripId, router]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-50 text-teal-600 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>

      <h1 className="mt-6 text-2xl font-extrabold text-slate-900">Confirming your flight</h1>
      <p className="mt-2 text-sm text-slate-600">Please stay on this page while we finalize your airline ticket.</p>

      <div className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-white text-xs font-bold">
            <Check className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-900">Payment submitted</span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
              step >= 2 ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-400"
            }`}
          >
            {step >= 2 ? <Check className="h-4 w-4" /> : "2"}
          </div>
          <span className={`text-sm font-semibold ${step >= 2 ? "text-slate-900" : "text-slate-400"}`}>
            Reservation requested
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
              step >= 3 || confirmed ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-400"
            }`}
          >
            {step >= 3 || confirmed ? <Check className="h-4 w-4" /> : "3"}
          </div>
          <span className={`text-sm font-semibold ${step >= 3 || confirmed ? "text-slate-900" : "text-slate-400"}`}>
            Confirming ticket & PNR
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ProcessingBookingPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] rounded-3xl border border-slate-200 bg-app p-6 text-slate-800 shadow-sm md:p-8">
      <Suspense fallback={<div className="text-slate-500 text-center py-12">Processing booking…</div>}>
        <ProcessingBookingContent />
      </Suspense>
    </div>
  );
}
