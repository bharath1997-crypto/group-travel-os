import type { LiveGeocodingSearchResult } from "@/app/(dashboard)/live/live-geocoding";
import {
  cityFromGeocodeAddress,
  formatGeocodeResultTitle,
  regionFromGeocodeAddress,
} from "./explore-hero-location";
import type { ExploreSlot } from "./explore-hub-data";
import { resolveScaperMetroCity } from "./explore-scaper-metro";

export type ExploreLocationScope = {
  /** Human-readable active filter line */
  label: string;
  /** Ticketmaster / places API anchor city (may differ from user-facing city filter) */
  fetchCity?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
};

export type ExploreHubFetchInput = {
  city: string;
  state?: string | null;
  country?: string | null;
  lat?: number;
  lon?: number;
  displayLabel?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function scopeFromGeocode(result: LiveGeocodingSearchResult): ExploreLocationScope {
  const city = cityFromGeocodeAddress(result.address);
  const state = regionFromGeocodeAddress(result.address);
  const country = result.address?.country?.trim();
  const title = formatGeocodeResultTitle(result);
  const lat = Number.parseFloat(result.lat);
  const lon = Number.parseFloat(result.lon);

  const labelParts = [city || title, state, country].filter(Boolean);
  const resolvedCity = city || title.split(",")[0]?.trim();
  const metro = resolveScaperMetroCity({
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    fallbackCity: resolvedCity,
  });
  return {
    label: labelParts.join(", "),
    fetchCity: metro,
    city: resolvedCity,
    state: state ?? undefined,
    country: country ?? undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
  };
}

export function fetchInputFromScope(scope: ExploreLocationScope): ExploreHubFetchInput {
  const city = (scope.fetchCity || scope.city || "Chicago").split(",")[0].trim();
  return {
    city,
    state: scope.state ?? null,
    country: scope.country ?? null,
    lat: scope.lat,
    lon: scope.lon,
    displayLabel: scope.label,
  };
}

function normalizeToken(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

function slotHaystack(slot: ExploreSlot): string {
  return `${slot.title} ${slot.summary} ${slot.meta} ${slot.city} ${slot.venue} ${slot.area}`.toLowerCase();
}

/** Client filter after API fetch — state-only keeps all listings tied to that state/region. */
export function filterSlotsByLocationScope(slots: ExploreSlot[], scope: ExploreLocationScope | null): ExploreSlot[] {
  if (!scope) return slots;

  const hasGeoAnchor =
    scope.lat != null && scope.lon != null && Number.isFinite(scope.lat) && Number.isFinite(scope.lon);

  // Events/places are already scoped by API (metro + radius from hero coords).
  if (hasGeoAnchor) return slots;

  let filtered = slots;

  const stateKey = normalizeToken(scope.state);
  if (stateKey) {
    filtered = filtered.filter((slot) => {
      const slotState = normalizeToken(slot.stateLabel);
      if (slotState && (slotState === stateKey || slotState.includes(stateKey) || stateKey.includes(slotState))) {
        return true;
      }
      const hay = slotHaystack(slot);
      const code = scope.state?.trim();
      if (code && code.length <= 3 && hay.includes(code.toLowerCase())) return true;
      return hay.includes(stateKey) || stateKey.split(/\s+/).every((part) => part.length > 2 && hay.includes(part));
    });
  }

  const countryKey = normalizeToken(scope.country);
  if (countryKey) {
    const byCountry = filtered.filter((slot) => {
      const slotCountry = normalizeToken(slot.countryLabel);
      if (slotCountry && (slotCountry.includes(countryKey) || countryKey.includes(slotCountry))) return true;
      const hay = slotHaystack(slot);
      return hay.includes(countryKey) || countryKey.split(/\s+/).every((part) => part.length > 2 && hay.includes(part));
    });
    if (byCountry.length) filtered = byCountry;
  }

  const cityKey = normalizeToken(scope.city);
  if (cityKey && !stateKey) {
    filtered = filtered.filter((slot) => {
      const hay = slotHaystack(slot);
      return hay.includes(cityKey) || normalizeToken(slot.city) === cityKey;
    });
  } else if (cityKey && stateKey) {
    filtered = filtered.filter((slot) => {
      const hay = slotHaystack(slot);
      return hay.includes(cityKey) || normalizeToken(slot.city) === cityKey;
    });
  }

  return filtered;
}

export function scopeFromCatalogSelection(input: {
  countryName: string;
  stateName?: string | null;
  cityName?: string | null;
  fetchCity?: string | null;
  lat: number;
  lon: number;
}): ExploreLocationScope {
  const parts = [input.cityName, input.stateName, input.countryName].filter(Boolean);
  const fetchCity = input.fetchCity ?? input.cityName ?? undefined;
  return {
    label: parts.length ? parts.join(", ") : input.countryName,
    fetchCity,
    city: input.cityName ?? undefined,
    state: input.stateName ?? undefined,
    country: input.countryName,
    lat: input.lat,
    lon: input.lon,
  };
}
