import type { DepthTier, GroupTag, Hours, Photo, Place, PlaceDistance } from "./place-panel-types";

export type PlacePanelMediaMode = "grid" | "single" | "map-crop";

export type PlacePanelDetailRow =
  | { kind: "hours"; statusWord: string; rest: string; status: "open" | "closed" }
  | { kind: "address"; text: string }
  | { kind: "instagram"; handle: string; href: string }
  | { kind: "distance"; text: string };

export type PlacePanelCta =
  | { kind: "hold-seats"; seatCount: number; slotLabel: string }
  | { kind: "tier0-empty"; heading: string; body: string }
  | { kind: "tier1-empty"; heading: string; body: string };

export type PlacePanelSections = {
  mediaMode: PlacePanelMediaMode;
  photoGrid: Photo[];
  photoOverflow: number;
  singlePhotoCount: number;
  showSlotsChip: boolean;
  showRollUp: boolean;
  showDescription: boolean;
  showGroupTags: boolean;
  showLatestReview: boolean;
  detailRows: PlacePanelDetailRow[];
  cta: PlacePanelCta | null;
  provenance: string;
  showClaimedBadge: boolean;
};

export function buildCategorySubtitle(
  place: Pick<Place, "category_label" | "neighborhood">,
  regionHint?: string | null,
): string | null {
  const category = place.category_label?.trim() || "Place";
  const region =
    place.neighborhood?.trim() ||
    regionHint?.trim() ||
    null;

  if (region && region.toLowerCase() !== category.toLowerCase()) {
    return `${category} · ${region}`;
  }
  return category !== "Place" ? category : region ? `Place · ${region}` : null;
}

export function shouldShowLivePreviewChrome(
  sections: Pick<
    PlacePanelSections,
    "mediaMode" | "showGroupTags" | "showLatestReview" | "cta"
  >,
  isSheet: boolean,
): boolean {
  if (!isSheet) return false;
  if (sections.mediaMode === "grid" || sections.mediaMode === "single") return false;
  if (sections.showGroupTags || sections.showLatestReview) return false;
  if (sections.cta?.kind === "hold-seats") return false;
  return true;
}

export function categoryGlyphLabel(category: string, categoryLabel: string): string {
  const source = categoryLabel.trim() || category.replace(/_/g, " ");
  const word = source.split(/\s+/)[0] ?? "?";
  return word.charAt(0).toUpperCase();
}

export function truncateGersId(gersId: string): string {
  const trimmed = gersId.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-3)}`;
}

export function formatProvenance(place: Pick<Place, "depth_tier" | "gers_id" | "updated_at">): string {
  if (place.depth_tier === 0) {
    return `overture · gers ${truncateGersId(place.gers_id)}`;
  }
  if (place.depth_tier === 1) {
    return `tier 1 · updated ${formatShortDate(place.updated_at)}`;
  }
  return "tier 2 · curated by Rovvy";
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "recently";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return Number(match24[1]) * 60 + Number(match24[2]);
  }
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = Number(match12[1]) % 12;
    if (match12[3]?.toUpperCase() === "PM") hours += 12;
    return hours * 60 + Number(match12[2]);
  }
  return null;
}

function formatTimeDisplay(value: string): string {
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) return value;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return mins === 0 ? `${hours12}:00 ${period}` : `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}

export function formatHoursRow(hours: Hours): PlacePanelDetailRow {
  if (hours.is_open && hours.closes_at) {
    return {
      kind: "hours",
      statusWord: "Open",
      rest: `until ${formatTimeDisplay(hours.closes_at)}`,
      status: "open",
    };
  }
  if (!hours.is_open && hours.opens_at) {
    return {
      kind: "hours",
      statusWord: "Closed",
      rest: `· opens ${formatTimeDisplay(hours.opens_at)}`,
      status: "closed",
    };
  }
  return {
    kind: "hours",
    statusWord: hours.is_open ? "Open" : "Closed",
    rest: hours.is_open ? "now" : "",
    status: hours.is_open ? "open" : "closed",
  };
}

export function formatDistanceRow(distance: PlaceDistance): PlacePanelDetailRow {
  const miles = distance.miles.toFixed(1);
  const centre = distance.fromGroupCentre ? "your group's centre" : "you";
  return {
    kind: "distance",
    text: `${miles} mi from ${centre} · ${distance.driveMinutes} min drive`,
  };
}

export function buildDetailRows(
  place: Pick<Place, "hours" | "address" | "instagram">,
  distance: PlaceDistance | null | undefined,
): PlacePanelDetailRow[] {
  const rows: PlacePanelDetailRow[] = [];
  if (place.hours) rows.push(formatHoursRow(place.hours));
  if (place.address?.trim()) rows.push({ kind: "address", text: place.address.trim() });
  if (place.instagram?.trim()) {
    const handle = place.instagram.trim().replace(/^@/, "");
    rows.push({
      kind: "instagram",
      handle,
      href: `https://instagram.com/${handle}`,
    });
  }
  if (distance) rows.push(formatDistanceRow(distance));
  return rows;
}

export function resolveMediaMode(photos: Photo[] | null | undefined): PlacePanelMediaMode {
  const count = photos?.length ?? 0;
  if (count >= 3) return "grid";
  if (count >= 1) return "single";
  return "map-crop";
}

export function buildPhotoGrid(photos: Photo[]): { cells: Photo[]; overflow: number } {
  const cells = photos.slice(0, 3);
  const overflow = Math.max(0, photos.length - 3);
  return { cells, overflow };
}

export function formatRollUp(wouldReturnPct: number, reviewCount: number): string {
  return `${Math.round(wouldReturnPct)}% would go again`;
}

export function formatReviewCount(reviewCount: number): string {
  return `${reviewCount} review${reviewCount === 1 ? "" : "s"}`;
}

export function formatHoldSeatsLabel(seatCount: number, nextSlotIso: string | null): string {
  const slot = formatSlotTime(nextSlotIso);
  return slot ? `Hold ${seatCount} seats · ${slot}` : `Hold ${seatCount} seats`;
}

function formatSlotTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export type PlacePanelCtaInput = Pick<
  Place,
  | "bookable"
  | "next_slot"
  | "short_description"
  | "hours"
  | "claimed"
  | "instagram"
  | "website"
  | "photos"
  | "review_count"
  | "group_tags"
  | "latest_review"
  | "would_return_pct"
>;

/** Group-review richness — independent of depth_tier integer. */
export function hasGroupReviewData(place: PlacePanelCtaInput): boolean {
  return (
    place.review_count > 0 ||
    place.group_tags.length > 0 ||
    place.latest_review != null ||
    (place.would_return_pct != null && place.review_count > 0)
  );
}

/** Operator / dataset enrichment (tier-1-ish signals). */
export function hasOperatorEnrichment(place: PlacePanelCtaInput): boolean {
  return Boolean(
    place.short_description?.trim() ||
      place.hours ||
      place.claimed ||
      place.instagram?.trim() ||
      place.website?.trim(),
  );
}

export function buildCta(place: PlacePanelCtaInput, groupSize: number): PlacePanelCta | null {
  if (place.bookable && place.next_slot) {
    return {
      kind: "hold-seats",
      seatCount: groupSize,
      slotLabel: formatSlotTime(place.next_slot) ?? "",
    };
  }
  const photoCount = place.photos?.length ?? 0;
  if (!hasOperatorEnrichment(place) && !hasGroupReviewData(place) && photoCount === 0) {
    return {
      kind: "tier0-empty",
      heading: "Nobody in your circle has been",
      body:
        "No hours, no photos and no reviews on this one yet. If you go, you're the first — and it stops looking like this for everyone after you.",
    };
  }
  if (!hasGroupReviewData(place)) {
    return {
      kind: "tier1-empty",
      heading: "Can six of us get in?",
      body: "No group data yet — waits and table sizes come from reviews.",
    };
  }
  return null;
}

export function buildPlacePanelSections(
  place: Place,
  options?: {
    distance?: PlaceDistance | null;
    groupSize?: number;
  },
): PlacePanelSections {
  const photos = place.photos ?? [];
  const mediaMode = resolveMediaMode(photos);
  const { cells, overflow } = buildPhotoGrid(photos);

  return {
    mediaMode,
    photoGrid: cells,
    photoOverflow: overflow,
    singlePhotoCount: photos.length,
    showSlotsChip: Boolean(place.bookable && place.slots_tonight != null && place.slots_tonight > 0),
    showRollUp: place.would_return_pct != null && place.review_count > 0,
    showDescription: Boolean(place.short_description?.trim()),
    showGroupTags: place.group_tags.length > 0,
    showLatestReview: place.latest_review != null,
    detailRows: buildDetailRows(place, options?.distance),
    cta: buildCta(place, options?.groupSize ?? 6),
    provenance: formatProvenance(place),
    showClaimedBadge: place.claimed,
  };
}

/** Warn tags stay in source order — never sorted or hidden. */
export function orderGroupTags(tags: GroupTag[]): GroupTag[] {
  return [...tags];
}

export function photoPublicUrl(keyPrefix: string): string {
  const base = (process.env.NEXT_PUBLIC_PHOTOS_BASE_URL ?? "").replace(/\/$/, "");
  if (base) return `${base}/${keyPrefix.replace(/^\//, "")}`;
  return `/photos/${keyPrefix.replace(/^\//, "")}`;
}

export function isSheetViewport(widthPx: number): boolean {
  return widthPx < 640;
}

export function mergePlaceSeed(seed: Partial<Place>, detail: Partial<Place> | null): Place {
  const merged = { ...seed, ...detail } as Place;
  return {
    gers_id: merged.gers_id ?? "",
    name: merged.name ?? "Place",
    category: merged.category ?? "place",
    category_label: merged.category_label ?? "Place",
    lat: merged.lat ?? 0,
    lon: merged.lon ?? 0,
    neighborhood: merged.neighborhood ?? null,
    city_slug: merged.city_slug ?? null,
    address: merged.address ?? null,
    depth_tier: (merged.depth_tier ?? 0) as DepthTier,
    short_description: merged.short_description ?? null,
    description_source: merged.description_source ?? null,
    description_url: merged.description_url ?? null,
    website: merged.website ?? null,
    instagram: merged.instagram ?? null,
    hours: merged.hours ?? null,
    claimed: merged.claimed ?? false,
    photos: merged.photos ?? [],
    would_return_pct: merged.would_return_pct ?? null,
    review_count: merged.review_count ?? 0,
    group_tags: merged.group_tags ?? [],
    latest_review: merged.latest_review ?? null,
    bookable: merged.bookable ?? false,
    next_slot: merged.next_slot ?? null,
    slots_tonight: merged.slots_tonight ?? null,
    updated_at: merged.updated_at ?? "",
  };
}
