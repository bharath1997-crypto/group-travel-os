"use client";

import { Megaphone, Mic, Newspaper, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EventCard } from "@/components/explorer/EventCard";
import { LocationPicker } from "@/components/explorer/LocationPicker";
import { WayraPanel } from "@/components/explorer/WayraPanel";
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
  meta: string;
  sourceType: string;
  sourceLabel: string;
  priceLabel: string;
  emoji: string;
  imageUrl?: string | null;
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
};

const FILTERS = ["All", "Music", "Food", "Art", "Sports", "Nature", "Events", "Hotels"];

const DEMO_TRENDS: TrendItem[] = [
  {
    id: "demo-jazz",
    title: "Jazz nights and rooftop music picks",
    meta: "Tonight · River North",
    sourceType: "google_events",
    sourceLabel: "Google",
    priceLabel: "From $21",
    emoji: "🎷",
  },
  {
    id: "demo-food",
    title: "Best food walks for groups",
    meta: "Today · West Loop",
    sourceType: "eventbrite",
    sourceLabel: "EB",
    priceLabel: "From $35",
    emoji: "🍜",
  },
  {
    id: "demo-free",
    title: "Free park events near downtown",
    meta: "Today · Millennium Park",
    sourceType: "free",
    sourceLabel: "FREE",
    priceLabel: "Free",
    emoji: "🌿",
  },
  {
    id: "demo-sports",
    title: "Cubs watch parties and sports bars",
    meta: "This week · Wrigleyville",
    sourceType: "ticketmaster",
    sourceLabel: "TM",
    priceLabel: "From $18",
    emoji: "⚾",
  },
  {
    id: "demo-arts",
    title: "Gallery openings with late entry",
    meta: "Today · River North",
    sourceType: "predicthq",
    sourceLabel: "PHQ",
    priceLabel: "Free",
    emoji: "🎨",
  },
  {
    id: "demo-hotel",
    title: "Hotel lounge events with skyline views",
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
    source: "Time Out",
    time: "1h ago",
    title: "Chicago jazz rooms are adding more late-night group-friendly shows",
    emoji: "🎷",
    tags: ["Music", "Chicago", "Events"],
  },
  {
    id: "news-2",
    source: "Eater",
    time: "2h ago",
    title: "New food tour routes make West Loop easier for first-time visitors",
    emoji: "🍜",
    tags: ["Food", "Travel"],
  },
  {
    id: "news-3",
    source: "Choose Chicago",
    time: "3h ago",
    title: "Free outdoor events return across parks and riverfront spaces",
    emoji: "🌿",
    tags: ["Free", "Events"],
  },
  {
    id: "news-4",
    source: "Local Sports",
    time: "4h ago",
    title: "Sports watch parties trend near Wrigleyville and River North",
    emoji: "⚾",
    tags: ["Sports", "Chicago"],
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
  const sourceType = textField(record, ["source_type", "sourceType"], "google_events");
  const sourceLabel =
    sourceType === "google_events"
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
  return {
    id: textField(record, ["id"], `trend-${index}`),
    title,
    meta: `${textField(record, ["date_str", "dateLabel", "date"], "Today")} · ${textField(record, ["venue"], city)}`,
    sourceType,
    sourceLabel,
    priceLabel: textField(record, ["priceLabel", "price", "price_from"], textField(record, ["is_free"], "") || "Free"),
    emoji: textField(record, ["emoji"], emojiFor(title)),
    imageUrl: textField(record, ["image_url", "thumbnail"], "") || null,
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
  if (low.includes("jazz") || low.includes("music")) return "bg-rose-50 text-rose-600";
  if (low.includes("food")) return "bg-orange-50 text-orange-600";
  if (low.includes("free")) return "bg-green-50 text-green-600";
  if (low.includes("travel")) return "bg-blue-50 text-blue-600";
  if (low.includes("sport")) return "bg-emerald-50 text-emerald-600";
  if (low.includes("event")) return "bg-purple-50 text-purple-600";
  return "bg-slate-100 text-slate-600";
}

export default function ExplorerPage() {
  const [currentCity, setCurrentCity] = useState("Chicago");
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
  const trendsRef = useRef<HTMLElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const loadExplorer = useCallback(async () => {
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
    <div className="relative min-h-full bg-[#F8F9FA] text-[#2C3E50]">
      <section className="border-b border-[#E9ECEF] bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-h-10 min-w-0 flex-1 items-center rounded-full border border-[#E9ECEF] bg-[#F8F9FA] focus-within:border-[#E94560]">
            <Search size={14} className="ml-3 shrink-0 text-[#6C757D]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitSearch();
              }}
              placeholder="Search events, places, activities near you..."
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[#2C3E50] outline-none placeholder:text-[#6C757D]"
            />
            <button
              type="button"
              onClick={() => void submitSearch()}
              className="h-6 border-l border-[#E9ECEF] px-3 text-sm font-medium text-[#E94560]"
            >
              Search
            </button>
          </div>
          <button
            type="button"
            onClick={startVoice}
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[#F8F9FA]",
              listening ? "border-[#E94560] text-[#E94560]" : "border-[#E9ECEF] text-[#6C757D]",
            ].join(" ")}
            aria-label="Voice search"
          >
            <Mic size={14} />
          </button>
          <LocationPicker currentCity={currentCity} onCityChange={setCurrentCity} />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={[
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium hover:border-[#E94560] hover:text-[#E94560]",
                activeFilter === filter
                  ? "border-[#0F3460] bg-[#0F3460] text-white hover:text-white"
                  : "border-[#E9ECEF] bg-white text-[#6C757D]",
              ].join(" ")}
            >
              {filter}
            </button>
          ))}
          <button
            type="button"
            title="Coming soon"
            className="shrink-0 cursor-default rounded-full border border-dashed border-[#E9ECEF] bg-white px-3 py-1 text-xs font-medium text-[#6C757D]"
          >
            More filters
          </button>
        </div>
      </section>

      <main className="px-5 py-4">
        {searchLoading || searchResults.length > 0 || (wayraSuggestion && !wayraOpen) ? (
          <section className="mb-5">
            {searchLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[260px] animate-pulse rounded-xl bg-[#E9ECEF]" />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div className="mb-2.5 flex items-center gap-2">
                  <h2 className="text-sm font-medium text-[#2C3E50]">Results for &apos;{activeSearch}&apos;</h2>
                  <SearchSourceBadge source={searchSource} />
                  <button type="button" onClick={clearSearch} className="ml-auto text-xs text-[#E94560]">
                    Clear
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.map((item) => (
                    <EventCard key={item.id} event={item} view="grid" onOpen={() => undefined} />
                  ))}
                </div>
              </>
            ) : wayraSuggestion && !wayraOpen ? (
              <div className="rounded-xl border border-[#E9ECEF] bg-[#F8F9FA] p-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex shrink-0 items-start justify-center">
                    <WayraIcon state="flying" size={0.5} variant="fog" animate={false} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#2C3E50]">{wayraSuggestion}</p>
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
          <SectionHeader title={`🔥 Trending in ${currentCity} today`} subtitle="Live · Updated hourly" />
          <div className="flex gap-3 overflow-x-auto pb-1">
            {loadingTrends
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[130px] w-[155px] shrink-0 animate-pulse rounded-xl bg-[#E9ECEF]" />
                ))
              : noResults
                ? <div className="w-full rounded-xl border border-[#E9ECEF] bg-white p-4 text-sm text-[#6C757D]">{noResults}</div>
                : filteredTrends.map((item) => <TrendCard key={item.id} item={item} />)}
          </div>
        </section>

        <section className="mb-5 flex items-center gap-3 rounded-xl border border-dashed border-[#E9ECEF] bg-white p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E9ECEF] bg-[#F8F9FA]">
            <Megaphone size={14} className="text-[#6C757D]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-[#6C757D]">
              Sponsored · Based on your searches
            </p>
            <p className="text-[12px] font-medium text-[#2C3E50]">Travel offers that match your group plans</p>
            <p className="text-[10px] text-[#6C757D]">Hotels, activities and routes near {currentCity}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full border border-[#E9ECEF] px-3 py-1 text-[10px] text-[#6C757D] hover:border-[#E94560] hover:text-[#E94560]"
          >
            Learn more
          </button>
        </section>

        <section className="mb-5">
          <SectionHeader title="📷 Instagram reels today" subtitle={`#${currentCity} · #travel · Posted today`} />
          <div className="flex gap-3 overflow-x-auto pb-1">
            {loadingReels
              ? Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="h-[162px] w-[106px] shrink-0 animate-pulse rounded-xl bg-[#E9ECEF]" />
                ))
              : reels.map((reel) => <ReelCard key={reel.id} reel={reel} />)}
          </div>
        </section>

        <section className="mb-5">
          <SectionHeader
            titleNode={
              <span className="flex items-center gap-1.5">
                <Newspaper size={14} className="text-[#6C757D]" />
                News for you
              </span>
            }
            subtitle="Based on your interests and past searches"
          />
          <div className="space-y-2">
            {loadingNews
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-xl bg-[#E9ECEF]" />
                ))
              : news.slice(0, 5).map((item) => <NewsCard key={item.id} item={item} />)}
          </div>
        </section>
      </main>

      {listening ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0F3460]/35">
          <div className="flex w-60 flex-col items-center gap-3 rounded-2xl border border-[#E9ECEF] bg-white p-5">
            <div className="flex h-[60px] w-[60px] animate-pulse items-center justify-center rounded-full border-2 border-[#E94560]">
              <Mic size={22} className="text-[#E94560]" />
            </div>
            <p className="text-sm font-medium text-[#2C3E50]">Listening...</p>
            <p className="text-center text-xs text-[#6C757D]">Say something like &apos;jazz events tonight&apos;</p>
            <button
              type="button"
              onClick={() => {
                recognitionRef.current?.stop();
                setListening(false);
              }}
              className="rounded-full border border-[#E9ECEF] px-4 py-1.5 text-xs text-[#6C757D] hover:border-[#E94560] hover:text-[#E94560]"
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

      {toast ? (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#E9ECEF] bg-white px-4 py-2 text-xs font-medium text-[#2C3E50] shadow">
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
}: {
  title?: string;
  titleNode?: React.ReactNode;
  subtitle: string;
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-[#2C3E50]">{titleNode ?? title}</h2>
        <p className="text-xs text-[#6C757D]">{subtitle}</p>
      </div>
      <button type="button" className="text-xs text-[#E94560]">
        See all
      </button>
    </div>
  );
}

function SearchSourceBadge({ source }: { source: string }) {
  if (source === "internal_db") {
    return (
      <span className="rounded-full bg-[#0F3460]/10 px-2 py-0.5 text-[10px] font-medium text-[#0F3460]">
        Your library
      </span>
    );
  }
  if (source === "google_web") {
    return (
      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
        Google Search
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
      Google Events
    </span>
  );
}

function TrendCard({ item }: { item: TrendItem }) {
  return (
    <button
      type="button"
      className="w-[155px] shrink-0 overflow-hidden rounded-xl border border-[#E9ECEF] bg-white text-left transition-all hover:-translate-y-0.5 hover:border-[#E94560]"
    >
      <div className="relative flex h-[88px] items-center justify-center bg-[#16213E] text-[28px]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          item.emoji
        )}
        <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[8px] font-medium text-white ${sourceBadgeClass(item.sourceType)}`}>
          {item.sourceLabel}
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded-full border border-[#E9ECEF] bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#2C3E50]">
          {item.priceLabel}
        </span>
      </div>
      <div className="px-2.5 py-[9px]">
        <p className="line-clamp-2 text-[11px] font-medium text-[#2C3E50]">{item.title}</p>
        <p className="mt-1 truncate text-[10px] text-[#6C757D]">{item.meta}</p>
      </div>
    </button>
  );
}

function ReelCard({ reel }: { reel: ReelItem }) {
  return (
    <button
      type="button"
      className="relative h-[162px] w-[106px] shrink-0 overflow-hidden rounded-xl border border-[#E9ECEF] bg-[#16213E] transition-all hover:-translate-y-0.5 hover:border-[#E94560]"
    >
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
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(transparent,rgba(0,0,0,0.88))] px-2 pb-2 pt-10 text-left">
        <p className="truncate text-[9px] font-medium text-white/90">{reel.author}</p>
        <p className="text-[8px] text-white/55">{reel.views}</p>
      </div>
    </button>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <button
      type="button"
      className="flex w-full gap-3 rounded-xl border border-[#E9ECEF] bg-white p-3 text-left transition-all hover:translate-x-0.5 hover:border-[#E9ECEF]"
    >
      <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-lg border border-[#E9ECEF] bg-[#F8F9FA] text-[22px]">
        {item.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-[9px] font-medium uppercase tracking-wide text-[#6C757D]">
          {item.source} · {item.time}
        </span>
        <span className="mb-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-[#2C3E50]">
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
