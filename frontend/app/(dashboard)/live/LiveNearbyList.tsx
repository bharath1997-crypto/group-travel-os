"use client";

import type { PlacePreviewData } from "./PlacePreviewCard";
import { isLandmarkPlace } from "./live-poi-icons";
import { LivePoiRowIcon } from "./live-poi-row-icon";
import {
  LIVE_DOCK_PANEL,
  LIVE_DOCK_SECTION_LABEL,
} from "./live-design-tokens";
import LiveEmptyStateCard from "./LiveEmptyStateCard";
import { LiveCategoryIcon } from "./live-category-icon";

type LiveNearbyListProps = {
  categoryKey: string;
  title: string;
  categoryLabel: string;
  results: PlacePreviewData[] | null;
  loading: boolean;
  error: string | null;
  searchAnchorHint?: string | null;
  onClose: () => void;
  onSelect: (place: PlacePreviewData) => void;
  onWidenSearch?: () => void;
};

function formatDistanceMi(distanceM: number | null): string | null {
  if (distanceM == null) return null;
  return `${(distanceM / 1609.34).toFixed(1)} mi`;
}

export default function LiveNearbyList({
  categoryKey,
  title,
  categoryLabel,
  results,
  loading,
  error,
  searchAnchorHint,
  onClose,
  onSelect,
  onWidenSearch,
}: LiveNearbyListProps) {
  const count = results?.length ?? 0;

  return (
    <div
      className={`mt-2 flex max-h-[min(380px,calc(100vh-22rem))] flex-col p-4 text-[#0F1614] ${LIVE_DOCK_PANEL}`}
    >
      <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={LIVE_DOCK_SECTION_LABEL}>Nearby here</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EFE8]">
              <LiveCategoryIcon categoryKey={categoryKey} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-[#0F1614]">{title}</h3>
              <p className="text-[11px] font-medium text-[#5F665F]">
                {loading ? "Searching…" : `${count} found · sorted by distance`}
              </p>
              {searchAnchorHint ? (
                <p className="text-[10px] font-medium text-[#8D6A1E]">{searchAnchorHint}</p>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1.5 text-[#5F665F] transition hover:bg-[#F1EFE8] hover:text-[#0F1614]"
          title="Close results"
          aria-label="Close nearby results"
        >
          <span className="px-0.5 text-sm font-bold leading-none">×</span>
        </button>
      </div>

      {error ? (
        <div className="shrink-0 py-6 text-center text-xs font-medium text-[#B4453D]">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex shrink-0 flex-col items-center justify-center gap-2 py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0E6E5C] border-t-transparent" />
          <span className="animate-pulse text-xs font-medium text-[#5F665F]">Searching nearby…</span>
        </div>
      ) : null}

      {!loading && !error && results && results.length === 0 ? (
        <LiveEmptyStateCard
          variant="no_results"
          description={`No places found for "${categoryLabel}" in this area.`}
          actionLabel={onWidenSearch ? "Widen search" : undefined}
          onAction={onWidenSearch}
          className="shrink-0 text-left"
        />
      ) : null}

      {!loading && !error && results && results.length > 0 ? (
        <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {results.map((res, index) => {
            const distanceLabel = formatDistanceMi(res.distanceM);
            const landmark = isLandmarkPlace(res);
            return (
              <button
                key={res.placeKey ?? `${res.lat}-${res.lng}-${res.name}`}
                type="button"
                onClick={() => onSelect(res)}
                className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition hover:bg-white ${
                  landmark
                    ? "border-[rgba(141,106,30,0.25)] bg-white/70"
                    : "border-[rgba(15,22,20,0.08)] bg-white/50"
                }`}
              >
                <div
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EFE8] ${
                    landmark ? "ring-1 ring-amber-300/70" : ""
                  }`}
                >
                  <LivePoiRowIcon place={res} />
                  <span className="absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full border border-[#FBFAF7] bg-[#0F1614] px-0.5 text-[9px] font-bold text-white">
                    {index + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-xs font-semibold text-[#0F1614]">{res.name}</span>
                    {landmark ? (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-[#8D6A1E]">
                        Landmark
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#5F665F]">
                    {res.categoryLabel}
                    {res.address ? ` · ${res.address}` : ""}
                  </p>
                </div>
                {distanceLabel ? (
                  <span className="shrink-0 font-mono text-[10px] font-medium tracking-wide text-[#0E6E5C]">
                    {distanceLabel}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
