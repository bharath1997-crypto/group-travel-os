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
};

type CitySuggestion = {
  label: string;
  city: string;
  place_id: string;
};

type CityAutocompleteResponse = {
  suggestions: CitySuggestion[];
};

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

function isThisWeekend(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return false;
  const eventDate = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10),
  );
  const now = new Date();
  const day = now.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSaturday);
  saturday.setHours(0, 0, 0, 0);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  sunday.setHours(23, 59, 59, 999);
  return eventDate >= saturday && eventDate <= sunday;
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
  limit = 4,
}: SectionProps) {
  const visible = events.slice(0, limit);

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
          {Array.from({ length: limit }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#94A3B8]">
          No experiences found for this section.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((event) => (
            <ExploreCard
              key={`${title}-${event.id}`}
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
  const [cityEvents, setCityEvents] = useState<GlobalEvent[]>([]);
  const [nationalEvents, setNationalEvents] = useState<GlobalEvent[]>([]);

  const stateName = STATE_BY_CITY[cityLabel(currentCity)] || "Your Region";

  const fetchEvents = useCallback(async (city: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<EventsAPIResponse>(
        `/explore/events?city=${encodeURIComponent(cityLabel(city))}&per_page=20`,
      );
      setCityEvents(data?.events || []);
    } catch (err) {
      console.error("Failed to load explore events:", err);
      setCityEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNationalEvents = useCallback(async () => {
    try {
      const data = await apiFetch<EventsAPIResponse>(
        "/explore/events?city=New%20York&per_page=12",
      );
      setNationalEvents(data?.events || []);
    } catch (err) {
      console.error("Failed to load national events:", err);
      setNationalEvents([]);
    }
  }, []);

  const detectGPSCity = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCurrentCity("Chicago, IL");
      fetchEvents("Chicago");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { Accept: "application/json" } },
          );
          const data = await r.json();
          const city =
            data.address?.city || data.address?.town || data.address?.village || "Chicago";
          const state = data.address?.state_code || data.address?.state || "";
          const label = state ? `${city}, ${state}` : city;
          setCurrentCity(label);
          fetchEvents(city);
        } catch {
          setCurrentCity("Chicago, IL");
          fetchEvents("Chicago");
        }
      },
      () => {
        setCurrentCity("Chicago, IL");
        fetchEvents("Chicago");
      },
    );
  }, [fetchEvents]);

  useEffect(() => {
    fetchNationalEvents();
  }, [fetchNationalEvents]);

  useEffect(() => {
    detectGPSCity();
  }, [detectGPSCity]);

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

  const filteredCityEvents = useMemo(
    () =>
      cityEvents.filter(
        (ev) => matchesCategory(ev, activeCategory) && matchesSearch(ev, searchQuery),
      ),
    [cityEvents, activeCategory, searchQuery],
  );

  const trendingEvents = filteredCityEvents;
  const weekendEvents = useMemo(
    () => filteredCityEvents.filter((ev) => isThisWeekend(ev.date)),
    [filteredCityEvents],
  );
  const stateEvents = useMemo(() => filteredCityEvents.slice(4, 12), [filteredCityEvents]);
  const filteredNational = useMemo(
    () =>
      nationalEvents.filter(
        (ev) => matchesCategory(ev, activeCategory) && matchesSearch(ev, searchQuery),
      ),
    [nationalEvents, activeCategory, searchQuery],
  );

  const selectCity = (suggestion: CitySuggestion) => {
    setCurrentCity(suggestion.label);
    setShowCityDropdown(false);
    setCitySearch("");
    setCitySuggestions([]);
    fetchEvents(suggestion.city);
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
            Events, activities and places — curated for your group
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
          events={trendingEvents}
          userCity={currentCity}
          loading={loading}
          onSeeAll={() => handleSeeAll("trending")}
          onOpen={handleOpenEvent}
          limit={8}
        />

        <EventSection
          title="Happening This Weekend"
          events={weekendEvents.length > 0 ? weekendEvents : trendingEvents}
          userCity={currentCity}
          loading={loading}
          onSeeAll={() => handleSeeAll("weekend")}
          onOpen={handleOpenEvent}
          limit={4}
        />

        <EventSection
          title={`Popular in ${stateName}`}
          events={stateEvents.length > 0 ? stateEvents : trendingEvents}
          userCity={currentCity}
          loading={loading}
          onSeeAll={() => handleSeeAll("state")}
          onOpen={handleOpenEvent}
          limit={4}
        />

        <EventSection
          title="National Picks"
          events={filteredNational}
          userCity={currentCity}
          loading={loading && filteredNational.length === 0}
          onSeeAll={() => handleSeeAll("national")}
          onOpen={handleOpenEvent}
          limit={4}
        />
      </div>
    </div>
  );
}
