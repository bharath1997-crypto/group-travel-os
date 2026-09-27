import type { ExploreSlot } from "./explore-hub-data";
import {
  freePriceStatLabel,
  slotMatchesCategoryStatChip,
} from "./explore-hub-listing-predicates";

const CATEGORY_STAT_LABELS = new Set([
  "Events",
  "Food & drink",
  "Live music",
  "Outdoors",
  "Landmarks",
  "Free tonight",
  "Free",
]);

export function isCategoryStatChipLabel(chip: string): boolean {
  return CATEGORY_STAT_LABELS.has(chip);
}

const VIBE_KEYWORDS: Record<string, string[]> = {
  "Somewhere loud": ["music", "comedy", "arena", "club", "festival"],
  "Somewhere we can talk": ["bar", "restaurant", "food", "listening"],
  "Cheap and good": ["free", "taco", "walk"],
  "Worth dressing up for": ["jazz", "blues", "theatre", "symphony", "skydeck"],
  "First date": ["jazz", "park", "food", "art"],
  "Nobody's seen it": ["osm", "editorial", "listening"],
  "Last-minute OK": ["walk-in", "free", "no ticket", "open"],
};

function haystack(slot: ExploreSlot): string {
  return `${slot.title} ${slot.summary} ${slot.meta} ${slot.source} ${slot.tags.join(" ")}`.toLowerCase();
}

function matchesPriceChip(slot: ExploreSlot, chip: string): boolean {
  const label = chip.toLowerCase();
  if (label.startsWith("under $25")) return slot.priceKnown === true && slot.amount > 0 && slot.amount < 25;
  if (label.includes("$25") && label.includes("60")) return slot.priceKnown === true && slot.amount >= 25 && slot.amount <= 60;
  if (label.includes("$60+")) return slot.priceKnown === true && slot.amount > 60;
  return false;
}

export function exploreSlotMatchesChip(
  slot: ExploreSlot,
  chip: string,
  when = "Tonight",
  calendarDayIso?: string | null,
): boolean {
  if (chip === "Free" || chip === "Free tonight") {
    return slotMatchesCategoryStatChip(slot, chip, when, calendarDayIso);
  }
  if (["Under $25", "$25–60", "$60+"].includes(chip)) {
    return matchesPriceChip(slot, chip);
  }
  if (chip === "Bookable now" || chip === "Walk-in OK") return false;
  if (isCategoryStatChipLabel(chip)) {
    return slotMatchesCategoryStatChip(slot, chip, when, calendarDayIso);
  }
  const vibeKeys = VIBE_KEYWORDS[chip];
  if (vibeKeys) {
    const text = haystack(slot);
    return vibeKeys.some((key) => text.includes(key));
  }
  const text = haystack(slot);
  const filterKeys = ["music", "food", "comedy", "outdoors", "art", "free", "under $25", "bookable", "walk-in", "indoor"];
  const normalized = chip.toLowerCase();
  if (filterKeys.some((k) => normalized.includes(k))) {
    return text.includes(normalized.replace(/[^a-z0-9\s]/g, "").trim()) || text.includes(normalized.split(" ")[0] ?? "");
  }
  return text.includes(chip.toLowerCase());
}

export function filterHubSlotsByChips(
  slots: ExploreSlot[],
  chips: string[],
  when = "Tonight",
  calendarDayIso?: string | null,
): ExploreSlot[] {
  if (!chips.length) return slots;
  return slots.filter((slot) =>
    chips.every((chip) => exploreSlotMatchesChip(slot, chip, when, calendarDayIso)),
  );
}
