"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiFetch } from "@/lib/api";
import { Bot, X, Compass, Layers, MapPin, Plus, Minus } from "lucide-react";

interface GroupMapProps {
  tripId: string;
  firebaseDb: any; // Kept in interface for props compatibility, not used directly
  currentUserId: string | null;
  meetPoint: {
    lat: number | null;
    lng: number | null;
    name?: string | null;
  };
  pickingMeetPoint: boolean;
  onMapPick: (lat: number, lng: number) => void;
  members: Array<{
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    quick_status?: string | null;
    lat: number | null;
    lng: number | null;
    updated_at?: number | null;
  }>;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

function buildMapStyleSpec(url: string, attribution: string): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      raster: {
        type: "raster",
        tiles: [url],
        tileSize: 256,
        attribution,
      },
    },
    layers: [{ id: "raster", type: "raster", source: "raster" }],
  };
}

function createCircleGeoJSON(center: [number, number], radiusInMeters: number, pointsCount = 64): any {
  const coords = [];
  const [lng, lat] = center;
  const km = radiusInMeters / 1000;
  
  const latFactor = 1 / 111.32;
  const lngFactor = 1 / (111.32 * Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i < pointsCount; i++) {
    const angle = (i * 2 * Math.PI) / pointsCount;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);
    
    coords.push([
      lng + dx * lngFactor,
      lat + dy * latFactor
    ]);
  }
  coords.push(coords[0]); // close polygon

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
    properties: {},
  };
}

function createMeetMarkerEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "relative flex flex-col items-center";
  el.innerHTML = `
    <!-- 30px rotated square -->
    <div class="relative h-[30px] w-[30px] rotate-45 rounded bg-[#EF4444] shadow-lg flex items-center justify-center border-2 border-white">
      <!-- Map pin inside rotated back -->
      <div class="-rotate-45 text-white flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    </div>
    <!-- 2px stem below -->
    <div class="h-1.5 w-[2px] bg-[#EF4444] shadow-sm"></div>
    <!-- Dark tag label -->
    <div class="mt-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-black tracking-wide text-white whitespace-nowrap shadow-md border border-slate-700">
      Meeting Point
    </div>
  `;
  return el;
}

function createMemberMarkerEl(
  m: { full_name: string | null },
  statusColor: string,
  initials: string
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "relative flex flex-col items-center";
  el.innerHTML = `
    <!-- Ripple animation ring -->
    <span class="absolute inline-flex h-10 w-10 rounded-full ripple-effect" style="background-color: ${statusColor}"></span>
    <!-- Colored circle 34px with white 2px border -->
    <div class="relative flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white text-xs font-black text-white shadow-md" style="background-color: ${statusColor}">
      ${initials}
      <!-- Status dot bottom-right 9px circle -->
      <span class="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white" style="background-color: ${statusColor}"></span>
    </div>
    <!-- Name label dark pill below dot -->
    <div class="mt-1 rounded bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow whitespace-nowrap border border-slate-700">
      ${m.full_name || "Traveler"}
    </div>
  `;
  return el;
}

export function GroupMap({
  tripId,
  meetPoint,
  pickingMeetPoint,
  onMapPick,
  members,
}: GroupMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const memberMarkersRef = useRef<maplibregl.Marker[]>([]);
  const meetMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  const [wayraAlert, setWayraAlert] = useState<string | null>(null);
  const [showWayraAlert, setShowWayraAlert] = useState(false);
  const [activeTileLayer, setActiveTileLayer] = useState("osm");
  const [cityName, setCityName] = useState<string>("Active Trip");
  const [mapReady, setMapReady] = useState(false);

  const tileUrls = useMemo(() => ({
    osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    voyager: "https://basemaps.cartocdn.com/rastermaps/voyager/{z}/{x}/{y}.png",
    dark: "https://basemaps.cartocdn.com/rastermaps/dark_all/{z}/{x}/{y}.png",
  }), []);

  // Cache Wayra live-context call
  useEffect(() => {
    const fetchWayraContext = async () => {
      try {
        const res = await apiFetch<{ alert: string | null }>(`/wayra/live-context/${tripId}`);
        if (res?.alert) {
          setWayraAlert(res.alert);
          setShowWayraAlert(true);
        } else {
          setWayraAlert(null);
        }
      } catch (err) {
        console.error("Failed to fetch Wayra context:", err);
      }
    };

    fetchWayraContext();
    const interval = setInterval(fetchWayraContext, 60000);
    return () => clearInterval(interval);
  }, [tripId]);

  // Attempt to resolve city name from meet point or coordinates
  useEffect(() => {
    if (meetPoint.lat && meetPoint.lng) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${meetPoint.lat}&lon=${meetPoint.lng}`
      )
        .then((r) => r.json())
        .then((data) => {
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.suburb ||
            "On Location";
          setCityName(city);
        })
        .catch(() => setCityName("On Location"));
    }
  }, [meetPoint.lat, meetPoint.lng]);

  const centroidPoints = useMemo(() => {
    const pts: [number, number][] = [];
    members.forEach((m) => {
      if (m.lat && m.lng) pts.push([m.lng, m.lat]);
    });
    if (meetPoint.lat && meetPoint.lng) {
      pts.push([meetPoint.lng, meetPoint.lat]);
    }
    return pts;
  }, [members, meetPoint]);

  const mapCenter = useMemo((): [number, number] => {
    if (centroidPoints.length > 0) {
      const lngSum = centroidPoints.reduce((acc, p) => acc + p[0], 0);
      const latSum = centroidPoints.reduce((acc, p) => acc + p[1], 0);
      return [lngSum / centroidPoints.length, latSum / centroidPoints.length];
    }
    return [-87.6298, 41.8781]; // Chicago fallback [lng, lat]
  }, [centroidPoints]);

  const ensureCircleLayer = useCallback((map: maplibregl.Map) => {
    if (map.getSource("meet-circle")) return;
    map.addSource("meet-circle", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "meet-circle-fill",
      type: "fill",
      source: "meet-circle",
      paint: {
        "fill-color": "#EF4444",
        "fill-opacity": 0.05,
      },
    });
    map.addLayer({
      id: "meet-circle-outline",
      type: "line",
      source: "meet-circle",
      paint: {
        "line-color": "#EF4444",
        "line-width": 2,
        "line-dasharray": [3, 3],
      },
    });
  }, []);

  // Map Initialization
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const initialStyleUrl = tileUrls[activeTileLayer as keyof typeof tileUrls];
    const initialAttrib = activeTileLayer === "osm" ? "© OpenStreetMap contributors" : "© CARTO";

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyleSpec(initialStyleUrl, initialAttrib),
      center: mapCenter,
      zoom: 14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("load", () => {
      ensureCircleLayer(map);
      setMapReady(true);
      map.resize();
    });

    map.on("styledata", () => {
      if (!map.isStyleLoaded()) return;
      ensureCircleLayer(map);
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

  // Handle layer/style updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const url = tileUrls[activeTileLayer as keyof typeof tileUrls];
    const attrib = activeTileLayer === "osm" ? "© OpenStreetMap contributors" : "© CARTO";
    map.setStyle(buildMapStyleSpec(url, attrib));
  }, [activeTileLayer, mapReady, tileUrls]);

  // Fit bounds on first load or when centroid points change
  const hasFitBounds = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || centroidPoints.length === 0 || hasFitBounds.current) return;

    const bounds = new maplibregl.LngLatBounds();
    centroidPoints.forEach(([lng, lat]) => bounds.extend([lng, lat]));
    map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    hasFitBounds.current = true;
  }, [mapReady, centroidPoints]);

  // Meeting Point Circle updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("meet-circle") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (meetPoint.lat && meetPoint.lng) {
      const geojson = createCircleGeoJSON([meetPoint.lng, meetPoint.lat], 500);
      source.setData(geojson);
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [mapReady, meetPoint.lat, meetPoint.lng]);

  // Meeting Point Pin updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    meetMarkerRef.current?.remove();
    meetMarkerRef.current = null;

    if (meetPoint.lat && meetPoint.lng) {
      meetMarkerRef.current = new maplibregl.Marker({
        element: createMeetMarkerEl(),
        anchor: "bottom",
      })
        .setLngLat([meetPoint.lng, meetPoint.lat])
        .addTo(map);
    }
  }, [mapReady, meetPoint.lat, meetPoint.lng]);

  // Member Markers updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    memberMarkersRef.current.forEach((m) => m.remove());
    memberMarkersRef.current = [];

    members.forEach((m) => {
      if (!m.lat || !m.lng) return;

      let distance = Infinity;
      if (meetPoint.lat && meetPoint.lng) {
        distance = haversineDistance(m.lat, m.lng, meetPoint.lat, meetPoint.lng);
      }

      const isStale = m.updated_at
        ? Math.floor(Date.now() / 1000) - m.updated_at > 120
        : true;

      let statusColor = "#94A3B8"; // default stale
      if (!isStale) {
        if (distance <= 100) statusColor = "#22C55E"; // Arrived
        else if (distance <= 500) statusColor = "#3B82F6"; // Near
        else statusColor = "#F59E0B"; // On the way
      }

      const initials = (m.full_name || "M")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      const marker = new maplibregl.Marker({
        element: createMemberMarkerEl(m, statusColor, initials),
        anchor: "bottom",
      })
        .setLngLat([m.lng, m.lat])
        .addTo(map);

      memberMarkersRef.current.push(marker);
    });
  }, [members, mapReady, meetPoint.lat, meetPoint.lng]);

  // Map Click handlers for picking meet points
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (pickHandlerRef.current) {
      map.off("click", pickHandlerRef.current);
      pickHandlerRef.current = null;
    }

    if (!pickingMeetPoint || !onMapPick) {
      map.getCanvas().style.cursor = "";
      return;
    }

    map.getCanvas().style.cursor = "crosshair";
    const handler = (e: maplibregl.MapMouseEvent) => {
      onMapPick?.(e.lngLat.lat, e.lngLat.lng);
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
  }, [mapReady, onMapPick, pickingMeetPoint]);

  return (
    <div className="relative w-full h-full bg-[#D6E8E1] overflow-hidden flex flex-col select-none">
      {/* CSS Keyframes for Ripple */}
      <style jsx global>{`
        @keyframes ripple {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .ripple-effect {
          animation: ripple 2s infinite ease-out;
        }
      `}</style>

      {/* MapContainer Container */}
      <div ref={containerRef} className="absolute inset-0 z-10 w-full h-full" />

      {/* Dismissible Wayra AI Warning banner top of map */}
      {showWayraAlert && wayraAlert && (
        <div className="absolute top-3 inset-x-3 z-30 flex justify-center">
          <div className="flex items-center gap-3 bg-slate-950/90 border border-slate-800 text-slate-100 px-4 py-3 rounded-2xl shadow-xl max-w-lg w-full backdrop-blur-md">
            <div className="h-8 w-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <Bot size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-teal-400 tracking-wider">Wayra AI Context</p>
              <p className="text-xs font-semibold text-slate-200 truncate">{wayraAlert}</p>
            </div>
            <button
              onClick={() => setShowWayraAlert(false)}
              className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Location label bottom-left: city name in white pill */}
      <div className="absolute bottom-3 left-3 z-20">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-lg text-slate-800 text-xs font-black">
          <Compass size={14} className="text-[#0F766E] animate-spin-slow" />
          <span>{cityName}</span>
        </div>
      </div>

      {/* Map Controls bottom-right */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50 cursor-pointer"
          title="Zoom In"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50 cursor-pointer"
          title="Zoom Out"
        >
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                mapRef.current?.flyTo({
                  center: [pos.coords.longitude, pos.coords.latitude],
                  zoom: 15,
                });
              });
            }
          }}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50 cursor-pointer"
          title="Current Location"
        >
          <Compass size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => {
            if (meetPoint.lat && meetPoint.lng) {
              mapRef.current?.flyTo({
                center: [meetPoint.lng, meetPoint.lat],
                zoom: 15,
              });
            }
          }}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50 cursor-pointer"
          title="Meet Point"
        >
          <MapPin size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => {
            const layers = ["osm", "voyager", "dark"];
            const nextIdx = (layers.indexOf(activeTileLayer) + 1) % layers.length;
            setActiveTileLayer(layers[nextIdx]);
          }}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50 cursor-pointer"
          title="Switch Map Layer"
        >
          <Layers size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
