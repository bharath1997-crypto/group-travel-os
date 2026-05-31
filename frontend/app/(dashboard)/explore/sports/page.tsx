"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Star } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  type ExploreEvent,
  cityLabel,
  formatDateTime,
  formatLocation,
  formatPrice,
  pseudoRating,
} from "@/lib/explore-events";

type EventsAPIResponse = {
  city: string;
  display_city?: string;
  events: ExploreEvent[];
  trending?: ExploreEvent[];
  weekend?: ExploreEvent[];
  popular?: ExploreEvent[];
  national?: ExploreEvent[];
};

export default function SeeAllSportsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ExploreEvent[]>([]);
  const [nationalPicks, setNationalPicks] = useState<ExploreEvent[]>([]);
  const [city, setCity] = useState("Chicago");

  useEffect(() => {
    let active = true;
    const savedCity = localStorage.getItem("rovvy_explore_city") || "Chicago";
    setCity(savedCity);

    const coordsRaw = localStorage.getItem("rovvy_explore_coords");
    const params = new URLSearchParams({ per_page: "100" });

    if (coordsRaw) {
      try {
        const coords = JSON.parse(coordsRaw);
        if (coords.lat && coords.lon) {
          params.set("lat", String(coords.lat));
          params.set("lon", String(coords.lon));
          params.set("radius", "200");
        }
      } catch (e) {
        params.set("city", savedCity);
      }
    } else {
      params.set("city", savedCity);
    }

    setLoading(true);
    apiFetch<EventsAPIResponse>(`/explore/events?${params.toString()}`, {}, 60000)
      .then((data) => {
        if (!active) return;
        const allEvents = data.events || [];
        // Filter for Sports
        const filtered = allEvents.filter((ev) =>
          (ev.category || "").toLowerCase().includes("sports")
        );
        setEvents(filtered);
        if (data.national) {
          const natFiltered = data.national.filter((ev) =>
            (ev.category || "").toLowerCase().includes("sports")
          );
          setNationalPicks(natFiltered);
        }
      })
      .catch((err) => {
        console.error("Failed to load sports see-all:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sections = useMemo(() => {
    // 1. Top 100
    const top100 = [...events]
      .map(ev => ({ ev, score: pseudoRating(ev).score }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.ev)
      .slice(0, 100);

    // 2. Trending
    const trending = events.slice(0, 15);

    // 3. This Weekend
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
    const thisWeekend = events.filter((ev) => {
      if (!ev.date) return false;
      const d = new Date(ev.date);
      return d >= today && d <= sunday;
    });

    // 4. Upcoming
    const upcoming = events.filter((ev) => {
      if (!ev.date) return true;
      const d = new Date(ev.date);
      return d > sunday;
    });

    // 5. Regional
    const regional = events.filter((ev) =>
      (ev.city || "").toLowerCase().includes(cityLabel(city).toLowerCase())
    );

    // 6. International
    const international = nationalPicks.length > 0 ? nationalPicks : events.slice().reverse();

    return {
      top100,
      trending,
      thisWeekend,
      upcoming,
      regional,
      international,
    };
  }, [events, nationalPicks, city]);

  const renderGrid = (items: ExploreEvent[], title: string, subtitle: string) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mb-4 text-xs text-slate-500">{subtitle}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.slice(0, 10).map((ev, index) => {
            const { score, reviews } = pseudoRating(ev);
            const fullStars = Math.floor(score);
            const location = formatLocation(ev, city);
            const price = formatPrice(ev);

            return (
              <Link
                key={`${ev.id}-${index}`}
                href={`/explore/event/${encodeURIComponent(ev.id)}?city=${encodeURIComponent(cityLabel(city))}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  {ev.image_url ? (
                    <img
                      src={ev.image_url}
                      alt={ev.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-400 to-violet-600 opacity-80">
                      <Calendar size={32} className="text-white opacity-40" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-teal-700 shadow-sm backdrop-blur">
                    {ev.category}
                  </span>
                  <span className="absolute right-3 top-3 rounded-lg bg-[#1E293B]/85 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
                    {price}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h3 className="mb-1 line-clamp-1 text-[13px] font-bold leading-snug text-[#1E293B] group-hover:text-teal-700">
                    {ev.name}
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
                    {ev.date && (
                      <div className="flex items-center gap-1">
                        <Calendar size={11} className="shrink-0 text-[#94A3B8]" />
                        <span className="truncate text-[9px] text-[#64748B]">
                          {formatDateTime(ev)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-[#F8FAFC] min-h-screen">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/explore"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Sports & Fitness</h1>
          <p className="text-xs text-slate-500">Curated highlights in {city}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-500">Loading live sports events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">No sports events found for {city}. Try selecting a different location.</p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow"
          >
            Change Location
          </Link>
        </div>
      ) : (
        <div>
          {renderGrid(sections.top100, "Top 100", "The absolute best sports events rated by fans")}
          {renderGrid(sections.trending, "Trending", "Currently rising in popularity this week")}
          {renderGrid(sections.thisWeekend, "This Weekend", "Sports events happening Friday through Sunday")}
          {renderGrid(sections.upcoming, "Upcoming", "Plan ahead for these scheduled games")}
          {renderGrid(sections.regional, "Regional Picks", `Sports matches within your immediate area`)}
          {renderGrid(sections.international, "International & National Picks", "Standout sports matches across different stadiums")}
        </div>
      )}
    </div>
  );
}
