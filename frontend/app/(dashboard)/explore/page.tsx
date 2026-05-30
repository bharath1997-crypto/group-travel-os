"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  MapPin,
  Navigation,
  Search,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  type ExploreEvent,
  type ExploreFeedDebug,
  SECTION_CARD_LIMIT,
  cityLabel,
  hydrateSectionsFromResponse,
  loadExploreFeedCache,
  saveExploreFeedCache,
  saveEventSnapshot,
  formatDateTime,
  formatLocation,
  formatPrice,
  pseudoRating,
  matchesExploreCategoryPill,
  type ExploreCategoryPill,
} from "@/lib/explore-events";

type EventsAPIResponse = {
  city: string;
  display_city?: string;
  nearest_metro?: string | null;
  fetch_mode?: string | null;
  section_titles?: {
    trending?: string;
    trending_subtitle?: string;
    weekend?: string;
    popular?: string;
    national?: string;
  };
  total: number;
  page: number;
  per_page: number;
  events: ExploreEvent[];
  trending?: ExploreEvent[];
  weekend?: ExploreEvent[];
  popular?: ExploreEvent[];
  national?: ExploreEvent[];
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

const EVENTS_FETCH_TIMEOUT_MS = 60_000;
const GEOLOCATION_TIMEOUT_MS = 8_000;
const LS_EXPLORE_CITY = "rovvy_explore_city";
const LS_EXPLORE_COORDS = "rovvy_explore_coords";
const EXPLORE_RADIUS_MILES = 200;
const EXPLORE_INITIAL_PER_PAGE = 20;
const EXPLORE_FULL_PER_PAGE = 100;
const DEFAULT_EXPLORE_CITY = "Chicago";

/** Block overlapping /explore/events requests (geo vs city race). */
let exploreEventsInFlight = false;
let exploreEventsInFlightMode: "geo" | "city" | null = null;

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
    /* ignore */
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

function readStoredCoords(): UserCoords | null {
  return loadExploreCoords();
}

function exploreCityKey(coords: UserCoords | null, city?: string | null): string | null {
  if (coords) {
    return `geo:${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`;
  }
  const cityName = (city || loadExploreCity() || "").split(",")[0].trim().toLowerCase();
  return cityName ? `city:${cityName}` : null;
}

function hydrateExploreFromCache(
  cityKey: string | null,
): CachedExploreSections | null {
  if (!cityKey) return null;
  const cached = loadExploreFeedCache(cityKey);
  if (!cached) return null;
  return cached.sections;
}

type CachedExploreSections = {
  trending: ExploreEvent[];
  weekend: ExploreEvent[];
  popular: ExploreEvent[];
  national: ExploreEvent[];
};

function buildExploreEventsUrl(
  cityName: string,
  coords: UserCoords | null,
  perPage: number = EXPLORE_INITIAL_PER_PAGE,
): string {
  const params = new URLSearchParams({ per_page: String(perPage) });
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lon", String(coords.lon));
    params.set("radius", String(EXPLORE_RADIUS_MILES));
  } else if (cityName.trim()) {
    params.set("city", cityName.trim());
  }
  return `/explore/events?${params.toString()}`;
}

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "RovvyExplore/1.0 (group-travel-os)",
};

/** Parse pasted or typed coordinate pairs: "lat,lon" or "lat lon". */
function parseCoordinateInput(input: string): UserCoords | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** Cursor's embedded browser often never resolves geolocation; always time out. */
function requestGeolocationCoords(): Promise<UserCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (coords: UserCoords | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(coords);
    };
    const timer = setTimeout(() => finish(null), GEOLOCATION_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        finish({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => finish(null),
      {
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 5 * 60_000,
        enableHighAccuracy: false,
      },
    );
  });
}

async function nominatimCityLatLon(
  city: string,
): Promise<UserCoords | null> {
  const q = city.trim();
  if (!q) return null;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`,
      { headers: NOMINATIM_HEADERS },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit?.lat || !hit?.lon) return null;
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

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

function matchesSearch(event: ExploreEvent, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return [event.name, event.venue, event.city, event.category]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

type ExploreCardProps = {
  event: ExploreEvent;
  userCity: string;
  onOpen: (event: ExploreEvent) => void;
};

function ExploreCard({ event, userCity, onOpen }: ExploreCardProps) {
  const { score, reviews } = pseudoRating(event);
  const fullStars = Math.floor(score);
  const location = formatLocation(event, userCity);
  const price = formatPrice(event);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(event);
      }}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100">
            <Calendar size={32} className="text-slate-300" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-teal-700 shadow-sm backdrop-blur">
          {event.category}
        </span>
        <span className="absolute right-3 top-3 rounded-lg bg-[#1E293B]/85 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {price}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-2 line-clamp-2 text-[15px] font-semibold leading-snug text-[#1E293B] group-hover:text-teal-700">
          {event.name}
        </h3>

        <div className="mb-3 flex items-center gap-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={12}
                className={
                  i <= fullStars
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-200"
                }
              />
            ))}
          </div>
          <span className="ml-1 text-xs text-[#64748B]">
            {score.toFixed(1)} ({reviews})
          </span>
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-start gap-1.5">
            <MapPin size={13} className="mt-0.5 shrink-0 text-[#94A3B8]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[#475569]">
                {location.primary}
              </p>
              <p className="truncate text-[11px] text-[#94A3B8]">
                {location.secondary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="shrink-0 text-[#94A3B8]" />
            <span className="truncate text-xs text-[#64748B]">
              {formatDateTime(event)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="aspect-[4/3] animate-pulse bg-slate-200" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section className="mb-12">
      <div className="mb-5">
        <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
        <span className="sr-only">{title}</span>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: SECTION_CARD_LIMIT }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

type SectionProps = {
  title: string;
  subtitle?: string;
  events: ExploreEvent[];
  rawCount: number;
  userCity: string;
  loading: boolean;
  fetchError: string | null;
  filtersActive: boolean;
  onSeeAll: () => void;
  onOpen: (event: ExploreEvent) => void;
  onClearFilters?: () => void;
  activeCategory?: ExploreCategoryPill;
};

function EventSection({
  title,
  subtitle,
  events,
  rawCount,
  userCity,
  loading,
  fetchError,
  filtersActive,
  onSeeAll,
  onOpen,
  onClearFilters,
  activeCategory,
}: SectionProps) {
  const visible = events.slice(0, SECTION_CARD_LIMIT);
  const hasMore = events.length > SECTION_CARD_LIMIT;

  let emptyMessage = "No events available right now.";
  if (activeCategory === "Activities") {
    emptyMessage = "No activities found in this section";
  } else if (fetchError) {
    emptyMessage = "Could not refresh events. Showing cached results if available.";
  } else if (filtersActive && rawCount > 0) {
    emptyMessage = "No experiences match your current filters.";
  } else if (rawCount === 0) {
    emptyMessage = "No live events found for this area yet.";
  }

  return (
    <section className="mb-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B]">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-[#64748B]">{subtitle}</p>
          )}
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-teal-600 transition hover:text-teal-700"
          >
            See all
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {loading && visible.length === 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: SECTION_CARD_LIMIT }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-white p-10 text-center">
          <p className="text-sm text-[#64748B]">{emptyMessage}</p>
          {filtersActive && rawCount > 0 && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((event, index) => (
            <Link
              key={`${event.id || event.name}-${index}`}
              href={`/explore/event/${encodeURIComponent(event.id)}`}
              onClick={() => saveEventSnapshot(event)}
              className="block h-full"
            >
              <ExploreCard
                event={event}
                userCity={userCity}
                onOpen={onOpen}
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ExploreHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryParam = searchParams.get("category");
  const initialCategory = useMemo(() => {
    if (categoryParam) {
      const normalized = categoryParam.trim();
      const validPills: ExploreCategoryPill[] = ["All", "Events", "Activities", "Sports", "Food", "Nightlife", "Parks"];
      const found = validPills.find(p => p.toLowerCase() === normalized.toLowerCase());
      if (found) return found;
    }
    return "All";
  }, [categoryParam]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchGenerationRef = useRef(0);
  const mountedRef = useRef(false);
  const userCoordsRef = useRef<UserCoords | null>(null);
  const hasLoadedFullRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  /** When coords exist, only geo responses may update section state. */
  const eventsDataSourceRef = useRef<"geo" | "city" | null>(null);

  const setCoords = useCallback((coords: UserCoords | null) => {
    userCoordsRef.current = coords;
    setUserCoords(coords);
    if (coords) {
      eventsDataSourceRef.current = "geo";
    }
  }, []);

  const [currentCity, setCurrentCity] = useState("Locating…");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [activeCategory, setActiveCategory] =
    useState<ExploreCategoryPill>(initialCategory);

  useEffect(() => {
    if (categoryParam) {
      const normalized = categoryParam.trim();
      const validPills: ExploreCategoryPill[] = ["All", "Events", "Activities", "Sports", "Food", "Nightlife", "Parks"];
      const found = validPills.find(p => p.toLowerCase() === normalized.toLowerCase());
      if (found) {
        setActiveCategory(found);
      }
    }
  }, [categoryParam]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [feedDebug, setFeedDebug] = useState<ExploreFeedDebug | null>(null);
  const [trendingEvents, setTrendingEvents] = useState<ExploreEvent[]>([]);
  const [weekendEvents, setWeekendEvents] = useState<ExploreEvent[]>([]);
  const [popularEvents, setPopularEvents] = useState<ExploreEvent[]>([]);
  const [nationalEvents, setNationalEvents] = useState<ExploreEvent[]>([]);
  const [sectionTitles, setSectionTitles] = useState({
    trending: "",
    trendingSubtitle: "",
    weekend: "Happening This Weekend",
    popular: "",
    national: "National Picks",
  });
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(EXPLORE_RADIUS_MILES);

  const stateName = STATE_BY_CITY[cityLabel(currentCity)] || "Your Region";
  const filtersActive =
    activeCategory !== "All" || searchQuery.trim().length > 0;

  const shouldUseEventsResponse = useCallback((mode: "geo" | "city"): boolean => {
    if (userCoordsRef.current || readStoredCoords()) {
      return mode === "geo";
    }
    return true;
  }, []);

  const applySections = useCallback(
    (
      data: EventsAPIResponse,
      source: ExploreFeedDebug["source"],
      cityKey: string,
      mode: "geo" | "city",
    ) => {
      if (mode === "city" && (userCoordsRef.current || readStoredCoords())) {
        if (process.env.NODE_ENV === "development") {
          console.info("[explore] ignored section update from city response — coords active");
        }
        return;
      }

      const { sections, debug } = hydrateSectionsFromResponse(data);
      eventsDataSourceRef.current = mode;

      setTrendingEvents(sections.trending);
      setWeekendEvents(sections.weekend);
      setPopularEvents(sections.popular);
      setNationalEvents(sections.national);

      if (data.section_titles) {
        const loc = cityLabel(data.display_city || data.city);
        setSectionTitles({
          trending: data.section_titles.trending || `Near ${loc}`,
          trendingSubtitle: data.section_titles.trending_subtitle || "",
          weekend: data.section_titles.weekend || "Happening This Weekend",
          popular: data.section_titles.popular || `Popular in ${stateName}`,
          national: data.section_titles.national || "National Picks",
        });
      }

      if (data.display_city?.trim()) {
        const next = data.display_city.trim();
        setCurrentCity(next);
        const coords =
          mode === "geo"
            ? userCoordsRef.current ?? readStoredCoords()
            : null;
        saveExploreCity(next, coords);
      }

      const fullDebug: ExploreFeedDebug = {
        ...debug,
        source,
        fetchedAt: new Date().toISOString(),
      };
      setFeedDebug(fullDebug);
      saveExploreFeedCache(cityKey, sections, fullDebug);

      console.log("[explore] fetchEvents resolved", {
        mode,
        cityKey,
        source,
        total: data.total ?? debug.poolSize,
        trending: sections.trending.length,
        weekend: sections.weekend.length,
        popular: sections.popular.length,
        national: sections.national.length,
        pool: debug.poolSize,
      });
    },
    [stateName],
  );

  const eventsFetchUrlRef = useRef<string | null>(null);

  const runEventsRequest = useCallback(
    async (
      url: string,
      cityKey: string,
      mode: "geo" | "city",
      options?: { force?: boolean; perPage?: number },
    ) => {
      const force = options?.force === true;
      const perPage = options?.perPage ?? EXPLORE_INITIAL_PER_PAGE;

      if (exploreEventsInFlight && !force) {
        if (exploreEventsInFlightMode === "geo" && mode === "city") return;
        if (eventsFetchUrlRef.current === url) return;
      }

      if (mode === "city" && (userCoordsRef.current || readStoredCoords())) {
        if (process.env.NODE_ENV === "development") {
          console.info("[explore] blocked city fetch — coords available");
        }
        return;
      }

      exploreEventsInFlight = true;
      exploreEventsInFlightMode = mode;
      eventsFetchUrlRef.current = url;
      const generation = ++fetchGenerationRef.current;

      if (perPage >= EXPLORE_FULL_PER_PAGE) {
        hasLoadedFullRef.current = true;
      } else {
        hasLoadedFullRef.current = false;
      }

      const mayUseResponse =
        mode === "geo" || shouldUseEventsResponse(mode);

      const cached = loadExploreFeedCache(cityKey);
      if (cached && mayUseResponse) {
        eventsDataSourceRef.current = mode;
        setTrendingEvents(cached.sections.trending);
        setWeekendEvents(cached.sections.weekend);
        setPopularEvents(cached.sections.popular);
        setNationalEvents(cached.sections.national);
        setFeedDebug({ ...cached.debug, source: "cache" });
        setLoading(false);
        setRefreshing(true);
      } else if (!cached || !mayUseResponse) {
        setLoading(true);
      }

      setFetchError(null);

      try {
        if (process.env.NODE_ENV === "development") {
          console.info("[explore] GET", url);
        }
        const data = await apiFetch<EventsAPIResponse>(
          url,
          {},
          EVENTS_FETCH_TIMEOUT_MS,
        );

        if (generation !== fetchGenerationRef.current) return;

        if (data.radius_miles) {
          setRadiusMiles(data.radius_miles);
        }
        applySections(data, "live", cityKey, mode);
      } catch (err) {
        if (generation !== fetchGenerationRef.current) return;
        const message =
          err instanceof Error ? err.message : "Failed to load events";
        console.error("Failed to load explore events:", message);
        setFetchError(message);

        if (!cached) {
          const fallback = loadExploreFeedCache(cityKey);
          if (!fallback) {
            setTrendingEvents([]);
            setWeekendEvents([]);
            setPopularEvents([]);
            setNationalEvents([]);
          }
        }
      } finally {
        if (eventsFetchUrlRef.current === url) {
          eventsFetchUrlRef.current = null;
        }
        exploreEventsInFlight = false;
        exploreEventsInFlightMode = null;
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applySections, shouldUseEventsResponse],
  );

  const fetchEventsByCoords = useCallback(
    async (
      coords: UserCoords,
      options?: { force?: boolean; perPage?: number },
    ) => {
      const perPage = options?.perPage ?? EXPLORE_INITIAL_PER_PAGE;
      const cityKey = `geo:${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`;
      const url = buildExploreEventsUrl("", coords, perPage);
      await runEventsRequest(url, cityKey, "geo", { ...options, perPage });
    },
    [runEventsRequest],
  );

  const fetchEventsByCity = useCallback(
    async (city: string, options?: { perPage?: number }) => {
      const perPage = options?.perPage ?? EXPLORE_INITIAL_PER_PAGE;
      if (userCoordsRef.current || readStoredCoords()) {
        if (process.env.NODE_ENV === "development") {
          console.info("[explore] blocked city fetch — coords available");
        }
        return;
      }
      const cityName = city.split(",")[0].trim();
      if (!cityName) return;
      const cityKey = `city:${cityName.toLowerCase()}`;
      const url = buildExploreEventsUrl(cityName, null, perPage);
      await runEventsRequest(url, cityKey, "city", { perPage });
    },
    [runEventsRequest],
  );

  const loadRemainingEvents = useCallback(async () => {
    if (hasLoadedFullRef.current || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      const coords = userCoordsRef.current ?? readStoredCoords();
      if (coords) {
        await fetchEventsByCoords(coords, {
          force: true,
          perPage: EXPLORE_FULL_PER_PAGE,
        });
        return;
      }

      const savedCity = loadExploreCity();
      if (savedCity) {
        await fetchEventsByCity(savedCity, { perPage: EXPLORE_FULL_PER_PAGE });
      }
    } finally {
      setLoadingMore(false);
    }
  }, [fetchEventsByCity, fetchEventsByCoords, loading, loadingMore]);

  const applyLocationByCoords = useCallback(
    async (coords: UserCoords, placeholderLabel?: string) => {
      setCoords(coords);
      const label = placeholderLabel?.trim() || loadExploreCity() || "Your area";
      setCurrentCity(label);
      saveExploreCity(label, coords);
      setShowCityDropdown(false);
      setCitySearch("");
      setCitySuggestions([]);
      await fetchEventsByCoords(coords, { force: true });
    },
    [fetchEventsByCoords, setCoords],
  );

  const submitCitySearch = useCallback(async () => {
    const q = citySearch.trim();
    if (!q) return;

    const pastedCoords = parseCoordinateInput(q);
    if (pastedCoords) {
      await applyLocationByCoords(pastedCoords, q);
      return;
    }

    setCityLoading(true);
    try {
      const geo = await nominatimCityLatLon(q);
      if (geo) {
        await applyLocationByCoords(geo, q);
      }
    } finally {
      setCityLoading(false);
    }
  }, [applyLocationByCoords, citySearch]);

  const fetchByCityOrGeocode = useCallback(
    async (cityLabel: string) => {
      const geo = await nominatimCityLatLon(cityLabel);
      if (geo) {
        setCoords(geo);
        saveExploreCity(cityLabel, geo);
        await fetchEventsByCoords(geo, { force: true });
        return;
      }
      setCoords(null);
      userCoordsRef.current = null;
      eventsDataSourceRef.current = "city";
      setCurrentCity(cityLabel);
      await fetchEventsByCity(cityLabel);
    },
    [fetchEventsByCity, fetchEventsByCoords, setCoords],
  );

  const detectGPSCity = useCallback(async () => {
    const savedCity = loadExploreCity();
    const storedCoords = readStoredCoords();
    if (storedCoords) {
      setCoords(storedCoords);
      if (savedCity) setCurrentCity(savedCity);
      await fetchEventsByCoords(storedCoords, { force: true });
      return;
    }

    const gpsCoords = await requestGeolocationCoords();
    if (gpsCoords) {
      setCoords(gpsCoords);
      saveExploreCity(savedCity || "Your area", gpsCoords);
      await fetchEventsByCoords(gpsCoords, { force: true });
      return;
    }

    if (savedCity) {
      await fetchByCityOrGeocode(savedCity);
      return;
    }

    await fetchByCityOrGeocode(DEFAULT_EXPLORE_CITY);
  }, [fetchByCityOrGeocode, fetchEventsByCoords, setCoords]);

  const bootstrapExplore = useCallback(async () => {
    const savedCoords = readStoredCoords();
    const saved = loadExploreCity();

    if (savedCoords) {
      setCoords(savedCoords);
      if (saved) setCurrentCity(saved);
      await fetchEventsByCoords(savedCoords, { force: true });
      return;
    }

    if (saved) {
      setCurrentCity(saved);
      const geo = await nominatimCityLatLon(saved);
      if (geo) {
        setCoords(geo);
        saveExploreCity(saved, geo);
        await fetchEventsByCoords(geo, { force: true });
        return;
      }
    }

    await detectGPSCity();
  }, [detectGPSCity, fetchEventsByCoords, setCoords]);

  useEffect(() => {
    exploreEventsInFlight = false;
    exploreEventsInFlightMode = null;
    return () => {
      exploreEventsInFlight = false;
      exploreEventsInFlightMode = null;
    };
  }, []);

  useLayoutEffect(() => {
    const coords = readStoredCoords();
    const cityKey = exploreCityKey(coords, loadExploreCity());
    const sections = hydrateExploreFromCache(cityKey);
    if (!sections) return;

    eventsDataSourceRef.current = coords ? "geo" : "city";
    setTrendingEvents(sections.trending);
    setWeekendEvents(sections.weekend);
    setPopularEvents(sections.popular);
    setNationalEvents(sections.national);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    void bootstrapExplore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !hasLoadedFullRef.current &&
          !loading &&
          !loadingMore
        ) {
          void loadRemainingEvents();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadRemainingEvents, loading, loadingMore]);

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

  const handleCategoryPillClick = useCallback(
    (pill: ExploreCategoryPill) => {
      setActiveCategory(pill);
      const params = new URLSearchParams(searchParams.toString());
      if (pill === "All") {
        params.delete("category");
      } else {
        params.set("category", pill);
      }
      const qs = params.toString();
      router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
    },
    [router, searchParams],
  );

  // TODO: unhide when data source connected
  const visibleCategoryPills: ExploreCategoryPill[] = [
    "All",
    "Events",
    "Activities",
    "Sports",
  ];

  const filterEvents = useCallback(
    (events: ExploreEvent[]) =>
      events.filter((ev) => {
        const matchesCat =
          activeCategory === "Activities"
            ? ["experience", "entertainment", "cultural", "arts", "comedy"].includes(
                (ev.category || "").trim().toLowerCase()
              )
            : matchesExploreCategoryPill(ev, activeCategory);
        return matchesCat && matchesSearch(ev, searchQuery);
      }),
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
    setCityLoading(true);
    void nominatimCityLatLon(suggestion.label)
      .then((geo) => {
        if (geo) {
          return applyLocationByCoords(geo, suggestion.label);
        }
      })
      .finally(() => setCityLoading(false));
  };

  const clearFilters = () => {
    setActiveCategory("All");
    setSearchQuery("");
  };

  const handleOpenEvent = (event: ExploreEvent) => {
    saveEventSnapshot(event);
    router.push(
      `/explore/event/${encodeURIComponent(event.id)}?city=${encodeURIComponent(cityLabel(currentCity))}`,
    );
  };

  const handleSeeAll = (
    section: "trending" | "weekend" | "state" | "national",
  ) => {
    const city =
      section === "national" ? "New York" : cityLabel(currentCity);
    const params = new URLSearchParams();
    params.set("city", city);
    params.set("page", "1");
    params.set("per_page", "20");
    if (activeCategory !== "All") {
      params.set("category", activeCategory);
    }
    if (userCoords && section !== "national") {
      params.set("lat", userCoords.lat.toString());
      params.set("lon", userCoords.lon.toString());
      params.set("radius", radiusMiles.toString());
    }
    router.push(`/events?${params.toString()}`);
  };

  const hasLiveContent =
    trendingEvents.length +
      weekendEvents.length +
      popularEvents.length +
      nationalEvents.length >
    0;

  const showInitialSkeleton = loading && !hasLiveContent;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B] md:text-3xl">
            Discover experiences near you
          </h1>
          <p className="mt-2 max-w-2xl text-[#64748B]">
            {hasLiveContent
              ? userCoords
                ? `Curated picks within ${radiusMiles} miles of ${currentCity} — plan, compare, and book with confidence.`
                : `Hand-picked events and activities in ${cityLabel(currentCity)}.`
              : showInitialSkeleton
                ? "Loading events near you…"
                : `Finding events near ${cityLabel(currentCity)}.`}
          </p>
          {fetchError && (
            <p className="mt-2 text-sm text-amber-700">
              Live refresh issue: {fetchError}
              {refreshing ? " Retrying…" : ""}
            </p>
          )}
        </div>

        <div
          className="mb-5 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filter by category"
        >
          {visibleCategoryPills.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              onClick={(e) => {
                e.preventDefault();
                handleCategoryPillClick(cat);
              }}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                  : "border-[#E2E8F0] bg-white text-[#475569] hover:border-teal-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mb-10 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, venues, categories..."
              className="w-full rounded-xl border border-[#E2E8F0] bg-white py-3 pl-10 pr-4 text-[#1E293B] shadow-sm placeholder-[#94A3B8] focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowCityDropdown((v) => !v)}
              className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[#475569] shadow-sm transition-colors hover:border-teal-400 sm:w-auto"
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
                    placeholder="City name or lat, lon..."
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void submitCitySearch();
                      }
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      const coords = parseCoordinateInput(pasted);
                      if (coords) {
                        e.preventDefault();
                        setCitySearch(pasted.trim());
                        void applyLocationByCoords(coords, pasted.trim());
                      }
                    }}
                    className="w-full rounded-lg border border-[#E2E8F0] py-2 pl-9 pr-4 text-sm text-[#1E293B] placeholder-[#94A3B8] focus:border-teal-500 focus:outline-none"
                  />
                </div>

                {cityLoading && (
                  <p className="py-3 text-center text-sm text-[#94A3B8]">
                    Searching...
                  </p>
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

                {!cityLoading &&
                  citySearch.length >= 2 &&
                  citySuggestions.length === 0 && (
                    <p className="py-3 text-center text-sm text-[#94A3B8]">
                      No cities found
                    </p>
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

        {showInitialSkeleton ? (
          <>
            <SectionSkeleton title="Near You" />
            <SectionSkeleton title="This Weekend" />
            <SectionSkeleton title="Popular Nearby" />
            <SectionSkeleton title="National Picks" />
          </>
        ) : (
          <>
        <EventSection
          title={sectionTitles.trending || (userCoords ? "Near You" : `Near ${cityLabel(currentCity)}`)}
          subtitle={
            sectionTitles.trendingSubtitle ||
            (userCoords ? `Events within ${radiusMiles} miles of ${cityLabel(currentCity)}` : "Local favorites near you")
          }
          events={filteredTrending}
          rawCount={trendingEvents.length}
          userCity={currentCity}
          loading={loading}
          fetchError={fetchError}
          filtersActive={filtersActive}
          onSeeAll={() => handleSeeAll("trending")}
          onOpen={handleOpenEvent}
          onClearFilters={clearFilters}
          activeCategory={activeCategory}
        />

        <EventSection
          title={sectionTitles.weekend || "Happening This Weekend"}
          subtitle="Don't miss what's coming up"
          events={filteredWeekend}
          rawCount={weekendEvents.length}
          userCity={currentCity}
          loading={loading}
          fetchError={fetchError}
          filtersActive={filtersActive}
          onSeeAll={() => handleSeeAll("weekend")}
          onOpen={handleOpenEvent}
          onClearFilters={clearFilters}
          activeCategory={activeCategory}
        />

        <EventSection
          title={sectionTitles.popular || `Popular in ${stateName}`}
          subtitle={`Top picks across ${stateName}`}
          events={filteredPopular}
          rawCount={popularEvents.length}
          userCity={currentCity}
          loading={loading}
          fetchError={fetchError}
          filtersActive={filtersActive}
          onSeeAll={() => handleSeeAll("state")}
          onOpen={handleOpenEvent}
          onClearFilters={clearFilters}
          activeCategory={activeCategory}
        />

        <EventSection
          title={sectionTitles.national || "National Picks"}
          subtitle="Standout events across the country"
          events={filteredNational}
          rawCount={nationalEvents.length}
          userCity={currentCity}
          loading={loading}
          fetchError={fetchError}
          filtersActive={filtersActive}
          onSeeAll={() => handleSeeAll("national")}
          onOpen={handleOpenEvent}
          onClearFilters={clearFilters}
          activeCategory={activeCategory}
        />

        <div ref={loadMoreRef} className="h-1" aria-hidden />
        {loadingMore && (
          <div className="pb-8 pt-2 text-center">
            <p className="text-sm text-[#64748B]">Loading more events…</p>
            <div className="mx-auto mt-4 grid max-w-[1440px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
