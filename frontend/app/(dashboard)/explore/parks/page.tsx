"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Star, Info } from "lucide-react";
import { CategoryScrollRow } from "@/components/explorer/CategoryScrollRow";
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
  const gradientClass = "from-emerald-400 to-teal-600";

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
          {item.category || "Parks"}
        </span>
        <span className="absolute right-3 top-3 rounded-lg px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur bg-amber-600/90">
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
              Open daily
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function SeeAllParksPage() {
  const [city, setCity] = useState("Chicago");

  useEffect(() => {
    const savedCity = localStorage.getItem("rovvy_explore_city") || "Chicago";
    setCity(savedCity);
  }, []);

  const items: Partial<ExploreEvent>[] = [
    { id: "p-pk-1", name: "Lincoln Park Conservatory Tour", category: "Parks & Outdoors", venue: "Lincoln Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-pk-2", name: "Garfield Park Lagoon Rowboats", category: "Parks & Outdoors", venue: "Garfield Park", city: "Chicago", price_min: 15, price_max: 25 },
    { id: "p-pk-3", name: "Grant Park Formal Rose Gardens", category: "Parks & Outdoors", venue: "Grant Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-pk-4", name: "Jackson Park Japanese Gardens", category: "Parks & Outdoors", venue: "Jackson Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-pk-5", name: "Promontory Point Beach Picnic", category: "Parks & Outdoors", venue: "Promontory Point", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-pk-6", name: "Maggie Daley Skating Ribbon", category: "Parks & Outdoors", venue: "Maggie Daley Park", city: "Chicago", price_min: 5, price_max: 15 },
    { id: "p-pk-7", name: "Northerly Island Prairie Walk", category: "Parks & Outdoors", venue: "Northerly Island", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-pk-8", name: "Chicago Botanic Garden Paths", category: "Parks & Outdoors", venue: "Glencoe Botanic Garden", city: "Glencoe", price_min: 15, price_max: 20 },
  ];

  const renderRow = (
    title: string,
    subtitle: string,
  ) => {
    return (
      <CategoryScrollRow title={title} subtitle={subtitle}>
        {items.map((item, index) => (
          <div key={`${item.id}-${index}`}>
            <ExploreCard
              item={item as any}
              userCity={city}
              categoryColor="emerald"
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Parks & Outdoors</h1>
          <p className="text-xs text-slate-500">Curated parks in {city}</p>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-blue-800 shadow-sm">
        <Info className="mt-0.5 shrink-0 text-blue-600" size={18} />
        <div>
          <h4 className="text-xs font-bold leading-none mb-1 text-blue-900">Data Coming Soon</h4>
          <p className="text-[11px] leading-relaxed text-blue-700">
            We are currently expanding our network to integrate local parks, conservatories, botanical gardens, and outdoors recreation centers in {city}. Explore the preview destinations below!
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {renderRow("Trending Parks", "Most popular right now")}
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
