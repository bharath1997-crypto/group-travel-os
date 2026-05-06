"use client";

import { Megaphone, Mic, Newspaper, Search, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EventCard } from "@/components/explorer/EventCard";
import { ExplorerItemDetailDrawer, type ExplorerDrawerItem } from "@/components/explorer/ExplorerItemDetailDrawer";
import { LocationPicker } from "@/components/explorer/LocationPicker";
import { WayraPanel } from "@/components/explorer/WayraPanel";
import { WeatherWidget } from "@/components/explorer/WeatherWidget";
import { ExplorerMediaFeed } from "@/components/explorer/ExplorerMediaFeed";
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

type ReelItem = {
  id: string;
  author: string;
  views: string;
  hot?: boolean;
  thumbnail?: string | null;
  sourceUrl?: string;
};

type NewsItem = {
  id: string;
  source: string;
  time: string;
  title: string;
  emoji: string;
  tags: string[];
};

type FeedResponse = {
  events?: unknown[];
  items?: unknown[];
  data?: unknown[];
  results?: unknown[];
};

type SocialFeedResponse = {
  instagram?: unknown[];
  reels?: unknown[];
  items?: unknown[];
};

type NewsResponse = {
  news?: unknown[];
  items?: unknown[];
  articles?: unknown[];
};

type SmartSearchResponse = {
  results?: unknown[];
  total?: number;
  query?: string;
  city?: string;
  source?: string;
  wayra_suggestion?: string | null;
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

const DEMO_REELS: ReelItem[] = [
  { id: "reel-1", author: "@travello_chicago", views: "42K views", hot: true },
  { id: "reel-2", author: "@foodloop", views: "18K views" },
  { id: "reel-3", author: "@jazzafterdark", views: "31K views", hot: true },
  { id: "reel-4", author: "@parksdaily", views: "9K views" },
  { id: "reel-5", author: "@nightspots", views: "25K views" },
  { id: "reel-6", author: "@artwalks", views: "13K views" },
  { id: "reel-7", author: "@weekendplans", views: "36K views", hot: true },
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

function textField(row: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function numberLabel(value: unknown): string {
  if (typeof value !== "number") return "New";
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M views`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}K views`;
  return `${value} views`;
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
  const sourceType = textField(record, ["source_name", "source_type", "sourceType"], "google_events");
  const sourceLabel =
    sourceType === "google_events" || sourceType === "dataforseo"
      ? "Google"
      : sourceType === "google_places"
        ? "Google"
        : sourceType === "eventbrite"
          ? "EB"
          : sourceType === "ticketmaster"
            ? "TM"
            : sourceType === "predicthq"
              ? "PHQ"
              : "FREE";
  const title = textField(record, ["title", "name"], "Trending plan near you");
  
  let dateStr = textField(record, ["date_str", "dateLabel", "date"], "");
  if (!dateStr && record.start_time) {
    const d = new Date(String(record.start_time));
    dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : "Upcoming";
  }
  
  return {
    id: textField(record, ["external_id", "id"], `trend-${index}`),
    title,
    description: textField(record, ["description"], "Trending plan near you"),
    venue: textField(record, ["venue_name", "venue"], city),
    meta: `${dateStr || "Today"} · ${textField(record, ["venue_name", "venue"], city)}`,
    sourceType,
    sourceLabel,
    priceLabel: textField(record, ["priceLabel", "price", "price_from"], textField(record, ["is_free"], "") || "Free"),
    emoji: textField(record, ["emoji"], emojiFor(title)),
    imageUrl: textField(record, ["image_url", "thumbnail"], "") || null,
    url: textField(record, ["booking_url", "url", "link"], ""),
  };
}

function normalizeReel(row: unknown, index: number): ReelItem {
  const record = typeof row === "object" && row != null ? (row as Record<string, unknown>) : {};
  return {
    id: textField(record, ["id"], `reel-${index}`),
    author: textField(record, ["author", "username"], "@travello"),
    views: numberLabel(record.play_count ?? record.views),
    hot: Number(record.play_count ?? 0) > 25_000,
    thumbnail: textField(record, ["thumbnail", "image_url"], "") || null,
    sourceUrl: textField(record, ["source_url", "video_url"], ""),
  };
}

function normalizeNews(row: unknown, index: number): NewsItem {
  const record = typeof row === "object" && row != null ? (row as Record<string, unknown>) : {};
  const title = textField(record, ["title"], "Travel update for your city");
  const tags = Array.isArray(record.tags) ? record.tags.map(String).slice(0, 3) : ["Travel", "Events"];
  return {
    id: textField(record, ["id"], `news-${index}`),
    source: textField(record, ["source"], "Travello"),
    time: textField(record, ["time", "published_ago"], "Today"),
    title,
    emoji: textField(record, ["emoji"], emojiFor(title)),
    tags,
  };
}

function normalizeSearchResult(row: unknown, index: number, city: string): SearchEventCardItem {
  const record = typeof row === "object" && row != null ? (row as Record<string, unknown>) : {};
  const title = textField(record, ["title", "name"], "Search result");
  const sourceType = textField(record, ["source_type", "sourceType"], "google_web");
  const isFree = record.is_free === true;
  const price = record.price_from;
  return {
    id: textField(record, ["id"], `search-${index}`),
    title,
    source: sourceType,
    sourceShort:
      sourceType === "internal_db"
        ? "Library"
        : sourceType === "google_web"
          ? "Google"
          : sourceType === "google_places"
            ? "Places"
            : "Events",
    sourceType,
    venue: textField(record, ["venue", "description"], city),
    city: textField(record, ["city"], city),
    dateLabel: textField(record, ["date_str", "dateLabel"], "Search result"),
    distanceLabel: textField(record, ["distanceLabel"], "Near you"),
    priceLabel:
      typeof price === "number"
        ? `From $${price}`
        : isFree
          ? "Free"
          : textField(record, ["priceLabel", "price"], "Open details"),
    isFree,
    emoji: textField(record, ["emoji"], emojiFor(title)),
    imageUrl: textField(record, ["image_url", "thumbnail"], "") || null,
    url: textField(record, ["booking_url", "url", "link"], ""),
  };
}

function sourceBadgeClass(sourceType: string): string {
  if (sourceType === "ticketmaster") return "bg-[#1a73e8]";
  if (sourceType === "eventbrite") return "bg-[#f97316]";
  if (sourceType === "free") return "bg-[#22C55E]";
  if (sourceType === "google_events" || sourceType === "google_places") return "bg-[#8b5cf6]";
  return "bg-[#6C757D]";
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
  const [currentCity, setCurrentCity] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEventCardItem[]>([]);
  const [searchSource, setSearchSource] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [wayraSuggestion, setWayraSuggestion] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingReels, setLoadingReels] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [toast, setToast] = useState("");
  const [listening, setListening] = useState(false);
  const [noResults, setNoResults] = useState("");
  const [wayraOpen, setWayraOpen] = useState(false);
  const [weatherAlertOpen, setWeatherAlertOpen] = useState(false);
  const [timeContext, setTimeContext] = useState("today");
  const [requestingLocation, setRequestingLocation] = useState(true);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<ExplorerDrawerItem | null>(null);
  const trendsRef = useRef<HTMLElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

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
        } catch (e) {
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

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const loadExplorer = useCallback(async () => {
    if (!currentCity) return;
    setLoadingTrends(true);
    setLoadingReels(true);
    setLoadingNews(true);
    setNoResults("");

    const feedPromise = apiFetch<FeedResponse>(`/explorer/feed?city=${encodeURIComponent(currentCity)}`);
    const socialPromise = apiFetch<SocialFeedResponse>(`/explorer/social-feed?city=${encodeURIComponent(currentCity)}`);
    const newsPromise = apiFetch<NewsResponse>(`/explorer/news?city=${encodeURIComponent(currentCity)}`);

    const [feedResult, socialResult, newsResult] = await Promise.allSettled([
      feedPromise,
      socialPromise,
      newsPromise,
    ]);

    if (feedResult.status === "fulfilled") {
      const normalized = getRows(feedResult.value, ["events", "items", "data", "results"]).map((item, index) =>
        normalizeTrend(item, index, currentCity),
      );
      setTrends(normalized.length ? normalized : DEMO_TRENDS);
    } else {
      setTrends(DEMO_TRENDS);
    }
    setLoadingTrends(false);

    if (socialResult.status === "fulfilled") {
      const normalized = getRows(socialResult.value, ["instagram", "reels", "items"]).map(normalizeReel);
      setReels(normalized.length ? normalized : DEMO_REELS);
    } else {
      setReels(DEMO_REELS);
    }
    setLoadingReels(false);

    if (newsResult.status === "fulfilled") {
      const normalized = getRows(newsResult.value, ["news", "items", "articles"]).map(normalizeNews);
      setNews(normalized.length ? normalized.slice(0, 5) : DEMO_NEWS);
    } else {
      setNews(DEMO_NEWS);
    }
    setLoadingNews(false);
  }, [currentCity]);

  useEffect(() => {
    setSearchResults([]);
    setSearchSource("");
    setSearchLoading(false);
    setWayraSuggestion(null);
    setActiveSearch("");
    void loadExplorer();
  }, [loadExplorer]);

  const handleSearch = useCallback(async (rawQuery: string) => {
    const clean = rawQuery.trim();
    if (!clean) {
      return;
    }

    setSearchLoading(true);
    setSearchResults([]);
    setSearchSource("");
    setWayraSuggestion(null);
    setActiveSearch(clean);

    try {
      const res = await apiFetch<SmartSearchResponse>(
        `/explorer/search?q=${encodeURIComponent(clean)}&city=${encodeURIComponent(currentCity)}`,
      );
      const results = Array.isArray(res.results) ? res.results : [];
      if (results.length > 0) {
        setSearchResults(results.map((item, index) => normalizeSearchResult(item, index, currentCity)));
        setSearchSource(res.source ?? "");
      } else {
        setSearchResults([]);
        setSearchSource(res.source ?? "none");
      }
      if (res.wayra_suggestion) {
        setWayraSuggestion(res.wayra_suggestion);
      }
      trendsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setSearchResults([]);
      setSearchSource("none");
    } finally {
      setSearchLoading(false);
    }
  }, [currentCity]);

  const submitSearch = useCallback(async () => {
    await handleSearch(query);
  }, [handleSearch, query]);

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

  const filteredTrends = useMemo(() => {
    if (activeFilter === "All") return trends;
    return trends.filter((item) =>
      `${item.title} ${item.meta}`.toLowerCase().includes(activeFilter.toLowerCase()),
    );
  }, [activeFilter, trends]);

  return (
    <div className="relative min-h-full bg-[#1E3A5F] text-gray-300">
      <section className="border-b border-[#1e4976] bg-[#1E3A5F] px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-h-10 min-w-0 flex-1 items-center rounded-full border border-[#1e4976] bg-[#162d4a] focus-within:border-[#E94560]">
            <Search size={14} className="ml-3 shrink-0 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitSearch();
              }}
              placeholder="Search events, places, activities near you..."
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => void submitSearch()}
              className="h-6 border-l border-[#1e4976] px-3 text-sm font-medium text-[#E94560]"
            >
              Search
            </button>
          </div>
          <button
            type="button"
            onClick={startVoice}
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[#162d4a]",
              listening ? "border-[#E94560] text-[#E94560]" : "border-[#1e4976] text-gray-400",
            ].join(" ")}
            aria-label="Voice search"
          >
            <Mic size={14} />
          </button>
          <LocationPicker currentCity={currentCity} onCityChange={setCurrentCity} />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-[#1E3A5F] scrollbar-thumb-[#1e4976] [scrollbar-color:#1e4976_#1E3A5F] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1e4976] [&::-webkit-scrollbar-track]:bg-[#1E3A5F]">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={[
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeFilter === filter
                  ? "border-[#E94560] bg-[#162d4a] text-white shadow-sm shadow-black/20 hover:text-white"
                  : "border-[#1e4976] bg-[#162d4a] text-gray-300 hover:border-[#E94560] hover:text-white",
              ].join(" ")}
            >
              {filter}
            </button>
          ))}
          <button
            type="button"
            title="Coming soon"
            className="shrink-0 cursor-default rounded-full border border-dashed border-[#1e4976] bg-[#162d4a] px-3 py-1 text-xs font-medium text-gray-500"
          >
            More filters
          </button>
        </div>
      </section>

      {requestingLocation ? (
        <main className="flex flex-col items-center justify-center px-5 py-32 text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#E94560] border-t-transparent"></div>
          <p className="font-medium text-white">Getting your location...</p>
        </main>
      ) : !currentCity ? (
        <main className="flex flex-col items-center justify-center px-5 py-32 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#162d4a] ring-1 ring-[#1e4976]">
            <MapPin size={24} className="text-[#E94560]" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">Explore Your City</h2>
          <p className="mb-6 max-w-md text-sm text-gray-300">
            Please allow GPS permissions to discover trending events and activities near you, or select a city manually from the top right.
          </p>
          <button 
            type="button"
            onClick={() => {
              // Trigger the location picker focus
              const locationInput = document.querySelector('input[placeholder="Chicago"]') as HTMLElement;
              locationInput?.focus();
            }}
            className="rounded-full bg-[#E94560] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#d63851]"
          >
            Select a Location
          </button>
        </main>
      ) : (
        <main className="px-5 py-4">
        {searchLoading || searchResults.length > 0 || (wayraSuggestion && !wayraOpen) ? (
          <section className="mb-5">
            {searchLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[260px] animate-pulse rounded-xl border border-[#1e4976] bg-[#162d4a]/80" />
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
              <div className="rounded-xl border border-[#1e4976] bg-[#162d4a] p-4">
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

        <section ref={trendsRef} className="mb-5 scroll-mt-4">
          <SectionHeader title={`🔥 Trending in ${currentCity} ${timeContext}`} subtitle="Live · Updated hourly" onSeeAll={() => showToast("Opening full directory...")} />
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-[#1E3A5F] scrollbar-thumb-[#1e4976] [scrollbar-color:#1e4976_#1E3A5F] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1e4976] [&::-webkit-scrollbar-track]:bg-[#1E3A5F]">
            {loadingTrends
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[130px] w-[155px] shrink-0 animate-pulse rounded-xl border border-[#1e4976] bg-[#162d4a]/80" />
                ))
              : noResults
                ? <div className="w-full rounded-xl border border-[#1e4976] bg-[#162d4a] p-4 text-sm text-gray-300">{noResults}</div>
                : filteredTrends.map((item) => <TrendCard key={item.id} item={item} onOpen={() => setSelectedDrawerItem({
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
                    sourceUrl: item.url || `https://www.stubhub.com/search/?q=${encodeURIComponent(item.title + ' ' + currentCity)}`,
                })} />)}
          </div>
        </section>

        <section className="mb-5 flex items-center gap-3 rounded-xl border border-dashed border-[#1e4976] bg-[#162d4a] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e4976] bg-[#1E3A5F]">
            <Megaphone size={14} className="text-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400">
              Sponsored · Based on your searches
            </p>
            <p className="text-[12px] font-medium text-white">Travel offers that match your group plans</p>
            <p className="text-[10px] text-gray-300">Hotels, activities and routes near {currentCity}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full border border-[#1e4976] bg-[#1E3A5F] px-3 py-1 text-[10px] text-gray-300 hover:border-[#E94560] hover:text-[#E94560]"
          >
            Learn more
          </button>
        </section>

        <ExplorerMediaFeed city={currentCity} />
      </main>
      )}

      {listening ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1E3A5F]/75">
          <div className="flex w-60 flex-col items-center gap-3 rounded-2xl border border-[#1e4976] bg-[#162d4a] p-5 shadow-xl shadow-black/40">
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

      <ExplorerItemDetailDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
        onToast={showToast}
      />

      {toast ? (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#1e4976] bg-[#162d4a] px-4 py-2 text-xs font-medium text-white shadow-lg shadow-black/30">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  title,
  titleNode,
  subtitle,
  onSeeAll,
}: {
  title?: string;
  titleNode?: React.ReactNode;
  subtitle: string;
  onSeeAll?: () => void;
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-white">{titleNode ?? title}</h2>
        <p className="text-xs text-gray-300">{subtitle}</p>
      </div>
      <button type="button" onClick={onSeeAll} className="text-xs text-[#E94560]">
        See all
      </button>
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

function TrendCard({ item, onOpen }: { item: TrendItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-[155px] shrink-0 overflow-hidden rounded-xl border border-[#1e4976] bg-[#162d4a] text-left shadow-sm shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-[#E94560]"
    >
      <div className="relative flex h-[88px] items-center justify-center bg-[#1E3A5F] text-[28px]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          item.emoji
        )}
        <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[8px] font-medium text-white ${sourceBadgeClass(item.sourceType)}`}>
          {item.sourceLabel}
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded-full border border-[#1e4976] bg-[#162d4a] px-1.5 py-0.5 text-[9px] font-medium text-white">
          {item.priceLabel}
        </span>
      </div>
      <div className="px-2.5 py-[9px]">
        <p className="line-clamp-2 text-[11px] font-medium text-white">{item.title}</p>
        <p className="mt-1 truncate text-[10px] text-gray-300">{item.meta}</p>
      </div>
    </button>
  );
}

function ReelCard({ reel }: { reel: ReelItem }) {
  return (
    <div className="relative h-[162px] w-[106px] shrink-0 overflow-hidden rounded-xl border border-[#1e4976] bg-[#162d4a] transition-all hover:-translate-y-0.5 hover:border-[#E94560] group">
      <button type="button" className="absolute inset-0 h-full w-full text-left">
        {reel.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reel.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span className="absolute left-1.5 top-1.5 h-4 w-4 rounded-[5px] bg-[linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)]" />
        {reel.hot ? (
          <span className="absolute right-1.5 top-1.5 rounded bg-[#E94560] px-1 py-0.5 text-[8px] font-medium text-white">
            HOT
          </span>
        ) : null}
        <span className="absolute left-1/2 top-1/2 flex h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/25">
          <span className="ml-0.5 h-0 w-0 border-b-[5px] border-l-[9px] border-t-[5px] border-b-transparent border-l-white border-t-transparent" />
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(transparent,rgba(0,0,0,0.88))] px-2 pb-7 pt-10 text-left">
          <p className="truncate text-[9px] font-medium text-white/90">{reel.author}</p>
          <p className="text-[8px] text-white/55">{reel.views}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          alert("Poll created in your group chat: 'Should we go here?'");
        }}
        className="absolute bottom-1.5 left-1.5 right-1.5 rounded bg-white/20 py-1 text-[9px] font-medium text-white backdrop-blur-md transition-colors hover:bg-[#E94560]"
      >
        Ask Group
      </button>
    </div>
  );
}

function NewsCard({ item, onAlertClick }: { item: NewsItem; onAlertClick?: () => void }) {
  const isAlert = item.source.toLowerCase() === "alert" || item.tags.some(t => t.toLowerCase() === "alert");

  if (isAlert) {
    return (
      <button
        type="button"
        onClick={onAlertClick}
        className="flex w-full items-center gap-3 rounded-lg border border-orange-400/40 bg-[#162d4a] p-2.5 text-left transition-all hover:border-orange-400/60"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#1e4976] bg-[#1E3A5F] text-[14px] shadow-sm">
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
      className="flex w-full gap-3 rounded-xl border border-[#1e4976] bg-[#162d4a] p-3 text-left transition-all hover:translate-x-0.5 hover:border-[#E94560]/50"
    >
      <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-lg border border-[#1e4976] bg-[#1E3A5F] text-[22px]">
        {item.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-[9px] font-medium uppercase tracking-wide text-gray-400">
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
