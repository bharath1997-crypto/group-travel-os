export type ExploreEvent = {
  id: string;
  name: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  country: string;
  image_url: string | null;
  ticket_url: string;
  price_min: number | null;
  price_max: number | null;
  status?: string | null;
  availability?: string | null;
  source: string;
  distance_miles?: number | null;
  venue_lat?: number | null;
  venue_lon?: number | null;
};

export const SECTION_CARD_LIMIT = 8;
export const LS_EVENT_PREFIX = "rovvy_event_";

const WEAK_CATEGORIES = new Set([
  "",
  "undefined",
  "miscellaneous",
  "misc",
  "all",
  "other",
  "general",
]);

export function cityLabel(value: string): string {
  return value.split(",")[0]?.trim() || value;
}

function isSoldOut(event: Pick<ExploreEvent, "status" | "availability">): boolean {
  const status = (event.status || "").trim().toLowerCase();
  const availability = (event.availability || "").trim().toLowerCase();
  return status === "sold_out" || availability === "sold_out";
}

export function normalizeCategory(category: string, name: string): string {
  const nameL = (name || "").toLowerCase();
  if (/\btour\b/.test(nameL) && /\b(stadium|arena)\b/.test(nameL)) return "Experience";
  if (/\bvs\.?\b/.test(nameL)) return "Sports";
  if (/\bcomedy\b/.test(nameL)) return "Comedy";
  if (/\b(ballet|orchestra|symphony|theatre|theater)\b/.test(nameL)) return "Arts";

  const key = (category || "").trim().toLowerCase();
  if (!WEAK_CATEGORIES.has(key)) {
    return category.trim();
  }
  if (/\b(vs\.?|sox|cubs|bulls|bears|twins|mlb|nba|nfl)\b/.test(nameL)) return "Sports";
  if (/\b(concert| tour|live |dj |festival)\b/.test(nameL)) return "Music";
  if (/\b(theatre|theater|broadway|play)\b/.test(nameL)) return "Arts";
  if (/\b(food|wine|dinner|brunch|tasting)\b/.test(nameL)) return "Food";
  if (/\b(cruise|museum|architecture|walking tour)\b/.test(nameL)) return "Experience";
  if (/\b(club|night|18\+|21\+)\b/.test(nameL)) return "Nightlife";
  return "Experience";
}

function seriesKey(name: string, venue: string): string {
  let n = (name || "").trim().toLowerCase();
  n = n.replace(/\s*\([^)]*\)\s*/g, " ");
  n = n.replace(/\s*[-–—]\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday).*$/i, "");
  n = n.replace(/\s*[-–—]\s*\d{1,2}\/\d{1,2}.*$/, "");
  n = n.replace(/\s+/g, " ").trim();
  return `${n}|${(venue || "").trim().toLowerCase()}`;
}

export function dedupeExploreEvents(events: ExploreEvent[]): ExploreEvent[] {
  const seenIds = new Set<string>();
  const seenSeries = new Set<string>();
  const result: ExploreEvent[] = [];

  for (const ev of events) {
    const id = (ev.id || "").trim();
    if (id && seenIds.has(id)) continue;
    const sk = seriesKey(ev.name, ev.venue);
    if (sk && seenSeries.has(sk)) continue;
    if (id) seenIds.add(id);
    if (sk) seenSeries.add(sk);
    result.push({
      ...ev,
      category: normalizeCategory(ev.category, ev.name),
    });
  }
  return result;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "Date TBA";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
      );
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${period}`;
}

export function formatDateTime(event: ExploreEvent): string {
  const datePart = formatDate(event.date);
  const timePart = formatTime(event.time);
  if (datePart === "Date TBA") return datePart;
  return timePart ? `${datePart} · ${timePart}` : datePart;
}

export function formatPrice(event: ExploreEvent): string {
  if (isSoldOut(event)) return "Sold Out";
  if (event.price_min === 0 && event.price_max === 0) return "Free";
  if (event.price_min != null && event.price_max != null && event.price_max > event.price_min) {
    return `$${Math.round(event.price_min)} – $${Math.round(event.price_max)}`;
  }
  if (event.price_min != null) return `From $${Math.round(event.price_min)}`;
  return "See pricing";
}

export function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pseudoRating(event: ExploreEvent): { score: number; reviews: number } {
  const seed = hashSeed(event.id || event.name);
  const score = 3.5 + (seed % 15) / 10;
  const reviews = 40 + (seed % 480);
  return { score: Math.round(score * 10) / 10, reviews };
}

export function formatLocation(
  event: ExploreEvent,
  userCity: string,
): { primary: string; secondary: string } {
  const userKey = cityLabel(userCity).toLowerCase();
  const eventCity = cityLabel(event.city);
  const eventKey = eventCity.toLowerCase();
  const venue = event.venue || eventCity;

  if (event.distance_miles != null) {
    const dist = Math.round(event.distance_miles);
    if (eventKey === userKey) {
      return { primary: venue, secondary: `${dist} mi away · ${eventCity}` };
    }
    return { primary: venue, secondary: `${dist} mi · ${eventCity}` };
  }

  if (eventKey === userKey) {
    const seed = hashSeed(event.id || event.name);
    const pseudoMi = (seed % 18) + 2;
    return { primary: venue, secondary: `${pseudoMi} mi away · ${eventCity}` };
  }

  return { primary: venue, secondary: eventCity };
}

export function sourceLabel(source: string): string {
  const s = (source || "").toLowerCase();
  if (s.includes("ticketmaster")) return "Ticketmaster";
  if (s.includes("eventbrite")) return "Eventbrite";
  if (s.includes("instagram")) return "Instagram";
  if (s.includes("ai")) return "Rovvy Pick";
  return "Official listing";
}

export function saveEventSnapshot(event: ExploreEvent): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${LS_EVENT_PREFIX}${event.id}`, JSON.stringify(event));
  } catch {
    /* ignore */
  }
}

export function loadEventSnapshot(id: string): ExploreEvent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${LS_EVENT_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as ExploreEvent;
  } catch {
    return null;
  }
}

export function mapsUrl(event: ExploreEvent): string {
  if (event.venue_lat != null && event.venue_lon != null) {
    return `https://www.google.com/maps/search/?api=1&query=${event.venue_lat},${event.venue_lon}`;
  }
  const q = encodeURIComponent(`${event.venue}, ${event.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export type ExploreSections = {
  trending: ExploreEvent[];
  weekend: ExploreEvent[];
  popular: ExploreEvent[];
  national: ExploreEvent[];
};

export type ExploreFeedDebug = {
  rawTotal: number;
  poolSize: number;
  trendingRaw: number;
  weekendRaw: number;
  popularRaw: number;
  nationalRaw: number;
  dedupedTrending: number;
  dedupedWeekend: number;
  dedupedPopular: number;
  dedupedNational: number;
  source: "live" | "cache" | "fallback";
  fetchedAt: string;
};

const LS_EXPLORE_FEED_CACHE = "rovvy_explore_feed_cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CachedExploreFeed = {
  cityKey: string;
  sections: ExploreSections;
  debug: ExploreFeedDebug;
  savedAt: number;
};

function asEventArray(value: unknown): ExploreEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ExploreEvent =>
      typeof item === "object" && item !== null && "name" in item,
  );
}

export function hydrateSectionsFromResponse(data: {
  events?: ExploreEvent[];
  trending?: ExploreEvent[];
  weekend?: ExploreEvent[];
  popular?: ExploreEvent[];
  national?: ExploreEvent[];
  total?: number;
}): { sections: ExploreSections; debug: Omit<ExploreFeedDebug, "source" | "fetchedAt"> } {
  const pool = dedupeExploreEvents(asEventArray(data.events));
  const trendingRaw = asEventArray(data.trending);
  const weekendRaw = asEventArray(data.weekend);
  const popularRaw = asEventArray(data.popular);
  const nationalRaw = asEventArray(data.national);

  let trending = dedupeExploreEvents(trendingRaw);
  let weekend = dedupeExploreEvents(weekendRaw);
  let popular = dedupeExploreEvents(popularRaw);
  let national = dedupeExploreEvents(nationalRaw);

  const sectionCount =
    trending.length + weekend.length + popular.length + national.length;

  if (sectionCount === 0 && pool.length > 0) {
    trending = pool.slice(0, 40);
    weekend = pool.slice(40, 60);
    popular = pool.slice(60, 80);
    national = pool.slice(80, 100);
  }

  return {
    sections: { trending, weekend, popular, national },
    debug: {
      rawTotal: data.total ?? pool.length,
      poolSize: pool.length,
      trendingRaw: trendingRaw.length,
      weekendRaw: weekendRaw.length,
      popularRaw: popularRaw.length,
      nationalRaw: nationalRaw.length,
      dedupedTrending: trending.length,
      dedupedWeekend: weekend.length,
      dedupedPopular: popular.length,
      dedupedNational: national.length,
    },
  };
}

export function saveExploreFeedCache(
  cityKey: string,
  sections: ExploreSections,
  debug: ExploreFeedDebug,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedExploreFeed = {
      cityKey,
      sections,
      debug,
      savedAt: Date.now(),
    };
    localStorage.setItem(LS_EXPLORE_FEED_CACHE, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function loadExploreFeedCache(cityKey: string): CachedExploreFeed | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_EXPLORE_FEED_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedExploreFeed;
    if (parsed.cityKey !== cityKey) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    if (!parsed.sections?.trending?.length && !parsed.sections?.weekend?.length) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
