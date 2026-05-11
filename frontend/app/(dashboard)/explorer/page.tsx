"use client";

import {
  Megaphone,
  Mic,
  Search,
  MapPin,
  Sun,
  ShieldCheck,
  DollarSign,
  CloudSun,
  Radio,
  TrainFront,
  Mic2,
  ChevronDown,
  ChevronUp,
  Plane,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { EventCard } from "@/components/explorer/EventCard";
import { ExplorerItemDetailDrawer, type ExplorerDrawerItem } from "@/components/explorer/ExplorerItemDetailDrawer";
import { LocationPicker } from "@/components/explorer/LocationPicker";
import { WayraPanel } from "@/components/explorer/WayraPanel";
import { WeatherWidget } from "@/components/explorer/WeatherWidget";
import { ExplorerMediaFeed } from "@/components/explorer/ExplorerMediaFeed";
import { ExplorerHorizontalRail } from "@/components/explorer/ExplorerHorizontalRail";
import { StatsInfoModal, type StatsModalPayload } from "@/components/explorer/StatsInfoModal";
import { ExplorerNewsReaderModal, type NewsReaderArticle } from "@/components/explorer/ExplorerNewsReaderModal";
import { CityTag } from "@/components/shared/CityTag";
import {
  EXPLORER_INTENTS,
  type ExplorerIntentId,
  filterByIntents,
  filterFoodNightlife,
  filterPerfectForGroups,
  cityFlavorTags,
} from "@/lib/explorer-intents";
import WayraIcon from "@/components/ui/WayraIcon";
import { apiFetch } from "@/lib/api";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type TrendItem = {
  id: string;
  title: string;
  description: string;
  venue: string;
  meta: string;
  sourceType: string;
  sourceLabel: string;
  priceLabel: string;
  emoji: string;
  imageUrl?: string | null;
  url?: string;
};

type NewsItem = {
  id: string;
  source: string;
  time: string;
  title: string;
  emoji: string;
  tags: string[];
  url?: string;
  imageUrl?: string;
};

type FeedResponse = {
  events?: unknown[];
  items?: unknown[];
  data?: unknown[];
  results?: unknown[];
};

type NewsResponse = {
  news?: unknown[];
  items?: unknown[];
  articles?: unknown[];
};

type SearchEventCardItem = {
  id: string;
  title: string;
  source: string;
  sourceShort: string;
  sourceType?: string;
  venue: string;
  city: string;
  dateLabel: string;
  distanceLabel: string;
  priceLabel: string;
  isFree: boolean;
  emoji: string;
  imageUrl?: string | null;
  url?: string;
};

const FILTERS = ["All", "Music", "Food", "Art", "Sports", "Nature", "Events", "Hotels"];

type SortMode = "popular" | "newest" | "oldest";
type DateFilterMode = "any" | "today" | "week";

const DEMO_PODCASTS = [
  { id: "pc-1", title: "I Love Chicago", subtitle: "City stories · weekly" },
  { id: "pc-2", title: "The Chicago Podcast", subtitle: "News & culture" },
  { id: "pc-3", title: "Chicago Broadcasting", subtitle: "Talk & interviews" },
  { id: "pc-4", title: "Lakefront Live", subtitle: "Events round-up" },
];

const DEMO_RADIO = [
  { id: "r-1", name: "93.1 FM The Drive", tag: "Classic rock" },
  { id: "r-2", name: "WXRT 93.1", tag: "Adult alternative" },
  { id: "r-3", name: "WBEZ 91.5", tag: "NPR news" },
  { id: "r-4", name: "WGCI 107.5", tag: "Hip-hop & R&B" },
];

function trendToEventCardItem(item: TrendItem, city: string): SearchEventCardItem {
  const datePart = item.meta.split("·")[0]?.trim() || "Upcoming";
  return {
    id: item.id,
    title: item.title,
    source: item.sourceLabel,
    sourceShort: item.sourceLabel,
    sourceType: item.sourceType,
    venue: item.venue,
    city,
    dateLabel: datePart,
    distanceLabel: "Near you",
    priceLabel: item.priceLabel,
    isFree: /free/i.test(item.priceLabel),
    emoji: item.emoji,
    imageUrl: item.imageUrl,
    url: item.url,
  };
}

const DEMO_TRENDS: TrendItem[] = [
  {
    id: "demo-jazz",
    title: "Jazz nights and rooftop music picks",
    description: "Enjoy a relaxing evening with live jazz music and great views.",
    venue: "River North",
    meta: "Tonight · River North",
    sourceType: "google_events",
    sourceLabel: "Google",
    priceLabel: "From $21",
    emoji: "🎷",
  },
  {
    id: "demo-food",
    title: "Best food walks for groups",
    description: "Explore the best local eateries and street food.",
    venue: "West Loop",
    meta: "Today · West Loop",
    sourceType: "eventbrite",
    sourceLabel: "EB",
    priceLabel: "From $35",
    emoji: "🍜",
  },
  {
    id: "demo-free",
    title: "Free park events near downtown",
    description: "Join community events and outdoor activities for free.",
    venue: "Millennium Park",
    meta: "Today · Millennium Park",
    sourceType: "free",
    sourceLabel: "FREE",
    priceLabel: "Free",
    emoji: "🌿",
  },
  {
    id: "demo-sports",
    title: "Cubs watch parties and sports bars",
    description: "Catch the big game with fans and great drinks.",
    venue: "Wrigleyville",
    meta: "This week · Wrigleyville",
    sourceType: "ticketmaster",
    sourceLabel: "TM",
    priceLabel: "From $18",
    emoji: "⚾",
  },
  {
    id: "demo-arts",
    title: "Gallery openings with late entry",
    description: "Discover local art and exclusive exhibits.",
    venue: "River North",
    meta: "Today · River North",
    sourceType: "predicthq",
    sourceLabel: "PHQ",
    priceLabel: "Free",
    emoji: "🎨",
  },
  {
    id: "demo-hotel",
    title: "Hotel lounge events with skyline views",
    description: "Upscale networking and socializing at premier lounges.",
    venue: "Loop",
    meta: "Tonight · Loop",
    sourceType: "google_places",
    sourceLabel: "Google",
    priceLabel: "Varies",
    emoji: "🏨",
  },
];

const DEMO_NEWS: NewsItem[] = [
  {
    id: "news-1",
    source: "City Pulse",
    time: "Just now",
    title: "Perfect 72°F weather for a rooftop bar! Great for groups.",
    emoji: "☀️",
    tags: ["Weather", "Actionable"],
  },
  {
    id: "news-2",
    source: "Time Out",
    time: "1h ago",
    title: "Chicago jazz rooms are adding more late-night group-friendly shows",
    emoji: "🎷",
    tags: ["Music", "Group Vibe"],
  },
  {
    id: "news-3",
    source: "Alert",
    time: "2h ago",
    title: "Rain expected later – grab an indoor reservation for your crew early.",
    emoji: "🌧️",
    tags: ["Weather", "Alert"],
  },
  {
    id: "news-4",
    source: "Local Sports",
    time: "4h ago",
    title: "Sports watch parties trend near Wrigleyville and River North",
    emoji: "⚾",
    tags: ["Sports", "Groups"],
  },
  {
    id: "news-5",
    source: "Travel Desk",
    time: "5h ago",
    title: "Weekend visitors are booking more low-cost culture and gallery stops",
    emoji: "🎨",
    tags: ["Travel", "Events"],
  },
];

function getRows(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "object" || value == null) return [];
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const rows = record[key];
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

const RAIL_PREVIEW = 6;
const NEWS_PREVIEW = 6;

function dedupeTrends(items: TrendItem[]): TrendItem[] {
  const seen = new Set<string>();
  const out: TrendItem[] = [];
  for (const t of items) {
    const k = `${t.title.toLowerCase().replace(/\s+/g, " ").slice(0, 120)}|${t.venue.toLowerCase().replace(/\s+/g, " ").slice(0, 80)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Heuristic: keyboard mash, excessive symbols, or unreadable token soup → hand off to Wayra. */
function looksGarbledQuery(s: string): boolean {
  const t = s.trim();
  if (t.length < 3) return false;
  const letters = t.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 2 && t.length > 8) return true;
  const nonWord = (t.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (t.length > 0 && nonWord / t.length > 0.38) return true;
  if (/(.)\1{4,}/.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 4 && letters.length >= 8 && ![..."aeiouyAEIOUY"].some((v) => letters.includes(v))) return true;
  return false;
}

/** Forward geocode a city label for the live Explorer feed (Nominatim). */
async function nominatimCityLatLon(city: string): Promise<{ lat: number; lon: number; countryCode?: string } | null> {
  const q = city.trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat?: string; lon?: string; address?: { country_code?: string } }>;
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit?.lat || !hit?.lon) return null;
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon, countryCode: hit.address?.country_code?.toUpperCase() };
}

function firstHttpLinkFromRecord(links: unknown): string {
  if (!links || typeof links !== "object") return "";
  for (const v of Object.values(links as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim().toLowerCase().startsWith("http")) return v.trim();
  }
  return "";
}

function textField(row: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function emojiFor(text: string): string {
  const low = text.toLowerCase();
  if (low.includes("food") || low.includes("restaurant")) return "🍜";
  if (low.includes("hotel")) return "🏨";
  if (low.includes("sport") || low.includes("game")) return "⚾";
  if (low.includes("art") || low.includes("museum")) return "🎨";
  if (low.includes("park") || low.includes("nature")) return "🌿";
  return "🎵";
}

function normalizeTrend(row: unknown, index: number, city: string): TrendItem {
  const record = typeof row === "object" && row != null ? (row as Record<string, unknown>) : {};
  const sourceType = textField(record, ["source_name", "source_type", "sourceType", "source"], "google_events");
  const sourceLabel =
    sourceType === "google_events" || sourceType === "dataforseo"
      ? "Google"
      : sourceType === "google_places"
        ? "Google"
        : sourceType === "eventbrite"
          ? "EB"
          : sourceType === "ticketmaster"
            ? "TM"
          : sourceType === "geoapify"
            ? "Places"
          : sourceType === "foursquare"
            ? "4SQ"
            : sourceType === "predicthq"
              ? "PHQ"
              : "FREE";
  const title = textField(record, ["title", "name"], "Trending plan near you");

  let venue = textField(record, ["venue_name", "venue"], "");
  if (!venue && record.location && typeof record.location === "object") {
    venue = textField(record.location as Record<string, unknown>, ["name"], "");
  }
  if (!venue) venue = textField(record, ["city"], city);

  let dateStr = textField(record, ["date_str", "dateLabel", "date", "datetime"], "");
  if (!dateStr && record.start_time) {
    const d = new Date(String(record.start_time));
    dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : "Upcoming";
  }
  if (!dateStr && record.datetime) {
    const d = new Date(String(record.datetime));
    dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : "";
  }

  const images = record.images;
  let thumb = textField(record, ["image_url", "thumbnail"], "");
  if (!thumb && Array.isArray(images) && images.length && typeof images[0] === "string") {
    thumb = images[0];
  }

  const url =
    textField(record, ["booking_url", "url", "link", "external_url"], "") || firstHttpLinkFromRecord(record.links);

  const isFree = record.is_free === true || String(record.is_free).toLowerCase() === "true";
  let priceLabel = textField(record, ["priceLabel", "price", "price_from"], "");
  if (!priceLabel || priceLabel === "true" || priceLabel === "false") {
    priceLabel = isFree ? "Free" : (priceLabel || "See listing");
  }

  return {
    id: textField(record, ["external_id", "id"], `trend-${index}`),
    title,
    description: textField(record, ["description"], "Trending plan near you"),
    venue,
    meta: `${dateStr || "Today"} · ${venue}`,
    sourceType,
    sourceLabel,
    priceLabel,
    emoji: textField(record, ["emoji"], emojiFor(title)),
    imageUrl: thumb || null,
    url,
  };
}

function normalizeNews(row: unknown, index: number): NewsItem {
  const record = typeof row === "object" && row != null ? (row as Record<string, unknown>) : {};
  const snippet = textField(record, ["snippet", "subtitle", "lead"], "").trim();
  const title =
    textField(record, ["title", "name", "headline"], "").trim() ||
    (snippet ? snippet.slice(0, 140) : "Travel update for your city");
  const tags = Array.isArray(record.tags) ? record.tags.map(String).slice(0, 3) : ["Travel", "Events"];
  return {
    id: textField(record, ["id"], `news-${index}`),
    source: textField(record, ["source", "source_name", "domain"], "Travello"),
    time:
      textField(record, ["time", "published_ago", "publishedAt", "published_at"], "") ||
      textField(record, ["description"], "").slice(0, 52) ||
      "Today",
    title,
    emoji: textField(record, ["emoji"], emojiFor(title)),
    tags,
    url: textField(record, ["url", "link"], "#"),
    imageUrl: textField(record, ["image", "thumbnail", "image_url", "poster"], ""),
  };
}

function tagClass(tag: string): string {
  const low = tag.toLowerCase();
  if (low.includes("jazz") || low.includes("music")) return "bg-rose-500/15 text-rose-300";
  if (low.includes("food")) return "bg-orange-500/15 text-orange-300";
  if (low.includes("free")) return "bg-emerald-500/15 text-emerald-300";
  if (low.includes("travel")) return "bg-blue-500/15 text-blue-300";
  if (low.includes("sport")) return "bg-emerald-500/15 text-emerald-300";
  if (low.includes("event")) return "bg-purple-500/15 text-purple-300";
  return "bg-white/10 text-gray-300";
}

export default function ExplorerPage() {
  const router = useRouter();
  const [currentCity, setCurrentCity] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEventCardItem[]>([]);
  const [searchSource, setSearchSource] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [wayraSuggestion, setWayraSuggestion] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState("");
  const [categorySelect, setCategorySelect] = useState("All");
  const [dateFilter, setDateFilter] = useState<DateFilterMode>("any");
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [activeIntents, setActiveIntents] = useState<ExplorerIntentId[]>([]);
  const [cultureOpen, setCultureOpen] = useState(false);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [toast, setToast] = useState("");
  const [listening, setListening] = useState(false);
  const [wayraOpen, setWayraOpen] = useState(false);
  const [wayraSeed, setWayraSeed] = useState<string | null>(null);
  const [weatherAlertOpen, setWeatherAlertOpen] = useState(false);
  const [timeContext, setTimeContext] = useState("today");
  const [requestingLocation, setRequestingLocation] = useState(true);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<ExplorerDrawerItem | null>(null);
  const [seeAllModalOpen, setSeeAllModalOpen] = useState(false);
  const [seeAllTitle, setSeeAllTitle] = useState("");
  const [seeAllData, setSeeAllData] = useState<TrendItem[]>([]);
  const [stats, setStats] = useState<{
    weather: { temp: number; condition: string } | null;
    safety: { score?: number } | null;
    currency: { rate: number; code: string } | null;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [podcasts, setPodcasts] = useState<{ id: string; title: string; subtitle: string; url: string; imageUrl: string }[]>([]);
  const [radioStations, setRadioStations] = useState<{ id: string; name: string; tag: string; url: string; imageUrl: string }[]>([]);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [seeAllNewsData, setSeeAllNewsData] = useState<NewsItem[]>([]);
  const [statsModal, setStatsModal] = useState<StatsModalPayload | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState<NewsReaderArticle | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (currentCity) {
      localStorage.setItem("explorer_saved_city", currentCity);
    }
  }, [currentCity]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 11) setTimeContext("this morning");
    else if (hour < 16) setTimeContext("this afternoon");
    else if (hour < 20) setTimeContext("this evening");
    else setTimeContext("tonight");

    const savedCity = localStorage.getItem("explorer_saved_city");
    if (savedCity) {
      setCurrentCity(savedCity);
      setRequestingLocation(false);
      return;
    }

    if (!navigator.geolocation) {
      setRequestingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "Chicago";
          setCurrentCity(city);
        } catch {
          setRequestingLocation(false);
        } finally {
          setRequestingLocation(false);
        }
      },
      () => {
        setRequestingLocation(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!currentCity) return;
    const ac = new AbortController();
    void (async () => {
      setLoadingStats(true);
      try {
        const coords = await nominatimCityLatLon(currentCity);
        const lat = coords ? coords.lat : 41.8781;
        const lon = coords ? coords.lon : -87.6298;
        const countryCode = coords?.countryCode ?? "US";
        
        // Parallel fetch for stats
        const settled = await Promise.allSettled([
          apiFetch<{ safety: { score?: number } | null }>(
            `/explore/safety?country=${countryCode}&city=${encodeURIComponent(currentCity)}`,
            { signal: ac.signal },
          ),
          apiFetch<{
            currency: {
              rates?: Record<string, number>;
              local_currency?: string;
              rate_per_usd?: number;
            };
          }>(`/explore/currency?country=${countryCode}`, { signal: ac.signal }),
          apiFetch<{ weather: { current_weather: { temperature: number; weathercode: number } } }>(`/explore/weather?lat=${lat}&lon=${lon}&city=${encodeURIComponent(currentCity)}`, { signal: ac.signal }),
        ]);

        const sRes = settled[0].status === "fulfilled" ? settled[0].value : null;
        const cRes = settled[1].status === "fulfilled" ? settled[1].value : null;
        const wRes = settled[2].status === "fulfilled" ? settled[2].value : null;

        const weatherIcon = (code: number) => {
          if (code === 0) return "Clear";
          if (code <= 3) return "Partly Cloudy";
          return "Cloudy";
        };

        const rawCur = cRes?.currency;
        const rates =
          rawCur?.rates &&
          typeof rawCur.rates === "object" &&
          rawCur.rates !== null
            ? (rawCur.rates as Record<string, number>)
            : undefined;
        const iso = (rawCur?.local_currency ?? "").trim().toUpperCase();
        let fx: number | null =
          typeof rawCur?.rate_per_usd === "number" && !Number.isNaN(rawCur.rate_per_usd)
            ? rawCur.rate_per_usd
            : null;
        if ((fx === null || Number.isNaN(fx)) && rates && iso.length === 3) {
          const v = rates[iso];
          if (typeof v === "number" && !Number.isNaN(v)) fx = v;
        }

        setStats({
          safety: sRes?.safety ?? null,
          currency:
            iso.length === 3 && fx !== null && !Number.isNaN(fx) ? { rate: fx, code: iso } : null,
          weather: wRes?.weather ? { 
            temp: wRes.weather.current_weather.temperature, 
            condition: weatherIcon(wRes.weather.current_weather.weathercode) 
          } : null,
        });
      } catch {
        setStats(null);
      } finally {
        setLoadingStats(false);
      }
    })();
    return () => ac.abort();
  }, [currentCity]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const loadExplorer = useCallback(async () => {
    if (!currentCity) return;
    setLoadingTrends(true);
    setLoadingNews(true);
    setNewsExpanded(false);

    const coords = await nominatimCityLatLon(currentCity);
    const cityEnc = encodeURIComponent(currentCity);

    const settled = await Promise.allSettled([
      coords
        ? apiFetch<unknown>(
            `/explorer/live-feed?lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lon))}&radius=10000`,
          )
        : Promise.resolve(null),
      apiFetch<FeedResponse>(`/explorer/feed?city=${cityEnc}`).catch(() => null),
      apiFetch<{ events?: unknown[] }>(`/explore/google-events?city=${cityEnc}`).catch(() => null),
      apiFetch<{ places?: unknown[] }>(`/explore/places?city=${cityEnc}&category=attractions`).catch(() => null),
      apiFetch<{ places?: unknown[] }>(`/explore/places?city=${cityEnc}&category=restaurants`).catch(() => null),
    ]);

    const buckets: unknown[] = [];
    const attachPlaces = (rows: unknown[]) =>
      rows.map((r) =>
        typeof r === "object" && r !== null
          ? { ...(r as Record<string, unknown>), source_type: "google_places" }
          : r,
      );

    const liveVal = settled[0].status === "fulfilled" ? settled[0].value : null;
    if (liveVal != null) {
      if (Array.isArray(liveVal)) buckets.push(...liveVal);
      else buckets.push(...getRows(liveVal, ["events", "items", "data", "results"]));
    }

    const feedVal = settled[1].status === "fulfilled" ? settled[1].value : null;
    if (feedVal) buckets.push(...getRows(feedVal, ["events", "items", "data", "results"]));

    const googleEv = settled[2].status === "fulfilled" ? settled[2].value : null;
    if (googleEv) buckets.push(...getRows(googleEv, ["events"]));

    const attr = settled[3].status === "fulfilled" ? settled[3].value : null;
    if (attr) buckets.push(...attachPlaces(getRows(attr, ["places"])));

    const rests = settled[4].status === "fulfilled" ? settled[4].value : null;
    if (rests) buckets.push(...attachPlaces(getRows(rests, ["places"])));

    const normalized = dedupeTrends(
      buckets.map((item, index) => normalizeTrend(item, index, currentCity)),
    );
    setTrends(normalized.length ? normalized : DEMO_TRENDS);
    setLoadingTrends(false);

    try {
      const newsRes = await apiFetch<{ news?: unknown[] }>(`/explore?city=${cityEnc}`);
      const rawNews = getRows(newsRes, ["news", "articles", "items"]);
      const normalizedNews = rawNews.map(normalizeNews);
      setNews(normalizedNews.length ? normalizedNews : DEMO_NEWS);
    } catch {
      setNews(DEMO_NEWS);
    }
    setLoadingNews(false);

    // Fetch Podcasts (Free Apple API)
    try {
      const pRes = await fetch(`https://itunes.apple.com/search?term=${cityEnc}+podcast&media=podcast&limit=5`);
      const pData = await pRes.json();
      const mappedPodcasts = (pData.results || []).map((r: any) => ({
        id: String(r.collectionId),
        title: r.collectionName || r.trackName,
        subtitle: r.artistName || "Podcast",
        url: r.collectionViewUrl || r.trackViewUrl || "#",
        imageUrl: r.artworkUrl100 || r.artworkUrl600 || "",
      }));
      setPodcasts(mappedPodcasts.length ? mappedPodcasts : [
        { id: "1", title: `${currentCity} Daily`, subtitle: "Local updates", url: "#", imageUrl: "" },
        { id: "2", title: "City Guide", subtitle: "Travel tips", url: "#", imageUrl: "" },
      ]);
    } catch {
      setPodcasts([
        { id: "1", title: `${currentCity} Daily`, subtitle: "Local updates", url: "#", imageUrl: "" },
        { id: "2", title: "City Guide", subtitle: "Travel tips", url: "#", imageUrl: "" },
      ]);
    }

    // Fetch Radio (Free Radio Browser API)
    try {
      const rRes = await fetch(`https://de1.api.radio-browser.info/json/stations/search?name=${cityEnc}&limit=5`);
      const rData = await rRes.json();
      const mappedRadio = (rData || []).map((r: any) => ({
        id: r.stationuuid,
        name: r.name,
        tag: r.tags?.split(",")[0] || "Live",
        url: r.url_resolved || r.url || "#",
        imageUrl: r.favicon || "",
      }));
      setRadioStations(mappedRadio.length ? mappedRadio : [
        { id: "1", name: `${currentCity} FM`, tag: "Local Radio", url: "#", imageUrl: "" },
        { id: "2", name: "The Pulse", tag: "Music", url: "#", imageUrl: "" },
      ]);
    } catch {
      setRadioStations([
        { id: "1", name: `${currentCity} FM`, tag: "Local Radio", url: "#", imageUrl: "" },
        { id: "2", name: "The Pulse", tag: "Music", url: "#", imageUrl: "" },
      ]);
    }
  }, [currentCity]);

  useEffect(() => {
    setSearchResults([]);
    setSearchSource("");
    setSearchLoading(false);
    setWayraSuggestion(null);
    setActiveSearch("");
    void loadExplorer();
  }, [loadExplorer]);

  const submitSearch = useCallback(async () => {
    const clean = query.trim();
    if (!clean || !currentCity) return;
    if (looksGarbledQuery(clean)) {
      setWayraSeed(clean);
      setWayraOpen(true);
      return;
    }
    setSearchLoading(true);
    setActiveSearch(clean);
    setWayraSuggestion(null);
    try {
      const res = await apiFetch<FeedResponse>(
        `/explorer/feed?city=${encodeURIComponent(currentCity)}&q=${encodeURIComponent(clean)}`,
      );
      const rows = getRows(res, ["events", "items", "data", "results"]);
      const mapped = rows.map((item, index) =>
        trendToEventCardItem(normalizeTrend(item, index, currentCity), currentCity),
      );
      setSearchResults(mapped);
      setSearchSource(textField(res as Record<string, unknown>, ["source"], "mixed"));
    } catch {
      setSearchResults([]);
      setSearchSource("");
      showToast("Search failed — try again");
    } finally {
      setSearchLoading(false);
    }
  }, [query, currentCity, showToast]);

  const clearSearch = () => {
    setQuery("");
    setSearchResults([]);
    setSearchSource("");
    setSearchLoading(false);
    setWayraSuggestion(null);
    setActiveSearch("");
  };

  const startVoice = () => {
    const w = window as SpeechRecognitionWindow;
    const SpeechRecognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setListening(false);
      showToast("Voice not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setQuery(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const baseFilteredTrends = useMemo(() => {
    let list = filterByIntents([...trends], activeIntents);
    if (categorySelect !== "All") {
      const q = categorySelect.toLowerCase();
      list = list.filter((item) =>
        `${item.title} ${item.meta} ${item.description}`.toLowerCase().includes(q),
      );
    }
    if (dateFilter === "today") {
      list = list.filter(
        (item) =>
          /\btoday\b|\btonight\b/i.test(item.meta) ||
          /\bmorning\b|\bafternoon\b|\bevening\b/i.test(item.meta),
      );
    }
    if (dateFilter === "week") {
      list = list.filter((item) => /\bweek\b/i.test(item.meta));
    }

    if (sortMode === "newest") list = [...list].reverse();
    if (sortMode === "oldest") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [trends, activeIntents, categorySelect, dateFilter, sortMode]);

  const filtersActive =
    activeIntents.length > 0 ||
    categorySelect !== "All" ||
    dateFilter !== "any" ||
    sortMode !== "popular";

  const pool = baseFilteredTrends;

  const filterEmptyMessage =
    !loadingTrends && trends.length > 0 && baseFilteredTrends.length === 0 && filtersActive
      ? "Nothing matches these filters. Clear intents or widen category / date."
      : "";

  const perfectForGroupsList = useMemo(() => {
    const src = filtersActive && pool.length === 0 ? [] : pool.length ? pool : trends;
    return filterPerfectForGroups(src);
  }, [pool, trends, filtersActive]);

  const trendingTonightList = useMemo(() => {
    const hot = pool.filter(
      (t) =>
        /\btonight\b|\btoday\b/i.test(t.meta) ||
        /\btonight\b/i.test(t.title) ||
        /\bpopular\b|\btrending\b/i.test(`${t.title} ${t.description}`),
    );
    const src = hot.length >= 3 ? hot : pool;
    return src;
  }, [pool]);

  const foodNightlifeList = useMemo(() => filterFoodNightlife(pool), [pool]);

  const eventsTeaserList = useMemo(() => pool, [pool]);

  const weekendIdeasList = useMemo(
    () => pool.filter((t) => /\bweekend\b|\bsat\b|\bsun\b|\bfriday\b/i.test(`${t.meta} ${t.title}`)),
    [pool],
  );

  const attractionPicks = useMemo(() => {
    const scenic = pool.filter((t) =>
      /park|museum|architecture|walk|river|millennium|zoo|tower|deck|tour|balloon|center|food|cafe|restaurant|snack/i.test(
        `${t.title} ${t.venue}`,
      ),
    );
    return scenic.length >= 3 ? scenic : pool;
  }, [pool]);

  const toggleIntent = (id: ExplorerIntentId) => {
    setActiveIntents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const consumeWayraSeed = useCallback(() => setWayraSeed(null), []);

  const openTrendDrawer = (item: TrendItem) => {
    setSelectedDrawerItem({
      id: item.id,
      title: item.title,
      source: item.sourceLabel,
      venue: item.venue,
      city: currentCity,
      dateLabel: item.meta.split("·")[0] || "Upcoming",
      priceLabel: item.priceLabel,
      description: item.description,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
      sourceUrl:
        item.url ||
        `https://www.stubhub.com/search/?q=${encodeURIComponent(item.title + " " + currentCity)}`,
    });
  };

  const groupAct = (verb: string) => () => showToast(`${verb} — link a trip to save this to your group workflow`);

  return (
    <div className="relative min-h-full bg-[#0B192E] text-gray-300">
      <section className="border-b border-[#1e4976]/30 bg-[#0d1f33]/60 backdrop-blur-md px-4 py-4 lg:px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3 max-w-[1920px] mx-auto">
          <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-xl border border-[#1e4976]/60 bg-[#071221]/80 focus-within:border-[#E94560]/60 transition-all">
            <Search size={16} className="ml-3 shrink-0 text-gray-400" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
              placeholder="Search events, places, activities near you..."
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => submitSearch()}
              className="h-7 border-l border-[#1e4976]/40 px-4 text-sm font-semibold text-[#E94560] hover:text-white transition"
            >
              Search
            </button>
          </div>
          <button
            type="button"
            onClick={startVoice}
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-[#071221]/80 transition-all",
              listening ? "border-[#E94560] text-[#E94560] animate-pulse" : "border-[#1e4976]/60 text-gray-400 hover:border-[#E94560]/40 hover:text-white",
            ].join(" ")}
            aria-label="Voice search"
          >
            <Mic size={16} />
          </button>
          <LocationPicker currentCity={currentCity} onCityChange={setCurrentCity} />
        </div>
      </section>

      {requestingLocation ? (
        <main className="flex flex-col items-center justify-center px-5 py-32 text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#E94560] border-t-transparent"></div>
          <p className="font-medium text-white">Getting your location...</p>
        </main>
      ) : !currentCity ? (
        <main className="flex flex-col items-center justify-center px-5 py-32 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0d1f33] ring-1 ring-[#1e4976]">
            <MapPin size={24} className="text-[#E94560]" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">Explore Your City</h2>
          <p className="mb-6 max-w-md text-sm text-gray-300">
            Please allow GPS permissions to discover trending events and activities near you, or select a city manually from the top right.
          </p>
          <button 
            type="button"
            onClick={() => {
              const locationInput = document.querySelector('input[placeholder="Chicago"]') as HTMLElement;
              locationInput?.focus();
            }}
            className="rounded-full bg-[#E94560] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#d63851]"
          >
            Select a Location
          </button>
        </main>
      ) : (
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{currentCity}</h1>
                  {stats?.weather && (
                    <button
                      type="button"
                      onClick={() => setWeatherAlertOpen(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-300 transition hover:text-white bg-[#0d1f33]/60 px-3 py-1 rounded-full border border-[#1e4976]/40"
                    >
                      <CloudSun className="h-4 w-4 text-amber-300" />
                      <span>{stats.weather.temp}°C — {stats.weather.condition}</span>
                    </button>
                  )}
                </div>
                
                {cityFlavorTags(currentCity).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cityFlavorTags(currentCity).map((tag) => (
                      <span
                        key={tag.label}
                        className="rounded-full border border-[#1e4976]/40 bg-[#0d1f33]/40 px-3 py-0.5 text-xs text-gray-400"
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              
              <span
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1e4976]/60 bg-[#0d1f33]/60 text-[#E94560] shadow-lg backdrop-blur-sm"
                title="Explore"
                aria-hidden
              >
                <Plane className="h-5 w-5" strokeWidth={1.5} />
              </span>
            </div>
          </header>

          {/* Navigation section for mobile */}
          <nav
            className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Explorer sections"
          >
            {[
              ["#perfect-groups", "Groups"],
              ["#trending-tonight", "Tonight"],
              ["#food-nightlife", "Food"],
              ["#top-events", "Events"],
              ["#local-news", "News"],
              ["#explorer-culture", "Culture"],
              ["#transport", "Transit"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="shrink-0 rounded-full border border-[#1e4976]/60 bg-[#0d1f33]/60 px-4 py-1.5 text-xs font-medium text-white/85 hover:border-[#E94560]/40 transition"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Intents Section - Now following the One-Row Rule */}
          <section className="mb-6" aria-label="Trip intents">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Tonight &amp; your crew
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-color:#1e4976_#0B192E] [scrollbar-width:thin]">
              {EXPLORER_INTENTS.map((intent) => (
                <button
                  key={intent.id}
                  type="button"
                  title={intent.hint}
                  onClick={() => toggleIntent(intent.id)}
                  className={[
                    "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition",
                    activeIntents.includes(intent.id)
                      ? "border-[#E94560] bg-[#E94560] text-white shadow-lg shadow-[#E94560]/20"
                      : "border-[#1e4976]/60 bg-[#0d1f33]/60 text-gray-400 hover:border-[#E94560]/40 hover:text-white",
                  ].join(" ")}
                >
                  {intent.label}
                </button>
              ))}
            </div>
          </section>

          {/* Filter Bar Redesign */}
          <section
            className="mb-8 w-full overflow-hidden rounded-2xl border border-[#1e4976]/40 bg-[#0d1f33]/40 px-4 py-3 backdrop-blur-sm"
            aria-label="Filters"
          >
            <div className="flex items-center gap-3 overflow-x-auto pb-1 [scrollbar-color:#1e4976_#0B192E] [scrollbar-width:thin]">
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  filtersActive ? "bg-[#E94560] text-white" : "bg-[#071221] text-gray-500"
                }`}
              >
                {filtersActive ? "Filter On" : "Off"}
              </span>
              {activeIntents.length ? (
                <button
                  type="button"
                  onClick={() => setActiveIntents([])}
                  className="shrink-0 text-xs font-semibold text-[#E94560] hover:text-white hover:underline transition"
                >
                  Clear intents
                </button>
              ) : null}
              
              <span className="shrink-0 pl-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Category
              </span>
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setCategorySelect(f)}
                  className={[
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                    categorySelect === f
                      ? "border-[#E94560] bg-[#E94560] text-white shadow-lg shadow-[#E94560]/20"
                      : "border-[#1e4976]/40 bg-[#071221]/60 text-gray-400 hover:border-[#E94560]/35 hover:text-white",
                  ].join(" ")}
                >
                  {f}
                </button>
              ))}
              
              <span className="shrink-0 pl-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                When
              </span>
              {(
                [
                  ["any", "Any time"],
                  ["today", "Today"],
                  ["week", "This week"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDateFilter(key)}
                  className={[
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                    dateFilter === key
                      ? "border-[#E94560] bg-[#E94560] text-white shadow-lg shadow-[#E94560]/20"
                      : "border-[#1e4976]/40 bg-[#071221]/60 text-gray-400 hover:border-[#E94560]/35 hover:text-white",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
              
              <span className="shrink-0 pl-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Sort
              </span>
              {(
                [
                  ["popular", "Popular"],
                  ["newest", "Newest"],
                  ["oldest", "Oldest"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortMode(key)}
                  className={[
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                    sortMode === key
                      ? "border-[#E94560] bg-[#E94560] text-white shadow-lg shadow-[#E94560]/20"
                      : "border-[#1e4976]/40 bg-[#071221]/60 text-gray-400 hover:border-[#E94560]/35 hover:text-white",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Stats Bar Redesign */}
          {currentCity ? (
            <div className="mb-10 flex h-14 w-full items-stretch overflow-hidden rounded-2xl border border-[#1e4976]/40 bg-[#0d1f33]/40 text-sm font-medium text-white backdrop-blur-sm">
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2 border-r border-[#1e4976]/30 px-3">
                <Sun className="h-4 w-4 shrink-0 text-amber-300" />
                {!stats && loadingStats ? (
                  <span className="text-gray-500">…</span>
                ) : stats?.weather ? (
                  <span className="text-xs sm:text-sm">
                    {stats.weather.temp}°C · {stats.weather.condition}
                  </span>
                ) : (
                  <span className="text-gray-500 text-xs sm:text-sm">Weather —</span>
                )}
              </div>
              <button
                type="button"
                title="View safety & crime index for this city"
                onClick={() =>
                  setStatsModal({
                    type: "safety",
                    city: currentCity,
                    score: typeof stats?.safety?.score === "number" ? stats.safety.score : null,
                  })
                }
                className="flex min-w-0 flex-1 items-center justify-center gap-2 border-r border-[#1e4976]/30 px-3 hover:bg-emerald-500/10 transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                {(stats?.safety != null && typeof stats.safety.score === "number") || stats?.safety === null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                    Safety {stats?.safety?.score ?? 2.5}/5
                  </span>
                ) : loadingStats ? (
                  <span className="text-gray-500">…</span>
                ) : (
                  <span className="text-gray-500 text-xs sm:text-sm">Safety ↗</span>
                )}
              </button>
              <button
                type="button"
                title="Open live currency converter"
                onClick={() =>
                  setStatsModal({
                    type: "currency",
                    fromCode: "USD",
                    toCode: stats?.currency?.code || "EUR",
                    rate: stats?.currency?.rate ?? null,
                  })
                }
                className="flex min-w-0 flex-1 items-center justify-center gap-2 px-3 hover:bg-blue-500/10 transition-colors cursor-pointer"
              >
                <DollarSign className="h-4 w-4 shrink-0 text-blue-300" />
                {stats?.currency ? (
                  <span className="truncate text-xs sm:text-sm">
                    {stats.currency.code === "USD" ? (
                      <>USD locally (no fx)</>
                    ) : (
                      <>1 USD = {stats.currency.rate.toFixed(2)} {stats.currency.code}</>
                    )}
                  </span>
                ) : loadingStats ? (
                  <span className="text-gray-500">…</span>
                ) : (
                  <span className="text-gray-500 text-xs sm:text-sm">Currency ↗</span>
                )}
              </button>
            </div>
          ) : null}

            {filterEmptyMessage ? (
              <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {filterEmptyMessage}
              </div>
            ) : null}

            {searchLoading || searchResults.length > 0 || (wayraSuggestion && !wayraOpen) ? (
              <section className="mb-8">
                {searchLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-[260px] animate-pulse rounded-xl border border-[#1e4976] bg-[#0d1f33]/80" />
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <div className="mb-2.5 flex items-center gap-2">
                      <h2 className="text-sm font-medium text-white">Results for &apos;{activeSearch}&apos;</h2>
                      <SearchSourceBadge source={searchSource} />
                      <button type="button" onClick={clearSearch} className="ml-auto text-xs text-[#E94560]">
                        Clear
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {searchResults.map((item) => (
                        <EventCard 
                          key={item.id} 
                          event={item} 
                          view="grid" 
                          onOpen={() => setSelectedDrawerItem({
                            id: item.id,
                            title: item.title,
                            source: item.sourceShort,
                            venue: item.venue,
                            city: item.city,
                            dateLabel: item.dateLabel,
                            priceLabel: item.priceLabel,
                            description: "",
                            emoji: item.emoji,
                            imageUrl: item.imageUrl,
                            sourceUrl: item.url || `https://www.stubhub.com/search/?q=${encodeURIComponent(item.title + ' ' + item.city)}`,
                          })} 
                        />
                      ))}
                    </div>
                  </>
                ) : wayraSuggestion && !wayraOpen ? (
                  <div className="rounded-xl border border-[#1e4976] bg-[#0d1f33] p-4">
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex shrink-0 items-start justify-center">
                        <WayraIcon state="flying" size={0.5} variant="fog" animate={false} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-300">{wayraSuggestion}</p>
                        <button
                          type="button"
                          onClick={() => setWayraOpen(true)}
                          className="mt-3 rounded-full bg-[#E94560] px-4 py-2 text-xs font-medium text-white"
                        >
                          Ask Wayra
                        </button>
                      </div>
                      <button type="button" onClick={clearSearch} className="text-xs text-[#E94560]">
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <hr className="my-8 border-[#1e4976]/30" />

            <section className="mb-12" aria-label="Travel shorts">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-white">Travel Shorts</h2>
                <Link
                  href={`/explore/shorts?city=${encodeURIComponent(currentCity)}`}
                  className="text-xs font-medium text-[#E94560] hover:underline"
                >
                  See all
                </Link>
              </div>
              <ExplorerMediaFeed city={currentCity} hideNews embedded hideGrid className="" />
            </section>

            <section id="perfect-groups" className="mb-12 scroll-mt-28">
              <ExplorerHorizontalRail
                title="Perfect for groups"
                subtitle="Room for the whole crew — shared tables, games, and easy logistics"
                rightSlot={
                  <Link
                    href={`/explore/${encodeURIComponent(currentCity)}/events`}
                    className="text-xs font-semibold text-[#E94560] hover:underline"
                  >
                    See all
                  </Link>
                }
              >
                {loadingTrends ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[280px] min-w-[240px] animate-pulse rounded-xl border border-[#1e4976] bg-[#0d1f33]/80" />
                  ))
                ) : perfectForGroupsList.length ? (
                  perfectForGroupsList.map((item) => (
                    <div key={item.id} className="min-w-[260px] max-w-[260px]">
                      <EventCard
                        event={trendToEventCardItem(item, currentCity)}
                        view="grid"
                        explorerMode
                        onOpen={() => openTrendDrawer(item)}
                        onSave={groupAct("Save")}
                        onAddToTrip={groupAct("Add to trip")}
                        onPoll={groupAct("Poll the group")}
                        onShare={groupAct("Share link")}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    No group-style picks for this filter — clear intents or see all events for more.
                  </p>
                )}
              </ExplorerHorizontalRail>
            </section>

            {loadingTrends ? (
              <div className="mb-12 h-36 animate-pulse rounded-2xl border border-[#1e4976] bg-[#0d1f33]/60" />
            ) : trendingTonightList.length ? (
              <ExplorerHorizontalRail
                id="trending-tonight"
                title="Trending tonight"
                subtitle={`${timeContext} · with your current filters`}
                rightSlot={
                  trendingTonightList.length > RAIL_PREVIEW ? (
                    <Link
                      href={`/explore/${encodeURIComponent(currentCity)}/events`}
                      className="text-xs font-semibold text-[#E94560] hover:underline"
                    >
                      See all
                    </Link>
                  ) : null
                }
              >
                {trendingTonightList.slice(0, RAIL_PREVIEW).map((item) => (
                  <div key={item.id} className="w-[min(280px,78vw)] shrink-0">
                    <EventCard
                      event={trendToEventCardItem(item, currentCity)}
                      view="grid"
                      explorerMode
                      compact
                      onOpen={() => openTrendDrawer(item)}
                      onSave={groupAct("Save")}
                      onAddToTrip={groupAct("Add to trip")}
                      onPoll={groupAct("Poll the group")}
                      onShare={groupAct("Share link")}
                    />
                  </div>
                ))}
              </ExplorerHorizontalRail>
            ) : null}

            {loadingTrends ? null : foodNightlifeList.length ? (
              <ExplorerHorizontalRail
                id="food-nightlife"
                title="Food & nightlife"
                subtitle="Shared plates, rooftops, late hours"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => {
                      setSeeAllTitle("Food & nightlife");
                      setSeeAllData(foodNightlifeList);
                      setSeeAllModalOpen(true);
                    }}
                    className="text-xs font-semibold text-[#E94560] hover:underline"
                  >
                    See all
                  </button>
                }
              >
                {foodNightlifeList.map((item) => (
                  <div key={item.id} className="w-[min(280px,78vw)] shrink-0">
                    <EventCard
                      event={trendToEventCardItem(item, currentCity)}
                      view="grid"
                      explorerMode
                      compact
                      onOpen={() => openTrendDrawer(item)}
                      onSave={groupAct("Save")}
                      onAddToTrip={groupAct("Add to trip")}
                      onPoll={groupAct("Poll the group")}
                      onShare={groupAct("Share link")}
                    />
                  </div>
                ))}
              </ExplorerHorizontalRail>
            ) : null}

            {loadingTrends ? (
              <div className="mb-12 h-36 animate-pulse rounded-2xl border border-[#1e4976] bg-[#0d1f33]/60" />
            ) : eventsTeaserList.length ? (
              <ExplorerHorizontalRail
                id="top-events"
                title="On your itinerary"
                subtitle={`${timeContext} · teaser row — full list & filters via See all`}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => {
                      setSeeAllTitle("On your itinerary");
                      setSeeAllData(eventsTeaserList);
                      setSeeAllModalOpen(true);
                    }}
                    className="text-xs font-semibold text-[#E94560] hover:underline"
                  >
                    See all
                  </button>
                }
              >
                {eventsTeaserList.map((item) => (
                  <div key={item.id} className="w-[min(280px,78vw)] shrink-0">
                    <EventCard
                      event={trendToEventCardItem(item, currentCity)}
                      view="grid"
                      explorerMode
                      compact
                      onOpen={() => openTrendDrawer(item)}
                      onSave={groupAct("Save")}
                      onAddToTrip={groupAct("Add to trip")}
                      onPoll={groupAct("Poll the group")}
                      onShare={groupAct("Share link")}
                    />
                  </div>
                ))}
              </ExplorerHorizontalRail>
            ) : !filterEmptyMessage ? (
              <div className="mb-12 rounded-xl border border-[#1e4976] bg-[#0d1f33] p-4 text-sm text-gray-400">
                No events loaded yet for this city.
              </div>
            ) : null}

            {loadingTrends ? null : weekendIdeasList.length ? (
              <ExplorerHorizontalRail
                id="weekend-ideas"
                title="Weekend ideas"
                subtitle="Fri–Sun energy from your feed"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => {
                      setSeeAllTitle("Weekend ideas");
                      setSeeAllData(weekendIdeasList);
                      setSeeAllModalOpen(true);
                    }}
                    className="text-xs font-semibold text-[#E94560] hover:underline"
                  >
                    See all
                  </button>
                }
              >
                {weekendIdeasList.map((item) => (
                  <div key={item.id} className="w-[min(280px,78vw)] shrink-0">
                    <EventCard
                      event={trendToEventCardItem(item, currentCity)}
                      view="grid"
                      explorerMode
                      compact
                      onOpen={() => openTrendDrawer(item)}
                      onSave={groupAct("Save")}
                      onAddToTrip={groupAct("Add to trip")}
                      onPoll={groupAct("Poll the group")}
                      onShare={groupAct("Share link")}
                    />
                  </div>
                ))}
              </ExplorerHorizontalRail>
            ) : null}

            {loadingTrends ? (
              <div className="mb-12 h-32 animate-pulse rounded-2xl border border-[#1e4976] bg-[#0d1f33]/60" />
            ) : attractionPicks.length ? (
              <ExplorerHorizontalRail
                id="attractions"
                title="Attractions & bites"
                subtitle="Landmarks, walks, snack-friendly stops (maps-backed places)"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => {
                      setSeeAllTitle("Attractions & bites");
                      setSeeAllData(attractionPicks);
                      setSeeAllModalOpen(true);
                    }}
                    className="text-xs font-semibold text-[#E94560] hover:underline"
                  >
                    See all
                  </button>
                }
              >
                {attractionPicks.map((item) => (
                  <div key={`attr-${item.id}`} className="w-[min(280px,78vw)] shrink-0">
                    <EventCard
                      event={trendToEventCardItem(item, currentCity)}
                      view="grid"
                      explorerMode
                      compact
                      onOpen={() => openTrendDrawer(item)}
                      onSave={groupAct("Save")}
                      onAddToTrip={groupAct("Add to trip")}
                      onPoll={groupAct("Poll the group")}
                      onShare={groupAct("Share link")}
                    />
                  </div>
                ))}
              </ExplorerHorizontalRail>
            ) : null}

            <section id="local-news" className="mb-12 scroll-mt-28">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white">News &amp; local buzz</h2>
                  <p className="text-xs text-gray-400">
                    Destination headlines via our news feed (GNews · Google News RSS fallback)
                  </p>
                </div>
                {news.length > 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSeeAllTitle("News & local buzz");
                      setSeeAllNewsData(news);
                      setSeeAllModalOpen(true);
                    }}
                    className="text-xs font-semibold text-[#E94560] hover:underline"
                  >
                    See all
                  </button>
                )}
              </div>
              <div className="flex gap-4 pb-2 overflow-x-auto [scrollbar-color:#1e4976_#0B192E] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
                {loadingNews
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-28 w-[min(280px,78vw)] shrink-0 animate-pulse rounded-xl border border-[#1e4976] bg-[#0d1f33]"
                      />
                    ))
                  : news.slice(0, 4).map((item) => (
                      <div key={item.id} className="w-[min(280px,85vw)] shrink-0 sm:w-[260px]">
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                          <NewsCard item={item} onAlertClick={() => setWeatherAlertOpen(true)} />
                        </a>
                      </div>
                    ))}
              </div>
            </section>

            <section id="explorer-culture" className="mb-12 scroll-mt-28">
              <div className="overflow-hidden rounded-2xl border border-[#1e4976] bg-[#0d1f33]/60">
                <button
                  type="button"
                  onClick={() => setCultureOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#071221]/80"
                >
                  <div>
                    <h2 className="text-base font-bold text-white">Podcasts & radio</h2>
                    <p className="text-xs text-gray-400">Optional — expand when you want audio for the trip</p>
                  </div>
                  {cultureOpen ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
                  )}
                </button>
                {cultureOpen ? (
                  <div className="space-y-6 border-t border-[#1e4976]/60 px-4 py-4">
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Podcasts</p>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {podcasts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (p.url && p.url !== "#") setPlayingUrl(p.url);
                              else showToast(`${p.title} — streaming soon`);
                            }}
                            className="w-[118px] shrink-0 text-left"
                          >
                            <div className="mb-2 flex aspect-square items-center justify-center rounded-xl border border-[#1e4976] bg-gradient-to-br from-[#16213E] to-[#E94560]/40 overflow-hidden">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                              ) : (
                                <Mic2 className="h-8 w-8 text-white/90" strokeWidth={1.25} />
                              )}
                            </div>
                            <p className="line-clamp-2 text-[11px] font-semibold text-white">{p.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[9px] text-gray-500">{p.subtitle}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div id="radio-panel" className="rounded-xl border border-[#1e4976]/80 bg-[#071221]/50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Radio className="h-4 w-4 text-[#E94560]" />
                        <h3 className="text-sm font-bold text-white">Local Radio</h3>
                      </div>
                      <ul className="divide-y divide-[#1e4976]/50">
                        {radioStations.map((r) => (
                          <li key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E94560] text-[10px] font-bold text-white overflow-hidden">
                              {r.imageUrl ? (
                                <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover" />
                              ) : (
                                "FM"
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-white">{r.name}</p>
                              <p className="text-[9px] text-gray-500">{r.tag}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (r.url && r.url !== "#") setPlayingUrl(r.url);
                                else showToast("Playback coming soon");
                              }}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E94560] text-white shadow-md hover:bg-[#d63851]"
                              aria-label={`Play ${r.name}`}
                            >
                              <span className="ml-0.5 h-0 w-0 border-b-[4px] border-l-[7px] border-t-[4px] border-b-transparent border-l-white border-t-transparent" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section id="transport" className="mb-12 scroll-mt-28 rounded-2xl border border-[#1e4976] bg-[#0d1f33]/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <TrainFront className="h-4 w-4 text-[#E94560]" />
                <h2 className="text-base font-bold text-white">Transport</h2>
              </div>
              <p className="text-sm text-gray-400">
                Trains, buses, and ride-share hubs near downtown. Save this city to your trip for live routing in a future
                update.
              </p>
              <Link
                href="/map"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#1e4976] bg-[#071221] px-4 py-2 text-xs font-semibold text-white hover:border-[#E94560]/50"
              >
                Open map
              </Link>
            </section>

            <section className="mb-12 flex items-center gap-3 rounded-2xl border border-dashed border-[#1e4976] bg-[#0d1f33] p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e4976] bg-[#071221]">
                <Megaphone size={14} className="text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400">
                  Sponsored · Based on your searches
                </p>
                <p className="text-[12px] font-medium text-white">Travel offers that match your group plans</p>
                <p className="text-[10px] text-gray-300">
                  Hotels, activities and routes near <CityTag cityName={currentCity} className="align-middle" />
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-[#1e4976] bg-[#071221] px-3 py-1 text-[10px] text-gray-300 hover:border-[#E94560] hover:text-[#E94560]"
              >
                Learn more
              </button>
            </section>

            <footer className="border-t border-[#142a45] py-8 text-center text-[11px] text-white/45">
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                <Link href="/dashboard" className="hover:text-white">
                  Dashboard
                </Link>
                <Link href="/explorer" className="hover:text-white">
                  Explorer
                </Link>
                <Link href="/settings" className="hover:text-white">
                  Settings
                </Link>
                <span className="text-white/25">|</span>
                <span>Travello · Group travel OS</span>
              </div>
            </footer>
        </div>
      )}

      {listening ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0B192E]/80">
          <div className="flex w-60 flex-col items-center gap-3 rounded-2xl border border-[#1e4976] bg-[#0d1f33] p-5 shadow-xl shadow-black/40">
            <div className="flex h-[60px] w-[60px] animate-pulse items-center justify-center rounded-full border-2 border-[#E94560]">
              <Mic size={22} className="text-[#E94560]" />
            </div>
            <p className="text-sm font-medium text-white">Listening...</p>
            <p className="text-center text-xs text-gray-300">Say something like &apos;jazz events tonight&apos;</p>
            <button
              type="button"
              onClick={() => {
                recognitionRef.current?.stop();
                setListening(false);
              }}
              className="rounded-full border border-[#1e4976] bg-[#1E3A5F] px-4 py-1.5 text-xs text-gray-300 hover:border-[#E94560] hover:text-[#E94560]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <WayraPanel
        open={wayraOpen}
        city={currentCity}
        onOpen={() => setWayraOpen(true)}
        onClose={() => setWayraOpen(false)}
      />

      <WeatherWidget 
        isOpen={weatherAlertOpen} 
        onClose={() => setWeatherAlertOpen(false)} 
        city={currentCity} 
      />

      {/* Audio Player */}
      {playingUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1f33] border-t border-[#1e4976] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E94560] rounded-lg flex items-center justify-center text-white font-bold">
              <Radio size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Playing Audio</p>
              <p className="text-xs text-gray-400">Live Stream</p>
            </div>
          </div>
          <audio src={playingUrl} autoPlay controls className="h-10" />
          <button
            type="button"
            onClick={() => setPlayingUrl(null)}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>
      )}

      {/* See All Modal */}
      {seeAllModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192E]/80 backdrop-blur-sm"
          onKeyDown={(e) => {
            if (e.key === "Escape") setSeeAllModalOpen(false);
          }}
          tabIndex={0}
        >
          <div className="w-full max-w-5xl max-h-[80vh] overflow-hidden rounded-2xl border border-[#1e4976] bg-[#0d1f33] flex flex-col">
            <div className="px-6 py-4 border-b border-[#1e4976]/60 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{seeAllTitle}</h2>
              <button
                type="button"
                onClick={() => {
                  setSeeAllModalOpen(false);
                  setSeeAllNewsData([]);
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {seeAllTitle === "News & local buzz"
                  ? seeAllNewsData.map((item) => (
                      <div key={item.id} className="w-full">
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                          <NewsCard item={item} onAlertClick={() => setWeatherAlertOpen(true)} />
                        </a>
                      </div>
                    ))
                  : seeAllData.map((item) => (
                      <EventCard
                        key={item.id}
                        event={trendToEventCardItem(item, currentCity)}
                        view="grid"
                        explorerMode
                        onOpen={() => openTrendDrawer(item)}
                        onSave={groupAct("Save")}
                        onAddToTrip={groupAct("Add to trip")}
                        onPoll={groupAct("Poll the group")}
                        onShare={groupAct("Share link")}
                      />
                    ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ExplorerItemDetailDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
        onToast={showToast}
      />

      <StatsInfoModal
        payload={statsModal}
        onClose={() => setStatsModal(null)}
        onOpenBrowser={(url, title, domain) =>
          setInAppBrowser({ url, title, domain })
        }
      />

      <ExplorerNewsReaderModal
        article={inAppBrowser}
        onClose={() => setInAppBrowser(null)}
      />

      {toast ? (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#1e4976] bg-[#0d1f33] px-4 py-2 text-xs font-medium text-white shadow-lg shadow-black/30">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  emoji,
  title,
  titleNode,
  subtitle,
  onSeeAll,
  seeAllLabel = "See all",
}: {
  emoji?: string;
  title?: string;
  titleNode?: ReactNode;
  subtitle: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 border-b border-[#1e4976]/40 pb-4">
      <div className="flex min-w-0 items-start gap-2">
        {emoji ? (
          <span className="text-xl leading-none text-white" aria-hidden>
            {emoji}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-white">{titleNode ?? title}</h2>
          <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      {onSeeAll ? (
        <button type="button" onClick={onSeeAll} className="shrink-0 text-sm font-semibold text-[#E94560] hover:text-white">
          {seeAllLabel}
        </button>
      ) : (
        <span className="w-12 shrink-0" aria-hidden />
      )}
    </div>
  );
}

function SearchSourceBadge({ source }: { source: string }) {
  if (source === "internal_db") {
    return (
      <span className="rounded-full bg-[#1e4976]/60 px-2 py-0.5 text-[10px] font-medium text-gray-200">
        Your library
      </span>
    );
  }
  if (source === "google_web") {
    return (
      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-200">
        Google Search
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-200">
      Google Events
    </span>
  );
}

function NewsCard({ item, onAlertClick }: { item: NewsItem; onAlertClick?: () => void }) {
  const isAlert = item.source.toLowerCase() === "alert" || item.tags.some(t => t.toLowerCase() === "alert");

  if (isAlert) {
    return (
      <button
        type="button"
        onClick={onAlertClick}
        className="flex w-full items-center gap-3 rounded-lg border border-orange-400/40 bg-[#0d1f33] p-2.5 text-left transition-all hover:border-orange-400/60"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#1e4976] bg-[#071221] text-[14px] shadow-sm">
          {item.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-medium text-orange-200 leading-snug">
            {item.title}
          </span>
        </span>
        <span className="shrink-0 text-[9px] font-medium text-orange-300/90">
          {item.time}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex h-full w-full gap-3 rounded-xl border border-[#1e4976] bg-[#0d1f33] p-3 text-left shadow-md transition hover:-translate-y-[2px] hover:border-[#E94560]/45"
    >
      <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-lg border border-[#1e4976] bg-[#071221] overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[22px]">{item.emoji}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-[9px] font-medium uppercase tracking-wide text-gray-500">
          {item.source} · {item.time}
        </span>
        <span className="mb-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-white">
          {item.title}
        </span>
        <span className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${tagClass(tag)}`}>
              {tag}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
