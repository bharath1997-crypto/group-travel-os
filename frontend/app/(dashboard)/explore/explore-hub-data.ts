import type { ExplorePhotoCredit } from "./explore-fixtures";
import { apiFetch } from "@/lib/api";
import type { ExplorerDrawerItem } from "@/components/explorer/ExplorerItemDetailDrawer";
import {
  filterSlotsByLocationScope,
  type ExploreHubFetchInput,
  type ExploreLocationScope,
} from "./explore-location-scope";
import {
  type ExploreEvent,
  EXPLORE_FETCH_TIMEOUT_MS,
  formatDateTime,
  hydrateSectionsFromResponse,
  normalizeCategory,
  sourceLabel,
} from "@/lib/explore-events";
import {
  hubListingBadge,
  normalizeListingAvailability,
  placeCardAvailability,
  placeHoursLabel,
} from "./explore-availability-copy";
import {
  EXPLORE_PRICE_UNKNOWN,
  exploreEventPriceState,
} from "./explore-listing-field-state";
import type { ExploreFreshnessMeta, ExploreSourceFreshness } from "./explore-freshness-copy";
import {
  classifyExplorePlacesSourceLoadState,
  classifyExploreSourceLoadState,
  deriveExploreHubLoadState,
  type ExploreHubLoadState,
  type ExplorePlacesSourceStatus,
  type ExploreSourceStatusMap,
} from "./explore-hub-fetch-state";
import { haversineMiles } from "@/lib/hero-location";

import { formatExploreDistanceFromMeters, formatExploreDistanceMiles } from "./explore-distance-label";
import { interleaveEventSlotsByDayAndProvider } from "./explore-event-interleave";
import { rankExploreHubSlots } from "./explore-feed-quality";
import { interleaveExploreListingSlots } from "./explore-hub-counts";
import { resolveScaperMetroCity } from "./explore-scaper-metro";
import {
  filterVerifiedExploreApiEventRows,
  isEditorialExploreListing,
} from "./explore-editorial-inventory";
import {
  formatEventListingSummary,
  formatEventMetaPlace,
  formatEventListingBody,
  formatEventListingDescription,
  formatListingLocationDisplay,
  joinExploreMetaParts,
  cleanListingLocationComponent,
  formatSlotListingArea,
} from "./explore-listing-location";
import {
  explorePlacesQuery,
  placeSourceLabel,
  slotIdentityForPlace,
  type ExplorePlaceRow,
  uniquePlacesByGersId,
} from "./explore-hub-places-overture";

export type PhotoTheme = "music" | "food" | "outdoors" | "comedy" | "bar" | "landmark" | "art";

export type ExploreSlot = ExplorerDrawerItem & {
  meta: string;
  summary: string;
  price: string;
  note: string;
  rating: string;
  reviews: string;
  size: "short" | "medium" | "tall";
  badge?: string;
  reason?: string;
  theme: PhotoTheme;
  imageUrl?: string | null;
  amount: number;
  body: string;
  tags: string[];
  area: string;
  distanceLabel: string;
  availability: string;
  stateLabel?: string;
  countryLabel?: string;
  distanceMiles?: number | null;
  editorial?: boolean;
  priceKnown?: boolean;
  openingHours?: string | null;
  hoursSource?: string | null;
  exploreListingKind: "event" | "place";
  explorePlaceBucket?: "attractions" | "restaurants";
  eventDateIso?: string | null;
  eventStartsAtMs?: number | null;
  /** Full street address from the provider (places only). */
  placeAddress?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageCredit?: ExplorePhotoCredit | null;
};

export type ExploreHubPayload = {
  city: string;
  displayCity: string;
  /** All mapped listings after location/date scope (bounded client pool). */
  slots: ExploreSlot[];
  /** Browser request time — diagnostics only; not shown as data age. */
  loadedAt?: string;
  sourceFreshness: ExploreSourceFreshness;
  sources: string[];
  locationScope?: ExploreLocationScope | null;
  /** Coordinates used for places radius + distance labels (hero anchor). */
  placesAnchor?: { lat: number; lng: number } | null;
  hubLoadState: ExploreHubLoadState;
  sourceStatus: ExploreSourceStatusMap;
};

function isEditorialEvent(event: ExploreEvent): boolean {
  return isEditorialExploreListing(event.source, event.id);
}

type DistanceAnchor = { lat: number; lng: number };

function formatDistanceFromMeters(distanceM: number | null | undefined): string {
  return formatExploreDistanceFromMeters(distanceM);
}

function eventDistanceMiles(
  event: ExploreEvent,
  anchor: DistanceAnchor | null,
): number | null {
  if (
    anchor &&
    event.venue_lat != null &&
    event.venue_lon != null &&
    Number.isFinite(event.venue_lat) &&
    Number.isFinite(event.venue_lon)
  ) {
    return haversineMiles(anchor.lat, anchor.lng, event.venue_lat, event.venue_lon);
  }
  if (event.distance_miles != null && Number.isFinite(event.distance_miles)) {
    return event.distance_miles;
  }
  return null;
}

type EventsAPIResponse = {
  city: string;
  display_city?: string;
  events: ExploreEvent[];
  freshness?: ExploreFreshnessMeta;
  trending?: ExploreEvent[];
  weekend?: ExploreEvent[];
  popular?: ExploreEvent[];
  national?: ExploreEvent[];
  total?: number;
};

const SIZES: ExploreSlot["size"][] = ["tall", "medium", "short", "medium", "tall", "short"];

function slotAmount(priceMin: number | null, priceLabel: string): number {
  if (priceMin != null && Number.isFinite(priceMin)) return Math.max(0, Math.round(priceMin));
  if (priceLabel === "Free") return 0;
  const match = priceLabel.match(/\$(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function formatDistanceKm(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles)) return "—";
  const km = miles * 1.60934;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Orlando: { lat: 28.5383, lng: -81.3792 },
  Chicago: { lat: 41.8781, lng: -87.6298 },
  "New York": { lat: 40.7128, lng: -74.006 },
  "Los Angeles": { lat: 34.0522, lng: -118.2437 },
  Miami: { lat: 25.7617, lng: -80.1918 },
  "Las Vegas": { lat: 36.1699, lng: -115.1398 },
  Austin: { lat: 30.2672, lng: -97.7431 },
  "New Orleans": { lat: 29.9511, lng: -90.0715 },
  Denver: { lat: 39.7392, lng: -104.9903 },
  Boston: { lat: 42.3601, lng: -71.0589 },
  Seattle: { lat: 47.6062, lng: -122.3321 },
  Nashville: { lat: 36.1627, lng: -86.7816 },
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  Atlanta: { lat: 33.749, lng: -84.388 },
  Houston: { lat: 29.7604, lng: -95.3698 },
  "Washington DC": { lat: 38.9072, lng: -77.0369 },
  Toronto: { lat: 43.6532, lng: -79.3832 },
  Vancouver: { lat: 49.2827, lng: -123.1207 },
  Montreal: { lat: 45.5017, lng: -73.5673 },
  Calgary: { lat: 51.0447, lng: -114.0719 },
  "Mexico City": { lat: 19.4326, lng: -99.1332 },
  Cancún: { lat: 21.1619, lng: -86.8515 },
  Guadalajara: { lat: 20.6597, lng: -103.3496 },
  Oaxaca: { lat: 17.0732, lng: -96.7266 },
  London: { lat: 51.5074, lng: -0.1278 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  Lisbon: { lat: 38.7223, lng: -9.1393 },
  Dublin: { lat: 53.3498, lng: -6.2603 },
  Prague: { lat: 50.0755, lng: 14.4378 },
  Vienna: { lat: 48.2082, lng: 16.3738 },
  Sydney: { lat: -33.8688, lng: 151.2093 },
  Melbourne: { lat: -37.8136, lng: 144.9631 },
  Brisbane: { lat: -27.4698, lng: 153.0251 },
  Perth: { lat: -31.9505, lng: 115.8605 },
  Auckland: { lat: -36.8509, lng: 174.7645 },
  Wellington: { lat: -41.2924, lng: 174.7787 },
  Tokyo: { lat: 35.6762, lng: 139.6503 },
  Osaka: { lat: 34.6937, lng: 135.5023 },
  Seoul: { lat: 37.5665, lng: 126.978 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
  Bangkok: { lat: 13.7563, lng: 100.5018 },
  "Hong Kong": { lat: 22.3193, lng: 114.1694 },
  Taipei: { lat: 25.033, lng: 121.5654 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.7041, lng: 77.1025 },
  "Kuala Lumpur": { lat: 3.139, lng: 101.6869 },
  Jakarta: { lat: -6.2088, lng: 106.8456 },
  Manila: { lat: 14.5995, lng: 120.9842 },
  Dubai: { lat: 25.2048, lng: 55.2708 },
  "Ho Chi Minh City": { lat: 10.8231, lng: 106.6297 },
};

function themeForCategory(category: string, name: string): PhotoTheme {
  const cat = normalizeCategory(category, name).toLowerCase();
  const nameL = name.toLowerCase();
  if (cat.includes("music") || nameL.includes("jazz") || nameL.includes("concert")) return "music";
  if (cat.includes("food") || cat.includes("restaurant") || nameL.includes("kitchen")) return "food";
  if (cat.includes("comedy")) return "comedy";
  if (cat.includes("sport")) return "outdoors";
  if (cat.includes("bar") || cat.includes("night")) return "bar";
  if (cat.includes("landmark") || cat.includes("museum") || cat.includes("art")) return "landmark";
  if (cat.includes("park") || cat.includes("outdoor") || cat.includes("nature")) return "outdoors";
  return "art";
}

function parseEventStartMs(event: ExploreEvent): number | null {
  const day = (event.date || event.start_date || "").slice(0, 10);
  if (!day || day.length < 10) return null;
  const time = (event.time || "").trim() || "19:00";
  const parsed = Date.parse(`${day}T${time}:00`);
  return Number.isNaN(parsed) ? null : parsed;
}

function eventToSlot(event: ExploreEvent, index: number, anchor: DistanceAnchor | null): ExploreSlot {
  const editorial = isEditorialEvent(event);
  const category = normalizeCategory(event.category, event.name);
  const priceState = exploreEventPriceState(event);
  const displayPrice = priceState.cardLabel;
  const priceLabel = priceState.label;
  const isFree = priceState.isFree;
  const priceKnown = priceState.priceKnown;
  const availability = normalizeListingAvailability(event.availability ?? event.status, { editorial });
  const provider = editorial ? "Editorial suggestion" : sourceLabel(event.source);
  const name = event.name.trim();
  const metaPlace = formatEventMetaPlace({
    venue: event.venue,
    city: event.city,
    state: event.state,
    country: event.country,
    title: name,
  });
  const summary = formatEventListingSummary({
    venue: event.venue,
    city: event.city,
    state: event.state,
    country: event.country,
    title: name,
  });
  return {
    id: event.id,
    source: provider,
    meta: joinExploreMetaParts(formatDateTime(event), metaPlace, category),
    title: event.name,
    summary: summary ?? "",
    price: displayPrice,
    note: editorial ? "idea only · verify on provider" : priceKnown ? "from provider listing" : "price unknown",
    rating: "",
    reviews: "",
    size: SIZES[index % SIZES.length],
    badge: hubListingBadge({ editorial, availability: event.availability ?? event.status }),
    venue: event.venue || event.city,
    city: event.city,
    dateLabel: formatDateTime(event),
    priceLabel,
    description: formatEventListingDescription({
      name: event.name,
      category,
      venue: event.venue,
      city: event.city,
      state: event.state,
      country: event.country,
      title: name,
    }),
    emoji: "",
    theme: themeForCategory(event.category, event.name),
    imageUrl: event.image_url,
    sourceUrl: event.ticket_url || null,
    amount: priceKnown ? slotAmount(event.price_min, displayPrice) : 0,
    body: formatEventListingBody({
      name: event.name,
      category,
      provider,
      editorial,
      venue: event.venue,
      city: event.city,
      state: event.state,
      country: event.country,
      title: name,
    }),
    tags: [category, provider],
    area: formatSlotListingArea({
      city: event.city,
      stateLabel: event.state,
      countryLabel: event.country,
      venue: event.venue,
    }) ?? "",
    distanceLabel: formatExploreDistanceMiles(eventDistanceMiles(event, anchor)),
    distanceMiles: eventDistanceMiles(event, anchor),
    lat: event.venue_lat ?? null,
    lng: event.venue_lon ?? null,
    availability,
    stateLabel: event.state ?? undefined,
    countryLabel: event.country ?? undefined,
    editorial,
    priceKnown,
    exploreListingKind: "event",
    eventDateIso: (event.date || event.start_date || "").split("T")[0]?.slice(0, 10) || null,
    eventStartsAtMs: parseEventStartMs(event),
  };
}

function placeListingUrl(place: ExplorePlaceRow): string | null {
  const direct = (place.url || "").trim();
  if (/^https?:\/\//i.test(direct)) return direct;
  if ((place.source || "").toLowerCase() === "overture") return null;
  if (place.id.startsWith("osm-")) {
    const osmId = place.id.slice(4);
    if (osmId) return `https://www.openstreetmap.org/node/${osmId}`;
  }
  return null;
}

function placePhotoCredit(place: ExplorePlaceRow): ExplorePhotoCredit | null {
  if (!place.image_url || !(place.image_attribution || place.image_license)) return null;
  return {
    attribution: place.image_attribution?.trim() || null,
    license: place.image_license?.trim() || null,
    sourceUrl: place.image_source_url?.trim() || null,
  };
}

function placeToSlot(
  place: ExplorePlaceRow,
  city: string,
  index: number,
  bucket: "attractions" | "restaurants",
): ExploreSlot {
  const category = place.category || "Place";
  const provider = placeSourceLabel(place);
  const openingHours = place.opening_hours?.trim() || undefined;
  const hoursSource = place.hours_source?.trim() || undefined;
  const hasHours = Boolean(openingHours);
  const hubLoc = formatListingLocationDisplay({ city });
  const address = cleanListingLocationComponent(place.address);
  const summary =
    (address && hubLoc ? joinExploreMetaParts(address, hubLoc) : undefined) ||
    address ||
    hubLoc ||
    undefined;
  return {
    id: slotIdentityForPlace(place),
    source: provider,
    meta: joinExploreMetaParts(category, hubLoc),
    title: place.name,
    summary: summary ?? "",
    price: EXPLORE_PRICE_UNKNOWN,
    note: hasHours ? "weekly hours from OpenStreetMap · not open-now" : "hours & prices not verified here",
    rating: "",
    reviews: "",
    size: SIZES[(index + 2) % SIZES.length],
    venue: place.address || city,
    city,
    dateLabel: placeHoursLabel(),
    priceLabel: EXPLORE_PRICE_UNKNOWN,
    description: `${place.name} — ${category} in ${city}.`,
    emoji: "",
    theme: themeForCategory(category, place.name),
    imageUrl: place.image_url,
    sourceUrl: placeListingUrl(place),
    amount: 0,
    body: `${place.name} — ${category} in ${city}. Source: ${provider}.`,
    tags: [category, provider],
    area: place.address || city,
    distanceLabel: formatDistanceFromMeters(place.distance_m),
    distanceMiles:
      place.distance_m != null && Number.isFinite(place.distance_m)
        ? place.distance_m / 1609.344
        : null,
    availability: placeCardAvailability(hasHours),
    priceKnown: false,
    openingHours: openingHours ?? null,
    hoursSource: hoursSource ?? null,
    badge: hasHours ? placeCardAvailability(true) : hubListingBadge({ availability: null }),
    exploreListingKind: "place",
    explorePlaceBucket: bucket,
    placeAddress: address ?? null,
    phone: place.phone?.trim() || null,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    imageCredit: placePhotoCredit(place),
  };
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function fetchExploreHub(target: string | ExploreHubFetchInput): Promise<ExploreHubPayload> {
  const input: ExploreHubFetchInput =
    typeof target === "string"
      ? { city: target.split(",")[0].trim() || "Chicago" }
      : target;
  const cityLabel = input.city.split(",")[0].trim() || "Chicago";
  const scaperMetro = resolveScaperMetroCity({
    lat: input.lat,
    lon: input.lon,
    fallbackCity: cityLabel,
  });
  const placesCoords =
    input.lat != null && input.lon != null
      ? { lat: input.lat, lng: input.lon }
      : CITY_COORDS[cityLabel];
  const distanceAnchor = placesCoords
    ? { lat: placesCoords.lat, lng: placesCoords.lng }
    : null;

  const eventParams = new URLSearchParams({
    city: scaperMetro,
    per_page: scaperMetro === "Orlando" ? "300" : "100",
  });
  if (input.dateFrom) eventParams.set("date_from", input.dateFrom);
  if (input.dateTo) eventParams.set("date_to", input.dateTo);
  const scope: ExploreLocationScope | null =
    input.state || input.country || input.displayLabel
      ? {
          label: input.displayLabel || [input.city, input.state, input.country].filter(Boolean).join(", "),
          city: input.city,
          state: input.state ?? undefined,
          country: input.country ?? undefined,
          lat: input.lat,
          lon: input.lon,
        }
      : null;

  const unavailableFreshness: ExploreFreshnessMeta = { refreshed_at: null, cache_status: "unavailable" };

  async function fetchExploreSource<T>(run: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; data: null }> {
    try {
      const data = await run();
      return { ok: true, data };
    } catch {
      return { ok: false, data: null };
    }
  }

  const [eventsResult, attractionsResult, restaurantsResult] = await Promise.all([
    fetchExploreSource(() =>
      apiFetch<EventsAPIResponse>(`/explore/events?${eventParams.toString()}`, {}, EXPLORE_FETCH_TIMEOUT_MS),
    ),
    fetchExploreSource(() =>
      apiFetch<{
        places: ExplorePlaceRow[];
        source_status?: ExplorePlacesSourceStatus;
        freshness?: ExploreFreshnessMeta;
      }>(
        `/explore/places?${explorePlacesQuery(scaperMetro, placesCoords)}&category=attractions`,
        {},
        EXPLORE_FETCH_TIMEOUT_MS,
      ),
    ),
    fetchExploreSource(() =>
      apiFetch<{
        places: ExplorePlaceRow[];
        source_status?: ExplorePlacesSourceStatus;
        freshness?: ExploreFreshnessMeta;
      }>(
        `/explore/places?${explorePlacesQuery(scaperMetro, placesCoords)}&category=restaurants`,
        {},
        EXPLORE_FETCH_TIMEOUT_MS,
      ),
    ),
  ]);

  const eventsRes: EventsAPIResponse = eventsResult.ok
    ? eventsResult.data
    : { city: cityLabel, display_city: cityLabel, events: [], freshness: unavailableFreshness };
  const attractionsRes = attractionsResult.ok
    ? attractionsResult.data
    : { places: [] as ExplorePlaceRow[], freshness: unavailableFreshness };
  const restaurantsRes = restaurantsResult.ok
    ? restaurantsResult.data
    : { places: [] as ExplorePlaceRow[], freshness: unavailableFreshness };

  const hydrated = hydrateSectionsFromResponse(eventsRes);
  const apiEventPool = uniqueById(
    filterVerifiedExploreApiEventRows([
      ...hydrated.sections.trending,
      ...hydrated.sections.weekend,
      ...hydrated.sections.popular,
      ...(eventsRes.events || []),
    ]),
  );
  let eventPool = apiEventPool;
  if (input.dateFrom && input.dateTo) {
    const from = input.dateFrom;
    const to = input.dateTo;
    eventPool = eventPool.filter((ev) => {
      const day = (ev.date || ev.start_date || "").split("T")[0].slice(0, 10);
      if (!day || day.length < 10) return true;
      return day >= from && day <= to;
    });
  }

  const attractionPlaces = attractionsResult.ok
    ? uniquePlacesByGersId(attractionsRes.places || [])
    : [];
  const restaurantPlaces = restaurantsResult.ok
    ? uniquePlacesByGersId(restaurantsRes.places || [])
    : [];

  const rawEventCount = apiEventPool.length;

  const sourceStatus: ExploreSourceStatusMap = {
    events: classifyExploreSourceLoadState(eventsResult.ok, rawEventCount),
    attractions: classifyExplorePlacesSourceLoadState(
      attractionsResult.ok,
      attractionsResult.ok ? attractionsRes : null,
    ),
    restaurants: classifyExplorePlacesSourceLoadState(
      restaurantsResult.ok,
      restaurantsResult.ok ? restaurantsRes : null,
    ),
  };

  const eventSlots = eventsResult.ok
    ? interleaveEventSlotsByDayAndProvider(eventPool.map((ev, i) => eventToSlot(ev, i, distanceAnchor)))
    : [];
  const attractionSlots = attractionsResult.ok
    ? attractionPlaces.map((p, i) => placeToSlot(p, cityLabel, i, "attractions"))
    : [];
  const restaurantSlots = restaurantsResult.ok
    ? restaurantPlaces.map((p, i) => placeToSlot(p, cityLabel, i, "restaurants"))
    : [];
  let slots = interleaveExploreListingSlots(eventSlots, attractionSlots, restaurantSlots);
  if (scope) {
    slots = filterSlotsByLocationScope(slots, scope);
  }
  slots = rankExploreHubSlots(slots);

  const sources = new Set<string>();
  if (eventsResult.ok) {
    eventPool.forEach((e) => sources.add(sourceLabel(e.source)));
  }
  if (attractionsResult.ok) {
    attractionPlaces.forEach((p) => sources.add(placeSourceLabel(p)));
  }
  if (restaurantsResult.ok) {
    restaurantPlaces.forEach((p) => sources.add(placeSourceLabel(p)));
  }

  const hubLoadState = deriveExploreHubLoadState(sourceStatus, slots.length);
  const displayCity = scope?.label || input.displayLabel || eventsRes.display_city || cityLabel;

  return {
    city: cityLabel,
    displayCity,
    slots,
    loadedAt: new Date().toISOString(),
    sourceFreshness: {
      events: eventsRes.freshness ?? unavailableFreshness,
      attractions: attractionsRes.freshness ?? unavailableFreshness,
      restaurants: restaurantsRes.freshness ?? unavailableFreshness,
    },
    sources: Array.from(sources),
    locationScope: scope,
    placesAnchor: distanceAnchor,
    hubLoadState,
    sourceStatus,
  };
}

export function filterSlotsByPrompt(slots: ExploreSlot[], prompt: string): ExploreSlot[] {
  const q = prompt.trim().toLowerCase();
  if (!q) return slots.slice(0, 3);
  return slots
    .filter((slot) => {
      const hay = `${slot.title} ${slot.summary} ${slot.meta} ${slot.price}`.toLowerCase();
      return q.split(/\s+/).some((word) => word.length > 2 && hay.includes(word));
    })
    .slice(0, 3);
}
