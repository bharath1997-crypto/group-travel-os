"use client";

import { useState } from "react";
import { RovvyLogo } from "@/components/RovvyLogo";

export default function EventsPage() {
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("all");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#0F172A] px-4 py-8 text-[#F8FAFC] md:px-8 flex flex-col items-center">
      <div className="w-full max-w-2xl mt-4">
        {/* Header with Rovvy Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <RovvyLogo variant="dark" size="lg" showTagline={false} />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white md:text-3xl">
            Events
          </h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Discover events at your destination
          </p>
        </div>

        {/* Search Form */}
        <div className="rounded-2xl border border-[#1E293B] bg-[#1E293B]/60 p-6 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="city" className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                City / Destination
              </label>
              <input
                type="text"
                id="city"
                placeholder="e.g. San Francisco"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-[#334155] bg-[#0F172A] px-4 py-2.5 text-sm text-white placeholder-[#475569] transition focus:border-[#0F766E] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Date
              </label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-[#334155] bg-[#0F172A] px-4 py-2.5 text-sm text-white placeholder-[#475569] transition focus:border-[#0F766E] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-[#334155] bg-[#0F172A] px-4 py-2.5 text-sm text-white transition focus:border-[#0F766E] focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="music">Music & Concerts</option>
                <option value="sports">Sports</option>
                <option value="arts">Arts & Theatre</option>
                <option value="food">Food & Drink</option>
                <option value="business">Conferences & Tech</option>
              </select>
            </div>
          </form>
        </div>

        {/* Results Area */}
        <div className="mt-8 text-center rounded-2xl border border-[#1E293B] bg-[#1E293B]/20 p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1E293B] text-xl">
            📅
          </div>
          <p className="mt-4 text-sm font-semibold text-[#94A3B8]">
            No events found yet — enter a city to search
          </p>
        </div>
      </div>
    </div>
  );
}
