"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { CategoryScrollRow } from "@/components/explorer/CategoryScrollRow";
import { ExploreHeaderFilters } from "@/components/explorer/ExploreHeaderFilters";
import { type ExploreEvent } from "@/lib/explore-events";
import { ExploreCategoryEventCard } from "../components/ExploreCategoryEventCard";
import { CATEGORY_SECTION } from "../explore-category-feed";

export default function SeeAllLandmarksPage() {
  const [city, setCity] = useState("Chicago");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const savedCity = localStorage.getItem("rovvy_explore_city") || "Chicago";
    setCity(savedCity);
  }, []);

  const items: Partial<ExploreEvent>[] = [
    { id: "p-lm-1", name: "Millennium Park Cloud Gate", category: "Landmarks", venue: "Millennium Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-lm-2", name: "Chicago Skydeck Ledge", category: "Landmarks", venue: "Willis Tower", city: "Chicago", price_min: 35, price_max: 45 },
    { id: "p-lm-3", name: "Navy Pier Centennial Wheel", category: "Landmarks", venue: "Navy Pier", city: "Chicago", price_min: 18, price_max: 25 },
    { id: "p-lm-4", name: "Art Institute of Chicago", category: "Landmarks", venue: "Art Institute", city: "Chicago", price_min: 25, price_max: 30 },
    { id: "p-lm-5", name: "Wrigley Field Historic Tour", category: "Landmarks", venue: "Wrigley Field", city: "Chicago", price_min: 30, price_max: 40 },
    { id: "p-lm-6", name: "Lincoln Park Botanical Conservatory", category: "Landmarks", venue: "Lincoln Park", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-lm-7", name: "Field Museum of History", category: "Landmarks", venue: "Museum Campus", city: "Chicago", price_min: 20, price_max: 35 },
    { id: "p-lm-8", name: "Shedd Aquarium Oceanarium", category: "Landmarks", venue: "Shedd Aquarium", city: "Chicago", price_min: 25, price_max: 40 },
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
              categoryFallback="Landmarks"
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Landmarks</h1>
          <p className="text-xs text-slate-500">Curated landmarks in {city}</p>
        </div>
      </div>

      <ExploreHeaderFilters
        city={city}
        onCityChange={setCity}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        placeholder="Search landmarks..."
        mapCategory="Landmarks"
      />

      {/* Info Alert */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-blue-800 shadow-sm">
        <Info className="mt-0.5 shrink-0 text-blue-600" size={18} />
        <div>
          <h4 className="text-xs font-bold leading-none mb-1 text-blue-900">Data Coming Soon</h4>
          <p className="text-[11px] leading-relaxed text-blue-700">
            We are currently expanding our network to integrate local landmark directories, ticketing partners, and photography hubs in {city}. Explore the preview destinations below!
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {renderRow(CATEGORY_SECTION.previewListings("Landmarks").title, CATEGORY_SECTION.previewListings("Landmarks").subtitle)}
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
