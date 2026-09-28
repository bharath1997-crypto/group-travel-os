import type { LiveGeocodingSearchResult } from "@/app/(dashboard)/live/live-geocoding";
import { formatSearchLocationContext } from "@/app/(dashboard)/live/live-geocoding";

const CITY_ADDRESS_KEYS = [
  "city",
  "town",
  "village",
  "hamlet",
  "municipality",
  "locality",
  "borough",
  "suburb",
  "neighbourhood",
  "district",
  "county",
] as const;

const REGION_ADDRESS_KEYS = [
  "state",
  "region",
  "province",
  "state_district",
  "ISO3166-2-lvl4",
  "ISO3166-2-lvl3",
  "county",
] as const;

export function cityFromGeocodeAddress(address?: Record<string, string>): string | null {
  if (!address) return null;
  for (const key of CITY_ADDRESS_KEYS) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function regionFromGeocodeAddress(address?: Record<string, string>): string | null {
  if (!address) return null;
  for (const key of REGION_ADDRESS_KEYS) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return address.country?.trim() || null;
}

export function formatGeocodeResultTitle(result: LiveGeocodingSearchResult): string {
  const address = result.address;
  const city = cityFromGeocodeAddress(address);
  if (city) {
    const region = regionFromGeocodeAddress(address);
    if (region && region !== city) return `${city}, ${region}`;
    return city;
  }

  const postcode = address?.postcode?.trim();
  if (postcode) {
    const region = regionFromGeocodeAddress(address);
    return region ? `${postcode}, ${region}` : postcode;
  }

  const name = result.name?.trim() || result.display_name.split(",")[0]?.trim();
  return name || result.display_name;
}

export function formatGeocodeResultSubtitle(result: LiveGeocodingSearchResult): string {
  const context = formatSearchLocationContext(result);
  if (context) return context;
  const parts = result.display_name.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return result.type ?? "Place";
  return parts.slice(1, 3).join(", ");
}

export type GeolocationAttempt = {
  lat: number;
  lon: number;
};

export function readBrowserGeolocation(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 8000, maximumAge: 5 * 60 * 1000 },
): Promise<GeolocationAttempt | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
      () => resolve(null),
      options,
    );
  });
}
