"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { apiFetch } from "@/lib/api";
import { onValue, ref, type Database } from "firebase/database";
import { Bot, X, Maximize2, Minus, Plus, Compass, Layers, MapPin } from "lucide-react";

// Fix default leaflet marker icon assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface GroupMapProps {
  tripId: string;
  firebaseDb: Database | null;
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

// Map Event Listener for picking meet points
function MapEvents({
  picking,
  onPick,
}: {
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (picking) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Controller to auto-center on centroid once on load or when members change
function MapCenterController({ points }: { points: [number, number][] }) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (points.length > 0 && !hasCentered.current) {
      map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
      hasCentered.current = true;
    }
  }, [points, map]);

  return null;
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

export function GroupMap({
  tripId,
  firebaseDb,
  currentUserId,
  meetPoint,
  pickingMeetPoint,
  onMapPick,
  members,
}: GroupMapProps) {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [wayraAlert, setWayraAlert] = useState<string | null>(null);
  const [showWayraAlert, setShowWayraAlert] = useState(false);
  const [activeTileLayer, setActiveTileLayer] = useState("osm");
  const [cityName, setCityName] = useState<string>("Active Trip");

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

  // Map Centroid and Bounds calculation
  const centroidPoints = useMemo(() => {
    const pts: [number, number][] = [];
    members.forEach((m) => {
      if (m.lat && m.lng) pts.push([m.lat, m.lng]);
    });
    if (meetPoint.lat && meetPoint.lng) {
      pts.push([meetPoint.lat, meetPoint.lng]);
    }
    return pts;
  }, [members, meetPoint]);

  const mapCenter = useMemo((): [number, number] => {
    if (centroidPoints.length > 0) {
      const latSum = centroidPoints.reduce((acc, p) => acc + p[0], 0);
      const lngSum = centroidPoints.reduce((acc, p) => acc + p[1], 0);
      return [latSum / centroidPoints.length, lngSum / centroidPoints.length];
    }
    return [41.8781, -87.6298]; // Chicago fallback
  }, [centroidPoints]);

  const tileUrls = {
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    voyager: "https://{s}.basemaps.cartocdn.com/rastermaps/voyager/{z}/{x}/{y}.png",
    dark: "https://{s}.basemaps.cartocdn.com/rastermaps/dark_all/{z}/{x}/{y}.png",
  };

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

      {/* MapContainer */}
      <div className="absolute inset-0 z-10 w-full h-full">
        <MapContainer
          center={mapCenter}
          zoom={14}
          zoomControl={false}
          className="w-full h-full"
          ref={setMapInstance}
        >
          <TileLayer
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            url={tileUrls[activeTileLayer as keyof typeof tileUrls]}
          />

          <MapEvents picking={pickingMeetPoint} onPick={onMapPick} />
          <MapCenterController points={centroidPoints} />

          {/* Meeting Point Pin */}
          {meetPoint.lat && meetPoint.lng && (
            <>
              <Marker
                position={[meetPoint.lat, meetPoint.lng]}
                icon={L.divIcon({
                  html: `
                    <div class="relative flex flex-col items-center">
                      <!-- 30px rotated square -->
                      <div class="relative h-[30px] w-[30px] rotate-45 rounded bg-[#EF4444] shadow-lg flex items-center justify-center border-2 border-white">
                        <!-- Map pin inside rotated back -->
                        <div class="-rotate-45 text-white flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                      </div>
                      <!-- 2px stem below -->
                      <div class="h-1.5 w-[2px] bg-[#EF4444] shadow-sm"></div>
                      <!-- Dark tag label -->
                      <div class="mt-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-black tracking-wide text-white whitespace-nowrap shadow-md border border-slate-700">
                        Meeting Point
                      </div>
                    </div>
                  `,
                  className: "custom-meeting-icon",
                  iconSize: [100, 70],
                  iconAnchor: [50, 45],
                })}
              />

              {/* Geofence dashed circle around meeting point (500m radius) */}
              <Circle
                center={[meetPoint.lat, meetPoint.lng]}
                radius={500}
                pathOptions={{
                  color: "#EF4444",
                  dashArray: "6, 6",
                  weight: 2,
                  fillColor: "#EF4444",
                  fillOpacity: 0.05,
                }}
              />
            </>
          )}

          {/* Member Markers */}
          {members.map((m) => {
            if (!m.lat || !m.lng) return null;

            // Calc distance and status color
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

            return (
              <Marker
                key={m.user_id}
                position={[m.lat, m.lng]}
                icon={L.divIcon({
                  html: `
                    <div class="relative flex flex-col items-center">
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
                    </div>
                  `,
                  className: "custom-member-icon",
                  iconSize: [60, 60],
                  iconAnchor: [30, 48],
                })}
              />
            );
          })}
        </MapContainer>
      </div>

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
          onClick={() => mapInstance?.zoomIn()}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50"
          title="Zoom In"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => mapInstance?.zoomOut()}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50"
          title="Zoom Out"
        >
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                mapInstance?.setView([pos.coords.latitude, pos.coords.longitude], 15);
              });
            }
          }}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50"
          title="Current Location"
        >
          <Compass size={18} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => {
            if (meetPoint.lat && meetPoint.lng) {
              mapInstance?.setView([meetPoint.lat, meetPoint.lng], 15);
            }
          }}
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50"
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
          className="h-10 w-10 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl shadow-lg flex items-center justify-center transition hover:bg-slate-50"
          title="Switch Map Layer"
        >
          <Layers size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
