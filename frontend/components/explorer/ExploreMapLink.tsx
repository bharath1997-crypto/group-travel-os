"use client";

import Link from "next/link";
import { Map } from "lucide-react";
import { exploreMapHref } from "@/lib/explore-map-categories";

type ExploreMapLinkProps = {
  category?: string;
  compact?: boolean;
  className?: string;
};

export function ExploreMapLink({
  category,
  compact = false,
  className = "",
}: ExploreMapLinkProps) {
  return (
    <Link
      href={exploreMapHref(category)}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 font-semibold text-teal-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-100/80 ${
        compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
      } ${className}`}
    >
      <Map size={compact ? 13 : 15} className="text-teal-600" />
      <span>Map View</span>
    </Link>
  );
}
