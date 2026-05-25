"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { RovvyLogo } from "@/components/RovvyLogo";

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

function getParsedDate(dateStr: string) {
  if (!dateStr) return { month: "TBA", day: "--" };
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return {
        month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
        day: d.toLocaleDateString("en-US", { day: "numeric" }),
      };
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { month: "TBA", day: "--" };
    return {
      month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      day: d.toLocaleDateString("en-US", { day: "numeric" }),
    };
  } catch {
    return { month: "TBA", day: "--" };
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return "Date TBA";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getCategoryStyles(category: string) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("music")) {
    return {
      badge: "bg-purple-950/40 text-purple-400 border border-purple-800/40",
      gradient: "from-purple-900 to-indigo-950",
      icon: "🎵"
    };
  }
  if (cat.includes("sport")) {
    return {
      badge: "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40",
      gradient: "from-emerald-900 to-teal-950",
      icon: "⚽"
    };
  }
  if (cat.includes("art") || cat.includes("theat") || cat.includes("comed")) {
    return {
      badge: "bg-amber-950/40 text-amber-400 border border-amber-800/40",
      gradient: "from-amber-900 to-orange-950",
      icon: "🎭"
    };
  }
  if (cat.includes("family") || cat.includes("kid")) {
    return {
      badge: "bg-sky-950/40 text-sky-400 border border-sky-800/40",
      gradient: "from-sky-900 to-blue-950",
      icon: "👨‍👩‍👧‍👦"
    };
  }
  if (cat.includes("food") || cat.includes("drink") || cat.includes("din")) {
    return {
      badge: "bg-rose-950/40 text-rose-400 border border-rose-800/40",
      gradient: "from-rose-900 to-red-950",
      icon: "🍕"
    };
  }
  if (cat.includes("festiv") || cat.includes("film")) {
    return {
      badge: "bg-teal-950/40 text-teal-400 border border-teal-800/40",
      gradient: "from-teal-900 to-emerald-950",
      icon: "✨"
    };
  }
  return {
    badge: "bg-slate-800/40 text-slate-300 border border-slate-700/40",
    gradient: "from-slate-800 to-slate-950",
    icon: "📅"
  };
}

function EventSkeletonCard() {
  return (
    <div className="animate-pulse flex items-center gap-4 p-4 rounded-xl border border-[#334155]/20 bg-[#1E293B]/10">
      <div className="w-16 h-16 rounded-xl bg-slate-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/4 rounded bg-slate-800" />
        <div className="h-5 w-2/3 rounded bg-slate-800" />
        <div className="h-3.5 w-1/2 rounded bg-slate-800" />
      </div>
      <div className="h-10 w-28 rounded-xl bg-slate-800 shrink-0" />
    </div>
  );
}

function EventsSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [city, setCity] = useState("Chicago");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("All");
  
  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<"date" | "popularity" | "price">("date");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Initialize and run search from URL params or default to Chicago on mount
  useEffect(() => {
    const cityParam = searchParams.get("city") || "Chicago";
    setCity(cityParam);
    
    const catParam = searchParams.get("category") || "All";
    setCategory(catParam);

    const fromParam = searchParams.get("date_from") || "";
    setDateFrom(fromParam);

    const toParam = searchParams.get("date_to") || "";
    setDateTo(toParam);

    runSearch(cityParam, fromParam, toParam, catParam, 1, false);
  }, [searchParams]);

  const runSearch = async (
    searchCity: string,
    fromDate: string,
    toDate: string,
    searchCat: string,
    targetPage: number,
    append: boolean = false
  ) => {
    if (!searchCity.trim()) return;
    setErrorMsg(null);
    
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setEvents([]);
    }
    
    setSearched(true);

    try {
      const params = new URLSearchParams({
        city: searchCity.trim(),
        page: targetPage.toString(),
        per_page: perPage.toString(),
      });

      if (fromDate) params.set("date_from", fromDate);
      if (toDate) params.set("date_to", toDate);
      if (searchCat && searchCat !== "All") params.set("category", searchCat);

      const res = await apiFetch<EventsAPIResponse>(`/explore/events?${params.toString()}`);
      
      const newEvents = res?.events || [];
      setTotalCount(res?.total || 0);
      setPage(targetPage);

      if (append) {
        setEvents((prev) => [...prev, ...newEvents]);
      } else {
        setEvents(newEvents);
      }
    } catch (e) {
      if (!append) setEvents([]);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim()) {
      const params = new URLSearchParams();
      params.set("city", city.trim());
      if (category !== "All") params.set("category", category);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      
      router.push(`/events?${params.toString()}`);
      runSearch(city, dateFrom, dateTo, category, 1, false);
    }
  };

  const handleChipClick = (targetCity: string) => {
    setCity(targetCity);
    const params = new URLSearchParams();
    params.set("city", targetCity);
    if (category !== "All") params.set("category", category);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    
    router.push(`/events?${params.toString()}`);
    runSearch(targetCity, dateFrom, dateTo, category, 1, false);
  };

  const handleLoadMore = () => {
    runSearch(city, dateFrom, dateTo, category, page + 1, true);
  };

  // Sort function applied on the active list
  const getSortedEvents = () => {
    const list = [...events];
    if (sortBy === "date") {
      return list.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      });
    }
    if (sortBy === "price") {
      return list.sort((a, b) => {
        const aPrice = a.price_min !== null ? a.price_min : 999999;
        const bPrice = b.price_min !== null ? b.price_min : 999999;
        return aPrice - bPrice;
      });
    }
    // Default / Popularity (uses order returned by Ticketmaster API)
    return list;
  };

  const sortedEvents = getSortedEvents();
  const hasMore = events.length < totalCount && events.length > 0;

  return (
    <div className="w-full max-w-6xl mt-4">
      {/* Sleek Row Header */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/explore")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E293B] border border-[#334155]/60 text-slate-300 hover:text-white hover:bg-[#263548] transition active:scale-95 shadow-md"
            title="Back to Explore Hub"
          >
            &larr;
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
            Events Directory
          </h1>
        </div>
      </div>

      {/* Search Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#1E293B]/80 bg-white/70 dark:bg-[#1E293B]/40 p-6 shadow-2xl backdrop-blur-md">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="lg:col-span-2">
              <label htmlFor="city" className="block text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5">
                Where do you want to go?
              </label>
              <input
                type="text"
                id="city"
                required
                placeholder="Search any city..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#64748B] transition focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]/50 shadow-inner"
              />
            </div>

            <div>
              <label htmlFor="dateFrom" className="block text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5">
                From Date
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm text-slate-800 dark:text-white transition focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]/50 shadow-inner"
              />
            </div>

            <div>
              <label htmlFor="dateTo" className="block text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5">
                To Date
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm text-slate-800 dark:text-white transition focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]/50 shadow-inner"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1.5">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm text-slate-800 dark:text-white transition focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]/50 shadow-inner"
              >
                <option value="All">All Categories</option>
                <option value="Music">Music</option>
                <option value="Sports">Sports</option>
                <option value="Arts">Arts</option>
                <option value="Family">Family</option>
                <option value="Food">Food</option>
                <option value="Festival">Festival</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-4 border-t border-slate-200 dark:border-[#334155]/20">
            {/* Popular destination chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#64748B]">Popular:</span>
              {["Chicago", "New York", "London", "Tokyo", "Paris", "Sydney"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleChipClick(c)}
                  className="rounded-lg bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155]/40 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#263548] transition"
                >
                  {c}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto rounded-xl bg-[#0F766E] px-8 py-3 text-sm font-black text-white shadow-lg transition hover:bg-[#115E59] active:scale-95 disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search Directory"}
            </button>
          </div>
        </form>
      </div>

      {/* Results Section */}
      <div className="mt-10 space-y-6">
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 p-4 text-sm text-rose-300">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Results Info and Sort Bar */}
        {searched && !loading && events.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-[#1E293B]/25 p-4 rounded-xl border border-slate-200 dark:border-[#334155]/30 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
              {totalCount.toLocaleString()} events found in <span className="text-teal-600 dark:text-teal-400">{city}</span>
            </h3>
            
            {/* Sort Tabs */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#64748B]">Sort by:</span>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#0F172A] p-1 border border-slate-200 dark:border-[#334155]/30">
                {(["date", "popularity", "price"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSortBy(tab)}
                    className={`rounded-md px-3.5 py-1 text-xs font-bold transition uppercase tracking-wider ${
                      sortBy === tab
                        ? "bg-[#0F766E] text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Skeleton Grid */}
        {loading && (
          <div className="flex flex-col gap-3">
            <EventSkeletonCard />
            <EventSkeletonCard />
            <EventSkeletonCard />
          </div>
        )}

        {/* Empty State */}
        {!loading && searched && events.length === 0 && !errorMsg && (
          <div className="text-center rounded-2xl border border-dashed border-[#334155] bg-[#1E293B]/10 p-16">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/60 text-3xl">
              🔍
            </div>
            <h3 className="mt-4 text-lg font-bold text-amber-200">No Events Found</h3>
            <p className="mt-2 text-sm text-[#94A3B8] max-w-sm mx-auto leading-relaxed">
              No events found in <span className="font-bold text-slate-300">{city}</span>. Try a different city, category, or date range.
            </p>
          </div>
        )}

        {/* Event Cards Grid */}
        {!loading && events.length > 0 && (
          <div className="flex flex-col gap-3">
            {sortedEvents.map((ev) => {
              const styles = getCategoryStyles(ev.category);
              const { month, day } = getParsedDate(ev.date);
              return (
                <div
                  key={ev.id}
                  className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200/60 dark:border-[#334155]/20 bg-white/70 dark:bg-[#1E293B]/20 p-4 hover:bg-slate-50 dark:hover:bg-[#1E293B]/40 hover:border-[#0F766E]/40 dark:hover:border-[#0F766E]/40 transition duration-200 shadow-sm"
                >
                  <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                    {/* Date Block */}
                    <div className="flex flex-col items-center justify-center bg-slate-800 dark:bg-[#1E293B]/80 border border-slate-700 dark:border-[#334155]/60 rounded-xl w-16 h-16 shrink-0 shadow-md">
                      <span className="text-[10px] font-black tracking-widest text-teal-400 uppercase">{month}</span>
                      <span className="text-xl font-black text-white leading-none mt-1">{day}</span>
                    </div>

                    {/* Middle Info Block */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-widest ${styles.badge}`}>
                          {ev.category || "General"}
                        </span>
                        <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider bg-slate-900/60 border border-[#334155]/40 px-2 py-0.5 rounded-md">
                          {ev.source === "ai_fallback"
                            ? "Seasonal Guide"
                            : ev.source === "yelp"
                            ? "Yelp"
                            : ev.source === "eventbrite"
                            ? "Eventbrite"
                            : ev.source === "skiddle"
                            ? "Skiddle"
                            : ev.source === "bandsintown"
                            ? "Bandsintown"
                            : "Ticketmaster"}
                        </span>
                        {ev.price_min !== null && (
                          <span className="text-[10px] font-black text-[#2DD4BF] bg-[#0F766E]/10 border border-[#0F766E]/20 px-2 py-0.5 rounded-md">
                            From ${ev.price_min.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-300 transition duration-200 line-clamp-1 leading-snug">
                        {ev.name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-[#94A3B8] flex items-center gap-1.5 truncate">
                        <span>📍</span> <span className="font-semibold text-slate-700 dark:text-slate-300">{ev.venue}</span> &bull; {ev.city}, {ev.country} {ev.time && `• ${ev.time}`}
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
                    <a
                      href={ev.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] active:scale-95 px-5 py-2.5 text-xs font-black text-white shadow-md transition duration-200 shrink-0"
                    >
                      Get Tickets <span>&rarr;</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Pagination */}
        {hasMore && !loading && (
          <div className="flex justify-center pt-8">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-xl border border-[#334155] bg-[#1E293B] hover:bg-[#263548] px-8 py-3.5 text-sm font-extrabold text-slate-200 transition active:scale-95 disabled:opacity-50 shadow-md"
            >
              {loadingMore ? "Loading more..." : "Load More Events"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <div className="min-h-[calc(100dvh-80px)] bg-transparent px-4 py-4 text-[#F8FAFC] md:px-8 flex flex-col items-center">
      <Suspense fallback={
        <div className="w-full max-w-6xl mt-4 flex flex-col items-center">
          <div className="h-10 w-48 rounded bg-slate-800 animate-pulse mb-8" />
          <div className="w-full h-32 rounded-2xl bg-slate-800 animate-pulse grid grid-cols-3 gap-6" />
        </div>
      }>
        <EventsSearchContent />
      </Suspense>
    </div>
  );
}
