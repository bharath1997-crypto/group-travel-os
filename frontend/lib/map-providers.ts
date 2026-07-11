/**
 * Rovvy map infrastructure — centralized tile + geocoding provider config.
 *
 * DEV / LOW-TRAFFIC ONLY (not production-safe at scale):
 * - tile.openstreetmap.org
 * - nominatim.openstreetmap.org (browser-direct)
 * - demotiles.maplibre.org
 *
 * COMMERCIAL / RATE-LIMIT RISK (review terms before production):
 * - Esri arcgisonline.com (satellite)
 * - CARTO basemaps.cartocdn.com (dark)
 * - Stadia stadiamaps.com
 * - OpenTopoMap opentopomap.org
 * - Stamen/Fastly stamen-tiles (deprecated; hybrid labels)
 *
 * Production: set NEXT_PUBLIC_MAP_TILE_URL (+ NEXT_PUBLIC_MAP_TILE_ATTRIBUTION)
 * to a controlled tile provider. Live Tab geocoding uses backend /api/v1/geocoding/*.
 *
 * NOT ALLOWED: Google Maps SDK canvas, embedded Google/Waze map UI.
 * OK: external handoff links (google.com/maps, waze.com/ul) opened in new tab.
 */

import type { StyleSpecification } from "maplibre-gl";

export type MapLayerKind =
  | "street"
  | "clean"
  | "satellite"
  | "dark"
  | "terrain"
  | "hybrid";

export type ProductionRisk = "low" | "medium" | "high";

export type TileProviderEntry = {
  provider: string;
  layer: MapLayerKind;
  url: string;
  attribution: string;
  productionRisk: ProductionRisk;
  reason: string;
  /** Where this URL is still hardcoded — migrate to this config file. */
  usedIn: string[];
};

/** Host/path fragments that must not be treated as production-safe defaults. */
export const PRODUCTION_RISKY_TILE_PATTERNS = [
  "tile.openstreetmap.org",
  "{s}.tile.openstreetmap.org",
  "demotiles.maplibre.org",
] as const;

export const COMMERCIAL_REVIEW_TILE_PATTERNS = [
  "arcgisonline.com",
  "basemaps.cartocdn.com",
  "stadiamaps.com",
  "opentopomap.org",
  "stamen-tiles",
] as const;

/** Audit registry — documents all tile URLs found across the frontend. */
export const TILE_PROVIDER_REGISTRY: TileProviderEntry[] = [
  {
    provider: "OpenStreetMap (public)",
    layer: "street",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    productionRisk: "high",
    reason: "Public OSM tile server — dev/low traffic only; block/throttle at scale",
    usedIn: [
      "live/LiveMapComponent.tsx",
      "explore/ExploreMap.tsx",
      "map/page.tsx",
      "components/MapComponent.tsx",
      "trips/plan/page.tsx",
      "trips/[id]/page.tsx",
      "weather/page.tsx",
      "cart/CartMap.tsx",
    ],
  },
  {
    provider: "OpenStreetMap (public, Leaflet subdomain)",
    layer: "street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    productionRisk: "high",
    reason: "Same public OSM pool — dev/low traffic only",
    usedIn: ["map/page.tsx", "MapComponent.tsx", "trips/*", "weather/page.tsx", "cart/CartMap.tsx"],
  },
  {
    provider: "Esri",
    layer: "satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    productionRisk: "medium",
    reason: "Esri terms/licensing apply for commercial production",
    usedIn: ["live/LiveMapComponent.tsx", "map/page.tsx", "MapComponent.tsx"],
  },
  {
    provider: "Esri",
    layer: "terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    productionRisk: "medium",
    reason: "Esri topo tiles — commercial terms apply",
    usedIn: ["map/page.tsx"],
  },
  {
    provider: "CARTO",
    layer: "dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© CARTO",
    productionRisk: "medium",
    reason: "Free tier limits; production needs hosted plan or self-host",
    usedIn: ["live/LiveMapComponent.tsx", "map/page.tsx", "MapComponent.tsx"],
  },
  {
    provider: "Stadia Maps",
    layer: "satellite",
    url: "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg",
    attribution: "© Stadia Maps © USGS © OpenAerialMap",
    productionRisk: "medium",
    reason: "API key/quota typically required for production",
    usedIn: ["weather/page.tsx"],
  },
  {
    provider: "OpenTopoMap",
    layer: "terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap",
    productionRisk: "medium",
    reason: "Donation-supported; strict rate limits",
    usedIn: ["map/page.tsx", "MapComponent.tsx", "weather/page.tsx"],
  },
  {
    provider: "Esri",
    layer: "hybrid",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    productionRisk: "medium",
    reason: "Esri reference overlay — road labels for hybrid satellite mode",
    usedIn: ["live/LiveMapComponent.tsx (hybrid label overlay)"],
  },
  {
    provider: "Esri",
    layer: "hybrid",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    productionRisk: "medium",
    reason: "Esri reference overlay — place/boundary labels for hybrid satellite mode",
    usedIn: ["live/LiveMapComponent.tsx (hybrid label overlay)"],
  },
  {
    provider: "Stamen (Fastly CDN)",
    layer: "hybrid",
    url: "https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png",
    attribution: "© Stamen Design, © OpenStreetMap",
    productionRisk: "high",
    reason: "Legacy Stamen endpoints; deprecated/unreliable for production",
    usedIn: ["MapComponent.tsx (hybrid label overlay)"],
  },
  {
    provider: "OpenFreeMap",
    layer: "clean",
    url: "https://tiles.openfreemap.org/styles/liberty",
    attribution: "© OpenFreeMap © OpenStreetMap",
    productionRisk: "medium",
    reason: "Vector liberty style — simplified Live map option (Clean Map)",
    usedIn: ["live/LiveMapLayerControl.tsx (clean layer)"],
  },
  {
    provider: "MapLibre demo",
    layer: "street",
    url: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    attribution: "MapLibre demo glyphs",
    productionRisk: "high",
    reason: "Demo font host — never use in production",
    usedIn: ["explore/ExploreMap.tsx (glyphs only)"],
  },
];

/** Default dev/low-traffic tile URLs (Live Tab + reference for other pages). */
/** Production fallback when NEXT_PUBLIC_MAP_TILE_URL is unset (CARTO — not public OSM). */
export const PRODUCTION_STREET_TILE_DEFAULT = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution: "© CARTO © OpenStreetMap contributors",
} as const;

export const DEV_TILE_DEFAULTS = {
  street: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
  },
  dark: {
    url: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
    attribution: "© CARTO",
  },
  /** Hybrid label overlays — stacked above satellite imagery (Esri Reference). */
  hybridLabels: {
    transport:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    places:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
  },
} as const;

export const NOMINATIM = {
  baseUrl: "https://nominatim.openstreetmap.org",
  userAgent: "Rovvy/1.0",
  productionRisk: "high" as ProductionRisk,
  note: "Public Nominatim — dev/low traffic only in legacy pages. Live Tab uses backend /geocoding proxy.",
} as const;

/** External handoff only — not embedded canvas. */
export const EXTERNAL_MAP_HANDOFF = {
  googleDirections: (lat: number, lng: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  wazeNavigate: (lat: number, lng: number) =>
    `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
} as const;

export function resolveStreetTileUrl(): string {
  const override = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim();
  if (override) return override;
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_STREET_TILE_DEFAULT.url;
  }
  return DEV_TILE_DEFAULTS.street.url;
}

export function resolveStreetTileAttribution(): string {
  const override = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim();
  if (override) return override;
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_STREET_TILE_DEFAULT.attribution;
  }
  return DEV_TILE_DEFAULTS.street.attribution;
}

export function isProductionRiskyTileUrl(url: string): boolean {
  return PRODUCTION_RISKY_TILE_PATTERNS.some((pattern) => url.includes(pattern));
}

export function tileUrlNeedsCommercialReview(url: string): boolean {
  return COMMERCIAL_REVIEW_TILE_PATTERNS.some((pattern) => url.includes(pattern));
}

/** Simplified vector OSM style — optional Clean Map layer (queryable labels/POIs). */
export const OPENFREEMAP_STREET_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

/** Live Tab zoom limits — public OSM raster tiles are available through z19 only. */
export const LIVE_MAP_MAX_ZOOM = 19;
export const LIVE_MAP_MIN_ZOOM = 2;

export type LiveMapLayer = "street" | "clean" | "satellite" | "hybrid" | "dark";

export type LiveMapStyle = StyleSpecification | string;

function resolveHybridLabelTileUrl(): string | null {
  const override = process.env.NEXT_PUBLIC_MAP_HYBRID_LABEL_URL?.trim();
  if (override === "none") return null;
  return override || DEV_TILE_DEFAULTS.hybridLabels.transport;
}

function buildHybridStyle(streetFallback: LiveMapStyle): LiveMapStyle {
  const labelUrl = resolveHybridLabelTileUrl();
  if (!labelUrl) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Rovvy Map/live] Hybrid label overlay URL missing — falling back to street style.",
      );
    }
    return streetFallback;
  }

  const useSingleOverlay = !!process.env.NEXT_PUBLIC_MAP_HYBRID_LABEL_URL?.trim();
  const placesUrl = useSingleOverlay
    ? labelUrl
    : DEV_TILE_DEFAULTS.hybridLabels.places;

  const sources: StyleSpecification["sources"] = {
    esri: {
      type: "raster",
      tiles: [DEV_TILE_DEFAULTS.satellite.url],
      tileSize: 256,
      attribution: `${DEV_TILE_DEFAULTS.satellite.attribution} ${DEV_TILE_DEFAULTS.hybridLabels.attribution}`,
      maxzoom: LIVE_MAP_MAX_ZOOM,
    },
    "esri-labels-transport": {
      type: "raster",
      tiles: [labelUrl],
      tileSize: 256,
      maxzoom: LIVE_MAP_MAX_ZOOM,
    },
  };

  const layers: StyleSpecification["layers"] = [
    {
      id: "esri-imagery",
      type: "raster",
      source: "esri",
      minzoom: 0,
      maxzoom: LIVE_MAP_MAX_ZOOM,
    },
    {
      id: "esri-labels-transport",
      type: "raster",
      source: "esri-labels-transport",
      minzoom: 0,
      maxzoom: LIVE_MAP_MAX_ZOOM,
    },
  ];

  if (!useSingleOverlay) {
    sources["esri-labels-places"] = {
      type: "raster",
      tiles: [placesUrl],
      tileSize: 256,
      maxzoom: LIVE_MAP_MAX_ZOOM,
    };
    layers.push({
      id: "esri-labels-places",
      type: "raster",
      source: "esri-labels-places",
      minzoom: 0,
      maxzoom: LIVE_MAP_MAX_ZOOM,
    });
  }

  return { version: 8, sources, layers };
}

/** Detailed OSM raster style — default Live map (labels, POIs, buildings). */
function buildDetailedStreetStyle(): StyleSpecification {
  const streetUrl = resolveStreetTileUrl();
  const streetAttribution = resolveStreetTileAttribution();
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [streetUrl],
        tileSize: 256,
        attribution: streetAttribution,
        maxzoom: LIVE_MAP_MAX_ZOOM,
      },
    },
    layers: [
      { id: "osm-tiles", type: "raster", source: "osm", minzoom: 0, maxzoom: LIVE_MAP_MAX_ZOOM },
    ],
  };
}

/** MapLibre styles for Live Tab. Street = detailed OSM raster; clean = simplified vector style. */
export function getLiveMapLibreLayerStyles(): Record<LiveMapLayer, LiveMapStyle> {
  const detailedStreetStyle = buildDetailedStreetStyle();

  return {
    street: detailedStreetStyle,
    clean: OPENFREEMAP_STREET_STYLE_URL,
    satellite: {
      version: 8,
      sources: {
        esri: {
          type: "raster",
          tiles: [DEV_TILE_DEFAULTS.satellite.url],
          tileSize: 256,
          attribution: DEV_TILE_DEFAULTS.satellite.attribution,
          maxzoom: LIVE_MAP_MAX_ZOOM,
        },
      },
      layers: [
        { id: "esri-tiles", type: "raster", source: "esri", minzoom: 0, maxzoom: LIVE_MAP_MAX_ZOOM },
      ],
    },
    dark: {
      version: 8,
      sources: {
        carto: {
          type: "raster",
          tiles: [DEV_TILE_DEFAULTS.dark.url],
          tileSize: 256,
          attribution: DEV_TILE_DEFAULTS.dark.attribution,
          maxzoom: LIVE_MAP_MAX_ZOOM,
        },
      },
      layers: [
        { id: "carto-tiles", type: "raster", source: "carto", minzoom: 0, maxzoom: LIVE_MAP_MAX_ZOOM },
      ],
    },
    hybrid: buildHybridStyle(detailedStreetStyle),
  };
}

/** Client/build warning when production uses dev-only tile URLs. */
export function warnIfUnsafeProductionTiles(context = "map"): void {
  if (process.env.NODE_ENV !== "production") return;

  const streetUrl = resolveStreetTileUrl();
  if (isProductionRiskyTileUrl(streetUrl)) {
    console.warn(
      `[Rovvy Map/${context}] Production is using a dev/low-traffic street tile URL: ${streetUrl}. ` +
        "Set NEXT_PUBLIC_MAP_TILE_URL to a controlled tile provider.",
    );
  }

  if (!process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim()) {
    console.warn(
      `[Rovvy Map/${context}] Production Live map satellite/dark layers still use default Esri/CARTO URLs ` +
        "(commercial review required). Centralize via env-based config before scale.",
    );
  }
}

/** Called from next.config at build time. */
let mapBuildWarningLogged = false;

export function logMapProviderBuildWarnings(): void {
  if (mapBuildWarningLogged || process.env.NODE_ENV !== "production") return;

  const streetUrl = resolveStreetTileUrl();
  if (isProductionRiskyTileUrl(streetUrl)) {
    console.warn(
      "\n[Rovvy Map BUILD WARNING] NEXT_PUBLIC_MAP_TILE_URL is unset or points to a dev-only provider:\n" +
        `  ${streetUrl}\n` +
        "  Configure a production tile provider before launch.\n",
    );
    mapBuildWarningLogged = true;
  }
}

export function nominatimSearchUrl(query: string, limit = 5): string {
  return `${NOMINATIM.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}`;
}

export function nominatimReverseUrl(lat: number, lng: number): string {
  return (
    `${NOMINATIM.baseUrl}/reverse?lat=${lat}&lon=${lng}` +
    "&format=json&addressdetails=1&extratags=1"
  );
}

export const NOMINATIM_HEADERS = { "User-Agent": NOMINATIM.userAgent } as const;
