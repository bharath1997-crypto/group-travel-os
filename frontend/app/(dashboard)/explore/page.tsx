"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  Clock,
  MapPin,
  Navigation,
  Search,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

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
  trending?: GlobalEvent[];
  weekend?: GlobalEvent[];
  popular?: GlobalEvent[];
  national?: GlobalEvent[];
  radius_miles?: number | null;
  nearby_cities?: { name: string; state: string; distance_miles: number }[];
};

type UserCoords = { lat: number; lon: number };

type CitySuggestion = {
  label: string;
  city: string;
  place_id: string;
};

type CityAutocompleteResponse = {
  suggestions: CitySuggestion[];
};

const EVENTS_FETCH_TIMEOUT_MS = 20_000;
const LS_EXPLORE_CITY = "rovvy_explore_city";
const LS_EXPLORE_COORDS = "rovvy_explore_coords";
const EXPLORE_RADIUS_MILES = 200;

const MAJOR_CITIES: { name: string; state: string; lat: number; lon: number }[] = [
  { name: "Chicago", state: "IL", lat: 41.8781, lon: -87.6298 },
  { name: "New York", state: "NY", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles", state: "CA", lat: 34.0522, lon: -118.2437 },
  { name: "San Francisco", state: "CA", lat: 37.7749, lon: -122.4194 },
  { name: "San Jose", state: "CA", lat: 37.3382, lon: -121.8863 },
  { name: "Oakland", state: "CA", lat: 37.8044, lon: -122.2712 },
  { name: "Houston", state: "TX", lat: 29.7604, lon: -95.3698 },
  { name: "Phoenix", state: "AZ", lat: 33.4484, lon: -112.074 },
  { name: "Philadelphia", state: "PA", lat: 39.9526, lon: -75.1652 },
  { name: "San Antonio", state: "TX", lat: 29.4241, lon: -98.4936 },
  { name: "San Diego", state: "CA", lat: 32.7157, lon: -117.1611 },
  { name: "Dallas", state: "TX", lat: 32.7767, lon: -96.797 },
  { name: "Austin", state: "TX", lat: 30.2672, lon: -97.7431 },
  { name: "Miami", state: "FL", lat: 25.7617, lon: -80.1918 },
  { name: "Milwaukee", state: "WI", lat: 43.0389, lon: -87.9065 },
  { name: "Indianapolis", state: "IN", lat: 39.7684, lon: -86.1581 },
  { name: "Detroit", state: "MI", lat: 42.3314, lon: -83.0458 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestMajorCity(lat: number, lon: number): { city: string; label: string } {
  let best = MAJOR_CITIES[0];
  let bestDist = Infinity;
  for (const major of MAJOR_CITIES) {
    const dist = haversineKm(lat, lon, major.lat, major.lon);
    if (dist < bestDist) {
      bestDist = dist;
      best = major;
    }
  }
  return { city: best.name, label: `${best.name}, ${best.state}` };
}

function saveExploreCity(label: string, coords?: UserCoords | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_EXPLORE_CITY, label);
    if (coords) {
      localStorage.setItem(LS_EXPLORE_COORDS, JSON.stringify(coords));
    } else {
      localStorage.removeItem(LS_EXPLORE_COORDS);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function loadExploreCity(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LS_EXPLORE_CITY);
  } catch {
    return null;
  }
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

const CATEGORY_PILLS = [
  "All",
  "Events",
  "Activities",
  "Sports",
  "Food",
  "Nightlife",
  "Parks",
] as const;

type CategoryPill = (typeof CATEGORY_PILLS)[number];

const STATE_BY_CITY: Record<string, string> = {
  Chicago: "Illinois",
  Milwaukee: "Wisconsin",
  Indianapolis: "Indiana",
  Detroit: "Michigan",
  "New York": "New York",
  "Los Angeles": "California",
  Houston: "Texas",
  Phoenix: "Arizona",
  Philadelphia: "Pennsylvania",
  "San Antonio": "Texas",
  "San Diego": "California",
  Dallas: "Texas",
  "San Jose": "California",
  Austin: "Texas",
  Miami: "Florida",
};

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

function matchesCategory(event: GlobalEvent, category: CategoryPill): boolean {
  if (category === "All" || category === "Events") return true;
  const cat = (event.category || "").toLowerCase();
  const name = (event.name || "").toLowerCase();
  switch (category) {
    case "Activities":
      return (
        cat.includes("misc") ||
        cat.includes("family") ||
        cat.includes("art") ||
        name.includes("tour") ||
        name.includes("showcase")
      );
    case "Sports":
      return cat.includes("sport");
    case "Food":
      return cat.includes("food") || name.includes("food") || name.includes("wine");
    case "Nightlife":
      return (
        cat.includes("music") ||
        cat.includes("club") ||
        name.includes("dj") ||
        name.includes("night")
      );
    case "Parks":
      return (
        cat.includes("fest") ||
        cat.includes("family") ||
        name.includes("park") ||
        name.includes("garden")
      );
    default:
      return true;
  }
}

function matchesSearch(event: GlobalEvent, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return [event.name, event.venue, event.city, event.category]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function availabilityLabel(event: GlobalEvent): string {
  if (!event.date) return "Dates TBA";
  const formatted = formatDate(event.date);
  if (event.time) return `${formatted} · ${event.time}`;
  return formatted;
}

type ExploreCardProps = {
  event: GlobalEvent;
  userCity: string;
  onOpen: (event: GlobalEvent) => void;
};

function ExploreCard({ event, userCity, onOpen }: ExploreCardProps) {
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
          <MapPin size={12} className="shrink-0 text-[#94A3B8]" />
          <span className="truncate text-xs text-[#475569]">
            {event.venue || event.city}
            {event.city ? ` · ${event.city}` : ""}
          </span>
        </div>

        {event.date && (
          <div className="mb-1 flex items-center gap-1">
            <Calendar size={12} className="shrink-0 text-[#94A3B8]" />
            <span className="text-xs text-[#475569]">
              {formatDate(event.date)}
              {event.time ? ` · ${event.time}` : ""}
            </span>
          </div>
        )}

        <div className="mb-1 flex items-center gap-1">
          <Navigation size={12} className="shrink-0 text-[#94A3B8]" />
          <span className="text-xs text-[#475569]">
            {cityLabel(event.city).toLowerCase() ===
            cityLabel(userCity).toLowerCase()
              ? distanceLabel
              : event.city}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Clock size={12} className="shrink-0 text-[#94A3B8]" />
          <span className="text-xs text-[#94A3B8]">{availabilityLabel(event)}</span>
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

type SectionProps = {
  title: string;
  events: GlobalEvent[];
  userCity: string;
  loading: boolean;
  onSeeAll: () => void;
  onOpen: (event: GlobalEvent) => void;
  limit?: number;
};

function EventSection({
  title,
  events,
  userCity,
  loading,
  onSeeAll,
  onOpen,
  limit,
}: SectionProps) {
  const safeEvents = Array.isArray(events) ? events : [];
  const visible = limit != null ? safeEvents.slice(0, limit) : safeEvents;
  const skeletonCount = limit ?? 4;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1E293B]">{title}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-sm font-medium text-teal-600 hover:underline"
        >
          See all
        </button>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#94A3B8]">
          No experiences found for this section.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((event, index) => (
            <ExploreCard
              key={`${event.id}-${index}`}
              event={event}
              userCity={userCity}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function ExploreHubPage() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [currentCity, setCurrentCity] = useState("Chicago, IL");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryPill>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [trendingEvents, setTrendingEvents] = useState<GlobalEvent[]>([]);
  const [weekendEvents, setWeekendEvents] = useState<GlobalEvent[]>([]);
  const [popularEvents, setPopularEvents] = useState<GlobalEvent[]>([]);
  const [nationalEvents, setNationalEvents] = useState<GlobalEvent[]>([]);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(EXPLORE_RADIUS_MILES);

  const stateName = STATE_BY_CITY[cityLabel(currentCity)] || "Your Region";

  const splitEvents = useCallback((data: EventsAPIResponse | null) => {
    if (!data) {
      setTrendingEvents([]);
      setWeekendEvents([]);
      setPopularEvents([]);
      setNationalEvents([]);
      return;
    }
    setTrendingEvents(data.trending || data.events.slice(0, 40) || []);
    setWeekendEvents(data.weekend || data.events.slice(40, 60) || []);
    setPopularEvents(data.popular || data.events.slice(60, 80) || []);
    setNationalEvents(data.national || data.events.slice(80, 100) || []);
  }, []);

  const fetchEvents = useCallback(async (city: string, coords?: UserCoords | null) => {
    setLoading(true);
    const cityName = city.split(",")[0].trim();
    try {
      let url = `/explore/events?city=${encodeURIComponent(cityName)}&per_page=100`;
      if (coords) {
        url += `&lat=${coords.lat}&lon=${coords.lon}&radius=${EXPLORE_RADIUS_MILES}`;
      }
      const data = await apiFetch<EventsAPIResponse>(
        url,
        {},
        EVENTS_FETCH_TIMEOUT_MS,
      );
      if (data.radius_miles) {
        setRadiusMiles(data.radius_miles);
      }
      splitEvents(data);
    } catch (err) {
      console.error("Failed to load explore events:", err);
      splitEvents(null);
    } finally {
      setLoading(false);
    }
  }, [splitEvents]);

  const detectGPSCity = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const fallback = loadExploreCity() || "Chicago, IL";
      const coords = loadExploreCoords();
      setCurrentCity(fallback);
      setUserCoords(coords);
      void fetchEvents(cityLabel(fallback), coords);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords: UserCoords = { lat: latitude, lon: longitude };
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { Accept: "application/json" } },
          );
          const data = await r.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.hamlet ||
            "Chicago";
          const state = data.address?.state_code || data.address?.state || "";
          const label = state ? `${city}, ${state}` : city;
          setCurrentCity(label);
          setUserCoords(coords);
          saveExploreCity(label, coords);
          await fetchEvents(city, coords);
        } catch {
          const fallback = loadExploreCity() || "Chicago, IL";
          setCurrentCity(fallback);
          setUserCoords(null);
          await fetchEvents(cityLabel(fallback), null);
        }
      },
      () => {
        const fallback = loadExploreCity() || "Chicago, IL";
        const coords = loadExploreCoords();
        setCurrentCity(fallback);
        setUserCoords(coords);
        void fetchEvents(cityLabel(fallback), coords);
      },
    );
  }, [fetchEvents]);

  useEffect(() => {
    const saved = loadExploreCity();
    const savedCoords = loadExploreCoords();
    if (saved) {
      setCurrentCity(saved);
      setUserCoords(savedCoords);
      void fetchEvents(cityLabel(saved), savedCoords);
      return;
    }
    detectGPSCity();
  }, [detectGPSCity, fetchEvents]);

  useEffect(() => {
    if (citySearch.length < 2) {
      setCitySuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCityLoading(true);
      try {
        const data = await apiFetch<CityAutocompleteResponse>(
          `/explore/city-autocomplete?q=${encodeURIComponent(citySearch)}`,
        );
        setCitySuggestions(data.suggestions || []);
      } catch {
        setCitySuggestions([]);
      } finally {
        setCityLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [citySearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowCityDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filterEvents = useCallback(
    (events: GlobalEvent[]) =>
      events.filter(
        (ev) => matchesCategory(ev, activeCategory) && matchesSearch(ev, searchQuery),
      ),
    [activeCategory, searchQuery],
  );

  const filteredTrending = useMemo(
    () => filterEvents(trendingEvents),
    [filterEvents, trendingEvents],
  );
  const filteredWeekend = useMemo(
    () => filterEvents(weekendEvents),
    [filterEvents, weekendEvents],
  );
  const filteredPopular = useMemo(
    () => filterEvents(popularEvents),
    [filterEvents, popularEvents],
  );
  const filteredNational = useMemo(
    () => filterEvents(nationalEvents),
    [filterEvents, nationalEvents],
  );

  const selectCity = (suggestion: CitySuggestion) => {
    setCurrentCity(suggestion.label);
    setUserCoords(null);
    saveExploreCity(suggestion.label, null);
    setShowCityDropdown(false);
    setCitySearch("");
    setCitySuggestions([]);
    fetchEvents(suggestion.city, null);
  };

  const handleOpenEvent = (event: GlobalEvent) => {
    if (event.ticket_url) {
      window.open(event.ticket_url, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(`/events?city=${encodeURIComponent(event.city || currentCity)}`);
  };

  const handleSeeAll = (section: "trending" | "weekend" | "state" | "national") => {
    const city =
      section === "national" ? "New York" : cityLabel(currentCity);
    router.push(
      `/events?city=${encodeURIComponent(city)}${
        activeCategory !== "All" ? `&category=${encodeURIComponent(activeCategory.toLowerCase())}` : ""
      }`,
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1E293B]">
            Discover experiences near you
          </h1>
          <p className="mt-1 text-[#475569]">
            {userCoords
              ? `Ticketmaster events within ${radiusMiles} miles of ${currentCity}`
              : `Events, activities and places — curated for ${cityLabel(currentCity)}`}
          </p>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {CATEGORY_PILLS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-[#E2E8F0] bg-white text-[#475569] hover:border-teal-500"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, activities, places..."
              className="w-full rounded-xl border border-[#E2E8F0] bg-white py-3 pl-10 pr-4 text-[#1E293B] placeholder-[#94A3B8] focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowCityDropdown((v) => !v)}
              className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[#475569] transition-colors hover:border-teal-500 sm:w-auto"
            >
              <MapPin size={16} className="text-teal-600" />
              <span className="font-medium text-[#1E293B]">{currentCity}</span>
              <ChevronDown size={14} className="text-[#94A3B8]" />
            </button>

            {showCityDropdown && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-lg">
                <div className="relative mb-2">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                  />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search city..."
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="w-full rounded-lg border border-[#E2E8F0] py-2 pl-9 pr-4 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:border-teal-500 focus:outline-none"
                  />
                </div>

                {cityLoading && (
                  <p className="py-3 text-center text-sm text-[#94A3B8]">Searching...</p>
                )}

                {citySuggestions.map((s) => (
                  <button
                    key={s.place_id || s.label}
                    type="button"
                    onClick={() => selectCity(s)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#475569] hover:bg-slate-50"
                  >
                    <MapPin size={12} className="shrink-0 text-[#94A3B8]" />
                    {s.label}
                  </button>
                ))}

                {!cityLoading && citySearch.length >= 2 && citySuggestions.length === 0 && (
                  <p className="py-3 text-center text-sm text-[#94A3B8]">No cities found</p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowCityDropdown(false);
                    detectGPSCity();
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-[#E2E8F0] px-3 py-2 text-sm font-medium text-teal-600 hover:bg-slate-50"
                >
                  <Navigation size={12} />
                  Use my current location
                </button>
              </div>
            )}
          </div>
        </div>

        <EventSection
          title={`Trending in ${currentCity}`}
          events={filteredTrending}
          userCity={currentCity}
          loading={loading}
          onSeeAll={() => handleSeeAll("trending")}
          onOpen={handleOpenEvent}
        />

        <EventSection
          title="Happening This Weekend"
          events={filteredWeekend}
          userCity={currentCity}
          loading={loading}
          onSeeAll={() => handleSeeAll("weekend")}
          onOpen={handleOpenEvent}
        />

        <EventSection
          title={`Popular in ${stateName}`}
          events={filteredPopular}
          userCity={currentCity}
          loading={loading}
          onSeeAll={() => handleSeeAll("state")}
          onOpen={handleOpenEvent}
        />

        <EventSection
          title="National Picks"
          events={filteredNational}
          userCity={currentCity}
          loading={loading}
          onSeeAll={() => handleSeeAll("national")}
          onOpen={handleOpenEvent}
        />
      </div>
    </div>
  );
}
