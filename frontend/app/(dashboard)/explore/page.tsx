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
  Flame,
  Camera,
  Compass,
  Gamepad2,
  FerrisWheel,
  Utensils,
  Trees,
  GlassWater,
  Activity,
  ShoppingBag,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CategoryScrollRow } from "@/components/explorer/CategoryScrollRow";
import { MinimalCalendar } from "@/components/explorer/MinimalCalendar";
import {
  type ExploreEvent,
  type ExploreFeedDebug,
  type ExploreCategoryPill,
  cityLabel,
  hydrateSectionsFromResponse,
  loadExploreFeedCache,
  saveExploreFeedCache,
  saveExploreHubState,
  loadExploreHubState,
  exploreSectionsTotal,
  saveEventSnapshot,
  formatDateTime,
  formatLocation,
  formatPrice,
  pseudoRating,
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

function resolveFallbackCity(): string {
  return loadExploreCity() || DEFAULT_EXPLORE_CITY;
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

function parseCoordinateInput(input: string): UserCoords | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

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

const colorMap: Record<string, { bg: string; text: string; gradient: string }> = {
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-700 border-teal-200",
    gradient: "from-teal-400 to-emerald-600",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700 border-blue-200",
    gradient: "from-blue-400 to-indigo-600",
  },
  rose: {
    bg: "bg-rose-50",
    text: "text-rose-700 border-rose-200",
    gradient: "from-rose-400 to-pink-600",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700 border-amber-200",
    gradient: "from-amber-400 to-orange-600",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-700 border-purple-200",
    gradient: "from-purple-400 to-fuchsia-600",
  },
  sky: {
    bg: "bg-sky-50",
    text: "text-sky-700 border-sky-200",
    gradient: "from-sky-400 to-blue-600",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-700 border-orange-200",
    gradient: "from-orange-400 to-red-600",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700 border-emerald-200",
    gradient: "from-emerald-400 to-teal-600",
  },
  fuchsia: {
    bg: "bg-fuchsia-50",
    text: "text-fuchsia-700 border-fuchsia-200",
    gradient: "from-fuchsia-400 to-rose-600",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700 border-indigo-200",
    gradient: "from-indigo-400 to-violet-600",
  },
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-700 border-violet-200",
    gradient: "from-violet-400 to-purple-600",
  },
};

function getIcon(iconName: string) {
  switch (iconName) {
    case "ti-flame":
      return <Flame className="h-4 w-4" />;
    case "ti-calendar":
      return <Calendar className="h-4 w-4" />;
    case "ti-camera":
      return <Camera className="h-4 w-4" />;
    case "ti-map":
      return <Compass className="h-4 w-4" />;
    case "ti-game-controller":
      return <Gamepad2 className="h-4 w-4" />;
    case "ti-ticket":
      return <FerrisWheel className="h-4 w-4" />;
    case "ti-soup":
      return <Utensils className="h-4 w-4" />;
    case "ti-trees":
      return <Trees className="h-4 w-4" />;
    case "ti-glass":
      return <GlassWater className="h-4 w-4" />;
    case "ti-activity":
      return <Activity className="h-4 w-4" />;
    case "ti-shopping-cart":
      return <ShoppingBag className="h-4 w-4" />;
    default:
      return <Flame className="h-4 w-4" />;
  }
}

const PLACEHOLDERS: Record<string, Partial<ExploreEvent>[]> = {
  landmarks: [
    { id: "p-lm-1", name: "Millennium Park Cloud Gate", category: "Landmarks", venue: "Millennium Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-lm-2", name: "Chicago Skydeck Ledge", category: "Landmarks", venue: "Willis Tower", city: "Chicago", price_min: 35, price_max: 45 },
    { id: "p-lm-3", name: "Navy Pier Centennial Wheel", category: "Landmarks", venue: "Navy Pier", city: "Chicago", price_min: 18, price_max: 25 },
    { id: "p-lm-4", name: "Art Institute of Chicago", category: "Landmarks", venue: "Art Institute", city: "Chicago", price_min: 25, price_max: 30 },
    { id: "p-lm-5", name: "Wrigley Field Historic Tour", category: "Landmarks", venue: "Wrigley Field", city: "Chicago", price_min: 30, price_max: 40 },
  ],
  trekking: [
    { id: "p-tk-1", name: "Starved Rock Canyons Hike", category: "Trekking", venue: "Starved Rock State Park", city: "Oglesby", price_min: 0, price_max: 0 },
    { id: "p-tk-2", name: "Waterfall Glen Trail Loop", category: "Trekking", venue: "Waterfall Glen Forest Preserve", city: "Darien", price_min: 0, price_max: 0 },
    { id: "p-tk-3", name: "Swallow Cliff Stairclimb", category: "Trekking", venue: "Swallow Cliff Woods", city: "Palos Park", price_min: 0, price_max: 0 },
    { id: "p-tk-4", name: "Des Plaines River Kayak Trail", category: "Trekking", venue: "Des Plaines River", city: "Libertyville", price_min: 15, price_max: 30 },
    { id: "p-tk-5", name: "Palos Forest Mountain Biking", category: "Trekking", venue: "Palos Trail System", city: "Palos Heights", price_min: 0, price_max: 0 },
  ],
  gaming: [
    { id: "p-gm-1", name: "Ignite Gaming Esports League", category: "Gaming", venue: "Ignite Gaming Lounge", city: "Chicago", price_min: 10, price_max: 25 },
    { id: "p-gm-2", name: "Galloping Ghost Retro Arcade", category: "Gaming", venue: "Galloping Ghost Arcade", city: "Brookfield", price_min: 25, price_max: 25 },
    { id: "p-gm-3", name: "VR Cyber Arena Tournament", category: "Gaming", venue: "Basecamp Esports", city: "Chicago", price_min: 30, price_max: 50 },
    { id: "p-gm-4", name: "Level Up Boardgames Lounge", category: "Gaming", venue: "Level Up Arcade", city: "Chicago", price_min: 5, price_max: 15 },
    { id: "p-gm-5", name: "Sector 23 Immersive VR Quest", category: "Gaming", venue: "Sector 23 VR Lounge", city: "Chicago", price_min: 20, price_max: 40 },
  ],
  amusement: [
    { id: "p-am-1", name: "Six Flags Great America Passes", category: "Amusement", venue: "Six Flags", city: "Gurnee", price_min: 45, price_max: 85 },
    { id: "p-am-2", name: "Santa's Village Family Azoosment", category: "Amusement", venue: "Santa's Village", city: "East Dundee", price_min: 32, price_max: 38 },
    { id: "p-am-3", name: "Safari Land Indoor Coasters", category: "Amusement", venue: "Safari Land Indoor Park", city: "Villa Park", price_min: 15, price_max: 25 },
    { id: "p-am-4", name: "Donley's Wild West Adventure", category: "Amusement", venue: "Wild West Town", city: "Union", price_min: 20, price_max: 30 },
    { id: "p-am-5", name: "Blackberry Farm Historical Park", category: "Amusement", venue: "Blackberry Farm", city: "Aurora", price_min: 8, price_max: 12 },
  ],
  food: [
    { id: "p-fd-1", name: "Alinea Michelin Dinner", category: "Food & Drink", venue: "Alinea", city: "Chicago", price_min: 250, price_max: 450 },
    { id: "p-fd-2", name: "Lou Malnati's Deep Dish Workshop", category: "Food & Drink", venue: "Lou Malnati's", city: "Chicago", price_min: 30, price_max: 50 },
    { id: "p-fd-3", name: "Pequod's Pizza Tasting", category: "Food & Drink", venue: "Pequod's Pizza", city: "Chicago", price_min: 25, price_max: 40 },
    { id: "p-fd-4", name: "Girl & The Goat Chef's Table", category: "Food & Drink", venue: "Girl & The Goat", city: "Chicago", price_min: 80, price_max: 150 },
    { id: "p-fd-5", name: "Au Cheval Legendary Burger Night", category: "Food & Drink", venue: "Au Cheval", city: "Chicago", price_min: 18, price_max: 30 },
  ],
  parks: [
    { id: "p-pk-1", name: "Lincoln Park Conservatory Tour", category: "Parks & Outdoors", venue: "Lincoln Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-pk-2", name: "Garfield Park Lagoon Rowboats", category: "Parks & Outdoors", venue: "Garfield Park", city: "Chicago", price_min: 15, price_max: 25 },
    { id: "p-pk-3", name: "Grant Park Formal Rose Gardens", category: "Parks & Outdoors", venue: "Grant Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-pk-4", name: "Jackson Park Japanese Gardens", category: "Parks & Outdoors", venue: "Jackson Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-pk-5", name: "Promontory Point Beach Picnic", category: "Parks & Outdoors", venue: "Promontory Point", city: "Chicago", price_min: 0, price_max: 0 },
  ],
  nightlife: [
    { id: "p-nl-1", name: "Green Mill Jazz Club Live", category: "Nightlife", venue: "Green Mill", city: "Chicago", price_min: 15, price_max: 25 },
    { id: "p-nl-2", name: "Kingston Mines Late Night Blues", category: "Nightlife", venue: "Kingston Mines", city: "Chicago", price_min: 15, price_max: 20 },
    { id: "p-nl-3", name: "Smartbar Electronic Dance Night", category: "Nightlife", venue: "Smartbar", city: "Chicago", price_min: 10, price_max: 30 },
    { id: "p-nl-4", name: "Untouchable Gangster Bus Tour", category: "Nightlife", venue: "Chicago Gangster Spots", city: "Chicago", price_min: 35, price_max: 45 },
    { id: "p-nl-5", name: "Taiga Craft Cocktails Lounge", category: "Nightlife", venue: "Taiga Lounge", city: "Chicago", price_min: 20, price_max: 40 },
  ],
  shopping: [
    { id: "p-sp-1", name: "Magnificent Mile Designer Tour", category: "Shopping", venue: "Michigan Avenue", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-sp-2", name: "Woodfield Premium Outlet Hop", category: "Shopping", venue: "Woodfield Mall", city: "Schaumburg", price_min: 0, price_max: 0 },
    { id: "p-sp-3", name: "Fashion Outlets Shuttle", category: "Shopping", venue: "Fashion Outlets Rosemont", city: "Rosemont", price_min: 5, price_max: 10 },
    { id: "p-sp-4", name: "State Street Historic Shops", category: "Shopping", venue: "State Street", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-sp-5", name: "Maxwell Street Vintage Market", category: "Shopping", venue: "Maxwell Street Market", city: "Chicago", price_min: 0, price_max: 0 },
  ]
};

type ExploreCardProps = {
  item: Partial<ExploreEvent> & { id: string; name: string };
  userCity: string;
  categoryColor: string;
  isPlaceholder?: boolean;
};

function ExploreCard({ item, userCity, categoryColor, isPlaceholder }: ExploreCardProps) {
  const { score, reviews } = pseudoRating(item as ExploreEvent);
  const fullStars = Math.floor(score);
  const location = isPlaceholder 
    ? { primary: item.venue || "", secondary: item.city || "" }
    : formatLocation(item as ExploreEvent, userCity);
  const price = isPlaceholder ? "Coming Soon" : formatPrice(item as ExploreEvent);
  const gradientClass = colorMap[categoryColor]?.gradient || "from-teal-400 to-emerald-600";

  return (
    <article
      className="group flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientClass} opacity-80`}>
            <Calendar size={32} className="text-white opacity-40" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-teal-700 shadow-sm backdrop-blur">
          {item.category}
        </span>
        <span className={`absolute right-3 top-3 rounded-lg px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur ${isPlaceholder ? 'bg-amber-600/90' : 'bg-[#1E293B]/85'}`}>
          {price}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="mb-1 line-clamp-1 text-[13px] font-bold leading-snug text-[#1E293B] group-hover:text-teal-700">
          {item.name}
        </h3>

        <div className="mb-1.5 flex items-center gap-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={10}
                className={
                  i <= fullStars
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-200"
                }
              />
            ))}
          </div>
          <span className="ml-1 text-[9px] text-[#64748B]">
            {score.toFixed(1)} ({reviews})
          </span>
        </div>

        <div className="mt-auto space-y-1">
          <div className="flex items-start gap-1">
            <MapPin size={11} className="mt-0.5 shrink-0 text-[#94A3B8]" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium text-[#475569]">
                {location.primary}
              </p>
              <p className="truncate text-[9px] text-[#94A3B8]">
                {location.secondary}
              </p>
            </div>
          </div>
          {item.date && (
            <div className="flex items-center gap-1">
              <Calendar size={11} className="shrink-0 text-[#94A3B8]" />
              <span className="truncate text-[9px] text-[#64748B]">
                {isPlaceholder ? item.date : formatDateTime(item as ExploreEvent)}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

type ExploreSectionProps = {
  title: string;
  icon: string;
  color: string;
  items: any[];
  seeAllHref: string;
  userCity: string;
  isPlaceholder?: boolean;
};

function ExploreSection({
  title,
  icon,
  color,
  items,
  seeAllHref,
  userCity,
  isPlaceholder,
}: ExploreSectionProps) {
  const visibleItems = items.slice(0, 15); 
  if (visibleItems.length === 0) return null;

  const cMeta = colorMap[color] || colorMap.teal;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${cMeta.bg} ${cMeta.text.split(" ")[0]}`}>
            {getIcon(icon)}
          </div>
          <h2 className="text-base font-bold text-[#1E293B]">{title}</h2>
        </div>
        <Link
          href={seeAllHref}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-teal-600 transition hover:text-teal-700"
        >
          See all
          <ChevronRight size={14} />
        </Link>
      </div>

      <CategoryScrollRow title="" subtitle="">
        {visibleItems.map((item, index) => {
          const cardEl = (
            <ExploreCard
              item={item}
              userCity={userCity}
              categoryColor={color}
              isPlaceholder={isPlaceholder}
            />
          );
          if (isPlaceholder) {
            return (
              <Link key={item.id} href={seeAllHref} className="block shrink-0">
                {cardEl}
              </Link>
            );
          }
          return (
            <Link
              key={item.id || index}
              href={`/explore/event/${encodeURIComponent(item.id)}?city=${encodeURIComponent(cityLabel(userCity))}`}
              className="block shrink-0"
            >
              {cardEl}
            </Link>
          );
        })}
      </CategoryScrollRow>
    </section>
  );
}

export default function ExploreHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchGenerationRef = useRef(0);
  const mountedRef = useRef(false);
  const userCoordsRef = useRef<UserCoords | null>(null);
  const hasLoadedFullRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hubRestoredRef = useRef(false);
  const lastFetchPerPageRef = useRef(EXPLORE_INITIAL_PER_PAGE);
  const sectionsRef = useRef<{
    trending: ExploreEvent[];
    weekend: ExploreEvent[];
    popular: ExploreEvent[];
    national: ExploreEvent[];
  }>({ trending: [], weekend: [], popular: [], national: [] });

  const hubPersistRef = useRef<{
    activeCategory: ExploreCategoryPill;
    sections: {
      trending: ExploreEvent[];
      weekend: ExploreEvent[];
      popular: ExploreEvent[];
      national: ExploreEvent[];
    };
    sectionTitles: {
      trending: string;
      trendingSubtitle: string;
      weekend: string;
      popular: string;
      national: string;
    };
    cityKey: string;
    loadedFull: boolean;
  }>({
    activeCategory: "All",
    sections: sectionsRef.current,
    sectionTitles: {
      trending: "",
      trendingSubtitle: "",
      weekend: "Happening This Weekend",
      popular: "",
      national: "National Picks",
    },
    cityKey: "",
    loadedFull: false,
  });

  const [displayCity, setDisplayCity] = useState(DEFAULT_EXPLORE_CITY);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [trendingEvents, setTrendingEvents] = useState<ExploreEvent[]>([]);
  const [weekendEvents, setWeekendEvents] = useState<ExploreEvent[]>([]);
  const [popularEvents, setPopularEvents] = useState<ExploreEvent[]>([]);
  const [nationalEvents, setNationalEvents] = useState<ExploreEvent[]>([]);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(EXPLORE_RADIUS_MILES);

  const dropdownCityLabel =
    gpsLocating && !userCoords ? "Locating…" : cityLabel(displayCity);

  const setCoords = useCallback((coords: UserCoords | null) => {
    userCoordsRef.current = coords;
    setUserCoords(coords);
  }, []);

  const applySections = useCallback(
    (
      data: EventsAPIResponse,
      source: ExploreFeedDebug["source"],
      cityKey: string,
      mode: "geo" | "city",
    ) => {
      if (mode === "city" && (userCoordsRef.current || readStoredCoords())) {
        return;
      }

      const { sections } = hydrateSectionsFromResponse(data);
      const incomingTotal = exploreSectionsTotal(sections);
      const currentTotal = exploreSectionsTotal(sectionsRef.current);
      if (
        incomingTotal > 0 &&
        currentTotal > 0 &&
        incomingTotal < currentTotal &&
        lastFetchPerPageRef.current < EXPLORE_FULL_PER_PAGE
      ) {
        setRefreshing(false);
        return;
      }

      sectionsRef.current = sections;
      setTrendingEvents(sections.trending);
      setWeekendEvents(sections.weekend);
      setPopularEvents(sections.popular);
      setNationalEvents(sections.national);

      if (data.display_city?.trim()) {
        const next = data.display_city.trim();
        setDisplayCity(next);
        const coords =
          mode === "geo"
            ? userCoordsRef.current ?? readStoredCoords()
            : null;
        saveExploreCity(next, coords);
      }
    },
    [],
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
      lastFetchPerPageRef.current = perPage;

      if (exploreEventsInFlight && !force) {
        if (exploreEventsInFlightMode === "geo" && mode === "city") return;
        if (eventsFetchUrlRef.current === url) return;
      }

      if (mode === "city" && (userCoordsRef.current || readStoredCoords())) {
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

      const cached = loadExploreFeedCache(cityKey);
      if (cached) {
        sectionsRef.current = cached.sections;
        setTrendingEvents(cached.sections.trending);
        setWeekendEvents(cached.sections.weekend);
        setPopularEvents(cached.sections.popular);
        setNationalEvents(cached.sections.national);
        setLoading(false);
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setFetchError(null);

      try {
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
    [applySections],
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
      setDisplayCity(label);
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
      setDisplayCity(cityLabel);
      await fetchEventsByCity(cityLabel);
    },
    [fetchEventsByCity, fetchEventsByCoords, setCoords],
  );

  const detectGPSCity = useCallback(async () => {
    const savedCity = loadExploreCity();
    const storedCoords = readStoredCoords();
    if (storedCoords) {
      setCoords(storedCoords);
      if (savedCity) setDisplayCity(savedCity);
      await fetchEventsByCoords(storedCoords, { force: true });
      return;
    }

    const fallbackCity = resolveFallbackCity();
    setDisplayCity(fallbackCity);
    setGpsLocating(true);

    const cityFetchPromise = fetchByCityOrGeocode(fallbackCity);

    try {
      const gpsCoords = await requestGeolocationCoords();
      if (gpsCoords) {
        setCoords(gpsCoords);
        saveExploreCity(savedCity || fallbackCity, gpsCoords);
        await fetchEventsByCoords(gpsCoords, { force: true });
        return;
      }
    } finally {
      setGpsLocating(false);
    }

    await cityFetchPromise;
  }, [fetchByCityOrGeocode, fetchEventsByCoords, setCoords]);

  const bootstrapExplore = useCallback(async () => {
    if (hubRestoredRef.current) {
      const coords = readStoredCoords();
      if (coords && !hasLoadedFullRef.current) {
        await fetchEventsByCoords(coords, {
          force: true,
          perPage: EXPLORE_FULL_PER_PAGE,
        });
      }
      return;
    }

    const savedCoords = readStoredCoords();
    const saved = loadExploreCity();
    const fallbackCity = resolveFallbackCity();
    setDisplayCity(saved || fallbackCity);

    if (savedCoords) {
      setCoords(savedCoords);
      const cityKey = exploreCityKey(savedCoords, saved);
      const cached = cityKey ? loadExploreFeedCache(cityKey) : null;
      const perPage =
        cached && exploreSectionsTotal(cached.sections) > EXPLORE_INITIAL_PER_PAGE
          ? EXPLORE_FULL_PER_PAGE
          : EXPLORE_INITIAL_PER_PAGE;
      await fetchEventsByCoords(savedCoords, { force: true, perPage });
      return;
    }

    if (saved) {
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
    const hub = loadExploreHubState();
    if (hub) {
      hubRestoredRef.current = true;
      sectionsRef.current = hub.sections;
      setTrendingEvents(hub.sections.trending);
      setWeekendEvents(hub.sections.weekend);
      setPopularEvents(hub.sections.popular);
      setNationalEvents(hub.sections.national);
      hasLoadedFullRef.current = hub.loadedFull;
      setDisplayCity(loadExploreCity() || DEFAULT_EXPLORE_CITY);
      setLoading(false);
      return;
    }

    const coords = readStoredCoords();
    const fallbackCity = resolveFallbackCity();
    setDisplayCity(fallbackCity);

    const cityKey =
      exploreCityKey(coords, fallbackCity) ?? `city:${fallbackCity.split(",")[0].trim().toLowerCase()}`;
    const sections = hydrateExploreFromCache(cityKey);
    if (!sections) return;

    sectionsRef.current = sections;
    setTrendingEvents(sections.trending);
    setWeekendEvents(sections.weekend);
    setPopularEvents(sections.popular);
    setNationalEvents(sections.national);
    setLoading(false);
  }, []);

  useEffect(() => {
    hubPersistRef.current = {
      activeCategory: "All" as ExploreCategoryPill,
      sections: {
        trending: trendingEvents,
        weekend: weekendEvents,
        popular: popularEvents,
        national: nationalEvents,
      },
      sectionTitles: {
        trending: "",
        trendingSubtitle: "",
        weekend: "Happening This Weekend",
        popular: "",
        national: "National Picks",
      },
      cityKey:
        exploreCityKey(userCoordsRef.current ?? readStoredCoords(), displayCity) ??
        "",
      loadedFull: hasLoadedFullRef.current,
    };
  }, [
    trendingEvents,
    weekendEvents,
    popularEvents,
    nationalEvents,
    displayCity,
  ]);

  useEffect(() => {
    return () => {
      const snap = hubPersistRef.current;
      if (exploreSectionsTotal(snap.sections) === 0) return;
      saveExploreHubState({
        activeCategory: snap.activeCategory,
        sections: snap.sections,
        sectionTitles: snap.sectionTitles,
        cityKey: snap.cityKey,
        loadedFull: snap.loadedFull,
        savedAt: Date.now(),
      });
    };
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    void bootstrapExplore();
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

  const allLiveEvents = useMemo(() => {
    const all = [...trendingEvents, ...weekendEvents, ...popularEvents, ...nationalEvents];
    const uniqueMap = new Map<string, ExploreEvent>();
    for (const ev of all) {
      if (ev && ev.id) {
        uniqueMap.set(ev.id, ev);
      }
    }
    let result = Array.from(uniqueMap.values());
    if (selectedDate) {
      result = result.filter((ev) => {
        if (!ev.date && !ev.start_date) return false;
        const dStr = (ev.date || ev.start_date || "").split("T")[0];
        return dStr === selectedDate;
      });
    }
    return result;
  }, [trendingEvents, weekendEvents, popularEvents, nationalEvents, selectedDate]);

  const trendingActivities = useMemo(() => {
    return allLiveEvents.filter((ev) =>
      ["experience", "arts", "cultural", "entertainment", "comedy"].some((c) =>
        (ev.category || "").toLowerCase().includes(c)
      )
    );
  }, [allLiveEvents]);

  const upcomingEventsList = useMemo(() => {
    return allLiveEvents.filter((ev) =>
      ["music", "sports", "festival"].some((c) =>
        (ev.category || "").toLowerCase().includes(c)
      )
    );
  }, [allLiveEvents]);

  const sportsAndFitness = useMemo(() => {
    return allLiveEvents.filter((ev) =>
      ["sports"].some((c) =>
        (ev.category || "").toLowerCase().includes(c)
      )
    );
  }, [allLiveEvents]);

  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return trendingActivities;
    const q = searchQuery.toLowerCase().trim();
    return trendingActivities.filter(
      (ev) =>
        ev.name?.toLowerCase().includes(q) ||
        ev.venue?.toLowerCase().includes(q) ||
        ev.category?.toLowerCase().includes(q)
    );
  }, [trendingActivities, searchQuery]);

  const filteredUpcoming = useMemo(() => {
    if (!searchQuery.trim()) return upcomingEventsList;
    const q = searchQuery.toLowerCase().trim();
    return upcomingEventsList.filter(
      (ev) =>
        ev.name?.toLowerCase().includes(q) ||
        ev.venue?.toLowerCase().includes(q) ||
        ev.category?.toLowerCase().includes(q)
    );
  }, [upcomingEventsList, searchQuery]);

  const filteredSports = useMemo(() => {
    if (!searchQuery.trim()) return sportsAndFitness;
    const q = searchQuery.toLowerCase().trim();
    return sportsAndFitness.filter(
      (ev) =>
        ev.name?.toLowerCase().includes(q) ||
        ev.venue?.toLowerCase().includes(q) ||
        ev.category?.toLowerCase().includes(q)
    );
  }, [sportsAndFitness, searchQuery]);

  const filterPlaceholders = useCallback((items: Partial<ExploreEvent>[]) => {
    let result = items;
    if (selectedDate) {
      result = result.filter((ev) => {
        if (!ev.date && !ev.start_date) return true;
        const dStr = (ev.date || ev.start_date || "").split("T")[0];
        return dStr === selectedDate;
      });
    }
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase().trim();
    return result.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.venue?.toLowerCase().includes(q) ||
        item.city?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
    );
  }, [searchQuery, selectedDate]);

  const filteredLandmarks = useMemo(() => filterPlaceholders(PLACEHOLDERS.landmarks), [filterPlaceholders]);
  const filteredTrekking = useMemo(() => filterPlaceholders(PLACEHOLDERS.trekking), [filterPlaceholders]);
  const filteredGaming = useMemo(() => filterPlaceholders(PLACEHOLDERS.gaming), [filterPlaceholders]);
  const filteredAmusement = useMemo(() => filterPlaceholders(PLACEHOLDERS.amusement), [filterPlaceholders]);
  const filteredFood = useMemo(() => filterPlaceholders(PLACEHOLDERS.food), [filterPlaceholders]);
  const filteredParks = useMemo(() => filterPlaceholders(PLACEHOLDERS.parks), [filterPlaceholders]);
  const filteredNightlife = useMemo(() => filterPlaceholders(PLACEHOLDERS.nightlife), [filterPlaceholders]);
  const filteredShopping = useMemo(() => filterPlaceholders(PLACEHOLDERS.shopping), [filterPlaceholders]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Discover experiences near you
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Curated picks within 200 miles of {cityLabel(displayCity)}
        </p>
        {fetchError && (
          <p className="mt-2 text-xs text-amber-700">
            Live refresh issue: {fetchError} {refreshing ? " Retrying..." : ""}
          </p>
        )}
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities, landmarks, events..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          />
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowCityDropdown((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm hover:border-teal-400 sm:w-auto"
          >
            <div className="flex items-center gap-1.5">
              <MapPin size={15} className="text-teal-600" />
              <span className="font-semibold text-slate-900">{dropdownCityLabel}</span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {showCityDropdown && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <div className="relative mb-1.5">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
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
                  className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                />
              </div>

              {cityLoading && (
                <p className="py-2 text-center text-xs text-slate-400">
                  Searching...
                </p>
              )}

              {citySuggestions.map((s) => (
                <button
                  key={s.place_id || s.label}
                  type="button"
                  onClick={() => selectCity(s)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
                >
                  <MapPin size={11} className="shrink-0 text-slate-400" />
                  <span className="truncate">{s.label}</span>
                </button>
              ))}

              {!cityLoading &&
                citySearch.length >= 2 &&
                citySuggestions.length === 0 && (
                  <p className="py-2 text-center text-xs text-slate-400">
                    No cities found
                  </p>
                )}

              <button
                type="button"
                onClick={() => {
                  setShowCityDropdown(false);
                  detectGPSCity();
                }}
                className="mt-1 flex w-full items-center gap-1.5 border-t border-slate-100 px-2 py-2 text-left text-xs font-bold text-teal-600 hover:bg-slate-50"
              >
                <Navigation size={11} />
                Use current location
              </button>
            </div>
          )}
        </div>

        <MinimalCalendar
          selectedDate={selectedDate}
          onChange={setSelectedDate}
        />

        <Link href="/explore/map" className="shrink-0">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 shadow-sm hover:bg-teal-100/80 hover:border-teal-300 transition-all sm:w-auto"
          >
            <Compass size={15} className="text-teal-600" />
            <span>Map View</span>
          </button>
        </Link>
      </div>

      <div className="space-y-2">
        {/* 1. Trending Activities */}
        <ExploreSection
          title="Trending Activities"
          icon="ti-flame"
          color="teal"
          items={filteredActivities}
          seeAllHref="/explore/activities"
          userCity={displayCity}
        />

        {/* 2. Upcoming Events */}
        <ExploreSection
          title="Upcoming Events"
          icon="ti-calendar"
          color="blue"
          items={filteredUpcoming}
          seeAllHref="/explore/events"
          userCity={displayCity}
        />

        {/* 3. Photo Spots & Landmarks */}
        <ExploreSection
          title="Photo Spots & Landmarks"
          icon="ti-camera"
          color="rose"
          items={filteredLandmarks}
          seeAllHref="/explore/landmarks"
          userCity={displayCity}
          isPlaceholder={true}
        />

        {/* 4. Trekking & Adventure */}
        <ExploreSection
          title="Trekking & Adventure"
          icon="ti-map"
          color="amber"
          items={filteredTrekking}
          seeAllHref="/explore/trekking"
          userCity={displayCity}
          isPlaceholder={true}
        />

        {/* 5. Gaming */}
        <ExploreSection
          title="Gaming"
          icon="ti-game-controller"
          color="purple"
          items={filteredGaming}
          seeAllHref="/explore/gaming"
          userCity={displayCity}
          isPlaceholder={true}
        />

        {/* 6. Amusement Parks */}
        <ExploreSection
          title="Amusement Parks"
          icon="ti-ticket"
          color="sky"
          items={filteredAmusement}
          seeAllHref="/explore/amusement"
          userCity={displayCity}
          isPlaceholder={true}
        />

        {/* 7. Restaurants & Food */}
        <ExploreSection
          title="Restaurants & Food"
          icon="ti-soup"
          color="orange"
          items={filteredFood}
          seeAllHref="/explore/food"
          userCity={displayCity}
          isPlaceholder={true}
        />

        {/* 8. Parks & Outdoors */}
        <ExploreSection
          title="Parks & Outdoors"
          icon="ti-trees"
          color="emerald"
          items={filteredParks}
          seeAllHref="/explore/parks"
          userCity={displayCity}
          isPlaceholder={true}
        />

        {/* 9. Nightlife */}
        <ExploreSection
          title="Nightlife"
          icon="ti-glass"
          color="fuchsia"
          items={filteredNightlife}
          seeAllHref="/explore/nightlife"
          userCity={displayCity}
          isPlaceholder={true}
        />

        {/* 10. Sports & Fitness */}
        <ExploreSection
          title="Sports & Fitness"
          icon="ti-activity"
          color="indigo"
          items={filteredSports}
          seeAllHref="/explore/sports"
          userCity={displayCity}
        />

        {/* 11. Shopping */}
        <ExploreSection
          title="Shopping"
          icon="ti-shopping-cart"
          color="violet"
          items={filteredShopping}
          seeAllHref="/explore/shopping"
          userCity={displayCity}
          isPlaceholder={true}
        />
      </div>

      <div ref={loadMoreRef} className="h-1" aria-hidden />
    </div>
  );
}
