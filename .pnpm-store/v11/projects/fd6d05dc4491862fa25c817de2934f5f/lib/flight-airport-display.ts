type AirportLike = {
  iata_code?: unknown;
  iata_city_code?: unknown;
  city_name?: unknown;
  name?: unknown;
  id?: unknown;
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Safely converts provider airport payloads into renderable text. */
export function airportDisplayCode(value: unknown, fallback = "—"): string {
  const direct = nonEmptyString(value);
  if (direct) return direct.toUpperCase();

  if (value && typeof value === "object") {
    const airport = value as AirportLike;
    return (
      nonEmptyString(airport.iata_code)?.toUpperCase() ||
      nonEmptyString(airport.iata_city_code)?.toUpperCase() ||
      nonEmptyString(airport.city_name) ||
      nonEmptyString(airport.name) ||
      nonEmptyString(airport.id) ||
      fallback
    );
  }

  return fallback;
}
