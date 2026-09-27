"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { CategoryScrollRow } from "@/components/explorer/CategoryScrollRow";
import { ExploreHeaderFilters } from "@/components/explorer/ExploreHeaderFilters";
import { type ExploreEvent } from "@/lib/explore-events";
import { ExploreCategoryEventCard } from "../components/ExploreCategoryEventCard";
import { CATEGORY_SECTION } from "../explore-category-feed";


export default function SeeAllShoppingPage() {
  const [city, setCity] = useState("Chicago");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const savedCity = localStorage.getItem("rovvy_explore_city") || "Chicago";
    setCity(savedCity);
  }, []);

  const items: Partial<ExploreEvent>[] = [
    { id: "p-sp-1", name: "Magnificent Mile Designer Tour", category: "Shopping", venue: "Michigan Avenue", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-sp-2", name: "Woodfield Premium Outlet Hop", category: "Shopping", venue: "Woodfield Mall", city: "Schaumburg", price_min: 0, price_max: 0 },
    { id: "p-sp-3", name: "Fashion Outlets Shuttle", category: "Shopping", venue: "Fashion Outlets Rosemont", city: "Rosemont", price_min: 5, price_max: 10 },
    { id: "p-sp-4", name: "State Street Historic Shops", category: "Shopping", venue: "State Street", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-sp-5", name: "Maxwell Street Vintage Market", category: "Shopping", venue: "Maxwell Street Market", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-sp-6", name: "Oak Street Luxury Boutiques Tour", category: "Shopping", venue: "Oak Street", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-sp-7", name: "Water Tower Place Experience", category: "Shopping", venue: "Water Tower Place", city: "Chicago", price_min: 0, price_max: 0 },
    { id: "p-sp-8", name: "Randolph Street Antique Market", category: "Shopping", venue: "Plumber's Hall Grounds", city: "Chicago", price_min: 10, price_max: 15 },
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
              categoryFallback="Shopping"
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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Shopping</h1>
          <p className="text-xs text-slate-500">Curated shopping in {city}</p>
        </div>
      </div>

      <ExploreHeaderFilters
        city={city}
        onCityChange={setCity}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        placeholder="Search shopping..."
        mapCategory="Shopping"
      />

      {/* Info Alert */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-blue-800 shadow-sm">
        <Info className="mt-0.5 shrink-0 text-blue-600" size={18} />
        <div>
          <h4 className="text-xs font-bold leading-none mb-1 text-blue-900">Data Coming Soon</h4>
          <p className="text-[11px] leading-relaxed text-blue-700">
            We are currently expanding our network to integrate local shopping outlets, boutiques, designer streets, and craft markets in {city}. Explore the preview destinations below!
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {renderRow(CATEGORY_SECTION.previewListings("Shopping").title, CATEGORY_SECTION.previewListings("Shopping").subtitle)}
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
