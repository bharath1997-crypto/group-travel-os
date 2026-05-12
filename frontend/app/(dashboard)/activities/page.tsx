"use client";

import { API_BASE, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useCallback, useMemo, useState } from "react";

type ActivityRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  price: number;
  currency: string;
  duration_minutes: number | null;
  rating: number | null;
  image_url: string | null;
  booking_url: string;
  provider: string;
  category: string | null;
};

const CATEGORIES = [
  "",
  "Sightseeing",
  "Food & Drink",
  "Adventure",
  "Culture",
  "Entertainment",
] as const;

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDur(m: number | null): string {
  if (m == null || m < 1) return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

function stars(r: number | null): string {
  if (r == null || Number.isNaN(r)) return "—";
  const n = Math.round(r * 2) / 2;
  const full = Math.floor(n);
  const half = n - full >= 0.5 ? 1 : 0;
  return `${"★".repeat(full)}${half ? "½" : ""}${"☆".repeat(Math.max(0, 5 - full - half))}`;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="h-24 w-28 shrink-0 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-3">
          <div className="h-4 max-w-[85%] rounded bg-slate-200" />
          <div className="h-3 max-w-[55%] rounded bg-slate-200" />
          <div className="h-8 max-w-[45%] rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const [location, setLocation] = useState("NYC");
  const [day, setDay] = useState(todayPlus(14));
  const [adults, setAdults] = useState(1);
  const [categoryPick, setCategoryPick] = useState<string>("");

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [sort, setSort] = useState<"popular" | "price" | "rating">("popular");
  const [priceLo, setPriceLo] = useState(0);
  const [priceHi, setPriceHi] = useState(800);
  const [ratingMin, setRatingMin] = useState(0);
  const [catFilter, setCatFilter] = useState<string>("");

  const runSearch = useCallback(async () => {
    setErrorBanner(null);
    setSearched(true);
    if (!getToken()) {
      setErrorBanner("Please sign in to search activities.");
      return;
    }
    setLoading(true);
    setRows([]);
    try {
      const qs = new URLSearchParams({
        location: location.trim(),
        date: day,
        adults: String(adults),
      });
      if (categoryPick.trim())
        qs.set("category", categoryPick.trim());
      const data = await apiFetch<ActivityRow[]>(
        `/activities/search?${qs.toString()}`,
      );
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
  }, [location, day, adults, categoryPick]);

  const pbounds = useMemo(() => {
    if (!rows.length) return { lo: 0, hi: 800 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      lo = Math.min(lo, r.price);
      hi = Math.max(hi, r.price);
    }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 800 };
    if (lo === hi) return { lo: Math.max(0, lo - 10), hi: hi + 10 };
    return { lo: Math.floor(lo), hi: Math.ceil(hi) };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      if (r.price < Math.min(priceLo, priceHi) || r.price > Math.max(priceLo, priceHi))
        return false;
      if ((r.rating ?? 0) < ratingMin) return false;
      if (catFilter.trim()) {
        const c = r.category?.toLowerCase() ?? "";
        if (c !== catFilter.trim().toLowerCase()) return false;
      }
      return true;
    });
    if (sort === "price") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sort === "rating") {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else {
      list = [...list].sort((a, b) => {
        const rb = (b.rating ?? 0) - (a.rating ?? 0);
        if (rb !== 0) return rb;
        return a.price - b.price;
      });
    }
    return list;
  }, [rows, sort, priceLo, priceHi, ratingMin, catFilter]);

  return (
    <div className="min-h-[calc(100dvh-80px)] text-[#0F3460]">
      <div className="sticky top-0 z-20 -mx-3 border-b border-slate-200/80 bg-[#0F3460] px-3 py-4 text-white shadow-md md:-mx-5 md:px-5">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-lg font-bold tracking-tight md:text-xl">Activities</h1>
          <p className="mt-1 text-xs leading-relaxed text-teal-100/95 md:text-sm">
            Curated tours via GetYourGuide (Travelpayouts links — marker pending approval).
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <label className="flex flex-col gap-2 lg:col-span-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                Location
              </span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. NYC, Miami, Vancouver"
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm placeholder:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300/60"
              />
            </label>
            <label className="flex flex-col gap-2 lg:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                Date
              </span>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              />
            </label>
            <label className="flex flex-col gap-2 lg:col-span-2">
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
            <label className="flex flex-col gap-2 lg:col-span-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                Category (API)
              </span>
              <select
                value={categoryPick}
                onChange={(e) => setCategoryPick(e.target.value)}
                className="rounded-lg border border-white/30 bg-white px-3 py-2.5 text-sm text-[#0F3460] shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              >
                <option value="">All categories</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>
                    {c}
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
                Search
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
            <div className="mt-4">
              <p className="text-sm font-semibold text-[#0F3460]">Category</p>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F3460]"
              >
                <option value="">Any</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-sm font-semibold text-[#0F3460]">Price</p>
              <div className="flex justify-between text-xs text-slate-600">
                <span>${pbounds.lo}</span>
                <span>${pbounds.hi}</span>
              </div>
              <input
                type="range"
                min={pbounds.lo}
                max={pbounds.hi}
                value={priceLo}
                onChange={(e) => setPriceLo(Number(e.target.value))}
                className="w-full accent-teal-500"
              />
              <input
                type="range"
                min={pbounds.lo}
                max={pbounds.hi}
                value={priceHi}
                onChange={(e) => setPriceHi(Number(e.target.value))}
                className="w-full accent-teal-500"
              />
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold text-[#0F3460]">Min rating</p>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={ratingMin}
                onChange={(e) => setRatingMin(Number(e.target.value))}
                className="mt-2 w-full accent-teal-500"
              />
              <p className="text-xs text-slate-600">{ratingMin.toFixed(1)}+ ★</p>
            </div>
          </aside>

          <section className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Sort</span>
              {(
                [
                  ["popular", "Popular"],
                  ["price", "Price ↑"],
                  ["rating", "Rating"],
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

            {!loading && !searched ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600 shadow-sm">
                Pick a supported city (e.g. NYC, Chicago, LA, Miami, Las Vegas, Toronto,
                Vancouver) and tap Search.
              </div>
            ) : null}

            {loading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : null}

            {!loading &&
            searched &&
            !errorBanner &&
            rows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
                No activities for that location yet — try another supported city.
              </div>
            ) : null}

            {!loading && filtered.length === 0 && rows.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900 shadow-sm">
                No matches — loosen filters or clear category.
              </div>
            ) : null}

            <ul className="space-y-3">
              {filtered.map((a) => (
                <li
                  key={a.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-teal-50 text-4xl md:w-28">
                      🎯
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-600">
                          {a.category ?? "Experience"}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {a.provider}
                        </span>
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-[#0F3460]">{a.title}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {a.description}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        📍 {a.location} · {formatDur(a.duration_minutes)}
                      </p>
                      <p className="mt-1 text-sm text-amber-700">{stars(a.rating)}</p>
                    </div>
                    <div className="flex flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 md:w-44 md:flex-col md:border-t-0 md:pt-0">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          From
                        </p>
                        <p className="text-2xl font-extrabold text-teal-600">
                          {a.currency} {a.price.toFixed(0)}
                        </p>
                      </div>
                      <a
                        href={a.booking_url}
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
          </section>
        </div>
      </div>
    </div>
  );
}
