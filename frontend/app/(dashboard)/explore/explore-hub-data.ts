import { apiFetch } from "@/lib/api";
import type { ExplorerDrawerItem } from "@/components/explorer/ExplorerItemDetailDrawer";
import {
  type ExploreEvent,
  EXPLORE_FETCH_TIMEOUT_MS,
  formatDateTime,
  formatPrice,
  hydrateSectionsFromResponse,
  normalizeCategory,
  pseudoRating,
  sourceLabel,
} from "@/lib/explore-events";

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
};

export type RankedRow = [string, string, string, string, string, string, string, string];

export type ExploreHubPayload = {
  city: string;
  displayCity: string;
  slots: ExploreSlot[];
  stats: [string, string][];
  ranked: RankedRow[];
  totalLive: number;
  fetchedAt: string;
  sources: string[];
};

type ExplorePlaceRow = {
  id: string;
  name: string;
  address?: string;
  category?: string;
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
};

type EventsAPIResponse = {
  city: string;
  display_city?: string;
  events: ExploreEvent[];
  trending?: ExploreEvent[];
  weekend?: ExploreEvent[];
  popular?: ExploreEvent[];
  national?: ExploreEvent[];
  total?: number;
};

const SIZES: ExploreSlot["size"][] = ["tall", "medium", "short", "medium", "tall", "short"];

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
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

function eventToSlot(event: ExploreEvent, index: number): ExploreSlot {
  const { score, reviews } = pseudoRating(event);
  const category = normalizeCategory(event.category, event.name);
  const price = formatPrice(event);
  const isFree = price === "Free";
  return {
    id: event.id,
    source: sourceLabel(event.source),
    meta: `${formatDateTime(event)} · ${event.venue || event.city} · ${category}`,
    title: event.name,
    summary: event.venue ? `${event.venue} · ${event.city}` : event.city,
    price: isFree ? "Free" : price.replace(/^From /, "").replace(/ – .*/, ""),
    note: isFree ? "no ticket" : "all-in",
    rating: `${score.toFixed(1)} ★`,
    reviews: String(reviews),
    size: SIZES[index % SIZES.length],
    badge: event.availability || undefined,
    venue: event.venue || event.city,
    city: event.city,
    dateLabel: formatDateTime(event),
    priceLabel: price,
    description: `${event.name} at ${event.venue || event.city}. ${category}.`,
    emoji: "",
    theme: themeForCategory(event.category, event.name),
    imageUrl: event.image_url,
    sourceUrl: event.ticket_url || null,
  };
}

function placeToSlot(place: ExplorePlaceRow, city: string, index: number): ExploreSlot {
  const category = place.category || "Place";
  const { score, reviews } = pseudoRating({
    id: place.id,
    name: place.name,
    category,
    date: "",
    time: "",
    venue: place.address || city,
    city,
    country: "",
    image_url: place.image_url || null,
    ticket_url: "",
    price_min: null,
    price_max: null,
    source: "rovvy_db",
  });
  return {
    id: place.id,
    source: "Rovvy DB",
    meta: `${category} · ${city}`,
    title: place.name,
    summary: place.address || `Open in ${city}`,
    price: "See listing",
    note: "venue",
    rating: `${score.toFixed(1)} ★`,
    reviews: String(reviews),
    size: SIZES[(index + 2) % SIZES.length],
    venue: place.address || city,
    city,
    dateLabel: "Open now",
    priceLabel: "See listing",
    description: `${place.name} — ${category} in ${city}.`,
    emoji: "",
    theme: themeForCategory(category, place.name),
    imageUrl: place.image_url,
  };
}

function buildStats(events: ExploreEvent[], places: ExplorePlaceRow[]): [string, string][] {
  const music = events.filter((e) => normalizeCategory(e.category, e.name).toLowerCase().includes("music")).length;
  const foodEvents = events.filter((e) => {
    const c = normalizeCategory(e.category, e.name).toLowerCase();
    return c.includes("food") || c.includes("restaurant");
  }).length;
  const outdoors = events.filter((e) => {
    const c = normalizeCategory(e.category, e.name).toLowerCase();
    return c.includes("sport") || c.includes("park") || c.includes("outdoor");
  }).length;
  const landmarks = places.filter((p) => {
    const c = (p.category || "").toLowerCase();
    return c.includes("museum") || c.includes("landmark") || c.includes("attraction");
  }).length;
  const freeTonight = events.filter((e) => formatPrice(e) === "Free").length;
  const restaurants = places.filter((p) => (p.category || "").toLowerCase().includes("restaurant")).length;

  return [
    [String(events.length), "Events"],
    [String(foodEvents + restaurants), "Food & drink"],
    [String(music), "Live music"],
    [String(outdoors), "Outdoors"],
    [String(landmarks || places.length), "Landmarks"],
    [String(freeTonight), "Free tonight"],
    [String(events.length + places.length), "In database"],
  ];
}

function buildRanked(slots: ExploreSlot[]): RankedRow[] {
  return [...slots]
    .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
    .slice(0, 6)
    .map((slot) => [
      slot.id,
      slot.title,
      `${slot.venue} · ${slot.meta.split("·").slice(-1)[0]?.trim() || slot.city}`,
      slot.rating,
      `${slot.reviews} reviews`,
      "—",
      slot.price,
      slot.badge || "Open",
    ]);
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function fetchExploreHub(city: string): Promise<ExploreHubPayload> {
  const cityLabel = city.split(",")[0].trim() || "Chicago";
  const coords = CITY_COORDS[cityLabel];
  const params = new URLSearchParams({ city: cityLabel, per_page: "100" });
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lon", String(coords.lng));
    params.set("radius", "200");
  }

  const [eventsRes, attractionsRes, restaurantsRes] = await Promise.all([
    apiFetch<EventsAPIResponse>(`/explore/events?${params.toString()}`, {}, EXPLORE_FETCH_TIMEOUT_MS).catch(
      (): EventsAPIResponse => ({ city: cityLabel, display_city: cityLabel, events: [] }),
    ),
    apiFetch<{ places: ExplorePlaceRow[] }>(
      `/explore/places?city=${encodeURIComponent(cityLabel)}&category=attractions`,
      {},
      EXPLORE_FETCH_TIMEOUT_MS,
    ).catch(() => ({ places: [] as ExplorePlaceRow[] })),
    apiFetch<{ places: ExplorePlaceRow[] }>(
      `/explore/places?city=${encodeURIComponent(cityLabel)}&category=restaurants`,
      {},
      EXPLORE_FETCH_TIMEOUT_MS,
    ).catch(() => ({ places: [] as ExplorePlaceRow[] })),
  ]);

  const hydrated = hydrateSectionsFromResponse(eventsRes);
  const eventPool = uniqueById([
    ...hydrated.sections.trending,
    ...hydrated.sections.weekend,
    ...hydrated.sections.popular,
    ...(eventsRes.events || []),
  ]);

  const places = uniqueById([...(attractionsRes.places || []), ...(restaurantsRes.places || [])]);

  const eventSlots = eventPool.slice(0, 12).map((ev, i) => eventToSlot(ev, i));
  const placeSlots = places.slice(0, Math.max(0, 12 - eventSlots.length)).map((p, i) => placeToSlot(p, cityLabel, i));
  const slots = [...eventSlots, ...placeSlots].slice(0, 12);

  const sources = new Set<string>();
  eventPool.forEach((e) => sources.add(sourceLabel(e.source)));
  if (places.length) sources.add("Rovvy DB");

  return {
    city: cityLabel,
    displayCity: eventsRes.display_city || cityLabel,
    slots,
    stats: buildStats(eventPool, places),
    ranked: buildRanked(slots),
    totalLive: eventPool.length + places.length,
    fetchedAt: new Date().toISOString(),
    sources: Array.from(sources),
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
