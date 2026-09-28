/**
 * Rovi Travel Route Intelligence — TypeScript types.
 *
 * Mirrors backend schemas in app/schemas/route_intelligence.py.
 * Never store Google Maps coordinates or invented price data here.
 */

export type RouteOptionType =
  | "road_trip"
  | "flight_connection"
  | "flight_multimodal"
  | "train_route"
  | "bus_route"
  | "budget_route"
  | "comfort_route"
  | "private_vehicle";

export type RouteSegmentType =
  | "drive"
  | "walk"
  | "flight"
  | "train"
  | "bus"
  | "transfer"
  | "border_crossing"
  | "local_transport";

export type ProviderStatus =
  | "estimated"
  | "live_provider_required"
  | "complete";

export type RouteSegment = {
  id: string;
  type: RouteSegmentType;
  fromName: string;
  toName: string;
  title: string;
  estimatedDuration?: string;
  estimatedCost?: string;
  providerStatus?: ProviderStatus;
  notes?: string[];
};

export type RouteOption = {
  id: string;
  title: string;
  type: RouteOptionType;
  recommended?: boolean;
  bestFor?: string;
  estimatedDuration?: string;
  estimatedCostRange?: string;
  providerStatus: ProviderStatus;
  segments: RouteSegment[];
  notes?: string[];
};

export type LocationSummary = {
  name: string;
  country?: string;
  lat: number;
  lng: number;
};

export type RouteIntelligenceRequest = {
  origin: LocationSummary;
  destination: LocationSummary;
  userPreference?: string;
};

export type RouteIntelligenceResponse = {
  origin: LocationSummary;
  destination: LocationSummary;
  route_options: RouteOption[];
  distance_km: number | null;
  is_international: boolean;
  requires_border_crossing: boolean;
  rovi_explanation: string | null;
};

// ── Icons / Labels ─────────────────────────────────────────────────────────────

export function routeSegmentIcon(type: RouteSegmentType): string {
  switch (type) {
    case "flight": return "✈️";
    case "train": return "🚂";
    case "bus": return "🚌";
    case "drive": return "🚗";
    case "walk": return "🚶";
    case "transfer": return "🔄";
    case "border_crossing": return "🛂";
    case "local_transport": return "🚕";
    default: return "📍";
  }
}

export function routeOptionIcon(type: RouteOptionType): string {
  switch (type) {
    case "flight_connection":
    case "flight_multimodal": return "✈️";
    case "train_route": return "🚂";
    case "bus_route": return "🚌";
    case "road_trip":
    case "private_vehicle": return "🚗";
    case "budget_route": return "💰";
    case "comfort_route": return "⭐";
    default: return "🗺️";
  }
}

export function providerStatusLabel(status: ProviderStatus): string {
  switch (status) {
    case "complete": return "Live prices available";
    case "live_provider_required": return "Provider check required";
    case "estimated": return "Estimate only";
  }
}

export function providerStatusColor(status: ProviderStatus): string {
  switch (status) {
    case "complete": return "text-emerald-700 bg-emerald-50";
    case "live_provider_required": return "text-amber-700 bg-amber-50";
    case "estimated": return "text-stone-600 bg-stone-100";
  }
}
