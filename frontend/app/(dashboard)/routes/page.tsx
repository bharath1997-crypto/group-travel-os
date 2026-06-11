"use client";

import { API_BASE, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useCallback, useMemo, useState } from "react";

type TransportMode = "flight" | "transit" | "bus" | "train" | "drive";
type TransportOptionRow = {
  mode: TransportMode;
  summary: string;
  duration_minutes: number;
  price_estimate: number | null;
  currency: string | null;
  steps: string[];
  booking_url: string | null;
  provider: string | null;
};

type RouteSearchPayload = {
  origin: string;
  destination: string;
  options: TransportOptionRow[];
};

type ModeFilter = "all" | "flights" | "ground" | "drive";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes < 1) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function modeIcon(mode: TransportMode): string {
  switch (mode) {
    case "flight":
      return "✈️";
    case "drive":
      return "🚗";
    case "bus":
      return "🚌";
    case "train":
      return "🚆";
    case "transit":
    default:
      return "🚇";
  }
}

function modeMatchesFilter(opt: TransportOptionRow, filter: ModeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "flights") return opt.mode === "flight";
  if (filter === "drive") return opt.mode === "drive";
  /* ground = bus / train / transit */
  return opt.mode === "bus" || opt.mode === "train" || opt.mode === "transit";
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-200" />
          </div>
        </div>
        <div className="h-9 w-28 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

export default function RoutesPage() {
  const [from, setFrom] = useState("ORD");
  const [to, setTo] = useState("JFK");
  const [travelDate, setTravelDate] = useState(todayPlus(7));
  const [adults, setAdults] = useState(1);

  const [filter, setFilter] = useState<ModeFilter>("all");
  const [rows, setRows] = useState<TransportOptionRow[]>([]);
  const [resolvedOrigin, setResolvedOrigin] = useState("");
  const [resolvedDest, setResolvedDest] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const filtered = useMemo(
    () => rows.filter((o) => modeMatchesFilter(o, filter)),
    [rows, filter],
  );

  const runSearch = useCallback(async () => {
    setErrorBanner(null);
    setSearched(true);
    if (!getToken()) {
      setErrorBanner("Please sign in to compare routes.");
      return;
    }
    const o = from.trim();
    const d = to.trim();
    if (!o || !d) {
      setErrorBanner("Enter both origin and destination.");
      return;
    }

    setLoading(true);
    setRows([]);
    try {
      const qs = new URLSearchParams({
        origin: o,
        destination: d,
        date: travelDate,
        adults: String(adults),
      });
      const data = await apiFetch<RouteSearchPayload>(
        `/routes/search?${qs.toString()}`,
      );
      setResolvedOrigin(data.origin);
      setResolvedDest(data.destination);
      setRows(Array.isArray(data.options) ? data.options : []);
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
  }, [from, to, travelDate, adults]);

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#F8FAFC] rounded-3xl p-6 md:p-8 text-slate-850 shadow-sm border border-slate-200/80">
      {/* Search Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center border border-teal-200/60">
            <span className="text-xl">🗺️</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Rovvy Routes</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          How to get there
        </h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-2xl">
          Compare flights (Kiwi.com) with transit and driving directions (Google
          Routes). Use airport codes or place names Google can resolve.
        </p>
      </div>

      {/* Search Inputs Card */}
      <div className="mx-auto max-w-6xl bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <label className="flex flex-col gap-2 lg:col-span-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              From
            </span>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="City or airport (e.g. ORD, Chicago)"
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
            />
          </label>
          <label className="flex flex-col gap-2 lg:col-span-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              To
            </span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="City or airport (e.g. JFK, New York)"
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
            />
          </label>
          <label className="flex flex-col gap-2 lg:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Date
            </span>
            <input
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
            />
          </label>
          <label className="flex flex-col gap-2 lg:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Passengers
            </span>
            <select
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
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
              className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 py-3 text-sm font-bold text-white shadow-md shadow-teal-600/10 transition"
            >
              Search routes
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl px-0">
        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          {(
            [
              ["all", "ALL"],
              ["flights", "✈️ FLIGHTS"],
              ["ground", "🚌 BUS/TRAIN"],
              ["drive", "🚗 DRIVE"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold md:text-sm transition ${
                filter === v
                  ? "bg-teal-600 text-white shadow-sm"
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

        {!loading && !searched ? (
          <div className="rounded-xl border border-dashed border-slate-350 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-650 shadow-sm">
            <p className="font-bold text-slate-900">
              Compare ways to travel
            </p>
            <p className="mt-2 text-slate-600">
              Enter origin and destination, pick a date, then tap{" "}
              <span className="font-semibold text-teal-600">Search routes</span>.
              Results are sorted fastest-first.
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}

        {!loading &&
        searched &&
        !errorBanner &&
        rows.length > 0 &&
        filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
            No options match this filter. Try{" "}
            <button
              type="button"
              className="font-semibold text-teal-600 underline"
              onClick={() => setFilter("all")}
            >
              ALL
            </button>
            .
          </div>
        ) : null}

        {!loading && searched && !errorBanner && rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
            No routes returned. Try different wording for places or another date.
          </div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <ul className="space-y-3">
            {searched && resolvedOrigin && resolvedDest ? (
              <li className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
                Showing{" "}
                <span className="font-bold text-slate-900">
                  {resolvedOrigin}
                </span>{" "}
                →{" "}
                <span className="font-bold text-slate-900">
                  {resolvedDest}
                </span>
                <span className="text-slate-400">
                  {" "}
                  · {filtered.length} option
                  {filtered.length !== 1 ? "s" : ""}
                  {filter !== "all" ? ` (${filter})` : ""}
                </span>
              </li>
            ) : null}
            {filtered.map((opt, idx) => (
              <li
                key={`${opt.mode}-${opt.summary}-${idx}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl">
                      {modeIcon(opt.mode)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                          {opt.mode}
                        </span>
                        {opt.provider ? (
                          <span className="text-xs font-semibold text-slate-500">
                            {opt.provider}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {opt.summary}
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-700">
                        {formatDuration(opt.duration_minutes)}
                      </p>
                      {opt.steps.length > 0 ? (
                        <details className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                          <summary className="cursor-pointer font-semibold text-slate-700">
                            Steps ({opt.steps.length})
                          </summary>
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
                            {opt.steps.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ol>
                        </details>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:w-52 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
                    <div className="text-left lg:text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Estimate
                      </p>
                      {opt.price_estimate != null && opt.currency ? (
                        <p className="text-xl font-extrabold text-teal-600">
                          {opt.currency}{" "}
                          {Number.isInteger(opt.price_estimate)
                            ? opt.price_estimate.toFixed(0)
                            : opt.price_estimate.toFixed(2)}
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-slate-500">
                          —
                        </p>
                      )}
                    </div>
                    <a
                      href={opt.booking_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex min-w-[112px] items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white transition ${
                        opt.booking_url
                          ? "bg-teal-600 hover:bg-teal-700 shadow-sm"
                          : "cursor-not-allowed bg-slate-300"
                      }`}
                      onClick={(e) => {
                        if (!opt.booking_url) e.preventDefault();
                      }}
                    >
                      {opt.mode === "flight" ? "Book flight" : "Book / info"}
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
