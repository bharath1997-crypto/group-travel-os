import type { PlacePreviewData } from "./PlacePreviewCard";
import type { RouteOption } from "./route-intelligence-types";
import type { LocationSummary } from "./route-intelligence-types";
import {
  buildTravelHandoffPath,
  type TravelHandoffKind,
} from "@/lib/travel-handoff";

export type { TravelHandoffKind };

export function buildTravelHandoffUrl(
  kind: TravelHandoffKind,
  destination: PlacePreviewData,
  origin: LocationSummary | null,
): string {
  return buildTravelHandoffPath(
    kind,
    {
      name: destination.name,
      city: destination.city ?? null,
      state: destination.state ?? null,
      country: destination.country ?? null,
      lat: destination.lat,
      lng: destination.lng,
    },
    origin
      ? {
          name: origin.name,
          country: origin.country ?? null,
          lat: origin.lat,
          lng: origin.lng,
        }
      : null,
  );
}

export function travelHandoffKindForRouteOption(option: RouteOption): TravelHandoffKind {
  const segmentTypes = new Set(option.segments.map((segment) => segment.type));
  if (segmentTypes.has("flight")) return "flights";
  if (segmentTypes.has("train") || segmentTypes.has("bus")) return "routes";
  if (segmentTypes.has("local_transport")) return "buses";
  return "plan";
}

export function travelHandoffLabel(kind: TravelHandoffKind): string {
  switch (kind) {
    case "flights":
      return "Open Flights in Travel";
    case "routes":
      return "Open Routes in Travel";
    case "buses":
      return "Open Buses in Travel";
    default:
      return "Open Travel tab";
  }
}
