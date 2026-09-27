import type { ExploreSlot } from "./explore-hub-data";
import { dateRangeForWhen } from "./explore-hub-dates";

function haystack(slot: ExploreSlot): string {
  return `${slot.title} ${slot.summary} ${slot.meta} ${slot.source} ${slot.tags.join(" ")}`.toLowerCase();
}

export function freePriceStatLabel(when: string): string {
  return when.trim().toLowerCase() === "tonight" ? "Free tonight" : "Free";
}

export function isExploreEventListing(slot: ExploreSlot): boolean {
  return slot.exploreListingKind === "event" && !slot.editorial;
}

export function isExploreFoodAndDrinkListing(slot: ExploreSlot): boolean {
  const text = haystack(slot);
  if (slot.explorePlaceBucket === "restaurants") return true;
  return (
    text.includes("food") ||
    text.includes("restaurant") ||
    text.includes("bar") ||
    text.includes("drink")
  );
}

export function isExploreLiveMusicListing(slot: ExploreSlot): boolean {
  return haystack(slot).includes("music");
}

export function isExploreOutdoorsListing(slot: ExploreSlot): boolean {
  const text = haystack(slot);
  return (
    text.includes("outdoor") ||
    text.includes("sport") ||
    text.includes("park") ||
    text.includes("nature")
  );
}

const LANDMARK_TOKENS = [
  "landmark",
  "museum",
  "attraction",
  "gallery",
  "monument",
  "historic",
  "heritage",
  "memorial",
];

export function isExploreLandmarkListing(slot: ExploreSlot): boolean {
  if (slot.exploreListingKind !== "place") return false;
  const text = haystack(slot);
  return LANDMARK_TOKENS.some((token) => text.includes(token));
}

export function eventDateInWhenRange(eventDateIso: string | null | undefined, when: string): boolean {
  const range = dateRangeForWhen(when);
  if (!range.dateFrom || !range.dateTo) return false;
  const day = (eventDateIso || "").split("T")[0]?.slice(0, 10);
  if (!day || day.length < 10) return false;
  return day >= range.dateFrom && day <= range.dateTo;
}

export function eventDateInActiveScope(
  eventDateIso: string | null | undefined,
  when: string,
  calendarDayIso?: string | null,
): boolean {
  if (calendarDayIso) {
    const day = (eventDateIso || "").split("T")[0]?.slice(0, 10);
    return Boolean(day && day === calendarDayIso);
  }
  return eventDateInWhenRange(eventDateIso, when);
}

export function isExploreFreeInWhenRange(
  slot: ExploreSlot,
  when: string,
  calendarDayIso?: string | null,
): boolean {
  if (!isExploreEventListing(slot)) return false;
  if (slot.price !== "Free" || slot.priceKnown !== true) return false;
  return eventDateInActiveScope(slot.eventDateIso, when, calendarDayIso);
}

export function slotMatchesCategoryStatChip(
  slot: ExploreSlot,
  chip: string,
  when: string,
  calendarDayIso?: string | null,
): boolean {
  const label = chip === "Free tonight" || chip === "Free" ? freePriceStatLabel(when) : chip;
  switch (label) {
    case "Events":
      return isExploreEventListing(slot);
    case "Food & drink":
      return isExploreFoodAndDrinkListing(slot);
    case "Live music":
      return isExploreLiveMusicListing(slot);
    case "Outdoors":
      return isExploreOutdoorsListing(slot);
    case "Landmarks":
      return isExploreLandmarkListing(slot);
    case "Free tonight":
    case "Free":
      return isExploreFreeInWhenRange(slot, when, calendarDayIso);
    default:
      return false;
  }
}

export function datedEventMatchesActiveScope(
  slot: ExploreSlot,
  when: string,
  calendarDayIso?: string | null,
): boolean {
  if (!isExploreEventListing(slot)) return true;
  return eventDateInActiveScope(slot.eventDateIso, when, calendarDayIso);
}
