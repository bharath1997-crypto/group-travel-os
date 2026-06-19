"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import L from "leaflet";
import {
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  update,
  type Database,
} from "firebase/database";
import { apiFetch } from "@/lib/api";
import { initFirebase } from "@/lib/firebase-client";

import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });

const MapController = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner({
        mapRef,
        center,
      }: {
        mapRef: MutableRefObject<L.Map | null>;
        center: [number, number] | null;
      }) {
        const map = mod.useMap();
        useEffect(() => {
          mapRef.current = map;
        }, [map, mapRef]);
        useEffect(() => {
          const fix = () => map.invalidateSize();
          fix();
          const id = requestAnimationFrame(fix);
          const t = window.setTimeout(fix, 150);
          window.addEventListener("resize", fix);
          return () => {
            cancelAnimationFrame(id);
            window.clearTimeout(t);
            window.removeEventListener("resize", fix);
          };
        }, [map]);
        useEffect(() => {
          if (center) map.setView(center, map.getZoom() || 14, { animate: true });
        }, [map, center]);
        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

// ── Types & constants ─────────────────────────────────────────────────────────

type MapStyle = "street" | "dark" | "satellite";
type PanelId = "launch" | "wayra" | "actions" | "sos" | "report" | null;
type ToastType = "success" | "error" | "info";

type WazeReport = {
  id: string;
  type: string;
  lat: number;
  lon: number;
  reported_by?: string;
  reporter_name?: string;
  reported_at: number;
  expires_at: number;
  thumbs_up: number;
  thumbs_down: number;
  city?: string;
  description?: string;
};

type LiveMember = {
  userId: string;
  active?: boolean;
  lat?: number;
  lon?: number;
  speed?: number;
  user_name?: string;
};

type WayraMsg = { role: "user" | "wayra"; text: string; time: number };

const NAVY = "#0F3460";
const CORAL = "#E94560";
const GREEN = "#2ECC71";
const MEMBER_COLORS = ["#E94560", "#F39C12", "#9B59B6", "#1ABC9C", "#E67E22"];

const TILES: Record<MapStyle, string> = {
  street: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  satellite:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

const REPORT_META: Record<string, { emoji: string; bg: string; expiry: number }> = {
  traffic: { emoji: "🚦", bg: "#E94560", expiry: 30 },
  police: { emoji: "🚔", bg: "#3498DB", expiry: 20 },
  accident: { emoji: "🚗", bg: "#E67E22", expiry: 60 },
  hazard: { emoji: "⚠️", bg: "#F1C40F", expiry: 120 },
  pothole: { emoji: "🕳️", bg: "#8B4513", expiry: 1440 },
  flood: { emoji: "🌊", bg: "#2980B9", expiry: 240 },
  animal: { emoji: "🦌", bg: "#27AE60", expiry: 15 },
  closure: { emoji: "🚧", bg: "#E67E22", expiry: 480 },
  fuel: { emoji: "⛽", bg: "#2ECC71", expiry: 1440 },
};

const CATEGORY_PILLS = [
  { key: "restaurant", label: "🍽️ Food", amenity: "restaurant", emoji: "🍽️", bg: GREEN },
  { key: "hotel", label: "🏨 Hotels", amenity: "hotel", emoji: "🏨", bg: NAVY },
  { key: "attraction", label: "🎯 Activities", amenity: "attraction", emoji: "🎯", bg: CORAL },
  { key: "hospital", label: "🏥 Hospital", amenity: "hospital", emoji: "🏥", bg: CORAL },
  { key: "fuel", label: "⛽ Fuel", amenity: "fuel", emoji: "⛽", bg: "#E67E22" },
  { key: "atm", label: "🏧 ATM", amenity: "atm", emoji: "🏧", bg: "#95A5A6" },
  { key: "cafe", label: "☕ Cafe", amenity: "cafe", emoji: "☕", bg: "#8B4513" },
  { key: "mall", label: "🛒 Shopping", amenity: "mall", emoji: "🛒", bg: NAVY },
];

const WAYRA_CHIPS = ["⛽ Fuel", "🍽️ Food", "🏥 Hospital", "⏱️ ETA", "🌤️ Weather", "🚦 Traffic", "🅿️ Parking", "☕ Coffee"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function getReportEmoji(type: string): string {
  return REPORT_META[type]?.emoji ?? "⚠️";
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function timeAgo(ts: number): string {
  const m = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function getWeatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code === 95) return "⛈️";
  return "🌤️";
}

function userDivIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:40px;height:40px;position:relative">
      <div style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;background:rgba(66,133,244,0.2);animation:pulse-ring 2s infinite"></div>
      <div style="position:absolute;top:13px;left:13px;width:14px;height:14px;border-radius:50%;background:#4285F4;border:2px solid white;box-shadow:0 2px 6px rgba(66,133,244,0.5)"></div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function memberDivIcon(color: string, name: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25)"></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function reportDivIcon(type: string): L.DivIcon {
  const meta = REPORT_META[type] ?? { emoji: "⚠️", bg: CORAL };
  return L.divIcon({
    className: "",
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${meta.bg};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px">${meta.emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function categoryDivIcon(emoji: string, bg: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${bg};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:16px">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "User-Agent": "Travello/1.0" } },
    );
    const data = (await res.json()) as { address?: { city?: string; town?: string; suburb?: string } };
    return data.address?.city || data.address?.town || data.address?.suburb || "Your area";
  } catch {
    return "Your area";
  }
}

async function overpassSearch(
  lat: number,
  lon: number,
  amenity: string,
  radiusM = 5000,
): Promise<{ name: string; lat: number; lon: number }[]> {
  const q = `[out:json][timeout:25];node["amenity"="${amenity}"](around:${radiusM},${lat},${lon});out body;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: q,
    });
    const data = (await res.json()) as { elements?: { lat?: number; lon?: number; tags?: { name?: string } }[] };
    return (data.elements ?? [])
      .filter((e) => e.lat != null && e.lon != null)
      .map((e) => ({
        name: e.tags?.name || amenity,
        lat: e.lat!,
        lon: e.lon!,
      }))
      .slice(0, 12);
  } catch {
    return [];
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LivePage() {
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<number | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragStartY = useRef(0);
  const dragStartPanelY = useRef(50);
  const lastGeoCityRef = useRef<{ lat: number; lon: number } | null>(null);
  const alertedReportsRef = useRef<Set<string>>(new Set());
  const fbRef = useRef<Database | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>("street");
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [userCity, setUserCity] = useState("");
  const [weather, setWeather] = useState<{
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  } | null>(null);

  const [tripActive, setTripActive] = useState(false);
  const [tripSeconds, setTripSeconds] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripSpeed, setTripSpeed] = useState(0);
  const [lastPosition, setLastPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [activeTrip, setActiveTrip] = useState<{
    id: string;
    title?: string;
    name?: string;
    description?: string;
    start_date?: string;
    status?: string;
  } | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelY, setPanelY] = useState(50);
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [wazeReports, setWazeReports] = useState<WazeReport[]>([]);
  const [nearbyAlert, setNearbyAlert] = useState<WazeReport | null>(null);
  const [reportType, setReportType] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const [liveMembers, setLiveMembers] = useState<LiveMember[]>([]);

  const [wayraMessages, setWayraMessages] = useState<WayraMsg[]>([
    {
      role: "wayra",
      text: "Hey! I'm Wayra 🤖 Your smart travel companion. I monitor your route, alert you of hazards, and help you navigate. What do you need?",
      time: Date.now(),
    },
  ]);
  const [wayraInput, setWayraInput] = useState("");

  const [chatMessages, setChatMessages] = useState<
    { id: string; sender_id?: string; sender_name?: string; text?: string; timestamp?: number }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [userGroups, setUserGroups] = useState<{ id: string; name: string; member_count?: number }[]>([]);
  const [activeGroup, setActiveGroup] = useState<{ id: string; name: string; member_count?: number } | null>(null);

  const [user, setUser] = useState<{
    id: string;
    full_name: string;
    avatar_url?: string | null;
  } | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { display_name: string; lat: string; lon: string }[]
  >([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [categoryMarkers, setCategoryMarkers] = useState<
    { id: string; name: string; lat: number; lon: number; emoji: string; bg: string }[]
  >([]);

  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [nowClock, setNowClock] = useState(Date.now());

  const showToast = useCallback((msg: string, type: ToastType = "info") => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const addWayraMessage = useCallback((text: string) => {
    setWayraMessages((prev) => [...prev, { role: "wayra", text, time: Date.now() }]);
  }, []);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`,
      );
      const data = (await res.json()) as { current?: typeof weather };
      if (data.current) setWeather(data.current);
    } catch {
      /* offline ok */
    }
  }, []);

  const checkNearbyReports = useCallback(
    (lat: number, lon: number, reports: WazeReport[]) => {
      reports.forEach((report) => {
        if (!report.lat || !report.lon) return;
        const dist = haversineKm(lat, lon, report.lat, report.lon);
        if (dist < 0.5 && !alertedReportsRef.current.has(report.id)) {
          alertedReportsRef.current.add(report.id);
          setNearbyAlert(report);
          addWayraMessage(
            `⚠️ Alert! ${getReportEmoji(report.type)} ${report.type} reported ${(dist * 1000).toFixed(0)}m ahead! Stay alert! 🚨`,
          );
          window.setTimeout(() => setNearbyAlert(null), 8000);
        }
      });
    },
    [addWayraMessage],
  );

  const startTrip = useCallback(() => {
    setTripActive(true);
    setTripSeconds(0);
    setTripDistance(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTripSeconds((s) => s + 1), 1000);
    const db = fbRef.current;
    if (db && user && userLocation) {
      void set(ref(db, `live_trips/${user.id}`), {
        active: true,
        lat: userLocation.lat,
        lon: userLocation.lon,
        speed: 0,
        started_at: Date.now(),
        updated_at: Date.now(),
        user_name: user.full_name,
        user_id: user.id,
      });
    }
    showToast("Trip started! 🚀", "success");
  }, [showToast, user, userLocation]);

  const endTrip = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTripActive(false);
    const db = fbRef.current;
    if (db && user) void remove(ref(db, `live_trips/${user.id}`));
    showToast(`Trip ended! ${formatTime(tripSeconds)} · ${tripDistance.toFixed(1)}km`, "info");
  }, [showToast, tripDistance, tripSeconds, user]);

  const submitReport = useCallback(() => {
    if (!reportType) {
      showToast("Select a type!", "error");
      return;
    }
    if (!userLocation || !user) {
      showToast("Location needed!", "error");
      return;
    }
    const db = fbRef.current;
    if (!db) {
      showToast("Offline — report saved locally only", "error");
      return;
    }
    const expiry = (REPORT_META[reportType]?.expiry ?? 60) * 60 * 1000;
    const reportId = `${Date.now()}_${user.id}`;
    void set(ref(db, `waze_reports/${reportId}`), {
      type: reportType,
      lat: userLocation.lat,
      lon: userLocation.lon,
      reported_by: user.id,
      reporter_name: user.full_name || "Anonymous",
      reported_at: Date.now(),
      expires_at: Date.now() + expiry,
      thumbs_up: 0,
      thumbs_down: 0,
      city: userCity,
      description: reportDescription,
    });
    setReportType("");
    setReportDescription("");
    setActivePanel(null);
    showToast("Report submitted! Thanks 🙏", "success");
    addWayraMessage(
      `Got it! I've reported a ${reportType} at your location. Other travelers will see this on their map. Stay safe! ⚠️`,
    );
  }, [addWayraMessage, reportDescription, reportType, showToast, user, userCity, userLocation]);

  const voteReport = useCallback(
    async (reportId: string, vote: "up" | "down") => {
      const db = fbRef.current;
      if (!db || !user) return;
      const report = wazeReports.find((r) => r.id === reportId);
      if (!report) return;
      await set(ref(db, `waze_thumbs/${reportId}/${user.id}`), { vote });
      const nextUp = vote === "up" ? (report.thumbs_up || 0) + 1 : report.thumbs_up || 0;
      const nextDown = vote === "down" ? (report.thumbs_down || 0) + 1 : report.thumbs_down || 0;
      if (nextDown > 3) {
        await remove(ref(db, `waze_reports/${reportId}`));
        showToast("Report removed — marked gone", "info");
      } else {
        await update(ref(db, `waze_reports/${reportId}`), {
          thumbs_up: nextUp,
          thumbs_down: nextDown,
        });
        showToast(vote === "up" ? "Marked still there 👍" : "Marked gone 👎", "success");
      }
    },
    [showToast, user, wazeReports],
  );

  const doSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { "User-Agent": "Travello/1.0" } },
      );
      const data = (await res.json()) as typeof searchResults;
      setSearchResults(data);
      setShowSearch(true);
    } catch {
      showToast("Search failed", "error");
    }
  }, [searchQuery, showToast]);

  const searchCategory = useCallback(
    async (pill: (typeof CATEGORY_PILLS)[0]) => {
      if (!userLocation) {
        showToast("Waiting for GPS…", "error");
        return;
      }
      setActiveCategory(pill.key);
      const results = await overpassSearch(userLocation.lat, userLocation.lon, pill.amenity);
      setCategoryMarkers(
        results.map((r, i) => ({
          id: `${pill.key}-${i}`,
          name: r.name,
          lat: r.lat,
          lon: r.lon,
          emoji: pill.emoji,
          bg: pill.bg,
        })),
      );
      showToast(`Found ${results.length} ${pill.label} nearby`, "success");
    },
    [showToast, userLocation],
  );

  const handleWayraChip = useCallback(
    async (chip: string) => {
      if (!userLocation) {
        addWayraMessage("I need your GPS location first — allow location access. 📍");
        return;
      }
      const lat = userLocation.lat;
      const lon = userLocation.lon;

      if (chip.includes("Fuel")) {
        const r = await overpassSearch(lat, lon, "fuel");
        const closest = r[0];
        const dist = closest ? haversineKm(lat, lon, closest.lat, closest.lon) : 0;
        addWayraMessage(
          `Found ${r.length} fuel stations nearby! Closest: ${closest?.name ?? "station"} - ${dist.toFixed(1)}km. Showing on map! ⛽`,
        );
        setCategoryMarkers(
          r.map((x, i) => ({ id: `fuel-${i}`, name: x.name, lat: x.lat, lon: x.lon, emoji: "⛽", bg: "#2ECC71" })),
        );
      } else if (chip.includes("Food")) {
        const r = await overpassSearch(lat, lon, "restaurant");
        const closest = r[0];
        const dist = closest ? haversineKm(lat, lon, closest.lat, closest.lon) : 0;
        addWayraMessage(
          `There are ${r.length} restaurants nearby. Closest: ${closest?.name ?? "spot"} (${dist.toFixed(1)}km). Showing on map! 🍽️`,
        );
        setCategoryMarkers(
          r.map((x, i) => ({ id: `food-${i}`, name: x.name, lat: x.lat, lon: x.lon, emoji: "🍽️", bg: GREEN })),
        );
      } else if (chip.includes("Hospital")) {
        const r = await overpassSearch(lat, lon, "hospital", 10000);
        const closest = r[0];
        const dist = closest ? haversineKm(lat, lon, closest.lat, closest.lon) : 0;
        addWayraMessage(
          `Found ${r.length} hospitals within 10km. Nearest: ${closest?.name ?? "hospital"} - ${dist.toFixed(1)}km. Showing on map! 🏥`,
        );
        setCategoryMarkers(
          r.map((x, i) => ({ id: `hosp-${i}`, name: x.name, lat: x.lat, lon: x.lon, emoji: "🏥", bg: CORAL })),
        );
      } else if (chip.includes("ETA")) {
        if (tripActive && tripSpeed > 0) {
          addWayraMessage(`At ${tripSpeed.toFixed(0)}km/h you're making good progress. Stay on route! 🗺️`);
        } else {
          addWayraMessage("Start a trip so I can calculate ETA! ▶");
        }
      } else if (chip.includes("Weather")) {
        if (weather?.temperature_2m != null) {
          addWayraMessage(
            `Currently ${weather.temperature_2m}°C. ${getWeatherEmoji(weather.weather_code ?? 0)} Check conditions before long walks. 🌤️`,
          );
        } else {
          addWayraMessage("Fetching weather for your area… 🌤️");
          void fetchWeather(lat, lon);
        }
      } else if (chip.includes("Traffic")) {
        if (tripActive && tripSpeed < 20) {
          addWayraMessage(`You seem to be in slow traffic (${tripSpeed.toFixed(0)}km/h). Check alternate routes! 🚦`);
        } else {
          addWayraMessage("Traffic looks clear on your route! Green light! 🟢");
        }
      } else if (chip.includes("Parking")) {
        const r = await overpassSearch(lat, lon, "parking");
        const dist = r[0] ? haversineKm(lat, lon, r[0].lat, r[0].lon) : 0;
        addWayraMessage(`Found ${r.length} parking spots nearby! Closest: ${dist.toFixed(1)}km away. 🅿️`);
      } else if (chip.includes("Coffee")) {
        const r = await overpassSearch(lat, lon, "cafe");
        const dist = r[0] ? haversineKm(lat, lon, r[0].lat, r[0].lon) : 0;
        addWayraMessage(`Coffee time! ☕ ${r.length} cafes nearby. ${r[0]?.name ?? "Cafe"} is just ${dist.toFixed(1)}km away!`);
      }
    },
    [addWayraMessage, fetchWeather, tripActive, tripSpeed, userLocation, weather],
  );

  const handleWayraAsk = useCallback(() => {
    const text = wayraInput.trim();
    if (!text) return;
    setWayraMessages((prev) => [...prev, { role: "user", text, time: Date.now() }]);
    setWayraInput("");
    const lower = text.toLowerCase();
    if (/fuel|petrol|gas/.test(lower)) void handleWayraChip("⛽ Fuel");
    else if (/food|eat|hungry/.test(lower)) void handleWayraChip("🍽️ Food");
    else if (/hotel|stay|sleep/.test(lower)) void handleWayraChip("🏨 Hotels");
    else if (/lost|where/.test(lower)) addWayraMessage(`You're near ${userCity || "your current area"} at ${userLocation?.lat.toFixed(4)}, ${userLocation?.lon.toFixed(4)} 📍`);
    else if (/help|emergency/.test(lower)) setActivePanel("sos");
    else if (/weather|rain/.test(lower)) void handleWayraChip("🌤️ Weather");
    else addWayraMessage("I'm here to help! Try asking about fuel, food, weather, or your ETA. 🤖");
  }, [addWayraMessage, handleWayraChip, userCity, userLocation, wayraInput]);

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    const db = fbRef.current;
    if (!text || !db || !activeGroup || !user) return;
    const chatId = `group_${activeGroup.id}`;
    void push(ref(db, `chats/${chatId}/messages`), {
      sender_id: user.id,
      sender_name: user.full_name,
      text,
      timestamp: Date.now(),
    });
    setChatInput("");
  }, [activeGroup, chatInput, user]);

  const triggerSos = useCallback(() => {
    const db = fbRef.current;
    if (!user || !userLocation) {
      showToast("GPS required for SOS", "error");
      return;
    }
    if (db) {
      void set(ref(db, `sos_alerts/${user.id}`), {
        lat: userLocation.lat,
        lon: userLocation.lon,
        timestamp: Date.now(),
        user_name: user.full_name,
        active: true,
      });
    }
    const url = `https://maps.google.com/?q=${userLocation.lat},${userLocation.lon}`;
    void navigator.clipboard.writeText(`EMERGENCY! ${user.full_name} needs help at: ${url}`);
    showToast("🚨 SOS sent! Location copied!", "error");
    addWayraMessage("🚨 SOS activated! I've alerted your group and copied your location. Help is coming! Stay calm. 💪");
  }, [addWayraMessage, showToast, user, userLocation]);

  // Mount: user, groups, firebase, clock
  useEffect(() => {
    const fb = initFirebase();
    if (fb.ok && fb.db) fbRef.current = fb.db;

    void apiFetch<{ id: string; full_name: string; avatar_url?: string | null }>("/auth/me")
      .then(setUser)
      .catch(() => {});

    void apiFetch<{ id: string; name: string; member_count?: number }[]>("/groups")
      .then((groups) => {
        setUserGroups(groups);
        if (groups[0]) setActiveGroup(groups[0]);
        return groups;
      })
      .then(async (groups) => {
        for (const g of groups) {
          try {
            const trips = await apiFetch<
              { id: string; title?: string; name?: string; description?: string; start_date?: string; status?: string }[]
            >(`/groups/${g.id}/trips`);
            const active = trips.find(
              (t) =>
                t.status === "planning" ||
                (t.start_date && new Date(t.start_date).toDateString() === new Date().toDateString()),
            );
            if (active) {
              setActiveTrip((cur) => cur ?? active);
              break;
            }
          } catch {
            /* skip group */
          }
        }
      })
      .catch(() => {});

    clockRef.current = setInterval(() => setNowClock(Date.now()), 1000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  // GPS watch
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return undefined;

    const onPos = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const speed = (pos.coords.speed || 0) * 3.6;
      setUserLocation({ lat, lon });
      setTripSpeed(Math.max(0, speed));
      setMapCenter([lat, lon]);

      if (tripActive && lastPosition) {
        const d = haversineKm(lastPosition.lat, lastPosition.lon, lat, lon);
        if (d > 0.001) setTripDistance((prev) => prev + d);
      }
      setLastPosition({ lat, lon });

      const db = fbRef.current;
      if (tripActive && user && db) {
        void update(ref(db, `live_trips/${user.id}`), {
          lat,
          lon,
          speed,
          updated_at: Date.now(),
        });
      }

      checkNearbyReports(lat, lon, wazeReports);

      const prev = lastGeoCityRef.current;
      if (!prev || haversineKm(prev.lat, prev.lon, lat, lon) > 0.5) {
        lastGeoCityRef.current = { lat, lon };
        void reverseGeocode(lat, lon).then(setUserCity);
        void fetchWeather(lat, lon);
      }

      if (mapRef.current) mapRef.current.setView([lat, lon], mapRef.current.getZoom());
    };

    const onErr = () => {
      void fetch("https://ipapi.co/json/")
        .then((r) => r.json())
        .then((data: { latitude?: number; longitude?: number; city?: string }) => {
          if (data.latitude != null && data.longitude != null) {
            setUserLocation({ lat: data.latitude, lon: data.longitude });
            setUserCity(data.city || "");
            setMapCenter([data.latitude, data.longitude]);
            void fetchWeather(data.latitude, data.longitude);
          }
        })
        .catch(() => showToast("GPS denied — enable location or use HTTPS", "error"));
    };

    watchRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [checkNearbyReports, fetchWeather, lastPosition, showToast, tripActive, user, wazeReports]);

  // Firebase listeners
  useEffect(() => {
    const db = fbRef.current;
    if (!db) return undefined;

    const reportsRef = ref(db, "waze_reports");
    const offReports = onValue(reportsRef, (snapshot) => {
      const reports: WazeReport[] = [];
      const now = Date.now();
      snapshot.forEach((child) => {
        const r = child.val() as Omit<WazeReport, "id">;
        if (r?.expires_at > now) reports.push({ id: child.key!, ...r });
      });
      setWazeReports(reports);
    });

    const liveRef = ref(db, "live_trips");
    const offLive = onValue(liveRef, (snapshot) => {
      const members: LiveMember[] = [];
      snapshot.forEach((child) => {
        if (child.key !== user?.id && child.val()?.active) {
          members.push({ userId: child.key!, ...child.val() });
        }
      });
      setLiveMembers(members);
    });

    return () => {
      offReports();
      offLive();
    };
  }, [user?.id]);

  // Chat listener
  useEffect(() => {
    const db = fbRef.current;
    if (!db || !activeGroup) return undefined;
    const chatId = `group_${activeGroup.id}`;
    const q = query(ref(db, `chats/${chatId}/messages`), orderByChild("timestamp"), limitToLast(20));
    const offChat = onValue(q, (snapshot) => {
      const msgs: typeof chatMessages = [];
      snapshot.forEach((child) => {
        msgs.push({ id: child.key!, ...child.val() });
      });
      setChatMessages(msgs);
    });
    return () => offChat();
  }, [activeGroup]);

  // Drag panel
  useEffect(() => {
    if (!isDragging) return undefined;
    const onMove = (clientY: number) => {
      const delta = clientY - dragStartY.current;
      const newY = dragStartPanelY.current + (delta / window.innerHeight) * 100;
      setPanelY(Math.min(90, Math.max(10, newY)));
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => onMove(e.touches[0]?.clientY ?? 0);
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      const db = fbRef.current;
      if (tripActive && user && db) void remove(ref(db, `live_trips/${user.id}`));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routePoints = useMemo((): [number, number][] => {
    if (!activeTrip?.description) return [];
    try {
      const parsed = JSON.parse(activeTrip.description) as { locations?: { lat: number; lng?: number; lon?: number }[] };
      return (parsed.locations ?? [])
        .filter((l) => l.lat != null)
        .map((l) => [l.lat, l.lng ?? l.lon ?? 0] as [number, number]);
    } catch {
      return [];
    }
  }, [activeTrip]);

  const nearbyReportCount = useMemo(() => {
    if (!userLocation) return 0;
    return wazeReports.filter((r) => haversineKm(userLocation.lat, userLocation.lon, r.lat, r.lon) < 5).length;
  }, [userLocation, wazeReports]);

  const togglePanel = (id: PanelId) => {
    setActivePanel((cur) => (cur === id ? null : id));
    setPanelOpen(true);
  };

  const defaultCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lon]
    : [20.5937, 78.9629];

  const panelBody = activePanel ? (
    <>
      {activePanel === "launch" && (
        <div className="space-y-3">
          <p className="text-sm font-bold" style={{ color: NAVY }}>🚀 Launch</p>
          <p className="text-[11px] text-gray-500">Group Communication</p>
          <hr />
          {activeGroup ? (
            <>
              <p className="text-[11px] text-gray-500">{activeGroup.name} · {activeGroup.member_count ?? "?"} members</p>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {chatMessages.slice(-5).map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-2 py-1 text-[11px] ${m.sender_id === user?.id ? "ml-4 bg-[#E94560] text-white" : "mr-4 bg-gray-100"}`}
                  >
                    <span className="font-semibold">{m.sender_name}: </span>{m.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Quick message…"
                  className="flex-1 rounded-lg border px-2 py-1 text-[11px]"
                />
                <button type="button" onClick={sendChat} className="rounded-lg bg-[#E94560] px-2 text-white text-[11px]">▶</button>
              </div>
              <p className="text-[10px] font-bold text-[#2ECC71]">● {liveMembers.length} members live</p>
              {liveMembers.map((m) => (
                <p key={m.userId} className="text-[10px] text-gray-600">• {m.user_name ?? "Traveler"}</p>
              ))}
            </>
          ) : (
            <button type="button" onClick={() => router.push("/travel-hub")} className="text-[11px] text-[#E94560] font-bold">
              Connect group →
            </button>
          )}
        </div>
      )}

      {activePanel === "wayra" && (
        <div className="space-y-2">
          <p className="text-sm font-bold" style={{ color: NAVY }}>🤖 Wayra</p>
          <p className="text-[11px] text-gray-500">Smart Travel Companion</p>
          <hr />
          <div className="h-48 overflow-y-auto rounded-lg bg-[#F8F9FA] p-2 space-y-2">
            {wayraMessages.map((m, i) => (
              <div
                key={`${m.time}-${i}`}
                className={`max-w-[90%] rounded-xl px-2 py-1 text-[11px] ${m.role === "wayra" ? "bg-white text-[#0F3460]" : "ml-auto bg-[#E94560] text-white"}`}
              >
                {m.role === "wayra" ? "🤖 " : ""}{m.text}
              </div>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {WAYRA_CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => void handleWayraChip(c)} className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold">{c}</button>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={wayraInput} onChange={(e) => setWayraInput(e.target.value)} placeholder="Ask Wayra…" className="flex-1 rounded-lg border px-2 py-1 text-[11px]" onKeyDown={(e) => e.key === "Enter" && handleWayraAsk()} />
            <button type="button" onClick={handleWayraAsk} className="rounded-lg bg-[#E94560] px-2 text-white text-[11px]">▶</button>
          </div>
        </div>
      )}

      {activePanel === "report" && (
        <div className="space-y-2">
          <p className="text-sm font-bold" style={{ color: NAVY }}>⚠️ Report Incident</p>
          <p className="text-[11px] text-gray-500">Help other travelers</p>
          <hr />
          <div className="grid grid-cols-3 gap-1.5">
            {Object.keys(REPORT_META).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className={`rounded-xl border px-1 py-2 text-[9px] font-bold capitalize ${reportType === t ? "border-[#E94560] bg-[#E94560]/10" : "border-gray-200"}`}
              >
                {getReportEmoji(t)} {t}
              </button>
            ))}
          </div>
          <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} placeholder="Add details (optional)…" className="w-full rounded-lg border p-2 text-[11px] min-h-[48px]" />
          <button type="button" onClick={submitReport} className="w-full rounded-xl bg-[#E94560] py-2 text-[11px] font-bold text-white">📍 Report at my location</button>
          <p className="text-[10px] font-bold text-gray-500">Nearby reports:</p>
          {wazeReports
            .filter((r) => userLocation && haversineKm(userLocation.lat, userLocation.lon, r.lat, r.lon) < 5)
            .slice(0, 5)
            .map((r) => (
              <p key={r.id} className="text-[10px] text-gray-600">
                {getReportEmoji(r.type)} {r.type} · {timeAgo(r.reported_at)} · {haversineKm(userLocation!.lat, userLocation!.lon, r.lat, r.lon).toFixed(1)}km
              </p>
            ))}
        </div>
      )}

      {activePanel === "actions" && (
        <div className="space-y-2">
          <p className="text-sm font-bold" style={{ color: NAVY }}>📍 Quick Actions</p>
          <hr />
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "📍 Drop Pin", fn: async () => {
                if (!userLocation) return;
                const name = window.prompt("Pin name:") || "Interesting spot";
                try {
                  await apiFetch("/pins", { method: "POST", body: JSON.stringify({ lat: userLocation.lat, lng: userLocation.lon, name, flag_type: "interesting" }) });
                  showToast("Pin dropped! 📍", "success");
                } catch { showToast("Pin failed", "error"); }
              }},
              { label: "💸 Expense", fn: () => showToast("Expense logged (demo) 💸", "success") },
              { label: "👥 Share Loc", fn: () => {
                if (!userLocation) return;
                void navigator.clipboard.writeText(`https://maps.google.com/?q=${userLocation.lat},${userLocation.lon}`);
                showToast("Location copied! 📋", "success");
              }},
              { label: "📸 Photo", fn: () => showToast("Photo saved! 📸", "success") },
              { label: "🏁 Meet Here", fn: async () => {
                if (!activeTrip || !userLocation) { showToast("Start a trip first!", "error"); return; }
                try {
                  await apiFetch(`/trips/${activeTrip.id}/meet-points`, { method: "POST", body: JSON.stringify({ latitude: userLocation.lat, longitude: userLocation.lon, name: "Meet Point" }) });
                  showToast("Meet point set! 🏁", "success");
                } catch { showToast("Meet point failed", "error"); }
              }},
              { label: "📋 Note", fn: () => showToast("Note saved! 📋", "success") },
            ].map((a) => (
              <button key={a.label} type="button" onClick={() => void a.fn()} className="rounded-xl border border-gray-200 py-3 text-[9px] font-bold">{a.label}</button>
            ))}
          </div>
        </div>
      )}

      {activePanel === "sos" && (
        <div className="space-y-3 rounded-xl bg-red-50 p-2">
          <p className="text-center text-base font-black text-[#E94560]">🛡️ EMERGENCY SOS</p>
          <button type="button" onClick={triggerSos} className="w-full animate-pulse rounded-xl bg-[#E94560] py-4 text-xl font-black tracking-widest text-white shadow-lg">SOS</button>
          {["🚔 Police: 100", "🚑 Ambulance: 108", "🚒 Fire: 101"].map((l) => (
            <a key={l} href={`tel:${l.split(": ")[1]}`} className="block w-full rounded-lg border bg-white py-2 text-center text-[11px] font-bold">{l}</a>
          ))}
          <p className="text-center text-[9px] text-gray-500">Your location has been copied to clipboard.</p>
        </div>
      )}
    </>
  ) : null;

  const subPanel = panelBody ? (
    <div
      className="absolute left-[200px] top-0 z-[1001] hidden h-auto max-h-[70vh] w-[260px] overflow-y-auto rounded-r-2xl bg-white p-4 shadow-lg md:block"
      style={{ top: `${panelY}%`, transform: "translateY(-20%)" }}
    >
      {panelBody}
    </div>
  ) : null;

  const mobileSubPanel = panelBody ? (
    <div className="fixed inset-x-0 bottom-0 z-[1100] max-h-[60vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl md:hidden">
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300" />
      <button type="button" className="mb-2 text-[11px] text-gray-500" onClick={() => setActivePanel(null)}>✕ Close</button>
      {panelBody}
    </div>
  ) : null;

  return (
    <div className="relative h-[calc(100vh-60px)] w-full overflow-hidden bg-[#F8F9FA]">
      <style jsx global>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

      {/* MAP */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={defaultCenter} zoom={14} className="h-full w-full" scrollWheelZoom>
          <TileLayer url={TILES[mapStyle]} attribution="© OpenStreetMap / Carto" />
          <MapController mapRef={mapRef} center={mapCenter} />

          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lon]} icon={userDivIcon()} />
          )}

          {liveMembers.map((m, i) =>
            m.lat != null && m.lon != null ? (
              <Marker
                key={m.userId}
                position={[m.lat, m.lon]}
                icon={memberDivIcon(MEMBER_COLORS[i % MEMBER_COLORS.length]!, m.user_name || "Member")}
              >
                <Popup>
                  <span className="text-xs font-bold">{m.user_name}</span>
                  <br />
                  <span className="text-[10px] text-green-600">● Live {m.speed ? `${m.speed.toFixed(0)} km/h` : ""}</span>
                </Popup>
              </Marker>
            ) : null,
          )}

          {wazeReports.map((r) => (
            <Marker key={r.id} position={[r.lat, r.lon]} icon={reportDivIcon(r.type)}>
              <Popup>
                <p className="text-xs font-bold capitalize">{r.type}</p>
                <p className="text-[10px] text-gray-500">{r.reporter_name} · {timeAgo(r.reported_at)}</p>
                <p className="text-[10px]">{r.thumbs_up} 👍 {r.thumbs_down} 👎</p>
                <div className="mt-1 flex gap-1">
                  <button type="button" className="text-[10px] text-green-600" onClick={() => void voteReport(r.id, "up")}>👍 Still there</button>
                  <button type="button" className="text-[10px] text-red-600" onClick={() => void voteReport(r.id, "down")}>👎 Gone</button>
                </div>
              </Popup>
            </Marker>
          ))}

          {categoryMarkers.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lon]} icon={categoryDivIcon(m.emoji, m.bg)}>
              <Popup>
                <p className="text-xs font-bold">{m.name}</p>
                {userLocation && (
                  <p className="text-[10px]">{haversineKm(userLocation.lat, userLocation.lon, m.lat, m.lon).toFixed(1)} km</p>
                )}
              </Popup>
            </Marker>
          ))}

          {routePoints.length > 1 && (
            <Polyline positions={routePoints} pathOptions={{ color: CORAL, dashArray: "8 8", weight: 4 }} />
          )}
        </MapContainer>
      </div>

      {/* TOP BAR */}
      <div className="absolute left-[52px] right-3 top-3 z-[1000]">
        <div className="flex items-center gap-2 rounded-3xl bg-white px-4 py-2.5 shadow-md">
          <span className="text-[#E94560]">🔍</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void doSearch()}
            onFocus={() => searchResults.length > 0 && setShowSearch(true)}
            placeholder="Search places, routes…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button type="button" onClick={() => router.push("/profile")} className="h-7 w-7 shrink-0 overflow-hidden rounded-full">
            <img
              src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || "rovvy"}`}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
        </div>
        {showSearch && searchResults.length > 0 && (
          <div className="mt-1 max-h-40 overflow-y-auto rounded-xl bg-white shadow-lg">
            {searchResults.map((r, i) => (
              <button
                key={`${r.lat}-${i}`}
                type="button"
                className="block w-full border-b px-3 py-2 text-left text-[11px] hover:bg-gray-50"
                onClick={() => {
                  const lat = Number(r.lat);
                  const lon = Number(r.lon);
                  mapRef.current?.flyTo([lat, lon], 16);
                  setShowSearch(false);
                }}
              >
                📍 {r.display_name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORY_PILLS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => void searchCategory(p)}
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${activeCategory === p.key ? "bg-[#E94560] text-white" : "bg-white text-[#0F3460]"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIVE COUNTERS top right */}
      <div className="absolute right-3 top-3 z-[999] flex flex-col items-end gap-1">
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#2ECC71] shadow">● {liveMembers.length + 1} live</span>
        {wazeReports.length > 0 && (
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-orange-500 shadow">⚠️ {wazeReports.length} reports</span>
        )}
      </div>

      {/* LEFT PANEL */}
      <div className="absolute left-0 z-[1000]" style={{ top: `${panelY}%`, transform: "translateY(-50%)" }}>
        {!panelOpen ? (
          <button
            type="button"
            className="flex w-11 cursor-grab flex-col items-center gap-3 rounded-r-[20px] bg-white py-4 pl-2 pr-1 shadow-md"
            onMouseDown={(e) => {
              setIsDragging(true);
              dragStartY.current = e.clientY;
              dragStartPanelY.current = panelY;
            }}
            onTouchStart={(e) => {
              setIsDragging(true);
              dragStartY.current = e.touches[0]?.clientY ?? 0;
              dragStartPanelY.current = panelY;
            }}
            onClick={() => setPanelOpen(true)}
          >
            <span className={`h-3 w-3 rounded-full ${tripActive ? "animate-pulse bg-[#2ECC71]" : "bg-[#E94560]"}`} />
            <span className="text-[10px] text-gray-400">⋮⋮</span>
            <span className="text-gray-500">›</span>
          </button>
        ) : (
          <div className="w-[200px] rounded-r-[20px] bg-white p-3 shadow-lg">
            <button type="button" className="mb-2 ml-auto block text-gray-400" onClick={() => setPanelOpen(false)}>✕</button>
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Trip Mode</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${tripActive ? "animate-pulse bg-[#2ECC71]" : "bg-[#E94560]"}`} />
              <div>
                <p className={`text-xs font-bold ${tripActive ? "text-[#2ECC71]" : "text-gray-500"}`}>Solo Trip</p>
                <p className="text-[9px] text-gray-400">{tripActive ? "● LIVE" : "Tap to start"}</p>
              </div>
            </div>
            {tripActive ? (
              <button type="button" onClick={endTrip} className="mt-2 w-full rounded-xl bg-[#E94560] py-2 text-[11px] font-bold text-white">⏹ End Trip</button>
            ) : (
              <button type="button" onClick={startTrip} className="mt-2 w-full rounded-xl bg-[#E94560] py-2 text-[11px] font-bold text-white">▶ Start Trip</button>
            )}
            {tripActive && (
              <div className="mt-3 text-center">
                <p className="font-mono text-2xl font-extrabold tracking-wider" style={{ color: NAVY }}>{formatTime(tripSeconds)}</p>
                <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                  <span>{tripDistance.toFixed(1)} km</span>
                  <span>{tripSpeed.toFixed(0)} km/h</span>
                </div>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {[
                { id: "launch" as const, label: "🚀 LAUNCH" },
                { id: "wayra" as const, label: "🤖 WAYRA" },
                { id: "report" as const, label: "⚠️ REPORT" },
                { id: "actions" as const, label: "📍 ACTIONS" },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => togglePanel(b.id)}
                  className={`rounded-xl border px-1 py-2.5 text-[9px] font-bold ${activePanel === b.id ? "border-[#E94560] bg-[#E94560] text-white" : "border-gray-200 bg-white text-[#0F3460]"}`}
                >
                  {b.label}
                </button>
              ))}
              <button type="button" onClick={() => togglePanel("sos")} className="col-span-2 rounded-xl bg-[#E94560] py-2.5 text-[11px] font-black tracking-widest text-white">🛡️ SOS</button>
            </div>
          </div>
        )}
        {subPanel}
      </div>
      {mobileSubPanel}

      {/* NEARBY ALERT */}
      {nearbyAlert && userLocation && (
        <div className="absolute left-1/2 top-24 z-[2000] flex -translate-x-1/2 items-center gap-2 rounded-2xl px-5 py-3 text-white shadow-xl animate-bounce" style={{ background: NAVY }}>
          <span className="text-2xl">{getReportEmoji(nearbyAlert.type)}</span>
          <div>
            <p className="text-sm font-bold capitalize">{nearbyAlert.type} reported ahead!</p>
            <p className="text-[11px] text-gray-300">
              {(haversineKm(userLocation.lat, userLocation.lon, nearbyAlert.lat, nearbyAlert.lon) * 1000).toFixed(0)}m away
            </p>
          </div>
          <button type="button" onClick={() => setNearbyAlert(null)} className="text-white/70">✕</button>
        </div>
      )}

      {/* BOTTOM LEFT AREA CARD */}
      <div className="absolute bottom-20 left-3 z-[1000] w-[190px] rounded-2xl bg-white p-3 shadow-md">
        <p className="text-sm font-bold" style={{ color: NAVY }}>{userCity || "Locating…"}</p>
        {weather && (
          <p className="mt-1 text-xs text-gray-600">
            {weather.temperature_2m}°C {getWeatherEmoji(weather.weather_code ?? 0)}
          </p>
        )}
        <p className={`mt-1 text-[10px] font-bold ${nearbyReportCount > 0 ? "text-[#E94560]" : "text-[#2ECC71]"}`}>
          {nearbyReportCount > 0 ? `🔴 ${nearbyReportCount} reports nearby` : "🟢 Clear roads ahead"}
        </p>
        {activeTrip && (
          <span className="mt-2 inline-block rounded-full bg-[#E94560] px-2 py-0.5 text-[9px] font-bold text-white">
            ✈️ {activeTrip.title || activeTrip.name}
          </span>
        )}
      </div>

      {/* BOTTOM RIGHT STATS */}
      <div className="absolute bottom-20 right-3 z-[1000] rounded-2xl bg-white p-3 text-center shadow-md">
        {tripActive ? (
          <>
            <p className="font-mono text-xl font-extrabold" style={{ color: NAVY }}>{formatTime(tripSeconds)}</p>
            <p className="text-[10px] text-gray-500">{tripDistance.toFixed(1)}km · {tripSpeed.toFixed(0)}km/h</p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold" style={{ color: NAVY }}>
              {new Date(nowClock).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[10px] text-gray-500">{new Date(nowClock).toLocaleDateString()}</p>
          </>
        )}
      </div>

      {/* RIGHT CONTROLS */}
      <div className="absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2">
        {[
          { label: "+", fn: () => mapRef.current?.zoomIn() },
          { label: "−", fn: () => mapRef.current?.zoomOut() },
          { label: "📍", fn: () => userLocation && mapRef.current?.flyTo([userLocation.lat, userLocation.lon], 16) },
          { label: "🗺️", fn: () => setMapStyle((s) => (s === "street" ? "dark" : s === "dark" ? "satellite" : "street")) },
        ].map((c) => (
          <button key={c.label} type="button" onClick={c.fn} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm shadow-md">
            {c.label}
          </button>
        ))}
      </div>

      {/* TOAST */}
      {toast && (
        <div
          className="fixed right-4 top-[70px] z-[9999] rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
          style={{ background: toast.type === "success" ? GREEN : toast.type === "error" ? CORAL : NAVY }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
