"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Globe, CreditCard, ArrowRight, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { FlightOfferDetail, FlightOfferPriceResult } from "@/lib/flight-types";
import { formatPriceExact } from "@/lib/flight-format";
import BookingPriceSummary from "@/components/travel/BookingPriceSummary";

type PassengerFormData = {
  given_name: string;
  family_name: string;
  email: string;
  phone_number: string;
  born_on: string;
  title: "mr" | "mrs" | "ms" | "miss" | "dr";
  gender: "m" | "f";
  passport_number?: string;
  passport_country?: string;
  passport_expires_on?: string;
  known_traveler_number?: string;
};

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all";

const selectCls =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all appearance-none";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">{children}</span>
  );
}

function TravelersCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const offerId = searchParams.get("offerId") || "";
  const searchPriceRaw = searchParams.get("searchPrice");
  const searchPrice = searchPriceRaw ? Number.parseFloat(searchPriceRaw) : null;
  const tripId = searchParams.get("tripId") || "";

  const routeLabel = useMemo(() => {
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    return from && to ? `${from} → ${to}` : "Selected flight";
  }, [searchParams]);

  const [offer, setOffer] = useState<FlightOfferDetail | null>(null);
  const [reprice, setReprice] = useState<FlightOfferPriceResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [passengers, setPassengers] = useState<PassengerFormData[]>([
    {
      given_name: "",
      family_name: "",
      email: "",
      phone_number: "",
      born_on: "",
      title: "mr",
      gender: "m",
      passport_number: "",
      passport_country: "",
      passport_expires_on: "",
      known_traveler_number: "",
    },
  ]);

  const [errors, setErrors] = useState<Record<number, string>>({});
  const [showPassport, setShowPassport] = useState(false);

  useEffect(() => {
    if (!offerId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const detail = await apiFetch<FlightOfferDetail>(`/flights/offers/${encodeURIComponent(offerId)}`);
        if (cancelled) return;
        setOffer(detail);

        const qs = searchPrice !== null ? `?previous_price=${searchPrice}` : "";
        const priceRes = await apiFetch<FlightOfferPriceResult>(
          `/flights/offers/${encodeURIComponent(offerId)}/price${qs}`,
          { method: "POST" }
        );
        if (cancelled) return;
        setReprice(priceRes);
      } catch (e) {
        console.warn("Error fetching offer for checkout:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offerId, searchPrice]);

  const currentPrice = reprice?.current_price ?? searchPrice ?? 0;
  const currency = reprice?.currency ?? offer?.currency ?? "USD";

  const updatePassenger = (index: number, field: keyof PassengerFormData, value: string) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setErrors((prev) => ({ ...prev, [index]: "" }));
  };

  const validate = (): boolean => {
    const errs: Record<number, string> = {};
    passengers.forEach((p, idx) => {
      if (!p.given_name.trim() || !p.family_name.trim()) {
        errs[idx] = "First and last name are required exactly as shown on travel ID.";
      } else if (!p.email.trim() || !p.email.includes("@")) {
        errs[idx] = "Valid email address is required.";
      } else if (!p.phone_number.trim() || p.phone_number.length < 8) {
        errs[idx] = "Valid phone number with country code is required.";
      } else if (!p.born_on) {
        errs[idx] = "Date of birth is required.";
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const proceedToExtras = () => {
    if (!validate()) return;
    sessionStorage.setItem(`rovvy_checkout_passengers_${offerId}`, JSON.stringify(passengers));

    const qs = new URLSearchParams({
      offerId,
      searchPrice: String(currentPrice),
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
      depart: searchParams.get("depart") || "",
    });
    if (tripId) qs.set("tripId", tripId);
    router.push(`/flights/checkout/extras?${qs.toString()}`);
  };

  if (!offerId) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        No flight selected.{" "}
        <button type="button" className="font-bold underline" onClick={() => router.push("/flights")}>
          Search again
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        {/* Itinerary Context Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white px-5 py-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-black text-slate-900">{routeLabel}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                Depart: {searchParams.get("depart") || "—"}
                {searchParams.get("return") ? ` · Return: ${searchParams.get("return")}` : ""}
              </p>
            </div>
            {tripId ? (
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 border border-teal-200">
                ✦ Trip Space Attached
              </span>
            ) : null}
          </div>
        </div>

        {/* Traveler Forms */}
        {passengers.map((passenger, idx) => (
          <div key={idx} className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
            {/* Form Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 border border-teal-100 text-teal-700">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Traveler {idx + 1}</h3>
                  <p className="text-xs font-semibold text-slate-400">Adult passenger</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400">Must match official ID</span>
            </div>

            {/* Error Banner */}
            {errors[idx] ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
                {errors[idx]}
              </div>
            ) : null}

            {/* Name Row */}
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <FieldLabel>Title</FieldLabel>
                <select
                  value={passenger.title}
                  onChange={(e) => updatePassenger(idx, "title", e.target.value as any)}
                  className={selectCls}
                >
                  <option value="mr">Mr</option>
                  <option value="mrs">Mrs</option>
                  <option value="ms">Ms</option>
                  <option value="miss">Miss</option>
                  <option value="dr">Dr</option>
                </select>
              </label>

              <label className="block">
                <FieldLabel>First / Given name *</FieldLabel>
                <input
                  type="text"
                  value={passenger.given_name}
                  onChange={(e) => updatePassenger(idx, "given_name", e.target.value)}
                  placeholder="John"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <FieldLabel>Last / Family name *</FieldLabel>
                <input
                  type="text"
                  value={passenger.family_name}
                  onChange={(e) => updatePassenger(idx, "family_name", e.target.value)}
                  placeholder="Smith"
                  className={inputCls}
                />
              </label>
            </div>

            {/* Contact Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Email address *</FieldLabel>
                <input
                  type="email"
                  value={passenger.email}
                  onChange={(e) => updatePassenger(idx, "email", e.target.value)}
                  placeholder="john.smith@example.com"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <FieldLabel>Phone (with country code) *</FieldLabel>
                <input
                  type="tel"
                  value={passenger.phone_number}
                  onChange={(e) => updatePassenger(idx, "phone_number", e.target.value)}
                  placeholder="+14155550100"
                  className={inputCls}
                />
              </label>
            </div>

            {/* DOB + Gender */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Date of birth *</FieldLabel>
                <input
                  type="date"
                  value={passenger.born_on}
                  onChange={(e) => updatePassenger(idx, "born_on", e.target.value)}
                  className={inputCls}
                />
              </label>

              <label className="block">
                <FieldLabel>Gender *</FieldLabel>
                <select
                  value={passenger.gender}
                  onChange={(e) => updatePassenger(idx, "gender", e.target.value as any)}
                  className={selectCls}
                >
                  <option value="m">Male</option>
                  <option value="f">Female</option>
                </select>
              </label>
            </div>

            {/* Optional Passport Accordion */}
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowPassport(!showPassport)}
                className="flex w-full items-center justify-between text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>{showPassport ? "Hide" : "Add"} passport &amp; travel program details</span>
                </div>
                {showPassport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showPassport ? (
                <div className="mt-4 grid gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Passport number</FieldLabel>
                    <input
                      type="text"
                      value={passenger.passport_number || ""}
                      onChange={(e) => updatePassenger(idx, "passport_number", e.target.value)}
                      placeholder="A12345678"
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Issuing country code</FieldLabel>
                    <input
                      type="text"
                      maxLength={3}
                      value={passenger.passport_country || ""}
                      onChange={(e) => updatePassenger(idx, "passport_country", e.target.value.toUpperCase())}
                      placeholder="USA"
                      className={`${inputCls} uppercase`}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <FieldLabel>TSA PreCheck / Known Traveler / Redress #</FieldLabel>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={passenger.known_traveler_number || ""}
                        onChange={(e) => updatePassenger(idx, "known_traveler_number", e.target.value)}
                        placeholder="123456789"
                        className={`${inputCls} pl-11`}
                      />
                    </div>
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <BookingPriceSummary
          currency={currency}
          lines={[
            { label: "Base fare", amount: currentPrice * 0.85 },
            { label: "Taxes & fees", amount: currentPrice * 0.15 },
            { label: "Rovvy service fee", amount: 0 },
          ]}
        />

        <div className="rounded-3xl border border-slate-100 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <span>Your details are secure &amp; encrypted</span>
          </div>
          <button
            type="button"
            onClick={proceedToExtras}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-4 text-sm font-black text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.99] transition-all"
          >
            <span>Continue to extras</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-center text-[11px] text-slate-400 font-medium">
            No payment charged yet
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TravelersCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-64 items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          <p className="text-sm font-medium text-slate-500">Loading traveler details…</p>
        </div>
      </div>
    }>
      <TravelersCheckoutContent />
    </Suspense>
  );
}
