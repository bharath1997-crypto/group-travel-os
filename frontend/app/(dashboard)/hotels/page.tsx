"use client";

import { API_BASE, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useCallback, useMemo, useState } from "react";

type HotelRow = {
  id: string;
  name: string;
  location: string;
  address: string;
  price_per_night: number;
  currency: string;
  rating: number | null;
  review_count: number | null;
  stars: number | null;
  image_url: string | null;
  amenities: string[];
  booking_url: string;
  provider: string;
};

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="h-28 w-28 shrink-0 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 max-w-[85%] rounded bg-slate-200" />
          <div className="h-3 max-w-[55%] rounded bg-slate-200" />
          <div className="h-8 max-w-[160px] rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

const COMMON_AMENITIES = ["Wi-Fi", "Pool", "Gym", "Breakfast", "Parking", "Spa"];

export default function HotelsPage() {
  const [location, setLocation] = useState("Miami");
  const [checkIn, setCheckIn] = useState(todayPlus(10));
  const [checkOut, setCheckOut] = useState(todayPlus(13));
  const [adults, setAdults] = useState(1);
  const [rooms, setRooms] = useState(1);

  const [rows, setRows] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [sort, setSort] = useState<"price" | "rating" | "stars">("price");
  const [priceLo, setPriceLo] = useState(0);
  const [priceHi, setPriceHi] = useState(900);
  const [starsMin, setStarsMin] = useState(1);
  const [amenPick, setAmenPick] = useState<Record<string, boolean>>({});

  const runSearch = useCallback(async () => {
    setErrorBanner(null);
    setSearched(true);
    if (!getToken()) {
      setErrorBanner("Please sign in to search hotels.");
      return;
    }
    setLoading(true);
    setRows([]);
    try {
      const qs = new URLSearchParams({
        location: location.trim(),
        check_in: checkIn,
        check_out: checkOut,
        adults: String(adults),
        rooms: String(rooms),
      });
      const data = await apiFetch<HotelRow[]>(`/hotels/search?${qs.toString()}`);
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
  }, [location, checkIn, checkOut, adults, rooms]);

  const pbounds = useMemo(() => {
    if (!rows.length) return { lo: 0, hi: 900 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      lo = Math.min(lo, r.price_per_night);
      hi = Math.max(hi, r.price_per_night);
    }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 900 };
    if (lo === hi) return { lo: Math.max(0, lo - 20), hi: hi + 20 };
    return { lo: Math.floor(lo), hi: Math.ceil(hi) };
  }, [rows]);

  const filtered = useMemo(() => {
    const picked = Object.entries(amenPick)
      .filter(([, v]) => v)
      .map(([k]) => k);
    let list = rows.filter((r) => {
      const lo = Math.min(priceLo, priceHi);
      const hi = Math.max(priceLo, priceHi);
      if (r.price_per_night < lo || r.price_per_night > hi) return false;
      if ((r.stars ?? 0) < starsMin) return false;
      if (picked.length) {
        const low = r.amenities.map((x) => x.toLowerCase());
        const ok = picked.every((p) =>
          low.some((a) => a.includes(p.toLowerCase())),
        );
        if (!ok) return false;
      }
      return true;
    });
    if (sort === "rating") {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sort === "stars") {
      list = [...list].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    } else {
      list = [...list].sort((a, b) => a.price_per_night - b.price_per_night);
    }
    return list;
  }, [rows, sort, priceLo, priceHi, starsMin, amenPick]);

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#F8FAFC] rounded-3xl p-6 md:p-8 text-slate-850 shadow-sm border border-slate-200/80">
      {/* Search Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center border border-teal-200/60">
            <span className="text-xl">🏨</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Rovvy Hotels</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Hotels
        </h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-2xl">
          Curated nightly rates via Agoda (Travelpayouts affiliate links).
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <label className="flex flex-col gap-1.5 lg:col-span-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Location
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. NYC, Miami, Vancouver"
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none transition"
            />
          </label>
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Check-in
            </span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none transition"
            />
          </label>
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Check-out
            </span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none transition"
            />
          </label>
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Adults
            </span>
            <select
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none transition"
            >
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 lg:col-span-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Rooms
            </span>
            <select
              value={rooms}
              onChange={(e) => setRooms(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none transition"
            >
              {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
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
              className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-teal-600/10 hover:bg-teal-700 transition"
            >
              Search hotels
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl px-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-[120px] lg:w-64 xl:w-72">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-550">
              Filters
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-slate-900">Price / night</p>
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
                className="w-full accent-teal-600"
              />
              <input
                type="range"
                min={pbounds.lo}
                max={pbounds.hi}
                value={priceHi}
                onChange={(e) => setPriceHi(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">Min stars</p>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={starsMin}
                onChange={(e) => setStarsMin(Number(e.target.value))}
                className="mt-2 w-full accent-teal-600"
              />
              <p className="text-xs text-slate-600">{starsMin}+ ⭐</p>
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">Amenities</p>
              <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                {COMMON_AMENITIES.map((a) => (
                  <label
                    key={a}
                    className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(amenPick[a])}
                      onChange={(e) =>
                        setAmenPick((prev) => ({
                          ...prev,
                          [a]: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    {a}
                  </label>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Sort</span>
              {(
                [
                  ["price", "Price"],
                  ["rating", "Rating"],
                  ["stars", "Stars"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSort(v)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    sort === v
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-205"
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
                Supported cities mirror Activities — NYC, Chicago, LA, Miami, Las Vegas,
                Toronto, Vancouver.
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
                No hotels returned — adjust dates or city spelling.
              </div>
            ) : null}

            {!loading && filtered.length === 0 && rows.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900 shadow-sm">
                No hotels match filters — reset amenities or star minimum.
              </div>
            ) : null}

            <ul className="space-y-3">
              {filtered.map((h) => (
                <li
                  key={h.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row">
                    <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-teal-50 text-4xl lg:w-32">
                      🏨
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold text-slate-900">
                          {h.name}
                        </span>
                        <span className="text-sm text-amber-700">
                          {(h.stars ?? 0) > 0 ? "⭐".repeat(h.stars!) : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-650">{h.address}</p>
                      <p className="text-sm font-semibold text-slate-700">{h.location}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {h.amenities.slice(0, 6).map((am) => (
                          <span
                            key={am}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                          >
                            {am}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Rating{" "}
                        <span className="font-semibold text-slate-900">
                          {h.rating?.toFixed(1) ?? "—"}
                        </span>
                        {h.review_count != null ? (
                          <span className="text-slate-550">
                            {" "}
                            · {h.review_count.toLocaleString()} reviews
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:w-44 lg:flex-col lg:border-t-0 lg:pt-0">
                      <div className="text-left lg:text-right">
                        <p className="text-xs font-semibold uppercase text-slate-555">
                          Per night
                        </p>
                        <p className="text-2xl font-extrabold text-teal-600">
                          {h.currency} {h.price_per_night.toFixed(0)}
                        </p>
                      </div>
                      <a
                        href={h.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-w-[112px] items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 shadow"
                      >
                        View Deal
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
