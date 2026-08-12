"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Plane } from "lucide-react";
import { API_BASE, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { TravelHandoffContext } from "@/lib/travel-handoff";
import { labelForFlightIata, resolveFlightIataFromText } from "@/lib/flight-place-suggestions";
import FlightPlaceInput, { type FlightPlaceValue } from "@/components/travel/FlightPlaceInput";
import FlightBookModal from "@/components/travel/FlightBookModal";

export type FlightRow = {
  id: string;
  price: number;
  currency: string;
  airlines: string[];
  departure_at: string;
  arrival_at: string;
  origin: string;
  destination: string;
  duration_minutes: number;
  deep_link: string;
  stops: number;
};

export type FlightSearchMeta = {
  fromLabel: string;
  toLabel: string;
  fromCode: string;
  toCode: string;
  departDate: string;
  returnDate: string | null;
  roundTrip: boolean;
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatPrice(currency: string, price: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(0)}`;
  }
}

function placeFromHandoff(iata: string | null | undefined, fallbackLabel?: string): FlightPlaceValue {
  const code = (iata || "").trim().toUpperCase();
  if (!code) return { label: fallbackLabel || "", iata: code };
  return { label: labelForFlightIata(code), iata: code };
}

type Props = {
  handoff?: TravelHandoffContext | null;
};

export default function RovvyFlightSearch({ handoff = null }: Props) {
  const [tripType, setTripType] = useState<"oneway" | "roundtrip">("oneway");
  const [from, setFrom] = useState<FlightPlaceValue>(() =>
    placeFromHandoff(handoff?.originIata, handoff?.origin?.name),
  );
  const [to, setTo] = useState<FlightPlaceValue>(() =>
    placeFromHandoff(handoff?.destinationIata, handoff?.destination?.name),
  );
  const [departDate, setDepartDate] = useState(todayPlus(14));
  const [returnDate, setReturnDate] = useState("");
  const [rows, setRows] = useState<FlightRow[]>([]);
  const [searchMeta, setSearchMeta] = useState<FlightSearchMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [selectedRow, setSelectedRow] = useState<FlightRow | null>(null);

  useEffect(() => {
    if (!handoff) return;
    if (handoff.originIata) setFrom(placeFromHandoff(handoff.originIata, handoff.origin.name));
    if (handoff.destinationIata) setTo(placeFromHandoff(handoff.destinationIata, handoff.destination.name));
  }, [handoff]);

  const routeSummary = useMemo(() => {
    if (searchMeta) {
      return `${searchMeta.fromLabel} → ${searchMeta.toLabel}`;
    }
    const o = from.iata || resolveFlightIataFromText(from.label);
    const d = to.iata || resolveFlightIataFromText(to.label);
    if (o && d) return `${from.label.split(",")[0]} → ${to.label.split(",")[0]}`;
    return "Flights";
  }, [searchMeta, from, to]);

  const runSearch = useCallback(async () => {
    setErrorBanner(null);
    setSearched(true);

    const origin = (from.iata || resolveFlightIataFromText(from.label) || "").toUpperCase();
    const dest = (to.iata || resolveFlightIataFromText(to.label) || "").toUpperCase();

    if (!origin || !dest) {
      setErrorBanner("Choose a city or airport from the suggestions.");
      return;
    }

    if (origin === dest) {
      setErrorBanner("Origin and destination must be different.");
      return;
    }

    if (tripType === "roundtrip" && !returnDate) {
      setErrorBanner("Pick a return date for round trip.");
      return;
    }

    setLoading(true);
    setRows([]);
    setSearchMeta(null);
    try {
      const qs = new URLSearchParams({
        fly_from: origin,
        fly_to: dest,
        date_from: departDate,
        date_to: departDate,
        adults: "1",
        currency: "USD",
      });
      if (tripType === "roundtrip" && returnDate) {
        qs.set("return_from", returnDate);
        qs.set("return_to", returnDate);
      }
      const data = await apiFetch<FlightRow[]>(`/flights/search?${qs.toString()}`);
      setRows(Array.isArray(data) ? data : []);
      setSearchMeta({
        fromLabel: from.label,
        toLabel: to.label,
        fromCode: origin,
        toCode: dest,
        departDate,
        returnDate: tripType === "roundtrip" ? returnDate : null,
        roundTrip: tripType === "roundtrip",
      });
    } catch (e) {
      setRows([]);
      const hint = e instanceof Error ? e.message : String(e);
      setErrorBanner(
        process.env.NODE_ENV === "development"
          ? `Flight search failed.\n${hint}\nAPI: ${API_BASE}`
          : "Flight search is unavailable right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [from, to, departDate, returnDate, tripType]);

  useEffect(() => {
    if (!handoff?.originIata || !handoff?.destinationIata) return;
    if (!getToken()) return;
    void runSearch();
  }, [handoff, runSearch]);

  const swapPlaces = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-2">
          {(["oneway", "roundtrip"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setTripType(type);
                if (type === "oneway") setReturnDate("");
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                tripType === type
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {type === "oneway" ? "One way" : "Round trip"}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">From</label>
            <FlightPlaceInput value={from} onChange={setFrom} placeholder="City or airport" />
          </div>
          <button
            type="button"
            onClick={swapPlaces}
            aria-label="Swap origin and destination"
            className="mt-6 flex h-11 w-11 items-center justify-center self-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-teal-600 md:mt-7"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
            <FlightPlaceInput value={to} onChange={setTo} placeholder="City or airport" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Depart</label>
            <input
              type="date"
              value={departDate}
              onChange={(e) => setDepartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          {tripType === "roundtrip" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Return</label>
              <input
                type="date"
                value={returnDate}
                min={departDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void runSearch()}
              className="w-full rounded-xl bg-teal-600 px-8 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-700 lg:min-w-[140px]"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {errorBanner ? (
        <div className="whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorBanner}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-72 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && searched && rows.length === 0 && !errorBanner ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600">
          <p>No flights found for this route and date.</p>
          <p className="mt-2 text-xs text-slate-500">
            Try different dates, one-way instead of round trip, or another airport pair.
          </p>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{routeSummary}</p>
              <p className="text-xs text-slate-500">
                {rows.length} option{rows.length === 1 ? "" : "s"}
                {searchMeta?.roundTrip ? " · Round trip total" : " · One way"}
              </p>
            </div>
            <p className="text-xs text-slate-500">Sorted by price</p>
          </div>

          <ul className="max-h-[min(70vh,720px)] divide-y divide-slate-100 overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id} className="p-4 transition hover:bg-slate-50/80 md:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      <Plane className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-slate-900">
                        {formatClock(row.departure_at)}
                        <span className="mx-2 font-normal text-slate-400">→</span>
                        {formatClock(row.arrival_at)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDuration(row.duration_minutes)}
                        <span className="mx-2 text-slate-300">·</span>
                        {row.stops === 0 ? "Nonstop" : `${row.stops} stop${row.stops > 1 ? "s" : ""}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.origin} → {row.destination}
                        {row.airlines.length ? ` · ${row.airlines.slice(0, 3).join(", ")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 md:shrink-0 md:justify-end">
                    <div className="text-left md:text-right">
                      <p className="text-xl font-extrabold text-slate-900">{formatPrice(row.currency, row.price)}</p>
                      <p className="text-xs text-slate-500">{searchMeta?.roundTrip ? "round trip" : "one way"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRow(row)}
                      className="inline-flex min-w-[100px] items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
                    >
                      Select
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selectedRow && searchMeta ? (
        <FlightBookModal row={selectedRow} meta={searchMeta} onClose={() => setSelectedRow(null)} />
      ) : null}
    </div>
  );
}
