"use client";

import { resolvePoiRowLucideIcon, type PoiMapPlace } from "./live-poi-icons";

type LivePoiRowIconProps = {
  place: PoiMapPlace;
  className?: string;
};

export function LivePoiRowIcon({
  place,
  className = "h-4 w-4 text-[#0F1614]",
}: LivePoiRowIconProps) {
  const Icon = resolvePoiRowLucideIcon(place);
  return <Icon className={className} strokeWidth={1.9} aria-hidden />;
}
