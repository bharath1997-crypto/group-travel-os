"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { CategoryScrollRow } from "@/components/explorer/CategoryScrollRow";
import { ExploreHeaderFilters } from "@/components/explorer/ExploreHeaderFilters";
import { type ExploreEvent } from "@/lib/explore-events";
import { ExploreCategoryEventCard } from "../components/ExploreCategoryEventCard";
import { CATEGORY_SECTION } from "../explore-category-feed";


export default function SeeAllGamingPage() {
  const [city, setCity] = useState("Chicago");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const savedCity = localStorage.getItem("rovvy_explore_city") || "Chicago";
    setCity(savedCity);
  }, []);

  const items: Partial<ExploreEvent>[] = [
    { id: "p-gm-1", name: "Ignite Gaming Esports League", category: "Gaming", venue: "Ignite Gaming Lounge", city: "Chicago", price_min: 10, price_max: 25 },
    { id: "p-gm-2", name: "Galloping Ghost Retro Arcade", category: "Gaming", venue: "Galloping Ghost Arcade", city: "Brookfield", price_min: 25, price_max: 25 },
    { id: "p-gm-3", name: "VR Cyber Arena Tournament", category: "Gaming", venue: "Basecamp Esports", city: "Chicago", price_min: 30, price_max: 50 },
    { id: "p-gm-4", name: "Level Up Boardgames Lounge", category: "Gaming", venue: "Level Up Arcade", city: "Chicago", price_min: 5, price_max: 15 },
    { id: "p-gm-5", name: "Sector 23 Immersive VR Quest", category: "Gaming", venue: "Sector 23 VR Lounge", city: "Chicago", price_min: 20, price_max: 40 },
    { id: "p-gm-6", name: "Midwest Esports Arena Qualifiers", category: "Gaming", venue: "Wintrust Arena", city: "Chicago", price_min: 15, price_max: 30 },
    { id: "p-gm-7", name: "Replay Retro Pinball Tournament", category: "Gaming", venue: "Replay Lincoln Park", city: "Chicago", price_min: 5, price_max: 10 },
    { id: "p-gm-8", name: "Dice Dojo Boardgame Social", category: "Gaming", venue: "Chicagoland Dice Dojo", city: "Chicago", price_min: 0, price_max: 0 },
  ];

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedDate) {
      result = result.filter((ev) => {
        if (!ev.date && !ev.start_date) return true; // preview rows are not dated events
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
            <ExploreCategoryEventCard
              item={item as any}
              userCity={city}
              isPlaceholder={true}
              categoryFallback="Gaming"
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Gaming</h1>
          <p className="text-xs text-slate-500">Curated gaming in {city}</p>
        </div>
      </div>

      <ExploreHeaderFilters
        city={city}
        onCityChange={setCity}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        placeholder="Search gaming..."
        mapCategory="Gaming"
      />

      {/* Info Alert */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-blue-800 shadow-sm">
        <Info className="mt-0.5 shrink-0 text-blue-600" size={18} />
        <div>
          <h4 className="text-xs font-bold leading-none mb-1 text-blue-900">Data Coming Soon</h4>
          <p className="text-[11px] leading-relaxed text-blue-700">
            We are currently expanding our network to integrate local gaming lounges, ticketing partners, and esports tournaments in {city}. Explore the preview destinations below!
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {renderRow(CATEGORY_SECTION.previewListings("Gaming").title, CATEGORY_SECTION.previewListings("Gaming").subtitle)}
        {renderRow("This Weekend", "Friday through Sunday")}

        {/* By Distance Section */}
        <div className="border-t border-slate-100 pt-6 mt-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">By Distance</h3>
          {renderRow("Near You", "Within 10 miles")}
          {renderRow("Short Drive", "10–50 miles")}
          {renderRow("Worth the Drive", "50–100 miles")}
          {renderRow("Road Trip", "100–200 miles")}
        </div>

        {renderRow(CATEGORY_SECTION.nationalPreview.title, CATEGORY_SECTION.nationalPreview.subtitle)}
        {renderRow(CATEGORY_SECTION.internationalPreview.title, CATEGORY_SECTION.internationalPreview.subtitle)}
      </div>
    </div>
  );
}
