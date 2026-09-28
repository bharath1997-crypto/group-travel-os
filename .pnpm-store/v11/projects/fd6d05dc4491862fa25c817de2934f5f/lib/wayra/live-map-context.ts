/**
 * Google Maps–style implicit location context for Wayra on Rovvy Live.
 * The active map pin is attached to every assistant turn without the user re-stating it.
 */

import { liveGeocodingReverse } from "@/app/(dashboard)/live/live-geocoding";
import {
  buildRegionLabel,
  isGenericPlaceName,
  resolvePlaceDisplayName,
} from "@/lib/wayra/place-region";
import {
  buildLiveSelectedPlaceReply,
  extractLiveSelectedPlace,
  isLivePage,
} from "@/lib/wayra/intent";

export const WAYRA_PLACE_PICKED_EVENT = "rovvy:wayra-place-picked";
export const WAYRA_MAP_FOCUS_EVENT = "rovvy:wayra-map-focus";

export type WayraPlacePickedDetail = {
  lat: number;
  lng: number;
  name?: string | null;
  /** When true, open Wayra and show the local tap brief. */
  autoOpen?: boolean;
};

export type WayraMapFocusDetail = {
  lat: number;
  lng: number;
  name?: string | null;
  zoom?: number;
  /** When true, open the place preview panel on Live. */
  showPreview?: boolean;
};

export function emitWayraPlacePicked(detail: WayraPlacePickedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WAYRA_PLACE_PICKED_EVENT, { detail }));
}

export function emitWayraMapFocus(detail: WayraMapFocusDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WAYRA_MAP_FOCUS_EVENT, { detail }));
}

/** Short local brief after map tap — no LLM call (zero API cost). */
export function buildLiveMapTapBrief(context: Record<string, unknown>): string {
  const place = extractLiveSelectedPlace(context);
  if (!place) {
    return "Pin dropped. Ask me anything about this spot — the drive, warnings, or what's nearby.";
  }

  const liveStage =
    typeof context.liveStage === "string" ? context.liveStage : null;
  const core = buildLiveSelectedPlaceReply(place, liveStage);
  return `${core} Ask me what's here, how far it is, or how to prepare.`;
}

/** Compact block injected into LLM requests so every reply stays place-aware. */
export function buildLiveImplicitContextBlock(
  context: Record<string, unknown>,
): string | null {
  if (!isLivePage("live", context)) return null;

  const place = extractLiveSelectedPlace(context);
  if (!place) return null;

  const displayName = resolvePlaceDisplayName(place.name, place);
  const regionLabel = buildRegionLabel(place);

  const lines: string[] = [
    "ACTIVE MAP PIN (answer about this place by default):",
    `- Name: ${displayName}`,
    `- Coordinates: ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`,
  ];

  const userLoc = context.userLocation;
  if (userLoc && typeof userLoc === "object") {
    const u = userLoc as Record<string, unknown>;
    const homeParts = [u.city, u.state, u.country]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    if (homeParts.length > 0) {
      lines.splice(
        1,
        0,
        `USER PHYSICAL LOCATION (GPS/home): ${homeParts.join(", ")} — where they are NOW, not the pin.`,
      );
    }
  }

  if (regionLabel && regionLabel !== displayName) {
    lines.push(`- Region: ${regionLabel}`);
  }
  if (place.city?.trim()) lines.push(`- City/area: ${place.city.trim()}`);
  if (place.state?.trim()) lines.push(`- State/province: ${place.state.trim()}`);
  if (place.country?.trim()) lines.push(`- Country: ${place.country.trim()}`);
  if (place.address?.trim() && !place.address.trim().startsWith("Coordinates:")) {
    lines.push(`- Address/region: ${place.address.trim()}`);
  }
  if (place.category?.trim()) lines.push(`- Category: ${place.category.trim()}`);
  if (typeof context.liveStage === "string") {
    lines.push(`- Live stage: ${context.liveStage}`);
  }

  const suggestions = context.aiSuggestions;
  if (Array.isArray(suggestions) && suggestions.length > 0) {
    lines.push("- Route tips/warnings:");
    for (const row of suggestions) {
      if (
        row &&
        typeof row === "object" &&
        typeof (row as { message?: unknown }).message === "string"
      ) {
        lines.push(`  • ${(row as { message: string }).message}`);
      }
    }
  }

  const route = context.routePreview;
  if (route && typeof route === "object") {
    const r = route as Record<string, unknown>;
    if (typeof r.durationSeconds === "number" && r.durationSeconds > 0) {
      const hours = Math.max(1, Math.round(r.durationSeconds / 3600));
      lines.push(`- Drive time (preview): ~${hours} hr`);
    }
    if (typeof r.distanceMeters === "number" && r.distanceMeters > 0) {
      const miles = (r.distanceMeters / 1609.344).toFixed(1);
      lines.push(`- Distance (preview): ~${miles} mi`);
    }
    if (typeof r.borderNotice === "string" && r.borderNotice.trim()) {
      lines.push(`- Border: ${r.borderNotice.trim()}`);
    }
    if (typeof r.lastMileNotice === "string" && r.lastMileNotice.trim()) {
      lines.push(`- Last mile: ${r.lastMileNotice.trim()}`);
    }
  }

  lines.push(
    "Use coordinates and region fields to identify the real-world location even when the pin label is generic.",
    "When USER PHYSICAL LOCATION is present, plan reach/flights/timing/budget FROM home TO the pin.",
    "Answer on-site weather and activities about the destination pin.",
    "Treat the user's message as about this pin unless they clearly ask how Rovvy works.",
  );
  return lines.join("\n");
}

async function enrichSelectedPlaceInContext(
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const place = extractLiveSelectedPlace(context);
  if (!place) return context;

  const hasRegion = Boolean(place.city?.trim() || place.country?.trim());
  if (!isGenericPlaceName(place.name) && hasRegion) return context;

  const details = await liveGeocodingReverse(place.lat, place.lng);
  if (!details) return context;

  const city = details.city ?? details.address?.city ?? details.address?.town ?? details.address?.village ?? null;
  const state = details.state ?? details.address?.state ?? null;
  const country = details.country ?? details.address?.country ?? null;
  const address = details.display_name?.trim() || place.address;
  const enrichedPlace = {
    ...place,
    name: resolvePlaceDisplayName(details.name || place.name, {
      city,
      state,
      country,
      address,
    }),
    city,
    state,
    country,
    address,
  };

  return {
    ...context,
    selectedPlace: enrichedPlace,
    resolvedMapRegion: buildRegionLabel({ city, state, country }),
  };
}

/** Reverse-geocode generic dropped pins before LLM calls, then attach implicit context. */
export async function prepareLiveWayraContext(
  page: string,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let next = { ...context };

  if (isLivePage(page, context) || isLivePage("", context)) {
    next = await enrichSelectedPlaceInContext(next);
    next = withLiveImplicitContext(page, next);
  }

  if (context.chatAttachedLocation) {
    next.chatAttachedLocation = context.chatAttachedLocation;
  }
  if (context.messengerProfile) {
    next.messengerProfile = context.messengerProfile;
  }
  if (context.userLocation) {
    next.userLocation = context.userLocation;
  }

  return next;
}

/** Merge implicit pin context into the payload sent to /ai/assistant. */
export function withLiveImplicitContext(
  page: string,
  context: Record<string, unknown>,
): Record<string, unknown> {
  if (!isLivePage(page, context) && !isLivePage("", context)) {
    return context;
  }

  const implicitBlock = buildLiveImplicitContextBlock(context);
  if (!implicitBlock) return context;

  return {
    ...context,
    implicitLocation: true,
    activeMapPin: extractLiveSelectedPlace(context),
    liveContextBlock: implicitBlock,
  };
}

export const LIVE_QUICK_PROMPTS = [
  "What's here?",
  "How far is this from me?",
  "What should I prepare for this trip?",
] as const;

export function liveQuickPromptsForPlace(placeName?: string | null): string[] {
  const name = placeName?.trim();
  if (!name) return [...LIVE_QUICK_PROMPTS];
  return [
    `What's at ${name}?`,
    "How far is this from me?",
    "What should I prepare for this trip?",
  ];
}
