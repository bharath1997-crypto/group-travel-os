"use client";

import React from "react";
import { Star, MapPin, Camera, Compass, Gamepad2, FerrisWheel, Utensils, Trees, Moon, Activity, ShoppingBag } from "lucide-react";

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

  // Convert distance in meters to miles
  const distanceMiles = distance_m ? distance_m / 1609.344 : null;
  const distanceText = distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi` : null;

  // Venue label
  let venueLabel = subcategory || category || "Activity";
  if (place.address?.city) {
    venueLabel = `${venueLabel} · ${place.address.city}`;
  }

  // Handle image load error
  const [imgError, setImgError] = React.useState(false);

  return (
    <article className="group flex flex-col h-full bg-white border-[0.5px] border-slate-200 rounded-[12px] overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0F766E] hover:shadow-md">
      {/* Image / Icon Area */}
      <div className="relative h-[120px] bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
        {photo_url && !imgError ? (
          <img
            src={photo_url}
            alt={name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center p-4">
            {getCategoryIcon(category, subcategory)}
          </div>
        )}

        {/* Top-left Badge */}
        {showDistance && distanceText ? (
          <span className="absolute left-3 top-3 rounded-lg bg-[#0F766E] px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm">
            {distanceText}
          </span>
        ) : place.is_free ? (
          <span className="absolute left-3 top-3 rounded-lg bg-[#0F766E] px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm">
            Free
          </span>
        ) : null}

        {/* Bottom-right Price Badge */}
        {price_min !== undefined && price_min !== null && (
          <span className="absolute right-3 top-3 rounded-lg bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
            ${price_min}+
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
        <div>
          {/* Title */}
          <h3 className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-[#0F766E]" title={name}>
            {name}
          </h3>

          {/* Star Rating (only if real rating exists) */}
          {rating !== undefined && rating !== null && rating > 0 && (
            <div className="flex items-center gap-1 mt-1 text-[12px] text-amber-500">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="font-semibold text-slate-800">{rating.toFixed(1)}</span>
              {rating_count !== undefined && rating_count !== null && (
                <span className="text-slate-400">({rating_count})</span>
              )}
            </div>
          )}
        </div>

        {/* Location / Venue */}
        <div className="flex items-center gap-1.5 mt-2 text-[12px] text-slate-500 min-w-0">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{venueLabel}</span>
        </div>
      </div>
    </article>
  );
}
