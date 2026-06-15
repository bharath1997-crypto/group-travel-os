"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Activity,
  ArrowLeft,
  Clock,
  ExternalLink,
  Landmark,
  Loader2,
  MapPin,
  Martini,
  Minus,
  Navigation,
  Phone,
  Plus,
  Search,
  Target,
  Ticket,
  Trees,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";

import { type PlaceResult, useExploreMap } from "@/hooks/useExploreMap";

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const VIEWPORT_DEBOUNCE_MS = 600;

const RADIUS_PRESETS = [
  { label: "5 km",  m: 5_000 },
  { label: "15 km", m: 15_000 },
  { label: "30 km", m: 30_000 },
  { label: "50 km", m: 50_000 },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  restaurant:    "#E94560",
  nightlife:     "#7C3AED",
  park:          "#16A34A",
  landmark:      "#D97706",
  entertainment: "#0EA5E9",
  shopping:      "#EC4899",
  nature:        "#059669",
  trekking:      "#92400E",
  sports:        "#1D4ED8",
  activities:    "#059669",
  photo_spot:    "#D97706",
  gaming:        "#7C3AED",
  default:       "#64748B",
};

type FilterChip = {
  id: string;
  label: string;
  apiCategories: string[];
  Icon: LucideIcon;
};

type SearchResult = {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  type: "local" | "global";
};

const FILTER_CHIPS: FilterChip[] = [
  { id: "restaurants", label: "Restaurants", apiCategories: ["restaurant"],             Icon: Utensils  },
  { id: "parks",       label: "Parks",       apiCategories: ["park"],                   Icon: Trees     },
  { id: "nightlife",   label: "Nightlife",   apiCategories: ["nightlife"],              Icon: Martini   },
  { id: "landmarks",   label: "Landmarks",   apiCategories: ["landmark", "photo_spot"], Icon: Landmark  },
  { id: "activities",  label: "Activities",  apiCategories: ["activities", "sports"],   Icon: Activity  },
  { id: "events",      label: "Events",      apiCategories: ["entertainment"],          Icon: Ticket    },
];

function markerColor(category: string | null): string {
  if (!category) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

const FALLBACK_PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='72' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23F1F5F9'/%3E%3Cpath d='M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z' fill='%23CBD5E1'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%23F1F5F9'/%3E%3C/svg%3E";

const EMPTY_GEOJSON = { type: "FeatureCollection" as const, features: [] };

function formatAddress(addr: Record<string, string | null> | null): string {
  if (!addr) return "";
  const street   = [addr.house_number, addr.road ?? addr.street].filter(Boolean).join(" ");
  const city     = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
  const state    = addr.state ?? addr.region ?? "";
  const postcode = addr.postcode ?? addr.postal_code ?? "";
  return [street, city, state, postcode].filter(Boolean).join(", ");
}

function circleGeoJSON(center: { lat: number; lng: number }, radiusM: number, steps = 72) {
  const latRad = (center.lat * Math.PI) / 180;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dlat  = (radiusM * Math.sin(angle)) / 111_320;
    const dlng  = (radiusM * Math.cos(angle)) / (111_320 * Math.cos(latRad));
    coords.push([center.lng + dlng, center.lat + dlat]);
  }
  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      geometry: { type: "Polygon" as const, coordinates: [coords] },
      properties: {},
    }],
  };
}

function createGpsDot(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "rovvy-gps-wrap";
  const outer = document.createElement("div");
  outer.className = "rovvy-gps-outer";
  const inner = document.createElement("div");
  inner.className = "rovvy-gps-inner";
  wrap.appendChild(outer);
  wrap.appendChild(inner);
  return wrap;
}

function createRefPin(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "width:36px;height:36px;cursor:default;display:flex;align-items:flex-end;justify-content:center;";
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" fill="#E94560" stroke="white" stroke-width="1.5"/><circle cx="12" cy="10" r="2.5" fill="white"/></svg>`;
  return el;
}

function createSearchPin(label: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;";

  // Pulsing ring behind the pin
  const ring = document.createElement("div");
  ring.style.cssText = [
    "position:absolute;bottom:4px;left:50%;transform:translateX(-50%);",
    "width:36px;height:36px;border-radius:50%;",
    "background:rgba(15,118,110,0.18);",
    "animation:rovvy-search-ring 1.6s ease-out infinite;",
  ].join("");
  wrap.appendChild(ring);

  // Teal teardrop SVG
  const pin = document.createElement("div");
  pin.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="52" viewBox="0 0 30 42"><path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0z" fill="#0F766E" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/><circle cx="15" cy="15" r="6.5" fill="white"/></svg>`;
  wrap.appendChild(pin);

  // Label bubble above the pin
  if (label) {
    const bubble = document.createElement("div");
    bubble.style.cssText = [
      "position:absolute;bottom:56px;left:50%;transform:translateX(-50%);",
      "background:#0F766E;color:#fff;",
      "padding:4px 10px;border-radius:20px;",
      "font-size:12px;font-weight:600;white-space:nowrap;",
      "box-shadow:0 2px 8px rgba(0,0,0,0.22);",
      "pointer-events:none;",
      "max-width:200px;overflow:hidden;text-overflow:ellipsis;",
    ].join("");
    bubble.textContent = label.length > 28 ? label.slice(0, 26) + "…" : label;
    wrap.appendChild(bubble);
  }

  return wrap;
}

function placesToGeoJSON(places: PlaceResult[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] as [number, number] },
      properties: {
        id:            p.id,
        name:          p.name,
        category:      p.category,
        subcategory:   p.subcategory,
        lat:           p.lat,
        lng:           p.lng,
        address:       JSON.stringify(p.address || {}),
        website:       p.website       || "",
        phone:         p.phone         || "",
        opening_hours: p.opening_hours || "",
        photo_url:     p.photo_url     || "",
        source:        p.source,
        distance_m:    p.distance_m    ?? 0,
      },
    })),
  };
}

function pinDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42"><path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0z" fill="${color}"/><circle cx="15" cy="15" r="6.5" fill="white"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ─── Device search cache (localStorage, 24 h TTL, 10 entries max) ────────────

const CACHE_KEY = "rovvy_search_cache";
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface CacheEntry {
  query: string;
  lat: number;
  lng: number;
  name: string;
  timestamp: number;
}

function getCachedResult(query: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as CacheEntry[];
    const now = Date.now();
    return (
      cache.find(
        (e) =>
          e.query.toLowerCase() === query.toLowerCase() &&
          now - e.timestamp < CACHE_TTL,
      ) ?? null
    );
  } catch {
    return null;
  }
}

function saveCacheResult(
  query: string,
  lat: number,
  lng: number,
  name: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache: CacheEntry[] = raw ? (JSON.parse(raw) as CacheEntry[]) : [];
    const filtered = cache.filter(
      (e) => e.query.toLowerCase() !== query.toLowerCase(),
    );
    filtered.unshift({ query, lat, lng, name, timestamp: Date.now() });
    localStorage.setItem(CACHE_KEY, JSON.stringify(filtered.slice(0, 10)));
  } catch { /* storage full or SSR */ }
}

function clearSearchCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

// ─── Geocoding helpers (module-level, no React state) ────────────────────────

function logSearch(query: string, source: string, count: number): void {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("gt_token");
  if (!token) return;
  // Fire-and-forget — never await, never block UI
  // NEVER stores geocoding coordinate results — only logs query + source
  fetch("/api/v2/explorer/search/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, source, results_count: count }),
  }).catch(() => {});
}

function showToast(message: string): void {
  const t = document.createElement("div");
  t.style.cssText = [
    "position:fixed;bottom:120px;left:50%;transform:translateX(-50%);",
    "background:#1e293b;color:#fff;padding:10px 16px;border-radius:8px;",
    "font-size:13px;z-index:9999;max-width:300px;text-align:center;",
    "box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;",
  ].join("");
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ─────────────────────────────────────────────────────────────────────────────

export function ExploreMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs that mirror state for stable access inside map event closures
  const categoriesRef      = useRef<string[] | null>(null);
  const placesRef          = useRef<PlaceResult[]>([]);
  const hasActiveFilterRef = useRef(false);
  const pinModeRef         = useRef(false);
  const referencePointRef  = useRef<{ lat: number; lng: number } | null>(null);
  const radiusMRef         = useRef<number>(RADIUS_PRESETS[0].m);

  const gpsMarkerRef       = useRef<maplibregl.Marker | null>(null);
  const refPinMarkerRef    = useRef<maplibregl.Marker | null>(null);
  const searchMarkerRef    = useRef<maplibregl.Marker | null>(null);
  // Mirrors gpsLocation for stable use inside closures (avoids stale deps)
  const userLocationRef    = useRef<{ lat: number; lng: number } | null>(null);

  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);
  const [userCenter,      setUserCenter]      = useState(DEFAULT_CENTER);
  const [gpsLocation,     setGpsLocation]     = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace,   setSelectedPlace]   = useState<PlaceResult | null>(null);
  const [referencePoint,  setReferencePoint]  = useState<{ lat: number; lng: number } | null>(null);
  const [pinMode,         setPinMode]         = useState(false);
  const [radiusM,         setRadiusM]         = useState<number>(RADIUS_PRESETS[0].m);

  // ── Search bar state ────────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState("");
  const [searchResults,  setSearchResults]  = useState<SearchResult[]>([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [searchFocused,  setSearchFocused]  = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { places, loading, error, cached, total, fetchNearby, fetchViewport } = useExploreMap();
  placesRef.current = places;

  // ── Derive API categories from selected chips ───────────────────────────────
  const apiCategories = useMemo(() => {
    if (selectedChipIds.length === 0) return null;
    const values = new Set<string>();
    for (const chip of FILTER_CHIPS) {
      if (selectedChipIds.includes(chip.id)) chip.apiCategories.forEach((c) => values.add(c));
    }
    return values.size ? Array.from(values) : null;
  }, [selectedChipIds]);

  const hasActiveFilter = selectedChipIds.length > 0;

  const countLabel = useMemo(() => {
    if (!hasActiveFilter) return null;
    const chipName =
      selectedChipIds.length === 1
        ? (FILTER_CHIPS.find((c) => c.id === selectedChipIds[0])?.label ?? "Places")
        : "Places";
    return `${total} ${chipName}`;
  }, [hasActiveFilter, selectedChipIds, total]);

  // ── Sync state → refs ───────────────────────────────────────────────────────
  useEffect(() => { categoriesRef.current      = apiCategories;    }, [apiCategories]);
  useEffect(() => { hasActiveFilterRef.current = hasActiveFilter;  }, [hasActiveFilter]);
  useEffect(() => { pinModeRef.current         = pinMode;          }, [pinMode]);
  useEffect(() => { referencePointRef.current  = referencePoint;   }, [referencePoint]);
  useEffect(() => { radiusMRef.current         = radiusM;          }, [radiusM]);
  useEffect(() => { userLocationRef.current    = gpsLocation;      }, [gpsLocation]);

  // ── Search pin (stable ref, declared early so map-init effect can reference it) ──
  const dropSearchPin = useCallback((lat: number, lng: number, name: string) => {
    const map = mapRef.current;
    if (!map) return;
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = null;
    const el = document.createElement("div");
    el.style.cssText = "position:relative;text-align:center;cursor:pointer;";
    const label = name.split(",")[0] ?? name;
    el.innerHTML = `
      <div style="background:#0F766E;color:#fff;padding:4px 10px;border-radius:6px;
        font-size:12px;font-weight:500;white-space:nowrap;max-width:200px;overflow:hidden;
        text-overflow:ellipsis;margin-bottom:4px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">
        ${label}
      </div>
      <svg width="24" height="32" viewBox="0 0 24 32" style="display:block;margin:0 auto;">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20S24 21 24 12C24 5.4 18.6 0 12 0z"
          fill="#0F766E"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
      </svg>
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:16px;height:16px;border-radius:50%;background:rgba(15,118,110,0.25);
        animation:rovvy-pulse 1.5s ease-out infinite;"></div>
    `;
    searchMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);
  }, []);

  // ── Core fetch ──────────────────────────────────────────────────────────────
  const runFetch = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasActiveFilterRef.current) {
      const src = map.getSource("places") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(EMPTY_GEOJSON);
      return;
    }
    const categories = categoriesRef.current;
    const refPt      = referencePointRef.current;
    if (refPt) {
      void fetchNearby(refPt.lat, refPt.lng, radiusMRef.current, categories);
      return;
    }
    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    void fetchViewport(sw.lat, sw.lng, ne.lat, ne.lng, categories);
  }, [fetchNearby, fetchViewport]);

  const scheduleViewportFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runFetch, VIEWPORT_DEBOUNCE_MS);
  }, [runFetch]);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
      zoom: 4,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("moveend", () => {
      if (!hasActiveFilterRef.current || referencePointRef.current) return;
      scheduleViewportFetch();
    });

    let layerClickHandled = false;

    map.on("load", () => {
      map.resize();
      // Radius circle layers
      map.addSource("radius-circle", { type: "geojson", data: EMPTY_GEOJSON });
      map.addLayer({ id: "radius-fill",   type: "fill", source: "radius-circle", paint: { "fill-color": "#2563EB", "fill-opacity": 0.07 } });
      map.addLayer({ id: "radius-stroke", type: "line", source: "radius-circle", paint: { "line-color": "#2563EB", "line-width": 2, "line-dasharray": [4, 3], "line-opacity": 0.7 } });

      // Load pin images for every category, then add place layers
      const imagePromises = Object.entries(CATEGORY_COLORS).map(([cat, color]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            if (!map.hasImage(`pin-${cat}`)) map.addImage(`pin-${cat}`, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = pinDataUrl(color);
        })
      );

      void Promise.all(imagePromises).then(() => {
        map.addSource("places", {
          type: "geojson",
          data: EMPTY_GEOJSON,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        // Cluster circles
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#0F766E",
            "circle-radius": ["step", ["get", "point_count"], 20, 10, 30, 50, 40],
            "circle-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: { "text-field": "{point_count_abbreviated}", "text-size": 13, "text-font": ["Open Sans Semibold"] },
          paint: { "text-color": "#ffffff" },
        });

        // Individual place pins — teardrop SVG symbols
        map.addLayer({
          id: "unclustered-point",
          type: "symbol",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": [
              "match", ["get", "category"],
              "restaurant",    "pin-restaurant",
              "nightlife",     "pin-nightlife",
              "park",          "pin-park",
              "landmark",      "pin-landmark",
              "entertainment", "pin-entertainment",
              "shopping",      "pin-shopping",
              "nature",        "pin-nature",
              "trekking",      "pin-trekking",
              "sports",        "pin-sports",
              "activities",    "pin-activities",
              "photo_spot",    "pin-photo_spot",
              "gaming",        "pin-gaming",
              "pin-default",
            ],
            "icon-size": 1,
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });

        // Cluster click → zoom in
        map.on("click", "clusters", (e) => {
          layerClickHandled = true;
          const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
          if (!features.length) return;
          const clusterId = features[0].properties?.cluster_id as number;
          const geom = features[0].geometry;
          if (geom.type !== "Point") return;
          (map.getSource("places") as maplibregl.GeoJSONSource)
            .getClusterExpansionZoom(clusterId)
            .then((zoom) => map.easeTo({ center: geom.coordinates as [number, number], zoom }))
            .catch(() => {});
        });

        // Pin click → open detail card
        map.on("click", "unclustered-point", (e) => {
          layerClickHandled = true;
          const feature = e.features?.[0];
          if (!feature?.properties) return;
          const props = feature.properties as Record<string, unknown>;
          let addr: Record<string, string | null> | null = null;
          try { addr = JSON.parse(props.address as string || "{}") as Record<string, string | null>; } catch { addr = null; }
          setSelectedPlace({
            id:            String(props.id ?? ""),
            name:          String(props.name ?? ""),
            category:      (props.category as string) || null,
            subcategory:   (props.subcategory as string) || null,
            photo_url:     (props.photo_url as string) || null,
            distance_m:    props.distance_m != null ? Number(props.distance_m) : null,
            address:       addr,
            website:       (props.website as string) || null,
            phone:         (props.phone as string) || null,
            opening_hours: (props.opening_hours as string) || null,
            lat:           Number(props.lat ?? 0),
            lng:           Number(props.lng ?? 0),
            source:        String(props.source ?? ""),
          });
        });

        const setCursor = (cursor: string) => () => {
          if (!pinModeRef.current) map.getCanvas().style.cursor = cursor;
        };
        map.on("mouseenter", "clusters",          setCursor("pointer"));
        map.on("mouseleave", "clusters",          setCursor(""));
        map.on("mouseenter", "unclustered-point", setCursor("pointer"));
        map.on("mouseleave", "unclustered-point", setCursor(""));
      });
    });

    map.on("click", (e) => {
      if (pinModeRef.current) {
        setReferencePoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setPinMode(false);
        return;
      }
      if (!layerClickHandled) {
        setSelectedPlace(null);
        // Dismiss the search pin when user clicks an empty map area
        searchMarkerRef.current?.remove();
        searchMarkerRef.current = null;
      }
      layerClickHandled = false;
    });

    // Long-press to drop a manual search pin (800 ms hold)
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    const startPress = (lngLat: { lat: number; lng: number }) => {
      pressTimer = setTimeout(() => {
        dropSearchPin(lngLat.lat, lngLat.lng, "Custom location");
      }, 800);
    };
    const cancelPress = () => {
      if (pressTimer !== null) { clearTimeout(pressTimer); pressTimer = null; }
    };
    map.on("mousedown",  (e) => startPress(e.lngLat));
    map.on("mouseup",    cancelPress);
    map.on("mousemove",  cancelPress);
    map.on("touchstart", (e) => { if (e.points.length === 1) startPress(e.lngLat); });
    map.on("touchend",   cancelPress);
    map.on("touchmove",  cancelPress);

    mapRef.current = map;

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCenter({ lat, lng });
          setGpsLocation({ lat, lng });
          map.flyTo({ center: [lng, lat], zoom: 13, duration: 1000, essential: true });
        },
        () => { map.flyTo({ center: [-87.6298, 41.8781], zoom: 13, essential: true }); },
        { enableHighAccuracy: false, timeout: 5000 },
      );
    }

    // Window resize → force map recalculation (covers cases ResizeObserver misses)
    const onWindowResize = () => { mapRef.current?.resize(); };
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [fetchNearby, runFetch, scheduleViewportFetch, dropSearchPin]);

  // ── ResizeObserver: tell MapLibre to recalculate whenever the container grows ──
  useEffect(() => {
    const el = mapContainer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Update GeoJSON source when places change ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("places") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(places.length > 0 ? placesToGeoJSON(places) : EMPTY_GEOJSON);
  }, [places]);

  // ── GPS blue dot marker ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gpsLocation) return;
    if (!gpsMarkerRef.current) {
      gpsMarkerRef.current = new maplibregl.Marker({ element: createGpsDot(), anchor: "center" })
        .setLngLat([gpsLocation.lng, gpsLocation.lat])
        .addTo(map);
    } else {
      gpsMarkerRef.current.setLngLat([gpsLocation.lng, gpsLocation.lat]);
    }
  }, [gpsLocation]);

  // ── Reference pin marker + fetch ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!referencePoint) {
      refPinMarkerRef.current?.remove();
      refPinMarkerRef.current = null;
      return;
    }
    if (!refPinMarkerRef.current) {
      refPinMarkerRef.current = new maplibregl.Marker({ element: createRefPin(), anchor: "bottom" })
        .setLngLat([referencePoint.lng, referencePoint.lat])
        .addTo(map);
    } else {
      refPinMarkerRef.current.setLngLat([referencePoint.lng, referencePoint.lat]);
    }
    map.flyTo({ center: [referencePoint.lng, referencePoint.lat], zoom: 12, essential: true });
    runFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referencePoint]);

  // ── Radius circle update ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("radius-circle") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(referencePoint ? circleGeoJSON(referencePoint, radiusM) : EMPTY_GEOJSON);
  }, [referencePoint, radiusM]);

  // ── Pin-mode cursor ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = pinMode ? "crosshair" : "";
  }, [pinMode]);

  // ── Re-fetch when category or radius changes ────────────────────────────────
  useEffect(() => { runFetch(); }, [apiCategories, runFetch, radiusM]);

  // ── Search handlers ──────────────────────────────────────────────────────────
  const runSearch = useCallback(async (query: string) => {
    if (query.length < 3) { setSearchResults([]); return; }
    const q = query.toLowerCase();

    // Layer 1 — local places already loaded in state
    const localMatches: SearchResult[] = placesRef.current
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((p) => ({
        id:       `local-${p.id}`,
        name:     p.name,
        subtitle: [p.category, p.subcategory].filter(Boolean).join(" · ") || "Saved place",
        lat:      p.lat,
        lng:      p.lng,
        type:     "local" as const,
      }));

    setSearchResults(localMatches);
    setSearchLoading(true);

    try {
      // Layer 2 — Nominatim free geocoding (viewbox biases toward current viewport, bounded=0 keeps global results)
      const mapBounds = mapRef.current?.getBounds();
      const viewboxParam = mapBounds
        ? `&viewbox=${mapBounds.getWest()},${mapBounds.getNorth()},${mapBounds.getEast()},${mapBounds.getSouth()}&bounded=0`
        : "";
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=0${viewboxParam}`,
        { headers: { "Accept-Language": "en" } },
      );
      if (!res.ok) throw new Error("nominatim");
      const data = (await res.json()) as Array<{
        place_id: number;
        display_name: string;
        lat: string;
        lon: string;
      }>;
      const globalMatches: SearchResult[] = data.map((item) => {
        const parts = item.display_name.split(",");
        return {
          id:       `global-${item.place_id}`,
          name:     parts[0]?.trim() ?? item.display_name,
          subtitle: parts.slice(1, 3).map((s) => s.trim()).filter(Boolean).join(", "),
          lat:      parseFloat(item.lat),
          lng:      parseFloat(item.lon),
          type:     "global" as const,
        };
      });
      setSearchResults([...localMatches, ...globalMatches]);
    } catch {
      /* keep local results */
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // ── Geocoding waterfall (fires on Enter) ────────────────────────────────────
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !mapRef.current) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("gt_token") : null;
    const userLat = userLocationRef.current?.lat;
    const userLng = userLocationRef.current?.lng;

    // Step 0: Device cache (localStorage, 24 h TTL)
    const cached = getCachedResult(query);
    if (cached) {
      dropSearchPin(cached.lat, cached.lng, cached.name);
      mapRef.current.flyTo({ center: [cached.lng, cached.lat], zoom: 14, duration: 1000 });
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    // Step 1: Rovvy DB (3 s timeout)
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      const latParam = userLat != null ? `&lat=${userLat}&lng=${userLng}` : "";
      const res = await fetch(
        `/api/v2/explorer/search?q=${encodeURIComponent(query)}&limit=10${latParam}`,
        { headers: { Authorization: `Bearer ${token ?? ""}` }, signal: controller.signal },
      );
      clearTimeout(t);
      if (res.ok) {
        const data = (await res.json()) as Array<{ lat: number; lng: number; name: string }>;
        if (data.length > 0) {
          const src = mapRef.current?.getSource("places") as maplibregl.GeoJSONSource | undefined;
          src?.setData(placesToGeoJSON(data as Parameters<typeof placesToGeoJSON>[0]));
          mapRef.current?.flyTo({ center: [data[0].lng, data[0].lat], zoom: 14, duration: 1000 });
          logSearch(query, "rovvy_db", data.length);
          saveCacheResult(query, data[0].lat, data[0].lng, data[0].name);
          setSearchQuery("");
          setSearchResults([]);
          return;
        }
      }
    } catch { /* timeout or network — fall through */ }

    // Step 2: Photon (OSM, free unlimited, no key)
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const biasParam = userLat != null ? `&lat=${userLat}&lon=${userLng}` : "";
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1${biasParam}`,
        { signal: controller.signal },
      );
      clearTimeout(t);
      const data = (await res.json()) as {
        features?: Array<{
          geometry: { coordinates: [number, number] };
          properties: { name?: string; city?: string };
        }>;
      };
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        const name =
          data.features[0].properties.name ??
          data.features[0].properties.city ??
          query;
        dropSearchPin(lat, lng, name);
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
        logSearch(query, "photon", 1);
        saveCacheResult(query, lat, lng, name);
        setSearchQuery("");
        setSearchResults([]);
        return;
      }
    } catch { /* timeout or network — fall through */ }

    // Step 3: Check remaining paid API budget
    let remaining = 5;
    try {
      const res = await fetch("/api/v2/explorer/search/external-calls-remaining", {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { remaining: number };
        remaining = data.remaining;
      }
    } catch { /* ignore */ }

    if (remaining <= 0) {
      showToast("Daily search limit reached. Try a nearby city or landmark.");
      return;
    }

    // Step 4: Geoapify (3000/day free, no card)
    const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
    if (GEOAPIFY_KEY) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const biasParam =
          userLat != null ? `&bias=proximity:${userLng},${userLat}` : "";
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}&limit=1${biasParam}`,
          { signal: controller.signal },
        );
        clearTimeout(t);
        const data = (await res.json()) as {
          features?: Array<{
            geometry: { coordinates: [number, number] };
            properties: { formatted?: string };
          }>;
        };
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].geometry.coordinates;
          const name = data.features[0].properties.formatted ?? query;
          dropSearchPin(lat, lng, name);
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
          logSearch(query, "geoapify", 1);
          saveCacheResult(query, lat, lng, name);
          setSearchQuery("");
          setSearchResults([]);
          return;
        }
      } catch { /* timeout or network — fall through */ }
    }

    // Step 5: OpenCage (2500/day free, no card)
    const OPENCAGE_KEY = process.env.NEXT_PUBLIC_OPENCAGE_KEY;
    if (OPENCAGE_KEY) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_KEY}&limit=1&no_annotations=1`,
          { signal: controller.signal },
        );
        clearTimeout(t);
        const data = (await res.json()) as {
          results?: Array<{
            geometry: { lat: number; lng: number };
            formatted?: string;
          }>;
        };
        if (data.results && data.results.length > 0) {
          const { lat, lng } = data.results[0].geometry;
          const name = data.results[0].formatted ?? query;
          dropSearchPin(lat, lng, name);
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
          logSearch(query, "opencage", 1);
          saveCacheResult(query, lat, lng, name);
          setSearchQuery("");
          setSearchResults([]);
          return;
        }
      } catch { /* timeout or network — fall through */ }
    }

    // Step 6: All sources exhausted
    showToast(
      "Couldn't find that location. Try a nearby city or long-press the map to drop a pin.",
    );
    logSearch(query, "failed", 0);
  }, [dropSearchPin]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => void runSearch(val), 400);
  };

  const removeSearchPin = () => {
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = null;
  };

  const handleSearchSelect = (result: SearchResult) => {
    dropSearchPin(result.lat, result.lng, result.name);
    mapRef.current?.flyTo({
      center: [result.lng, result.lat],
      zoom: 16,
      duration: 1000,
      essential: true,
      pitch: 0,
    });
    setSearchQuery("");
    setSearchResults([]);
    setSearchFocused(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    removeSearchPin();
  };

  // ── UI handlers ─────────────────────────────────────────────────────────────
  const toggleChip = (chipId: string) => {
    setSelectedChipIds((prev) =>
      prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]
    );
  };

  const handleGeolocate = () => {
    const map = mapRef.current;
    if (!map) return;
    setReferencePoint(null);
    map.flyTo({ center: [userCenter.lng, userCenter.lat], zoom: 13, essential: true });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", flex: 1, width: "100%", minHeight: 480, overflow: "hidden" }}>

      {/* CSS: GPS dot animation + card slide-in */}
      <style>{`
        @keyframes rovvy-gps-pulse {
          0%   { transform: scale(1);   opacity: 0.75; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        .rovvy-gps-wrap  { position:relative; width:20px; height:20px; display:flex; align-items:center; justify-content:center; }
        .rovvy-gps-outer { position:absolute; width:20px; height:20px; border-radius:50%; background:rgba(37,99,235,0.35); animation:rovvy-gps-pulse 2s ease-out infinite; }
        .rovvy-gps-inner { position:relative; width:13px; height:13px; background:#2563EB; border-radius:50%; border:2.5px solid #fff; box-shadow:0 0 0 3px rgba(37,99,235,0.2),0 2px 6px rgba(37,99,235,0.5); z-index:1; }
        @keyframes rovvy-card-in {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes rovvy-search-ring {
          0%   { transform:translateX(-50%) scale(1);   opacity:0.7; }
          100% { transform:translateX(-50%) scale(2.8); opacity:0; }
        }
        @keyframes rovvy-pulse {
          0%   { transform:translateX(-50%) scale(1); opacity:0.6; }
          100% { transform:translateX(-50%) scale(3); opacity:0; }
        }
      `}</style>

      {/* Map canvas fills the entire positioned parent via absolute inset */}
      <div ref={mapContainer} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        {/* ── Search bar ── */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          width: "clamp(260px, 38vw, 480px)",
          zIndex: 1010,
        }}>
          {/* Input pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fff", borderRadius: 9999,
            border: "1px solid #E2E8F0",
            boxShadow: "0 4px 24px rgba(0,0,0,0.14)",
            padding: "0 clamp(12px, 1.2vw, 18px)",
            height: "clamp(44px, 3.2vw, 54px)",
          }}>
            <Search size={16} style={{ color: "#94A3B8", flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearchFocused(false);
                  void handleSearch(searchQuery);
                }
              }}
              placeholder="Search places, cities, addresses…"
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontSize: "clamp(13px, 1.05vw, 15px)", color: "#0F172A",
              }}
            />
            {searchLoading && <Loader2 size={15} style={{ color: "#0F766E", flexShrink: 0 }} className="animate-spin" />}
            {searchQuery && !searchLoading && (
              <button
                type="button"
                onClick={clearSearch}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#E2E8F0", border: "none", cursor: "pointer", flexShrink: 0,
                  color: "#64748B",
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Results dropdown */}
          {searchFocused && searchResults.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
              background: "#fff", borderRadius: 16,
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
              maxHeight: 300, overflowY: "auto",
              padding: "6px 0",
              zIndex: 1020,
            }}>
              {searchResults.map((result, idx) => (
                <button
                  key={result.id}
                  type="button"
                  onMouseDown={() => handleSearchSelect(result)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "clamp(8px,0.7vw,12px) clamp(12px,1vw,16px)",
                    background: "none", border: "none", cursor: "pointer",
                    textAlign: "left",
                    borderBottom: idx < searchResults.length - 1 ? "1px solid #F8FAFC" : "none",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  <div style={{
                    width: "clamp(30px,2.2vw,38px)", height: "clamp(30px,2.2vw,38px)",
                    borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: result.type === "local" ? "#F0FDF4" : "#F8FAFC",
                  }}>
                    <MapPin
                      size={15}
                      style={{ color: result.type === "local" ? "#16A34A" : "#94A3B8" }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "clamp(12px,1vw,14px)", fontWeight: 600, color: "#0F172A",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {result.name}
                    </div>
                    {result.subtitle && (
                      <div style={{
                        fontSize: "clamp(10px,0.85vw,12px)", color: "#94A3B8", marginTop: 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  {result.type === "local" && (
                    <span style={{
                      fontSize: "clamp(9px,0.75vw,11px)", fontWeight: 700, color: "#16A34A",
                      background: "#F0FDF4", borderRadius: 10, padding: "2px 7px",
                      flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      saved
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Empty state when focused + typed but no results */}
          {searchFocused && searchQuery.length >= 3 && !searchLoading && searchResults.length === 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
              background: "#fff", borderRadius: 16,
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
              padding: "20px 14px", textAlign: "center",
              zIndex: 1020,
            }}>
              <div style={{ fontSize: 13, color: "#94A3B8" }}>No results for &ldquo;{searchQuery}&rdquo;</div>
            </div>
          )}
        </div>

        {/* ── Top: back button + filter chips ── */}
        <div style={{
          position: "absolute", top: 68, left: 12, right: 60,
          display: "flex", alignItems: "center", gap: 8, zIndex: 10,
          pointerEvents: "none",
        }}>
          <Link
            href="/explore"
            aria-label="Back"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "clamp(34px,2.6vw,42px)", height: "clamp(34px,2.6vw,42px)",
              borderRadius: 10, flexShrink: 0,
              border: "1px solid #E2E8F0", background: "#fff",
              color: "#475569", textDecoration: "none",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              pointerEvents: "auto",
            }}
          >
            <ArrowLeft size={16} />
          </Link>

          {/* Scrollable chip row */}
          <div style={{
            display: "flex", gap: "clamp(4px,0.5vw,8px)", overflowX: "auto", paddingBottom: 2,
            pointerEvents: "auto",
            scrollbarWidth: "none",
          }}>
            {FILTER_CHIPS.map((chip) => {
              const active = selectedChipIds.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleChip(chip.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    whiteSpace: "nowrap",
                    padding: "clamp(6px,0.55vw,9px) clamp(11px,1vw,16px)",
                    borderRadius: 20,
                    border: `1px solid ${active ? "#E94560" : "#E2E8F0"}`,
                    fontSize: "clamp(12px,0.9vw,14px)", fontWeight: 600,
                    cursor: "pointer", flexShrink: 0,
                    background: active ? "#E94560" : "#fff",
                    color: active ? "#fff" : "#475569",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                    transition: "all 0.15s",
                  }}
                >
                  <chip.Icon size={13} />
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Result count badge */}
          {hasActiveFilter && !loading && countLabel && (
            <div style={{
              flexShrink: 0, whiteSpace: "nowrap",
              background: "rgba(15,118,110,0.92)", color: "#fff",
              borderRadius: 20, padding: "clamp(5px,0.45vw,8px) clamp(10px,0.9vw,14px)",
              fontSize: "clamp(11px,0.85vw,13px)", fontWeight: 600,
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              pointerEvents: "auto",
            }}>
              {countLabel}
              {cached ? " ·" : ""}
            </div>
          )}
        </div>

        {/* ── Reference pin controls (floating below chips) ── */}
        {referencePoint && (
          <div style={{
            position: "absolute", top: 128, left: 12, zIndex: 10,
            background: "#fff", border: "1px solid #FEE2E8",
            borderRadius: 12, padding: "8px 12px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            minWidth: 260,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#E94560", display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={12} /> Reference pin active
              </span>
              <button
                type="button"
                onClick={() => setReferencePoint(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#E94560", display: "flex", alignItems: "center", gap: 3 }}
              >
                <X size={12} /> Clear
              </button>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {RADIUS_PRESETS.map((preset) => (
                <button
                  key={preset.m}
                  type="button"
                  onClick={() => setRadiusM(preset.m)}
                  style={{
                    padding: "4px 10px", borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: "1px solid",
                    background: radiusM === preset.m ? "#2563EB" : "#fff",
                    color: radiusM === preset.m ? "#fff" : "#64748B",
                    borderColor: radiusM === preset.m ? "#2563EB" : "#E2E8F0",
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom-left: pin mode button ── */}
        <div style={{ position: "absolute", bottom: 80, left: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
          <button
            type="button"
            onClick={() => setPinMode((v) => !v)}
            title={pinMode ? "Click the map to drop a pin" : "Drop a reference pin"}
            style={{
              width: "clamp(34px,2.6vw,42px)", height: "clamp(34px,2.6vw,42px)",
              borderRadius: 10, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${pinMode ? "#E94560" : "#E2E8F0"}`,
              background: pinMode ? "#E94560" : "#fff",
              color: pinMode ? "#fff" : "#475569",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }}
          >
            <Target size={16} />
          </button>
        </div>

        {/* ── Top-right controls: zoom + GPS ── */}
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 10 }}>
          {[
            { onClick: () => mapRef.current?.zoomIn(),  icon: <Plus size={16} />,       label: "Zoom in",      active: false },
            { onClick: () => mapRef.current?.zoomOut(), icon: <Minus size={16} />,      label: "Zoom out",     active: false },
            { onClick: handleGeolocate,                 icon: <Navigation size={16} />, label: "My location",  active: !!gpsLocation },
          ].map(({ onClick, icon, label, active }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              aria-label={label}
              style={{
                width: "clamp(34px,2.6vw,42px)", height: "clamp(34px,2.6vw,42px)",
                borderRadius: 10, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${active ? "#2563EB" : "#E2E8F0"}`,
                background: active ? "#2563EB" : "#fff",
                color: active ? "#fff" : "#475569",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* ── Pin-mode hint banner ── */}
        {pinMode && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            background: "#E94560", color: "#fff",
            borderRadius: 20, padding: "8px 20px",
            fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            boxShadow: "0 2px 12px rgba(233,69,96,0.4)",
            zIndex: 10, pointerEvents: "none",
          }}>
            Click anywhere on the map to drop a reference pin
          </div>
        )}

        {/* ── Loading spinner ── */}
        {loading && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 30 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", border: "1px solid #E2E8F0",
              borderRadius: 24, padding: "9px 18px",
              fontSize: 13, fontWeight: 500, color: "#475569",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            }}>
              <Loader2 size={16} style={{ color: "#0F766E" }} className="animate-spin" />
              Searching…
            </div>
          </div>
        )}

        {/* ── Error toast ── */}
        {error && (
          <div style={{
            position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "#fff", border: "1px solid #FECACA", borderRadius: 10,
            padding: "8px 16px", fontSize: 12, color: "#DC2626",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 30, whiteSpace: "nowrap",
          }}>
            {error}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            DETAIL CARD — Google Maps style, floats bottom-right of map
        ════════════════════════════════════════════════════════════════ */}
        {selectedPlace && (
          <div style={{
            position: "absolute", bottom: 24, right: 16,
            width: "clamp(300px, 24vw, 400px)", maxHeight: "calc(100% - 56px)",
            background: "#fff", borderRadius: 16,
            boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
            zIndex: 100, display: "flex", flexDirection: "column",
            overflow: "hidden",
            animation: "rovvy-card-in 0.22s ease",
          }}>
            {/* Hero image */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={selectedPlace.photo_url ?? FALLBACK_PHOTO}
                alt={selectedPlace.name}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_PHOTO; }}
                style={{ width: "100%", height: 180, objectFit: "cover", display: "block", background: "#F1F5F9" }}
              />
              <button
                type="button"
                onClick={() => setSelectedPlace(null)}
                style={{
                  position: "absolute", top: 10, right: 10,
                  width: 30, height: 30, borderRadius: "50%",
                  background: "rgba(0,0,0,0.52)", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Card body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 16px" }}>

              {/* Name */}
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", lineHeight: 1.3, marginBottom: 6 }}>
                {selectedPlace.name}
              </div>

              {/* Category badges */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {selectedPlace.category && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                    color: markerColor(selectedPlace.category),
                    background: `${markerColor(selectedPlace.category)}18`,
                    borderRadius: 14, padding: "2px 10px",
                  }}>
                    {selectedPlace.category}
                  </span>
                )}
                {selectedPlace.subcategory && (
                  <span style={{ fontSize: 12, color: "#94A3B8", textTransform: "capitalize" }}>
                    {selectedPlace.subcategory}
                  </span>
                )}
              </div>

              <div style={{ height: 1, background: "#F1F5F9", marginBottom: 12 }} />

              {/* Address */}
              {formatAddress(selectedPlace.address) && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#475569", marginBottom: 10 }}>
                  <MapPin size={14} style={{ marginTop: 1, flexShrink: 0, color: "#94A3B8" }} />
                  <span>{formatAddress(selectedPlace.address)}</span>
                </div>
              )}

              {/* Phone */}
              {selectedPlace.phone && (
                <a
                  href={`tel:${selectedPlace.phone}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#2563EB", textDecoration: "none", marginBottom: 10 }}
                >
                  <Phone size={14} style={{ flexShrink: 0 }} />
                  {selectedPlace.phone}
                </a>
              )}

              {/* Opening hours */}
              {selectedPlace.opening_hours && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569", marginBottom: 10 }}>
                  <Clock size={14} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedPlace.opening_hours}
                  </span>
                </div>
              )}

              {/* Distance */}
              {selectedPlace.distance_m != null && selectedPlace.distance_m > 0 && (
                <div style={{ fontSize: 13, color: "#0F766E", fontWeight: 500, marginBottom: 12 }}>
                  {(selectedPlace.distance_m / 1609.34).toFixed(1)} mi away{referencePoint ? " from pin" : ""}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.lat},${selectedPlace.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 16px", background: "#0F766E", color: "#fff",
                    borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none",
                  }}
                >
                  <Navigation size={13} /> Directions
                </a>
                {selectedPlace.website && (
                  <a
                    href={selectedPlace.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "9px 16px", background: "#F1F5F9", color: "#0F172A",
                      border: "1px solid #E2E8F0", borderRadius: 10,
                      fontSize: 13, fontWeight: 600, textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={13} /> Website
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
