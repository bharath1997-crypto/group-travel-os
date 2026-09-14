import type { FlightCabin, FlightSearchParams, MultiCityLeg } from "@/lib/flight-types";
import {
  LEGACY_PLACEHOLDER_DEPARTURE_TIME_TO,
} from "@/lib/flight-search-validation";

const CABIN_CODES = new Set<FlightCabin>(["M", "W", "C", "F"]);

export function parseFlightSearchParams(sp: URLSearchParams): FlightSearchParams | null {
  const from = (sp.get("from") || "").trim().toUpperCase();
  const to = (sp.get("to") || "").trim().toUpperCase();
  const depart = (sp.get("depart") || "").trim();
  if (!from || !to || !depart) return null;

  const cabinRaw = (sp.get("cabin") || "M").trim().toUpperCase();
  const cabin = (CABIN_CODES.has(cabinRaw as FlightCabin) ? cabinRaw : "M") as FlightCabin;

  const tripTypeRaw = sp.get("tripType") as "oneway" | "roundtrip" | "multicity" | null;
  const tripType = tripTypeRaw && ["oneway", "roundtrip", "multicity"].includes(tripTypeRaw)
    ? tripTypeRaw
    : sp.get("return") ? "roundtrip" : "oneway";

  const maxConnRaw = sp.get("maxConn");
  const maximumConnections = maxConnRaw ? Number.parseInt(maxConnRaw, 10) : undefined;

  let multiCityLegs: MultiCityLeg[] | undefined = undefined;
  const legsRaw = sp.get("legs");
  if (legsRaw) {
    try {
      const parsed = JSON.parse(legsRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        multiCityLegs = parsed;
      }
    } catch {
      // ignore JSON parse error
    }
  }

  return normalizeFlightSearchParams({
    from,
    to,
    fromLabel: sp.get("fromLabel") || undefined,
    toLabel: sp.get("toLabel") || undefined,
    depart,
    return: sp.get("return") || undefined,
    adults: clampInt(sp.get("adults"), 1, 9, 1),
    children: clampInt(sp.get("children"), 0, 8, 0),
    infants: clampInt(sp.get("infants"), 0, 4, 0),
    cabin,
    nonstop: sp.get("nonstop") === "1",
    tripType,
    multiCityLegs,
    maximumConnections: Number.isFinite(maximumConnections) ? maximumConnections : undefined,
    departureTimeFrom: sp.get("depFrom") || undefined,
    departureTimeTo: sp.get("depTo") || undefined,
    returnDepartureTimeFrom: sp.get("retFrom") || undefined,
    returnDepartureTimeTo: sp.get("retTo") || undefined,
  });
}

/** Drop legacy placeholder departure windows that were never user intent. */
export function normalizeFlightSearchParams(params: FlightSearchParams): FlightSearchParams {
  const departureTimeFrom = params.departureTimeFrom?.trim() || undefined;
  let departureTimeTo = params.departureTimeTo?.trim() || undefined;
  if (departureTimeTo === LEGACY_PLACEHOLDER_DEPARTURE_TIME_TO && !departureTimeFrom) {
    departureTimeTo = undefined;
  }

  const returnDepartureTimeFrom = params.returnDepartureTimeFrom?.trim() || undefined;
  let returnDepartureTimeTo = params.returnDepartureTimeTo?.trim() || undefined;
  if (returnDepartureTimeTo === LEGACY_PLACEHOLDER_DEPARTURE_TIME_TO && !returnDepartureTimeFrom) {
    returnDepartureTimeTo = undefined;
  }

  return {
    ...params,
    departureTimeFrom,
    departureTimeTo,
    returnDepartureTimeFrom,
    returnDepartureTimeTo,
  };
}

export function flightSearchParamsDiffer(a: FlightSearchParams, b: FlightSearchParams): boolean {
  return buildFlightSearchQuery(a).toString() !== buildFlightSearchQuery(b).toString();
}

export function buildFlightSearchQuery(params: FlightSearchParams): URLSearchParams {
  const normalized = normalizeFlightSearchParams(params);
  const qs = new URLSearchParams({
    from: normalized.from,
    to: normalized.to,
    depart: normalized.depart,
    adults: String(normalized.adults),
    children: String(normalized.children),
    infants: String(normalized.infants),
    cabin: normalized.cabin,
  });
  if (normalized.fromLabel) qs.set("fromLabel", normalized.fromLabel);
  if (normalized.toLabel) qs.set("toLabel", normalized.toLabel);
  if (normalized.return) qs.set("return", normalized.return);
  if (normalized.nonstop) qs.set("nonstop", "1");
  if (normalized.maximumConnections !== undefined) qs.set("maxConn", String(normalized.maximumConnections));
  if (normalized.departureTimeFrom) qs.set("depFrom", normalized.departureTimeFrom);
  if (normalized.departureTimeTo) qs.set("depTo", normalized.departureTimeTo);
  if (normalized.returnDepartureTimeFrom) qs.set("retFrom", normalized.returnDepartureTimeFrom);
  if (normalized.returnDepartureTimeTo) qs.set("retTo", normalized.returnDepartureTimeTo);
  if (normalized.tripType) qs.set("tripType", normalized.tripType);
  if (normalized.multiCityLegs && normalized.multiCityLegs.length > 0) {
    qs.set("legs", JSON.stringify(normalized.multiCityLegs));
  }
  return qs;
}

export function buildFlightResultsPath(params: FlightSearchParams): string {
  return `/flights/results?${buildFlightSearchQuery(params).toString()}`;
}

export function buildFlightSearchApiQuery(params: FlightSearchParams): URLSearchParams {
  const qs = new URLSearchParams({
    fly_from: params.from,
    fly_to: params.to,
    date_from: params.depart,
    date_to: params.depart,
    adults: String(params.adults),
    children: String(params.children),
    infants: String(params.infants),
    currency: "USD",
    cabins: params.cabin,
  });
  if (params.return) {
    qs.set("return_from", params.return);
    qs.set("return_to", params.return);
  }
  return qs;
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw || "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
