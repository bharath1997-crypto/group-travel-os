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

import { useEffect } from "react";

function getCleanBookingUrl(url: string): string {
  if (!url) return "#";
  if (url.includes("tp.media/r?marker=727732") || url.includes("marker=727732")) {
    try {
      const parsedUrl = new URL(url);
      const dest = parsedUrl.searchParams.get("u");
      if (dest) {
        return decodeURIComponent(dest);
      }
    } catch {
      // return original if error
    }
  }
  return url;
}

export default function ActivitiesPage() {
  const [activeTab, setActiveTab] = useState<"search" | "partners">("search");
  const [location, setLocation] = useState("Hyderabad");
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

  // Interactive Commission Calculator State
  const [calcGroupSize, setCalcGroupSize] = useState(4);
  const [calcTicketCost, setCalcTicketCost] = useState(100);
  const [calcCommissionRate, setCalcCommissionRate] = useState(10); // in percent

  const calcTotalPayout = useMemo(() => {
    return calcGroupSize * calcTicketCost * (calcCommissionRate / 100);
  }, [calcGroupSize, calcTicketCost, calcCommissionRate]);

  const handlePresetClick = useCallback((city: string) => {
    setLocation(city);
    setSearched(true);
    setLoading(true);
    setErrorBanner(null);
    setRows([]);
    const qs = new URLSearchParams({
      location: city.trim(),
      date: day,
      adults: String(adults),
    });
    apiFetch<ActivityRow[]>(`/activities/search?${qs.toString()}`)
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setErrorBanner(err instanceof Error ? err.message : String(err));
      });
  }, [day, adults]);

  useEffect(() => {
    // Check if there is a city in URL search params
    const params = new URLSearchParams(window.location.search);
    const urlCity = params.get("city") || params.get("location");
    if (urlCity) {
      handlePresetClick(urlCity);
      return;
    }

    // Detect surroundings location on load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
            );
            if (res.ok) {
              const data = await res.json();
              const city =
                data.address?.city ||
                data.address?.town ||
                data.address?.village ||
                data.address?.state ||
                "Hyderabad";
              handlePresetClick(city);
            } else {
              fallbackIP();
            }
          } catch {
            fallbackIP();
          }
        },
        () => {
          fallbackIP();
        }
      );
    } else {
      fallbackIP();
    }

    async function fallbackIP() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (res.ok) {
          const j = await res.json();
          const city = j.city || "Hyderabad";
          handlePresetClick(city);
        } else {
          handlePresetClick("Hyderabad");
        }
      } catch {
        handlePresetClick("Hyderabad");
      }
    }
  }, []);

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
          <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-lg font-bold tracking-tight md:text-xl">Activities & Partners</h1>
              <p className="text-xs leading-relaxed text-teal-100/95 md:text-sm">
                Consolidated live experience discovery and travel supplier networks.
              </p>
            </div>
            
            {/* Dynamic Tab Bar */}
            <div className="flex gap-2 bg-white/10 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("search")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === "search"
                    ? "bg-teal-500 text-white shadow"
                    : "text-slate-200 hover:text-white"
                }`}
              >
                🔍 Event Search
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("partners")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === "partners"
                    ? "bg-teal-500 text-white shadow"
                    : "text-slate-200 hover:text-white"
                }`}
              >
                💼 Partners & Costing
              </button>
            </div>
          </div>

          {activeTab === "search" && (
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
          )}

          {activeTab === "partners" && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-teal-200/90 leading-relaxed max-w-4xl">
                Rovvy integrates global metasearches, event ticketing systems, and community feeds. These integrations cost <strong>$0.00</strong> upfront and instead generate robust cash commissions for Rovvy on every transaction.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl px-3 md:px-0">
        {activeTab === "search" ? (
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

              {/* Multi-Region Presets Dashboard inside aside */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Presets</p>
                <div className="mt-3 space-y-3.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">US Destinations</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {["New York", "Chicago", "Miami", "Los Angeles"].map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handlePresetClick(city)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                            location.toLowerCase() === city.toLowerCase()
                              ? "bg-teal-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Europe Destinations</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {["London", "Paris", "Berlin", "Rome"].map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handlePresetClick(city)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                            location.toLowerCase() === city.toLowerCase()
                              ? "bg-teal-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Asia Destinations</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {["Hyderabad", "Tokyo", "Singapore", "Bali"].map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handlePresetClick(city)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                            location.toLowerCase() === city.toLowerCase()
                              ? "bg-teal-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
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
                  Search any city (e.g. Hyderabad, Tokyo, Singapore, Bali, NYC) or wait for your surroundings to load!
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
                  No activities found — try entering another city name.
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
                      {a.image_url ? (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          className="h-28 w-full shrink-0 rounded-xl object-cover md:w-28"
                        />
                      ) : (
                        <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-teal-50 text-4xl md:w-28">
                          🎯
                        </div>
                      )}
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
                          href={getCleanBookingUrl(a.booking_url)}
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

              {/* Viator Affiliate Section */}
              <div className="mt-8 rounded-2xl border border-teal-500/20 bg-gradient-to-r from-[#0F3460] to-slate-900 p-6 text-white shadow-lg">
                <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-400 border border-teal-500/30">
                        Premium Partner
                      </span>
                      <span className="text-xs text-slate-300">· Earns 8-12% commission per booking</span>
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-teal-100">
                      More Activities in {location || "your destination"} via Viator
                    </h3>
                    <p className="text-xs text-slate-300 max-w-xl">
                      Still looking for the perfect tour? Explore skip-the-line museum tickets, local day trips, and premium curated food tours in {location || "your destination"} via Viator.
                    </p>
                  </div>
                  <a
                    href={`https://www.viator.com/searchResults/all?text=${encodeURIComponent(location || "travel")}&pid=P00049707`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-teal-400 active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    Browse Viator Activities &rarr;
                  </a>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* PREMIUM DYNAMIC PARTNERS & COSTING VIEW */
          <div className="space-y-6 pb-12 animate-fadeIn">
            {/* Interactive Commission Calculator Banner */}
            <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2 max-w-xl">
                  <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-400">
                    Interactive Revenue Calculator
                  </span>
                  <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                    Dynamic Affiliate Earnings Projection
                  </h2>
                  <p className="text-sm text-slate-300">
                    Adjust the sliders below to estimate the cash commission Rovvy earns when a group travel coordinator books tickets for their trip buddies.
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl bg-teal-500/10 border border-teal-500/30 p-5 text-center min-w-[200px]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">Estimated Commission Payout</p>
                  <p className="mt-1 text-4xl font-extrabold text-teal-400">
                    USD {calcTotalPayout.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400 leading-tight">Paid directly by Viator / GetYourGuide</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3 border-t border-white/10 pt-6">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Group Size ({calcGroupSize} buddies)</span>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={calcGroupSize}
                    onChange={(e) => setCalcGroupSize(Number(e.target.value))}
                    className="accent-teal-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1</span>
                    <span>20</span>
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Ticket Price (USD {calcTicketCost})</span>
                  <input
                    type="range"
                    min={10}
                    max={500}
                    step={10}
                    value={calcTicketCost}
                    onChange={(e) => setCalcTicketCost(Number(e.target.value))}
                    className="accent-teal-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>$10</span>
                    <span>$500</span>
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Avg. Commission ({calcCommissionRate}%)</span>
                  <input
                    type="range"
                    min={5}
                    max={15}
                    value={calcCommissionRate}
                    onChange={(e) => setCalcCommissionRate(Number(e.target.value))}
                    className="accent-teal-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>5%</span>
                    <span>15%</span>
                  </div>
                </label>
              </div>
            </div>

            {/* 1. Revenue Generators */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-[#0F3460]">1. The "Revenue Generator" APIs (Affiliate & Metasearch)</h3>
              <p className="mt-1 text-sm text-slate-600">
                These APIs are completely free to integrate. They carry no monthly platform or token charges, and pay Rovvy high commissions on every booking.
              </p>
              
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">API Provider</th>
                      <th className="px-4 py-3">Integration Cost</th>
                      <th className="px-4 py-3">Monthly Fee</th>
                      <th className="px-4 py-3">Commission Paid to Rovvy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {[
                      ["GetYourGuide API", "$0.00 (Free)", "$0.00", "8% – 10% of total ticket price"],
                      ["Viator (TripAdvisor) API", "$0.00 (Free)", "$0.00", "8% – 12% of total ticket price"],
                      ["Tiqets B2B API", "$0.00 (Free)", "$0.00", "8% – 10% of total ticket price"],
                      ["Klook API", "$0.00 (Free)", "$0.00", "5% – 7% of total ticket price"],
                      ["Musement API", "$0.00 (Free)", "$0.00", "7% – 10% of total ticket price"],
                      ["Civitatis API", "$0.00 (Free)", "$0.00", "8% – 10% of total ticket price"],
                      ["Headout API", "$0.00 (Free)", "$0.00", "8% – 12% of total ticket price"],
                    ].map(([provider, icost, mfee, comm], idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5 font-bold text-slate-800">{provider}</td>
                        <td className="px-4 py-3.5 text-teal-600 font-semibold">{icost}</td>
                        <td className="px-4 py-3.5 text-slate-500">{mfee}</td>
                        <td className="px-4 py-3.5 text-slate-800 font-medium bg-teal-50/10">{comm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Free Search APIs & Resale Markets Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Free Search APIs */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#0F3460]">2. The "Free Search" APIs (Open Tiers)</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Open developer feeds to populate live schedules and coordinates with exactly $0.00 monthly cost.
                </p>
                <div className="mt-4 space-y-3.5">
                  {[
                    ["Ticketmaster Discovery API", "5,000 queries per day (Free)", "Custom enterprise beyond limits"],
                    ["Eventbrite API", "Open public event searches (Free)", "Ticketing booking fees apply"],
                    ["Songkick API", "100% Free public artist dates", "N/A"],
                    ["Bandsintown API", "100% Free public artist schedules", "N/A"],
                    ["Recreation.gov API (RIDB)", "100% Free public US government feed", "N/A"],
                    ["Meetup API", "Open public searches (Free)", "N/A"],
                  ].map(([provider, limit, pricing], idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{provider}</p>
                        <p className="text-xs text-teal-600 font-semibold mt-0.5">{limit}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded">
                        {pricing}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resale & Secondary Markets */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#0F3460]">3. Resale & Secondary Ticketing</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Secondary ticket marketplaces provide robust inventory for sold-out events and sports matches, paying high margins to Rovvy on resale tickets.
                  </p>
                  <div className="mt-4 space-y-4">
                    {[
                      ["SeatGeek Platform API", "5% – 7% of transaction resale value"],
                      ["StubHub Partner API", "5% – 6% of transaction resale value"],
                      ["Vivid Seats API", "6% – 8% of transaction resale value"],
                      ["Ticket Evolution API", "Structured white-label markup margins (custom)"],
                    ].map(([provider, comm], idx) => (
                      <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{provider}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Monthly Cost: $0.00</p>
                        </div>
                        <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-lg">
                          {comm}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-500 leading-normal">
                  📌 <strong>Integration Note:</strong> Using these metasearches allows Rovvy to offer comprehensive global experiences without any developer maintenance or server infrastructure cost!
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
