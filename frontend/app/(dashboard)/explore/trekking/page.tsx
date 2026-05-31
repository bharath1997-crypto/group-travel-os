"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Star, Info } from "lucide-react";
import {
  cityLabel,
  pseudoRating,
} from "@/lib/explore-events";

const PLACEHOLDERS = [
  { id: "p-tk-1", name: "Starved Rock Canyons Hike", category: "Trekking", venue: "Starved Rock State Park", city: "Oglesby", price_min: 0, price_max: 0, date: "Open daily" },
  { id: "p-tk-2", name: "Waterfall Glen Trail Loop", category: "Trekking", venue: "Waterfall Glen Forest Preserve", city: "Darien", price_min: 0, price_max: 0, date: "Open daily" },
  { id: "p-tk-3", name: "Swallow Cliff Stairclimb", category: "Trekking", venue: "Swallow Cliff Woods", city: "Palos Park", price_min: 0, price_max: 0, date: "Open daily" },
  { id: "p-tk-4", name: "Des Plaines River Kayak Trail", category: "Trekking", venue: "Des Plaines River", city: "Libertyville", price_min: 15, price_max: 30, date: "Seasonal rentals" },
  { id: "p-tk-5", name: "Palos Forest Mountain Biking", category: "Trekking", venue: "Palos Trail System", city: "Palos Heights", price_min: 0, price_max: 0, date: "Open daily" },
];

export default function SeeAllTrekkingPage() {
  const [city, setCity] = useState("Chicago");

  useEffect(() => {
    const savedCity = localStorage.getItem("rovvy_explore_city") || "Chicago";
    setCity(savedCity);
  }, []);

  const renderGrid = (title: string, subtitle: string) => {
    return (
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mb-4 text-xs text-slate-500">{subtitle}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {PLACEHOLDERS.map((ev, index) => {
            const { score, reviews } = pseudoRating(ev as any);
            const fullStars = Math.floor(score);

            return (
              <div
                key={`${ev.id}-${index}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-orange-600 opacity-80">
                    <Calendar size={32} className="text-white opacity-40" />
                  </div>
                  <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-amber-700 shadow-sm backdrop-blur">
                    {ev.category}
                  </span>
                  <span className="absolute right-3 top-3 rounded-lg bg-amber-600/90 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
                    Coming Soon
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h3 className="mb-1 line-clamp-1 text-[13px] font-bold leading-snug text-[#1E293B] group-hover:text-amber-700">
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
                          {ev.venue}
                        </p>
                        <p className="truncate text-[9px] text-[#94A3B8]">
                          {ev.city}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={11} className="shrink-0 text-[#94A3B8]" />
                      <span className="truncate text-[9px] text-[#64748B]">
                        {ev.date}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Trekking & Adventure</h1>
          <p className="text-xs text-slate-500">Curated trails in {city}</p>
        </div>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800 shadow-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
        <div>
          <h4 className="text-sm font-bold">Data Coming Soon</h4>
          <p className="mt-1 text-xs text-blue-700 leading-relaxed">
            We are currently expanding our network to integrate local trail registries, adventure guides, and national parks mapping in {cityLabel(city)}. Explore the preview destinations below!
          </p>
        </div>
      </div>

      <div>
        {renderGrid("Top 100", "The absolute best trail and adventure spots rated by travelers")}
        {renderGrid("Trending", "Currently rising in popularity this week")}
        {renderGrid("This Weekend", "Experiences happening Friday through Sunday")}
        {renderGrid("Upcoming", "Plan ahead for these scheduled experiences")}
        {renderGrid("Regional Picks", "Trails within your immediate area")}
        {renderGrid("International & National Picks", "Standout trails across different travel hubs")}
      </div>
    </div>
  );
}
