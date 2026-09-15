"use client";

import { LIVE_DATA_DISCLAIMER, presentWikiAbout, type WikiSummaryLike } from "./wiki-about-display";

type Props = {
  wikiSummary: WikiSummaryLike;
  placeName: string;
  city?: string | null;
  wikiExpanded: boolean;
  onExpand: () => void;
};

export default function PlaceWikiAboutBlock({
  wikiSummary,
  placeName,
  city,
  wikiExpanded,
  onExpand,
}: Props) {
  if (!wikiSummary.available || !wikiSummary.summary) return null;

  const presentation = presentWikiAbout(wikiSummary, placeName, city);

  return (
    <div className="rounded-xl border border-stone-100/40 bg-white/40 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${presentation.badgeClass}`}
        >
          {presentation.badge}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
          Wikipedia
        </span>
      </div>
      <p className="text-[11px] font-semibold text-stone-700">{presentation.heading}</p>
      {presentation.disclaimer ? (
        <p className="mt-1 text-[10px] leading-snug text-amber-900/90">{presentation.disclaimer}</p>
      ) : null}
      <p
        className={`mt-1.5 text-xs leading-relaxed text-stone-600 ${
          wikiExpanded ? "" : "line-clamp-2"
        }`}
      >
        {wikiSummary.summary}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {!wikiExpanded ? (
          <button
            type="button"
            onClick={onExpand}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Read more
          </button>
        ) : null}
        {wikiSummary.url ? (
          <a
            href={wikiSummary.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Read on Wikipedia
          </a>
        ) : null}
      </div>
      <p className="mt-2 border-t border-stone-100/80 pt-2 text-[10px] leading-snug text-stone-500">
        {LIVE_DATA_DISCLAIMER}
      </p>
    </div>
  );
}
