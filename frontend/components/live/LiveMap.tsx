"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { onValue, ref, type Database } from "firebase/database";

export type MapMemberLite = {
  user_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
};

export type GeoPoint = { lat: number | null; lng: number | null };

type LocRow = {
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  updated_at?: unknown;
  timestamp?: unknown;
};

const COLORS = ["#DC2626", "#6366f1", "#f59e0b", "#10b981", "#a855f7", "#eab308"];
const NIGHT_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

function readLoc(row: LocRow | null): {
  lat: number | null;
  lng: number | null;
  updated_at: number | null;
} {
  if (!row || typeof row !== "object") {
    return { lat: null, lng: null, updated_at: null };
  }
  let lat =
    typeof row.lat === "number"
      ? row.lat
      : typeof row.latitude === "number"
        ? row.latitude
        : null;
  let lng =
    typeof row.lng === "number"
      ? row.lng
      : typeof row.longitude === "number"
        ? row.longitude
        : null;
  let updated =
    typeof row.updated_at === "number"
      ? row.updated_at
      : typeof row.timestamp === "number"
        ? row.timestamp
        : null;
  if (lat === null && typeof row.lat === "string" && !Number.isNaN(Number(row.lat))) {
    lat = Number(row.lat);
  }
  if (lng === null && typeof row.lng === "string" && !Number.isNaN(Number(row.lng))) {
    lng = Number(row.lng);
  }
  return { lat: lat ?? null, lng: lng ?? null, updated_at: updated };
}

function buildStandardStyle(): maplibregl.StyleSpecification {
  return {
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
  };
}

function buildSatelliteStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      satellite: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "© Esri",
      },
    },
    layers: [{ id: "satellite", type: "raster", source: "satellite" }],
  };
}

function createMemberMarkerEl(color: string, pulse: boolean, img?: string | null): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "width:42px",
    "height:42px",
    "border-radius:999px",
    `border:${pulse ? "3px solid #50d493" : `2px solid ${color}`}`,
    `background:${img ? "transparent" : color}`,
    pulse ? "animation:livePulse 1.35s infinite" : "",
    "box-shadow:0 2px 8px rgba(0,0,0,.45)",
  ].join(";");
  if (img && img.startsWith("http")) {
    const image = document.createElement("img");
    image.src = img;
    image.alt = "";
    image.style.cssText = "width:38px;height:38px;border-radius:999px;object-fit:cover";
    el.appendChild(image);
  } else {
    el.textContent = "?";
    el.style.color = "#fff";
    el.style.fontWeight = "700";
    el.style.fontSize = "12px";
  }
  return el;
}

function createMeetMarkerEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = "🚩";
  el.style.cssText = "font-size:24px;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.65)";
  return el;
}

export function LiveMap(props: {
  tripId: string;
  firebaseDb: Database | null;
  members: MapMemberLite[];
  meetPoint: GeoPoint & { name?: string | null };
  pickingMeetPoint?: boolean;
  onMapPick?: (lat: number, lng: number) => void;
  currentUserId: string | null;
  pulseUserId?: string | null;
  style?: "standard" | "satellite" | "night";
  routeLine?: [number, number][];
  centerOverride?: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const memberMarkersRef = useRef<maplibregl.Marker[]>([]);
  const meetMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);
  const [locs, setLocs] = useState<
    Record<string, { lat: number; lng: number; updated_at: number | null }>
  >({});
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!props.firebaseDb || !props.tripId) return undefined;
    const base = ref(props.firebaseDb, `trips/${props.tripId}/locations`);
    const off = onValue(base, (snap) => {
      const raw = snap.val() as Record<string, LocRow> | null;
      const next: typeof locs = {};
      if (!raw) {
        setLocs({});
        return;
      }
      Object.keys(raw).forEach((uid) => {
        const { lat, lng, updated_at } = readLoc(raw[uid]);
        if (lat !== null && lng !== null) {
          next[uid] = { lat, lng, updated_at };
        }
      });
      setLocs(next);
    });
    return () => off();
  }, [props.firebaseDb, props.tripId]);

  const fitPoints = useMemo(() => {
    const pts: [number, number][] = [];
    props.members.forEach((mem) => {
      const g = locs[mem.user_id];
      if (g?.lat != null && g?.lng != null) pts.push([g.lng, g.lat]);
    });
    if (
      props.meetPoint.lat !== null &&
      props.meetPoint.lng !== null &&
      !Number.isNaN(props.meetPoint.lat) &&
      !Number.isNaN(props.meetPoint.lng)
    ) {
      pts.push([props.meetPoint.lng, props.meetPoint.lat]);
    }
    return pts;
  }, [locs, props.meetPoint.lat, props.meetPoint.lng, props.members]);

  const defaultCenter = useMemo((): [number, number] => {
    if (fitPoints.length === 0) return [0, 20];
    let slat = 0;
    let slng = 0;
    fitPoints.forEach(([lng, lat]) => {
      slat += lat;
      slng += lng;
    });
    return [slng / fitPoints.length, slat / fitPoints.length];
  }, [fitPoints]);

  const ensureRouteLayer = useCallback((map: maplibregl.Map) => {
    if (map.getSource("route-line")) return;
    map.addSource("route-line", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "route-line-layer",
      type: "line",
      source: "route-line",
      paint: {
        "line-color": "#0F766E",
        "line-width": 4,
        "line-dasharray": [2, 2],
      },
    });
  }, []);

  const applyMapStyle = useCallback((map: maplibregl.Map, styleName: "standard" | "satellite" | "night") => {
    if (styleName === "night") {
      map.setStyle(NIGHT_STYLE);
      return;
    }
    map.setStyle(styleName === "satellite" ? buildSatelliteStyle() : buildStandardStyle());
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: props.style === "night" ? NIGHT_STYLE : props.style === "satellite" ? buildSatelliteStyle() : buildStandardStyle(),
      center: defaultCenter,
      zoom: fitPoints.length ? 13 : 2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => {
      ensureRouteLayer(map);
      setMapReady(true);
      map.resize();
    });
    map.on("styledata", () => {
      if (!map.isStyleLoaded()) return;
      ensureRouteLayer(map);
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      memberMarkersRef.current.forEach((m) => m.remove());
      memberMarkersRef.current = [];
      meetMarkerRef.current?.remove();
      meetMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    applyMapStyle(map, props.style || "standard");
  }, [applyMapStyle, mapReady, props.style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    memberMarkersRef.current.forEach((m) => m.remove());
    memberMarkersRef.current = [];

    const pulseId = props.pulseUserId || props.currentUserId;
    props.members.forEach((m, idx) => {
      const row = locs[m.user_id];
      if (!row || Number.isNaN(row.lat) || Number.isNaN(row.lng)) return;
      const col = COLORS[idx % COLORS.length]!;
      const pulse = pulseId !== null && m.user_id === pulseId;
      const marker = new maplibregl.Marker({
        element: createMemberMarkerEl(col, pulse, m.avatar_url),
        anchor: "bottom",
      })
        .setLngLat([row.lng, row.lat])
        .addTo(map);
      memberMarkersRef.current.push(marker);
    });
  }, [locs, mapReady, props.currentUserId, props.members, props.pulseUserId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    meetMarkerRef.current?.remove();
    meetMarkerRef.current = null;

    if (
      props.meetPoint.lat !== null &&
      props.meetPoint.lng !== null &&
      !Number.isNaN(props.meetPoint.lat) &&
      !Number.isNaN(props.meetPoint.lng)
    ) {
      meetMarkerRef.current = new maplibregl.Marker({
        element: createMeetMarkerEl(),
        anchor: "bottom",
      })
        .setLngLat([props.meetPoint.lng, props.meetPoint.lat])
        .addTo(map);
    }
  }, [mapReady, props.meetPoint.lat, props.meetPoint.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("route-line") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (props.routeLine && props.routeLine.length > 1) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: props.routeLine.map(([lat, lng]) => [lng, lat]),
        },
      });
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [mapReady, props.routeLine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || props.centerOverride) return;
    if (fitPoints.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    fitPoints.forEach(([lng, lat]) => bounds.extend([lng, lat]));
    map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 600 });
  }, [fitPoints, mapReady, props.centerOverride]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !props.centerOverride) return;
    map.flyTo({ center: [props.centerOverride[1], props.centerOverride[0]], zoom: 16, duration: 800 });
  }, [mapReady, props.centerOverride]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (pickHandlerRef.current) {
      map.off("click", pickHandlerRef.current);
      pickHandlerRef.current = null;
    }

    if (!props.pickingMeetPoint || !props.onMapPick) {
      map.getCanvas().style.cursor = "";
      return;
    }

    map.getCanvas().style.cursor = "crosshair";
    const handler = (e: maplibregl.MapMouseEvent) => {
      props.onMapPick?.(e.lngLat.lat, e.lngLat.lng);
    };
    pickHandlerRef.current = handler;
    map.on("click", handler);

    return () => {
      if (pickHandlerRef.current) {
        map.off("click", pickHandlerRef.current);
        pickHandlerRef.current = null;
      }
      map.getCanvas().style.cursor = "";
    };
  }, [mapReady, props.onMapPick, props.pickingMeetPoint]);

  if (!props.firebaseDb) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#090f1d] px-5 text-center text-sm text-amber-100">
        Firebase client unavailable — pins need NEXT_PUBLIC_FIREBASE_DATABASE_URL configured.
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @keyframes livePulse {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          70% {
            transform: scale(1.08);
            filter: brightness(1.15);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
        }
      `}</style>
      <div ref={containerRef} className="h-full w-full" />
    </>
  );
}
