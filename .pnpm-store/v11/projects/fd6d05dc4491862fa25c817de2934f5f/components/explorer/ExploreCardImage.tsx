"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getCategoryGradient } from "@/lib/explore-category-gradient";
import { getPlaceImage } from "@/lib/explore-place-images";
import {
  EXPLORE_PHOTO_UNAVAILABLE,
  exploreInventoryPhotoDisplay,
} from "@/app/(dashboard)/explore/explore-listing-field-state";

type ExploreCardImageProps = {
  imageUrl?: string | null;
  alt: string;
  category?: string;
  placeId?: string;
  className?: string;
  imgClassName?: string;
  overlay?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
  /** category = legacy stock art; unknown = honest missing-photo for inventory */
  fallbackMode?: "category" | "unknown";
  unavailableLabel?: string;
};

export function ExploreCardImage({
  imageUrl,
  alt,
  category,
  placeId,
  className = "relative aspect-[4/3] overflow-hidden bg-slate-100",
  imgClassName = "h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]",
  overlay = false,
  style,
  children,
  fallbackMode = "category",
  unavailableLabel = EXPLORE_PHOTO_UNAVAILABLE,
}: ExploreCardImageProps) {
  const gradient = getCategoryGradient(category);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [imageUrl, placeId, fallbackMode]);

  const displayMode = exploreInventoryPhotoDisplay({
    fallbackMode,
    imageUrl,
    imageLoadFailed: loadFailed,
  });

  const resolvedUrl =
    displayMode === "category-stock"
      ? getPlaceImage(imageUrl ?? null, category ?? "", placeId ?? alt)
      : displayMode === "provider"
        ? (imageUrl ?? "").trim()
        : null;

  const showUnavailable = displayMode === "unavailable";

  return (
    <div
      className={className}
      style={{
        ...style,
        ...(showUnavailable ? { background: gradient } : undefined),
      }}
    >
      {resolvedUrl && !showUnavailable ? (
        <img
          src={resolvedUrl}
          alt={alt}
          loading="lazy"
          className={imgClassName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => {
            setLoadFailed(true);
          }}
        />
      ) : null}
      {showUnavailable ? (
        <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] font-semibold text-slate-500">
          {unavailableLabel}
        </span>
      ) : null}
      {overlay ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)",
          }}
        />
      ) : null}
      {children}
    </div>
  );
}
