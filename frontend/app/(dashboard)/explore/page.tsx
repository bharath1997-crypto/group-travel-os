"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ExploreHubPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<"global" | "local">("global");

  const popularChips = ["Paris", "Tokyo", "New York", "Bali", "London", "Dubai"];

  const globalTrending = [
    {
      city: "Tokyo",
      country: "Japan",
      image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400",
      wealthIndex: "9.8/10",
      wealthTier: "Premium",
      safety: "Ultra-High (#1)",
      costTier: "Luxury",
    },
    {
      city: "Paris",
      country: "France",
      image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400",
      wealthIndex: "9.5/10",
      wealthTier: "Premium",
      safety: "High (#5)",
      costTier: "Premium",
    },
    {
      city: "Bali",
      country: "Indonesia",
      image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400",
      wealthIndex: "4.5/10",
      wealthTier: "Value",
      safety: "Moderate (#12)",
      costTier: "Budget-Friendly",
    },
  ];

  const localTrending = [
    {
      city: "New York",
      country: "USA",
      image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400",
      wealthIndex: "9.9/10",
      wealthTier: "Ultra-Premium",
      safety: "High (#8)",
      costTier: "Luxury",
    },
    {
      city: "Chicago",
      country: "USA",
      image: "https://images.unsplash.com/photo-1494522358652-f30e61a60313?w=400",
      wealthIndex: "9.2/10",
      wealthTier: "Premium",
      safety: "Moderate (#15)",
      costTier: "Moderate",
    },
    {
      city: "Miami",
      country: "USA",
      image: "https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=400",
      wealthIndex: "9.4/10",
      wealthTier: "Premium-Luxury",
      safety: "High (#10)",
      costTier: "Premium",
    },
  ];

  const activeDestinations = scope === "global" ? globalTrending : localTrending;

  const quickLinks = [
    {
      href: "/activities",
      emoji: "🎯",
      title: "Activities",
      desc: "Tours, attractions & skip-the-line experiences",
    },
    {
      href: "/events",
      emoji: "📅",
      title: "Events",
      desc: "Concerts, sports matches & festivals near you",
    },
    {
      href: "/weather",
      emoji: "🌤️",
      title: "Weather",
      desc: "Granular weather tracking & trip forecasts",
    },
    {
      href: "/buddy",
      emoji: "👥",
      title: "Buddy Trips",
      desc: "Coordinated travel plans & group activities",
    },
  ];

  const [searchType, setSearchType] = useState<"events" | "activities">("events");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (searchType === "activities") {
        router.push(`/activities?city=${encodeURIComponent(searchQuery.trim())}`);
      } else {
        router.push(`/events?city=${encodeURIComponent(searchQuery.trim())}`);
      }
    }
  };

  const handleChipClick = (city: string) => {
    if (searchType === "activities") {
      router.push(`/activities?city=${encodeURIComponent(city)}`);
    } else {
      router.push(`/events?city=${encodeURIComponent(city)}`);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#0F172A] text-[#F8FAFC] pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#1E293B] to-[#0F172A] py-16 px-4 text-center md:py-24">
        {/* Background glow effects */}
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#0F766E]/15 blur-3xl" />
        
        <div className="relative mx-auto max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl bg-gradient-to-r from-teal-200 via-teal-100 to-white bg-clip-text text-transparent">
            Roam Together, Explore Deeper
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[#94A3B8] md:text-lg">
            Discover real-time local events, premium activities, and travel weather updates. Plan your next group experience seamlessly.
          </p>

          {/* Hero Search Bar */}
          <form onSubmit={handleSearchSubmit} className="mx-auto mt-8 max-w-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:rounded-2xl sm:border sm:border-[#334155] sm:bg-[#0F172A] sm:p-1.5 focus-within:ring-2 focus-within:ring-[#0F766E]/50">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as "events" | "activities")}
                className="bg-[#0F172A] sm:bg-transparent text-xs font-semibold text-teal-400 border border-[#334155] sm:border-0 rounded-xl px-3 py-2.5 outline-none cursor-pointer focus:ring-0 shrink-0 border-r sm:border-r-[#334155]/60 hover:text-white transition"
              >
                <option value="events" className="bg-[#1E293B]">📅 Events</option>
                <option value="activities" className="bg-[#1E293B]">🎯 Activities</option>
              </select>
              <input
                type="text"
                placeholder="Where do you want to go?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#334155] bg-[#0F172A] px-4 py-3 text-sm text-white placeholder-[#475569] outline-none sm:border-0 sm:bg-transparent focus:ring-0"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#0F766E] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#115E59] active:scale-95 shrink-0"
              >
                Search
              </button>
            </div>
          </form>

          {/* Popular Destination Chips */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mr-2">Popular:</span>
            {popularChips.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleChipClick(city)}
                className="rounded-full border border-[#334155] bg-[#1E293B] px-3.5 py-1 text-xs font-medium text-slate-300 hover:border-[#0F766E] hover:text-[#CCFBF1] hover:bg-[#1E293B]/80 transition"
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="mx-auto max-w-5xl px-4 md:px-8 mt-12 space-y-16">
        
        {/* Section 2: Trending Destinations (With scope sidebar control panel) */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-[#1E293B] pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl text-white">
                Trending Destinations
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Handpicked global and regional hotspots ranked by wealth, safety, and popularity.
              </p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-4 items-start">
            {/* Left Main Column: Destination Cards */}
            <div className="lg:col-span-3 grid gap-6 sm:grid-cols-3">
              {activeDestinations.map((dest) => (
                <div
                  key={dest.city}
                  className="group relative overflow-hidden rounded-2xl border border-[#1E293B] bg-[#1E293B] transition duration-300 hover:shadow-xl hover:border-[#0F766E]/50 flex flex-col justify-between h-[360px]"
                >
                  {/* Image container */}
                  <div className="relative h-40 overflow-hidden shrink-0">
                    <img
                      src={dest.image}
                      alt={dest.city}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/85 to-transparent" />
                    
                    {/* Country badge */}
                    <span className="absolute top-3 left-3 rounded-full bg-[#0F172A]/70 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal-300 backdrop-blur-sm">
                      {dest.country}
                    </span>

                    {/* Cost Tier Badge */}
                    <span className="absolute top-3 right-3 rounded-full bg-[#0F766E]/80 px-2.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                      {dest.costTier}
                    </span>
                  </div>

                  {/* Content Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-teal-300 transition">
                          {dest.city}
                        </h3>
                        <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
                          {scope === "global" ? "Global Scope" : "Local Scope"}
                        </p>
                      </div>

                      {/* Wealth & Safety Stats */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#0F172A]/60 p-2.5 border border-[#334155]/20">
                        <div>
                          <p className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">Wealth Index</p>
                          <p className="text-xs font-bold text-teal-400">{dest.wealthIndex}</p>
                          <span className="text-[8px] text-slate-400">{dest.wealthTier}</span>
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wider">Safety Rating</p>
                          <p className="text-xs font-bold text-emerald-400">{dest.safety}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleChipClick(dest.city)}
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#0F172A] px-4 py-2 text-xs font-bold text-teal-400 border border-[#334155]/60 hover:bg-[#0F766E] hover:text-white hover:border-[#0F766E] transition w-full active:scale-95"
                    >
                      Explore Events &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Sidebar Column: Interactive Scope Toggle Control */}
            <div className="lg:col-span-1 rounded-2xl border border-[#1E293B] bg-[#1E293B]/70 p-5 shadow-xl space-y-4">
              <div className="space-y-1">
                <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-400 border border-teal-500/20">
                  Interactive Scope Panel
                </span>
                <h3 className="text-sm font-bold text-white mt-1">Discover Scope</h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Switch the destination search scope between global hotspots and local regional hubs.
                </p>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScope("global")}
                  className={`w-full text-left rounded-xl px-3.5 py-3 text-xs font-bold transition flex items-center justify-between border ${
                    scope === "global"
                      ? "bg-[#0F766E] text-white border-[#0F766E] shadow-lg shadow-teal-900/20"
                      : "bg-[#0F172A] text-slate-300 border-[#334155]/65 hover:bg-[#1E293B]"
                  }`}
                >
                  <span>🌍 Globally</span>
                  <span className="text-[10px] opacity-80 uppercase tracking-widest font-normal">Country Scope</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope("local")}
                  className={`w-full text-left rounded-xl px-3.5 py-3 text-xs font-bold transition flex items-center justify-between border ${
                    scope === "local"
                      ? "bg-[#0F766E] text-white border-[#0F766E] shadow-lg shadow-teal-900/20"
                      : "bg-[#0F172A] text-slate-300 border-[#334155]/65 hover:bg-[#1E293B]"
                  }`}
                >
                  <span>📍 Locally</span>
                  <span className="text-[10px] opacity-80 uppercase tracking-widest font-normal">In-Country Scope</span>
                </button>
              </div>

              {/* Stats & Rank Breakdown */}
              <div className="rounded-xl bg-[#0F172A] p-3 space-y-2 text-[11px] border border-[#334155]/30">
                <p className="font-semibold text-slate-400">Scope Overview</p>
                <p className="text-slate-300 leading-relaxed">
                  {scope === "global"
                    ? "Currently showing international powerhouse cities. Top ranking regions mapped country-by-country."
                    : "Currently showing high-ranking regional hubs inside the US. Ideal for localized trips and events."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Quick Links */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight md:text-2xl text-white">
              Discover Experiences
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Browse activities, weather, schedules, and buddies.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-start gap-4 rounded-2xl border border-[#1E293B] bg-[#1E293B] p-5 shadow-lg transition hover:border-[#0F766E]/50 hover:bg-[#263548]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-2xl transition group-hover:bg-[#0F766E]/20">
                  {link.emoji}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white group-hover:text-[#CCFBF1] transition">
                    {link.title}
                  </h3>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {link.desc}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-[#0F766E] group-hover:text-teal-400 transition">
                    Go to {link.title} &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
