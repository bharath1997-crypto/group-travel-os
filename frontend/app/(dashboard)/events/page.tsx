"use client";

import { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  dedupeExploreEvents,
  saveEventSnapshot,
} from "@/lib/explore-events";

type GlobalEvent = {
  id: string;
  name: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  country: string;
  image_url: string | null;
  ticket_url: string;
  price_min: number | null;
  price_max: number | null;
  source: string;
};

type EventsAPIResponse = {
  city: string;
  total: number;
  page: number;
  per_page: number;
  events: GlobalEvent[];
};

type UserCoords = { lat: number; lon: number };

const LS_EXPLORE_CITY = "rovvy_explore_city";
const LS_EXPLORE_COORDS = "rovvy_explore_coords";
const EXPLORE_RADIUS_MILES = 200;
const PAGE_SIZE_OPTIONS = [10, 15, 20] as const;

function cityLabel(value: string): string {
  return value.split(",")[0]?.trim() || value;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
      );
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pseudoRating(event: GlobalEvent): { score: number; reviews: number } {
  const seed = hashSeed(event.id || event.name);
  const score = 3.5 + (seed % 15) / 10;
  const reviews = 40 + (seed % 480);
  return { score: Math.round(score * 10) / 10, reviews };
}

function pseudoDistanceMiles(event: GlobalEvent, userCity: string): string {
  if (cityLabel(event.city).toLowerCase() === cityLabel(userCity).toLowerCase()) {
    const seed = hashSeed(event.id);
    return `${(seed % 18) + 2} mi away`;
  }
  return event.city;
}

function availabilityLabel(event: GlobalEvent): string {
  if (!event.date) return "Dates TBA";
  const formatted = formatDate(event.date);
  if (event.time) return `${formatted} · ${event.time}`;
  return formatted;
}

function dedupeEvents(events: GlobalEvent[]): GlobalEvent[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: GlobalEvent[] = [];
  for (const ev of events) {
    const id = (ev.id || "").trim();
    const nameKey = `${(ev.name || "").trim().toLowerCase()}|${ev.date || ""}`;
    if (id && seenIds.has(id)) continue;
    if (seenNames.has(nameKey)) continue;
    if (id) seenIds.add(id);
    seenNames.add(nameKey);
    result.push(ev);
  }
  return result;
}

function buildPageNumbers(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (current < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

function loadExploreCoords(): UserCoords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_EXPLORE_COORDS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserCoords;
    if (typeof parsed.lat === "number" && typeof parsed.lon === "number") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

type EventCardProps = {
  event: GlobalEvent;
  userCity: string;
  onOpen: (event: GlobalEvent) => void;
};

function EventCard({ event, userCity, onOpen }: EventCardProps) {
  const { score, reviews } = pseudoRating(event);
  const fullStars = Math.floor(score);
  const distanceLabel =
    cityLabel(event.city).toLowerCase() === cityLabel(userCity).toLowerCase()
      ? pseudoDistanceMiles(event, userCity)
      : event.city;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(event);
      }}
      className="cursor-pointer overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm transition-all hover:border-teal-500 hover:shadow-md"
    >
      <div className="relative h-40 overflow-hidden bg-slate-100">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-200">
            <span className="text-sm text-slate-400">No image</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-teal-600 px-2 py-1 text-xs font-medium text-white">
          {event.category || "Event"}
        </span>
        {event.price_min != null && (
          <span className="absolute right-2 top-2 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-semibold text-slate-800">
            From ${Math.round(event.price_min)}
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-[#1E293B]">
          {event.name}
        </h3>

        <div className="mb-2 flex items-center gap-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={12}
                className={
                  i <= fullStars
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-slate-300"
                }
              />
            ))}
          </div>
          <span className="ml-1 text-xs text-[#475569]">
            {score.toFixed(1)} ({reviews})
          </span>
        </div>

        <div className="mb-1 flex items-center gap-1">
          <MapPin size={12} className="shrink-0 text-muted" />
          <span className="truncate text-xs text-[#475569]">
            {event.venue || event.city}
            {event.city ? ` · ${event.city}` : ""}
          </span>
        </div>

        {event.date && (
          <div className="mb-1 flex items-center gap-1">
            <Calendar size={12} className="shrink-0 text-muted" />
            <span className="text-xs text-[#475569]">
              {formatDate(event.date)}
              {event.time ? ` · ${event.time}` : ""}
            </span>
          </div>
        )}

        <div className="mb-1 flex items-center gap-1">
          <Navigation size={12} className="shrink-0 text-muted" />
          <span className="text-xs text-[#475569]">{distanceLabel}</span>
        </div>

        <div className="flex items-center gap-1">
          <Clock size={12} className="shrink-0 text-muted" />
          <span className="text-xs text-muted">{availabilityLabel(event)}</span>
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="h-40 animate-pulse bg-slate-200" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

function EventsSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [city, setCity] = useState("Chicago");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("All");
  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(20);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const pageNumbers = useMemo(
    () => buildPageNumbers(page, totalPages),
    [page, totalPages],
  );

  const runSearch = useCallback(
    async (
      searchCity: string,
      fromDate: string,
      toDate: string,
      searchCat: string,
      targetPage: number,
      targetPerPage: number,
      coords: UserCoords | null,
    ) => {
      if (!searchCity.trim()) return;
      setErrorMsg(null);
      setLoading(true);
      setSearched(true);

      try {
        const params = new URLSearchParams({
          city: searchCity.trim(),
          page: targetPage.toString(),
          per_page: targetPerPage.toString(),
          view: "list",
        });

        if (fromDate) params.set("date_from", fromDate);
        if (toDate) params.set("date_to", toDate);
        if (searchCat && searchCat !== "All" && searchCat !== "Activities") {
          params.set("category", searchCat);
        }
        if (coords) {
          params.set("lat", coords.lat.toString());
          params.set("lon", coords.lon.toString());
          params.set("radius", EXPLORE_RADIUS_MILES.toString());
        }

        const res = await apiFetch<EventsAPIResponse>(
          `/explore/events?${params.toString()}`,
        );

        let unique = dedupeExploreEvents(res?.events || []);
        if (searchCat === "Activities") {
          unique = unique.filter((ev) =>
            ["experience", "entertainment", "cultural", "arts", "comedy"].includes(
              (ev.category || "").trim().toLowerCase(),
            ),
          );
        }
        setEvents(unique);
        setTotalCount(searchCat === "Activities" ? unique.length : (res?.total || 0));
        setPage(targetPage);
        setPerPage(targetPerPage);
      } catch (e) {
        setEvents([]);
        setErrorMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const syncUrl = useCallback(
    (
      searchCity: string,
      fromDate: string,
      toDate: string,
      searchCat: string,
      targetPage: number,
      targetPerPage: number,
      coords: UserCoords | null,
    ) => {
      const params = new URLSearchParams();
      params.set("city", searchCity.trim());
      params.set("page", targetPage.toString());
      params.set("per_page", targetPerPage.toString());
      if (searchCat !== "All") params.set("category", searchCat);
      if (fromDate) params.set("date_from", fromDate);
      if (toDate) params.set("date_to", toDate);
      if (coords) {
        params.set("lat", coords.lat.toString());
        params.set("lon", coords.lon.toString());
        params.set("radius", EXPLORE_RADIUS_MILES.toString());
      }
      router.replace(`/events?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    const cityParam = searchParams.get("city") || "Chicago";
    const catParam = searchParams.get("category") || "All";
    const fromParam = searchParams.get("date_from") || "";
    const toParam = searchParams.get("date_to") || "";
    const pageParam = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPageParam = parseInt(searchParams.get("per_page") || "20", 10);
    const safePerPage = PAGE_SIZE_OPTIONS.includes(
      perPageParam as (typeof PAGE_SIZE_OPTIONS)[number],
    )
      ? perPageParam
      : 20;

    const latParam = searchParams.get("lat");
    const lonParam = searchParams.get("lon");
    let coords: UserCoords | null = null;
    if (latParam && lonParam) {
      const lat = parseFloat(latParam);
      const lon = parseFloat(lonParam);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        coords = { lat, lon };
      }
    }
    if (!coords) {
      coords = loadExploreCoords();
    }

    setCity(cityParam);
    setCategory(catParam);
    setDateFrom(fromParam);
    setDateTo(toParam);
    setPage(pageParam);
    setPerPage(safePerPage);
    setUserCoords(coords);

    runSearch(cityParam, fromParam, toParam, catParam, pageParam, safePerPage, coords);
  }, [searchParams, runSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    syncUrl(city, dateFrom, dateTo, category, 1, perPage, userCoords);
  };

  const handleChipClick = (targetCity: string) => {
    setCity(targetCity);
    setUserCoords(null);
    syncUrl(targetCity, dateFrom, dateTo, category, 1, perPage, null);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    syncUrl(city, dateFrom, dateTo, category, nextPage, perPage, userCoords);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePerPageChange = (nextPerPage: number) => {
    syncUrl(city, dateFrom, dateTo, category, 1, nextPerPage, userCoords);
  };

  const handleOpenEvent = (event: GlobalEvent) => {
    saveEventSnapshot(event);
    router.push(
      `/explore/event/${encodeURIComponent(event.id)}?city=${encodeURIComponent(cityLabel(city))}`,
    );
  };

  const showingFrom = totalCount === 0 ? 0 : (page - 1) * perPage + 1;
  const showingTo = Math.min(page * perPage, totalCount);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/explore")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#475569] shadow-sm transition hover:border-teal-500 hover:text-teal-600"
          title="Back to Explore"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">
            {category === "Activities"
              ? `Activities near ${cityLabel(city)}`
              : category === "Sports"
                ? `Sports near ${cityLabel(city)}`
                : "All Events"}
          </h1>
          <p className="mt-0.5 text-sm text-[#475569]">
            {userCoords
              ? `Events within ${EXPLORE_RADIUS_MILES} miles of ${city}`
              : `Browse events in ${cityLabel(city)}`}
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label
                htmlFor="city"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#475569]"
              >
                City
              </label>
              <input
                type="text"
                id="city"
                required
                placeholder="Search any city..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-app px-3 py-2.5 text-sm text-[#1E293B] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="dateFrom"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#475569]"
              >
                From
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-app px-3 py-2.5 text-sm text-[#1E293B] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="dateTo"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#475569]"
              >
                To
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-app px-3 py-2.5 text-sm text-[#1E293B] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="category"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#475569]"
              >
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-app px-3 py-2.5 text-sm text-[#1E293B] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="All">All Categories</option>
                <option value="Activities">Activities</option>
                <option value="Music">Music</option>
                <option value="Sports">Sports</option>
                <option value="Arts">Arts</option>
                <option value="Family">Family</option>
                <option value="Food">Food</option>
                <option value="Festival">Festival</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted">Popular:</span>
              {["Chicago", "New York", "Los Angeles", "Miami", "Austin", "Seattle"].map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleChipClick(c)}
                    className="rounded-full border border-[#E2E8F0] bg-app px-3 py-1 text-xs font-medium text-[#475569] transition hover:border-teal-500 hover:text-teal-600"
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {searched && !loading && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#475569]">
            {totalCount > 0 ? (
              <>
                Showing{" "}
                <span className="font-semibold text-[#1E293B]">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-[#1E293B]">
                  {totalCount.toLocaleString()}
                </span>{" "}
                events in{" "}
                <span className="font-semibold text-teal-600">{cityLabel(city)}</span>
              </>
            ) : (
              <>No events found in {cityLabel(city)}</>
            )}
          </p>

          <div className="flex items-center gap-2">
            <label htmlFor="perPage" className="text-xs font-medium text-muted">
              Per page:
            </label>
            <select
              id="perPage"
              value={perPage}
              onChange={(e) => handlePerPageChange(parseInt(e.target.value, 10))}
              className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[#1E293B] focus:border-teal-500 focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: perPage > 8 ? 8 : perPage }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && searched && events.length === 0 && !errorMsg && (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-12 text-center">
          <p className="text-lg font-semibold text-[#1E293B]">No events found</p>
          <p className="mt-2 text-sm text-muted">
            Try a different city, category, or date range.
          </p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((ev, index) => (
            <EventCard
              key={`${ev.id}-${index}`}
              event={ev}
              userCity={city}
              onOpen={handleOpenEvent}
            />
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <nav
          className="mt-10 flex flex-wrap items-center justify-center gap-1"
          aria-label="Pagination"
        >
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#475569] transition hover:border-teal-500 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} />
            Prev
          </button>

          {pageNumbers.map((p, idx) =>
            p === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-sm text-muted"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => handlePageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border px-3 text-sm font-medium transition ${
                  p === page
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-[#E2E8F0] bg-white text-[#475569] hover:border-teal-500 hover:text-teal-600"
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#475569] transition hover:border-teal-500 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-app p-4 md:p-6">
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-6 h-10 w-48 animate-pulse rounded bg-slate-200" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        }
      >
        <EventsSearchContent />
      </Suspense>
    </div>
  );
}
