/**
 * Enrich OSM nearby POIs with reverse-geocoded travel addresses.
 * Keeps the original POI lat/lng — only the address text is updated.
 */
import { liveGeocodingReverse } from "./live-geocoding";
import { extractCityCountry } from "./live-place-key";
import type { PlacePreviewData } from "./PlacePreviewCard";

const COORD_ADDRESS_RE = /^coordinates:\s*-?\d/i;

function formatStreetAddress(
  address?: Record<string, string>,
  fallback?: string,
): string {
  if (!address) return fallback || "";
  const line1 = [address.house_number, address.road].filter(Boolean).join(" ");
  const line2 = [
    address.city || address.town || address.village || address.municipality,
    address.state,
    address.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const formatted = [line1, line2].filter(Boolean).join(", ");
  return formatted || fallback || "";
}

export function needsTravelAddressEnrichment(place: { address?: string }): boolean {
  const addr = (place.address || "").trim();
  if (!addr) return true;
  if (COORD_ADDRESS_RE.test(addr)) return true;
  if (!addr.includes(",") && addr.length < 12) return true;
  return false;
}

export async function enrichPlaceForTravel(place: PlacePreviewData): Promise<PlacePreviewData> {
  const lat = place.lat;
  const lng = place.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return place;
  if (!needsTravelAddressEnrichment(place)) return place;

  const details = await liveGeocodingReverse(lat, lng);
  if (!details) return place;

  const reverseGeo = extractCityCountry(details.address);
  const travelAddress =
    formatStreetAddress(details.address, details.display_name) ||
    details.display_name ||
    place.address;

  return {
    ...place,
    address: travelAddress,
    city: reverseGeo.city ?? place.city,
    country: reverseGeo.country ?? place.country,
  };
}

/** Reverse-geocode coordinate-only nearby results (Nominatim ~1 req/s). */
export async function enrichNearbyResultsForTravel(
  places: PlacePreviewData[],
  options?: { max?: number; delayMs?: number },
): Promise<PlacePreviewData[]> {
  const max = options?.max ?? 20;
  const delayMs = options?.delayMs ?? 350;
  const slice = places.slice(0, max);
  const out: PlacePreviewData[] = [];

  for (const place of slice) {
    if (needsTravelAddressEnrichment(place)) {
      out.push(await enrichPlaceForTravel(place));
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } else {
      out.push(place);
    }
  }

  return [...out, ...places.slice(max)];
}
