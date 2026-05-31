"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Star, Info } from "lucide-react";
import {
  cityLabel,
  pseudoRating,
} from "@/lib/explore-events";

const PLACEHOLDERS = [
  { id: "p-gm-1", name: "Ignite Gaming Esports League", category: "Gaming", venue: "Ignite Gaming Lounge", city: "Chicago", price_min: 10, price_max: 25, date: "Thu-Sat Tourneys" },
  { id: "p-gm-2", name: "Galloping Ghost Retro Arcade", category: "Gaming", venue: "Galloping Ghost Arcade", city: "Brookfield", price_min: 25, price_max: 25, date: "Open daily" },
  { id: "p-gm-3", name: "VR Cyber Arena Tournament", category: "Gaming", venue: "Basecamp Esports", city: "Chicago", price_min: 30, price_max: 50, date: "Weekends only" },
  { id: "p-gm-4", name: "Level Up Boardgames Lounge", category: "Gaming", venue: "Level Up Arcade", city: "Chicago", price_min: 5, price_max: 15, date: "Open daily" },
  { id: "p-gm-5", name: "Sector 23 Immersive VR Quest", category: "Gaming", venue: "Sector 23 VR Lounge", city: "Chicago", price_min: 20, price_max: 40, date: "Reservations required" },
];

export default function SeeAllGamingPage() {
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
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-400 to-fuchsia-600 opacity-80">
                    <Calendar size={32} className="text-white opacity-40" />
                  </div>
                  <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-purple-700 shadow-sm backdrop-blur">
                    {ev.category}
                  </span>
                  <span className="absolute right-3 top-3 rounded-lg bg-amber-600/90 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
                    Coming Soon
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h3 className="mb-1 line-clamp-1 text-[13px] font-bold leading-snug text-[#1E293B] group-hover:text-purple-700">
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Gaming</h1>
          <p className="text-xs text-slate-500">Curated arenas in {city}</p>
        </div>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800 shadow-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
        <div>
          <h4 className="text-sm font-bold">Data Coming Soon</h4>
          <p className="mt-1 text-xs text-blue-700 leading-relaxed">
            We are currently expanding our network to integrate local esports lounges, VR arenas, board game cafes, and gaming arcades in {cityLabel(city)}. Explore the preview destinations below!
          </p>
        </div>
      </div>

      <div>
        {renderGrid("Top 100", "The absolute best gaming spots rated by players")}
        {renderGrid("Trending", "Currently rising in popularity this week")}
        {renderGrid("This Weekend", "Experiences happening Friday through Sunday")}
        {renderGrid("Upcoming", "Plan ahead for these scheduled experiences")}
        {renderGrid("Regional Picks", "Gaming spots within your immediate area")}
        {renderGrid("International & National Picks", "Standout gaming hubs across different travel destinations")}
      </div>
    </div>
  );
}
