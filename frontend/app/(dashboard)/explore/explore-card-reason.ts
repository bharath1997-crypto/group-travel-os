import { haversineMiles } from "@/lib/hero-location";

import type { ExploreSlot } from "./explore-hub-data";
import { formatExploreDistanceMiles } from "./explore-distance-label";

export type ExploreCardReasonContext = {
  when: string;
  now?: Date;
  savedPlaceSlots?: ExploreSlot[];
  anchorLat?: number | null;
  anchorLon?: number | null;
};

function normalizeWhen(when: string): string {
  return when.trim().toLowerCase();
}

function eventStartMs(slot: ExploreSlot): number | null {
  if (slot.eventStartsAtMs != null && Number.isFinite(slot.eventStartsAtMs)) {
    return slot.eventStartsAtMs;
  }
  return null;
}

function isTonightSlot(slot: ExploreSlot, when: string, now: Date): boolean {
  if (normalizeWhen(when) === "tonight" && slot.exploreListingKind === "event") return true;
  if (slot.exploreListingKind !== "event" || !slot.eventDateIso) return false;
  const today = now.toISOString().slice(0, 10);
  return slot.eventDateIso.slice(0, 10) === today;
}

function startsWithinHours(slot: ExploreSlot, now: Date, hours: number): string | null {
  if (slot.exploreListingKind !== "event") return null;
  const start = eventStartMs(slot);
  if (start == null) return null;
  const deltaMs = start - now.getTime();
  if (deltaMs <= 0 || deltaMs > hours * 3600_000) return null;
  const mins = Math.round(deltaMs / 60_000);
  if (mins < 60) return `Starts in ${mins} min`;
  const h = Math.round(mins / 60);
  return h === 1 ? "Starts in 1 h" : `Starts in ${h} h`;
}

function similarToSavedPlace(slot: ExploreSlot, savedPlaces: ExploreSlot[]): boolean {
  if (slot.exploreListingKind !== "place" || savedPlaces.length === 0) return false;
  const slotTags = new Set(slot.tags.map((t) => t.toLowerCase()).filter(Boolean));
  const slotCity = (slot.city || "").trim().toLowerCase();
  for (const saved of savedPlaces) {
    if (saved.id === slot.id) continue;
    if (saved.exploreListingKind !== "place") continue;
    const sharedTag = saved.tags.some((t) => slotTags.has(t.toLowerCase()));
    const sameCity = slotCity && saved.city?.trim().toLowerCase() === slotCity;
    if (sharedTag && sameCity) return true;
  }
  return false;
}

/** One honest reason label per card, or undefined to hide (F15 / F24). */
export function exploreCardReasonLabel(slot: ExploreSlot, ctx: ExploreCardReasonContext): string | undefined {
  const now = ctx.now ?? new Date();
  const savedPlaces = (ctx.savedPlaceSlots ?? []).filter((s) => s.exploreListingKind === "place");

  if (similarToSavedPlace(slot, savedPlaces)) {
    return "Similar to a place you saved";
  }

  if (slot.priceKnown === true && slot.price === "Free") {
    return "Free";
  }

  const starts = startsWithinHours(slot, now, 3);
  if (starts) return starts;

  if (isTonightSlot(slot, ctx.when, now)) {
    return "Tonight";
  }

  const miles =
    slot.distanceMiles ??
    (slot.lat != null && slot.lng != null && ctx.anchorLat != null && ctx.anchorLon != null
      ? haversineMiles(ctx.anchorLat, ctx.anchorLon, slot.lat, slot.lng)
      : null);
  const dist = formatExploreDistanceMiles(miles);
  if (dist) return dist;

  return undefined;
}
