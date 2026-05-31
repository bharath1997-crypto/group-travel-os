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

function ExploreCard({
  item,
  userCity,
  categoryColor,
  isPlaceholder,
}: {
  item: Partial<ExploreEvent> & { id: string; name: string };
  userCity: string;
  categoryColor: string;
  isPlaceholder?: boolean;
}) {
  const { score, reviews } = pseudoRating(item as ExploreEvent);
  const fullStars = Math.floor(score);
  const location = isPlaceholder
    ? { primary: item.venue || "", secondary: item.city || "" }
    : formatLocation(item as ExploreEvent, userCity);
  const price = isPlaceholder ? "Coming Soon" : formatPrice(item as ExploreEvent);
  const gradientClass =
    categoryColor === "teal" ? "from-teal-400 to-emerald-600" :
    categoryColor === "blue" ? "from-blue-400 to-indigo-600" :
    categoryColor === "rose" ? "from-rose-400 to-pink-600" :
    categoryColor === "amber" ? "from-amber-400 to-orange-600" :
    categoryColor === "purple" ? "from-purple-400 to-fuchsia-600" :
    categoryColor === "sky" ? "from-sky-400 to-blue-600" :
    categoryColor === "orange" ? "from-orange-400 to-red-600" :
    categoryColor === "emerald" ? "from-emerald-400 to-teal-600" :
    categoryColor === "fuchsia" ? "from-fuchsia-400 to-rose-600" :
    categoryColor === "indigo" ? "from-indigo-400 to-violet-600" :
    "from-violet-400 to-purple-600";

  return (
    <article
      className="group flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
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
          {item.category || "Sports"}
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
          <div className="flex items-center gap-1">
            <Calendar size={11} className="shrink-0 text-[#94A3B8]" />
            <span className="truncate text-[9px] text-[#64748B]">
              {item.date ? formatDateTime(item as ExploreEvent) : "Open daily"}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

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
    // 1. Trending (Sorted by rating DESC, no limit)
    const trending = [...events].sort((a, b) => pseudoRating(b).score - pseudoRating(a).score);

    // 2. This Weekend (Friday through Sunday)
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
    const thisWeekend = events.filter((ev) => {
      if (!ev.date) return false;
      const d = new Date(ev.date);
      return d >= today && d <= sunday;
    });

    // 3. Distance bands
    const nearYou = events
      .filter((ev) => ev.distance_miles != null && ev.distance_miles <= 10)
      .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));

    const shortDrive = events
      .filter((ev) => ev.distance_miles != null && ev.distance_miles > 10 && ev.distance_miles <= 50)
      .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));

    const worthDrive = events
      .filter((ev) => ev.distance_miles != null && ev.distance_miles > 50 && ev.distance_miles <= 100)
      .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));

    const roadTrip = events
      .filter((ev) => ev.distance_miles != null && ev.distance_miles > 100 && ev.distance_miles <= 200)
      .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));

    // 4. National Picks (Sorted by rating DESC, no distance filter)
    const national = (nationalPicks.length > 0 ? nationalPicks : events)
      .slice()
      .sort((a, b) => pseudoRating(b).score - pseudoRating(a).score);

    // 5. International Picks (Placeholder cards for now with "Coming Soon")
    const international: Partial<ExploreEvent>[] = [
      { id: "int-sp-1", name: "Premier League Derby Match", category: "Sports", venue: "Wembley Stadium", city: "London", price_min: 65, price_max: 180 },
      { id: "int-sp-2", name: "El Clásico Football Championship", category: "Sports", venue: "Santiago Bernabéu", city: "Madrid", price_min: 90, price_max: 250 },
      { id: "int-sp-3", name: "Wimbledon Men's Finals", category: "Sports", venue: "All England Club", city: "Wimbledon", price_min: 150, price_max: 450 },
      { id: "int-sp-4", name: "Formula 1 Grand Prix de Monaco", category: "Sports", venue: "Monaco Marina Circuit", city: "Monte Carlo", price_min: 250, price_max: 750 },
      { id: "int-sp-5", name: "NBA Global Games Exhibition", category: "Sports", venue: "Accor Arena", city: "Paris", price_min: 80, price_max: 220 },
      { id: "int-sp-6", name: "Rugby World Cup Group Stage", category: "Sports", venue: "Stade de France", city: "Saint-Denis", price_min: 45, price_max: 120 },
      { id: "int-sp-7", name: "Melbourne Cup Spring Carnival", category: "Sports", venue: "Flemington Racecourse", city: "Melbourne", price_min: 30, price_max: 95 },
      { id: "int-sp-8", name: "Super Bowl Global Watch Party", category: "Sports", venue: "O2 Arena Screenings", city: "London", price_min: 20, price_max: 45 },
    ];

    return {
      trending,
      thisWeekend,
      nearYou,
      shortDrive,
      worthDrive,
      roadTrip,
      national,
      international,
    };
  }, [events, nationalPicks]);

  const renderRow = (
    items: Array<any>,
    title: string,
    subtitle: string,
    isPlaceholder = false
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8">
        <h2 className="text-base font-bold text-slate-900 leading-snug">{title}</h2>
        <p className="mb-3.5 text-xs text-slate-500">{subtitle}</p>
        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
          {items.map((item, index) => {
            const cardEl = (
              <ExploreCard
                item={item}
                userCity={city}
                categoryColor="indigo"
                isPlaceholder={isPlaceholder}
              />
            );
            if (isPlaceholder) {
              return <div key={`${item.id}-${index}`}>{cardEl}</div>;
            }
            return (
              <Link
                key={`${item.id}-${index}`}
                href={`/explore/event/${encodeURIComponent(item.id)}?city=${encodeURIComponent(cityLabel(city))}`}
                className="block shrink-0"
              >
                {cardEl}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/explore"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Sports</h1>
          <p className="text-xs text-slate-500">Curated sports in {city}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-500">Loading live sports...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">No sports found for {city}. Try selecting a different location.</p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow"
          >
            Change Location
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {renderRow(sections.trending, "Trending Sports", "Most popular right now")}
          {renderRow(sections.thisWeekend, "This Weekend", "Friday through Sunday")}

          {/* By Distance Section */}
          <div className="border-t border-slate-100 pt-6 mt-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">By Distance</h3>
            {renderRow(sections.nearYou, "Near You", "Within 10 miles")}
            {renderRow(sections.shortDrive, "Short Drive", "10–50 miles")}
            {renderRow(sections.worthDrive, "Worth the Drive", "50–100 miles")}
            {renderRow(sections.roadTrip, "Road Trip", "100–200 miles")}
          </div>

          {renderRow(sections.national, "National Picks", "Best across the country")}
          {renderRow(sections.international, "International", "Trending around the world", true)}
        </div>
      )}
    </div>
  );
}
