/** ISO 4217 codes supported for SeatShare display. */
export type SeatShareCurrency = "USD" | "INR" | "CAD" | "GBP" | "EUR";

export type CurrencyLocationInput = {
  lat: number;
  lng: number;
  address: string;
  countryCode?: string | null;
};

const CURRENCY_BY_COUNTRY: Record<string, SeatShareCurrency> = {
  US: "USD",
  IN: "INR",
  CA: "CAD",
  GB: "GBP",
  IE: "EUR",
  FR: "EUR",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  AU: "USD", // display fallback; expand when AU marketplace ships
};

export function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  return code.trim().toUpperCase();
}

export function readCountryCodeFromAddress(
  address?: Record<string, string> | null,
): string | null {
  if (!address) return null;
  return (
    normalizeCountryCode(address.country_code) ??
    normalizeCountryCode(address.country_code_iso3166_1_alpha_2)
  );
}

/** Rough bbox when OSM omits country_code (map pin / stale autocomplete). */
export function inferCountryCodeFromCoords(lat: number, lng: number): string | null {
  if (lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) return "IN";
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) return "US";
  if (lat >= 49 && lat <= 62 && lng >= -141 && lng <= -52) return "CA";
  if (lat >= 49 && lat <= 61 && lng >= -8 && lng <= 2) return "GB";
  return null;
}

export function inferCountryCodeFromAddressText(address: string): string | null {
  const lower = address.toLowerCase();
  if (/\b(united states|u\.s\.a\.|usa)\b/.test(lower)) return "US";
  if (/\b(india)\b/.test(lower)) return "IN";
  if (/\b(canada)\b/.test(lower)) return "CA";
  if (/\b(united kingdom|uk)\b/.test(lower)) return "GB";
  return null;
}

export function countryCodeToCurrency(countryCode: string): SeatShareCurrency {
  return CURRENCY_BY_COUNTRY[normalizeCountryCode(countryCode) ?? ""] ?? "USD";
}

/** Market currency for pricing UI — prefers confirmed origin, then destination. */
export function resolveSeatShareCurrency(
  from: CurrencyLocationInput,
  to?: CurrencyLocationInput | null,
): SeatShareCurrency {
  const fromCode =
    normalizeCountryCode(from.countryCode) ??
    inferCountryCodeFromAddressText(from.address) ??
    inferCountryCodeFromCoords(from.lat, from.lng);

  const toCode =
    to &&
    (normalizeCountryCode(to.countryCode) ??
      inferCountryCodeFromAddressText(to.address) ??
      inferCountryCodeFromCoords(to.lat, to.lng));

  const country = fromCode ?? toCode ?? "IN";
  return countryCodeToCurrency(country);
}

export function resolveCountryCodeForPoint(point: CurrencyLocationInput): string | null {
  return (
    normalizeCountryCode(point.countryCode) ??
    inferCountryCodeFromAddressText(point.address) ??
    inferCountryCodeFromCoords(point.lat, point.lng)
  );
}
