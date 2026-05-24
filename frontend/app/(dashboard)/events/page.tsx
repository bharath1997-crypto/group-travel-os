"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { RovvyLogo } from "@/components/RovvyLogo";

type TicketmasterEvent = {
  id: string;
  title: string;
  imageUrl: string;
  url: string;
  start_date: string;
  venue: string;
  category: string;
};

function formatDate(dateStr: string) {
  if (!dateStr) return "Date TBA";
  try {
    // If it's a YYYY-MM-DD format, split it to avoid timezone offsets
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

function EventSkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#1E293B] bg-[#1E293B]/40 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-32 w-full shrink-0 rounded-xl bg-slate-800 sm:w-40" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-3 w-1/4 rounded bg-slate-800" />
          <div className="h-5 w-3/4 rounded bg-slate-800" />
          <div className="h-3 w-1/2 rounded bg-slate-800" />
          <div className="h-4 w-1/3 rounded bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

function EventsSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("All");
  const [events, setEvents] = useState<TicketmasterEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize and run search from URL params on mount or param change
  useEffect(() => {
    const cityParam = searchParams.get("city");
    if (cityParam) {
      setCity(cityParam);
      runSearch(cityParam, date, category);
    }
  }, [searchParams]);

  const runSearch = async (searchCity: string, searchDate: string, searchCategory: string) => {
    if (!searchCity.trim()) return;
    setErrorMsg(null);
    setLoading(true);
    setSearched(true);
    setEvents([]);

    try {
      const params = new URLSearchParams({
        city: searchCity.trim(),
      });
      if (searchDate) {
        params.set("start_date", searchDate);
      }

      const res = await apiFetch<{ events: TicketmasterEvent[] }>(`/explore/events?${params.toString()}`);
      let fetchedEvents = res?.events || [];

      // Filter by category on frontend for high reliability
      if (searchCategory && searchCategory !== "All") {
        fetchedEvents = fetchedEvents.filter((ev) => {
          const cat = (ev.category || "").toLowerCase();
          const target = searchCategory.toLowerCase();
          if (target === "music") return cat.includes("music") || cat.includes("concert") || cat.includes("rock") || cat.includes("pop");
          if (target === "sports") return cat.includes("sports") || cat.includes("athletic") || cat.includes("game") || cat.includes("football") || cat.includes("basketball");
          if (target === "arts") return cat.includes("arts") || cat.includes("theatre") || cat.includes("comedy") || cat.includes("play");
          if (target === "family") return cat.includes("family") || cat.includes("kid");
          return cat.includes(target);
        });
      }

      setEvents(fetchedEvents);
    } catch (e) {
      setEvents([]);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim()) {
      const params = new URLSearchParams();
      params.set("city", city.trim());
      router.push(`/events?${params.toString()}`);
      runSearch(city, date, category);
    }
  };

  return (
    <div className="w-full max-w-4xl mt-4">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-2 rounded-xl bg-[#1E293B] border border-[#334155]/60 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-[#263548] transition active:scale-95 shadow-md"
      >
        &larr; Back
      </button>

      {/* Header with Rovvy Logo */}
      <div className="mb-8 flex flex-col items-center text-center">
        <RovvyLogo variant="dark" size="lg" showTagline={false} />
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-white md:text-3xl bg-gradient-to-r from-teal-200 via-teal-100 to-white bg-clip-text text-transparent">
          Live Events
        </h1>
        <p className="mt-2 text-sm text-[#94A3B8] max-w-md">
          Discover local concerts, high-stakes sports matches, theater, and arts festivals powered by Ticketmaster.
        </p>
      </div>

      {/* Search Form */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#1E293B]/60 p-6 shadow-xl backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4 items-end">
          <div>
            <label htmlFor="city" className="block text-xs font-semibold uppercase tracking-wider text-teal-100/90 mb-1.5">
              City / Destination
            </label>
            <input
              type="text"
              id="city"
              required
              placeholder="e.g. Tokyo, Paris, New York"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-[#334155] bg-[#0F172A] px-4 py-2.5 text-sm text-white placeholder-[#475569] transition focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]/50"
            />
          </div>

          <div>
            <label htmlFor="date" className="block text-xs font-semibold uppercase tracking-wider text-teal-100/90 mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[#334155] bg-[#0F172A] px-4 py-2.5 text-sm text-white transition focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]/50"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-xs font-semibold uppercase tracking-wider text-teal-100/90 mb-1.5">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-[#334155] bg-[#0F172A] px-4 py-2.5 text-sm text-white transition focus:border-[#0F766E] focus:outline-none focus:ring-1 focus:ring-[#0F766E]/50"
            >
              <option value="All">All Categories</option>
              <option value="Music">Music & Concerts</option>
              <option value="Sports">Sports</option>
              <option value="Arts">Arts & Theatre</option>
              <option value="Family">Family & Kids</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#0F766E] px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#115E59] active:scale-95 disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search Events"}
            </button>
          </div>
        </form>
      </div>

      {/* Results Area */}
      <div className="mt-8 space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/40 p-4 text-sm text-rose-300">
            ⚠️ {errorMsg}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <EventSkeletonCard />
            <EventSkeletonCard />
            <EventSkeletonCard />
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center rounded-2xl border border-[#1E293B] bg-[#1E293B]/20 p-12 shadow-inner">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1E293B] text-2xl">
              📅
            </div>
            <h3 className="mt-4 text-base font-bold text-[#F8FAFC]">Ready to Search?</h3>
            <p className="mt-2 text-sm text-[#94A3B8] max-w-sm mx-auto">
              Enter any global city above to find massive live events, ticket listings, and booking details.
            </p>
          </div>
        )}

        {!loading && searched && events.length === 0 && !errorMsg && (
          <div className="text-center rounded-2xl border border-dashed border-[#334155] bg-[#1E293B]/10 p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-900/60 text-2xl">
              🔍
            </div>
            <h3 className="mt-4 text-base font-bold text-amber-200">No Events Found</h3>
            <p className="mt-2 text-sm text-[#94A3B8] max-w-sm mx-auto">
              No events found for this city. Try another city or date.
            </p>
          </div>
        )}

        {!loading && events.length > 0 && (
          <ul className="space-y-4">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="group rounded-2xl border border-[#1E293B] bg-[#1E293B]/60 p-4 shadow-lg hover:border-[#0F766E]/50 hover:bg-[#1E293B]/90 transition"
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  {ev.imageUrl ? (
                    <img
                      src={ev.imageUrl}
                      alt={ev.title}
                      className="h-32 w-full shrink-0 rounded-xl object-cover sm:w-40 border border-[#334155]/40"
                    />
                  ) : (
                    <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-[#1E293B] text-4xl sm:w-40">
                      📅
                    </div>
                  )}
                  
                  <div className="min-w-0 flex-1 flex flex-col justify-between py-1">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#0F766E]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-400 border border-[#0F766E]/30">
                          {ev.category || "General"}
                        </span>
                        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                          Ticketmaster
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-white group-hover:text-teal-300 transition leading-snug line-clamp-1">
                        {ev.title}
                      </h2>
                      <p className="text-sm font-semibold text-teal-100/90 flex items-center gap-1.5">
                        📅 {formatDate(ev.start_date)}
                      </p>
                      {ev.venue && (
                        <p className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                          📍 {ev.venue}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-end sm:mt-0">
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-[#115E59] active:scale-95 shrink-0"
                      >
                        Get Tickets &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#0F172A] px-4 py-8 text-[#F8FAFC] md:px-8 flex flex-col items-center">
      <Suspense fallback={
        <div className="w-full max-w-4xl mt-4 flex flex-col items-center">
          <div className="h-10 w-48 rounded bg-slate-800 animate-pulse mb-8" />
          <div className="w-full h-32 rounded-2xl bg-slate-800 animate-pulse" />
        </div>
      }>
        <EventsSearchContent />
      </Suspense>
    </div>
  );
}
