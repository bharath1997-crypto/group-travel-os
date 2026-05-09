"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

export type CityTagProps = {
  cityName: string;
  className?: string;
};

/**
 * Clickable city chip — opens the city travel guide.
 */
export function CityTag({ cityName, className = "" }: CityTagProps) {
  const router = useRouter();
  const label = (cityName || "Chicago").trim() || "Chicago";

  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/explore/${encodeURIComponent(label)}`)
      }
      className={
        "inline-flex max-w-full items-center gap-1 rounded-full border border-[#E94560]/75 bg-[#162d4a] px-2.5 py-0.5 text-left text-xs font-semibold text-[#E94560] shadow-sm ring-1 ring-[#1e4976]/80 transition hover:border-[#E94560] hover:bg-[#1a3554] hover:text-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E94560] " +
        className
      }
      aria-label={`Open travel guide for ${label}`}
    >
      <MapPin
        className="h-3 w-3 shrink-0 text-[#E94560]"
        aria-hidden
        strokeWidth={2.5}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}
