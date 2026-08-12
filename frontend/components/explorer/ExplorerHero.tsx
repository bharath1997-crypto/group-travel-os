"use client";

import { useEffect, useState } from "react";
import { Search, MapPin, Sparkles } from "lucide-react";
import { LocationPicker } from "@/components/explorer/LocationPicker";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=1600&auto=format&fit=crop&q=80",
];

type ExplorerHeroProps = {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  onSearch: () => void;
  onNearMe: () => void;
  onAskWayra: () => void;
};

export function ExplorerHero({
  searchQuery,
  onSearchChange,
  selectedCity,
  onCityChange,
  onSearch,
  onNearMe,
  onAskWayra,
}: ExplorerHeroProps) {
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative w-full h-[360px] md:h-[420px] overflow-hidden select-none bg-slate-900">
      {HERO_IMAGES.map((img, idx) => (
        <div
          key={img}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === heroIdx ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt="Travel Destination"
            className="w-full h-full object-cover"
            loading={idx === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/10 z-20 pointer-events-none" />

      <div className="absolute inset-0 flex flex-col justify-center items-center px-6 z-30 text-center">
        <div className="max-w-3xl w-full mx-auto space-y-3 mb-5">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-white text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Discover group experiences near you
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-md leading-tight">
            Find your next group adventure
          </h1>
          <p className="text-sm md:text-base text-slate-200 font-medium max-w-2xl mx-auto drop-shadow-sm leading-relaxed">
            Discover places, events, food, parks, nightlife, and experiences for every trip.
          </p>
        </div>

        {/* Search bar */}
        <div className="max-w-3xl w-full mx-auto">
          <div className="flex flex-col md:flex-row items-stretch gap-2 bg-white p-1.5 rounded-2xl md:rounded-full shadow-xl border border-white/60">
            <div className="flex items-center gap-2 flex-1 px-3 py-1.5 md:py-0">
              <Search className="text-slate-400 shrink-0" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder="Search destinations, events, restaurants, activities..."
                className="bg-transparent border-none outline-none text-slate-800 text-sm w-full focus:ring-0 placeholder-slate-400 font-medium"
              />
            </div>

            <div className="hidden md:block h-8 w-px bg-slate-200 self-center" />

            <div className="shrink-0 flex items-center px-2 py-1.5 md:py-0">
              <LocationPicker currentCity={selectedCity} onCityChange={onCityChange} />
            </div>

            <div className="flex items-center gap-2 px-1 pb-1.5 md:pb-0 md:px-0">
              <button
                onClick={onSearch}
                className="flex-1 md:flex-none bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2.5 rounded-xl md:rounded-full transition-colors flex items-center justify-center gap-2 shadow-md text-sm"
              >
                <Search size={15} />
                <span>Search</span>
              </button>

              <button
                onClick={onNearMe}
                className="flex-1 md:flex-none bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3 py-2.5 rounded-xl md:rounded-full border border-slate-200 transition-colors flex items-center justify-center gap-1.5 text-sm"
              >
                <MapPin size={14} className="text-primary" />
                Near Me
              </button>

              <button
                onClick={onAskWayra}
                className="flex-1 md:flex-none bg-gradient-to-r from-violet-500 to-teal-500 hover:from-violet-600 hover:to-teal-600 text-white font-semibold px-3 py-2.5 rounded-xl md:rounded-full transition-all flex items-center justify-center gap-1.5 text-sm shadow-md"
              >
                <Sparkles size={14} />
                Ask Wayra
              </button>
            </div>
          </div>
        </div>

        {/* Hero dot indicators */}
        <div className="flex items-center gap-1.5 mt-4">
          {HERO_IMAGES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setHeroIdx(idx)}
              className={`transition-all rounded-full ${
                idx === heroIdx ? "w-6 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
