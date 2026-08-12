import type { FlightCabin, FlightSearchParams, MultiCityLeg } from "@/lib/flight-types";

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

  return {
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
  };
}

export function buildFlightSearchQuery(params: FlightSearchParams): URLSearchParams {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    depart: params.depart,
    adults: String(params.adults),
    children: String(params.children),
    infants: String(params.infants),
    cabin: params.cabin,
  });
  if (params.fromLabel) qs.set("fromLabel", params.fromLabel);
  if (params.toLabel) qs.set("toLabel", params.toLabel);
  if (params.return) qs.set("return", params.return);
  if (params.nonstop) qs.set("nonstop", "1");
  if (params.maximumConnections !== undefined) qs.set("maxConn", String(params.maximumConnections));
  if (params.departureTimeFrom) qs.set("depFrom", params.departureTimeFrom);
  if (params.departureTimeTo) qs.set("depTo", params.departureTimeTo);
  if (params.returnDepartureTimeFrom) qs.set("retFrom", params.returnDepartureTimeFrom);
  if (params.returnDepartureTimeTo) qs.set("retTo", params.returnDepartureTimeTo);
  if (params.tripType) qs.set("tripType", params.tripType);
  if (params.multiCityLegs && params.multiCityLegs.length > 0) {
    qs.set("legs", JSON.stringify(params.multiCityLegs));
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
