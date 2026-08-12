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
    provider: "OpenRailwayMap",
    layer: "street",
    url: "https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
    attribution: "© OpenRailwayMap © OpenStreetMap contributors",
    productionRisk: "medium",
    reason: "Global railway overlay for Live Travel layer toggle",
    usedIn: ["live/live-travel-layer-sync.ts (travel overlay)"],
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
  /** MapLibre-safe — no Leaflet {s}/{r} placeholders. */
  url: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
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
  terrain: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
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

export function isProductionRiskyTileUrl(url: string): boolean {
  return PRODUCTION_RISKY_TILE_PATTERNS.some((pattern) => url.includes(pattern));
}

/** MapLibre raster templates must include z/x/y and a valid http(s) scheme. */
export function isValidRasterTileTemplate(url: string): boolean {
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
  return u.includes("{z}") && u.includes("{x}") && u.includes("{y}");
}

/**
 * Expand Leaflet-style templates ({s}, {r}) into MapLibre raster tile URL list.
 * MapLibre does not resolve {s} subdomains or {r} retina suffixes on its own.
 */
export function expandRasterTileUrls(template: string): string[] {
  const trimmed = template.trim();
  if (!isValidRasterTileTemplate(trimmed)) return [];

  const withoutRetina = trimmed.replace(/\{r\}/g, "");
  if (withoutRetina.includes("{s}")) {
    return ["a", "b", "c", "d"].map((sub) =>
      withoutRetina.replace(/\{s\}/g, sub),
    );
  }
  return [withoutRetina];
}

let detailedMapFallbackWarningLogged = false;

function logDetailedMapFallbackWarning(reason: string): void {
  if (process.env.NODE_ENV !== "development" || detailedMapFallbackWarningLogged) {
    return;
  }
  console.warn(
    `[Rovvy Map/live] Detailed map unavailable; falling back to Clean Map. (${reason})`,
  );
  detailedMapFallbackWarningLogged = true;
}

export function resolveStreetTileUrl(): string {
  const override = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim();
  if (override) {
    if (isValidRasterTileTemplate(override)) return override;
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Rovvy Map] NEXT_PUBLIC_MAP_TILE_URL is missing {z}/{x}/{y} or uses an invalid scheme — using built-in street tiles.",
      );
    }
  }
  // Same Detailed Map tiles locally and in production (CARTO Voyager).
  return PRODUCTION_STREET_TILE_DEFAULT.url;
}

/** Resolved raster tile URLs for MapLibre `sources.*.tiles` (never blank). */
export function resolveStreetRasterTileUrls(): string[] {
  const primary = expandRasterTileUrls(resolveStreetTileUrl());
  if (primary.length > 0) return primary;

  const productionFallback = expandRasterTileUrls(
    PRODUCTION_STREET_TILE_DEFAULT.url,
  );
  if (productionFallback.length > 0) return productionFallback;

  return expandRasterTileUrls(DEV_TILE_DEFAULTS.street.url);
}

export function resolveStreetTileAttribution(): string {
  const override = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim();
  if (override) return override;
  return PRODUCTION_STREET_TILE_DEFAULT.attribution;
}

export function tileUrlNeedsCommercialReview(url: string): boolean {
  return COMMERCIAL_REVIEW_TILE_PATTERNS.some((pattern) => url.includes(pattern));
}

/** Simplified vector OSM style — optional Clean Map layer (queryable labels/POIs). */
export const OPENFREEMAP_STREET_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

/** OpenFreeMap vector tiles — hybrid thin-road overlay + label search. */
export const OPENFREEMAP_VECTOR_TILES =
  "https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf";

export type LiveMapLayer = "street" | "clean" | "satellite" | "terrain" | "hybrid" | "dark";

/** Live Tab min zoom (z0 = full globe). Max caps per layer avoid blank tiles. */
export const LIVE_MAP_MIN_ZOOM = 0;
/** OpenFreeMap vector (Clean Map) — native tile data to z14; z16 with travel overlay overzoom. */
export const LIVE_MAP_VECTOR_MAX_ZOOM = 14;
/** Clean Map + Travel layer — extra headroom without housenumber clutter. */
export const LIVE_MAP_CLEAN_TRAVEL_MAX_ZOOM = 16;
/** Last native Esri raster tile level (z16 tiles overzoom for hybrid cap). */
export const LIVE_MAP_ESRI_NATIVE_TILE_MAX_ZOOM = 16;
/** Satellite & terrain — hard camera stop at 16.5. */
export const LIVE_MAP_SATELLITE_MAX_ZOOM = 16.5;
export const LIVE_MAP_TERRAIN_MAX_ZOOM = 16.5;
/** Hybrid imagery + labels — hard camera stop at 16. */
export const LIVE_MAP_HYBRID_MAX_ZOOM = 16;
/** Dark (night) CARTO raster — hard camera stop at 17.5. */
export const LIVE_MAP_DARK_MAX_ZOOM = 17.5;
/** @deprecated Use LIVE_MAP_SATELLITE_MAX_ZOOM */
export const LIVE_MAP_ESRI_VIEW_MAX_ZOOM = LIVE_MAP_SATELLITE_MAX_ZOOM;
/** @deprecated Use LIVE_MAP_ESRI_VIEW_MAX_ZOOM */
export const LIVE_MAP_ESRI_MAX_ZOOM = LIVE_MAP_ESRI_VIEW_MAX_ZOOM;
/** CARTO + OSM raster (Detailed Map) — cap below z18 to avoid empty tile grids. */
export const LIVE_MAP_CARTO_STREET_MAX_ZOOM = 17;

/** Per-layer max zoom — last level with structural tile data for each basemap. */
export const LIVE_MAP_LAYER_MAX_ZOOM: Record<LiveMapLayer, number> = {
  street: LIVE_MAP_CARTO_STREET_MAX_ZOOM,
  clean: LIVE_MAP_VECTOR_MAX_ZOOM,
  satellite: LIVE_MAP_SATELLITE_MAX_ZOOM,
  terrain: LIVE_MAP_TERRAIN_MAX_ZOOM,
  hybrid: LIVE_MAP_HYBRID_MAX_ZOOM,
  dark: LIVE_MAP_DARK_MAX_ZOOM,
};

export function getLiveMapMaxZoom(
  layer: LiveMapLayer,
  options?: { travelLayerEnabled?: boolean },
): number {
  if (layer === "clean" && options?.travelLayerEnabled) {
    return LIVE_MAP_CLEAN_TRAVEL_MAX_ZOOM;
  }
  return LIVE_MAP_LAYER_MAX_ZOOM[layer];
}

export type LiveMapStyle = StyleSpecification | string;

function resolveHybridPlacesLabelTileUrl(): string | null {
  const override = process.env.NEXT_PUBLIC_MAP_HYBRID_LABEL_URL?.trim();
  if (override === "none") return null;
  return override || DEV_TILE_DEFAULTS.hybridLabels.places;
}

const LIVE_MAP_RASTER_BG_LIGHT = "#d4dde4";
export const LIVE_MAP_RASTER_BG_OCEAN = "#061325";

function withGlobeProjection(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    projection: { type: "globe" },
  };
}

function buildRasterBackgroundLayer(
  color: string = LIVE_MAP_RASTER_BG_LIGHT,
): StyleSpecification["layers"][number] {
  return {
    id: "rovvy-raster-background",
    type: "background",
    paint: { "background-color": color },
  };
}

function buildHybridStyle(streetFallback: LiveMapStyle): LiveMapStyle {
  const placesUrl = resolveHybridPlacesLabelTileUrl();
  if (!placesUrl) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Rovvy Map/live] Hybrid label overlay URL missing — falling back to street style.",
      );
    }
    return streetFallback;
  }

  const sources: StyleSpecification["sources"] = {
    esri: {
      type: "raster",
      tiles: [DEV_TILE_DEFAULTS.satellite.url],
      tileSize: 256,
      attribution: `${DEV_TILE_DEFAULTS.satellite.attribution} ${DEV_TILE_DEFAULTS.hybridLabels.attribution}`,
      maxzoom: LIVE_MAP_ESRI_NATIVE_TILE_MAX_ZOOM,
    },
    openmaptiles: {
      type: "vector",
      tiles: [OPENFREEMAP_VECTOR_TILES],
      maxzoom: LIVE_MAP_VECTOR_MAX_ZOOM,
    },
    "esri-labels-places": {
      type: "raster",
      tiles: [placesUrl],
      tileSize: 256,
      maxzoom: LIVE_MAP_ESRI_NATIVE_TILE_MAX_ZOOM,
    },
  };

  const layers: StyleSpecification["layers"] = [
    buildRasterBackgroundLayer(LIVE_MAP_RASTER_BG_OCEAN),
    {
      id: "esri-imagery",
      type: "raster",
      source: "esri",
      minzoom: 0,
      maxzoom: LIVE_MAP_ESRI_NATIVE_TILE_MAX_ZOOM,
    },
    {
      id: "esri-labels-places",
      type: "raster",
      source: "esri-labels-places",
      minzoom: 0,
      maxzoom: LIVE_MAP_ESRI_NATIVE_TILE_MAX_ZOOM,
      paint: { "raster-opacity": 0.92 },
    },
  ];

  return withGlobeProjection({ version: 8, sources, layers });
}

/** Detailed OSM raster style — default Live map (labels, POIs, buildings). */
function buildDetailedStreetStyle(): LiveMapStyle {
  const tileUrls = resolveStreetRasterTileUrls();
  if (tileUrls.length === 0) {
    logDetailedMapFallbackWarning("no valid raster tile template");
    return OPENFREEMAP_STREET_STYLE_URL;
  }

  const streetAttribution = resolveStreetTileAttribution();
  return withGlobeProjection({
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: tileUrls,
        tileSize: 256,
        attribution: streetAttribution,
        maxzoom: LIVE_MAP_CARTO_STREET_MAX_ZOOM,
      },
    },
    layers: [
      { id: "osm-tiles", type: "raster", source: "osm", minzoom: 0, maxzoom: LIVE_MAP_CARTO_STREET_MAX_ZOOM },
    ],
  });
}

/** MapLibre styles for Live Tab. Street = detailed OSM raster; clean = simplified vector style. */
export function getLiveMapLibreLayerStyles(): Record<LiveMapLayer, LiveMapStyle> {
  const detailedStreetStyle = buildDetailedStreetStyle();

  return {
    street: detailedStreetStyle,
    clean: OPENFREEMAP_STREET_STYLE_URL,
    satellite: withGlobeProjection({
      version: 8,
      sources: {
        esri: {
          type: "raster",
          tiles: [DEV_TILE_DEFAULTS.satellite.url],
          tileSize: 256,
          attribution: DEV_TILE_DEFAULTS.satellite.attribution,
          maxzoom: LIVE_MAP_ESRI_NATIVE_TILE_MAX_ZOOM,
        },
      },
      layers: [
        buildRasterBackgroundLayer(LIVE_MAP_RASTER_BG_OCEAN),
        { id: "esri-tiles", type: "raster", source: "esri", minzoom: 0, maxzoom: LIVE_MAP_ESRI_MAX_ZOOM },
      ],
    }),
    terrain: withGlobeProjection({
      version: 8,
      sources: {
        esri: {
          type: "raster",
          tiles: [DEV_TILE_DEFAULTS.terrain.url],
          tileSize: 256,
          attribution: DEV_TILE_DEFAULTS.terrain.attribution,
          maxzoom: LIVE_MAP_ESRI_NATIVE_TILE_MAX_ZOOM,
        },
      },
      layers: [
        buildRasterBackgroundLayer(LIVE_MAP_RASTER_BG_OCEAN),
        { id: "esri-topo-tiles", type: "raster", source: "esri", minzoom: 0, maxzoom: LIVE_MAP_ESRI_MAX_ZOOM },
      ],
    }),
    dark: withGlobeProjection({
      version: 8,
      sources: {
        carto: {
          type: "raster",
          tiles: [DEV_TILE_DEFAULTS.dark.url],
          tileSize: 256,
          attribution: DEV_TILE_DEFAULTS.dark.attribution,
          maxzoom: LIVE_MAP_DARK_MAX_ZOOM,
        },
      },
      layers: [
        { id: "carto-tiles", type: "raster", source: "carto", minzoom: 0, maxzoom: LIVE_MAP_DARK_MAX_ZOOM },
      ],
    }),
    hybrid: buildHybridStyle(detailedStreetStyle),
  };
}

/** Flat basemap for modal pickers — same production tile URLs as Live, without globe projection. */
export function getFlightPickerBasemapStyle(): LiveMapStyle {
  const tileUrls = resolveStreetRasterTileUrls();
  if (tileUrls.length === 0) {
    return OPENFREEMAP_STREET_STYLE_URL;
  }

  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: tileUrls,
        tileSize: 256,
        attribution: resolveStreetTileAttribution(),
        maxzoom: LIVE_MAP_CARTO_STREET_MAX_ZOOM,
      },
    },
    layers: [
      {
        id: "rovvy-flight-picker-bg",
        type: "background",
        paint: { "background-color": LIVE_MAP_RASTER_BG_LIGHT },
      },
      {
        id: "osm-tiles",
        type: "raster",
        source: "osm",
        minzoom: 0,
        maxzoom: LIVE_MAP_CARTO_STREET_MAX_ZOOM,
      },
    ],
  };
}

/** Client/build warning when production uses dev-only tile URLs. */
export function warnIfUnsafeProductionTiles(context = "map"): void {
  if (process.env.NODE_ENV !== "production") return;

  const streetUrl = resolveStreetTileUrl();
  if (!isValidRasterTileTemplate(streetUrl)) {
    console.warn(
      `[Rovvy Map/${context}] Street tile URL is invalid: ${streetUrl || "(empty)"}. ` +
        "Set NEXT_PUBLIC_MAP_TILE_URL to a raster template with {z}/{x}/{y}.",
    );
    return;
  }

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
  if (!isValidRasterTileTemplate(streetUrl)) {
    console.warn(
      "\n[Rovvy Map BUILD WARNING] NEXT_PUBLIC_MAP_TILE_URL is invalid or empty:\n" +
        `  ${streetUrl || "(empty)"}\n` +
        "  Use a raster template with {z}/{x}/{y}, e.g. https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png\n",
    );
    mapBuildWarningLogged = true;
    return;
  }

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
