/**
 * Legacy flight place helpers — production autocomplete uses /flights/places API.
 * Do not use a hard-coded airport list for production search results.
 */

export type FlightPlaceSuggestion = {
  id: string;
  label: string;
  detail?: string;
  iata: string;
  country?: string;
};

/** Display fallback when only an IATA code is known (e.g. URL params). */
export function labelForFlightIata(iata: string): string {
  const code = iata.trim().toUpperCase();
  return code;
}

/**
 * Only accepts a confirmed three-letter code already stored on the field.
 * Arbitrary typed text must be validated via FlightPlaceInput / /flights/places.
 */
export function resolveFlightIataFromText(text: string): string | null {
  const trimmed = text.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(trimmed) && trimmed === text.trim().toUpperCase()) {
    return trimmed;
  }
  return null;
}

/** @deprecated Use fetchFlightPlaces from flight-places-api.ts */
export function filterFlightPlaceSuggestions(_query: string, _limit = 8): FlightPlaceSuggestion[] {
  return [];
}
