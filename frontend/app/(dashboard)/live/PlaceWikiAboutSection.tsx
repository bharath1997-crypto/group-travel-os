"use client";

import PlaceWikiAboutBlock from "./PlaceWikiAboutBlock";
import { LIVE_DATA_DISCLAIMER, wikiAboutEmptyCopy, type WikiSummaryLike } from "./wiki-about-display";

type Props = {
  wikiLoading: boolean;
  wikiSummary: WikiSummaryLike | null;
  placeName: string;
  city?: string | null;
  wikiExpanded: boolean;
  onExpand: () => void;
};

export default function PlaceWikiAboutSection({
  wikiLoading,
  wikiSummary,
  placeName,
  city,
  wikiExpanded,
  onExpand,
}: Props) {
  if (wikiLoading) {
    return <p className="text-xs font-medium text-stone-400">Loading area information…</p>;
  }

  if (wikiSummary?.available && wikiSummary.summary) {
    return (
      <PlaceWikiAboutBlock
        wikiSummary={wikiSummary}
        placeName={placeName}
        city={city}
        wikiExpanded={wikiExpanded}
        onExpand={onExpand}
      />
    );
  }

  if (wikiSummary && !wikiSummary.available) {
    return (
      <div className="rounded-xl border border-stone-100 bg-stone-50/80 p-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">
            No match
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
            Wikipedia
          </span>
        </div>
        <p className="text-[11px] font-semibold text-stone-700">
          No Wikipedia article for this exact pin
        </p>
        <p className="mt-1 text-xs leading-relaxed text-stone-600">
          {wikiAboutEmptyCopy(placeName, city)} Ask Wayra about the area, or check the Info tab for
          verified OpenStreetMap location data.
        </p>
        <p className="mt-2 border-t border-stone-100 pt-2 text-[10px] leading-snug text-stone-500">
          {LIVE_DATA_DISCLAIMER}
        </p>
      </div>
    );
  }

  return null;
}
