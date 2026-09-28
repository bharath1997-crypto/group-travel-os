"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/safe-fetch";
import type { PlacePreviewData } from "./live-place-preview-data";
import type { WikiSummaryLike } from "./wiki-about-display";
import { logRovvyLiveWarn } from "./live-gps";

const WIKI_RELEVANT_CATEGORIES = new Set([
  "Landmark",
  "Attraction",
  "Museum",
  "Park",
  "Historic site",
  "Hotel",
  "Restaurant",
  "Bar",
  "Cafe",
]);

export function usePlaceWikiSummary(place: PlacePreviewData | null): {
  wikiSummary: WikiSummaryLike | null;
  wikiLoading: boolean;
} {
  const [wikiSummary, setWikiSummary] = useState<WikiSummaryLike | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  useEffect(() => {
    if (!place) {
      setWikiSummary(null);
      setWikiLoading(false);
      return;
    }

    setWikiSummary(null);

    const tags = place.tags ?? {};
    const wikidataId =
      typeof tags.wikidata === "string" ? tags.wikidata : undefined;
    const wikipediaTitle =
      typeof tags.wikipedia === "string" ? tags.wikipedia : undefined;
    const isMapPick = place.source === "map_pick" || place.source === "map_click";

    if (
      !isMapPick &&
      !wikidataId &&
      !wikipediaTitle &&
      !place.city &&
      !WIKI_RELEVANT_CATEGORIES.has(place.categoryLabel)
    ) {
      setWikiLoading(false);
      return;
    }

    let cancelled = false;

    const fetchWiki = async () => {
      setWikiLoading(true);
      try {
        const query = new URLSearchParams({ name: place.name });
        if (wikidataId) query.append("wikidata_id", wikidataId);
        if (wikipediaTitle) query.append("wikipedia_title", wikipediaTitle);
        if (place.city) query.append("city", place.city);
        if (place.state) query.append("state", place.state);
        if (place.country) query.append("country", place.country);
        query.append("lat", String(place.lat));
        query.append("lng", String(place.lng));

        const res = await apiFetch<WikiSummaryLike & { approximate?: boolean }>(
          `/places/wiki-summary?${query.toString()}`,
        );
        if (!cancelled) setWikiSummary(res);
      } catch (err) {
        logRovvyLiveWarn("Wiki fetch failed", err);
        if (!cancelled) setWikiSummary({ available: false });
      } finally {
        if (!cancelled) setWikiLoading(false);
      }
    };

    void fetchWiki();

    return () => {
      cancelled = true;
    };
  }, [
    place?.name,
    place?.categoryLabel,
    place?.city,
    place?.state,
    place?.country,
    place?.lat,
    place?.lng,
    place?.source,
    place?.tags,
  ]);

  return { wikiSummary, wikiLoading };
}
