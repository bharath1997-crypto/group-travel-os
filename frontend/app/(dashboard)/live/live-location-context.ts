import type { LiveStage } from "./live-types";
import { FAR_DISTANCE_MILES, LOCAL_DISTANCE_MILES } from "./live-types";

export type LocationClassification =
  | "local_place"
  | "far_destination"
  | "very_far_destination"
  | "country_mismatch"
  | "incomplete_place_data";

export type LocationContextInput = {
  userLocation: {
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    country?: string;
  } | null;
  selectedPlace: {
    name: string;
    address?: string;
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    country?: string;
    category?: string;
    source?: string;
    hasOpeningHours?: boolean;
  };
  workflowType?: string;
  travelMode?: string;
  liveStage?: LiveStage;
};

export type LocationContextTemplate = {
  summary: string;
  recommendation: string;
};

export type RoviCompactContext = {
  user_area: string;
  place_name: string;
  place_area: string;
  distance_miles: number | null;
  classification: LocationClassification;
  travel_mode: string;
  workflow_type: string;
  live_safe: boolean;
  recommended_actions: string[];
};

export type LiveLocationContext = {
  distanceMiles: number | null;
  sameCountry: boolean | null;
  sameState: boolean | null;
  sameCity: boolean | null;
  countryMismatch: boolean;
  stateMismatch: boolean;
  missingAddress: boolean;
  missingHours: boolean;
  missingDistance: boolean;
  dataQualityScore: number;
  classification: LocationClassification;
  futureTripCandidate: boolean;
  liveSafe: boolean;
  userArea: string;
  placeArea: string;
  recommendedActions: string[];
  template: LocationContextTemplate;
  compact: RoviCompactContext;
};

const UNSAFE_ACTIONS = [
  "Search near me",
  "Change destination",
  "Plan Trip",
  "Continue anyway",
];

const LOCAL_ACTIONS = ["Make Destination", "Preview route"];

const TEMPLATE_COPY: Record<LocationClassification, LocationContextTemplate> = {
  local_place: {
    summary: "This place is near your current area.",
    recommendation: "You can make it your destination and start Solo Live when ready.",
  },
  far_destination: {
    summary: "This place is far from your current area.",
    recommendation: "Check the location before starting live travel.",
  },
  very_far_destination: {
    summary: "This place is far from your current area.",
    recommendation:
      "This is not a normal Solo Live drive destination. Search nearby, plan it as a future trip, or continue only if intentional.",
  },
  country_mismatch: {
    summary: "This destination appears to be in another country.",
    recommendation:
      "Rovvy recommends planning it as a future trip instead of starting Solo Live now.",
  },
  incomplete_place_data: {
    summary: "Some place details are limited.",
    recommendation: "Check the address before continuing.",
  },
};

function normalizeToken(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function normalizeWorkflow(value?: string | null): string {
  const token = normalizeToken(value).replace(/\s+/g, "_");
  if (token === "solo" || token === "group_travel" || token === "seat_share") return token;
  if (token === "group") return "group_travel";
  return "solo";
}

function normalizeTravelMode(value?: string | null): string {
  const token = normalizeToken(value);
  if (token === "drive" || token === "bike" || token === "trek" || token === "walk") return token;
  return "drive";
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 3958.7613;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function parseAddressParts(address?: string | null): {
  city: string | null;
  state: string | null;
  country: string | null;
} {
  if (!address) return { city: null, state: null, country: null };
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { city: null, state: null, country: null };
  const country = parts[parts.length - 1] ?? null;
  const state = parts.length >= 2 ? parts[parts.length - 2] : null;
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[0] ?? null;
  return { city, state, country };
}

function formatArea(city?: string | null, state?: string | null, country?: string | null): string {
  const parts = [city, state, country].filter((part) => part && part.trim());
  return parts.length ? parts.join(", ") : "Unknown area";
}

function countryCode(country?: string | null): string | null {
  if (!country) return null;
  const token = normalizeToken(country);
  const aliases: Record<string, string> = {
    us: "united states",
    usa: "united states",
    "u.s.": "united states",
    "u.s.a.": "united states",
    uk: "united kingdom",
    "u.k.": "united kingdom",
  };
  return aliases[token] ?? token;
}

function regionsMatch(a?: string | null, b?: string | null): boolean | null {
  if (!a || !b) return null;
  return countryCode(a) === countryCode(b);
}

function isIncompletePlace(place: LocationContextInput["selectedPlace"]): boolean {
  const address = (place.address || "").trim();
  if (address.length < 8) return true;
  if (address === place.name.trim()) return true;
  if (/^[-0-9.,\s]+$/.test(address)) return true;
  return false;
}

function enrichPlace(place: LocationContextInput["selectedPlace"]) {
  const parsed = parseAddressParts(place.address);
  return {
    ...place,
    city: place.city || parsed.city || undefined,
    state: place.state || parsed.state || undefined,
    country: place.country || parsed.country || undefined,
  };
}

export function buildLocationContext(input: LocationContextInput): LiveLocationContext {
  const place = enrichPlace(input.selectedPlace);
  const user = input.userLocation;

  let distanceMiles: number | null = null;
  if (user?.lat != null && user?.lng != null) {
    distanceMiles = Math.round(haversineMiles(user.lat, user.lng, place.lat, place.lng) * 10) / 10;
  }

  const sameCountry = (user?.country && place.country) ? regionsMatch(user.country, place.country) : null;
  const sameState =
    user?.state && place.state
      ? normalizeToken(user.state) === normalizeToken(place.state)
      : null;
  const sameCity =
    user?.city && place.city
      ? normalizeToken(user.city) === normalizeToken(place.city)
      : null;

  let countryMismatch = sameCountry === false;
  if (distanceMiles !== null && distanceMiles < 100) {
    // Do not claim a country mismatch for local places:
    // 1. If either country field is missing.
    // 2. If either country value looks like a coordinate, a POI category,
    //    or any other non-country string (< 4 chars or contains digits).
    const userCountryClean = (user?.country || "").trim();
    const placeCountryClean = (place.country || "").trim();
    const looksLikeRealCountry = (s: string) =>
      s.length >= 4 && !/\d/.test(s) && !s.includes(":") && !s.includes(",");
    if (
      !userCountryClean ||
      !placeCountryClean ||
      !looksLikeRealCountry(userCountryClean) ||
      !looksLikeRealCountry(placeCountryClean)
    ) {
      countryMismatch = false;
    }
  }
  const stateMismatch = sameState === false;
  const missingAddress = isIncompletePlace(place);
  const missingHours = place.hasOpeningHours === false;
  const missingDistance = distanceMiles == null;

  let score = 1;
  if (missingAddress) score -= 0.35;
  if (missingHours) score -= 0.1;
  if (missingDistance) score -= 0.2;
  if (countryMismatch) score -= 0.2;
  if (stateMismatch) score -= 0.05;
  const dataQualityScore = Math.max(0, Math.min(1, Math.round(score * 100) / 100));

  const userArea = formatArea(user?.city, user?.state, user?.country);
  const placeArea = formatArea(place.city, place.state, place.country);

  const built = {
    distanceMiles,
    sameCountry,
    sameState,
    sameCity,
    countryMismatch,
    stateMismatch,
    missingAddress,
    missingHours,
    missingDistance,
    dataQualityScore,
    userArea,
    placeArea,
    workflowType: normalizeWorkflow(input.workflowType),
    travelMode: normalizeTravelMode(input.travelMode),
  };

  const classification = classifyLocationContext(built);
  const liveSafe = isLiveSafe(classification, built);
  const futureTripCandidate = isFutureTripCandidate(classification, built);
  const recommendedActions = liveSafe ? [...LOCAL_ACTIONS] : [...UNSAFE_ACTIONS];
  const template = TEMPLATE_COPY[classification];
  const compact = buildRoviAiCompactContext({
    ...built,
    place,
    classification,
    liveSafe,
    recommendedActions,
  });

  return {
    distanceMiles: built.distanceMiles,
    sameCountry: built.sameCountry,
    sameState: built.sameState,
    sameCity: built.sameCity,
    countryMismatch: built.countryMismatch,
    stateMismatch: built.stateMismatch,
    missingAddress: built.missingAddress,
    missingHours: built.missingHours,
    missingDistance: built.missingDistance,
    dataQualityScore: built.dataQualityScore,
    classification,
    futureTripCandidate,
    liveSafe,
    userArea: built.userArea,
    placeArea: built.placeArea,
    recommendedActions,
    template,
    compact,
  };
}

type BuiltSlice = {
  distanceMiles: number | null;
  countryMismatch: boolean;
  missingAddress: boolean;
  missingDistance: boolean;
  dataQualityScore: number;
};

export function classifyLocationContext(built: BuiltSlice): LocationClassification {
  if (built.countryMismatch) {
    // Extra safety: only escalate to country_mismatch when the distance is
    // known AND is large enough to plausibly cross a border (>= 50 miles).
    // This prevents stale/wrong geocode data from triggering the warning on
    // a parking lot 4 miles away.
    if (built.distanceMiles !== null && built.distanceMiles < 50) {
      // Treat as local even if country flag is set
    } else {
      return "country_mismatch";
    }
  }
  if (built.missingAddress && (built.missingDistance || built.dataQualityScore < 0.6)) {
    return "incomplete_place_data";
  }
  const miles = built.distanceMiles;
  if (miles == null) return "incomplete_place_data";
  if (miles > FAR_DISTANCE_MILES) return "very_far_destination";
  if (miles > LOCAL_DISTANCE_MILES) return "far_destination";
  if (built.missingAddress) return "incomplete_place_data";
  return "local_place";
}

function isFutureTripCandidate(
  classification: LocationClassification,
  built: BuiltSlice,
): boolean {
  if (classification === "country_mismatch" || classification === "very_far_destination") {
    return true;
  }
  return built.distanceMiles != null && built.distanceMiles > FAR_DISTANCE_MILES;
}

function isLiveSafe(classification: LocationClassification, built: BuiltSlice): boolean {
  if (built.countryMismatch) return false;
  if (built.distanceMiles != null && built.distanceMiles > FAR_DISTANCE_MILES) return false;
  if (classification === "country_mismatch") return false;
  return true;
}

export function buildRoviAiCompactContext(input: {
  userArea: string;
  place: LocationContextInput["selectedPlace"];
  placeArea: string;
  distanceMiles: number | null;
  classification: LocationClassification;
  travelMode: string;
  workflowType: string;
  liveSafe: boolean;
  recommendedActions: string[];
}): RoviCompactContext {
  return {
    user_area: input.userArea,
    place_name: input.place.name,
    place_area: input.placeArea,
    distance_miles: input.distanceMiles,
    classification: input.classification,
    travel_mode: input.travelMode,
    workflow_type: input.workflowType,
    live_safe: input.liveSafe,
    recommended_actions: input.recommendedActions,
  };
}

export function shouldShowAskRoviAi(context: LiveLocationContext | null): boolean {
  if (!context) return false;
  if (context.classification === "local_place" && context.liveSafe) return false;
  return true;
}

export function buildRoviCacheKey(compact: RoviCompactContext): string {
  const miles = compact.distance_miles ?? -1;
  return `${compact.place_name}|${compact.place_area}|${compact.user_area}|${compact.classification}|${miles}|${compact.live_safe}`;
}

export { LOCAL_DISTANCE_MILES, FAR_DISTANCE_MILES };
