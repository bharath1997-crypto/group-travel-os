"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Activity,
  ArrowLeft,
  Landmark,
  LayoutGrid,
  Loader2,
  MapPin,
  Martini,
  Minus,
  Navigation,
  Plus,
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

// Backend hard limit is 50 000 m — all presets must stay at or below this.
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

// No "All" chip — empty selection = empty map (like Google Maps)
const FILTER_CHIPS: FilterChip[] = [
  { id: "restaurants", label: "Restaurants", apiCategories: ["restaurant"],              Icon: Utensils },
  { id: "parks",       label: "Parks",       apiCategories: ["park"],                    Icon: Trees },
  { id: "nightlife",   label: "Nightlife",   apiCategories: ["nightlife"],               Icon: Martini },
  { id: "landmarks",   label: "Landmarks",   apiCategories: ["landmark", "photo_spot"],  Icon: Landmark },
  { id: "activities",  label: "Activities",  apiCategories: ["activities", "sports"],    Icon: Activity },
  { id: "events",      label: "Events",      apiCategories: ["entertainment"],           Icon: Ticket },
];

function markerColor(category: string | null): string {
  if (!category) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

const FALLBACK_PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='12' fill='%23F1F5F9'/%3E%3Cpath d='M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z' fill='%23CBD5E1'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%23F1F5F9'/%3E%3C/svg%3E";

const EMPTY_GEOJSON = { type: "FeatureCollection" as const, features: [] };

// ── Circle polygon GeoJSON ────────────────────────────────────────────────────
function circleGeoJSON(
  center: { lat: number; lng: number },
  radiusM: number,
  steps = 72,
) {
  const latRad = (center.lat * Math.PI) / 180;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dlat = (radiusM * Math.sin(angle)) / 111_320;
    const dlng  = (radiusM * Math.cos(angle)) / (111_320 * Math.cos(latRad));
    coords.push([center.lng + dlng, center.lat + dlat]);
  }
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [coords] },
        properties: {},
      },
    ],
  };
}

// ── Animated GPS dot ──────────────────────────────────────────────────────────
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

// ── Reference pin marker ──────────────────────────────────────────────────────
function createRefPin(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:36px;height:36px;cursor:default;display:flex;align-items:flex-end;justify-content:center;";
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" fill="#E94560" stroke="white" stroke-width="1.5"/><circle cx="12" cy="10" r="2.5" fill="white"/></svg>`;
  return el;
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
        address:       JSON.stringify(p.address),
        website:       p.website ?? null,
        phone:         p.phone ?? null,
        opening_hours: p.opening_hours ?? null,
        photo_url:     p.photo_url ?? null,
        source:        p.source,
        distance_m:    p.distance_m ?? null,
      },
    })),
  };
}

function propsToPlace(props: Record<string, unknown>): PlaceResult {
  return {
    id:            String(props.id ?? ""),
    name:          String(props.name ?? ""),
    category:      (props.category as string | null) ?? null,
    subcategory:   (props.subcategory as string | null) ?? null,
    lat:           Number(props.lat ?? 0),
    lng:           Number(props.lng ?? 0),
    address:       JSON.parse(typeof props.address === "string" ? props.address : "null") as Record<string, string | null> | null,
    website:       (props.website as string | null) || null,
    phone:         (props.phone as string | null) || null,
    opening_hours: (props.opening_hours as string | null) || null,
    photo_url:     (props.photo_url as string | null) || null,
    source:        String(props.source ?? ""),
    distance_m:    props.distance_m != null && props.distance_m !== "" ? Number(props.distance_m) : null,
  };
}

export function ExploreMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs that mirror state — safe to read inside map event closures
  const categoriesRef       = useRef<string[] | null>(null);
  const placesRef           = useRef<PlaceResult[]>([]);
  const hasActiveFilterRef  = useRef(false);
  const pinModeRef          = useRef(false);
  const referencePointRef   = useRef<{ lat: number; lng: number } | null>(null);
  const radiusMRef          = useRef<number>(RADIUS_PRESETS[0].m);

  // Marker instances
  const gpsMarkerRef    = useRef<maplibregl.Marker | null>(null);
  const refPinMarkerRef = useRef<maplibregl.Marker | null>(null);

  // State
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);
  const [userCenter,   setUserCenter]   = useState(DEFAULT_CENTER);
  const [gpsLocation,  setGpsLocation]  = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [referencePoint, setReferencePoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pinMode,   setPinMode]   = useState(false);
  const [radiusM,   setRadiusM]   = useState<number>(RADIUS_PRESETS[0].m);

  const { places, loading, error, cached, total, fetchNearby, fetchViewport } = useExploreMap();

  placesRef.current = places;

  // ── Derive API categories from selected chips ─────────────────────────────
  const apiCategories = useMemo(() => {
    if (selectedChipIds.length === 0) return null;
    const values = new Set<string>();
    for (const chip of FILTER_CHIPS) {
      if (selectedChipIds.includes(chip.id)) {
        chip.apiCategories.forEach((c) => values.add(c));
      }
    }
    return values.size ? Array.from(values) : null;
  }, [selectedChipIds]);

  const hasActiveFilter = selectedChipIds.length > 0;

  // ── Human-readable count label ────────────────────────────────────────────
  const countLabel = useMemo(() => {
    if (!hasActiveFilter || loading) return null;
    const chipName =
      selectedChipIds.length === 1
        ? (FILTER_CHIPS.find((c) => c.id === selectedChipIds[0])?.label ?? "Places")
        : "Places";
    return `${total} ${chipName}`;
  }, [hasActiveFilter, loading, selectedChipIds, total]);

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => { categoriesRef.current = apiCategories; },       [apiCategories]);
  useEffect(() => { hasActiveFilterRef.current = hasActiveFilter; }, [hasActiveFilter]);
  useEffect(() => { pinModeRef.current = pinMode; },                 [pinMode]);
  useEffect(() => { referencePointRef.current = referencePoint; },   [referencePoint]);
  useEffect(() => { radiusMRef.current = radiusM; },                 [radiusM]);

  // ── Core fetch — never runs when no category is selected ─────────────────
  const runFetch = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasActiveFilterRef.current) {
      // Clear all markers without hitting the API
      const src = map.getSource("places") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(EMPTY_GEOJSON);
      return;
    }

    const categories = categoriesRef.current;
    const refPt      = referencePointRef.current;

    if (refPt) {
      // Reference pin set → nearby search from that pin
      void fetchNearby(refPt.lat, refPt.lng, radiusMRef.current, categories);
      return;
    }

    // Default: fetch whatever is currently in the viewport
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

  // ── Map init ──────────────────────────────────────────────────────────────
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
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("moveend", () => {
      // Only re-fetch when a category is active; skip if reference pin is set
      // (reference pin fetches are triggered by pin placement, not pan/zoom)
      if (!hasActiveFilterRef.current || referencePointRef.current) return;
      scheduleViewportFetch();
    });

    let layerClickHandled = false;

    map.on("load", () => {
      // Radius circle (rendered below place markers)
      map.addSource("radius-circle", { type: "geojson", data: EMPTY_GEOJSON });
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius-circle",
        paint: { "fill-color": "#2563EB", "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: "radius-stroke",
        type: "line",
        source: "radius-circle",
        paint: { "line-color": "#2563EB", "line-width": 2, "line-dasharray": [4, 3], "line-opacity": 0.7 },
      });

      // Places source
      map.addSource("places", {
        type: "geojson",
        data: EMPTY_GEOJSON,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "places",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0F766E",
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 30, 50, 40],
          "circle-opacity": 0.85,
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

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match", ["get", "category"],
            "restaurant",    "#E94560",
            "nightlife",     "#7C3AED",
            "park",          "#16A34A",
            "landmark",      "#D97706",
            "entertainment", "#0EA5E9",
            "shopping",      "#EC4899",
            "nature",        "#059669",
            "trekking",      "#92400E",
            "sports",        "#1D4ED8",
            "#64748B",
          ],
          "circle-radius": 10,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Click cluster → zoom in
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

      // Click point → open bottom sheet
      map.on("click", "unclustered-point", (e) => {
        layerClickHandled = true;
        const feature = e.features?.[0];
        if (!feature?.properties) return;
        setSelectedPlace(propsToPlace(feature.properties as Record<string, unknown>));
      });

      const setCursor = (cursor: string) => () => {
        if (!pinModeRef.current) map.getCanvas().style.cursor = cursor;
      };
      map.on("mouseenter", "clusters",           setCursor("pointer"));
      map.on("mouseleave", "clusters",           setCursor(""));
      map.on("mouseenter", "unclustered-point",  setCursor("pointer"));
      map.on("mouseleave", "unclustered-point",  setCursor(""));
    });

    // Map background click: drop reference pin or dismiss sheet
    map.on("click", (e) => {
      if (pinModeRef.current) {
        setReferencePoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setPinMode(false);
        return;
      }
      if (!layerClickHandled) setSelectedPlace(null);
      layerClickHandled = false;
    });

    mapRef.current = map;

    // Geolocation — center map only, no automatic data fetch
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCenter({ lat, lng });
          setGpsLocation({ lat, lng });
          // flyTo triggers moveend, which will fetch only if a chip is already active
          map.flyTo({ center: [lng, lat], zoom: 13, essential: true });
        },
        () => {
          map.flyTo({ center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat], zoom: 4, essential: true });
        },
        { enableHighAccuracy: false, timeout: 8000 },
      );
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [fetchNearby, runFetch, scheduleViewportFetch]);

  // ── Update GeoJSON source when places list changes ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("places") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(places.length > 0 ? placesToGeoJSON(places) : EMPTY_GEOJSON);
  }, [places]);

  // ── GPS blue dot marker ───────────────────────────────────────────────────
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

  // ── Reference pin marker + fetch ─────────────────────────────────────────
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

  // ── Radius circle update ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("radius-circle") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    // Only draw radius circle when a reference pin is active
    source.setData(referencePoint ? circleGeoJSON(referencePoint, radiusM) : EMPTY_GEOJSON);
  }, [referencePoint, radiusM]);

  // ── Pin-mode cursor ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = pinMode ? "crosshair" : "";
  }, [pinMode]);

  // ── Re-fetch when category selection or radius changes ───────────────────
  useEffect(() => {
    runFetch();
  }, [apiCategories, runFetch, radiusM]);

  // ── UI handlers ───────────────────────────────────────────────────────────
  const toggleChip = (chipId: string) => {
    setSelectedChipIds((prev) => {
      const isActive = prev.includes(chipId);
      return isActive ? prev.filter((id) => id !== chipId) : [...prev, chipId];
    });
  };

  const handleGeolocate = () => {
    const map = mapRef.current;
    if (!map) return;
    setReferencePoint(null);
    map.flyTo({ center: [userCenter.lng, userCenter.lat], zoom: 13, essential: true });
    // moveend → scheduleViewportFetch if chips are active
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full bg-slate-100"
      style={{ width: "100%", height: "calc(100dvh - 112px)", minHeight: "480px" }}
    >
      {/* GPS dot animation */}
      <style>{`
        @keyframes rovvy-gps-pulse {
          0%   { transform: scale(1);   opacity: 0.75; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        .rovvy-gps-wrap  { position:relative; width:20px; height:20px; display:flex; align-items:center; justify-content:center; }
        .rovvy-gps-outer { position:absolute; width:20px; height:20px; border-radius:50%; background:rgba(37,99,235,0.35); animation:rovvy-gps-pulse 2s ease-out infinite; }
        .rovvy-gps-inner { position:relative; width:13px; height:13px; background:#2563EB; border-radius:50%; border:2.5px solid #fff; box-shadow:0 0 0 3px rgba(37,99,235,0.2),0 2px 6px rgba(37,99,235,0.5); z-index:1; }
      `}</style>

      {/* Map canvas */}
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "calc(100dvh - 112px)", minHeight: "480px" }}
      />

      {/* ── Floating overlay ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">

        {/* Top bar */}
        <div className="flex items-start justify-between gap-2 p-3">
          {/* Left controls */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <Link
              href="/explore"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </Link>

            {/* Drop reference pin */}
            <button
              type="button"
              onClick={() => setPinMode((v) => !v)}
              title={pinMode ? "Click the map to drop a pin" : "Drop a reference pin"}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
                pinMode
                  ? "border-[#E94560] bg-[#E94560] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:text-[#E94560]"
              }`}
            >
              <Target size={16} />
            </button>

            {/* Reference pin badge */}
            {referencePoint && (
              <button
                type="button"
                onClick={() => setReferencePoint(null)}
                title="Clear reference pin"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E94560]/50 bg-white px-2 text-xs font-semibold text-[#E94560] shadow-sm hover:bg-[#E94560]/5"
              >
                <MapPin size={13} />
                <span>Ref pin</span>
                <X size={12} />
              </button>
            )}

            {/* Radius selector — only visible when reference pin is active */}
            {referencePoint && (
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1 shadow-sm">
                <span className="pl-1 pr-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  radius
                </span>
                {RADIUS_PRESETS.map((preset) => (
                  <button
                    key={preset.m}
                    type="button"
                    onClick={() => setRadiusM(preset.m)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      radiusM === preset.m
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right controls: zoom + GPS */}
          <div className="pointer-events-auto flex flex-col gap-1">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Zoom in"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Zoom out"
            >
              <Minus size={16} />
            </button>
            <button
              type="button"
              onClick={handleGeolocate}
              title="Go to my location"
              className={`flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition ${
                gpsLocation
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              aria-label="My location"
            >
              <Navigation size={16} />
            </button>
          </div>
        </div>

        {/* Pin-mode hint */}
        {pinMode && (
          <div className="pointer-events-none mx-auto mt-1 rounded-full bg-[#E94560] px-4 py-1.5 text-xs font-semibold text-white shadow-md">
            Click anywhere on the map to drop a reference pin
          </div>
        )}

        {/* Category chips + status row */}
        <div
          className="pointer-events-auto mt-auto p-3"
          style={{ paddingBottom: selectedPlace ? "196px" : undefined }}
        >
          {/* Count label — only visible when a category is active */}
          {countLabel && (
            <div className="mb-2 flex items-center gap-1.5">
              <span className="rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {loading ? "Searching…" : countLabel}
                {cached ? " · cached" : ""}
              </span>
            </div>
          )}

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map((chip) => {
              const active = selectedChipIds.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleChip(chip.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                    active
                      ? "border-[#E94560] bg-[#E94560] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#E94560]/40 hover:text-[#E94560]"
                  }`}
                >
                  <chip.Icon size={14} />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Empty-state hint — shown when no chips are selected */}
      {!hasActiveFilter && !loading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-6 py-5 text-center shadow-lg backdrop-blur-sm">
            <div className="mb-1 text-2xl">🗺️</div>
            <div className="text-sm font-semibold text-slate-700">
              Tap a category to discover places
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Restaurants · Parks · Nightlife · Landmarks&nbsp;…
            </div>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-md">
            <Loader2 size={16} className="animate-spin text-[#E94560]" />
            {selectedChipIds.length === 1
              ? `Loading ${FILTER_CHIPS.find((c) => c.id === selectedChipIds[0])?.label ?? "places"}…`
              : "Loading places…"}
          </div>
        </div>
      )}

      {hasActiveFilter && !loading && places.length === 0 && !error && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-md">
            No places found in this area
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-600 shadow-md">
          {error}
        </div>
      )}

      {/* ── Bottom sheet ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: "180px",
          background: "#fff",
          borderRadius: "16px 16px 0 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
          transform: selectedPlace ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s ease",
          padding: "16px",
          display: "flex",
          gap: "12px",
          zIndex: 100,
          overflow: "hidden",
        }}
      >
        {selectedPlace && (
          <>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setSelectedPlace(null)}
              style={{
                position: "absolute", top: 8, left: "50%",
                transform: "translateX(-50%)",
                width: 36, height: 4, borderRadius: 2,
                background: "#CBD5E1", border: "none", cursor: "pointer", padding: 0,
              }}
            />
            <img
              src={selectedPlace.photo_url ?? FALLBACK_PHOTO}
              alt={selectedPlace.name}
              style={{
                width: 120, height: 148, objectFit: "cover",
                borderRadius: 8, flexShrink: 0, marginTop: 12, background: "#F1F5F9",
              }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_PHOTO; }}
            />
            <div style={{ flex: 1, minWidth: 0, marginTop: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                {selectedPlace.name}
              </div>
              {selectedPlace.category && (
                <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: markerColor(selectedPlace.category), background: markerColor(selectedPlace.category) + "18", borderRadius: 20, padding: "2px 8px", marginBottom: 6, textTransform: "capitalize" }}>
                  {selectedPlace.category}
                </span>
              )}
              {selectedPlace.address?.city && (
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 2 }}>
                  {selectedPlace.address.city}
                </div>
              )}
              {selectedPlace.distance_m != null && (
                <div style={{ fontSize: 13, color: "#0F766E", marginBottom: 8 }}>
                  {(selectedPlace.distance_m / 1609).toFixed(1)} mi away{referencePoint ? " from pin" : ""}
                </div>
              )}
              {selectedPlace.website && (
                <a
                  href={selectedPlace.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-block", marginTop: 4, padding: "6px 14px", background: "#0F766E", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                >
                  Visit website
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
