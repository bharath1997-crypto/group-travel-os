"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CategoryScrollRow } from "@/components/explorer/CategoryScrollRow";
import { ExploreHeaderFilters } from "@/components/explorer/ExploreHeaderFilters";
import { ExploreCategoryEventCard } from "../components/ExploreCategoryEventCard";
import { CATEGORY_SECTION, stableEventFeed } from "../explore-category-feed";
import {
  type ExploreEvent,
  cityLabel,
  saveEventSnapshot,
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

export default function SeeAllEventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ExploreEvent[]>([]);
  const [nationalPicks, setNationalPicks] = useState<ExploreEvent[]>([]);
  const [city, setCity] = useState("Chicago");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const savedCity = localStorage.getItem("rovvy_explore_city") || "Chicago";
    setCity(savedCity);
  }, []);

  useEffect(() => {
    let active = true;
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
        params.set("city", city);
      }
    } else {
      params.set("city", city);
    }

    setLoading(true);
    apiFetch<EventsAPIResponse>(`/explore/events?${params.toString()}`, {}, 60000)
      .then((data) => {
        if (!active) return;
        const allEvents = data.events || [];
        // Filter for Events (Music, Sports, Festival)
        const filtered = allEvents.filter((ev) =>
          ["music", "sports", "festival"].some((c) =>
            (ev.category || "").toLowerCase().includes(c)
          )
        );
        setEvents(filtered);
        if (data.national) {
          const natFiltered = data.national.filter((ev) =>
            ["music", "sports", "festival"].some((c) =>
              (ev.category || "").toLowerCase().includes(c)
            )
          );
          setNationalPicks(natFiltered);
        }
      })
      .catch((err) => {
        console.error("Failed to load events see-all:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [city]);

  const filteredEvents = useMemo(() => {
    let result = events;
    if (selectedDate) {
      result = result.filter((ev) => {
        if (!ev.date && !ev.start_date) return false;
        const dStr = (ev.date || ev.start_date || "").split("T")[0];
        return dStr === selectedDate;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (ev) =>
          ev.name?.toLowerCase().includes(q) ||
          ev.venue?.toLowerCase().includes(q) ||
          ev.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, selectedDate, searchQuery]);

  const sections = useMemo(() => {
    const trending = stableEventFeed(filteredEvents);

    // 2. This Weekend (Friday through Sunday)
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
    const thisWeekend = filteredEvents.filter((ev) => {
      if (!ev.date) return false;
      const d = new Date(ev.date);
      return d >= today && d <= sunday;
    });

    // 3. Distance bands
    const nearYou = filteredEvents
      .filter((ev) => ev.distance_miles != null && ev.distance_miles <= 10)
      .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));

    const shortDrive = filteredEvents
      .filter((ev) => ev.distance_miles != null && ev.distance_miles > 10 && ev.distance_miles <= 50)
      .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));

    const worthDrive = filteredEvents
      .filter((ev) => ev.distance_miles != null && ev.distance_miles > 50 && ev.distance_miles <= 100)
      .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));

    const roadTrip = filteredEvents
      .filter((ev) => ev.distance_miles != null && ev.distance_miles > 100 && ev.distance_miles <= 200)
      .sort((a, b) => (a.distance_miles ?? 0) - (b.distance_miles ?? 0));

    const nationalBase = nationalPicks.length > 0 ? nationalPicks : events;
    let nationalFiltered = nationalBase;
    if (selectedDate) {
      nationalFiltered = nationalFiltered.filter((ev) => {
        if (!ev.date && !ev.start_date) return false;
        const dStr = (ev.date || ev.start_date || "").split("T")[0];
        return dStr === selectedDate;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      nationalFiltered = nationalFiltered.filter(
        (ev) =>
          ev.name?.toLowerCase().includes(q) ||
          ev.venue?.toLowerCase().includes(q) ||
          ev.category?.toLowerCase().includes(q)
      );
    }
    const national = stableEventFeed(nationalFiltered);

    // 5. International Picks (Placeholder cards for now with "Coming Soon")
    const international: Partial<ExploreEvent>[] = [
      { id: "int-ev-1", name: "Glastonbury Music Festival Headliners", category: "Events", venue: "Worthy Farm", city: "Pilton", price_min: 150, price_max: 350 },
      { id: "int-ev-2", name: "Tomorrowland Electronic Weekend", category: "Events", venue: "De Schorre Recreation Ground", city: "Boom", price_min: 180, price_max: 400 },
      { id: "int-ev-3", name: "Rio de Janeiro Carnaval Parade", category: "Events", venue: "Sambadrome Marquês de Sapucaí", city: "Rio de Janeiro", price_min: 80, price_max: 250 },
      { id: "int-ev-4", name: "Monaco Grand Prix Main Race", category: "Events", venue: "Circuit de Monaco", city: "Monte Carlo", price_min: 200, price_max: 600 },
      { id: "int-ev-5", name: "Sundance Film Festival Screenings", category: "Events", venue: "Egyptian Theatre", city: "Park City", price_min: 25, price_max: 75 },
      { id: "int-ev-6", name: "Montreux Jazz Concert Series", category: "Events", venue: "Auditorium Stravinski", city: "Montreux", price_min: 60, price_max: 180 },
      { id: "int-ev-7", name: "Coachella Valley Music & Arts", category: "Events", venue: "Empire Polo Club", city: "Indio", price_min: 250, price_max: 550 },
      { id: "int-ev-8", name: "Fuji Rock Outdoor Festival", category: "Events", venue: "Naeba Ski Resort", city: "Niigata", price_min: 140, price_max: 300 },
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
      <CategoryScrollRow title={title} subtitle={subtitle}>
        {items.map((item, index) => {
          const cardEl = (
            <ExploreCategoryEventCard
              item={item}
              userCity={city}
              isPlaceholder={isPlaceholder}
              categoryFallback="Events"
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
              onClick={() => saveEventSnapshot(item)}
            >
              {cardEl}
            </Link>
          );
        })}
      </CategoryScrollRow>
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Events</h1>
          <p className="text-xs text-slate-500">Curated events in {city}</p>
        </div>
      </div>

      <ExploreHeaderFilters
        city={city}
        onCityChange={setCity}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        placeholder="Search events..."
        mapCategory="Events"
      />

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-500">Loading live events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">No events found for {city}. Try selecting a different location.</p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover shadow"
          >
            Change Location
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {renderRow(sections.trending, CATEGORY_SECTION.localListings.title, CATEGORY_SECTION.localListings.subtitle)}
          {renderRow(sections.thisWeekend, "This Weekend", "Friday through Sunday")}

          {/* By Distance Section */}
          <div className="border-t border-slate-100 pt-6 mt-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">By Distance</h3>
            {renderRow(sections.nearYou, "Near You", "Within 10 miles")}
            {renderRow(sections.shortDrive, "Short Drive", "10–50 miles")}
            {renderRow(sections.worthDrive, "Worth the Drive", "50–100 miles")}
            {renderRow(sections.roadTrip, "Road Trip", "100–200 miles")}
          </div>

          {renderRow(sections.national, CATEGORY_SECTION.nationalListings.title, CATEGORY_SECTION.nationalListings.subtitle)}
          {renderRow(
            sections.international,
            CATEGORY_SECTION.internationalPreview.title,
            CATEGORY_SECTION.internationalPreview.subtitle,
            true,
          )}
        </div>
      )}
    </div>
  );
}
