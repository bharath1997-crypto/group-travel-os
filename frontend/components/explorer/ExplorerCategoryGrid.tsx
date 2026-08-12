"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  Calendar,
  Compass,
  Utensils,
  Trees,
  GlassWater,
  Landmark,
  ShoppingBag,
  Mountain,
  Sparkles,
  Map,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const CATEGORIES = [
  { label: "Activities", icon: Compass, href: "/explore/activities", color: "bg-teal-50 text-primary" },
  { label: "Events", icon: Calendar, href: "/explore/events", color: "bg-violet-50 text-violet-600" },
  { label: "Food", icon: Utensils, href: "/explore/food", color: "bg-orange-50 text-orange-600" },
  { label: "Parks", icon: Trees, href: "/explore/parks", color: "bg-emerald-50 text-emerald-600" },
  { label: "Nightlife", icon: GlassWater, href: "/explore/nightlife", color: "bg-indigo-50 text-indigo-600" },
  { label: "Landmarks", icon: Landmark, href: "/explore/landmarks", color: "bg-amber-50 text-amber-600" },
  { label: "Shopping", icon: ShoppingBag, href: "/explore/shopping", color: "bg-pink-50 text-pink-600" },
  { label: "Outdoors", icon: Mountain, href: "/explore/trekking", color: "bg-green-50 text-green-700" },
  { label: "Hidden Gems", icon: Sparkles, href: "/explore/activities?filter=hidden", color: "bg-rose-50 text-rose-500" },
  { label: "Map View", icon: Map, href: "/explore/map", color: "bg-sky-50 text-sky-600" },
] as const;

type ExplorerCategoryGridProps = {
  onCategoryClick?: (category: string) => void;
};

export function ExplorerCategoryGrid({ onCategoryClick }: ExplorerCategoryGridProps) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Arrow controls — same style as Recommended carousel */}
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Scroll categories left"
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-colors bg-white shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Scroll categories right"
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-colors bg-white shadow-sm"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="flex gap-8 md:gap-10 lg:gap-12 overflow-x-auto pb-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.label}
              href={cat.href}
              onClick={() => onCategoryClick?.(cat.label)}
              className="group flex shrink-0 flex-col items-center gap-3 min-w-[72px] md:min-w-[80px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2 rounded-xl"
            >
              <div
                className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center ${cat.color} transition-transform duration-200 group-hover:scale-105`}
              >
                <Icon size={24} strokeWidth={1.75} />
              </div>
              <span className="text-xs md:text-[13px] font-semibold text-slate-600 group-hover:text-primary transition-colors leading-snug max-w-[88px]">
                {cat.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
