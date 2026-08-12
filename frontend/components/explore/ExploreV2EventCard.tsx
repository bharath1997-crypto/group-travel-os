"use client";

import React from "react";
import { Calendar, Ticket } from "lucide-react";

export type ExploreEventV2 = {
  id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  ticket_url: string | null;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
};

interface ExploreV2EventCardProps {
  event: ExploreEventV2;
}

export function ExploreV2EventCard({ event }: ExploreV2EventCardProps) {
  const { title, start_time, ticket_url, price_min, price_max } = event;

  // Format Date
  let formattedDate = "Any Date";
  if (start_time) {
    try {
      const dateObj = new Date(start_time);
      formattedDate = dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      formattedDate = start_time;
    }
  }

  // Format Price
  let priceText = "Get Tickets";
  if (price_min !== null && price_min !== undefined) {
    if (price_max !== null && price_max !== undefined && price_max > price_min) {
      priceText = `$${price_min} - $${price_max}`;
    } else {
      priceText = `$${price_min}`;
    }
  }

  const CardWrapper = ticket_url ? "a" : "div";
  const wrapperProps = ticket_url
    ? { href: ticket_url, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <CardWrapper
      {...wrapperProps}
      className="w-[280px] md:w-auto shrink-0 md:shrink flex items-center gap-3 bg-white border-[0.5px] border-slate-200 rounded-[12px] p-2 hover:border-primary hover:shadow-md transition-all duration-200 cursor-pointer min-w-0"
    >
      {/* 76px Image Area Left */}
      <div className="w-[76px] h-[76px] rounded-lg bg-teal-50 flex items-center justify-center shrink-0 text-primary">
        <Ticket className="h-6 w-6" />
      </div>

      {/* Body Right */}
      <div className="flex flex-col flex-1 min-w-0 py-0.5 justify-between h-[76px]">
        {/* Event Title (2-line clamp) */}
        <h3 className="text-[13px] font-semibold text-slate-900 line-clamp-2 leading-snug" title={title || ""}>
          {title || "Special Event"}
        </h3>

        <div className="space-y-0.5">
          {/* Date with Calendar Icon (teal) */}
          <div className="flex items-center gap-1.5 text-[11px] text-primary">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formattedDate}</span>
          </div>

          {/* Price Range (teal) */}
          <div className="text-[11px] font-bold text-primary">
            {priceText}
          </div>
        </div>
      </div>
    </CardWrapper>
  );
}
