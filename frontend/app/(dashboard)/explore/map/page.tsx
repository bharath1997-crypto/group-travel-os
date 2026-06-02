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
  Map,
  List,
  Grid,
  Navigation,
  Share2,
  CalendarPlus,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  TrendingUp,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ExploreCardImage } from "@/components/explorer/ExploreCardImage";
import { MinimalCalendar } from "@/components/explorer/MinimalCalendar";
import { cityLabel } from "@/lib/explore-events";
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
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const categoryTapRef = useRef<{ category: string; timestamp: number } | null>(null);
  const [mapContainerReady, setMapContainerReady] = useState(false);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);

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
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const { selectedDate, datePreset, onDateChange, matchesEvent } =
    useExploreDateFilter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

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
  const [votes, setVotes] = useState<Record<string, "go" | "skip" | "maybe">>({});
  const [events, setEvents] = useState<any[]>([]);
  const [mapError, setMapError] = useState<"missing-key" | "auth-failure" | null>(null);

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
    (category: string) => {
      setActiveCategory(category);
      const enteringCategory = isCategoryMapMode(category);
      if (enteringCategory) {
        setRadius(CATEGORY_MAP_DEFAULT_RADIUS);
      } else if (!categoryParam) {
        setRadius(MAIN_MAP_DEFAULT_RADIUS);
      }
      const params = new URLSearchParams(searchParams.toString());
      if (category === "All") params.delete("category");
      else params.set("category", category);
      const qs = params.toString();
      router.replace(qs ? `/explore/map?${qs}` : "/explore/map", { scroll: false });
    },
    [router, searchParams, categoryParam],
  );

  const handleCategoryTap = useCallback(
    (cat: string) => {
      const now = Date.now();
      const prev = categoryTapRef.current;

      if (prev && prev.category === cat && now - prev.timestamp < 320) {
        categoryTapRef.current = null;
        if (cat !== "All" && activeCategory === cat) {
          setCategoryFilter("All");
        } else {
          setCategoryFilter(cat);
        }
        return;
      }

      categoryTapRef.current = { category: cat, timestamp: now };
      window.setTimeout(() => {
        if (
          categoryTapRef.current?.category === cat &&
          categoryTapRef.current.timestamp === now
        ) {
          categoryTapRef.current = null;
          setCategoryFilter(cat);
        }
      }, 320);
    },
    [activeCategory, setCategoryFilter],
  );

  const clearAllFilters = useCallback(() => {
    const keepCategory = isCategoryMapMode(activeCategory) ? activeCategory : "All";
    setActiveCategory(keepCategory);
    onDateChange(null, null);
    setSearchQuery("");
    setRadius(
      isCategoryMapMode(keepCategory) ? CATEGORY_MAP_DEFAULT_RADIUS : MAIN_MAP_DEFAULT_RADIUS,
    );
    if (keepCategory === "All") router.replace("/explore/map", { scroll: false });
    else router.replace(`/explore/map?category=${encodeURIComponent(keepCategory)}`, { scroll: false });
  }, [activeCategory, onDateChange, router]);

  const hasActiveFilters =
    !!selectedDate ||
    !!datePreset ||
    !!searchQuery.trim() ||
    radius !== defaultRadius ||
    (!isCategoryMap && activeCategory !== "All");

  const { filteredEventsList, dateFilterRelaxed } = useMemo(() => {
    const applyFilters = (includeDate: boolean) => {
      let result = events;
      if (activeCategory !== "All") {
        result = result.filter((ev) => matchesMapCategory(ev.category, activeCategory));
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

  // Hydrate local cache or fetch from backend
  useEffect(() => {
    setLoading(true);
    const apiPath = `/explore/events?lat=${userLocation.lat}&lon=${userLocation.lng}&radius=${radius}&per_page=200`;

    apiFetch<any>(apiPath, {}, 60000)
      .then((data) => {
        if (data.display_city) {
          setDisplayCity(String(data.display_city).split(",")[0].trim());
        } else if (data.city) {
          setDisplayCity(String(data.city).split(",")[0].trim());
        }
        let list = data.events || [];
        if (list.length === 0) {
          list = getHydratedPlaceholders(userLocation.lat, userLocation.lng);
        }
        setEvents(list);
        setIsCached(false);
        try {
          localStorage.setItem("rovvy_map_cache", JSON.stringify(list));
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        console.warn("Map events API issue:", err);
        // Load offline cache
        try {
          const cached = localStorage.getItem("rovvy_map_cache");
          if (cached) {
            setEvents(JSON.parse(cached));
            setIsCached(true);
            triggerToast("Showing cached offline results");
          } else {
            // Fallback immediately to nearby placeholders
            setEvents(getHydratedPlaceholders(userLocation.lat, userLocation.lng));
          }
        } catch {
          setEvents(getHydratedPlaceholders(userLocation.lat, userLocation.lng));
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userLocation.lat, userLocation.lng, radius]);

  const getHydratedPlaceholders = (lat: number, lng: number) => {
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
          distance_miles: haversineDistance(lat, lng, offsetLat, offsetLng)
        });
      });
    });
    return list;
  };

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
          mapTypeControl: false,
          streetViewControl: true,
          fullscreenControl: false,
          styles: [],
        });

        mapInstanceRef.current = map;

        new google.maps.Marker({
          position: userLocation,
          map,
          title: "Your Location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#0F766E",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
          },
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error("Maps loader failed:", err);
      });

    return () => {
      cancelled = true;
      if (clustererRef.current) {
        teardownClusterer(clustererRef.current);
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapInstanceRef.current = null;
      if (typeof window !== "undefined") {
        (window as any).gm_authFailure = null;
      }
    };
  }, [mapContainerReady]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setCenter(userLocation);
  }, [userLocation]);

  // SVG customized category pin icon
  const getPinIcon = (category: string) => {
    if (typeof window === "undefined" || !(window as any).google) return undefined;
    const color = PIN_COLORS[category] || "#0F766E";
    const emoji = PIN_EMOJI[category] || "📍";
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        <circle cx="20" cy="20" r="18" fill="${color}" stroke="#FFFFFF" stroke-width="2.5" filter="url(#shadow)"/>
        <text x="20" y="25" font-size="18" text-anchor="middle" font-family="Segoe UI Symbol, Apple Color Emoji">${emoji}</text>
      </svg>
    `;
    return {
      url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
      scaledSize: new (window as any).google.maps.Size(36, 36),
      anchor: new (window as any).google.maps.Point(18, 18)
    };
  };

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

      const marker = new google.maps.Marker({
        position: { lat, lng },
        title: ev.name,
        icon: getPinIcon(ev.category || "Events"),
      });

      marker.addListener("click", () => {
        setSelectedItem(ev);
        map.panTo({ lat, lng });
      });

      markers.push(marker);
    });

    markersRef.current = markers;

    if (markers.length === 0) return;

    clustererRef.current = new MarkerClusterer({
      map,
      markers,
      algorithmOptions: {
        maxZoom: 14,
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
  }, [filteredEventsList]);

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

  const handleVote = (id: string, option: "go" | "skip" | "maybe") => {
    setVotes((prev) => ({ ...prev, [id]: prev[id] === option ? undefined : (option as any) }));
    triggerToast(`Vote registered: ${option.toUpperCase()}`);
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
              <Map size={14} />
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

          {/* Search bar */}
          <div className="relative w-48">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search map..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-7 pr-3 text-xs outline-none focus:border-teal-500"
            />
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

            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryTap(cat)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? "bg-teal-700 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <span>{PIN_EMOJI[cat] || "🧭"}</span>
                <span>{cat}</span>
                <span
                  className={`ml-1 rounded px-1 py-0.2 text-[9px] ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
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

      {/* Main Map & Sidebar Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Map view (left, full height minus bottom strip) */}
        <div className="flex-1 h-full relative flex flex-col">
          <div ref={setMapContainerNode} className="flex-1 w-full bg-slate-100 relative" />

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

          {/* Floating Premium Popup Card at Bottom Left of Map */}
          {!mapError && selectedItem && (
                <div className="absolute bottom-4 left-4 z-10 w-80 overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <ExploreCardImage
                    imageUrl={selectedItem.image_url}
                    alt={selectedItem.name || selectedItem.title || "Place"}
                    category={selectedItem.category}
                    className="relative overflow-hidden"
                    style={{ height: "160px", borderRadius: "20px 20px 0 0" }}
                    imgClassName="h-full w-full object-cover"
                    overlay
                  />
                  <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="rounded-lg px-2 py-0.5 text-[9px] font-bold text-white shadow-sm backdrop-blur" style={{ backgroundColor: PIN_COLORS[selectedItem.category] || "#0F766E" }}>
                      {PIN_EMOJI[selectedItem.category] || "🧭"} {selectedItem.category || "Place"}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                      🚗 {driveTime(selectedItem.distance_miles || 1.5)} drive
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{selectedItem.name}</h3>
                  <div className="flex items-center gap-1.5 my-1">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-[9px] text-slate-500">4.5 (200+)</span>
                  </div>
                  <div className="flex items-start gap-1 text-[10px] text-slate-500 mt-1 min-w-0">
                    <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" />
                    <span className="truncate">{selectedItem.venue}</span>
                  </div>
                  
                  {/* Actions Grid */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-100">
                    <button 
                      onClick={() => triggerToast("Booking experience redirect...")}
                      className="rounded-lg bg-teal-700 py-1.5 text-center text-[10px] font-bold text-white hover:bg-teal-800 transition"
                    >
                      Book
                    </button>
                    <button 
                      onClick={() => toggleSaveItem(selectedItem.id)}
                      className={`rounded-lg py-1.5 text-center text-[10px] font-bold transition border ${
                        savedIds.has(selectedItem.id)
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {savedIds.has(selectedItem.id) ? "Saved!" : "Save to Trip"}
                    </button>
                    <button 
                      onClick={() => triggerToast("Group Poll created!")}
                      className="rounded-lg bg-slate-100 py-1.5 text-center text-[10px] font-bold text-slate-700 hover:bg-slate-200 transition"
                    >
                      Poll
                    </button>
                  </div>
                  </div>
                </div>
          )}

          {/* Street View thumbnail strip */}
          <div className="h-[60px] bg-slate-900 flex items-center px-4 gap-4 overflow-x-auto text-white text-xs border-t border-slate-800 shrink-0">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">Street View:</span>
            {mapError ? (
              <span className="text-slate-500 italic text-[10px]">Street View unavailable while Google Maps connection is pending</span>
            ) : selectedItem ? (
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-20 rounded bg-slate-800 overflow-hidden relative border border-slate-700 shrink-0">
                  <img
                    src={`https://maps.googleapis.com/maps/api/streetview?size=160x80&location=${selectedItem.venue_lat || 41.8781},${selectedItem.venue_lon || -87.6298}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                    alt="Street View Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=160&q=80";
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate text-slate-200 text-[11px]">{selectedItem.name}</p>
                  <p className="text-[9px] text-slate-500 truncate">{selectedItem.venue}</p>
                </div>
              </div>
            ) : (
              <span className="text-slate-500 italic text-[10px]">Select a marker on the map to see Street View panorama</span>
            )}
          </div>
        </div>

        {/* Sidebar list (right, 265px) */}
        <div className="w-[265px] border-l border-slate-200 flex flex-col h-full bg-white shrink-0 select-none">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700">Explore List</span>
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
              {filteredEventsList.length} items
            </span>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredEventsList.map((ev) => {
              const isSelected = selectedItem?.id === ev.id;
              const hasSaved = savedIds.has(ev.id);
              const vote = votes[ev.id];

              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedItem(ev)}
                  className={`p-3 transition hover:bg-slate-50/80 cursor-pointer ${
                    isSelected ? "bg-teal-50/60 border-l-4 border-teal-700" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[10px] font-bold truncate flex items-center gap-1" style={{ color: PIN_COLORS[ev.category] || "#0F766E" }}>
                      {PIN_EMOJI[ev.category] || "🧭"} {ev.category}
                    </span>
                    {hasSaved && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Saved to Trip" />
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{ev.name}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{ev.venue}</p>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100/60">
                    <span className="text-[9px] text-slate-400">
                      🚗 {driveTime(ev.distance_miles || 1.5)}
                    </span>
                    
                    {/* Voting Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(ev.id, "go");
                        }}
                        className={`p-1 rounded hover:bg-slate-100 transition ${
                          vote === "go" ? "text-emerald-600 bg-emerald-50" : "text-slate-400"
                        }`}
                        title="Go"
                      >
                        <ThumbsUp size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(ev.id, "skip");
                        }}
                        className={`p-1 rounded hover:bg-slate-100 transition ${
                          vote === "skip" ? "text-rose-600 bg-rose-50" : "text-slate-400"
                        }`}
                        title="Skip"
                      >
                        <ThumbsDown size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(ev.id, "maybe");
                        }}
                        className={`p-1 rounded hover:bg-slate-100 transition ${
                          vote === "maybe" ? "text-amber-600 bg-amber-50" : "text-slate-400"
                        }`}
                        title="Maybe"
                      >
                        <HelpCircle size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredEventsList.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-400 italic">No matching places found</p>
            )}
          </div>

          {/* Bottom Actions Workspace */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2 shrink-0">
            <button
              onClick={() => triggerToast("Group Poll created in Trip Workspace!")}
              className="w-full rounded-xl bg-teal-700 py-2 text-center text-xs font-bold text-white hover:bg-teal-800 transition"
            >
              Group Poll
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => triggerToast("Planning route sequence...")}
                className="rounded-xl border border-slate-200 bg-white py-1.5 text-center text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Plan Route
              </button>
              <button
                onClick={() => triggerToast("Structuring Plan Day schedule...")}
                className="rounded-xl border border-slate-200 bg-white py-1.5 text-center text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Plan Day
              </button>
            </div>
          </div>
        </div>
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
