"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import {
  ArrowLeft,
  Calendar,
  Compass,
  MapPin,
  Search,
  Star,
  Info,
  Map as MapIcon,
  List,
  Grid,
  Navigation,
  Share2,
  CalendarPlus,
  TrendingUp,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Music,
  Activity,
  Utensils,
  Trees,
  GlassWater,
  Gamepad2,
  FerrisWheel,
  Mountain,
  Camera,
  ShoppingBag,
  Trophy,
} from "lucide-react";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { apiFetch } from "@/lib/api";
import {
  getCachedProfileAvatarUrl,
  syncLocalProfileCache,
} from "@/lib/profileCache";
import { resolveProfilePhotoUrl } from "@/lib/profilePhoto";
import { dicebearAvatarSvgUrl } from "@/lib/dicebearAvatar";
import { ExploreCardImage } from "@/components/explorer/ExploreCardImage";
import { MinimalCalendar } from "@/components/explorer/MinimalCalendar";
import {
  cityLabel,
  directionsUrl,
  formatPlaceAddress,
  mapsUrl,
} from "@/lib/explore-events";
import {
  isExploreMapCategory,
  matchesMapCategory,
  MAIN_MAP_DEFAULT_RADIUS,
  CATEGORY_MAP_DEFAULT_RADIUS,
  isCategoryMapMode,
} from "@/lib/explore-map-categories";
import { useExploreDateFilter } from "@/hooks/useExploreDateFilter";
import {
  fetchLocationWeather,
  formatWeatherChip,
  resolveWeatherDate,
} from "@/lib/explore-weather";
import {
  fetchPlaceEnrichment,
  getCachedPlaceEnrichment,
  mergePlaceEnrichment,
  setCachedPlaceEnrichment,
  type PlaceEnrichment,
} from "@/lib/place-enrichment";

// Custom pin colors per category
const PIN_COLORS: Record<string, string> = {
  Events: "#3B82F6",
  Activities: "#0F766E",
  Food: "#F97316",
  Parks: "#10B981",
  Nightlife: "#EC4899",
  Gaming: "#8B5CF6",
  Amusement: "#EF4444",
  Trekking: "#F59E0B",
  Landmarks: "#F59E0B",
  Shopping: "#6366F1",
  Sports: "#6366F1"
};

const PIN_EMOJI: Record<string, string> = {
  Events: "🎵",
  Activities: "🎭",
  Food: "🍕",
  Parks: "🌲",
  Nightlife: "🍸",
  Gaming: "🎮",
  Amusement: "🎢",
  Trekking: "🥾",
  Landmarks: "📸",
  Shopping: "🛍️",
  Sports: "⚾"
};

const CATEGORIES = [
  "All",
  "Events",
  "Activities",
  "Food",
  "Parks",
  "Nightlife",
  "Gaming",
  "Amusement",
  "Trekking",
  "Landmarks",
  "Shopping",
  "Sports"
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  All: Compass,
  Events: Music,
  Activities: Activity,
  Food: Utensils,
  Parks: Trees,
  Nightlife: GlassWater,
  Gaming: Gamepad2,
  Amusement: FerrisWheel,
  Trekking: Mountain,
  Landmarks: Camera,
  Shopping: ShoppingBag,
  Sports: Trophy,
};

// Rich fallback placeholder locations
const PLACEHOLDERS: Record<string, any[]> = {
  landmarks: [
    { id: "p-lm-1", name: "Millennium Park Cloud Gate", category: "Landmarks", venue: "Millennium Park", price_min: 0, price_max: 0 },
    { id: "p-lm-2", name: "Chicago Skydeck Ledge", category: "Landmarks", venue: "Willis Tower", price_min: 35, price_max: 45 },
    { id: "p-lm-3", name: "Navy Pier Centennial Wheel", category: "Landmarks", venue: "Navy Pier", price_min: 18, price_max: 25 },
    { id: "p-lm-4", name: "Art Institute of Chicago", category: "Landmarks", venue: "Art Institute", price_min: 25, price_max: 30 },
    { id: "p-lm-5", name: "Wrigley Field Historic Tour", category: "Landmarks", venue: "Wrigley Field", price_min: 30, price_max: 40 }
  ],
  trekking: [
    { id: "p-tk-1", name: "Starved Rock Canyons Hike", category: "Trekking", venue: "Starved Rock State Park", price_min: 0, price_max: 0 },
    { id: "p-tk-2", name: "Waterfall Glen Trail Loop", category: "Trekking", venue: "Waterfall Glen Forest Preserve", price_min: 0, price_max: 0 },
    { id: "p-tk-3", name: "Swallow Cliff Stairclimb", category: "Trekking", venue: "Swallow Cliff Woods", price_min: 0, price_max: 0 },
    { id: "p-tk-4", name: "Des Plaines River Kayak Trail", category: "Trekking", venue: "Des Plaines River", price_min: 15, price_max: 30 },
    { id: "p-tk-5", name: "Palos Forest Mountain Biking", category: "Trekking", venue: "Palos Trail System", price_min: 0, price_max: 0 }
  ],
  gaming: [
    { id: "p-gm-1", name: "Ignite Gaming Esports League", category: "Gaming", venue: "Ignite Gaming Lounge", price_min: 10, price_max: 25 },
    { id: "p-gm-2", name: "Galloping Ghost Arcade", category: "Gaming", venue: "Galloping Ghost Arcade", price_min: 25, price_max: 25 },
    { id: "p-gm-3", name: "VR Cyber Arena Tournament", category: "Gaming", venue: "Basecamp Esports", price_min: 30, price_max: 50 }
  ],
  amusement: [
    { id: "p-am-1", name: "Six Flags Great America Passes", category: "Amusement", venue: "Six Flags", price_min: 45, price_max: 85 },
    { id: "p-am-2", name: "Santa's Village Family Azoosment", category: "Amusement", venue: "Santa's Village", price_min: 32, price_max: 38 },
    { id: "p-am-3", name: "Safari Land Indoor Coasters", category: "Amusement", venue: "Safari Land Indoor Park", price_min: 15, price_max: 25 }
  ],
  food: [
    { id: "p-fd-1", name: "Alinea Michelin Dinner", category: "Food", venue: "Alinea", price_min: 250, price_max: 450 },
    { id: "p-fd-2", name: "Lou Malnati's Deep Dish Workshop", category: "Food", venue: "Lou Malnati's", price_min: 30, price_max: 50 },
    { id: "p-fd-3", name: "Girl & The Goat Chef's Table", category: "Food", venue: "Girl & The Goat", price_min: 80, price_max: 150 }
  ]
};

// Client-side Haversine helper
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateRadius(
  ne: { lat: () => number; lng: () => number },
  sw: { lat: () => number; lng: () => number },
): number {
  const latDiff = Math.abs(ne.lat() - sw.lat());
  const lonDiff = Math.abs(ne.lng() - sw.lng());
  const maxDiff = Math.max(latDiff, lonDiff);
  return Math.min(maxDiff * 69, 500);
}

function mergeMapEvents(prev: any[], incoming: any[]): any[] {
  const byId = new Map<string, any>();
  for (const ev of prev) {
    if (ev?.id) byId.set(String(ev.id), ev);
  }
  for (const ev of incoming) {
    if (ev?.id) byId.set(String(ev.id), ev);
  }
  return Array.from(byId.values());
}

function getHydratedPlaceholders(lat: number, lng: number) {
  const list: any[] = [];
  Object.keys(PLACEHOLDERS).forEach((catKey) => {
    const items = PLACEHOLDERS[catKey];
    items.forEach((item, idx) => {
      const angle = (idx * 72 + catKey.charCodeAt(0)) * (Math.PI / 180);
      const radiusDeg = 0.01 + idx * 0.008;
      const offsetLat = lat + Math.sin(angle) * radiusDeg;
      const offsetLng = lng + Math.cos(angle) * radiusDeg;

      list.push({
        ...item,
        venue_lat: offsetLat,
        venue_lon: offsetLng,
        city: item.city || "Nearby",
        distance_miles: haversineDistance(lat, lng, offsetLat, offsetLng),
      });
    });
  });
  return list;
}

const BOUNDS_FETCH_DEBOUNCE_MS = 500;

function teardownClusterer(clusterer: MarkerClusterer | null) {
  if (!clusterer) return;
  clusterer.clearMarkers();
  (clusterer as { setMap?: (map: null) => void }).setMap?.(null);
}

export default function ExploreMapViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const userLocationMarkerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const routePolylineRef = useRef<any>(null);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsListenerRef = useRef<any>(null);
  const fetchPlacesForBoundsRef = useRef<
    (centerLat: number, centerLon: number, radiusMiles: number) => Promise<void>
  >(async () => {});
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const categoryClickRef = useRef<{
    category: string;
    clicks: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const activeCategoryRef = useRef<string | null>("All");
  const listItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [mapContainerReady, setMapContainerReady] = useState(false);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const setMapContainerNode = useCallback((node: HTMLDivElement | null) => {
    mapContainerRef.current = node;
    setMapContainerReady(!!node);
  }, []);

  const categoryParam = searchParams.get("category");
  const isCategoryMap = isCategoryMapMode(categoryParam);
  const defaultRadius = isCategoryMap ? CATEGORY_MAP_DEFAULT_RADIUS : MAIN_MAP_DEFAULT_RADIUS;

  // Default to Chicago coordinates
  const [userLocation, setUserLocation] = useState({ lat: 41.8781, lng: -87.6298 });
  const [displayCity, setDisplayCity] = useState("Chicago");
  const [radius, setRadius] = useState<number>(defaultRadius);
  const [activeCategory, setActiveCategory] = useState<string | null>("All");
  activeCategoryRef.current = activeCategory;

  const { selectedDate, datePreset, onDateChange, matchesEvent } =
    useExploreDateFilter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const checkCategoryScroll = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollCategoriesLeft(scrollLeft > 2);
    setCanScrollCategoriesRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  const scrollCategories = useCallback((direction: "left" | "right") => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollTo({
      left: direction === "left" ? el.scrollLeft - amount : el.scrollLeft + amount,
      behavior: "smooth",
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState("☀️ 71°F · Clear · Chicago");

  // Interaction State
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<any[]>([]);
  const [mapError, setMapError] = useState<"missing-key" | "auth-failure" | null>(null);
  const [userLocIconSvg, setUserLocIconSvg] = useState<string>("");
  const [profileButtonAvatarUrl, setProfileButtonAvatarUrl] = useState<string | null>(
    null,
  );
  const [profileButtonInitials, setProfileButtonInitials] = useState("Y");
  const [profileButtonImgFailed, setProfileButtonImgFailed] = useState(false);
  const { user: dashboardUser } = useDashboardUser();

  useEffect(() => {
    let active = true;
    const loadAvatar = async () => {
      if (typeof window === "undefined") return;
      const userName =
        dashboardUser?.full_name?.trim() ||
        localStorage.getItem("gt_user_name")?.trim() ||
        "You";
      const initials = userName.charAt(0).toUpperCase() || "Y";

      // Default fallback SVG (Initials inside brand-teal ring)
      const getFallbackSvg = () => `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="#0F766E" fill-opacity="0.15" />
          <circle cx="18" cy="18" r="12" fill="#0F766E" fill-opacity="0.3" />
          <circle cx="18" cy="18" r="9" fill="#0F766E" stroke="#FFFFFF" stroke-width="1.5" />
          <text x="18" y="21" font-size="9" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-weight="bold" text-anchor="middle">${initials}</text>
        </svg>
      `;

      let meForPhoto: {
        avatar_url?: string | null;
        profile_picture?: string | null;
        google_picture?: string | null;
        facebook_picture?: string | null;
      } | null = dashboardUser
        ? {
            avatar_url: dashboardUser.avatar_url,
            profile_picture: null,
          }
        : null;

      if (!resolveProfilePhotoUrl(meForPhoto)) {
        const cached = getCachedProfileAvatarUrl()?.trim();
        if (cached) {
          meForPhoto = { avatar_url: cached, profile_picture: null };
        }
      }

      if (!resolveProfilePhotoUrl(meForPhoto)) {
        try {
          const me = await apiFetch<{
            full_name?: string | null;
            avatar_url?: string | null;
            profile_picture?: string | null;
            google_picture?: string | null;
            facebook_picture?: string | null;
          }>("/auth/me");
          syncLocalProfileCache(me);
          meForPhoto = {
            avatar_url: me.avatar_url,
            profile_picture:
              me.profile_picture?.trim() ||
              me.google_picture?.trim() ||
              me.facebook_picture?.trim() ||
              null,
          };
        } catch {
          /* use generated fallback below */
        }
      }

      const avatarUrl = resolveProfilePhotoUrl(meForPhoto);
      const displayUrl = avatarUrl || dicebearAvatarSvgUrl(userName);
      let iconSvg = getFallbackSvg();

      if (displayUrl) {
        try {
          const res = await fetch(displayUrl);
          if (res.ok) {
            const blob = await res.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            if (active) {
              iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="#0F766E" fill-opacity="0.15" />
                  <circle cx="18" cy="18" r="12" fill="#0F766E" fill-opacity="0.3" />
                  <circle cx="18" cy="18" r="9" fill="#FFFFFF" stroke="#0F766E" stroke-width="2" />
                  <clipPath id="avatar-clip">
                    <circle cx="18" cy="18" r="8" />
                  </clipPath>
                  <image href="${base64}" x="10" y="10" width="16" height="16" clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice" />
                </svg>
              `;
            }
          }
        } catch (err) {
          console.warn("Could not fetch avatar for map marker, using initials fallback:", err);
        }
      }

      if (active) {
        setUserLocIconSvg(iconSvg);
        setProfileButtonAvatarUrl(displayUrl);
        setProfileButtonInitials(initials);
        setProfileButtonImgFailed(false);
      }
    };

    void loadAvatar();
    return () => {
      active = false;
    };
  }, [dashboardUser?.avatar_url, dashboardUser?.full_name]);

  useEffect(() => {
    if (userLocationMarkerRef.current && userLocIconSvg && typeof window !== "undefined" && (window as any).google) {
      const google = (window as any).google;
      userLocationMarkerRef.current.setIcon({
        url: `data:image/svg+xml;utf-8,${encodeURIComponent(userLocIconSvg)}`,
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 18),
      });
    }
  }, [userLocIconSvg]);

  useEffect(() => {
    checkCategoryScroll();
    const timer = setTimeout(checkCategoryScroll, 150);
    window.addEventListener("resize", checkCategoryScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkCategoryScroll);
    };
  }, [checkCategoryScroll, events.length]);

  // Apply category + unlimited radius when opened from a feature (?category=Activities)
  useEffect(() => {
    const cat = categoryParam;
    if (cat && isExploreMapCategory(cat)) {
      setActiveCategory(cat);
      setRadius(CATEGORY_MAP_DEFAULT_RADIUS);
    } else {
      setRadius(MAIN_MAP_DEFAULT_RADIUS);
    }
  }, [categoryParam]);

  const setCategoryFilter = useCallback(
    (category: string | null) => {
      setActiveCategory(category);
      const enteringCategory = category != null && isCategoryMapMode(category);
      if (enteringCategory) {
        setRadius(CATEGORY_MAP_DEFAULT_RADIUS);
      } else if (!categoryParam) {
        setRadius(MAIN_MAP_DEFAULT_RADIUS);
      }
      const params = new URLSearchParams(searchParams.toString());
      if (!category || category === "All") params.delete("category");
      else params.set("category", category);
      const qs = params.toString();
      router.replace(qs ? `/explore/map?${qs}` : "/explore/map", { scroll: false });
    },
    [router, searchParams, categoryParam],
  );

  const flushCategoryClick = useCallback(
    (cat: string) => {
      const snap = categoryClickRef.current;
      categoryClickRef.current = null;
      if (!snap || snap.category !== cat) return;

      const isActive = activeCategoryRef.current === cat;

      if (snap.clicks >= 2 || isActive) {
        if (isActive) {
          setCategoryFilter(null);
        } else {
          setCategoryFilter(cat);
        }
        return;
      }

      setCategoryFilter(cat);
    },
    [setCategoryFilter],
  );

  const handleCategoryTap = useCallback(
    (cat: string) => {
      const pending = categoryClickRef.current;

      if (pending?.timer) {
        clearTimeout(pending.timer);
        pending.timer = null;
      }

      if (pending?.category === cat) {
        pending.clicks += 1;
        pending.timer = window.setTimeout(() => flushCategoryClick(cat), 280);
        return;
      }

      categoryClickRef.current = {
        category: cat,
        clicks: 1,
        timer: window.setTimeout(() => flushCategoryClick(cat), 280),
      };
    },
    [flushCategoryClick],
  );

  const handleCategoryDoubleTap = useCallback(
    (cat: string) => {
      const pending = categoryClickRef.current;
      if (pending?.timer) {
        clearTimeout(pending.timer);
      }
      categoryClickRef.current = null;

      if (activeCategoryRef.current === cat) {
        setCategoryFilter(null);
      } else {
        setCategoryFilter(cat);
      }
    },
    [setCategoryFilter],
  );

  useEffect(() => {
    return () => {
      const pending = categoryClickRef.current;
      if (pending?.timer) clearTimeout(pending.timer);
    };
  }, []);

  const clearAllFilters = useCallback(() => {
    const keepCategory =
      activeCategory && isCategoryMapMode(activeCategory) ? activeCategory : "All";
    setActiveCategory(keepCategory);
    onDateChange(null, null);
    setSearchQuery("");
    setRadius(
      keepCategory && isCategoryMapMode(keepCategory)
        ? CATEGORY_MAP_DEFAULT_RADIUS
        : MAIN_MAP_DEFAULT_RADIUS,
    );
    if (!keepCategory || keepCategory === "All") {
      router.replace("/explore/map", { scroll: false });
    } else {
      router.replace(`/explore/map?category=${encodeURIComponent(keepCategory)}`, {
        scroll: false,
      });
    }
  }, [activeCategory, onDateChange, router]);

  const hasActiveFilters =
    !!selectedDate ||
    !!datePreset ||
    !!searchQuery.trim() ||
    radius !== defaultRadius ||
    (!isCategoryMap && activeCategory === null);

  const noCategorySelected = activeCategory === null;

  const { filteredEventsList, dateFilterRelaxed } = useMemo(() => {
    if (activeCategory === null) {
      return { filteredEventsList: [], dateFilterRelaxed: false };
    }

    const applyFilters = (includeDate: boolean) => {
      let result = events;
      if (activeCategory !== "All") {
        result = result.filter((ev) =>
          matchesMapCategory(ev.category, activeCategory),
        );
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(
          (ev) =>
            ev.name?.toLowerCase().includes(q) ||
            ev.venue?.toLowerCase().includes(q),
        );
      }
      if (includeDate && (selectedDate || datePreset)) {
        result = result.filter((ev) => matchesEvent(ev.date || ev.start_date));
      }
      return result;
    };

    const strict = applyFilters(true);
    let relaxed = false;
    let result = strict;
    if (strict.length === 0 && (selectedDate || datePreset)) {
      const withoutDate = applyFilters(false);
      if (withoutDate.length > 0) {
        result = withoutDate;
        relaxed = true;
      }
    }
    return {
      filteredEventsList: [...result].sort(
        (a, b) => (a.distance_miles || 0) - (b.distance_miles || 0),
      ),
      dateFilterRelaxed: relaxed,
    };
  }, [events, activeCategory, searchQuery, selectedDate, datePreset, matchesEvent]);

  const relaxedToastShown = useRef(false);
  useEffect(() => {
    if (dateFilterRelaxed && !relaxedToastShown.current) {
      triggerToast("Showing nearby pins outside selected date");
      relaxedToastShown.current = true;
    }
    if (!dateFilterRelaxed) relaxedToastShown.current = false;
  }, [dateFilterRelaxed, triggerToast]);

  useEffect(() => {
    let cancelled = false;
    const weatherDate = resolveWeatherDate(selectedDate, datePreset);

    const loadWeather = async () => {
      try {
        const display = await fetchLocationWeather(
          userLocation.lat,
          userLocation.lng,
          weatherDate,
        );
        if (cancelled || !display) return;

        if (display.condition === "Forecast unavailable") {
          setWeather(`📅 — · Forecast unavailable · ${cityLabel(displayCity)}`);
          return;
        }
        if (display.condition === "Past date") {
          setWeather(`📅 — · Past date · ${cityLabel(displayCity)}`);
          return;
        }

        setWeather(formatWeatherChip(display, cityLabel(displayCity)));
      } catch {
        if (!cancelled) setWeather(`☀️ — · Weather unavailable · ${cityLabel(displayCity)}`);
      }
    };

    void loadWeather();
    return () => {
      cancelled = true;
    };
  }, [userLocation.lat, userLocation.lng, displayCity, selectedDate, datePreset]);

  const fetchPlacesForBounds = useCallback(
    async (centerLat: number, centerLon: number, radiusMiles: number) => {
      const cappedRadius = Math.min(
        Math.max(Math.round(radiusMiles), 10),
        Math.min(radius, 500),
      );
      setLoading(true);

      try {
        const data = await apiFetch<any>(
          `/explore/events?lat=${centerLat}&lon=${centerLon}&radius=${cappedRadius}&per_page=200`,
          {},
          60000,
        );

        if (data.display_city) {
          setDisplayCity(String(data.display_city).split(",")[0].trim());
        } else if (data.city) {
          setDisplayCity(String(data.city).split(",")[0].trim());
        }

        const list = data.events || [];
        setEvents((prev) => {
          const merged = mergeMapEvents(prev, list);
          if (merged.length === 0) {
            return getHydratedPlaceholders(centerLat, centerLon);
          }
          return merged;
        });
        setIsCached(false);

        try {
          localStorage.setItem("rovvy_map_cache", JSON.stringify(list));
        } catch {
          /* ignore */
        }
      } catch (err) {
        console.warn("Map events API issue:", err);
        try {
          const cached = localStorage.getItem("rovvy_map_cache");
          if (cached) {
            const parsed = JSON.parse(cached) as any[];
            setEvents((prev) => mergeMapEvents(prev, parsed));
            setIsCached(true);
            triggerToast("Showing cached offline results");
          } else {
            setEvents((prev) => {
              if (prev.length > 0) return prev;
              return getHydratedPlaceholders(centerLat, centerLon);
            });
          }
        } catch {
          setEvents((prev) => {
            if (prev.length > 0) return prev;
            return getHydratedPlaceholders(centerLat, centerLon);
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [radius, triggerToast],
  );

  fetchPlacesForBoundsRef.current = fetchPlacesForBounds;

  const scheduleBoundsFetch = useCallback((map: any) => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const centerLat = (ne.lat() + sw.lat()) / 2;
      const centerLon = (ne.lng() + sw.lng()) / 2;
      const radiusMiles = calculateRadius(ne, sw);

      void fetchPlacesForBoundsRef.current(centerLat, centerLon, radiusMiles);
    }, BOUNDS_FETCH_DEBOUNCE_MS);
  }, []);

  // Geolocation tracking
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(newLoc);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo(newLoc);
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 120000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Refetch when manual radius cap changes (uses current viewport)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    scheduleBoundsFetch(map);
  }, [radius, scheduleBoundsFetch]);

  // Google Maps Loader
  useEffect(() => {
    if (!mapContainerReady || !mapContainerRef.current || mapInstanceRef.current) return;

    let cancelled = false;

    if (typeof window !== "undefined") {
      (window as any).gm_authFailure = () => {
        if (!cancelled) setMapError("auth-failure");
      };
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    if (!apiKey) {
      setMapError("missing-key");
      return;
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places", "geometry"],
    });

    loader
      .load()
      .then((google: any) => {
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;

        const map = new google.maps.Map(mapContainerRef.current, {
          center: userLocation,
          zoom: 13,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.BOTTOM_LEFT,
          },
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          styles: [],
        });

        mapInstanceRef.current = map;

        const userLocSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="#0F766E" fill-opacity="0.15" />
            <circle cx="18" cy="18" r="10" fill="#0F766E" fill-opacity="0.35" />
            <circle cx="18" cy="18" r="6" fill="#0F766E" stroke="#FFFFFF" stroke-width="2" />
          </svg>
        `;

        const initialUserLocSvg = userLocIconSvg || userLocSvg;

        const userLocMarker = new google.maps.Marker({
          position: userLocation,
          map,
          title: "Your Location",
          icon: {
            url: `data:image/svg+xml;utf-8,${encodeURIComponent(initialUserLocSvg)}`,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18),
          },
        });
        userLocationMarkerRef.current = userLocMarker;

        boundsListenerRef.current = map.addListener("bounds_changed", () => {
          scheduleBoundsFetch(map);
        });
        scheduleBoundsFetch(map);
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error("Maps loader failed:", err);
      });

    return () => {
      cancelled = true;
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = null;
      if (boundsListenerRef.current) {
        boundsListenerRef.current.remove();
        boundsListenerRef.current = null;
      }
      if (clustererRef.current) {
        teardownClusterer(clustererRef.current);
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
        userLocationMarkerRef.current = null;
      }
      mapInstanceRef.current = null;
      clearDrivingRoute();
      if (typeof window !== "undefined") {
        (window as any).gm_authFailure = null;
      }
    };
  }, [mapContainerReady, scheduleBoundsFetch]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setCenter(userLocation);
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setPosition(userLocation);
    }
  }, [userLocation]);

  // SVG customized category pin icon
  const getPinIcon = (category: string, isSelected = false) => {
    if (typeof window === "undefined" || !(window as any).google) return undefined;
    const color = PIN_COLORS[category] || "#0F766E";
    const emoji = PIN_EMOJI[category] || "📍";
    const size = isSelected ? 48 : 40;
    const r = isSelected ? 20 : 18;
    const ring = isSelected
      ? `<circle cx="24" cy="24" r="22" fill="none" stroke="#2563EB" stroke-width="3" opacity="0.85"/>`
      : "";
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        ${ring}
        <circle cx="24" cy="24" r="${r}" fill="${color}" stroke="#FFFFFF" stroke-width="2.5" filter="url(#shadow)"/>
        <text x="24" y="29" font-size="${isSelected ? 20 : 18}" text-anchor="middle" font-family="Segoe UI Symbol, Apple Color Emoji">${emoji}</text>
      </svg>
    `;
    const anchor = isSelected ? 24 : 20;
    return {
      url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
      scaledSize: new (window as any).google.maps.Size(size, size),
      anchor: new (window as any).google.maps.Point(anchor, anchor),
      zIndex: isSelected ? 2000 : 1,
    };
  };

  const clearDrivingRoute = useCallback(() => {
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
  }, []);

  const drawDrivingRoute = useCallback(
    (route: PlaceEnrichment["route"]) => {
      const map = mapInstanceRef.current;
      const google = (window as any).google;
      clearDrivingRoute();
      if (!map || !google || !route?.polyline?.length) return;

      routePolylineRef.current = new google.maps.Polyline({
        path: route.polyline.map(([lat, lng]) => ({ lat, lng })),
        geodesic: true,
        strokeColor: "#0F766E",
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map,
        zIndex: 500,
      });
    },
    [clearDrivingRoute],
  );

  const loadPlaceDetails = useCallback(
    async (ev: any) => {
      enrichAbortRef.current?.abort();
      const controller = new AbortController();
      enrichAbortRef.current = controller;

      const cached = getCachedPlaceEnrichment(ev.id);
      if (cached) {
        setSelectedItem((prev: any) =>
          prev?.id === ev.id ? mergePlaceEnrichment(prev, cached) : prev,
        );
        drawDrivingRoute(cached.route);
        return;
      }

      setEnrichLoading(true);
      try {
        const enrichment = await fetchPlaceEnrichment(ev, userLocation);
        if (controller.signal.aborted) return;
        setCachedPlaceEnrichment(ev.id, enrichment);
        setSelectedItem((prev: any) =>
          prev?.id === ev.id ? mergePlaceEnrichment(prev, enrichment) : prev,
        );
        drawDrivingRoute(enrichment.route);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn("Place enrichment failed:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setEnrichLoading(false);
        }
      }
    },
    [userLocation, drawDrivingRoute],
  );

  const selectPlace = useCallback(
    (ev: any) => {
      setSelectedItem(ev);
      const lat = ev.venue_lat || ev.lat;
      const lng = ev.venue_lon || ev.lng;
      const map = mapInstanceRef.current;
      if (map && lat && lng) {
        map.panTo({ lat, lng });
        if (map.getZoom() < 15) map.setZoom(15);
      }
      void loadPlaceDetails(ev);
    },
    [loadPlaceDetails],
  );

  const closePlaceDetails = useCallback(() => {
    enrichAbortRef.current?.abort();
    enrichAbortRef.current = null;
    setEnrichLoading(false);
    setSelectedItem(null);
    clearDrivingRoute();
  }, [clearDrivingRoute]);

  useEffect(() => {
    if (noCategorySelected) {
      closePlaceDetails();
    }
  }, [noCategorySelected, closePlaceDetails]);

  // Update map markers when events or filters change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = (window as any).google;
    if (!map || typeof window === "undefined" || !google) return;

    if (clustererRef.current) {
      teardownClusterer(clustererRef.current);
      clustererRef.current = null;
    }

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const markers: any[] = [];

    filteredEventsList.forEach((ev) => {
      const lat = ev.venue_lat || ev.lat;
      const lng = ev.venue_lon || ev.lng;
      if (!lat || !lng) return;

      const isSelected = selectedItem?.id === ev.id;

      const marker = new google.maps.Marker({
        position: { lat, lng },
        title: ev.name,
        icon: getPinIcon(ev.category || "Events", isSelected),
        zIndex: isSelected ? 2000 : 1,
      });

      marker.addListener("click", () => {
        selectPlace(ev);
      });

      markers.push(marker);
    });

    markersRef.current = markers;

    if (markers.length === 0) return;

    clustererRef.current = new MarkerClusterer({
      map,
      markers,
      algorithmOptions: {
        maxZoom: 16,
      },
      renderer: {
        render: ({ count, position }) =>
          new google.maps.Marker({
            position,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
                  <circle cx="20" cy="20" r="18" fill="#0F766E" opacity="0.9"/>
                  <text x="20" y="25" text-anchor="middle" fill="white"
                    font-size="14" font-weight="bold">${count}</text>
                </svg>
              `)}`,
              scaledSize: new google.maps.Size(40, 40),
            },
            zIndex: 1000,
          }),
      },
    });

    return () => {
      if (clustererRef.current) {
        teardownClusterer(clustererRef.current);
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [filteredEventsList, selectedItem?.id, selectPlace]);

  // Drive time estimator
  const driveTime = (miles: number) => {
    const mins = Math.max(2, Math.round(miles * 2));
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remaining = mins % 60;
      return `${hrs} hr ${remaining} min`;
    }
    return `${mins} min`;
  };

  const toggleSaveItem = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        triggerToast("Removed from saved list");
      } else {
        next.add(id);
        triggerToast("Saved to Trip Workspace!");
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden select-none">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 p-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
              {weather}
            </span>
          </div>
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2">
          {/* Mode Toggles */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <Link href="/explore">
              <button className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                <List size={14} />
                <span>List</span>
              </button>
            </Link>
            <button className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-teal-700 shadow-sm">
              <MapIcon size={14} />
              <span>Map</span>
            </button>
          </div>

          {/* Date picker */}
          <MinimalCalendar
            selectedDate={selectedDate}
            quickPreset={datePreset}
            onChange={onDateChange}
            compact
          />

          {/* Radius Selector */}
          <div className="relative">
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300"
            >
              <option value={10}>10 miles</option>
              <option value={50}>50 miles</option>
              <option value={100}>100 miles</option>
              <option value={200}>200 miles</option>
              <option value={CATEGORY_MAP_DEFAULT_RADIUS}>Unlimited</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
              title="Clear all filters"
            >
              <RotateCcw size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Strip */}
      <div className="relative flex items-center border-b border-slate-100 bg-slate-50/50 shrink-0 select-none">
        {canScrollCategoriesLeft ? (
          <button
            type="button"
            onClick={() => scrollCategories("left")}
            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-teal-300 hover:text-teal-700"
            aria-label="Scroll categories left"
          >
            <ChevronLeft size={14} />
          </button>
        ) : null}

        <div
          ref={categoryScrollRef}
          onScroll={checkCategoryScroll}
          className="flex flex-1 items-center gap-2 overflow-x-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            const count = events.filter(
              (ev) => cat === "All" || matchesMapCategory(ev.category, cat)
            ).length;
            const IconComponent = CATEGORY_ICONS[cat] || Compass;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryTap(cat)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  handleCategoryDoubleTap(cat);
                }}
                className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 shrink-0 border ${
                  isActive
                    ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-teal-600 hover:text-white hover:border-teal-600 hover:shadow-sm"
                }`}
              >
                <IconComponent
                  size={14}
                  className={`transition-colors duration-300 ${
                    isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                  }`}
                />
                <span>{cat}</span>
                <span
                  className={`ml-1 rounded px-1 py-0.2 text-[9px] transition-all duration-300 ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-500 group-hover:bg-white/20 group-hover:text-white"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {canScrollCategoriesRight ? (
          <button
            type="button"
            onClick={() => scrollCategories("right")}
            className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-teal-300 hover:text-teal-700"
            aria-label="Scroll categories right"
          >
            <ChevronRight size={14} />
          </button>
        ) : null}
      </div>

      {/* Main: Full Screen Map & Floating Results Panel */}
      <div className="flex flex-1 overflow-hidden relative w-full h-full">
        {/* Map Canvas */}
        <div className="absolute inset-0 w-full h-full z-0">
          <div ref={setMapContainerNode} className="absolute inset-0 bg-slate-100" />

          {mapError ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0F172A] p-6 overflow-hidden select-text">
              {/* Decorative background gradients */}
              <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
              <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-md w-full bg-[#1E293B]/90 border border-slate-700/60 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-white text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4 animate-pulse">
                  <MapPin size={24} />
                </div>
                
                <h3 className="text-lg font-bold text-white tracking-tight mb-2">
                  {mapError === "missing-key" ? "Google Maps API Key Missing" : "Google Maps API Project Authorization Pending"}
                </h3>
                
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  {mapError === "missing-key" 
                    ? "The Google Maps API key environment variable is not configured for the frontend. Follow these instructions to set it up:" 
                    : "The Google Maps script was loaded, but the API returned a project configuration error (ApiProjectMapError). Follow these instructions to authorize your key:"}
                </p>

                <div className="bg-[#0F172A]/60 border border-slate-800 rounded-xl p-4 mb-5 text-left text-xs text-slate-300 space-y-2.5">
                  <div className="flex gap-2.5">
                    <span className="flex-shrink-0 text-[#0F766E] font-bold">1.</span>
                    <p>
                      Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline font-semibold inline-flex items-center gap-0.5 font-sans">Google Cloud Console <ExternalLink size={10} /></a>.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex-shrink-0 text-[#0F766E] font-bold">2.</span>
                    <p>
                      Select your active project and ensure the <span className="font-semibold text-white">Maps JavaScript API</span> is fully enabled.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex-shrink-0 text-[#0F766E] font-bold">3.</span>
                    <p>
                      Confirm a <span className="font-semibold text-white">Billing Account</span> is linked, as Google Maps Platform requires active billing to load.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="flex-shrink-0 text-[#0F766E] font-bold">4.</span>
                    <p>
                      {mapError === "missing-key"
                        ? "Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the Vercel dashboard (production) or your local environment."
                        : "Verify your API Key restrictions. If restricted to HTTP referrers, make sure your current origin/domain is allowed."}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href="https://console.cloud.google.com/google/maps-apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl bg-teal-700 hover:bg-teal-800 py-2.5 text-xs font-bold text-white shadow-lg transition duration-200 text-center flex items-center justify-center gap-1.5"
                  >
                    Google Cloud Console <ExternalLink size={12} />
                  </a>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 rounded-xl bg-slate-700 hover:bg-slate-600 py-2.5 text-xs font-bold text-slate-200 hover:text-white transition duration-200 border border-slate-600/50"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Floating live-location / center-on-me (profile avatar) */}
          {!mapError && (
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current && userLocation) {
                  mapInstanceRef.current.panTo(userLocation);
                  mapInstanceRef.current.setZoom(15);
                  triggerToast("Centered on your location");
                }
              }}
              className="absolute bottom-28 right-4 z-10 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-teal-600 bg-white p-0.5 shadow-md ring-2 ring-teal-600/20 transition hover:scale-105 hover:ring-teal-600/40 active:scale-95"
              title="Center on my location"
              aria-label="Center map on my live location"
            >
              {profileButtonAvatarUrl && !profileButtonImgFailed ? (
                <img
                  src={profileButtonAvatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full rounded-full object-cover"
                  onError={() => setProfileButtonImgFailed(true)}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {profileButtonInitials}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Floating results panel sheet */}
        <div
          className={`absolute top-4 left-4 z-10 w-96 rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-xl backdrop-blur-md transition-all duration-300 flex flex-col max-h-[calc(100%-2rem)] ${
            isCollapsed ? "-translate-x-[110%] pointer-events-none" : "translate-x-0"
          }`}
        >
          {selectedItem ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closePlaceDetails}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100/50 text-slate-700 transition"
                    aria-label="Back to results"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-sm font-semibold text-slate-800 font-sans">Details</span>
                </div>
                <div className="flex items-center gap-2">
                  {enrichLoading && (
                    <span className="text-[10px] text-teal-600 font-medium animate-pulse">
                      Loading details…
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100/50 text-slate-500 hover:text-slate-700 transition"
                    aria-label="Collapse panel"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto mt-4 pr-1 -mr-2 space-y-4">
                <div className="relative w-full overflow-hidden rounded-xl bg-slate-100 shadow-sm animate-fade-in" style={{ height: "180px" }}>
                  <ExploreCardImage
                    imageUrl={selectedItem.image_url}
                    alt={selectedItem.name || "Place"}
                    category={selectedItem.category}
                    placeId={selectedItem.id}
                    className="relative h-full w-full"
                    imgClassName="h-full w-full object-cover"
                    overlay
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-bold text-slate-900 leading-snug">
                      {selectedItem.name}
                    </h2>
                    <button
                      type="button"
                      onClick={closePlaceDetails}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {selectedItem.description && (
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">
                      {selectedItem.description}
                    </p>
                  )}

                  {selectedItem.rating != null && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">
                        {Number(selectedItem.rating).toFixed(1)}
                      </span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            size={12}
                            className={
                              i <= Math.round(Number(selectedItem.rating))
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200"
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    {selectedItem.category}
                    {selectedItem.price_min != null && selectedItem.price_min > 0
                      ? ` · $${selectedItem.price_min}${selectedItem.price_max ? `–$${selectedItem.price_max}` : ""}`
                      : ""}
                  </p>

                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-teal-600" />
                    <span className={enrichLoading && !selectedItem.formatted_address ? "text-slate-400 italic" : ""}>
                      {formatPlaceAddress(selectedItem)}
                    </span>
                  </div>

                  {(selectedItem.route || selectedItem.distance_miles != null) && (
                    <p className="text-xs text-slate-500 ml-6 flex items-center gap-1">
                      <Navigation size={12} className="text-slate-400 shrink-0" />
                      {selectedItem.route ? (
                        <>
                          {selectedItem.route.duration_minutes} min drive ·{" "}
                          {selectedItem.route.distance_miles} mi by car
                        </>
                      ) : (
                        <>
                          {driveTime(selectedItem.distance_miles)} drive ·{" "}
                          {selectedItem.distance_miles.toFixed(1)} mi from you
                        </>
                      )}
                    </p>
                  )}

                  {selectedItem.wikipedia_url && (
                    <a
                      href={selectedItem.wikipedia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-400 hover:text-teal-600 ml-6 inline-block"
                    >
                      Summary from Wikipedia ↗
                    </a>
                  )}

                  <div className="flex gap-2">
                    <a
                      href={directionsUrl(selectedItem, userLocation)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 rounded-full bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition shadow-sm"
                    >
                      <Navigation size={16} />
                      Directions
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleSaveItem(selectedItem.id)}
                      className={`flex items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                        savedIds.has(selectedItem.id)
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {savedIds.has(selectedItem.id) ? "Saved" : "Save"}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 text-center">
                    Route shown on map · Directions opens Google Maps (driving)
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={mapsUrl(selectedItem)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <ExternalLink size={14} />
                      Open in Maps
                    </a>
                    <Link
                      href={`/explore/event/${selectedItem.id}`}
                      className="flex items-center justify-center rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="pb-4 border-b border-slate-200/60 shrink-0 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      placeholder={`Search in ${cityLabel(displayCity)}`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-full border border-slate-200/80 bg-white/50 py-2 pl-9 pr-4 text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 shadow-sm"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(true)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition shadow-sm"
                    aria-label="Collapse panel"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-medium px-1 flex items-center justify-between">
                  <span>{loading ? "Loading…" : `${filteredEventsList.length} results`} {isCached ? " · cached" : ""}</span>
                  <span className="text-teal-700 font-semibold">{cityLabel(displayCity)}</span>
                </p>
              </div>

              <div className="flex-1 overflow-y-auto mt-2 pr-1 -mr-2">
                {filteredEventsList.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    ref={(el) => {
                      if (el) listItemRefs.current.set(ev.id, el);
                      else listItemRefs.current.delete(ev.id);
                    }}
                    onClick={() => selectPlace(ev)}
                    className="w-full text-left flex gap-3 py-3 border-b border-slate-100/60 hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">
                        {ev.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                        {ev.rating != null && (
                          <span className="text-[10px] font-semibold text-slate-800 flex items-center gap-0.5">
                            {Number(ev.rating).toFixed(1)}
                            <Star size={8} className="fill-amber-400 text-amber-400" />
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">{ev.category}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                        {formatPlaceAddress(ev)}
                      </p>
                      {ev.distance_miles != null && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {driveTime(ev.distance_miles)} · {ev.distance_miles.toFixed(1)} mi
                        </p>
                      )}
                    </div>
                    <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-slate-100 bg-slate-100 shadow-sm">
                      <ExploreCardImage
                        imageUrl={ev.image_url}
                        alt={ev.name}
                        category={ev.category}
                        placeId={ev.id}
                        className="relative h-full w-full"
                        imgClassName="h-full w-full object-cover"
                      />
                    </div>
                  </button>
                ))}

                {filteredEventsList.length === 0 && !loading && (
                  <p className="p-8 text-center text-xs text-slate-400">
                    {noCategorySelected
                      ? "No categories selected. Choose a category above to show places on the map."
                      : "No places match your search. Try another category or zoom the map."}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Restore Trigger Button */}
        {isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/95 text-slate-700 shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-slate-50 hover:text-teal-600 hover:scale-105 active:scale-95"
            aria-label="Restore search panel"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Dynamic Toast Messages */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
