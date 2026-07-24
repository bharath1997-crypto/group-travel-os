/**
 * Live map sea-route overlays — shipping lanes, ferries, cruise paths.
 * Static GeoJSON only (no tile servers, no API cost).
 */

import type { ExpressionSpecification, LineLayerSpecification } from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";

function isDarkOceanLayer(layer: LiveMapLayer): boolean {
  return (
    layer === "dark" ||
    layer === "satellite" ||
    layer === "terrain" ||
    layer === "hybrid"
  );
}

export const SEA_ROUTES_SOURCE_ID = "rovvy-sea-routes";

export const SEA_ROUTES_LAYER_IDS = {
  shippingCasing: "rovvy-sea-shipping-casing",
  shipping: "rovvy-sea-shipping",
  ferryCasing: "rovvy-sea-ferry-casing",
  ferry: "rovvy-sea-ferry",
  cruiseCasing: "rovvy-sea-cruise-casing",
  cruise: "rovvy-sea-cruise",
} as const;

export const SEA_ROUTES_ATTRIBUTION =
  "Maritime routes © Rovvy (OSM/Naturalearth-inspired, illustrative)";

export type SeaRoutesOverlayState = {
  seaRoutesEnabled: boolean;
  cruiseRoutesEnabled: boolean;
};

export type SeaRouteCategory = "shipping" | "ferry" | "cruise";

export type SeaRouteLayerPaint = {
  casing: LineLayerSpecification["paint"];
  core: LineLayerSpecification["paint"];
  minzoom: number;
};

function maritimeWidth(
  core: Record<number, number>,
  casingExtra = 3,
): { core: ExpressionSpecification; casing: ExpressionSpecification } {
  const stops: (number | ExpressionSpecification)[] = [];
  for (const [z, w] of Object.entries(core).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    stops.push(Number(z), w);
  }
  const coreExpr: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], ...stops];
  const casingStops: (number | ExpressionSpecification)[] = [];
  for (const [z, w] of Object.entries(core).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    casingStops.push(Number(z), w + casingExtra);
  }
  const casingExpr: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["zoom"],
    ...casingStops,
  ];
  return { core: coreExpr, casing: casingExpr };
}

/** Bold at world zoom so lanes read on satellite oceans. */
export function getSeaRouteLayerPaint(
  category: SeaRouteCategory,
  activeBaseLayer: LiveMapLayer,
): SeaRouteLayerPaint {
  const dark = isDarkOceanLayer(activeBaseLayer);

  if (category === "shipping") {
    const { core, casing } = maritimeWidth(
      { 2: 2.8, 4: 3.8, 6: 5, 8: 6.5, 10: 8, 12: 9, 14: 10 },
      4,
    );
    return {
      minzoom: 2,
      casing: {
        "line-color": dark ? "#020617" : "#FFFFFF",
        "line-width": casing,
        "line-opacity": dark ? 0.88 : 0.92,
        "line-blur": dark ? 0.6 : 0.35,
      },
      core: {
        "line-color": dark ? "#38BDF8" : "#0284C7",
        "line-width": core,
        "line-opacity": 1,
      },
    };
  }

  if (category === "ferry") {
    const { core, casing } = maritimeWidth(
      { 5: 2.2, 7: 3.2, 9: 4.5, 11: 6, 13: 7.5 },
      3,
    );
    return {
      minzoom: 5,
      casing: {
        "line-color": dark ? "#042F2E" : "#FFFFFF",
        "line-width": casing,
        "line-opacity": dark ? 0.85 : 0.9,
        "line-blur": 0.4,
      },
      core: {
        "line-color": dark ? "#5EEAD4" : "#0F766E",
        "line-width": core,
        "line-opacity": 1,
        "line-dasharray": [3, 2],
      },
    };
  }

  const { core, casing } = maritimeWidth(
    { 2: 2.6, 4: 3.6, 6: 4.8, 8: 6.2, 10: 7.5, 12: 8.5, 14: 9.5 },
    4,
  );
  return {
    minzoom: 2,
    casing: {
      "line-color": dark ? "#431407" : "#FFFFFF",
      "line-width": casing,
      "line-opacity": dark ? 0.86 : 0.9,
      "line-blur": 0.55,
    },
    core: {
      "line-color": dark ? "#FBBF24" : "#D97706",
      "line-width": core,
      "line-opacity": 1,
      "line-dasharray": [2.5, 1.5],
    },
  };
}

export const SEA_ROUTE_FILTERS: Record<
  SeaRouteCategory,
  ExpressionSpecification
> = {
  shipping: ["==", ["get", "category"], "shipping"],
  ferry: ["==", ["get", "category"], "ferry"],
  cruise: ["==", ["get", "category"], "cruise"],
};
