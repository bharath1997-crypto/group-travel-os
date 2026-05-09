/**
 * Intent chips for Destination-Aware Explorer — filters TrendItem lists (client-side).
 * OR semantics: item matches if it satisfies any active intent (when intents non-empty).
 */

export type TrendForIntent = {
  title: string;
  description: string;
  venue: string;
  meta: string;
  priceLabel: string;
  sourceType: string;
};

export const EXPLORER_INTENTS = [
  { id: "tonight", label: "Tonight", hint: "Next few hours" },
  { id: "weekend", label: "This weekend", hint: "Fri–Sun vibes" },
  { id: "free", label: "Free", hint: "$0 entry" },
  { id: "cheap", label: "Cheap", hint: "Easy on the wallet" },
  { id: "groups", label: "Good for groups", hint: "Crew-friendly" },
  { id: "nightlife", label: "Nightlife", hint: "Late & lively" },
  { id: "indoor", label: "Indoor", hint: "Weather-proof" },
  { id: "outdoor", label: "Outdoor", hint: "Outside" },
  { id: "live_music", label: "Live music", hint: "Bands & DJs" },
  { id: "sports", label: "Sports", hint: "Games & bars" },
] as const;

export type ExplorerIntentId = (typeof EXPLORER_INTENTS)[number]["id"];

function textBlob(t: TrendForIntent): string {
  return `${t.title} ${t.description} ${t.venue} ${t.meta} ${t.priceLabel}`.toLowerCase();
}

function matchesIntent(id: ExplorerIntentId, t: TrendForIntent): boolean {
  const blob = textBlob(t);
  switch (id) {
    case "tonight":
      return /\btonight\b|\btoday\b|\bthis evening\b|\bpm\b/i.test(t.meta) || /\btonight\b/i.test(t.title);
    case "weekend":
      return /\bweekend\b|\bsaturday\b|\bsunday\b|\bfri\b|\bsat\b|\bsun\b/i.test(blob);
    case "free":
      return /\bfree\b|^free$/i.test(t.priceLabel) || /\bfree\b/i.test(blob);
    case "cheap":
      return /\$\s*[1-9]\d?|\bfrom\s*\$[1-4]\d\b|\bunder\s*\$?\s*30\b/i.test(blob) || /\bcheap\b|\blow\b/i.test(blob);
    case "groups":
      return (
        /\bgroup\b|\bcrew\b|\bteam\b|\bgang\b|\bsquad\b/i.test(blob) ||
        /\bbar\b|\broom\b|\bkaraoke\b|\bbowling\b|\bescape\b/i.test(blob)
      );
    case "nightlife":
      return /\bnight\b|\brooftop\b|\bbar\b|\bclub\b|\bjazz\b|\blate\b|\bdrink\b/i.test(blob);
    case "indoor":
      return /\bindoor\b|\bmuseum\b|\bgallery\b|\broom\b|\barena\b|\btheater\b|\btheatre\b/i.test(blob);
    case "outdoor":
      return /\boutdoor\b|\bpark\b|\bwalk\b|\briver\b|\blakefront\b|\bterrace\b/i.test(blob);
    case "live_music":
      return /\bmusic\b|\bjazz\b|\bconcert\b|\bdj\b|\bband\b|\blive\b/i.test(blob);
    case "sports":
      return /\bsport\b|\bwatch\b|\bcubs\b|\bsox\b|\bwrigley\b|\bgame\b|\bstadium\b/i.test(blob);
    default:
      return true;
  }
}

/** If active is empty, returns list unchanged. Otherwise items matching ANY active intent. */
export function filterByIntents<T extends TrendForIntent>(
  list: T[],
  active: ExplorerIntentId[],
): T[] {
  if (!active.length) return list;
  return list.filter((item) => active.some((id) => matchesIntent(id, item)));
}

export function filterPerfectForGroups<T extends TrendForIntent>(list: T[]): T[] {
  const re =
    /rooftop|escape\s*room|karaoke|bowling|arcade|vr\b|sports\s*bar|comedy|boat\s*tour|brewery\s*tour|axe\s*throw|topgolf|billiard|pool\s*hall|laser\s*tag|tram|group\s*dinner/i;
  const hit = list.filter((t) => re.test(`${t.title} ${t.venue} ${t.description}`));
  return hit.length >= 3 ? hit : list.slice(0, Math.min(8, list.length));
}

export function filterFoodNightlife<T extends TrendForIntent>(list: T[]): T[] {
  const re =
    /\bfood\b|\brestaurant\b|\bdinner\b|\bbrunch\b|\bbrewery\b|\bbar\b|\btaproom\b|\bwine\b|\brooftop\b|\bnight\b|\bjazz\b|\bclub\b/i;
  return list.filter((t) => re.test(`${t.title} ${t.venue} ${t.description}`));
}

export function cityFlavorTags(city: string): { label: string }[] {
  const c = city.toLowerCase();
  if (c.includes("chicago"))
    return [{ label: "Architecture" }, { label: "Nightlife" }, { label: "Sports & lakefront" }];
  if (c.includes("london"))
    return [{ label: "Pubs & history" }, { label: "Theatre" }, { label: "Parks" }];
  if (c.includes("mumbai") || c.includes("delhi") || c.includes("bangalore"))
    return [{ label: "Food trails" }, { label: "Social hotspots" }, { label: "Weekend getaways" }];
  return [{ label: "Local flavor" }, { label: "Food & drink" }, { label: "Groups" }];
}
