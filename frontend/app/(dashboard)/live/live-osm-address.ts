/** Format travel addresses from OSM addr:* tags on map features / POIs. */

export function formatOsmAddressFromTags(
  props: Record<string, unknown> | null | undefined,
): string {
  if (!props) return "";

  const streetNumber =
    props["addr:housenumber"] ?? props.housenumber ?? props.house_number;
  const streetName = props["addr:street"] ?? props.street;
  const line1 = [streetNumber, streetName]
    .filter((part) => part != null && String(part).trim())
    .map(String)
    .join(" ")
    .trim();

  const city =
    props["addr:city"] ?? props.city ?? props.town ?? props.village ?? props.municipality;
  const state = props["addr:state"] ?? props.state;
  const postcode = props["addr:postcode"] ?? props.postcode;
  const line2 = [city, state, postcode]
    .filter((part) => part != null && String(part).trim())
    .map(String)
    .join(", ")
    .trim();

  return [line1, line2].filter(Boolean).join(", ");
}

const CATEGORY_ONLY_ADDRESSES = new Set([
  "gas station",
  "restaurant",
  "fast food",
  "liquor store",
  "beverage store",
  "convenience store",
  "cafe",
  "bar",
  "pub",
  "place",
  "address",
  "shop",
  "food",
  "church",
  "mosque",
  "synagogue",
  "temple",
  "place of worship",
  "library",
  "school",
  "college",
  "university",
  "park",
  "playground",
  "museum",
  "gallery",
  "attraction",
  "monument",
  "memorial",
  "viewpoint",
  "landmark",
]);

export function isCategoryOnlyAddress(address?: string | null): boolean {
  const addr = (address || "").trim();
  if (!addr) return true;
  return CATEGORY_ONLY_ADDRESSES.has(addr.toLowerCase());
}

export function needsOsmAddressEnrichment(address?: string | null): boolean {
  const addr = (address || "").trim();
  if (!addr) return true;
  if (/^coordinates:\s*-?\d/i.test(addr)) return true;
  if (isCategoryOnlyAddress(addr)) return true;
  if (!addr.includes(",") && addr.length < 14) return true;
  return false;
}
