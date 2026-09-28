import type { ExploreEvent } from "@/lib/explore-events";

/** Preserve API / filter order — no synthetic popularity sort. */
export function stableEventFeed(events: ExploreEvent[]): ExploreEvent[] {
  return [...events];
}

export const CATEGORY_SECTION = {
  localListings: {
    title: "Local listings",
    subtitle: "In provider order from your filters",
  },
  nationalListings: {
    title: "National listings",
    subtitle: "Broader inventory for your filters",
  },
  internationalPreview: {
    title: "International preview",
    subtitle: "Sample rows · not live inventory",
  },
  previewListings: (label: string) => ({
    title: `Preview · ${label}`,
    subtitle: "Sample rows · not live inventory",
  }),
  nationalPreview: {
    title: "National preview",
    subtitle: "Sample rows · not live inventory",
  },
} as const;
