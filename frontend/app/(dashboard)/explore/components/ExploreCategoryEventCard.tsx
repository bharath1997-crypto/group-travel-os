"use client";



import { Calendar, MapPin } from "lucide-react";

import { ExploreCardImage } from "@/components/explorer/ExploreCardImage";

import { categoryCardScheduleLine } from "../explore-availability-copy";

import { type ExploreEvent, formatPrice } from "@/lib/explore-events";
import { formatCategoryCardLocation } from "../explore-listing-location";



type ExploreCategoryEventCardProps = {

  item: Partial<ExploreEvent> & { id: string; name: string };

  userCity: string;

  isPlaceholder?: boolean;

  categoryFallback?: string;

};



export function ExploreCategoryEventCard({

  item,

  userCity,

  isPlaceholder = false,

  categoryFallback = "Events",

}: ExploreCategoryEventCardProps) {

  const location = isPlaceholder
    ? formatCategoryCardLocation(
        { venue: item.venue, city: item.city, state: item.state, country: item.country },
        userCity,
      )
    : formatCategoryCardLocation(item as ExploreEvent, userCity);

  const price = isPlaceholder ? "Preview · coming soon" : formatPrice(item as ExploreEvent);

  const scheduleLine = categoryCardScheduleLine(item, isPlaceholder);



  return (

    <article className="group flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md">

      <ExploreCardImage
        imageUrl={item.image_url}
        alt={item.name}
        category={item.category}
        placeId={item.id}
        fallbackMode={isPlaceholder ? "category" : "unknown"}
      >

        <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-primary shadow-sm backdrop-blur">

          {isPlaceholder ? "Preview" : item.category || categoryFallback}

        </span>

        <span

          className={`absolute right-3 top-3 rounded-lg px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur ${isPlaceholder ? "bg-amber-600/90" : "bg-[#1E293B]/85"}`}

        >

          {price}

        </span>

      </ExploreCardImage>



      <div className="flex flex-1 flex-col p-3">

        <h3 className="mb-2 line-clamp-2 text-[13px] font-bold leading-snug text-[#1E293B] group-hover:text-primary">

          {item.name}

        </h3>



        <div className="mt-auto space-y-1">

          <div className="flex items-start gap-1">

            <MapPin size={11} className="mt-0.5 shrink-0 text-muted" />

            <div className="min-w-0">

              {location.primary ? (
                <p className="truncate text-[10px] font-medium text-[#475569]">{location.primary}</p>
              ) : null}
              {location.secondary ? (
                <p className="truncate text-[9px] text-muted">{location.secondary}</p>
              ) : null}

            </div>

          </div>

          <div className="flex items-center gap-1">

            <Calendar size={11} className="shrink-0 text-muted" />

            <span className="truncate text-[9px] text-[#64748B]">{scheduleLine}</span>

          </div>

        </div>

      </div>

    </article>

  );

}

