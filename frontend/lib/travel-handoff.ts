/**
 * Live map → Travel tab handoff (parse URL params, city labels for routes/buses/plan).
 */

export type TravelHandoffKind = "plan" | "routes" | "buses";

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

/** Map a city / place label to a metro IATA code when possible (routes context only). */
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
