"use client";

import { API_BASE, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

type SortMode = "cheapest" | "fastest" | "earliest";
type TimeFilter = "any" | "morning" | "afternoon" | "evening";

type BusRow = {
  id: string;
  operator: string;
  origin: string;
  destination: string;
  departure_at: string;
  arrival_at: string;
  duration_minutes: number;
  price: number;
  currency: string;
  available_seats: number | null;
  booking_url: string;
  provider: string;
  amenities: string[];
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseClock(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() + d.getMinutes() / 60;
}

function formatClock(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes < 1) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-200" />
          </div>
        </div>
        <div className="h-8 w-40 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

const POPULAR_ROUTES = [
  { from: "NYC", to: "Boston", price: 15 },
  { from: "Chicago", to: "Detroit", price: 40 },
  { from: "LA", to: "Las Vegas", price: 35 },
  { from: "NYC", to: "Washington DC", price: 30 },
  { from: "Toronto", to: "Montreal", price: 45 },
  { from: "Vancouver", to: "Seattle", price: 30 },
];

export default function BusesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(todayPlus(7));
  const [passengers, setPassengers] = useState(1);

  const [rows, setRows] = useState<BusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [sort, setSort] = useState<SortMode>("cheapest");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(100);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("any");
  const [operatorPick, setOperatorPick] = useState<Record<string, boolean>>({});
  const [amenityPick, setAmenityPick] = useState<Record<string, boolean>>({});

  const priceBounds = useMemo(() => {
    if (!rows.length) return { min: 0, max: 100 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      lo = Math.min(lo, r.price);
      hi = Math.max(hi, r.price);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 100 };
    if (lo === hi) return { min: Math.max(0, lo - 10), max: hi + 10 };
    return { min: Math.floor(lo), max: Math.ceil(hi) };
  }, [rows]);

  useEffect(() => {
    if (loading) return;
    if (!rows.length) {
      setPriceMin(0);
      setPriceMax(100);
      return;
    }
    const { min, max } = priceBounds;
    setPriceMin(min);
    setPriceMax(max);
  }, [loading, rows, priceBounds.min, priceBounds.max]);

  const operatorOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.operator);
    return Array.from(s).sort();
  }, [rows]);

  const amenityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      for (const a of r.amenities) s.add(a);
    }
    return Array.from(s).sort();
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const effLo = Math.min(priceMin, priceMax);
    const effHi = Math.max(priceMin, priceMax);
    
    let list = rows.filter((r) => {
      if (r.price < effLo || r.price > effHi) return false;
      
      const t = parseClock(r.departure_at);
      if (t != null) {
        if (timeFilter === "morning" && (t < 5 || t >= 12)) return false;
        if (timeFilter === "afternoon" && (t < 12 || t >= 17)) return false;
        if (timeFilter === "evening" && (t < 17 || t >= 24)) return false;
      }
      
      const pickedOps = Object.entries(operatorPick).filter(([, v]) => v).map(([k]) => k);
      if (pickedOps.length && !pickedOps.includes(r.operator)) return false;
      
      const pickedAmens = Object.entries(amenityPick).filter(([, v]) => v).map(([k]) => k);
      if (pickedAmens.length) {
        const ok = pickedAmens.every((a) => r.amenities.includes(a));
        if (!ok) return false;
      }
      
      return true;
    });

    if (sort === "cheapest") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sort === "fastest") {
      list = [...list].sort((a, b) => a.duration_minutes - b.duration_minutes);
    } else if (sort === "earliest") {
      list = [...list].sort((a, b) => {
        const ta = parseClock(a.departure_at) || 0;
        const tb = parseClock(b.departure_at) || 0;
        return ta - tb;
      });
    }
    return list;
  }, [rows, priceMin, priceMax, timeFilter, operatorPick, amenityPick, sort]);

  const runSearch = useCallback(async (customFrom?: string, customTo?: string) => {
    setErrorBanner(null);
    const searchFrom = customFrom || from;
    const searchTo = customTo || to;
    
    if (!searchFrom || !searchTo) {
      setErrorBanner("Please enter both origin and destination.");
      return;
    }
    
    setSearched(true);
    if (!getToken()) {
      setErrorBanner("Please sign in to search buses.");
      return;
    }
    setLoading(true);
    setRows([]);
    
    try {
      const qs = new URLSearchParams({
        origin: searchFrom.trim(),
        destination: searchTo.trim(),
        date: date,
        adults: String(passengers),
        currency: "USD",
      });
      
      const data = await apiFetch<{ results: BusRow[] }>(`/buses/search?${qs.toString()}`);
      setRows(Array.isArray(data.results) ? data.results : []);
    } catch (e) {
      setRows([]);
      const hint = e instanceof Error ? e.message : String(e);
      const base = "Something went wrong. Please try again.";
      setErrorBanner(
        process.env.NODE_ENV === "development"
          ? `${base}\n${hint}\nAPI: ${API_BASE}`
          : base,
      );
    } finally {
      setLoading(false);
    }
  }, [from, to, date, passengers]);

  const fillAndSearch = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    runSearch(f, t);
  };

  return (
    <div className="min-h-[calc(100dvh-80px)] text-[#0F3460]">
      {/* Sticky Search Bar */}
      <div className="sticky top-0 z-20 -mx-3 border-b border-slate-200/80 bg-[#0F3460] px-3 py-4 text-white shadow-md md:-mx-5 md:px-5">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-lg font-bold tracking-tight md:text-xl">Buses</h1>
          <p className="mt-1 text-xs leading-relaxed text-teal-100/95 md:text-sm">
            Search bus deals via Busbud.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <label className="flex flex-col gap-2 lg:col-span-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                From
              </span>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="e.g. NYC, Chicago"
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm placeholder:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300/60"
              />
            </label>
            <label className="flex flex-col gap-2 lg:col-span-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                To
              </span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="e.g. Boston, Detroit"
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm placeholder:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300/60"
              />
            </label>
            <label className="flex flex-col gap-2 lg:col-span-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              />
            </label>
            <label className="flex flex-col gap-2 lg:col-span-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                Guests
              </span>
              <select
                value={passengers}
                onChange={(e) => setPassengers(Number(e.target.value))}
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              >
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={() => void runSearch()}
                className="w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-400"
              >
                Search Buses
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl px-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Sidebar */}
          <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-[200px] lg:w-64 xl:w-72">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Filters
            </p>

            {/* Price Filter */}
            <div className="mt-4 space-y-1">
              <p className="text-sm font-semibold text-[#0F3460]">Price</p>
              <div className="flex gap-2 text-xs text-slate-600">
                <span>${priceBounds.min}</span>
                <span className="ml-auto">${priceBounds.max}</span>
              </div>
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                value={priceMin}
                onChange={(e) => setPriceMin(Number(e.target.value))}
                className="w-full accent-teal-500"
              />
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                value={priceMax}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                className="w-full accent-teal-500"
              />
            </div>

            {/* Operators Filter */}
            <div className="mt-5">
              <p className="text-sm font-semibold text-[#0F3460]">Operators</p>
              <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                {operatorOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">Search to see operators</p>
                ) : (
                  operatorOptions.map((op) => (
                    <label
                      key={op}
                      className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(operatorPick[op])}
                        onChange={(e) =>
                          setOperatorPick((prev) => ({
                            ...prev,
                            [op]: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      {op}
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Departure Time Filter */}
            <div className="mt-5">
              <p className="text-sm font-semibold text-[#0F3460]">Departure</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["any", "Any"],
                    ["morning", "Morning"],
                    ["afternoon", "Afternoon"],
                    ["evening", "Evening"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTimeFilter(v)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      timeFilter === v
                        ? "bg-[#0F3460] text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amenities Filter */}
            <div className="mt-5">
              <p className="text-sm font-semibold text-[#0F3460]">Amenities</p>
              <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                {amenityOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">Search to see amenities</p>
                ) : (
                  amenityOptions.map((am) => (
                    <label
                      key={am}
                      className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(amenityPick[am])}
                        onChange={(e) =>
                          setAmenityPick((prev) => ({
                            ...prev,
                            [am]: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      {am}
                    </label>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* Results Area */}
          <section className="min-w-0 flex-1 space-y-3">
            {/* Sort Bar */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Sort</span>
              {(
                [
                  ["cheapest", "Cheapest"],
                  ["fastest", "Fastest"],
                  ["earliest", "Earliest"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSort(v)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    sort === v
                      ? "bg-teal-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {errorBanner ? (
              <div className="whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
                {errorBanner}
              </div>
            ) : null}

            {/* Popular Routes (shown before search) */}
            {!searched && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-[#0F3460]">Popular Routes</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {POPULAR_ROUTES.map((route) => (
                    <div
                      key={`${route.from}-${route.to}`}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                      onClick={() => fillAndSearch(route.from, route.to)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#0F3460]">
                            {route.from} → {route.to}
                          </p>
                          <p className="text-xs text-slate-500">from ${route.price}</p>
                        </div>
                        <span className="text-teal-600">→</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : null}

            {!loading && searched && !errorBanner && filteredSorted.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
                No buses found for this route. Try different cities or dates.
              </div>
            ) : null}

            {!loading && searched ? (
              <ul className="space-y-3">
                {filteredSorted.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">
                          🚌
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#0F3460]">
                            {b.operator}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                            <span className="font-semibold">{b.origin}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-semibold">{b.destination}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-baseline gap-3 text-[15px] font-semibold text-[#1C2833]">
                            <span>{formatClock(b.departure_at)}</span>
                            <span className="text-teal-500">→</span>
                            <span>{formatClock(b.arrival_at)}</span>
                            <span className="text-xs font-normal text-slate-500">
                              ({formatDuration(b.duration_minutes)})
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {b.amenities.map((am) => (
                              <span
                                key={am}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                              >
                                {am}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
                        <div className="text-left lg:text-right">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            From
                          </p>
                          <p className="text-2xl font-extrabold text-teal-600">
                            {b.currency}&nbsp;{b.price.toFixed(2)}
                          </p>
                          {b.available_seats && (
                            <p className="text-xs text-rose-600">
                              {b.available_seats} seats left
                            </p>
                          )}
                        </div>
                        <a
                          href={b.booking_url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-w-[112px] items-center justify-center rounded-xl bg-[#0F3460] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0c2d52]"
                        >
                          Book Now
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
