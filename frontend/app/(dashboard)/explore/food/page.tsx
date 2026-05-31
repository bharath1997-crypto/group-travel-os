"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Star, Info } from "lucide-react";
import {
  cityLabel,
  pseudoRating,
} from "@/lib/explore-events";

const PLACEHOLDERS = [
  { id: "p-fd-1", name: "Alinea Michelin Dinner", category: "Food & Drink", venue: "Alinea", city: "Chicago", price_min: 250, price_max: 450, date: "Reservations required" },
  { id: "p-fd-2", name: "Lou Malnati's Deep Dish Workshop", category: "Food & Drink", venue: "Lou Malnati's", city: "Chicago", price_min: 30, price_max: 50, date: "Saturdays only" },
  { id: "p-fd-3", name: "Pequod's Pizza Tasting", category: "Food & Drink", venue: "Pequod's Pizza", city: "Chicago", price_min: 25, price_max: 40, date: "Open daily" },
  { id: "p-fd-4", name: "Girl & The Goat Chef's Table", category: "Food & Drink", venue: "Girl & The Goat", city: "Chicago", price_min: 80, price_max: 150, date: "Reservations recommended" },
  { id: "p-fd-5", name: "Au Cheval Legendary Burger Night", category: "Food & Drink", venue: "Au Cheval", city: "Chicago", price_min: 18, price_max: 30, date: "Open daily" },
];

export default function SeeAllFoodPage() {
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
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-red-600 opacity-80">
                    <Calendar size={32} className="text-white opacity-40" />
                  </div>
                  <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-orange-700 shadow-sm backdrop-blur">
                    {ev.category}
                  </span>
                  <span className="absolute right-3 top-3 rounded-lg bg-amber-600/90 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
                    Coming Soon
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h3 className="mb-1 line-clamp-1 text-[13px] font-bold leading-snug text-[#1E293B] group-hover:text-orange-700">
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Restaurants & Food</h1>
          <p className="text-xs text-slate-500">Curated dining in {city}</p>
        </div>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800 shadow-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
        <div>
          <h4 className="text-sm font-bold">Data Coming Soon</h4>
          <p className="mt-1 text-xs text-blue-700 leading-relaxed">
            We are currently expanding our network to integrate local restaurant reviews, table reservation services, and food tasting tours in {cityLabel(city)}. Explore the preview destinations below!
          </p>
        </div>
      </div>

      <div>
        {renderGrid("Top 100", "The absolute best restaurants and food experiences rated by foodies")}
        {renderGrid("Trending", "Currently rising in popularity this week")}
        {renderGrid("This Weekend", "Experiences happening Friday through Sunday")}
        {renderGrid("Upcoming", "Plan ahead for these scheduled experiences")}
        {renderGrid("Regional Picks", "Dining within your immediate area")}
        {renderGrid("International & National Picks", "Standout dining spots across different travel hubs")}
      </div>
    </div>
  );
}
