/**
 * Live map → Travel tab handoff (parse URL params, IATA resolve, provider links).
 * No Skyscanner API required — uses public search URLs or optional Impact affiliate base.
 */

export type TravelHandoffKind = "plan" | "flights" | "routes" | "buses";

export type TravelHandoffPlace = {
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type TravelHandoffContext = {
  origin: TravelHandoffPlace;
  destination: TravelHandoffPlace;
  originIata: string | null;
  destinationIata: string | null;
  fromLive: boolean;
};

const TRAVELPAYOUTS_MARKER =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER) || "727732";

const TRAVELPAYOUTS_TRS = "528092";

/** Optional Impact affiliate URL prefix from Skyscanner partner dashboard. */
export const SKYSCANNER_AFFILIATE_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SKYSCANNER_AFFILIATE_URL?.trim()) || "";

const CITY_IATA: Record<string, string> = {
  chicago: "CHI",
  hyderabad: "HYD",
  guntur: "VGA",
  vijayawada: "VGA",
  rajupala: "VGA",
  pennandipadu: "VGA",
  amaravati: "VGA",
  delhi: "DEL",
  newdelhi: "DEL",
  mumbai: "BOM",
  bengaluru: "BLR",
  bangalore: "BLR",
  chennai: "MAA",
  kolkata: "CCU",
  london: "LON",
  paris: "PAR",
  newyork: "NYC",
  losangeles: "LAX",
  sanfrancisco: "SFO",
  miami: "MIA",
  boston: "BOS",
  toronto: "YTO",
  dubai: "DXB",
  singapore: "SIN",
  sydney: "SYD",
};

function normalizeCityKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstCityToken(label: string): string {
  const part = label.split(",")[0]?.trim() ?? label.trim();
  return part;
}

/** Map a city / place label to a metro IATA code when possible. */
export function resolveTravelIata(label: string | null | undefined): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (/^[a-zA-Z]{3}$/.test(trimmed)) return trimmed.toUpperCase();

  const candidates = [
    normalizeCityKey(trimmed),
    normalizeCityKey(firstCityToken(trimmed)),
  ];

  for (const key of candidates) {
    if (key && CITY_IATA[key]) return CITY_IATA[key];
  }
  return null;
}

/** Human-readable label for routes / buses search boxes. */
export function travelHandoffSearchLabel(place: TravelHandoffPlace): string {
  if (place.city && place.state) return `${place.city}, ${place.state}`;
  if (place.city && place.country) return `${place.city}, ${place.country}`;
  if (place.city) return place.city;
  return place.name;
}

export function parseTravelHandoff(params: URLSearchParams): TravelHandoffContext | null {
  const destName = params.get("dest")?.trim();
  if (!destName) return null;

  const originName = params.get("origin")?.trim() || "Your location";
  const dest: TravelHandoffPlace = {
    name: destName,
    city: params.get("destCity"),
    state: params.get("destState"),
    country: params.get("destCountry"),
    lat: parseCoord(params.get("destLat")),
    lng: parseCoord(params.get("destLng")),
  };
  const origin: TravelHandoffPlace = {
    name: originName,
    country: params.get("originCountry"),
    lat: parseCoord(params.get("originLat")),
    lng: parseCoord(params.get("originLng")),
  };

  const originIata =
    resolveTravelIata(origin.name) ||
    resolveTravelIata(origin.city ?? null) ||
    resolveTravelIata(firstCityToken(origin.name));
  const destinationIata =
    resolveTravelIata(dest.name) ||
    resolveTravelIata(dest.city ?? null) ||
    resolveTravelIata(firstCityToken(dest.name));

  return {
    origin,
    destination: dest,
    originIata,
    destinationIata,
    fromLive: true,
  };
}

export function buildTravelHandoffQuery(
  destination: {
    name: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    lat: number;
    lng: number;
  },
  origin: { name?: string | null; country?: string | null; lat?: number | null; lng?: number | null } | null,
): string {
  const params = new URLSearchParams();
  params.set("dest", destination.name);
  if (destination.city) params.set("destCity", destination.city);
  if (destination.state) params.set("destState", destination.state);
  if (destination.country) params.set("destCountry", destination.country);
  params.set("destLat", String(destination.lat));
  params.set("destLng", String(destination.lng));
  if (origin?.name) params.set("origin", origin.name);
  if (origin?.country) params.set("originCountry", origin.country);
  if (origin?.lat != null) params.set("originLat", String(origin.lat));
  if (origin?.lng != null) params.set("originLng", String(origin.lng));
  return params.toString();
}

export function buildTravelHandoffPath(
  kind: TravelHandoffKind,
  destination: {
    name: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    lat: number;
    lng: number;
  },
  origin: { name?: string | null; country?: string | null; lat?: number | null; lng?: number | null } | null,
): string {
  return `/${kind}?${buildTravelHandoffQuery(destination, origin)}`;
}

function travelpayoutsWidgetUrl(extra: Record<string, string>): string {
  const params = new URLSearchParams({
    currency: "usd",
    trs: TRAVELPAYOUTS_TRS,
    shmarker: TRAVELPAYOUTS_MARKER,
    powered_by: "true",
    locale: "en",
    searchUrl: "www.aviasales.com/search",
    primary_override: "#0F766E",
    color_button: "#0F766E",
    color_icons: "#0F766E",
    color_text: "#FFFFFF",
    color_bg: "#FFFFFF",
    color_bg_search: "#1F2326",
    color_border: "#C4C4C4",
    color_focused: "#0F766E",
    border_radius: "0",
    plain: "false",
    ...extra,
  });
  return `https://tpwdg.com/content?${params.toString()}`;
}

export function buildTravelpayoutsFlightSearchWidgetUrl(handoff: TravelHandoffContext | null): string {
  const extra: Record<string, string> = {
    show_hotels: "true",
    promo_id: "7879",
    campaign_id: "100",
  };
  if (handoff?.originIata) extra.origin = handoff.originIata;
  if (handoff?.destinationIata) extra.destination = handoff.destinationIata;
  return travelpayoutsWidgetUrl(extra);
}

export function buildTravelpayoutsScheduleWidgetUrl(handoff: TravelHandoffContext | null): string {
  const extra: Record<string, string> = {
    color_button: "#0F766E",
    target_host: "www.aviasales.com/search",
    one_way: "false",
    only_direct: "false",
    period: "year",
    range: "7,14",
    promo_id: "2811",
    campaign_id: "100",
  };
  extra.origin = handoff?.originIata || "CHI";
  extra.destination = handoff?.destinationIata || "LON";
  return travelpayoutsWidgetUrl(extra);
}

export function buildTravelpayoutsPricingCalendarUrl(handoff: TravelHandoffContext | null): string {
  const extra: Record<string, string> = {
    one_way: "false",
    only_direct: "false",
    period: "year",
    range: "7,14",
    promo_id: "4041",
    campaign_id: "100",
  };
  extra.origin = handoff?.originIata || "CHI";
  return travelpayoutsWidgetUrl(extra);
}

export function buildTravelpayoutsFlightMapUrl(handoff: TravelHandoffContext | null): string {
  const lat = handoff?.origin.lat ?? handoff?.destination.lat ?? 41.8781;
  const lng = handoff?.origin.lng ?? handoff?.destination.lng ?? -87.6298;
  const params = new URLSearchParams({
    currency: "usd",
    trs: TRAVELPAYOUTS_TRS,
    shmarker: TRAVELPAYOUTS_MARKER,
    lat: String(lat),
    lng: String(lng),
    powered_by: "true",
    search_host: "www.aviasales.com/search",
    origin_iata: handoff?.originIata || "CHI",
    destination_iata: handoff?.destinationIata || "",
    one_way: "false",
    only_direct: "false",
    locale: "en",
    period: "year",
    range: "7,14",
    theme: "light",
    draggable: "true",
    disable_zoom: "false",
    show_buttons: "true",
    scroll_zoom: "false",
    zoom: "3",
    width: "100%",
    height: "500px",
    type: "map",
    promo_id: "4054",
  });
  return `https://tpwdg.com/content?${params.toString()}`;
}

function defaultDepartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

/**
 * Skyscanner without API:
 * - Default: public skyscanner.net transport URL (works immediately).
 * - With NEXT_PUBLIC_SKYSCANNER_AFFILIATE_URL: wrap via Impact link from partner dashboard.
 */
export function buildSkyscannerSearchUrl(handoff: TravelHandoffContext | null, departDate?: string): string | null {
  const origin = handoff?.originIata?.toLowerCase();
  const destination = handoff?.destinationIata?.toLowerCase();
  if (!origin || !destination) return null;

  const date = departDate || defaultDepartDate();
  const target = `https://www.skyscanner.net/transport/flights/${origin}/${destination}/${date}/`;

  if (SKYSCANNER_AFFILIATE_BASE) {
    const base = SKYSCANNER_AFFILIATE_BASE.replace(/\/$/, "");
    const joiner = base.includes("?") ? "&" : "?";
    return `${base}${joiner}u=${encodeURIComponent(target)}`;
  }
  return target;
}

export function skyscannerAffiliateConfigured(): boolean {
  return Boolean(SKYSCANNER_AFFILIATE_BASE);
}
