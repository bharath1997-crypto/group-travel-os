/** G17/F6 — cache write age labels (not provider publication or live inventory). */

export type ExploreCacheStatus =
  | "fresh_cache"
  | "provider_refresh"
  | "stale_fallback"
  | "empty"
  | "unavailable";

export type ExploreFreshnessMeta = {
  refreshed_at?: string | null;
  cache_status?: ExploreCacheStatus | string | null;
};

export type ExploreSourceFreshness = {
  events?: ExploreFreshnessMeta | null;
  attractions?: ExploreFreshnessMeta | null;
  restaurants?: ExploreFreshnessMeta | null;
};

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;

/** Relative age from ISO cache timestamp; fixed `now` for tests. */
export function formatCacheAgeShort(iso: string | null | undefined, nowMs: number = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.max(0, Math.round((nowMs - then) / MS_MIN));
  if (mins < 60) {
    if (mins < 1) return "<1 min";
    if (mins === 1) return "1 min";
    return `${mins} min`;
  }
  const hours = Math.round((nowMs - then) / MS_HOUR);
  if (hours === 1) return "1 hr";
  return `${hours} hr`;
}

function isKnownAge(meta: ExploreFreshnessMeta | null | undefined): meta is ExploreFreshnessMeta {
  if (!meta?.cache_status) return false;
  const status = meta.cache_status;
  if (status === "unavailable" || status === "empty") return false;
  return Boolean(meta.refreshed_at?.trim());
}

function sourceHasStaleFallback(meta: ExploreFreshnessMeta | null | undefined): boolean {
  return meta?.cache_status === "stale_fallback" && Boolean(meta.refreshed_at?.trim());
}

export function formatExploreHubFreshnessLine(
  sources: ExploreSourceFreshness,
  nowMs: number = Date.now(),
): string {
  const staleParts: string[] = [];
  if (sourceHasStaleFallback(sources.events)) {
    const age = formatCacheAgeShort(sources.events!.refreshed_at!, nowMs);
    if (age) staleParts.push(`events ${age}`);
  }
  if (sourceHasStaleFallback(sources.attractions)) {
    const age = formatCacheAgeShort(sources.attractions!.refreshed_at!, nowMs);
    if (age) staleParts.push(`attractions ${age}`);
  }
  if (sourceHasStaleFallback(sources.restaurants)) {
    const age = formatCacheAgeShort(sources.restaurants!.refreshed_at!, nowMs);
    if (age) staleParts.push(`restaurants ${age}`);
  }
  if (staleParts.length > 0) {
    return `Older cached data · ${staleParts.join(" · ")}`;
  }

  const known: { key: string; meta: ExploreFreshnessMeta }[] = [];
  if (isKnownAge(sources.events)) known.push({ key: "events", meta: sources.events! });
  if (isKnownAge(sources.attractions)) known.push({ key: "attractions", meta: sources.attractions! });
  if (isKnownAge(sources.restaurants)) known.push({ key: "restaurants", meta: sources.restaurants! });

  if (known.length === 0) {
    const anyEmpty =
      sources.events?.cache_status === "empty" ||
      sources.attractions?.cache_status === "empty" ||
      sources.restaurants?.cache_status === "empty";
    if (anyEmpty) return "";
    return "Freshness unavailable";
  }

  if (known.length === 1) {
    const age = formatCacheAgeShort(known[0].meta.refreshed_at!, nowMs);
    if (!age) return "Freshness unavailable";
    return `Cache refreshed ${age} ago`;
  }

  const placeAges: string[] = [];
  if (isKnownAge(sources.attractions)) {
    const a = formatCacheAgeShort(sources.attractions!.refreshed_at!, nowMs);
    if (a) placeAges.push(a);
  }
  if (isKnownAge(sources.restaurants)) {
    const r = formatCacheAgeShort(sources.restaurants!.refreshed_at!, nowMs);
    if (r) placeAges.push(r);
  }

  const parts: string[] = [];
  const evAge = isKnownAge(sources.events)
    ? formatCacheAgeShort(sources.events!.refreshed_at!, nowMs)
    : null;
  if (evAge) parts.push(`events ${evAge}`);

  if (placeAges.length === 1) {
    parts.push(`places ${placeAges[0]}`);
  } else if (placeAges.length === 2 && placeAges[0] !== placeAges[1]) {
    parts.push(`attractions ${placeAges[0]}`, `restaurants ${placeAges[1]}`);
  } else if (placeAges.length === 2) {
    parts.push(`places ${placeAges[0]}`);
  }

  if (parts.length === 0) return "Freshness unavailable";
  return `Data age · ${parts.join(" · ")}`;
}

/** Hub pulse bar — no invented provider names when the feed returned none. */
export function formatExploreListingSources(sources: string[] | undefined | null): string {
  const list = (sources ?? []).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return "Sources unavailable";
  return `Listing sources: ${list.join(" · ")}`;
}
