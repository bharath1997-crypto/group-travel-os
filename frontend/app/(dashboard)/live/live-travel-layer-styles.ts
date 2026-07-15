import type { ExpressionSpecification } from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";

export const TRAVEL_VECTOR_SOURCE = "openmaptiles";

export const TRAVEL_VECTOR_LAYER_IDS = {
  railCasing: "rovvy-travel-rail-casing",
  railCore: "rovvy-travel-rail-core",
  motorwayCasing: "rovvy-travel-motorway-casing",
  motorwayCore: "rovvy-travel-motorway-core",
  trunkCasing: "rovvy-travel-trunk-casing",
  trunkCore: "rovvy-travel-trunk-core",
  primaryCasing: "rovvy-travel-primary-casing",
  primaryCore: "rovvy-travel-primary-core",
  secondaryCasing: "rovvy-travel-secondary-casing",
  secondaryCore: "rovvy-travel-secondary-core",
  localCore: "rovvy-travel-local-core",
  pathCore: "rovvy-travel-path-core",
  transitStops: "rovvy-travel-transit-stops",
  transitLabels: "rovvy-travel-transit-labels",
} as const;

export type TravelRoutePalette = {
  motorway: { core: string; casing: string };
  trunk: { core: string; casing: string };
  primary: { core: string; casing: string };
  secondary: { core: string; casing: string };
  local: string;
  path: string;
  rail: { core: string; casing: string };
  transit: { fill: string; stroke: string; label: string };
};

const LIGHT_PALETTE: TravelRoutePalette = {
  motorway: { core: "#E67E22", casing: "#B45309" },
  trunk: { core: "#F59E0B", casing: "#D97706" },
  primary: { core: "#FDE68A", casing: "#CA8A04" },
  secondary: { core: "#FFFFFF", casing: "#94A3B8" },
  local: "#CBD5E1",
  path: "#94A3B8",
  rail: { core: "#6366F1", casing: "#4338CA" },
  transit: { fill: "#0F766E", stroke: "#FFFFFF", label: "#0F172A" },
};

const DARK_PALETTE: TravelRoutePalette = {
  motorway: { core: "#FFB347", casing: "#C2410C" },
  trunk: { core: "#FFD166", casing: "#B45309" },
  primary: { core: "#FEF08A", casing: "#A16207" },
  secondary: { core: "#E2E8F0", casing: "#64748B" },
  local: "#94A3B8",
  path: "#64748B",
  rail: { core: "#C4B5FD", casing: "#7C3AED" },
  transit: { fill: "#2DD4BF", stroke: "#0F172A", label: "#F8FAFC" },
};

export function getTravelRoutePalette(activeBaseLayer: LiveMapLayer): TravelRoutePalette {
  return activeBaseLayer === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
}

function zoomWidth(stops: [number, number][]): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], ...stops.flat()];
}

export function travelMotorwayWidth(): ExpressionSpecification {
  return zoomWidth([
    [4, 1.2],
    [8, 2.4],
    [12, 4.5],
    [16, 9],
  ]);
}

export function travelTrunkWidth(): ExpressionSpecification {
  return zoomWidth([
    [5, 1],
    [9, 2.2],
    [13, 4],
    [16, 7.5],
  ]);
}

export function travelPrimaryWidth(): ExpressionSpecification {
  return zoomWidth([
    [7, 0.6],
    [11, 1.8],
    [14, 3.2],
    [16, 6],
  ]);
}

export function travelSecondaryWidth(): ExpressionSpecification {
  return zoomWidth([
    [9, 0.5],
    [12, 1.4],
    [15, 2.8],
    [16, 4.5],
  ]);
}

export function travelLocalWidth(): ExpressionSpecification {
  return zoomWidth([
    [13, 0.4],
    [15, 1.2],
    [16, 2.5],
  ]);
}

export function travelPathWidth(): ExpressionSpecification {
  return zoomWidth([
    [14, 0.35],
    [16, 1.4],
  ]);
}

export function travelRailWidth(): ExpressionSpecification {
  return zoomWidth([
    [5, 0.8],
    [10, 1.6],
    [14, 2.8],
    [16, 4.5],
  ]);
}

export const TRANSIT_SUBCLASSES = [
  "bus_stop",
  "bus_station",
  "tram_stop",
  "station",
  "halt",
  "subway_entrance",
  "ferry_terminal",
] as const;

export const TRANSIT_CLASS_FILTER: ExpressionSpecification = [
  "any",
  ["in", ["get", "subclass"], ["literal", [...TRANSIT_SUBCLASSES]]],
  ["in", ["get", "class"], ["literal", ["bus", "railway", "station"]]],
];
