import type { ExpressionSpecification } from "maplibre-gl";
import type { LiveMapLayer } from "@/lib/map-providers";

/** Satellite, terrain, hybrid, and dark tiles need higher-contrast route colors. */
export function isLiveMapDarkTintLayer(layer: LiveMapLayer): boolean {
  return layer === "dark" || layer === "satellite" || layer === "terrain" || layer === "hybrid";
}

export type RouteVisualStyle = {
  casingColor: string;
  casingOpacity: number;
  coreColor: string;
  coreOpacity: number;
  arrowColor: string;
  borderColor: string;
  borderCasingColor: string;
};

/**
 * Navigation-style route colors — slim line + thin edge, not a fat neon pipe.
 * Dark maps: sky-blue core + dark edge (reads like Google/Waze on satellite).
 * Light maps: Rovvy teal + soft dark edge.
 */
export function getRouteVisualStyle(layer: LiveMapLayer, active: boolean): RouteVisualStyle {
  if (isLiveMapDarkTintLayer(layer)) {
    return {
      casingColor: "#0F172A",
      casingOpacity: active ? 0.82 : 0.72,
      coreColor: active ? "#38BDF8" : "#60A5FA",
      coreOpacity: 1,
      arrowColor: "#FFFFFF",
      borderColor: "#FBBF24",
      borderCasingColor: "#0F172A",
    };
  }

  return {
    casingColor: "#FFFFFF",
    casingOpacity: active ? 0.95 : 0.88,
    coreColor: active ? "#0F766E" : "#14B8A6",
    coreOpacity: 1,
    arrowColor: "#FFFFFF",
    borderColor: "#F59E0B",
    borderCasingColor: "#FFFFFF",
  };
}

type WidthExpr = ExpressionSpecification;

/** Slim core line — visible at continent zoom without looking like a highway. */
export function routeCoreWidth(active: boolean): WidthExpr {
  const w = active
    ? { z2: 2.5, z4: 3, z6: 4, z8: 5, z10: 6, z12: 7, z14: 8, z16: 9, z18: 10 }
    : { z2: 2, z4: 2.5, z6: 3.5, z8: 4.5, z10: 5.5, z12: 6.5, z14: 7.5, z16: 8.5, z18: 9 };

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    w.z2,
    4,
    w.z4,
    6,
    w.z6,
    8,
    w.z8,
    10,
    w.z10,
    12,
    w.z12,
    14,
    w.z14,
    16,
    w.z16,
    18,
    w.z18,
  ];
}

/** Thin edge halo — only ~2px wider than core, not a second fat band. */
export function routeCasingWidth(active: boolean): WidthExpr {
  const w = active
    ? { z2: 4.5, z4: 5.5, z6: 6.5, z8: 7.5, z10: 8.5, z12: 9.5, z14: 10.5, z16: 11.5, z18: 12.5 }
    : { z2: 4, z4: 5, z6: 6, z8: 7, z10: 8, z12: 9, z14: 10, z16: 11, z18: 12 };

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    w.z2,
    4,
    w.z4,
    6,
    w.z6,
    8,
    w.z8,
    10,
    w.z10,
    12,
    w.z12,
    14,
    w.z14,
    16,
    w.z16,
    18,
    w.z18,
  ];
}

export function routeBorderCoreWidth(active: boolean): WidthExpr {
  const w = active
    ? { z2: 3, z4: 3.5, z6: 4.5, z8: 5.5, z10: 6.5, z12: 7.5, z14: 8.5, z16: 9.5, z18: 10.5 }
    : { z2: 2.5, z4: 3, z6: 4, z8: 5, z10: 6, z12: 7, z14: 8, z16: 9, z18: 10 };

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    w.z2,
    4,
    w.z4,
    6,
    w.z6,
    8,
    w.z8,
    10,
    w.z10,
    12,
    w.z12,
    14,
    w.z14,
    16,
    w.z16,
    18,
    w.z18,
  ];
}

export function routeBorderCasingWidth(active: boolean): WidthExpr {
  const w = active
    ? { z2: 5.5, z4: 6.5, z6: 7.5, z8: 8.5, z10: 9.5, z12: 10.5, z14: 11.5, z16: 12.5, z18: 13.5 }
    : { z2: 5, z4: 6, z6: 7, z8: 8, z10: 9, z12: 10, z14: 11, z16: 12, z18: 13 };

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    w.z2,
    4,
    w.z4,
    6,
    w.z6,
    8,
    w.z8,
    10,
    w.z10,
    12,
    w.z12,
    14,
    w.z14,
    16,
    w.z16,
    18,
    w.z18,
  ];
}
