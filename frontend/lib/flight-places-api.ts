import { apiFetch } from "@/lib/api";

export type FlightPlaceSuggestion = {
  id: string;
  label: string;
  detail?: string;
  iata: string;
  place_type?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  distance_km?: number | null;
  group?: string;
  metro_iata?: string;
};

export type FlightCountryItem = {
  code: string;
  name: string;
  airport_count: number;
};

export type FlightRegionItem = {
  code: string;
  name: string;
  country_code: string;
  airport_count: number;
  region_code?: string;
  sample_cities?: string;
  subtitle?: string;
};

export type FlightCityItem = {
  name: string;
  country_code: string;
  region_code?: string;
  region_name?: string;
  airport_count: number;
};

export async function fetchFlightPlaces(query: string, limit = 12): Promise<FlightPlaceSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await apiFetch<FlightPlaceSuggestion[]>(
    `/flights/places?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function validateFlightIata(code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== 3) return false;
  const result = await apiFetch<{ valid: boolean }>(
    `/flights/places/validate?iata=${encodeURIComponent(normalized)}`,
  );
  return Boolean(result.valid);
}

export async function fetchNearbyAirports(
  lat: number,
  lng: number,
  limit = 12,
): Promise<FlightPlaceSuggestion[]> {
  const result = await apiFetch<{ airports: FlightPlaceSuggestion[] }>(
    `/flights/airports/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&limit=${limit}`,
  );
  return Array.isArray(result.airports) ? result.airports : [];
}

export async function fetchAirportCountries(): Promise<FlightCountryItem[]> {
  const rows = await apiFetch<FlightCountryItem[]>("/flights/airports/countries");
  return Array.isArray(rows) ? rows : [];
}

export async function fetchAirportRegions(country: string): Promise<FlightRegionItem[]> {
  const rows = await apiFetch<FlightRegionItem[]>(
    `/flights/airports/regions?country=${encodeURIComponent(country)}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function fetchAirportCities(
  country: string,
  region?: string,
): Promise<FlightCityItem[]> {
  const params = new URLSearchParams({ country });
  if (region) params.set("region", region);
  const rows = await apiFetch<FlightCityItem[]>(`/flights/airports/cities?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

export async function fetchAirportsForCity(
  country: string,
  city: string,
  region?: string,
  limit = 50,
  coords?: { lat: number; lng: number },
): Promise<FlightPlaceSuggestion[]> {
  const params = new URLSearchParams({ country, city, limit: String(limit) });
  if (region) params.set("region", region);
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lng", String(coords.lng));
  }
  const rows = await apiFetch<FlightPlaceSuggestion[]>(`/flights/airports?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

export function formatExploreLocationLine(item: {
  city?: string;
  region?: string;
  country?: string;
}): string {
  return [item.city, item.region, item.country].filter(Boolean).join(" · ");
}

export function placeTypeLabel(placeType?: string): string {
  if (placeType === "city" || placeType === "metro") return "All airports";
  if (placeType === "country") return "Country";
  return "Airport";
}

export function formatPlaceDetail(item: FlightPlaceSuggestion): string {
  const parts: string[] = [];
  if (item.iata) parts.push(item.iata);
  if (item.city) parts.push(item.city);
  if (item.region) parts.push(item.region);
  if (item.country) parts.push(item.country);
  if (item.distance_km != null) parts.unshift(`${Math.round(item.distance_km)} km`);
  return parts.join(" · ") || item.detail || item.iata;
}
