"use client";

/*
  Required env variables in
  .env.local file:

  NEXT_PUBLIC_TICKETMASTER_KEY=your_key

  Get Ticketmaster key:
  developer.ticketmaster.com
  → My Apps → your app → Consumer Key
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/lib/api";
import { getToken } from "@/lib/auth";

const TM_KEY = process.env.NEXT_PUBLIC_TICKETMASTER_KEY || "";
const PREDICTHQ_TOKEN = process.env.NEXT_PUBLIC_PREDICTHQ_TOKEN || "";

/** Max Overpass radius for first paint (50 km) — full scope applies after refetch / GPS. */
const INITIAL_OVERPASS_RADIUS_M = 50000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    globalThis.clearTimeout(timeoutId);
    return res;
  } catch (err) {
    globalThis.clearTimeout(timeoutId);
    throw err;
  }
}

async function apiFetchWithTimeout<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 8000,
): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalized}`;
  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();
  const hasBody =
    options.body !== undefined &&
    options.body !== null &&
    options.body !== "";
  if (
    hasBody &&
    !headers.has("Content-Type") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method)
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (typeof window !== "undefined") {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const NAVY = "#0F3460";
const CORAL = "#E94560";
const BG = "#F8F9FA";

type FeedEvent = {
  id: string;
  source: string;
  name: string;
  date?: string;
  time?: string;
  venue?: string;
  city?: string;
  lat: number;
  lon: number;
  category?: string;
  /** Short label for cards (e.g. “From $45” or “Free”) */
  price?: string;
  /** Full price line: range + currency (Ticketmaster / multi-tier Eventbrite) */
  priceDetail?: string;
  currency?: string;
  isFree?: boolean;
  image?: string;
  url?: string;
  emoji?: string;
  /** Street + city + region + postal when the API provides it */
  locationLines?: string[];
  description?: string;
  /** Ticketmaster legal / accessibility notes */
  pleaseNote?: string;
  /** Presale, promo, or discount blurbs when present */
  promoText?: string;
  /** Eventbrite: each ticket tier name + display price */
  ticketTiers?: { name: string; price: string }[];
  opening_hours?: string;
  website?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTmPriceRange(
  ranges: { min?: number; max?: number; currency?: string }[] | undefined,
): { short: string; detail: string; isFree: boolean; currency?: string } {
  if (!ranges?.length) {
    return {
      short: "Price TBD",
      detail: "Pricing varies — see official listing for current tiers.",
      isFree: false,
    };
  }
  const p = ranges[0];
  const cur = (p.currency || "USD").toUpperCase();
  const sym = cur === "USD" ? "$" : `${cur} `;
  const min = p.min;
  const max = p.max;
  if (min != null && max != null) {
    if (min === 0 && max === 0) {
      return {
        short: "Free",
        detail: "Listed as free on Ticketmaster.",
        isFree: true,
        currency: cur,
      };
    }
    if (min === max) {
      const line = `${sym}${min}`;
      return {
        short: `From ${sym}${min}`,
        detail: `${line} (${cur}) before fees.`,
        isFree: false,
        currency: cur,
      };
    }
    const line = `${sym}${min} – ${sym}${max}`;
    return {
      short: `From ${sym}${min}`,
      detail: `${line} ${cur} (before taxes & fees).`,
      isFree: false,
      currency: cur,
    };
  }
  if (min != null) {
    return {
      short: `From ${sym}${min}`,
      detail: `From ${sym}${min} ${cur} (before fees).`,
      isFree: false,
      currency: cur,
    };
  }
  return {
    short: "Price TBD",
    detail: "See listing for price tiers.",
    isFree: false,
    currency: cur,
  };
}

function pickTmImage(images: { url?: string; width?: number; height?: number }[] | undefined): string | undefined {
  if (!images?.length) return undefined;
  const sorted = [...images].sort(
    (a, b) => (b.width || 0) - (a.width || 0),
  );
  return sorted[0]?.url || images[0]?.url;
}

function buildVenueLocationLines(v: {
  name?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: { name?: string };
    state?: { stateCode?: string; name?: string };
    postalCode?: string;
  };
  city?: { name?: string };
}): string[] {
  const lines: string[] = [];
  const a = v.address;
  if (a?.line1) lines.push(a.line1);
  if (a?.line2) lines.push(a.line2);
  const cityName = a?.city?.name || v.city?.name;
  const state = a?.state?.stateCode || a?.state?.name;
  const zip = a?.postalCode;
  if (cityName || state || zip) {
    lines.push([cityName, state, zip].filter(Boolean).join(", "));
  }
  return lines.filter(Boolean);
}

type TrendingDestination = {
  id: string;
  name: string;
  country: string;
  category: string;
  trending_score: number;
  emoji?: string;
};

type TrendingResponse = {
  items: TrendingDestination[];
};

const PLACEHOLDER_EVENTS: FeedEvent[] = [
  {
    id: "p1",
    source: "Sample",
    name: "Local Food Festival",
    date: new Date().toISOString().split("T")[0],
    time: "12:00",
    venue: "City Park",
    city: "Your City",
    lat: 0,
    lon: 0,
    category: "Food",
    price: "Free",
    isFree: true,
    emoji: "🍽️",
  },
  {
    id: "p2",
    source: "Sample",
    name: "Live Music Night",
    date: new Date().toISOString().split("T")[0],
    time: "19:00",
    venue: "Local Venue",
    city: "Your City",
    lat: 0,
    lon: 0,
    category: "Music",
    price: "$15",
    isFree: false,
    emoji: "🎵",
  },
  {
    id: "p3",
    source: "Sample",
    name: "Art Exhibition Opening",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
    venue: "Art Gallery",
    city: "Your City",
    lat: 0,
    lon: 0,
    category: "Art",
    price: "Free",
    isFree: true,
    emoji: "🎨",
  },
  {
    id: "p4",
    source: "Sample",
    name: "Community Sports Day",
    date: new Date().toISOString().split("T")[0],
    time: "09:00",
    venue: "Sports Complex",
    city: "Your City",
    lat: 0,
    lon: 0,
    category: "Sports",
    price: "Free",
    isFree: true,
    emoji: "⚽",
  },
];

const PLACEHOLDER_DESTINATIONS: TrendingDestination[] = [
  {
    id: "1",
    name: "Chicago",
    country: "US",
    category: "City",
    trending_score: 95,
    emoji: "🏙️",
  },
  {
    id: "2",
    name: "New York",
    country: "US",
    category: "City",
    trending_score: 89,
    emoji: "🗽",
  },
  {
    id: "3",
    name: "Miami",
    country: "US",
    category: "Beach",
    trending_score: 82,
    emoji: "🏖️",
  },
  {
    id: "4",
    name: "Denver",
    country: "US",
    category: "Adventure",
    trending_score: 76,
    emoji: "🏔️",
  },
];

const CATEGORY_PILLS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "music", label: "🎵 Music" },
  { key: "food", label: "🍽️ Food" },
  { key: "art", label: "🎨 Art" },
  { key: "sports", label: "⚽ Sports" },
  { key: "culture", label: "🎭 Culture" },
  { key: "nature", label: "🌿 Nature" },
  { key: "festival", label: "🎪 Festival" },
  { key: "business", label: "💼 Business" },
  { key: "travel", label: "✈️ Travel" },
];

const QUICK_CITIES: { emoji: string; name: string }[] = [
  { emoji: "🏙️", name: "New York" },
  { emoji: "🌆", name: "Los Angeles" },
  { emoji: "🌃", name: "Chicago" },
  { emoji: "🎸", name: "Nashville" },
  { emoji: "🎭", name: "Las Vegas" },
  { emoji: "🌴", name: "Miami" },
  { emoji: "🏖️", name: "Orlando" },
  { emoji: "🎵", name: "Austin" },
  { emoji: "🌉", name: "San Francisco" },
  { emoji: "🗼", name: "Paris" },
  { emoji: "🇬🇧", name: "London" },
  { emoji: "🇦🇺", name: "Sydney" },
  { emoji: "🇮🇳", name: "Mumbai" },
  { emoji: "🇯🇵", name: "Tokyo" },
];

const TIME_PILLS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekend", label: "This Weekend" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "pick", label: "📅 Pick Date" },
];

const MOOD_PLANNER_MOODS: {
  id: string;
  emoji: string;
  label: string;
  categoryKey: string;
}[] = [
  { id: "music", emoji: "🎵", label: "Music & Fun", categoryKey: "music" },
  { id: "food", emoji: "🍽️", label: "Food & Drinks", categoryKey: "food" },
  { id: "nature", emoji: "🌿", label: "Nature & Outdoors", categoryKey: "nature" },
  { id: "art", emoji: "🎨", label: "Art & Culture", categoryKey: "art" },
  { id: "sports", emoji: "⚽", label: "Sports & Action", categoryKey: "sports" },
  { id: "surprise", emoji: "🎲", label: "Surprise Me!", categoryKey: "surprise" },
];

function getDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null ||
    Number.isNaN(lat1) ||
    Number.isNaN(lon1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lon2)
  ) {
    return 999;
  }
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function matchesCategoryFilter(e: FeedEvent, activeCategory: string): boolean {
  if (activeCategory !== "all") {
    const cat = (e.category || "").toLowerCase();
    const query = activeCategory.toLowerCase();
    const emojiMatch = e.emoji === getCategoryEmoji(activeCategory);
    if (!cat.includes(query) && !emojiMatch) {
      const map: Record<string, string[]> = {
        music: ["music", "concert"],
        food: ["food", "dining", "restaurant", "cafe", "bar"],
        art: ["art", "theatre", "theater", "museum", "gallery"],
        sports: ["sport", "stadium", "fitness"],
        culture: ["culture", "community"],
        nature: ["nature", "outdoor", "park"],
        festival: ["festival"],
        business: ["business", "conference"],
        travel: ["travel"],
      };
      const keys = map[activeCategory] || [];
      if (!keys.some((k) => cat.includes(k))) return false;
    }
  }
  return true;
}

function placeTypeLabel(category?: string): string {
  const c = (category || "").toLowerCase();
  if (c.includes("restaurant") || c.includes("cafe") || c.includes("bar"))
    return "Restaurant";
  if (c.includes("park")) return "Park";
  if (c.includes("museum") || c.includes("gallery")) return "Museum";
  if (c.includes("stadium") || c.includes("sport")) return "Sports";
  if (c.includes("theatre") || c.includes("cinema")) return "Venue";
  if (c.includes("attraction") || c.includes("tourism")) return "Attraction";
  return "Place";
}

function getPlaceEmoji(type?: string): string {
  if (!type) return "📍";
  const t = type.toLowerCase();
  if (
    t.includes("restaurant") ||
    t.includes("cafe") ||
    t.includes("food")
  )
    return "🍽️";
  if (t.includes("bar") || t.includes("nightclub")) return "🍺";
  if (
    t.includes("museum") ||
    t.includes("gallery") ||
    t.includes("arts")
  )
    return "🎨";
  if (t.includes("theatre") || t.includes("cinema")) return "🎭";
  if (t.includes("park")) return "🌿";
  if (t.includes("stadium") || t.includes("sports")) return "⚽";
  if (t.includes("attraction") || t.includes("tourism")) return "🏛️";
  if (t.includes("zoo") || t.includes("theme")) return "🎪";
  return "📍";
}

function sourceBadgeStyle(source: string): { background: string } {
  if (source === "Ticketmaster") return { background: "#1a73e8" };
  if (source === "OpenEvent") return { background: "#7c3aed" };
  if (source === "PredictHQ") return { background: "#f97316" };
  if (source === "Eventbrite") return { background: "#ea580c" };
  if (source === "Nearby") return { background: "#22c55e" };
  if (source === "Sample") return { background: "#6b7280" };
  return { background: "#6b7280" };
}

function getCategoryEmoji(cat?: string): string {
  if (!cat) return "🎪";
  const c = cat.toLowerCase();
  if (c.includes("music")) return "🎵";
  if (c.includes("sport")) return "⚽";
  if (c.includes("art") || c.includes("theatre")) return "🎨";
  if (c.includes("food") || c.includes("drink")) return "🍽️";
  if (c.includes("festival")) return "🎪";
  if (c.includes("culture") || c.includes("community")) return "🎭";
  if (c.includes("nature") || c.includes("outdoor")) return "🌿";
  if (c.includes("business") || c.includes("conference")) return "💼";
  if (c.includes("travel")) return "✈️";
  return "🎪";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Date TBD";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m ?? "00"} ${ampm}`;
}

function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): string {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const d = R * 2 * Math.asin(Math.sqrt(a));
  return d < 1 ? `${(d * 5280).toFixed(0)} ft` : `${d.toFixed(1)} mi`;
}

function escapeOverpassRegex(s: string): string {
  return s.replace(/[\\.*+?^${}()|[\]]/g, "\\$&");
}

/** Maps keyword to Overpass tag filter (no leading `node`/`way`). */
function keywordToOverpassTag(kw: string): string {
  const k = kw.toLowerCase().trim();
  if (!k) return "";
  if (k.includes("park") || k.includes("garden"))
    return `["leisure"~"park|garden"]`;
  if (k.includes("restaurant") || k.includes("food") || k.includes("eat"))
    return `["amenity"~"restaurant|cafe|fast_food"]`;
  if (k.includes("bar") || k.includes("pub") || k.includes("drink"))
    return `["amenity"~"bar|pub|nightclub"]`;
  if (k.includes("museum") || k.includes("art") || k.includes("gallery"))
    return `["tourism"~"museum|gallery|attraction"]`;
  if (k.includes("hotel") || k.includes("stay") || k.includes("sleep"))
    return `["tourism"="hotel"]`;
  if (k.includes("beach")) return `["natural"="beach"]`;
  if (k.includes("cinema") || k.includes("movie") || k.includes("film"))
    return `["amenity"="cinema"]`;
  if (k.includes("theatre") || k.includes("theater"))
    return `["amenity"~"theatre|arts_centre"]`;
  if (k.includes("sport") || k.includes("gym") || k.includes("fitness"))
    return `["leisure"~"sports_centre|fitness_centre|stadium"]`;
  if (k.includes("shop") || k.includes("mall") || k.includes("store"))
    return `["shop"~"mall|department_store"]`;
  const safe = escapeOverpassRegex(kw.trim());
  return `["name"~"${safe}",i]`;
}

function scopeToRadiusMiles(scope: string): number {
  const radiusMap: Record<string, number> = {
    "10mi": 10,
    "25mi": 25,
    "50mi": 50,
    "100mi": 100,
    "500mi": 500,
    city: 25,
    district: 50,
    state: 200,
    country: 500,
    world: 1000,
  };
  return radiusMap[scope] ?? 50;
}

function scopeToRadiusMeters(scope: string): number {
  const miles = scopeToRadiusMiles(scope);
  return Math.round(miles * 1609.34);
}

function buildTmDateParams(
  timeKey: string,
  pickedDate: string,
): { startDateTime?: string; endDateTime?: string } {
  const now = new Date();
  const isoStartUtc = (d: Date) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x.toISOString().replace(/\.\d{3}Z$/, "Z");
  };
  const isoEndUtc = (d: Date) => {
    const x = new Date(d);
    x.setUTCHours(23, 59, 59, 999);
    return x.toISOString().replace(/\.\d{3}Z$/, "Z");
  };
  const addDaysUtc = (d: Date, n: number) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  };

  if (timeKey === "pick" && pickedDate.trim()) {
    return {
      startDateTime: `${pickedDate}T00:00:00Z`,
      endDateTime: `${pickedDate}T23:59:59Z`,
    };
  }
  if (timeKey === "today") {
    return { startDateTime: isoStartUtc(now), endDateTime: isoEndUtc(now) };
  }
  if (timeKey === "tomorrow") {
    const t = addDaysUtc(now, 1);
    return { startDateTime: isoStartUtc(t), endDateTime: isoEndUtc(t) };
  }
  if (timeKey === "weekend") {
    const d = new Date(now);
    const dow = d.getUTCDay();
    const daysToSat = (6 - dow + 7) % 7;
    const sat = addDaysUtc(d, daysToSat === 0 ? 0 : daysToSat);
    const sun = addDaysUtc(sat, 1);
    return { startDateTime: isoStartUtc(sat), endDateTime: isoEndUtc(sun) };
  }
  if (timeKey === "week") {
    const end = addDaysUtc(now, 7);
    return { startDateTime: now.toISOString(), endDateTime: end.toISOString() };
  }
  if (timeKey === "month") {
    const end = addDaysUtc(now, 30);
    return { startDateTime: now.toISOString(), endDateTime: end.toISOString() };
  }
  return {};
}

function matchesKeyword(e: FeedEvent, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return Boolean(
    e.name?.toLowerCase().includes(s) ||
      e.venue?.toLowerCase().includes(s) ||
      e.city?.toLowerCase().includes(s) ||
      e.category?.toLowerCase().includes(s) ||
      (e.description && e.description.toLowerCase().includes(s)),
  );
}

function mergeEventsById(...lists: FeedEvent[][]): FeedEvent[] {
  const seen = new Set<string>();
  const out: FeedEvent[] = [];
  for (const list of lists) {
    for (const ev of list) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        out.push(ev);
      }
    }
  }
  return out;
}

function scopeLabelMiles(scope: string): string {
  if (scope.endsWith("mi")) {
    return scope.replace("mi", " miles");
  }
  if (scope === "city") return "25 miles (city)";
  if (scope === "district") return "50 miles (district)";
  if (scope === "state") return "200 miles (state)";
  if (scope === "country") return "500 miles (country)";
  if (scope === "world") return "1000 miles (worldwide)";
  return scope;
}

function cardGradient(category?: string): string {
  const c = (category || "").toLowerCase();
  if (c.includes("music"))
    return "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)";
  if (c.includes("sport"))
    return "linear-gradient(135deg, #059669 0%, #34d399 100%)";
  if (c.includes("art") || c.includes("culture"))
    return "linear-gradient(135deg, #db2777 0%, #f472b6 100%)";
  if (c.includes("food"))
    return "linear-gradient(135deg, #ea580c 0%, #fb923c 100%)";
  return `linear-gradient(135deg, ${NAVY} 0%, #1e5a8a 100%)`;
}

export default function FeedPage() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [userCity, setUserCity] = useState("your location");
  const [tmEvents, setTmEvents] = useState<FeedEvent[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCityPill, setSelectedCityPill] = useState("");
  /** True after GPS refines location (shows “change above” hint). */
  const [userCityFromGps, setUserCityFromGps] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTime, setActiveTime] = useState("today");
  const [pickedDate, setPickedDate] = useState("");
  const [activeScope, setActiveScope] = useState("50mi");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [apiStatus, setApiStatus] = useState({ ticketmaster: false });
  const [statsCount, setStatsCount] = useState({
    total: 0,
    free: 0,
    weekend: 0,
    trending: 0,
  });
  const [trendingDestinations, setTrendingDestinations] = useState<
    TrendingDestination[]
  >([]);
  /** False until first trending fetch finishes (background — not tied to `loading`). */
  const [trendingReady, setTrendingReady] = useState(false);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [holidays, setHolidays] = useState<{ name: string; date: string }[]>(
    [],
  );
  const [countryCode, setCountryCode] = useState("US");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [showMoodPlanner, setShowMoodPlanner] = useState(true);
  const [interestedEvents, setInterestedEvents] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const initialGeoFetchDoneRef = useRef(false);
  /** Only refetch on scope change — not when GPS updates `userLocation`. */
  const prevScopeRef = useRef<string | null>(null);
  const activeScopeRef = useRef(activeScope);
  const activeTimeRef = useRef(activeTime);
  const pickedDateRef = useRef(pickedDate);
  useEffect(() => {
    setShowBuyConfirm(false);
  }, [selectedEvent]);

  useEffect(() => {
    activeScopeRef.current = activeScope;
  }, [activeScope]);
  useEffect(() => {
    activeTimeRef.current = activeTime;
  }, [activeTime]);
  useEffect(() => {
    pickedDateRef.current = pickedDate;
  }, [pickedDate]);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);

  const isDev = process.env.NODE_ENV === "development";

  function showToast(
    message: string,
    type: "success" | "info" | "error" = "success",
  ) {
    setToast({ message, type });
    globalThis.setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    setLocationInput(userCity);
  }, [userCity]);

  const checkApiKeys = useCallback(async () => {
    const results = { ticketmaster: false };

    if (TM_KEY) {
      try {
        const res = await fetchWithTimeout(
          "/api/proxy/ticketmaster?health=1",
          {},
          8000,
        );
        const j = (await res.json()) as { ok?: boolean; status?: number };
        results.ticketmaster = Boolean(j.ok && j.status === 200);
      } catch {
        results.ticketmaster = false;
      }
    }

    setApiStatus(results);
    return results;
  }, []);

  const fetchHolidaysForCountry = useCallback(async (cc: string) => {
    const y = new Date().getFullYear();
    try {
      const res = await fetchWithTimeout(
        `https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`,
        {},
        5000,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { name: string; date: string }[];
      setHolidays(Array.isArray(data) ? data.slice(0, 12) : []);
    } catch {
      setHolidays([]);
    }
  }, []);

  const fetchTicketmasterEvents = useCallback(
    async (
      lat: number,
      lon: number,
      scopeParam = "50mi",
      timeKeyParam = "today",
      pickedDateParam = "",
      keywordParam = "",
    ): Promise<FeedEvent[]> => {
      if (!TM_KEY) {
        console.warn(
          "Ticketmaster key missing. Add NEXT_PUBLIC_TICKETMASTER_KEY to .env.local",
        );
        return [];
      }

      const radiusMiles = scopeToRadiusMiles(scopeParam);
      const dateParams = buildTmDateParams(timeKeyParam, pickedDateParam);

      const logicalTm = new URL(
        "https://app.ticketmaster.com/discovery/v2/events.json",
      );
      logicalTm.searchParams.set("apikey", "***");
      logicalTm.searchParams.set("latlong", `${lat},${lon}`);
      logicalTm.searchParams.set("radius", String(radiusMiles));
      logicalTm.searchParams.set("unit", "miles");
      logicalTm.searchParams.set("size", "50");
      logicalTm.searchParams.set("sort", "date,asc");
      if (dateParams.startDateTime) {
        logicalTm.searchParams.set(
          "startDateTime",
          dateParams.startDateTime,
        );
      }
      if (dateParams.endDateTime) {
        logicalTm.searchParams.set("endDateTime", dateParams.endDateTime);
      }
      if (keywordParam.trim()) {
        logicalTm.searchParams.set("keyword", keywordParam.trim());
      }
      console.log("TM URL:", logicalTm.toString());

      const params = new URLSearchParams();
      params.set("lat", String(lat));
      params.set("lon", String(lon));
      params.set("radius", String(radiusMiles));
      params.set("size", "50");
      if (dateParams.startDateTime) {
        params.set("startDateTime", dateParams.startDateTime);
      }
      if (dateParams.endDateTime) {
        params.set("endDateTime", dateParams.endDateTime);
      }
      if (keywordParam.trim()) {
        params.set("keyword", keywordParam.trim());
      }

      const tmUrl = `/api/proxy/ticketmaster?${params.toString()}`;
      console.log("TM fetching for:", lat, lon, "radius mi:", radiusMiles);

      try {
        const res = await fetchWithTimeout(tmUrl, {}, 8000);
        console.log("TM status:", res.status);

        if (res.status === 401) {
          console.error(
            "Ticketmaster: Invalid API key. Check NEXT_PUBLIC_TICKETMASTER_KEY",
          );
          setApiStatus((prev) => ({ ...prev, ticketmaster: false }));
          return [];
        }

        if (res.status === 429) {
          console.warn(
            "Ticketmaster: Rate limit hit. 5000 calls/day max.",
          );
          return [];
        }

        if (!res.ok) {
          setApiStatus((prev) => ({ ...prev, ticketmaster: false }));
          return [];
        }

        const data = (await res.json()) as {
          _embedded?: { events?: Record<string, unknown>[] };
        };
        console.log("TM response:", data);

        const tmEvents = data._embedded?.events || [];
        console.log("TM events found:", tmEvents.length);
        if (tmEvents.length === 0) {
          console.log("TM full response:", JSON.stringify(data, null, 2));
        }

        const mapped: FeedEvent[] = tmEvents.map((e: Record<string, unknown>) => {
          const ev = e as {
            id: string;
            name: string;
            info?: string;
            pleaseNote?: string;
            dates?: {
              start?: { localDate?: string; localTime?: string };
            };
            _embedded?: {
              venues?: {
                name?: string;
                city?: { name?: string };
                location?: { latitude?: string; longitude?: string };
                address?: {
                  line1?: string;
                  line2?: string;
                  city?: { name?: string };
                  state?: { stateCode?: string; name?: string };
                  postalCode?: string;
                };
              }[];
            };
            classifications?: {
              segment?: { name?: string };
            }[];
            priceRanges?: {
              min?: number;
              max?: number;
              currency?: string;
            }[];
            images?: { url?: string; width?: number; height?: number }[];
            url?: string;
            promotions?: { description?: string }[] | { description?: string };
          };
          const venue = ev._embedded?.venues?.[0];
          const pr = formatTmPriceRange(ev.priceRanges);
          const locationLines = venue
            ? buildVenueLocationLines(venue)
            : [];

          let promoText: string | undefined;
          const promo = ev.promotions;
          if (Array.isArray(promo)) {
            promoText = promo
              .map((p) => p.description)
              .filter(Boolean)
              .join(" · ");
          } else if (
            promo &&
            typeof promo === "object" &&
            "description" in promo &&
            typeof (promo as { description?: string }).description === "string"
          ) {
            promoText = (promo as { description: string }).description;
          }

          return {
            id: `tm_${ev.id}`,
            source: "Ticketmaster",
            name: ev.name,
            date: ev.dates?.start?.localDate,
            time: ev.dates?.start?.localTime,
            venue: venue?.name,
            city: venue?.city?.name,
            lat: parseFloat(venue?.location?.latitude || "0"),
            lon: parseFloat(venue?.location?.longitude || "0"),
            category:
              ev.classifications?.[0]?.segment?.name || "Event",
            price: pr.short,
            priceDetail: pr.detail,
            currency: pr.currency,
            isFree: pr.isFree,
            image: pickTmImage(ev.images),
            url: ev.url,
            emoji: getCategoryEmoji(ev.classifications?.[0]?.segment?.name),
            locationLines:
              locationLines.length > 0 ? locationLines : undefined,
            description: ev.info
              ? ev.info.includes("<")
                ? stripHtml(ev.info)
                : ev.info.trim()
              : undefined,
            pleaseNote: ev.pleaseNote?.trim() || undefined,
            promoText,
          };
        });

        setApiStatus((prev) => ({ ...prev, ticketmaster: true }));
        return mapped;
      } catch (err) {
        console.error("Ticketmaster fetch error:", err);
        setApiStatus((prev) => ({ ...prev, ticketmaster: false }));
        return [];
      }
    },
    [],
  );

  const fetchNearbyPlaces = useCallback(
    async (
      lat: number,
      lon: number,
      scopeParam = "50mi",
      keywordParam = "",
      cityLabel = "your location",
      opts?: { capInitialOverpass?: boolean },
    ): Promise<FeedEvent[]> => {
      const capInitial = opts?.capInitialOverpass ?? false;
      let radiusMeters = scopeToRadiusMeters(scopeParam);

      if (capInitial) {
        radiusMeters = Math.min(radiusMeters, INITIAL_OVERPASS_RADIUS_M);
      }

      const kw = keywordParam.trim();
      const outCount = capInitial ? 10 : kw ? 20 : 30;
      const overpassTag = kw ? keywordToOverpassTag(kw) : "";

      const query = kw
        ? `
[out:json][timeout:25];
(
  node${overpassTag}(around:${radiusMeters},${lat},${lon});
  way${overpassTag}(around:${radiusMeters},${lat},${lon});
);
out center ${outCount};
`
        : `
[out:json][timeout:25];
(
  node["amenity"~"restaurant|cafe|bar|theatre|cinema|museum|arts_centre|community_centre|nightclub|events_venue"](around:${radiusMeters},${lat},${lon});
  node["tourism"~"attraction|museum|gallery|viewpoint|theme_park|zoo"](around:${radiusMeters},${lat},${lon});
  node["leisure"~"park|stadium|sports_centre|fitness_centre"](around:${radiusMeters},${lat},${lon});
);
out body ${outCount};
`;

      console.log(
        "Overpass fetching for:",
        lat,
        lon,
        "radius:",
        radiusMeters,
        "m",
        kw ? `(keyword: ${kw})` : "",
      );

      try {
        const res = await fetchWithTimeout(
          "/api/proxy/overpass",
          {
            method: "POST",
            body: query,
            headers: { "Content-Type": "text/plain" },
          },
          8000,
        );
        if (!res.ok) return [];
        const data = (await res.json()) as {
          elements?: Record<string, unknown>[];
        };
        const places = data.elements || [];
        console.log("Overpass places found:", places.length);

        const mapped: FeedEvent[] = [];
        for (const p of places) {
          const tags = p.tags as Record<string, string> | undefined;
          if (!tags?.name) continue;
          const type =
            tags.amenity || tags.tourism || tags.leisure || "Place";
          let latN: number;
          let lonN: number;
          if (p.type === "way") {
            const c = p.center as { lat?: number; lon?: number } | undefined;
            if (c?.lat == null || c?.lon == null) continue;
            latN = c.lat;
            lonN = c.lon;
          } else if (typeof p.lat === "number" && typeof p.lon === "number") {
            latN = p.lat;
            lonN = p.lon;
          } else continue;

          mapped.push({
            id: `op_${String(p.type)}_${String(p.id)}`,
            source: "Nearby",
            name: tags.name,
            date: new Date().toISOString().split("T")[0],
            time: "",
            venue: tags.name,
            city: tags["addr:city"] || cityLabel,
            lat: latN,
            lon: lonN,
            category: type,
            price: "Free",
            priceDetail: "OpenStreetMap place — no ticket price",
            isFree: true,
            emoji: getPlaceEmoji(type),
            description: tags.description || "",
            opening_hours: tags.opening_hours || "",
            website: tags.website || "",
          });
        }
        return mapped;
      } catch (err) {
        console.error("Overpass error:", err);
        return [];
      }
    },
    [],
  );

  const fetchOpenEvents = useCallback(
    async (
      lat: number,
      lon: number,
      keyword: string,
      cityLabel: string,
    ): Promise<FeedEvent[]> => {
      try {
        let url =
          `https://api.eventyay.com/v1/events` +
          `?latitude=${lat}` +
          `&longitude=${lon}` +
          `&radius=100` +
          `&status=published` +
          `&include=speakers,venue` +
          `&page[size]=20`;
        if (keyword.trim()) {
          url += `&filter[search]=${encodeURIComponent(keyword.trim())}`;
        }
        const res = await fetchWithTimeout(url, {}, 8000);
        if (!res.ok) return [];
        const data = (await res.json()) as {
          data?: {
            id: string;
            attributes?: Record<string, unknown>;
            relationships?: { venue?: { data?: { id?: string } } };
          }[];
        };
        const events = data.data || [];
        return events.map((e) => {
          const a = e.attributes || {};
          const startsAt = a["starts-at"] as string | undefined;
          const datePart = startsAt?.split("T")[0];
          const timePart = startsAt?.split("T")[1]?.slice(0, 5);
          return {
            id: `oe_${e.id}`,
            source: "OpenEvent",
            name: (a.name as string) || "Event",
            date: datePart,
            time: timePart,
            venue:
              (e.relationships?.venue?.data?.id as string | undefined) ||
              "Venue TBD",
            city: cityLabel,
            lat,
            lon,
            category: "Event",
            price: a["ticket-url"] ? "Paid" : "Free",
            isFree: !a["ticket-url"],
            emoji: "🎪",
            url: (a["event-url"] as string) || undefined,
            image: (a["original-image-url"] as string) || undefined,
          };
        });
      } catch (err) {
        console.log("OpenEvent error:", err);
        return [];
      }
    },
    [],
  );

  const fetchPredictHQEvents = useCallback(
    async (
      lat: number,
      lon: number,
      cityLabel: string,
    ): Promise<FeedEvent[]> => {
      const token = PREDICTHQ_TOKEN;
      if (!token) return [];
      try {
        const today = new Date().toISOString().split("T")[0];
        const url =
          `https://api.predicthq.com/v1/events/` +
          `?within=50mi@${lat},${lon}` +
          `&active.gte=${today}` +
          `&limit=20` +
          `&sort=start`;
        const res = await fetchWithTimeout(
          url,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
          8000,
        );
        if (!res.ok) return [];
        const data = (await res.json()) as {
          results?: {
            id: string;
            title?: string;
            start?: string;
            entities?: { name?: string }[];
            category?: string;
            geo?: { address?: { city?: string } };
            location?: [number, number];
          }[];
        };
        const events = data.results || [];
        return events.map((e) => ({
          id: `phq_${e.id}`,
          source: "PredictHQ",
          name: e.title || "Event",
          date: e.start?.split("T")[0],
          time: e.start?.split("T")[1]?.slice(0, 5),
          venue: e.entities?.[0]?.name || "Venue TBD",
          city: e.geo?.address?.city || cityLabel,
          lat: e.location?.[1] ?? lat,
          lon: e.location?.[0] ?? lon,
          category: e.category,
          price: "Free",
          isFree: true,
          emoji: getCategoryEmoji(e.category),
          url: "",
        }));
      } catch (err) {
        console.log("PredictHQ error:", err);
        return [];
      }
    },
    [],
  );

  function loadPlaceholderEvents() {
    setTmEvents(PLACEHOLDER_EVENTS);
    setNearbyPlaces([]);
    setLoading(false);
  }

  useEffect(() => {
    void checkApiKeys();

    let cancelled = false;

    const masterTimeout = globalThis.setTimeout(() => {
      console.warn("Master timeout hit - showing placeholder data");
      if (!cancelled) {
        setLoading(false);
        setTmEvents((prev) =>
          prev.length === 0 ? PLACEHOLDER_EVENTS : prev,
        );
        setTrendingDestinations((prev) =>
          prev.length === 0 ? PLACEHOLDER_DESTINATIONS : prev,
        );
        setTrendingReady(true);
      }
    }, 12000);

    const init = async () => {
      setLoading(true);

      let lat = 41.8781;
      let lon = -87.6298;
      let city = "Chicago";
      let cc = "US";

      try {
        const ipRes = await fetchWithTimeout(
          "https://ipapi.co/json/",
          {},
          5000,
        );
        if (ipRes.ok) {
          const ipData = (await ipRes.json()) as {
            latitude?: number;
            longitude?: number;
            city?: string;
            country_code?: string;
          };
          if (ipData.latitude != null && ipData.longitude != null) {
            lat = ipData.latitude;
            lon = ipData.longitude;
            city = ipData.city || city;
            cc = (ipData.country_code || "US").toUpperCase();
          }
        }
      } catch {
        console.log("IP location failed, using Chicago default");
      }

      if (cancelled) return;
      setUserLocation({ lat, lon });
      setUserCity(city);
      setCountryCode(cc);
      setLocationInput(city);
      if (city === "Chicago") {
        setSelectedCityPill("Chicago");
      }

      try {
        const [tm, nearby, openEv, phq] = await Promise.all([
          fetchTicketmasterEvents(
            lat,
            lon,
            "50mi",
            "today",
            "",
            "",
          ),
          fetchNearbyPlaces(
            lat,
            lon,
            "50mi",
            "",
            city,
            { capInitialOverpass: true },
          ),
          fetchOpenEvents(lat, lon, "", city),
          fetchPredictHQEvents(lat, lon, city),
        ]);
        await fetchHolidaysForCountry(cc);
        if (cancelled) return;
        let nextTm = mergeEventsById(tm, openEv, phq);
        if (nextTm.length === 0) nextTm = [...PLACEHOLDER_EVENTS];
        setTmEvents(nextTm);
        setNearbyPlaces(nearby);
      } catch (err) {
        console.error("Data fetch error:", err);
        if (!cancelled) loadPlaceholderEvents();
      }

      // Core feed is ready — stop blocking the UI on trending (backend may be slow/down).
      if (!cancelled) setLoading(false);

      void (async () => {
        try {
          const trendData = await apiFetchWithTimeout<TrendingResponse>(
            "/feed/trending?page_size=6",
            {},
            5000,
          );
          const items = trendData?.items ?? [];
          if (cancelled) return;
          setTrendingDestinations(
            items.map((d) => ({
              id: String(d.id),
              name: d.name,
              country: d.country,
              category: d.category,
              trending_score: d.trending_score,
              emoji:
                d.category?.toLowerCase().includes("beach")
                  ? "🏖️"
                  : d.category?.toLowerCase().includes("city")
                    ? "🏙️"
                    : "🌍",
            })),
          );
        } catch {
          if (!cancelled) setTrendingDestinations(PLACEHOLDER_DESTINATIONS);
        } finally {
          if (!cancelled) setTrendingReady(true);
        }
      })();

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const gpsLat = pos.coords.latitude;
            const gpsLon = pos.coords.longitude;
            if (cancelled) return;
            setUserLocation({ lat: gpsLat, lon: gpsLon });
            void (async () => {
              let nextCc = cc;
              let cityNameForFeed = city;
              try {
                const geoRes = await fetchWithTimeout(
                  `https://nominatim.openstreetmap.org/reverse?lat=${gpsLat}&lon=${gpsLon}&format=json`,
                  { headers: { "User-Agent": "Travello/1.0" } },
                  5000,
                );
                if (!geoRes.ok) throw new Error("nominatim");
                const geo = (await geoRes.json()) as {
                  address?: {
                    city?: string;
                    town?: string;
                    suburb?: string;
                    country_code?: string;
                  };
                };
                const cityName =
                  geo.address?.city ||
                  geo.address?.town ||
                  geo.address?.suburb ||
                  city;
                cityNameForFeed = cityName;
                nextCc = (geo.address?.country_code || "us").toUpperCase();
                setUserCity(cityName);
                setCountryCode(nextCc);
                setUserCityFromGps(true);
                setLocationInput(cityName);
                if (cityName === "Chicago") {
                  setSelectedCityPill("Chicago");
                }
              } catch {
                console.log("GPS reverse geocode failed");
              }
              if (cancelled) return;
              try {
                const sc = activeScopeRef.current;
                const tk = activeTimeRef.current;
                const pd = pickedDateRef.current;
                const [tm, nearby, openEv, phq] = await Promise.all([
                  fetchTicketmasterEvents(
                    gpsLat,
                    gpsLon,
                    sc,
                    tk,
                    pd,
                    "",
                  ),
                  fetchNearbyPlaces(
                    gpsLat,
                    gpsLon,
                    sc,
                    "",
                    cityNameForFeed,
                  ),
                  fetchOpenEvents(gpsLat, gpsLon, "", cityNameForFeed),
                  fetchPredictHQEvents(gpsLat, gpsLon, cityNameForFeed),
                ]);
                await fetchHolidaysForCountry(nextCc);
                if (cancelled) return;
                let nextTm = mergeEventsById(tm, openEv, phq);
                if (nextTm.length === 0) nextTm = [...PLACEHOLDER_EVENTS];
                setTmEvents(nextTm);
                setNearbyPlaces(nearby);
              } catch (err) {
                console.error("GPS refetch error:", err);
              }
            })();
          },
          () => {
            console.log("GPS denied, using IP location");
          },
          {
            timeout: 5000,
            maximumAge: 60000,
            enableHighAccuracy: false,
          },
        );
      }
    };

    void init().finally(() => {
      globalThis.clearTimeout(masterTimeout);
    });

    return () => {
      cancelled = true;
      globalThis.clearTimeout(masterTimeout);
    };
  }, [
    fetchTicketmasterEvents,
    fetchNearbyPlaces,
    fetchOpenEvents,
    fetchPredictHQEvents,
    fetchHolidaysForCountry,
  ]);

  const filteredTmEvents = useMemo(() => {
    let list = tmEvents.filter((e) => matchesCategoryFilter(e, activeCategory));
    if (searchQuery.trim()) {
      list = list.filter((e) => matchesKeyword(e, searchQuery));
    }
    return list;
  }, [tmEvents, activeCategory, searchQuery]);

  const filteredNearbyPlaces = useMemo(() => {
    let list = nearbyPlaces.filter((e) =>
      matchesCategoryFilter(e, activeCategory),
    );
    if (searchQuery.trim()) {
      list = list.filter((e) => matchesKeyword(e, searchQuery));
    }
    return list;
  }, [nearbyPlaces, activeCategory, searchQuery]);

  useEffect(() => {
    const total = tmEvents.length;
    const free = tmEvents.filter((e) => e.isFree).length;
    const sources = new Set(tmEvents.map((e) => e.source)).size;
    setStatsCount({
      total,
      free,
      weekend: tmEvents.filter((e) => {
        const d = new Date(e.date || "");
        if (Number.isNaN(d.getTime())) return false;
        const day = d.getDay();
        return day === 0 || day === 6;
      }).length,
      trending: sources,
    });
  }, [tmEvents]);

  function selectMood(moodId: string) {
    const m = MOOD_PLANNER_MOODS.find((x) => x.id === moodId);
    if (!m) return;
    setSelectedMood(moodId);
    if (m.categoryKey === "surprise") {
      setActiveCategory("all");
      setTmEvents((prev) => [...prev].sort(() => Math.random() - 0.5));
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 2800);
    } else {
      setActiveCategory(m.categoryKey);
    }
    setShowMoodPlanner(false);
  }

  function changeMood() {
    setShowMoodPlanner(true);
    setSelectedMood(null);
    setActiveCategory("all");
  }

  const smartSuggestionCards = useMemo(() => {
    if (selectedMood === "music") {
      return [
        { emoji: "🎤", label: "Concerts & live music", query: "concert" },
        { emoji: "🎸", label: "Gigs & venues", query: "music" },
        { emoji: "🎭", label: "Shows & theatre", query: "theatre" },
      ];
    }
    if (selectedMood === "food") {
      return [
        { emoji: "🍳", label: "Brunch & cafés", query: "cafe" },
        { emoji: "🍷", label: "Dinner & drinks", query: "restaurant" },
        { emoji: "🌮", label: "Street food", query: "food" },
      ];
    }
    if (selectedMood === "nature") {
      return [
        { emoji: "🌳", label: "Parks & trails", query: "park" },
        { emoji: "🥾", label: "Outdoor walks", query: "outdoor" },
        { emoji: "🌄", label: "Viewpoints", query: "viewpoint" },
      ];
    }
    if (selectedMood === "art") {
      return [
        { emoji: "🖼️", label: "Museums", query: "museum" },
        { emoji: "🎨", label: "Galleries", query: "gallery" },
        { emoji: "🎭", label: "Culture & shows", query: "culture" },
      ];
    }
    if (selectedMood === "sports") {
      return [
        { emoji: "🏟️", label: "Stadiums & games", query: "stadium" },
        { emoji: "⚽", label: "Sports venues", query: "sport" },
        { emoji: "🏃", label: "Fitness & action", query: "fitness" },
      ];
    }
    if (selectedMood === "surprise") {
      return [
        { emoji: "🎪", label: "Something new", query: "festival" },
        { emoji: "✨", label: "Hidden gems", query: "attraction" },
        { emoji: "🌍", label: "Explore local", query: "local" },
      ];
    }
    const h = new Date().getHours();
    if (h >= 6 && h < 12) {
      return [
        { emoji: "☕", label: "Morning coffee spots", query: "coffee" },
        { emoji: "🌅", label: "Morning walks and parks", query: "park" },
        { emoji: "🧘", label: "Wellness activities", query: "wellness" },
      ];
    }
    if (h >= 12 && h < 18) {
      return [
        { emoji: "🍽️", label: "Lunch and dining", query: "lunch" },
        { emoji: "🎨", label: "Afternoon activities", query: "museum" },
        { emoji: "🛍️", label: "Shopping areas", query: "shop" },
      ];
    }
    return [
      { emoji: "🎵", label: "Evening entertainment", query: "concert" },
      { emoji: "🍺", label: "Nightlife spots", query: "bar" },
      { emoji: "🌃", label: "Night events", query: "night" },
    ];
  }, [selectedMood]);

  function toggleInterested(id: string) {
    setInterestedEvents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function saveEventLocationPin(e: FeedEvent) {
    try {
      await apiFetchWithTimeout(
        "/pins",
        {
          method: "POST",
          body: JSON.stringify({
            lat: e.lat,
            lng: e.lon,
            name: e.name,
            flag_type: "interesting",
            note: `Event on ${e.date || "TBD"} at ${e.venue || "TBD"}`,
          }),
        },
        8000,
      );
      showToast("📍 Saved to your map!", "success");
      globalThis.setTimeout(() => setSelectedEvent(null), 1000);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not save pin",
        "error",
      );
    }
  }

  const refetchExternal = useCallback(() => {
    if (!userLocation) return;
    setLoading(true);
    setTmEvents([]);
    setNearbyPlaces([]);
    void (async () => {
      try {
        const { lat, lon } = userLocation;
        const [tm, nearby, openEv, phq] = await Promise.all([
          fetchTicketmasterEvents(
            lat,
            lon,
            activeScope,
            activeTime,
            pickedDate,
            "",
          ),
          fetchNearbyPlaces(lat, lon, activeScope, "", userCity),
          fetchOpenEvents(lat, lon, "", userCity),
          fetchPredictHQEvents(lat, lon, userCity),
        ]);
        await fetchHolidaysForCountry(countryCode);
        let nextTm = mergeEventsById(tm, openEv, phq);
        if (nextTm.length === 0) nextTm = [...PLACEHOLDER_EVENTS];
        setTmEvents(nextTm);
        setNearbyPlaces(nearby);
      } catch (err) {
        console.error("Refetch error:", err);
        loadPlaceholderEvents();
      } finally {
        setLoading(false);
      }
    })();
  }, [
    userLocation,
    countryCode,
    activeScope,
    activeTime,
    pickedDate,
    userCity,
    fetchTicketmasterEvents,
    fetchNearbyPlaces,
    fetchOpenEvents,
    fetchPredictHQEvents,
    fetchHolidaysForCountry,
  ]);

  const changeLocation = useCallback(
    async (cityName: string, fromPill = false) => {
      const trimmed = cityName.trim();
      if (!trimmed) return;
      setLoading(true);
      setTmEvents([]);
      setNearbyPlaces([]);
      setCurrentPage(1);

      if (fromPill) {
        setSelectedCityPill(trimmed);
      } else {
        setSelectedCityPill("");
      }
      setLocationInput(trimmed);

      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            trimmed,
          )}&format=json&limit=1&addressdetails=1`,
          { headers: { "User-Agent": "Travello/1.0" } },
        );
        const geoData = (await geoRes.json()) as {
          lat: string;
          lon: string;
          display_name: string;
          address?: { country_code?: string };
        }[];

        if (!geoData || geoData.length === 0) {
          showToast(
            `Could not find "${trimmed}". Try a different name.`,
            "error",
          );
          setLoading(false);
          return;
        }

        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);
        const displayName = geoData[0].display_name.split(",")[0].trim();
        const cc = (geoData[0].address?.country_code || "US").toUpperCase();

        setUserLocation({ lat, lon });
        setUserCity(displayName);
        setLocationInput(displayName);
        setCountryCode(cc);
        setUserCityFromGps(false);

        console.log(`Location changed to:`, displayName, lat, lon);

        const [tm, nearby, openEv, phq] = await Promise.all([
          fetchTicketmasterEvents(
            lat,
            lon,
            activeScope,
            activeTime,
            pickedDate,
            "",
          ),
          fetchNearbyPlaces(lat, lon, activeScope, "", displayName),
          fetchOpenEvents(lat, lon, "", displayName),
          fetchPredictHQEvents(lat, lon, displayName),
        ]);
        await fetchHolidaysForCountry(cc);
        let nextTm = mergeEventsById(tm, openEv, phq);
        if (nextTm.length === 0) nextTm = [...PLACEHOLDER_EVENTS];
        setTmEvents(nextTm);
        setNearbyPlaces(nearby);

        showToast(`Showing events near ${displayName}`, "success");
      } catch (err) {
        console.error("Location error:", err);
        showToast("Location search failed", "error");
      } finally {
        setLoading(false);
      }
    },
    [
      showToast,
      fetchTicketmasterEvents,
      fetchNearbyPlaces,
      fetchOpenEvents,
      fetchPredictHQEvents,
      fetchHolidaysForCountry,
      activeScope,
      activeTime,
      pickedDate,
    ],
  );

  const triggerKeywordSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    if (!userLocation) return;

    setTmEvents([]);
    setNearbyPlaces([]);
    setLoading(true);
    try {
      const { lat, lon } = userLocation;
      const [tm, nearby, openEv, phq] = await Promise.all([
        fetchTicketmasterEvents(
          lat,
          lon,
          activeScope,
          activeTime,
          pickedDate,
          q,
        ),
        fetchNearbyPlaces(lat, lon, activeScope, q, userCity),
        fetchOpenEvents(lat, lon, q, userCity),
        fetchPredictHQEvents(lat, lon, userCity),
      ]);
      await fetchHolidaysForCountry(countryCode);
      let nextTm = mergeEventsById(tm, openEv, phq);
      if (nextTm.length === 0) nextTm = [...PLACEHOLDER_EVENTS];
      setTmEvents(nextTm);
      setNearbyPlaces(nearby);
    } catch (err) {
      console.error("Keyword search error:", err);
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    userLocation,
    activeScope,
    activeTime,
    pickedDate,
    userCity,
    countryCode,
    fetchTicketmasterEvents,
    fetchNearbyPlaces,
    fetchOpenEvents,
    fetchPredictHQEvents,
    fetchHolidaysForCountry,
  ]);

  useEffect(() => {
    if (!userLocation) return;
    if (!initialGeoFetchDoneRef.current) {
      initialGeoFetchDoneRef.current = true;
      prevScopeRef.current = activeScope;
      return;
    }
    if (prevScopeRef.current === activeScope) return;
    prevScopeRef.current = activeScope;
    refetchExternal();
  }, [activeScope, refetchExternal]);

  const prevTimeFilterSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userLocation) return;
    const sig = `${activeTime}|${pickedDate}`;
    if (prevTimeFilterSigRef.current === null) {
      prevTimeFilterSigRef.current = sig;
      return;
    }
    if (prevTimeFilterSigRef.current === sig) return;
    prevTimeFilterSigRef.current = sig;
    refetchExternal();
  }, [activeTime, pickedDate, userLocation, refetchExternal]);

  function onLocationInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void changeLocation(locationInput);
    }
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void triggerKeywordSearch();
    }
  }

  function clearSearch() {
    setSearchQuery("");
    refetchExternal();
  }

  function setCategoryAndRefetch(key: string) {
    setActiveCategory(key);
  }

  function setTimeAndRefetch(key: string) {
    setActiveTime(key);
  }

  function setScopeAndRefetch(scope: string) {
    setActiveScope(scope);
    setScopeMenuOpen(false);
  }

  const distanceScopes = ["10mi", "25mi", "50mi", "100mi", "500mi"] as const;
  const regionScopes = [
    { key: "city", label: "My City" },
    { key: "district", label: "District" },
    { key: "state", label: "State" },
    { key: "country", label: "Country" },
    { key: "world", label: "🌍 Worldwide" },
  ];

  const feedLoading = loading;
  const eventsSectionEmpty =
    !feedLoading && filteredTmEvents.length === 0;

  return (
    <div
      className="relative mx-auto max-w-[1200px] px-4 py-4 md:px-5"
      style={{ background: BG }}
    >
      {isDev ? (
        <div className="pointer-events-none absolute right-3 top-3 z-40 flex gap-2 text-[10px] font-semibold text-[#6C757D]">
          <span className="rounded-full bg-white/90 px-2 py-0.5 shadow">
            TM
            <span
              className={`ml-0.5 inline-block h-1.5 w-1.5 rounded-full ${
                apiStatus.ticketmaster ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </span>
        </div>
      ) : null}

      {showConfetti ? (
        <div className="pointer-events-none fixed inset-0 z-[400] overflow-hidden">
          {Array.from({ length: 48 }).map((_, i) => (
            <span
              key={`cf-${i}`}
              className="absolute h-2 w-2 rounded-sm"
              style={{
                left: `${(i * 13) % 100}%`,
                top: "-8px",
                background: ["#E94560", "#0F3460", "#fbbf24", "#22c55e"][i % 4],
                animation: "confetti-fall 2.6s ease-out forwards",
                animationDelay: `${i * 0.04}s`,
              }}
            />
          ))}
        </div>
      ) : null}
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@keyframes confetti-fall{0%{transform:translateY(0) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(110vh) rotate(540deg);opacity:0}}@keyframes toast-slide-up{0%{transform:translateY(120%);opacity:0}100%{transform:translateY(0);opacity:1}}",
        }}
      />

      {showMoodPlanner ? (
        <div className="mb-4 rounded-[20px] border border-[#E9ECEF] bg-white p-5">
          <p className="text-center text-base font-bold text-[#0F3460]">
            ✨ What&apos;s your mood today?
          </p>
          <p className="mt-1 text-center text-sm text-[#6C757D]">
            We&apos;ll suggest the perfect events and places for you
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MOOD_PLANNER_MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMood(m.id)}
                className={`rounded-2xl border-2 border-[#E9ECEF] p-3.5 text-center text-sm font-semibold text-[#0F3460] transition-all duration-200 hover:-translate-y-0.5 ${
                  selectedMood === m.id
                    ? "border-[#E94560] bg-[#fff0f3]"
                    : "bg-white"
                }`}
              >
                <span className="block">{m.emoji}</span>
                <span className="mt-1 block text-[11px] leading-tight">
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowMoodPlanner(true);
            setSelectedMood(null);
          }}
          className="mb-3 w-full rounded-xl border border-[#E9ECEF] bg-white py-2 text-sm font-semibold text-[#E94560] transition hover:bg-[#fff0f3]"
        >
          Plan by mood
        </button>
      )}

      {selectedMood && !showMoodPlanner ? (
        <div
          className="mb-3 flex flex-col gap-2 rounded-xl border border-[#ffd6de] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "linear-gradient(135deg, #fff0f3, #ffe4e8)",
          }}
        >
          <p className="text-[13px] font-semibold text-[#E94560]">
            {MOOD_PLANNER_MOODS.find((x) => x.id === selectedMood)?.emoji}{" "}
            Showing{" "}
            {MOOD_PLANNER_MOODS.find((x) => x.id === selectedMood)?.label}{" "}
            events near {userCity}
          </p>
          <button
            type="button"
            onClick={changeMood}
            className="shrink-0 text-left text-[13px] font-semibold text-[#E94560] underline underline-offset-2"
          >
            Change mood →
          </button>
        </div>
      ) : null}

      <div className="mb-4">
        <p className="mb-2 text-sm font-bold text-[#0F3460]">
          💡 You might like
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {smartSuggestionCards.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setSearchQuery(s.query)}
              className="flex w-[150px] shrink-0 flex-col items-center gap-1.5 rounded-[14px] border border-[#E9ECEF] bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5"
            >
              <span className="text-[32px] leading-none">{s.emoji}</span>
              <span className="text-[11px] font-bold text-[#0F3460]">
                {s.label}
              </span>
              <span className="text-[10px] text-[#6C757D]">Near you</span>
            </button>
          ))}
        </div>
      </div>

      {/* Location + keyword search */}
      <div className="mb-2">
        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-[#E9ECEF] bg-white px-4 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <span className="shrink-0 text-lg" style={{ color: CORAL }}>
            📍
          </span>
          <input
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={onLocationInputKeyDown}
            placeholder="Enter city, state or country..."
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#2C3E50] outline-none placeholder:text-[#ADB5BD]"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void changeLocation(locationInput)}
            className="flex min-w-[80px] shrink-0 items-center justify-center rounded-[10px] px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-70"
            style={{ background: CORAL }}
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
            ) : (
              "Search"
            )}
          </button>
        </div>

        <p className="mb-1 text-[11px] text-[#6C757D]">Quick search:</p>
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_CITIES.map((c) => {
            const active = selectedCityPill === c.name;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  void changeLocation(c.name, true);
                }}
                className={`shrink-0 whitespace-nowrap rounded-[20px] border px-3 py-1.5 text-[11px] font-semibold ${
                  active
                    ? "border-[#E94560] bg-[#E94560] text-white"
                    : "border border-[#E9ECEF] bg-white text-[#6C757D]"
                }`}
              >
                {c.emoji} {c.name}
              </button>
            );
          })}
        </div>

        <div className="mb-1 flex flex-wrap items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-[#E9ECEF] bg-white px-4 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <span className="shrink-0 text-lg" style={{ color: CORAL }}>
              🔍
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search events, artists, venues..."
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#2C3E50] outline-none placeholder:text-[#ADB5BD]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={clearSearch}
                className="shrink-0 text-[#6C757D] hover:text-[#0F3460]"
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>

          <button
            type="button"
            disabled={loading || !searchQuery.trim()}
            onClick={() => void triggerKeywordSearch()}
            className="flex min-h-[44px] shrink-0 items-center justify-center gap-1 rounded-[14px] border border-[#E9ECEF] bg-white px-3.5 py-2.5 text-xs font-bold text-[#0F3460] shadow-[0_2px_8px_rgba(0,0,0,0.06)] disabled:opacity-60"
          >
            <span aria-hidden>🔍</span> Search
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setScopeMenuOpen((o) => !o)}
              className="flex h-full min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[14px] border border-[#E9ECEF] bg-white px-3.5 py-2.5 text-xs font-bold shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
              style={{ color: NAVY }}
            >
              📍 {activeScope}
            </button>
            {scopeMenuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-40 cursor-default bg-transparent"
                  onClick={() => setScopeMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-2xl border border-[#E9ECEF] bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
                    Distance
                  </p>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {distanceScopes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScopeAndRefetch(s)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          activeScope === s
                            ? "bg-[#E94560] text-white"
                            : "bg-[#F8F9FA] text-[#6C757D]"
                        }`}
                      >
                        {s.replace("mi", " mi")}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
                    Region
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {regionScopes.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setScopeAndRefetch(key)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          activeScope === key
                            ? "text-white"
                            : "bg-[#F8F9FA] text-[#6C757D]"
                        }`}
                        style={
                          activeScope === key
                            ? { background: NAVY }
                            : undefined
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <p className="mb-2 text-[11px] text-[#6C757D]">
          {searchQuery.trim()
            ? `🔍 Showing ${searchQuery.trim()} near ${userCity} within ${scopeLabelMiles(activeScope)}`
            : `📍 Showing events near ${userCity} within ${scopeLabelMiles(activeScope)}`}
        </p>
        {userCityFromGps ? (
          <p className="mt-0.5 text-[10px] font-medium text-[#E94560]">
            Not your location? Change above ↑
          </p>
        ) : null}
      </div>

      {/* Categories */}
      <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_PILLS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategoryAndRefetch(key)}
            className={`shrink-0 rounded-full border-[1.5px] px-3.5 py-1.5 text-[11px] font-bold ${
              activeCategory === key
                ? "border-[#E94560] bg-[#E94560] text-white"
                : "border-[#E9ECEF] bg-white text-[#6C757D]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Time */}
      <div className="mb-3.5 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TIME_PILLS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTimeAndRefetch(key)}
            className={`shrink-0 rounded-full border border-[#E9ECEF] px-3 py-1.5 text-[11px] font-semibold ${
              activeTime === key
                ? "text-white"
                : "bg-white text-[#6C757D]"
            }`}
            style={activeTime === key ? { background: NAVY } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTime === "pick" ? (
        <div className="mb-3">
          <label className="text-xs font-semibold text-[#6C757D]">
            Pick a date
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="ml-2 rounded-lg border border-[#E9ECEF] px-2 py-1 text-sm"
            />
          </label>
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {feedLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`sk-stat-${i}`}
                className="h-16 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </>
        ) : (
          (
            [
              ["Total events", statsCount.total],
              ["Free events", statsCount.free],
              ["This weekend", statsCount.weekend],
              ["Sources", statsCount.trending],
            ] as const
          ).map(([label, val]) => (
            <div
              key={label}
              className="rounded-xl border border-[#E9ECEF] bg-white px-3 py-2.5 text-center"
            >
              <p className="text-lg font-bold text-[#0F3460]">{val}</p>
              <p className="text-[10px] font-semibold text-[#6C757D]">{label}</p>
            </div>
          ))
        )}
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-[#0F3460]">
            🎪 Events near {userCity}
            {feedLoading ? (
              <>
                <span className="ml-1 inline-block h-4 w-4 align-middle animate-spin rounded-full border-2 border-gray-200 border-t-[#E94560]" />
                <span className="ml-1 text-[13px] font-semibold text-[#6C757D]">
                  Loading...
                </span>
              </>
            ) : (
              <span className="ml-1 text-[13px] font-semibold text-[#6C757D]">
                ({tmEvents.length})
              </span>
            )}
          </h2>
        </div>
        <div className="flex rounded-lg border border-[#E9ECEF] bg-white p-0.5">
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => setViewMode("grid")}
            className={`rounded-md px-2 py-1 text-xs ${
              viewMode === "grid"
                ? "bg-[#E94560] text-white"
                : "text-[#6C757D]"
            }`}
          >
            ⊞
          </button>
          <button
            type="button"
            aria-label="List view"
            onClick={() => setViewMode("list")}
            className={`rounded-md px-2 py-1 text-xs ${
              viewMode === "list"
                ? "bg-[#E94560] text-white"
                : "text-[#6C757D]"
            }`}
          >
            ☰
          </button>
        </div>
      </div>

      {feedLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`sk-tm-${i}`}
              className="h-32 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      ) : eventsSectionEmpty ? (
        <div className="flex flex-col items-center rounded-2xl border border-[#E9ECEF] bg-white py-12 text-center">
          <p className="text-4xl">🎪</p>
          <p className="mt-3 text-lg font-bold text-[#0F3460]">
            No events found near {userCity}
          </p>
          <p className="mt-1 max-w-sm text-sm text-[#6C757D]">
            Try expanding your search radius or changing the time filter
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveScope("100mi");
            }}
            className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: CORAL }}
          >
            Expand to 100 miles
          </button>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTmEvents.map((e) => (
                  <div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedEvent(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setSelectedEvent(e);
                      }
                    }}
                    className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]"
                  >
                    <div
                      className="relative h-[90px] w-full overflow-hidden"
                      style={{ background: cardGradient(e.category) }}
                    >
                      {e.image ? (
                        <img
                          src={e.image}
                          alt=""
                          className="block h-[90px] w-full object-cover"
                          style={{
                            width: "100%",
                            height: "90px",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl">
                          {e.emoji || "🎪"}
                        </div>
                      )}
                      <span
                        className={`absolute left-2 top-2 rounded-[10px] px-2 py-0.5 text-[9px] font-bold text-white ${
                          e.isFree ? "bg-green-600" : ""
                        }`}
                        style={!e.isFree ? { background: CORAL } : undefined}
                      >
                        {e.isFree ? "FREE" : e.price || "—"}
                      </span>
                      <span
                        className="absolute right-2 top-2 rounded-lg px-1.5 py-0.5 text-[8px] font-semibold text-white"
                        style={sourceBadgeStyle(e.source)}
                      >
                        {e.source}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-2.5">
                      <p
                        className="line-clamp-1 text-xs font-bold"
                        style={{ color: NAVY }}
                      >
                        {e.name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#6C757D]">
                        {formatDate(e.date)} {formatTime(e.time || "")}
                      </p>
                      <p className="line-clamp-1 text-[10px] text-[#6C757D]">
                        {e.venue}
                        {e.city ? ` · ${e.city}` : ""}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-1 text-[10px]">
                        <span style={{ color: CORAL }}>{e.price}</span>
                        {userLocation &&
                        e.lat &&
                        e.lon &&
                        (e.lat !== 0 || e.lon !== 0) ? (
                          <span className="text-[#6C757D]">
                            {getDistance(
                              userLocation.lat,
                              userLocation.lon,
                              e.lat,
                              e.lon,
                            )}
                          </span>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleInterested(e.id);
                          }}
                          className={`cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            interestedEvents.includes(e.id)
                              ? "bg-[#e8f8f0] text-[#1a7a4a]"
                              : "text-white"
                          }`}
                          style={
                            interestedEvents.includes(e.id)
                              ? undefined
                              : { background: CORAL }
                          }
                        >
                          {interestedEvents.includes(e.id)
                            ? "✓ You're interested"
                            : "❤️ I'm Interested"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          ) : (
              <div className="flex flex-col gap-2">
                {filteredTmEvents.map((e) => (
                  <div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedEvent(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setSelectedEvent(e);
                      }
                    }}
                    className="flex w-full cursor-pointer gap-3 rounded-[14px] border border-[#E9ECEF] bg-white p-3 text-left shadow-sm"
                  >
                    <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl">
                      {e.image ? (
                        <img
                          src={e.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-2xl"
                          style={{ background: `${CORAL}22` }}
                        >
                          {e.emoji || "🎪"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-bold text-[#0F3460]">
                        {e.name}
                      </p>
                      <p className="text-[10px] text-[#6C757D]">
                        {formatDate(e.date)} · {e.venue}
                      </p>
                      <span
                        className="mt-1 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-white"
                        style={sourceBadgeStyle(e.source)}
                      >
                        {e.source}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end justify-center gap-1">
                      <span className="text-xs font-bold" style={{ color: CORAL }}>
                        {e.price}
                      </span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          toggleInterested(e.id);
                        }}
                        className={`cursor-pointer rounded-full px-2 py-1 text-[10px] font-bold ${
                          interestedEvents.includes(e.id)
                            ? "bg-[#e8f8f0] text-[#1a7a4a]"
                            : "text-white"
                        }`}
                        style={
                          interestedEvents.includes(e.id)
                            ? undefined
                            : { background: CORAL }
                        }
                      >
                        {interestedEvents.includes(e.id)
                          ? "✓ You're interested"
                          : "❤️ I'm Interested"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
          )}
        </>
      )}

      <div className="mb-2 mt-8">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#0F3460]">
            📍 Places near {userCity}
          </h2>
          {feedLoading ? (
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-[#E94560]"
              aria-hidden
            />
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-[#6C757D]">
          Restaurants, parks and attractions in your area
        </p>
      </div>
      {feedLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`sk-pl-${i}`}
              className="mb-2 h-12 animate-pulse rounded-lg bg-gray-100"
            />
          ))}
        </div>
      ) : filteredNearbyPlaces.length === 0 ? (
        <div className="flex min-h-[80px] flex-col items-center justify-center rounded-xl border border-[#E9ECEF] bg-white py-6">
          <p className="text-sm text-[#6C757D]">
            No places found in this area yet
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredNearbyPlaces.map((e) => (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEvent(e)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setSelectedEvent(e);
                }
              }}
              className="flex w-full cursor-pointer flex-wrap items-center gap-3 rounded-[14px] border border-[#E9ECEF] bg-white p-3 text-left shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl">
                {e.emoji || "📍"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold text-[#0F3460]">
                  {e.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-[#F1F3F5] px-1.5 py-0.5 text-[9px] font-bold text-[#0F3460]">
                    {placeTypeLabel(e.category)}
                  </span>
                  <span className="rounded-md bg-green-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Free
                  </span>
                </div>
                {e.opening_hours ? (
                  <p className="mt-1 text-[10px] text-[#6C757D]">
                    {e.opening_hours}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    router.push(
                      `/map?dest=${e.lat},${e.lon}&name=${encodeURIComponent(e.name)}`,
                    );
                  }}
                  className="rounded-lg border border-[#E9ECEF] bg-white px-3 py-1.5 text-[10px] font-bold text-[#0F3460] shadow-sm"
                >
                  🗺️ Map
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trending near you */}
      <h3 className="mb-2 mt-8 text-sm font-bold text-[#0F3460]">
        Trending near you
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!trendingReady ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-tr-${i}`}
                className="h-24 w-[140px] shrink-0 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </>
        ) : (
          trendingDestinations.map((d) => (
            <div
              key={d.id}
              className="w-[140px] shrink-0 rounded-xl border border-[#E9ECEF] bg-white p-3 shadow-sm"
            >
              <p className="text-xl">{d.emoji || "🌍"}</p>
              <p className="mt-1 line-clamp-1 text-xs font-bold text-[#0F3460]">
                {d.name}
              </p>
              <p className="text-[10px] text-[#6C757D]">{d.country}</p>
              <p className="mt-1 text-[10px] font-semibold text-[#E94560]">
                {d.trending_score.toFixed(0)} pts
              </p>
            </div>
          ))
        )}
      </div>

      {holidays.length > 0 ? (
        <p className="mt-4 text-[10px] text-[#6C757D]">
          Upcoming public holidays ({countryCode}):{" "}
          {holidays
            .slice(0, 3)
            .map((h) => h.name)
            .join(" · ")}
        </p>
      ) : null}

      {/* Event detail slide panel */}
      {selectedEvent
        ? (() => {
            const ev = selectedEvent;
            const hasEventCoords =
              ev.lat != null &&
              ev.lon != null &&
              !(ev.lat === 0 && ev.lon === 0);
            const distMi =
              userLocation && hasEventCoords
                ? getDistanceMiles(
                    userLocation.lat,
                    userLocation.lon,
                    ev.lat,
                    ev.lon,
                  )
                : 999;
            const mapDestUrl = `/map?dest=${ev.lat},${ev.lon}&name=${encodeURIComponent(ev.name)}`;

            return (
              <>
                <button
                  type="button"
                  aria-label="Close"
                  className="fixed inset-0 z-[9998]"
                  style={{ background: "rgba(0,0,0,0.6)" }}
                  onClick={() => setSelectedEvent(null)}
                />
                <div className="fixed bottom-0 left-0 right-0 z-[9999] max-h-[90vh] overflow-y-auto rounded-t-[24px] bg-white pb-8 shadow-2xl">
                  <div className="relative">
                    {ev.image ? (
                      <div className="relative h-[200px] w-full">
                        <Image
                          src={ev.image}
                          alt=""
                          fill
                          className="rounded-t-[24px] object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div
                        className="flex h-[150px] items-center justify-center rounded-t-[24px]"
                        style={{ background: cardGradient(ev.category) }}
                      >
                        <span className="text-7xl leading-none">
                          {ev.emoji || "🎪"}
                        </span>
                      </div>
                    )}
                    <div className="absolute right-4 top-4 flex gap-2">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-sm font-bold text-white"
                        aria-label="Share event"
                        onClick={async () => {
                          const text = `Check out ${ev.name} on ${ev.date || "TBD"} at ${ev.venue || ""}`;
                          try {
                            if (navigator.share) {
                              await navigator.share({
                                title: ev.name,
                                text,
                                url: window.location.href,
                              });
                            } else if (navigator.clipboard?.writeText) {
                              await navigator.clipboard.writeText(
                                window.location.href,
                              );
                              showToast("Link copied!", "success");
                            }
                          } catch {
                            /* dismissed or unavailable */
                          }
                        }}
                      >
                        ↗
                      </button>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-lg font-bold text-white"
                        onClick={() => setSelectedEvent(null)}
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="px-5 pt-5">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={sourceBadgeStyle(ev.source)}
                    >
                      {ev.source}
                    </span>

                    <h2 className="mb-2 mt-3 text-xl font-extrabold leading-tight text-[#0F3460]">
                      {ev.name}
                    </h2>

                    <p className="text-[13px] leading-relaxed text-[#2C3E50]">
                      📅 {formatDate(ev.date)}
                      {ev.time ? ` · ${formatTime(ev.time)}` : ""}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#2C3E50]">
                      📍 {ev.venue || "—"}
                      {ev.city ? ` · ${ev.city}` : ""}
                    </p>
                    <p className="mt-1 text-[13px] text-[#2C3E50]">
                      🎭 {ev.category || "Event"}
                    </p>
                    <p
                      className="mt-1 text-[13px] font-semibold"
                      style={{ color: ev.isFree ? "#16a34a" : CORAL }}
                    >
                      💰 {ev.isFree ? "Free" : ev.price || ev.priceDetail || "—"}
                    </p>
                    {userLocation && hasEventCoords ? (
                      <p className="mt-1 text-[13px] text-[#6C757D]">
                        📏{" "}
                        {getDistance(
                          userLocation.lat,
                          userLocation.lon,
                          ev.lat,
                          ev.lon,
                        )}{" "}
                        away
                      </p>
                    ) : null}

                    {interestedEvents.includes(ev.id) ? (
                      <p className="mt-2 text-[13px] font-semibold text-[#1a7a4a]">
                        You&apos;re interested ✓
                      </p>
                    ) : null}

                    {(ev.locationLines?.length ?? 0) > 0 ? (
                      <div className="mt-3 rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
                          Address
                        </p>
                        {ev.locationLines!.map((line, i) => (
                          <p key={`dl-${i}`} className="text-[13px] text-[#0F3460]">
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    {ev.priceDetail || ev.ticketTiers?.length ? (
                      <div className="mt-3 rounded-xl border border-[#E9ECEF] bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
                          Pricing
                        </p>
                        <p className="text-[13px] font-bold text-[#0F3460]">
                          {ev.priceDetail || ev.price}
                        </p>
                        {ev.ticketTiers && ev.ticketTiers.length > 1 ? (
                          <ul className="mt-2 space-y-1 border-t border-[#E9ECEF] pt-2">
                            {ev.ticketTiers.map((t, i) => (
                              <li
                                key={`dt-${i}-${t.name}`}
                                className="flex justify-between gap-2 text-xs text-[#2C3E50]"
                              >
                                <span className="min-w-0 truncate">{t.name}</span>
                                <span className="shrink-0 font-semibold text-[#E94560]">
                                  {t.price}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    {ev.promoText ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">
                          Offers
                        </p>
                        <p className="text-xs text-amber-950">{ev.promoText}</p>
                      </div>
                    ) : null}

                    {ev.description ? (
                      <p className="mt-3 text-[13px] leading-[1.6] text-[#6C757D]">
                        {ev.description}
                      </p>
                    ) : null}

                    <div className="mt-4">
                      <p className="mb-2 text-[13px] font-semibold text-[#0F3460]">
                        Planning to go? Add to a trip:
                      </p>
                      <button
                        type="button"
                        className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white"
                        style={{ background: CORAL }}
                        onClick={() => router.push("/trips")}
                      >
                        ✈️ Add to Trip Plan
                      </button>
                    </div>

                    {ev.pleaseNote ? (
                      <div className="mt-3 rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#6C757D]">
                          Important
                        </p>
                        <p className="text-[13px] leading-relaxed text-[#2C3E50]">
                          {ev.pleaseNote}
                        </p>
                      </div>
                    ) : null}

                    {userLocation && hasEventCoords && distMi < 30 ? (
                      <div className="mt-5">
                        <p className="mb-2 text-sm font-bold text-[#0F3460]">
                          🚗 Getting there (nearby)
                        </p>
                        <button
                          type="button"
                          className="w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white"
                          style={{ background: NAVY }}
                          onClick={() => {
                            router.push(mapDestUrl);
                            setSelectedEvent(null);
                          }}
                        >
                          🗺️ Get Directions in Travello Map
                        </button>
                      </div>
                    ) : null}

                    {userLocation && hasEventCoords && distMi >= 30 && distMi < 200 ? (
                      <div className="mt-5">
                        <p className="mb-2 text-sm font-bold text-[#0F3460]">
                          🚌 Getting there (medium distance)
                        </p>
                        <button
                          type="button"
                          className="w-full rounded-xl px-3 py-3.5 text-xs font-bold text-white"
                          style={{ background: NAVY }}
                          onClick={() => {
                            router.push(mapDestUrl);
                            setSelectedEvent(null);
                          }}
                        >
                          🗺️ Get Directions in Travello Map
                        </button>
                      </div>
                    ) : null}

                    {userLocation && hasEventCoords && distMi >= 200 ? (
                      <div className="mt-5">
                        <p className="mb-2 text-sm font-bold text-[#0F3460]">
                          ✈️ Getting there (long distance)
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            className="rounded-xl px-3 py-3.5 text-xs font-bold text-white"
                            style={{ background: NAVY }}
                            onClick={() => {
                              router.push(mapDestUrl);
                              setSelectedEvent(null);
                            }}
                          >
                            🗺️ View on Travello Map
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border-[1.5px] border-[#0F3460] bg-white px-3 py-3.5 text-xs font-bold text-[#0F3460]"
                            onClick={() => router.push("/trips")}
                          >
                            ✈️ Plan a trip
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-2">
                      <button
                        type="button"
                        className="w-full rounded-xl px-4 py-3.5 text-sm font-bold"
                        style={
                          interestedEvents.includes(ev.id)
                            ? {
                                background: "#e8f8f0",
                                color: "#1a7a4a",
                              }
                            : { background: CORAL, color: "#fff" }
                        }
                        onClick={() => toggleInterested(ev.id)}
                      >
                        {interestedEvents.includes(ev.id)
                          ? "✓ You're interested"
                          : "❤️ I'm Interested"}
                      </button>

                      <button
                        type="button"
                        className="w-full rounded-xl border-[1.5px] border-[#0F3460] bg-white px-4 py-3.5 text-sm font-bold text-[#0F3460]"
                        onClick={() => void saveEventLocationPin(ev)}
                      >
                        📍 Save to Map
                      </button>

                      <button
                        type="button"
                        className="w-full rounded-xl border-[1.5px] border-[#6C757D] bg-white px-4 py-3.5 text-sm font-bold text-[#6C757D]"
                        onClick={() =>
                          showToast(
                            "Tip: After you buy tickets, add the date to your phone calendar.",
                            "info",
                          )
                        }
                      >
                        🗓️ Set Reminder
                      </button>

                      {ev.url ? (
                        showBuyConfirm ? (
                          <div className="rounded-2xl border-[1.5px] border-[#E9ECEF] bg-white p-5 text-center">
                            <p className="text-base font-bold text-[#0F3460]">
                              🎟️ You&apos;re leaving Travello
                            </p>
                            <p className="mt-3 text-[13px] leading-relaxed text-[#2C3E50]">
                              You&apos;ll be taken to Ticketmaster to complete
                              your purchase.
                            </p>
                            <p className="mt-2 text-[13px] leading-relaxed text-[#2C3E50]">
                              Come back after buying to save your ticket!
                            </p>
                            <button
                              type="button"
                              className="mt-4 w-full rounded-[10px] px-3 py-3 text-sm font-bold text-white"
                              style={{ background: CORAL, padding: 12 }}
                              onClick={() => {
                                if (ev.url) {
                                  globalThis.open(ev.url, "_blank");
                                }
                                setShowBuyConfirm(false);
                                showToast(
                                  "Come back after buying! ✓",
                                  "info",
                                );
                              }}
                            >
                              Continue to Ticketmaster
                            </button>
                            <button
                              type="button"
                              className="mt-3 w-full text-sm font-semibold text-[#6C757D]"
                              onClick={() => setShowBuyConfirm(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="w-full rounded-[14px] px-4 py-4 text-base font-extrabold text-white"
                            style={
                              ev.isFree
                                ? {
                                    background:
                                      "linear-gradient(135deg, #22c55e, #15803d)",
                                  }
                                : {
                                    background:
                                      "linear-gradient(135deg, #fb7185, #E94560)",
                                  }
                            }
                            onClick={() => setShowBuyConfirm(true)}
                          >
                            {ev.isFree
                              ? "🎫 Register (Free) →"
                              : "🎟️ Buy Ticket →"}
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            );
          })()
        : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[99999] -translate-x-1/2">
          <div
            className="pointer-events-auto max-w-[min(90vw,420px)] rounded-xl px-5 py-3 text-center text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
            style={{
              animation: "toast-slide-up 0.35s ease-out",
              background:
                toast.type === "success"
                  ? "#2ECC71"
                  : toast.type === "info"
                    ? NAVY
                    : "#E94560",
            }}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      {interestedEvents.length >= 2 ? (
        <div
          className="fixed bottom-5 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-3 rounded-[20px] px-6 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
          style={{ background: NAVY }}
        >
          <span className="text-[13px] font-bold text-white">
            ✈️ {interestedEvents.length} events selected
          </span>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/trips?interested=${encodeURIComponent(interestedEvents.join(","))}`,
              )
            }
            className="rounded-xl px-4 py-2 text-xs font-bold text-white"
            style={{ background: CORAL }}
          >
            Plan this trip →
          </button>
        </div>
      ) : null}
    </div>
  );
}
