"use client";

import { API_BASE, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useCallback, useEffect, useMemo, useState } from "react";


type TripType = "oneway" | "return" | "multi";
type CabinLabel = "economy" | "business" | "first";
type SortMode = "cheapest" | "fastest" | "best";
type StopsFilter = "any" | "0" | "1" | "2plus";

type FlightRow = {
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

function cabinParam(c: CabinLabel): string {
  if (c === "business") return "C";
  if (c === "first") return "F";
  return "M";
}

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
  const zulu = iso.trim().endsWith("Z");
  if (zulu) return d.getUTCHours() + d.getUTCMinutes() / 60;
  return d.getHours() + d.getMinutes() / 60;
}

function formatClock(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const zulu = iso.trim().endsWith("Z");
  if (zulu) return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes < 1) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function stopsLabel(stops: number): string {
  if (stops <= 0) return "Direct";
  if (stops === 1) return "1 Stop";
  return `${stops} Stops`;
}

function airlineLabel(codes: string[]): string {
  if (!codes.length) return "Airlines";
  return codes.join(", ");
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

export default function FlightsPage() {
  const [tripType, setTripType] = useState<TripType>("return");
  const [from, setFrom] = useState("NYC");
  const [to, setTo] = useState("LON");
  const [depart, setDepart] = useState(todayPlus(14));
  const [returnDate, setReturnDate] = useState(todayPlus(21));
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState<CabinLabel>("economy");

  const [rows, setRows] = useState<FlightRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [sort, setSort] = useState<SortMode>("cheapest");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(5000);
  const [stopsFilter, setStopsFilter] = useState<StopsFilter>("any");
  const [airlinePick, setAirlinePick] = useState<Record<string, boolean>>({});
  const [depFrom, setDepFrom] = useState(0);
  const [depTo, setDepTo] = useState(24);

  const priceBounds = useMemo(() => {
    if (!rows.length) return { min: 0, max: 5000 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      lo = Math.min(lo, r.price);
      hi = Math.max(hi, r.price);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 5000 };
    if (lo === hi) return { min: Math.max(0, lo - 50), max: hi + 50 };
    return { min: Math.floor(lo), max: Math.ceil(hi) };
  }, [rows]);

  useEffect(() => {
    if (loading) return;
    if (!rows.length) {
      setPriceMin(0);
      setPriceMax(5000);
      return;
    }
    const { min, max } = priceBounds;
    setPriceMin(min);
    setPriceMax(max);
  }, [loading, rows, priceBounds.min, priceBounds.max]);

  const airlineOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      for (const a of r.airlines) s.add(a);
    }
    return Array.from(s).sort();
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const effLo = Math.min(priceMin, priceMax);
    const effHi = Math.max(priceMin, priceMax);
    let list = rows.filter((r) => {
      if (r.price < effLo || r.price > effHi) return false;
      if (stopsFilter === "0" && r.stops > 0) return false;
      if (stopsFilter === "1" && r.stops !== 1) return false;
      if (stopsFilter === "2plus" && r.stops < 2) return false;
      const t = parseClock(r.departure_at);
      if (t != null && (t < depFrom || t > depTo)) return false;
      const picked = Object.entries(airlinePick).filter(([, v]) => v).map(([k]) => k);
      if (picked.length) {
        const ok = r.airlines.some((a) => picked.includes(a));
        if (!ok) return false;
      }
      return true;
    });

    if (sort === "cheapest") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sort === "fastest") {
      list = [...list].sort((a, b) => a.duration_minutes - b.duration_minutes);
    } else {
      list = [...list].sort((a, b) => {
        if (a.stops !== b.stops) return a.stops - b.stops;
        if (a.duration_minutes !== b.duration_minutes) {
          return a.duration_minutes - b.duration_minutes;
        }
        return a.price - b.price;
      });
    }
    return list;
  }, [rows, priceMin, priceMax, stopsFilter, depFrom, depTo, airlinePick, sort]);

  const runSearch = useCallback(async () => {
    setErrorBanner(null);
    if (tripType === "multi") {
      setSearched(false);
      setRows([]);
      return;
    }
    setSearched(true);
    if (!getToken()) {
      setErrorBanner("Please sign in to search flights.");
      return;
    }
    setLoading(true);
    setRows([]);
    try {
      const qs = new URLSearchParams({
        fly_from: from.trim(),
        fly_to: to.trim(),
        date_from: depart,
        date_to: depart,
        adults: String(adults),
        currency: "USD",
        cabins: cabinParam(cabin),
      });
      if (tripType === "return") {
        qs.set("return_from", returnDate);
        qs.set("return_to", returnDate);
      }
      const data = await apiFetch<FlightRow[]>(`/flights/search?${qs.toString()}`);
      setRows(Array.isArray(data) ? data : []);
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
  }, [tripType, from, to, depart, returnDate, adults, cabin]);

  return (
    <div className="min-h-[calc(100dvh-80px)] text-[#0F3460]">
      <div className="sticky top-0 z-20 -mx-3 border-b border-slate-200/80 bg-[#0F3460] px-3 py-4 text-white shadow-md md:-mx-5 md:px-5">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-lg font-bold tracking-tight md:text-xl">Flights</h1>
          <p className="mt-1 text-xs leading-relaxed text-teal-100/95 md:text-sm">
            Search deals via Travello (Kiwi.com). Use airport or metro codes
            (e.g. CHI, LON); the API fills in airlines after you search.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["oneway", "One Way"],
                ["return", "Return"],
                ["multi", "Multi-city"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTripType(v)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition md:text-sm ${
                  tripType === v
                    ? "bg-teal-400 text-[#0F3460]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tripType === "multi" ? (
            <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-teal-100 md:text-sm">
              Multi-city search is coming soon. Use One Way or Return for now.
            </p>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <label className="flex flex-col gap-2 lg:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                From
              </span>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="e.g. CHI, NYC, LAX"
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm placeholder:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300/60"
              />
            </label>
            <label className="flex flex-col gap-2 lg:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                To
              </span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="e.g. LON, CDG"
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm placeholder:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300/60"
              />
            </label>
            <label className="flex flex-col gap-2 lg:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                Depart
              </span>
              <input
                type="date"
                value={depart}
                onChange={(e) => setDepart(e.target.value)}
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              />
            </label>
            {tripType === "return" ? (
              <label className="flex flex-col gap-2 lg:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                  Return
                </span>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-2 lg:col-span-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                Adults
              </span>
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              >
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 lg:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                Cabin
              </span>
              <select
                value={cabin}
                onChange={(e) => setCabin(e.target.value as CabinLabel)}
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              >
                <option value="economy">Economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
            </label>
            <div className="lg:col-span-1">
              <button
                type="button"
                disabled={tripType === "multi"}
                onClick={() => void runSearch()}
                className="w-full rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Search flights
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl px-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-[200px] lg:w-64 xl:w-72">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Filters
            </p>

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
              {priceMin > priceMax ? (
                <p className="text-[11px] text-rose-600">Adjust sliders so min ≤ max.</p>
              ) : null}
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-[#0F3460]">Stops</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["any", "Any"],
                    ["0", "Direct"],
                    ["1", "1 Stop"],
                    ["2plus", "2+ Stops"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStopsFilter(v)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      stopsFilter === v
                        ? "bg-[#0F3460] text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-[#0F3460]">Airlines</p>
              <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                {airlineOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">Search to see airlines</p>
                ) : (
                  airlineOptions.map((code) => (
                    <label
                      key={code}
                      className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(airlinePick[code])}
                        onChange={(e) =>
                          setAirlinePick((prev) => ({
                            ...prev,
                            [code]: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      {code}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-[#0F3460]">
                Departure time
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">
                  From (h)
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={Math.floor(depFrom)}
                    onChange={(e) =>
                      setDepFrom(
                        Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  To (h)
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={Math.ceil(depTo) === depTo ? depTo : Math.ceil(depTo)}
                    onChange={(e) =>
                      setDepTo(Math.min(24, Math.max(0, Number(e.target.value) || 24)))
                    }
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
              </div>
            </div>
          </aside>

          <section className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Sort</span>
              {(
                [
                  ["cheapest", "Cheapest"],
                  ["fastest", "Fastest"],
                  ["best", "Best"],
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

            {!loading && !searched && tripType !== "multi" ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600 shadow-sm">
                <p className="font-semibold text-[#0F3460]">
                  Ready when you are
                </p>
                <p className="mt-2 text-slate-600">
                  Set your airports and dates, then tap{" "}
                  <span className="font-semibold text-teal-600">Search flights</span>{" "}
                  above. Keep the FastAPI server running and confirm{" "}
                  <span className="font-mono text-xs text-slate-500">
                    NEXT_PUBLIC_API_URL
                  </span>{" "}
                  ends with{" "}
                  <span className="font-mono text-xs text-slate-500">
                    /api/v1
                  </span>{" "}
                  (matches <span className="font-mono text-xs">{API_BASE}</span>).
                </p>
              </div>
            ) : null}

            {loading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : null}

            {!loading && searched && !errorBanner && tripType !== "multi" && filteredSorted.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
                No flights found. Try different dates or airports.
              </div>
            ) : null}

            {!loading ? (
              <ul className="space-y-3">
                {filteredSorted.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">
                          ✈️
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#0F3460]">
                            {airlineLabel(f.airlines)}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                            <span className="font-semibold">{f.origin}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-semibold">{f.destination}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                f.stops === 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {stopsLabel(f.stops)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-baseline gap-3 text-[15px] font-semibold text-[#1C2833]">
                            <span>{formatClock(f.departure_at)}</span>
                            <span className="text-teal-500">→</span>
                            <span>{formatClock(f.arrival_at)}</span>
                            <span className="text-xs font-normal text-slate-500">
                              ({formatDuration(f.duration_minutes)})
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
                        <div className="text-left lg:text-right">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            From
                          </p>
                          <p className="text-2xl font-extrabold text-teal-600">
                            {f.currency}&nbsp;
                            {Number.isInteger(f.price)
                              ? f.price.toFixed(0)
                              : f.price.toFixed(2)}
                          </p>
                        </div>
                        <a
                          href={f.deep_link || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex min-w-[112px] items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white transition ${
                            f.deep_link
                              ? "bg-[#0F3460] hover:bg-[#0c2d52]"
                              : "cursor-not-allowed bg-slate-300"
                          }`}
                          onClick={(e) => {
                            if (!f.deep_link) e.preventDefault();
                          }}
                        >
                          View Deal
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
