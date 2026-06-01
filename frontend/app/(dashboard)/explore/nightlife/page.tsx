"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Star, Info } from "lucide-react";
import { CategoryScrollRow } from "@/components/explorer/CategoryScrollRow";
import { ExploreCardImage } from "@/components/explorer/ExploreCardImage";
import { ExploreHeaderFilters } from "@/components/explorer/ExploreHeaderFilters";
import {
  type ExploreEvent,
  pseudoRating,
} from "@/lib/explore-events";

function ExploreCard({
  item,
  userCity,
  categoryColor,
  isPlaceholder = true,
}: {
  item: Partial<ExploreEvent> & { id: string; name: string };
  userCity: string;
  categoryColor: string;
  isPlaceholder?: boolean;
}) {
  const { score, reviews } = pseudoRating(item as ExploreEvent);
  const fullStars = Math.floor(score);
  const location = { primary: item.venue || "", secondary: item.city || "" };
  const price = "Coming Soon";

  return (
    <article
      className="group flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
    >
      <ExploreCardImage
        imageUrl={item.image_url}
        alt={item.name}
        category={item.category}
      >
        <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-teal-700 shadow-sm backdrop-blur">
          {item.category || "Nightlife"}
        </span>
        <span className="absolute right-3 top-3 rounded-lg px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur bg-amber-600/90">
          {price}
        </span>
      </ExploreCardImage>

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
              Open daily
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function SeeAllNightlifePage() {
  const [city, setCity] = useState("Chicago");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const savedCity = localStorage.getItem("rovvy_explore_city") || "Chicago";
    setCity(savedCity);
  }, []);

  const items: Partial<ExploreEvent>[] = [
    { id: "p-nl-1", name: "Green Mill Jazz Club Live", category: "Nightlife", venue: "Green Mill", city: "Chicago", price_min: 15, price_max: 25 },
    { id: "p-nl-2", name: "Kingston Mines Late Night Blues", category: "Nightlife", venue: "Kingston Mines", city: "Chicago", price_min: 15, price_max: 20 },
    { id: "p-nl-3", name: "Smartbar Electronic Dance Night", category: "Nightlife", venue: "Smartbar", city: "Chicago", price_min: 10, price_max: 30 },
    { id: "p-nl-4", name: "Untouchable Gangster Bus Tour", category: "Nightlife", venue: "Chicago Gangster Spots", city: "Chicago", price_min: 35, price_max: 45 },
    { id: "p-nl-5", name: "Taiga Craft Cocktails Lounge", category: "Nightlife", venue: "Taiga Lounge", city: "Chicago", price_min: 20, price_max: 40 },
    { id: "p-nl-6", name: "The Whistler Mixology & Jazz", category: "Nightlife", venue: "The Whistler", city: "Chicago", price_min: 15, price_max: 25 },
    { id: "p-nl-7", name: "Andy's Jazz Club Dinner Show", category: "Nightlife", venue: "Andy's Jazz", city: "Chicago", price_min: 20, price_max: 50 },
    { id: "p-nl-8", name: "Beauty Bar Dance Social Night", category: "Nightlife", venue: "Beauty Bar Chicago", city: "Chicago", price_min: 10, price_max: 15 },
  ];

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedDate) {
      result = result.filter((ev) => {
        if (!ev.date && !ev.start_date) return true; // nightlife spots are open daily
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
          ev.city?.toLowerCase().includes(q) ||
          ev.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [selectedDate, searchQuery]);

  const renderRow = (
    title: string,
    subtitle: string,
  ) => {
    return (
      <CategoryScrollRow title={title} subtitle={subtitle}>
        {filteredItems.map((item, index) => (
          <div key={`${item.id}-${index}`}>
            <ExploreCard
              item={item as any}
              userCity={city}
              categoryColor="indigo"
              isPlaceholder={true}
            />
          </div>
        ))}
      </CategoryScrollRow>
    );
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/explore"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Nightlife</h1>
          <p className="text-xs text-slate-500">Curated nightlife in {city}</p>
        </div>
      </div>

      <ExploreHeaderFilters
        city={city}
        onCityChange={setCity}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        placeholder="Search nightlife..."
      />

      {/* Info Alert */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-blue-800 shadow-sm">
        <Info className="mt-0.5 shrink-0 text-blue-600" size={18} />
        <div>
          <h4 className="text-xs font-bold leading-none mb-1 text-blue-900">Data Coming Soon</h4>
          <p className="text-[11px] leading-relaxed text-blue-700">
            We are currently expanding our network to integrate local music clubs, lounges, bars, and late night event hosts in {city}. Explore the preview destinations below!
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {renderRow("Trending Nightlife", "Most popular right now")}
        {renderRow("This Weekend", "Friday through Sunday")}

        {/* By Distance Section */}
        <div className="border-t border-slate-100 pt-6 mt-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">By Distance</h3>
          {renderRow("Near You", "Within 10 miles")}
          {renderRow("Short Drive", "10–50 miles")}
          {renderRow("Worth the Drive", "50–100 miles")}
          {renderRow("Road Trip", "100–200 miles")}
        </div>

        {renderRow("National Picks", "Best across the country")}
        {renderRow("International", "Trending around the world")}
      </div>
    </div>
  );
}
