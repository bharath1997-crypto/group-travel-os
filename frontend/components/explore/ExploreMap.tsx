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
  Map as MapIcon,
  Martini,
  Minus,
  Navigation,
  Plus,
  Ticket,
  Trees,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import { type PlaceResult, useExploreMap } from "@/hooks/useExploreMap";

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const NEARBY_RADIUS_M = 5000;
const VIEWPORT_DEBOUNCE_MS = 600;

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: "#E94560",
  nightlife: "#7C3AED",
  park: "#16A34A",
  landmark: "#D97706",
  entertainment: "#0EA5E9",
  shopping: "#EC4899",
  nature: "#059669",
  trekking: "#92400E",
  sports: "#1D4ED8",
  activities: "#059669",
  photo_spot: "#D97706",
  gaming: "#7C3AED",
  default: "#64748B",
};

type MapMode = "nearby" | "viewport";

type FilterChip = {
  id: string;
  label: string;
  apiCategories: string[] | null;
  Icon: LucideIcon;
};

const FILTER_CHIPS: FilterChip[] = [
  { id: "all", label: "All", apiCategories: null, Icon: LayoutGrid },
  { id: "events", label: "Events", apiCategories: ["entertainment"], Icon: Ticket },
  { id: "restaurants", label: "Restaurants", apiCategories: ["restaurant"], Icon: Utensils },
  { id: "parks", label: "Parks", apiCategories: ["park"], Icon: Trees },
  { id: "nightlife", label: "Nightlife", apiCategories: ["nightlife"], Icon: Martini },
  { id: "landmarks", label: "Landmarks", apiCategories: ["landmark", "photo_spot"], Icon: Landmark },
  { id: "activities", label: "Activities", apiCategories: ["activities", "sports"], Icon: Activity },
];

function markerColor(category: string | null): string {
  if (!category) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

const FALLBACK_PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='12' fill='%23F1F5F9'/%3E%3Cpath d='M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z' fill='%23CBD5E1'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%23F1F5F9'/%3E%3C/svg%3E";

function placesToGeoJSON(places: PlaceResult[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.map((p) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.lng, p.lat] as [number, number],
      },
      properties: {
        id: p.id,
        name: p.name,
        category: p.category,
        subcategory: p.subcategory,
        lat: p.lat,
        lng: p.lng,
        address: JSON.stringify(p.address),
        website: p.website ?? null,
        phone: p.phone ?? null,
        opening_hours: p.opening_hours ?? null,
        photo_url: p.photo_url ?? null,
        source: p.source,
        distance_m: p.distance_m ?? null,
      },
    })),
  };
}

function propsToPlace(props: Record<string, unknown>): PlaceResult {
  return {
    id: String(props.id ?? ""),
    name: String(props.name ?? ""),
    category: (props.category as string | null) ?? null,
    subcategory: (props.subcategory as string | null) ?? null,
    lat: Number(props.lat ?? 0),
    lng: Number(props.lng ?? 0),
    address: JSON.parse(
      typeof props.address === "string" ? props.address : "null",
    ) as Record<string, string | null> | null,
    website: (props.website as string | null) || null,
    phone: (props.phone as string | null) || null,
    opening_hours: (props.opening_hours as string | null) || null,
    photo_url: (props.photo_url as string | null) || null,
    source: String(props.source ?? ""),
    distance_m:
      props.distance_m != null && props.distance_m !== ""
        ? Number(props.distance_m)
        : null,
  };
}

export function ExploreMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef<MapMode>("viewport");
  const categoriesRef = useRef<string[] | null>(null);
  const placesRef = useRef<PlaceResult[]>([]);

  const [mode, setMode] = useState<MapMode>("viewport");
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>(["all"]);
  const [userCenter, setUserCenter] = useState(DEFAULT_CENTER);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);

  const { places, loading, error, cached, total, fetchNearby, fetchViewport } =
    useExploreMap();

  // Keep a ref in sync so the map load handler can access current places.
  placesRef.current = places;

  const apiCategories = useMemo(() => {
    if (selectedChipIds.includes("all") || selectedChipIds.length === 0) {
      return null;
    }
    const values = new Set<string>();
    for (const chip of FILTER_CHIPS) {
      if (selectedChipIds.includes(chip.id) && chip.apiCategories) {
        chip.apiCategories.forEach((c) => values.add(c));
      }
    }
    return values.size ? Array.from(values) : null;
  }, [selectedChipIds]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    categoriesRef.current = apiCategories;
  }, [apiCategories]);

  const runFetch = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const categories = categoriesRef.current;
    if (modeRef.current === "nearby") {
      const center = map.getCenter();
      void fetchNearby(center.lat, center.lng, NEARBY_RADIUS_M, categories);
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
    debounceRef.current = setTimeout(() => {
      runFetch();
    }, VIEWPORT_DEBOUNCE_MS);
  }, [runFetch]);

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        // Glyphs are required for the cluster-count symbol layer.
        glyphs:
          "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("moveend", () => {
      if (modeRef.current === "viewport") {
        scheduleViewportFetch();
      } else {
        runFetch();
      }
    });

    // Track whether a layer handled the current click so we don't dismiss
    // the bottom sheet immediately after opening it.
    let layerClickHandled = false;

    map.on("load", () => {
      // ── GeoJSON source with built-in clustering ──────────────────────────
      map.addSource("places", {
        type: "geojson",
        data: placesToGeoJSON(placesRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Cluster bubble
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "places",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0F766E",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            10,
            30,
            50,
            40,
          ],
          "circle-opacity": 0.85,
        },
      });

      // Cluster count label
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "places",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 13,
          "text-font": ["Open Sans Semibold"],
        },
        paint: { "text-color": "#ffffff" },
      });

      // Single-place circles
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "category"],
            "restaurant",   "#E94560",
            "nightlife",    "#7C3AED",
            "park",         "#16A34A",
            "landmark",     "#D97706",
            "entertainment","#0EA5E9",
            "shopping",     "#EC4899",
            "nature",       "#059669",
            "trekking",     "#92400E",
            "sports",       "#1D4ED8",
            /* default */   "#64748B",
          ],
          "circle-radius": 10,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // ── Click: cluster → zoom to expand ─────────────────────────────────
      map.on("click", "clusters", (e) => {
        layerClickHandled = true;
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id as number;
        const geom = features[0].geometry;
        if (geom.type !== "Point") return;
        const coords = geom.coordinates as [number, number];
        (map.getSource("places") as maplibregl.GeoJSONSource)
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            map.easeTo({ center: coords, zoom });
          })
          .catch(() => {});
      });

      // ── Click: individual point → open bottom sheet ──────────────────────
      map.on("click", "unclustered-point", (e) => {
        layerClickHandled = true;
        const feature = e.features?.[0];
        if (!feature?.properties) return;
        setSelectedPlace(
          propsToPlace(feature.properties as Record<string, unknown>),
        );
      });

      // ── Cursor pointer on hover ──────────────────────────────────────────
      const setCursor = (cursor: string) => () => {
        map.getCanvas().style.cursor = cursor;
      };
      map.on("mouseenter", "clusters",          setCursor("pointer"));
      map.on("mouseleave", "clusters",          setCursor(""));
      map.on("mouseenter", "unclustered-point", setCursor("pointer"));
      map.on("mouseleave", "unclustered-point", setCursor(""));
    });

    // ── Click on map background → dismiss bottom sheet ───────────────────
    map.on("click", () => {
      if (!layerClickHandled) setSelectedPlace(null);
      layerClickHandled = false;
    });

    mapRef.current = map;

    // ── Geolocation / initial fetch ──────────────────────────────────────
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCenter({ lat, lng });
          map.flyTo({ center: [lng, lat], zoom: 13, essential: true });
          void fetchNearby(lat, lng, NEARBY_RADIUS_M, categoriesRef.current);
        },
        () => {
          map.flyTo({
            center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
            zoom: 4,
            essential: true,
          });
          void fetchNearby(
            DEFAULT_CENTER.lat,
            DEFAULT_CENTER.lng,
            NEARBY_RADIUS_M,
            categoriesRef.current,
          );
        },
        { enableHighAccuracy: false, timeout: 8000 },
      );
    } else {
      void fetchNearby(
        DEFAULT_CENTER.lat,
        DEFAULT_CENTER.lng,
        NEARBY_RADIUS_M,
        categoriesRef.current,
      );
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [fetchNearby, runFetch, scheduleViewportFetch]);

  // ── Update GeoJSON source whenever places change ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("places") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(placesToGeoJSON(places));
  }, [places]);

  useEffect(() => {
    runFetch();
  }, [apiCategories, mode, runFetch]);

  // ── UI handlers ───────────────────────────────────────────────────────────
  const toggleChip = (chipId: string) => {
    if (chipId === "all") {
      setSelectedChipIds(["all"]);
      return;
    }
    setSelectedChipIds((prev) => {
      const withoutAll = prev.filter((id) => id !== "all");
      const isSelected = withoutAll.includes(chipId);
      const next = isSelected
        ? withoutAll.filter((id) => id !== chipId)
        : [...withoutAll, chipId];
      return next.length === 0 ? ["all"] : next;
    });
  };

  const handleGeolocate = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [userCenter.lng, userCenter.lat], zoom: 13, essential: true });
    if (mode === "nearby") {
      void fetchNearby(userCenter.lat, userCenter.lng, NEARBY_RADIUS_M, apiCategories);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full bg-white"
      style={{
        width: "100%",
        height: "calc(100dvh - 112px)",
        minHeight: "480px",
      }}
    >
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "calc(100dvh - 112px)",
          minHeight: "480px",
        }}
      />

      {/* ── Floating overlay ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto flex items-center gap-2">
            <Link
              href="/explore"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              aria-label="Back to explore"
            >
              <ArrowLeft size={16} />
            </Link>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "nearby" ? "viewport" : "nearby"))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#E94560] hover:text-[#E94560]"
            >
              <span className="flex items-center gap-1.5">
                <MapIcon size={14} />
                {mode === "nearby" ? "Nearby" : "Viewport"}
              </span>
            </button>
          </div>

          <div className="pointer-events-auto rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            {loading ? "Loading…" : `${total} places found`}
            {cached ? " · cached" : ""}
          </div>

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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Center on my location"
            >
              <Navigation size={16} />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div
          className="pointer-events-auto mt-auto flex flex-wrap gap-2 p-3"
          style={{ paddingBottom: selectedPlace ? "196px" : undefined }}
        >
          {FILTER_CHIPS.map((chip) => {
            const active =
              chip.id === "all"
                ? selectedChipIds.includes("all")
                : selectedChipIds.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => toggleChip(chip.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                  active
                    ? "border-[#E94560] bg-[#E94560] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#E94560]/40"
                }`}
              >
                <chip.Icon size={14} />
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-md">
            <Loader2 size={16} className="animate-spin text-[#E94560]" />
            Loading places…
          </div>
        </div>
      )}

      {!loading && places.length === 0 && !error && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-md">
            No places found
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
          bottom: 0,
          left: 0,
          right: 0,
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
            {/* Drag handle / dismiss */}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setSelectedPlace(null)}
              style={{
                position: "absolute",
                top: 8,
                left: "50%",
                transform: "translateX(-50%)",
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "#CBD5E1",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            />

            <img
              src={selectedPlace.photo_url ?? FALLBACK_PHOTO}
              alt={selectedPlace.name}
              style={{
                width: 120,
                height: 148,
                objectFit: "cover",
                borderRadius: 8,
                flexShrink: 0,
                marginTop: 12,
                background: "#F1F5F9",
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = FALLBACK_PHOTO;
              }}
            />

            <div style={{ flex: 1, minWidth: 0, marginTop: 12 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#0F172A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 4,
                }}
              >
                {selectedPlace.name}
              </div>

              {selectedPlace.category && (
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: markerColor(selectedPlace.category),
                    background: markerColor(selectedPlace.category) + "18",
                    borderRadius: 20,
                    padding: "2px 8px",
                    marginBottom: 6,
                    textTransform: "capitalize",
                  }}
                >
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
                  {(selectedPlace.distance_m / 1609).toFixed(1)} mi away
                </div>
              )}

              {selectedPlace.website && (
                <a
                  href={selectedPlace.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: 4,
                    padding: "6px 14px",
                    background: "#0F766E",
                    color: "#fff",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
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
