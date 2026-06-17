"use client";

import React from "react";
import { Star, MapPin, Heart, Camera, Compass, Gamepad2, FerrisWheel, Utensils, Trees, Moon, Activity, ShoppingBag } from "lucide-react";

export type ExplorePlace = {
  id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  lat: number;
  lng: number;
  photo_url?: string | null;
  distance_m?: number | null;
  price_min?: number | null;
  is_free?: boolean;
  rating?: number | null;
  rating_count?: number | null;
  address?: any;
};

interface ExploreV2CardProps {
  place: ExplorePlace;
  showDistance?: boolean;
}

function getCategoryIcon(category?: string | null, subcategory?: string | null) {
  const cat = (category || "").toLowerCase();
  const sub = (subcategory || "").toLowerCase();
  
  if (cat.includes("landmark") || cat.includes("photo") || sub.includes("landmark") || sub.includes("monument")) {
    return <Camera className="h-8 w-8 text-slate-400" />;
  }
  if (cat.includes("trekking") || cat.includes("nature") || cat.includes("adventure") || sub.includes("trail") || sub.includes("hiking")) {
    return <Compass className="h-8 w-8 text-slate-400" />;
  }
  if (cat.includes("gaming") || cat.includes("game") || sub.includes("arcade") || sub.includes("esports")) {
    return <Gamepad2 className="h-8 w-8 text-slate-400" />;
  }
  if (cat.includes("amusement") || cat.includes("theme park") || sub.includes("amusement") || sub.includes("theme_park")) {
    return <FerrisWheel className="h-8 w-8 text-slate-400" />;
  }
  if (cat.includes("restaurant") || cat.includes("food") || cat.includes("dining") || sub.includes("restaurant") || sub.includes("cafe")) {
    return <Utensils className="h-8 w-8 text-slate-400" />;
  }
  if (cat.includes("park") || cat.includes("outdoor") || sub.includes("park") || sub.includes("garden")) {
    return <Trees className="h-8 w-8 text-slate-400" />;
  }
  if (cat.includes("nightlife") || cat.includes("bar") || cat.includes("club") || sub.includes("bar") || sub.includes("pub") || sub.includes("nightclub")) {
    return <Moon className="h-8 w-8 text-slate-400" />;
  }
  if (cat.includes("sports") || cat.includes("fitness") || sub.includes("stadium") || sub.includes("gym")) {
    return <Activity className="h-8 w-8 text-slate-400" />;
  }
  if (cat.includes("shopping") || cat.includes("store") || sub.includes("mall") || sub.includes("shop")) {
    return <ShoppingBag className="h-8 w-8 text-slate-400" />;
  }
  return <Compass className="h-8 w-8 text-slate-400" />;
}

export function ExploreV2Card({ place, showDistance }: ExploreV2CardProps) {
  const { name, photo_url, distance_m, price_min, rating, rating_count, category, subcategory } = place;

  const distanceMiles = distance_m ? distance_m / 1609.344 : null;
  const distanceText = distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi` : null;

  let venueLabel = subcategory || category || "Activity";
  if (place.address?.city) {
    venueLabel = `${venueLabel} · ${place.address.city}`;
  }

  const [imgError, setImgError] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <article className="group flex flex-col h-full bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#0F766E] hover:shadow-lg">
      {/* Image / Icon Area */}
      <div className="relative h-[150px] bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
        {photo_url && !imgError ? (
          <img
            src={photo_url}
            alt={name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center p-4">
            {getCategoryIcon(category, subcategory)}
          </div>
        )}

        {/* Top-left: category badge */}
        <span className="absolute left-3 top-3 rounded-full bg-[#0F766E] px-2.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
          {category || "Activity"}
        </span>

        {/* Top-right: save / heart button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSaved((v) => !v); }}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-110"
          aria-label="Save"
        >
          <Heart
            className={`h-3.5 w-3.5 transition-colors ${saved ? "fill-rose-500 text-rose-500" : "text-slate-400"}`}
          />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
        <div>
          <h3 className="text-[14px] font-bold text-slate-900 truncate group-hover:text-[#0F766E]" title={name}>
            {name}
          </h3>

          {rating !== undefined && rating !== null && rating > 0 && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-amber-500">
              <Star className="h-3 w-3 fill-current" />
              <span className="font-semibold text-slate-800">{rating.toFixed(1)}</span>
              {rating_count !== undefined && rating_count !== null && (
                <span className="text-slate-400">({rating_count})</span>
              )}
            </div>
          )}

          <p className="mt-1 text-[12px] text-slate-500 truncate">{venueLabel}</p>
        </div>

        {/* Bottom row: distance + Explore CTA */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {showDistance && distanceText ? (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <MapPin className="h-3 w-3 shrink-0" />
              {distanceText}
            </span>
          ) : place.is_free ? (
            <span className="text-[11px] font-semibold text-emerald-600">Free</span>
          ) : price_min !== undefined && price_min !== null ? (
            <span className="text-[11px] text-slate-400">${price_min}+</span>
          ) : (
            <span />
          )}
          <span className="text-[11px] font-semibold text-[#0F766E] group-hover:underline shrink-0">
            Explore →
          </span>
        </div>
      </div>
    </article>
  );
}
