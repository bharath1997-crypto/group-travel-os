/** G14 — sanitize listing location display copy under /explore (not hero/search scope). */

const INVALID_LITERALS = new Set(["null", "undefined", "none"]);

/** True when a raw provider value should not appear in listing UI. */
export function isMissingListingLocationComponent(value: string | null | undefined): boolean {
  if (value == null) return true;
  const t = value.trim();
  if (!t) return true;
  return INVALID_LITERALS.has(t.toLowerCase());
}

/** Trim valid components; null when missing/invalid. */
export function cleanListingLocationComponent(value: string | null | undefined): string | null {
  if (isMissingListingLocationComponent(value)) return null;
  return value!.trim();
}

/**
 * City/locality required. Omits country-only lines (e.g. bare "US").
 * Dedupes case-insensitive repeated segments.
 */
export function formatListingLocationDisplay(input: {
  city?: string | null;
  locality?: string | null;
  state?: string | null;
  country?: string | null;
}): string | undefined {
  const city = cleanListingLocationComponent(input.city) ?? cleanListingLocationComponent(input.locality);
  if (!city) return undefined;

  const parts: string[] = [city];
  const seen = new Set<string>([city.toLowerCase()]);

  for (const raw of [input.state, input.country]) {
    const part = cleanListingLocationComponent(raw);
    if (!part) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(part);
  }

  return parts.join(" · ");
}

/** Join display fragments with middle dots — no empty segments or dangling separators. */
export function joinExploreMetaParts(...rawParts: (string | null | undefined)[]): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawParts) {
    const part = cleanListingLocationComponent(raw);
    if (!part) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(part);
  }
  return parts.join(" · ");
}

/** Venue + city/state/country line for event slots and summaries. */
export function formatEventListingSummary(input: {
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  title?: string | null;
}): string | undefined {
  const venue = cleanListingLocationComponent(input.venue);
  const name = cleanListingLocationComponent(input.title);
  const venueDiffersFromName =
    Boolean(venue) && Boolean(name) && venue!.toLowerCase() !== name!.toLowerCase();
  const locLine = formatListingLocationDisplay({
    city: input.city,
    state: input.state,
    country: input.country,
  });

  if (venueDiffersFromName && locLine) return joinExploreMetaParts(venue, locLine);
  if (locLine) return locLine;
  if (venueDiffersFromName && venue) return venue;
  return undefined;
}

/** Meta row place segment: prefer venue when it differs from title; else city/locality only. */
export function formatEventMetaPlace(input: {
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  title?: string | null;
}): string | undefined {
  const venue = cleanListingLocationComponent(input.venue);
  const name = cleanListingLocationComponent(input.title);
  const venueDiffersFromName =
    Boolean(venue) && Boolean(name) && venue!.toLowerCase() !== name!.toLowerCase();
  if (venueDiffersFromName) return venue!;
  const locLine = formatListingLocationDisplay({
    city: input.city,
    state: input.state,
    country: input.country,
  });
  return locLine?.split(" · ")[0];
}

/** Category scroll cards — primary/secondary lines without dangling location text. */
export function formatCategoryCardLocation(
  item: {
    venue?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    distance_miles?: number | null;
  },
  userCity: string,
): { primary: string; secondary?: string } {
  const venue = cleanListingLocationComponent(item.venue);
  const locLine = formatListingLocationDisplay({
    city: item.city,
    state: item.state,
    country: item.country,
  });
  const cityOnly = locLine?.split(" · ")[0];
  const primary = venue || cityOnly || "";

  if (!primary && !locLine) return { primary: "", secondary: undefined };

  const userKey = (cleanListingLocationComponent(userCity.split(",")[0]) || "").toLowerCase();
  const eventCityKey = (cityOnly || "").toLowerCase();

  const secondaryParts: string[] = [];
  if (item.distance_miles != null && Number.isFinite(item.distance_miles)) {
    const dist = Math.round(item.distance_miles);
    secondaryParts.push(eventCityKey && eventCityKey === userKey ? `${dist} mi away` : `${dist} mi`);
  }
  if (locLine) {
    if (venue) secondaryParts.push(locLine);
    else if (locLine.includes(" · ")) secondaryParts.push(locLine);
  } else if (secondaryParts.length && cityOnly) {
    secondaryParts.push(cityOnly);
  }

  let secondary = joinExploreMetaParts(...secondaryParts) || undefined;
  if (secondary === primary) secondary = undefined;
  if (!secondary && locLine && !venue && locLine.includes(" · ")) {
    secondary = locLine.slice(locLine.indexOf(" · ") + 3);
  }
  return { primary, secondary };
}

type EventLocationFields = {
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  title?: string | null;
};

/** “At {place}” phrase for prose; undefined when no valid venue/locality. */
export function formatEventAtPlacePhrase(fields: EventLocationFields): string | undefined {
  return formatEventListingSummary(fields);
}

/** Short listing description (drawer-adjacent / meta). */
export function formatEventListingDescription(input: {
  name: string;
  category: string;
} & EventLocationFields): string {
  const title = cleanListingLocationComponent(input.name) || "Listing";
  const category = cleanListingLocationComponent(input.category) || "Experience";
  const atPlace = formatEventAtPlacePhrase(input);
  if (atPlace) return `${title} at ${atPlace}. ${category}.`;
  return `${title}. ${category}.`;
}

/** Drawer body / long listing prose — no dangling “at” or “for”. */
export function formatEventListingBody(input: {
  name: string;
  category: string;
  provider: string;
  editorial: boolean;
} & EventLocationFields): string {
  const title = cleanListingLocationComponent(input.name) || "Listing";
  const category = cleanListingLocationComponent(input.category) || "Experience";
  const provider = cleanListingLocationComponent(input.provider) || "provider";
  const locLine = formatListingLocationDisplay({
    city: input.city,
    state: input.state,
    country: input.country,
  });

  if (input.editorial) {
    if (locLine) {
      return `${title} — editorial suggestion for ${locLine}. Not verified live inventory.`;
    }
    return `${title} — editorial suggestion. Not verified live inventory.`;
  }

  const atPlace = formatEventAtPlacePhrase(input);
  if (atPlace) {
    return `${title} at ${atPlace}. ${category}. Listed via ${provider}.`;
  }
  return `${title}. ${category}. Listed via ${provider}.`;
}

/** Google Maps search query from sanitized venue + locality only. */
export function formatMapsSearchQuery(fields: EventLocationFields): string {
  const venue = cleanListingLocationComponent(fields.venue);
  const locLine = formatListingLocationDisplay({
    city: fields.city,
    state: fields.state,
    country: fields.country,
  });
  return joinExploreMetaParts(venue, locLine);
}

/** Drawer / map row — prefer structured location; fall back to cleaned area text. */
export function formatSlotListingArea(slot: {
  city?: string | null;
  stateLabel?: string | null;
  countryLabel?: string | null;
  area?: string | null;
  venue?: string | null;
}): string | undefined {
  const locLine = formatListingLocationDisplay({
    city: slot.city,
    state: slot.stateLabel,
    country: slot.countryLabel,
  });
  if (locLine) return locLine;
  return cleanListingLocationComponent(slot.area) ?? cleanListingLocationComponent(slot.venue) ?? undefined;
}
