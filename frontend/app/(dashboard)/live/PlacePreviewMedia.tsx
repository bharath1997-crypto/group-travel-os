"use client";

import { useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { PlaceMediaItem } from "./live-place-media";

type Props = {
  media: PlaceMediaItem[];
  categoryLabel: string;
  loading?: boolean;
};

function sourceLabel(source: PlaceMediaItem["source"]): string {
  switch (source) {
    case "rovvy_user":
      return "Rovvy traveler";
    case "rovvy_admin":
      return "Rovvy";
    case "licensed_partner":
      return "Partner";
    case "open_license":
      return "Open license";
    default:
      return "Rovvy";
  }
}

function CategoryPlaceholder({ categoryLabel }: { categoryLabel: string }) {
  return (
    <div
      className="flex aspect-[16/9] w-full flex-col items-center justify-center rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 text-stone-500"
      aria-label="No photos yet"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 shadow-sm">
        <MapPin className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-stone-700">
        {categoryLabel || "Place"}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
        <Camera className="h-3.5 w-3.5" aria-hidden />
        No Rovvy photos yet
      </p>
    </div>
  );
}

export default function PlacePreviewMedia({
  media,
  categoryLabel,
  loading = false,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => media.filter((item) => !brokenIds.has(item.id)),
    [media, brokenIds],
  );

  if (loading) {
    return (
      <div
        className="aspect-[16/9] w-full animate-pulse rounded-xl bg-stone-100"
        aria-busy="true"
        aria-label="Loading place photos"
      />
    );
  }

  if (visible.length === 0) {
    return <CategoryPlaceholder categoryLabel={categoryLabel} />;
  }

  const safeIndex = Math.min(activeIndex, visible.length - 1);
  const current = visible[safeIndex]!;
  const attribution =
    current.attribution?.trim() ||
    (current.license ? `License: ${current.license}` : null);

  function markBroken(id: string) {
    setBrokenIds((prev) => new Set(prev).add(id));
    setActiveIndex(0);
  }

  function goPrev() {
    setActiveIndex((i) => (i <= 0 ? visible.length - 1 : i - 1));
  }

  function goNext() {
    setActiveIndex((i) => (i >= visible.length - 1 ? 0 : i + 1));
  }

    const isVideo = current.storageUrl?.match(/\.(mp4|webm|ogg|mov)$/i) || current.tags?.includes("video");

    return (
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
        <div className="relative aspect-[16/9] w-full bg-stone-200">
          <span className="absolute left-2 top-2 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
            {sourceLabel(current.source)}
          </span>
          {isVideo ? (
            <video
              src={current.storageUrl}
              poster={current.thumbnailUrl}
              controls
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.thumbnailUrl}
              alt={current.caption || categoryLabel || "Place photo"}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => markBroken(current.id)}
            />
          )}
        {visible.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60"
              aria-label="Next photo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {visible.map((item, idx) => (
                <span
                  key={item.id}
                  className={`h-1.5 w-1.5 rounded-full ${
                    idx === safeIndex ? "bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="space-y-1 px-3 py-2">
        {current.caption ? (
          <p className="text-xs font-medium text-stone-700">{current.caption}</p>
        ) : null}
        <p className="text-[11px] text-stone-500">
          {sourceLabel(current.source)}
          {attribution ? ` · ${attribution}` : null}
        </p>
      </div>
    </div>
  );
}
