"use client";

import { Bookmark, Plus, ThumbsUp, Star } from "lucide-react";
import { hashSeed } from "@/lib/explore-events";

export type ExplorerItem = {
  id: string;
  title: string;
  category?: string;
  city?: string;
  venue?: string;
  dateLabel?: string;
  imageUrl?: string | null;
  priceLabel?: string;
  isFree?: boolean;
  source: string;
  sourceType?: string;
  emoji?: string;
  ticketUrl?: string | null;
};

type ExplorerExperienceCardProps = {
  item: ExplorerItem;
  onOpen?: (item: ExplorerItem) => void;
  onSave?: () => void;
  onAddToTrip?: () => void;
  onVote?: () => void;
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  music: "from-violet-500 to-indigo-600",
  sports: "from-emerald-400 to-teal-600",
  food: "from-orange-400 to-red-500",
  nightlife: "from-indigo-600 to-violet-700",
  parks: "from-green-500 to-teal-600",
  outdoor: "from-teal-400 to-emerald-600",
  comedy: "from-amber-400 to-orange-500",
  arts: "from-pink-500 to-rose-600",
  experience: "from-teal-500 to-cyan-600",
  landmarks: "from-amber-500 to-orange-600",
  shopping: "from-pink-400 to-rose-500",
  default: "from-teal-500 to-emerald-600",
};

const SOURCE_BADGE: Record<string, string> = {
  ticketmaster: "bg-blue-600",
  eventbrite: "bg-orange-500",
  yelp: "bg-red-600",
  osm: "bg-[#0F766E]",
  rovvy: "bg-[#0F766E]",
  ai: "bg-violet-600",
  default: "bg-slate-600",
};

function getGradient(category?: string): string {
  const key = (category || "").toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_GRADIENTS)) {
    if (key.includes(k)) return v;
  }
  return CATEGORY_GRADIENTS.default;
}

function getSourceBadgeClass(source: string): string {
  const s = source.toLowerCase();
  for (const [k, v] of Object.entries(SOURCE_BADGE)) {
    if (s.includes(k)) return v;
  }
  return SOURCE_BADGE.default;
}

function sourceShortLabel(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("ticketmaster")) return "Ticketmaster";
  if (s.includes("eventbrite")) return "Eventbrite";
  if (s.includes("yelp")) return "Yelp";
  if (s.includes("osm")) return "OSM";
  if (s.includes("ai")) return "Rovvy Pick";
  return "Rovvy";
}

function StarRating({ score }: { score: number }) {
  const full = Math.floor(score);
  const half = score - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={11}
          className={
            i < full
              ? "fill-amber-400 text-amber-400"
              : i === full && half
              ? "fill-amber-400/50 text-amber-400"
              : "fill-slate-200 text-slate-200"
          }
        />
      ))}
    </div>
  );
}

export function ExplorerExperienceCard({
  item,
  onOpen,
  onSave,
  onAddToTrip,
  onVote,
}: ExplorerExperienceCardProps) {
  const seed = hashSeed(item.id || item.title);
  const ratingScore = Math.round((3.5 + (seed % 15) / 10) * 10) / 10;
  const reviewCount = 40 + (seed % 480);
  const gradient = getGradient(item.category);
  const sourceBadge = getSourceBadgeClass(item.source);
  const sourceLabel = sourceShortLabel(item.source);
  const categoryLabel = item.category
    ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
    : "Experience";

  return (
    <div className="w-[220px] shrink-0 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
      {/* Image / Gradient fallback */}
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="relative h-[118px] w-full overflow-hidden group bg-slate-100 block text-left focus:outline-none"
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover transition duration-400 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <span className="text-3xl opacity-80">{item.emoji || "✨"}</span>
          </div>
        )}

        {/* Category badge */}
        <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          {categoryLabel}
        </span>

        {/* Source badge */}
        <span
          className={`absolute top-2 right-2 ${sourceBadge} text-white text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full tracking-wide shadow-sm`}
        >
          {sourceLabel}
        </span>

        {/* Price badge */}
        {(item.priceLabel || item.isFree !== undefined) && (
          <span
            className={`absolute bottom-2 right-2 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
              item.isFree ? "bg-emerald-500" : "bg-slate-800/80 backdrop-blur-sm"
            }`}
          >
            {item.isFree ? "Free" : item.priceLabel || "See pricing"}
          </span>
        )}
      </button>

      {/* Card body */}
      <div className="flex-1 flex flex-col p-2.5 gap-1.5">
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="text-left focus:outline-none group"
        >
          <h3 className="font-bold text-slate-900 text-[13px] leading-snug line-clamp-2 group-hover:text-[#0F766E] transition-colors">
            {item.title}
          </h3>
        </button>

        <div className="flex items-center gap-1">
          <StarRating score={ratingScore} />
          <span className="text-[10px] text-slate-500 font-medium ml-0.5">
            {ratingScore} ({reviewCount})
          </span>
        </div>

        {(item.venue || item.city) && (
          <p className="text-xs text-slate-500 font-medium truncate">
            {item.venue || item.city}
            {item.venue && item.city ? ` · ${item.city}` : ""}
          </p>
        )}

        {item.dateLabel && (
          <p className="text-xs text-slate-400 font-medium truncate">{item.dateLabel}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between px-2.5 pb-2.5 pt-0.5 border-t border-slate-50 mt-auto">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Save"
            onClick={(e) => { e.stopPropagation(); onSave?.(); }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <Bookmark size={13} />
          </button>
          <button
            type="button"
            title="Add to trip"
            onClick={(e) => { e.stopPropagation(); onAddToTrip?.(); }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-[#0F766E] hover:bg-teal-50 transition-colors"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            title="Vote"
            onClick={(e) => { e.stopPropagation(); onVote?.(); }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
          >
            <ThumbsUp size={13} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="text-[10px] font-bold text-[#0F766E] hover:text-[#0D635C] transition-colors"
        >
          View →
        </button>
      </div>
    </div>
  );
}

export function ExplorerExperienceCardSkeleton() {
  return (
    <div className="w-[220px] shrink-0 bg-white rounded-xl border border-slate-100 overflow-hidden animate-pulse">
      <div className="h-[118px] bg-slate-200" />
      <div className="p-2.5 space-y-2">
        <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
        <div className="h-2.5 w-1/2 bg-slate-200 rounded" />
        <div className="h-2.5 w-1/3 bg-slate-200 rounded" />
      </div>
      <div className="px-2.5 pb-2.5 flex gap-1.5 mt-1">
        <div className="w-7 h-7 rounded-full bg-slate-200" />
        <div className="w-7 h-7 rounded-full bg-slate-200" />
        <div className="w-7 h-7 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}
