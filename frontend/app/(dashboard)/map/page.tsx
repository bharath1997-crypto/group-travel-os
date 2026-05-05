"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import L from "leaflet";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  formatTemp,
  readStoredTempUnit,
  TEMP_UNIT_STORAGE_KEY,
  type TempUnit,
} from "@/lib/temperature-unit";

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
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false },
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false },
);
const Circle = dynamic(
  () => import("react-leaflet").then((m) => m.Circle),
  { ssr: false },
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false },
);

const MapController = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
        const map = mod.useMap();
        useEffect(() => {
          mapRef.current = map;
        }, [map, mapRef]);
        useEffect(() => {
          const fix = () => {
            map.invalidateSize();
          };
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
        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

const MapPinClickHandler = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner({
        active,
        onPick,
      }: {
        active: boolean;
        onPick: (lat: number, lng: number) => void;
      }) {
        mod.useMapEvents({
          click(e) {
            if (active) onPick(e.latlng.lat, e.latlng.lng);
          },
        });
        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

type PinOut = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  name: string;
  note: string | null;
  flag_type: string;
  created_at: string;
};

type MapMode = "street" | "satellite" | "terrain" | "dark" | "heatmap";
type ActiveView = "nearme" | "world" | "myplan";
type ActiveTab = "pins" | "trending" | "leaders" | "events";

const WMO: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌧️",
  55: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "❄️",
  73: "❄️",
  75: "❄️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

const RADIUS_M: Record<string, number> = {
  "50mi": 80467,
  "100mi": 160934,
  "200mi": 321869,
  "500mi": 804672,
};

const FLAG_META: Record<
  string,
  { bg: string; emoji: string; label: string }
> = {
  dream: { bg: "rgba(124,58,237,0.88)", emoji: "⭐", label: "Dream" },
  interesting: { bg: "rgba(59,130,246,0.88)", emoji: "💡", label: "Interesting" },
  gang_trip: { bg: "rgba(233,69,96,0.88)", emoji: "👥", label: "Gang Trip" },
  visited: { bg: "rgba(34,197,94,0.88)", emoji: "✓", label: "Visited" },
  custom: { bg: "rgba(107,114,128,0.88)", emoji: "📍", label: "Custom" },
};

function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): string {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const d = R * 2 * Math.asin(Math.sqrt(a));
  return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)} km`;
}

function hashStable(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

function parseJwtUserId(token: string | null): string | null {
  if (!token) return null;
  try {
    const p = token.split(".")[1];
    const json = JSON.parse(
      atob(p.replace(/-/g, "+").replace(/_/g, "/")),
    ) as Record<string, unknown>;
    const sub = json.sub ?? json.user_id ?? json.id;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

function placeEmoji(type: string | undefined): string {
  const t = (type || "").toLowerCase();
  if (t.includes("restaurant")) return "🍽️";
  if (t.includes("cafe")) return "☕";
  if (t.includes("hotel")) return "🏨";
  if (t.includes("bar")) return "🍺";
  if (t.includes("museum")) return "🏛️";
  if (t.includes("park")) return "🌳";
  return "📍";
}

function placeColor(type: string | undefined): string {
  const t = (type || "").toLowerCase();
  if (t.includes("restaurant")) return "#f97316";
  if (t.includes("cafe")) return "#f59e0b";
  if (t.includes("hotel")) return "#3b82f6";
  if (t.includes("bar")) return "#a855f7";
  if (t.includes("museum")) return "#14b8a6";
  if (t.includes("park")) return "#22c55e";
  return "#94a3b8";
}

function getInitialMapMode(): MapMode {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 18) return "street";
  return "dark";
}

export default function MapPage() {
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);
  const [mapEmbedded, setMapEmbedded] = useState(false);

  useEffect(() => {
    setMapEmbedded(
      typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("embed") === "1",
    );
  }, []);

  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [sharedLocationMeta, setSharedLocationMeta] = useState<{
    label: string;
    mode: "current" | "live";
  } | null>(null);
  const [address, setAddress] = useState("Getting your location...");
  const [coords, setCoords] = useState("");
  const [weather, setWeather] = useState<Record<string, unknown> | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>(getInitialMapMode);
  const [tempUnit, setTempUnit] = useState<TempUnit>(readStoredTempUnit);
  const [activeView, setActiveView] = useState<ActiveView>("nearme");
  const [activeRadius, setActiveRadius] = useState("100mi");
  const [activeTab, setActiveTab] = useState<ActiveTab>("pins");
  const [savedPins, setSavedPins] = useState<PinOut[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<
    {
      id: string;
      name: string;
      type: string;
      lat: number;
      lon: number;
      cuisine?: string;
      opening_hours?: string;
    }[]
  >([]);
  const [events, setEvents] = useState<
    {
      id: string;
      name: string;
      date: string;
      time?: string;
      type: string;
      price: string;
      distance?: string;
      emoji: string;
      paid?: boolean;
      lat?: number;
      lon?: number;
      venue?: string;
      description?: string;
      raw?: unknown;
    }[]
  >([]);
  const [holidays, setHolidays] = useState<
    { name: string; date: string; daysUntil: number }[]
  >([]);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const [routeMeta, setRouteMeta] = useState<{
    km: string;
    min: string;
  } | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { lat: string; lon: string; display_name: string }[]
  >([]);
  const [addPinMode, setAddPinMode] = useState(false);
  const [newPinCoords, setNewPinCoords] = useState<[number, number] | null>(
    null,
  );
  const [showPinForm, setShowPinForm] = useState(false);
  const [newPinName, setNewPinName] = useState("");
  const [newPinType, setNewPinType] = useState("custom");
  const [newPinNotes, setNewPinNotes] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(
    null,
  );
  const [showWeather, setShowWeather] = useState(false);
  const [forecast, setForecast] = useState<
    {
      date: string;
      max: number;
      min: number;
      code: number;
      rain: number;
    }[]
  >([]);
  const [selectedEvent, setSelectedEvent] = useState<(typeof events)[0] | null>(
    null,
  );
  const [mapChooser, setMapChooser] = useState<{
    open: boolean;
    lat?: number;
    lon?: number;
    label?: string;
    urls?: {
      google: string;
      apple: string;
      waze: string;
      uber: string;
    };
  }>({ open: false });
  const [pinFilter, setPinFilter] = useState<string>("all");
  const [trendingItems, setTrendingItems] = useState<
    {
      id: string;
      name: string;
      country: string;
      trending_score: number;
      emoji: string;
    }[]
  >([]);
  const [flagUrls, setFlagUrls] = useState<Record<string, string>>({});
  const [leaderRows, setLeaderRows] = useState<
    {
      userId: string;
      name: string;
      score: number;
      avatar?: string | null;
    }[]
  >([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(TEMP_UNIT_STORAGE_KEY, tempUnit);
    } catch {
      /* ignore */
    }
  }, [tempUnit]);

  const showToast = useCallback((message: string, type: string) => {
    setToast({ msg: message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAddress = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { "User-Agent": "Travello/1.0" } },
      );
      if (!res.ok) throw new Error("reverse failed");
      const data = (await res.json()) as {
        address?: Record<string, string>;
      };
      const a = data.address || {};
      const parts = [
        a.road,
        a.suburb,
        a.city || a.town || a.village,
        a.state,
      ].filter(Boolean);
      setAddress(parts.join(", ") || "Unknown location");
    } catch {
      setAddress("Location found");
    }
  }, []);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weathercode,windspeed_10m,apparent_temperature` +
        `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max` +
        `&timezone=auto&forecast_days=7`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("weather");
      const data = (await res.json()) as {
        current: Record<string, unknown>;
        daily: {
          time: string[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          weathercode: number[];
          precipitation_probability_max: number[];
        };
      };
      setWeather(data.current);
      const d = data.daily;
      const days: {
        date: string;
        max: number;
        min: number;
        code: number;
        rain: number;
      }[] = [];
      for (let i = 0; i < (d.time?.length || 0); i++) {
        days.push({
          date: d.time[i],
          max: d.temperature_2m_max[i],
          min: d.temperature_2m_min[i],
          code: d.weathercode[i],
          rain: d.precipitation_probability_max[i] ?? 0,
        });
      }
      setForecast(days);
    } catch {
      setWeather(null);
    }
  }, []);

  const fetchNearbyPlaces = useCallback(async (lat: number, lon: number) => {
    try {
      const body = `
[out:json][timeout:25];
(
  node["amenity"~"restaurant|cafe|bar|hotel|attraction|park|museum|tourist_attraction"](around:5000,${lat},${lon});
);
out body 20;
`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error("overpass");
      const data = (await res.json()) as {
        elements?: {
          id: number;
          lat?: number;
          lon?: number;
          tags?: Record<string, string>;
        }[];
      };
      const list =
        data.elements?.map((el, i) => ({
          id: String(el.id ?? i),
          name: el.tags?.name || "Unnamed",
          type: el.tags?.amenity || "place",
          lat: el.lat ?? lat,
          lon: el.lon ?? lon,
          cuisine: el.tags?.cuisine,
          opening_hours: el.tags?.opening_hours,
        })) ?? [];
      setNearbyPlaces(list);
    } catch {
      setNearbyPlaces([]);
    }
  }, []);

  const fetchEvents = useCallback(async (lat: number, lon: number) => {
    const key =
      process.env.NEXT_PUBLIC_TICKETMASTER_KEY ||
      process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY;
    if (!key) {
      setEvents([
        {
          id: "p1",
          name: "Local Food Festival",
          date: "Today",
          type: "Food",
          price: "Free",
          distance: "2.1 km",
          emoji: "🍽️",
          paid: false,
          lat: lat + 0.02,
          lon: lon + 0.015,
          venue: "City Park",
          description: "Sample placeholder event.",
        },
        {
          id: "p2",
          name: "Live Music Night",
          date: "Tomorrow",
          type: "Music",
          price: "₹1200",
          distance: "4.5 km",
          emoji: "🎵",
          paid: true,
          lat: lat - 0.03,
          lon: lon + 0.02,
          venue: "Downtown Hall",
          description: "Sample placeholder event.",
        },
        {
          id: "p3",
          name: "Art Exhibition",
          date: "This weekend",
          type: "Art",
          price: "Free",
          distance: "6.2 km",
          emoji: "🎨",
          paid: false,
          lat: lat + 0.01,
          lon: lon - 0.025,
          venue: "Gallery Row",
          description: "Sample placeholder event.",
        },
      ]);
      return;
    }
    try {
      const url =
        `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(key)}` +
        `&latlong=${lat},${lon}&radius=100&unit=miles&size=10&sort=date,asc`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("tm");
      const data = (await res.json()) as {
        _embedded?: {
          events?: {
            id: string;
            name: string;
            dates?: { start?: { localDate?: string; localTime?: string } };
            priceRanges?: { min?: number; max?: number }[];
            classifications?: { segment?: { name?: string } }[];
            _embedded?: {
              venues?: {
                name?: string;
                location?: { latitude?: string; longitude?: string };
              }[];
            };
            info?: string;
            pleaseNote?: string;
          }[];
        };
      };
      const raw = data._embedded?.events ?? [];
      const mapped = raw.map((e) => {
        const venue = e._embedded?.venues?.[0];
        const plat = venue?.location?.latitude
          ? parseFloat(venue.location.latitude)
          : undefined;
        const plon = venue?.location?.longitude
          ? parseFloat(venue.location.longitude)
          : undefined;
        const paid =
          (e.priceRanges?.[0]?.min ?? 0) > 0 ||
          (e.priceRanges?.[0]?.max ?? 0) > 0;
        const dist =
          plat != null && plon != null
            ? getDistance(lat, lon, plat, plon)
            : undefined;
        return {
          id: e.id,
          name: e.name,
          date: e.dates?.start?.localDate || "TBA",
          time: e.dates?.start?.localTime,
          type: e.classifications?.[0]?.segment?.name || "Event",
          price: paid
            ? `₹${e.priceRanges?.[0]?.min ?? "?"}`
            : "Free",
          distance: dist,
          emoji: "🎟️",
          paid,
          lat: plat,
          lon: plon,
          venue: venue?.name,
          description: e.info || e.pleaseNote || "",
          raw: e,
        };
      });
      setEvents(mapped);
    } catch {
      setEvents([]);
    }
  }, []);

  const fetchHolidays = useCallback(async () => {
    let country = "IN";
    try {
      const ip = await fetch("https://ipapi.co/json/");
      if (ip.ok) {
        const j = (await ip.json()) as { country_code?: string };
        if (j.country_code && j.country_code.length === 2)
          country = j.country_code;
      }
    } catch {
      /* default IN */
    }
    const year = new Date().getFullYear();
    try {
      const res = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
      );
      if (!res.ok) throw new Error("nager");
      const list = (await res.json()) as { date: string; name: string }[];
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 86400000);
      const upcoming = list
        .map((h) => {
          const d = new Date(h.date);
          const daysUntil = Math.ceil(
            (d.getTime() - now.getTime()) / 86400000,
          );
          return { name: h.name, date: h.date, daysUntil, sort: d.getTime() };
        })
        .filter((h) => {
          const d = new Date(h.date);
          return d >= now && d <= in30;
        })
        .sort((a, b) => a.sort - b.sort);
      setHolidays(upcoming.map(({ name, date, daysUntil }) => ({ name, date, daysUntil })));
    } catch {
      setHolidays([]);
    }
  }, []);

  const loadPins = useCallback(() => {
    apiFetch<PinOut[]>("/pins")
      .then((data) => setSavedPins(data || []))
      .catch(() => setSavedPins([]));
  }, []);

  const loadTrending = useCallback(() => {
    apiFetch<{ items: { id: string; name: string; country: string; trending_score: number; category: string }[] }>(
      "/feed/trending?page_size=20",
    )
      .then((data) => {
        const em: Record<string, string> = {
          beach: "🏖️",
          city: "🏙️",
          mountain: "⛰️",
          nature: "🌲",
          default: "✈️",
        };
        setTrendingItems(
          (data.items || []).map((it) => ({
            id: it.id,
            name: it.name,
            country: it.country,
            trending_score: it.trending_score,
            emoji: em[it.category?.toLowerCase?.()] || em.default,
          })),
        );
      })
      .catch(() => setTrendingItems([]));
  }, []);

  const loadLeaders = useCallback(() => {
    apiFetch<
      {
        id: string;
        members: {
          user_id: string;
          full_name: string;
          avatar_url: string | null;
        }[];
      }[]
    >("/groups")
      .then((groups) => {
        const byUser = new Map<
          string,
          { name: string; avatar?: string | null; groups: number }
        >();
        for (const g of groups || []) {
          for (const m of g.members || []) {
            const prev = byUser.get(m.user_id);
            if (prev) prev.groups += 1;
            else
              byUser.set(m.user_id, {
                name: m.full_name,
                avatar: m.avatar_url,
                groups: 1,
              });
          }
        }
        const rows = [...byUser.entries()].map(([userId, v]) => {
          const trips = 1 + hashStable(userId, 8);
          const countries = 1 + hashStable(userId + "c", 5);
          const score = trips * 10 + v.groups * 3 + countries * 15;
          return {
            userId,
            name: v.name,
            score,
            avatar: v.avatar,
          };
        });
        rows.sort((a, b) => b.score - a.score);
        setLeaderRows(rows.slice(0, 20));
      })
      .catch(() => setLeaderRows([]));
  }, []);

  useEffect(() => {
    setCurrentUserId(parseJwtUserId(getToken()));
  }, []);

  useEffect(() => {
    loadPins();
    loadTrending();
    loadLeaders();
  }, [loadPins, loadTrending, loadLeaders]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedLat = Number(params.get("lat"));
    const sharedLon = Number(params.get("lon") ?? params.get("lng"));
    if (Number.isFinite(sharedLat) && Number.isFinite(sharedLon)) {
      const mode = params.get("mode") === "live" ? "live" : "current";
      setSharedLocationMeta({
        label: params.get("label") || "Shared location",
        mode,
      });
      setUserLocation([sharedLat, sharedLon]);
      setCoords(`${sharedLat.toFixed(4)}° N · ${sharedLon.toFixed(4)}° E`);
      void Promise.all([
        fetchAddress(sharedLat, sharedLon),
        fetchWeather(sharedLat, sharedLon),
        fetchNearbyPlaces(sharedLat, sharedLon),
        fetchEvents(sharedLat, sharedLon),
        fetchHolidays(),
      ]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation([lat, lon]);
        setCoords(`${lat.toFixed(4)}° N · ${lon.toFixed(4)}° E`);
        await Promise.all([
          fetchAddress(lat, lon),
          fetchWeather(lat, lon),
          fetchNearbyPlaces(lat, lon),
          fetchEvents(lat, lon),
          fetchHolidays(),
        ]);
      },
      () => {
        setAddress("Enable location access");
        const lat = 17.4318;
        const lon = 78.4073;
        setUserLocation([lat, lon]);
        setCoords(`${lat.toFixed(4)}° N · ${lon.toFixed(4)}° E`);
        void Promise.all([
          fetchAddress(lat, lon),
          fetchWeather(lat, lon),
          fetchNearbyPlaces(lat, lon),
          fetchEvents(lat, lon),
          fetchHolidays(),
        ]);
      },
    );
  }, [
    fetchAddress,
    fetchWeather,
    fetchNearbyPlaces,
    fetchEvents,
    fetchHolidays,
  ]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    if (activeView === "world") {
      mapRef.current.setView([12, 0], 2);
    } else {
      mapRef.current.setView(userLocation, 13);
    }
  }, [activeView, userLocation]);

  useEffect(() => {
    if (routePoints.length < 2) {
      setRouteLine(null);
      setRouteMeta(null);
      return;
    }
    const pts = routePoints;
    const coordStr = pts.map(([la, lo]) => `${lo},${la}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((data: { routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[] }) => {
        const coords = data.routes?.[0]?.geometry?.coordinates;
        if (!coords?.length) {
          setRouteLine(null);
          setRouteMeta(null);
          return;
        }
        const line = coords.map(([lo, la]) => [la, lo] as [number, number]);
        setRouteLine(line);
        const distM = data.routes?.[0]?.distance ?? 0;
        const durS = data.routes?.[0]?.duration ?? 0;
        setRouteMeta({
          km: `${(distM / 1000).toFixed(1)} km`,
          min: `${Math.round(durS / 60)} min`,
        });
      })
      .catch(() => {
        setRouteLine(null);
        setRouteMeta(null);
      });
  }, [routePoints]);

  useEffect(() => {
    if (!searchDebounce.current) return;
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&addressdetails=1`,
          { headers: { "User-Agent": "Travello/1.0" } },
        );
        if (!res.ok) return;
        const j = (await res.json()) as {
          lat: string;
          lon: string;
          display_name: string;
        }[];
        setSearchResults(j);
      } catch {
        setSearchResults([]);
      }
    }, 500);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function loadFlags() {
      const next: Record<string, string> = { ...flagUrls };
      for (const it of trendingItems.slice(0, 12)) {
        if (next[it.country]) continue;
        try {
          const res = await fetch(
            `https://restcountries.com/v3.1/name/${encodeURIComponent(it.country)}?fields=cca2`,
          );
          if (!res.ok) continue;
          const j = (await res.json()) as { cca2?: string }[];
          const code = j[0]?.cca2?.toLowerCase();
          if (code) next[it.country] = `https://flagcdn.com/24x18/${code}.png`;
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setFlagUrls(next);
    }
    if (trendingItems.length) void loadFlags();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- batch cache merge
  }, [trendingItems]);

  const userMarkerIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:56px;height:56px;border-radius:9999px;background:rgba(59,130,246,0.12);animation:pulse 2s infinite;"></div>
          <div style="position:absolute;width:38px;height:38px;border-radius:9999px;background:rgba(59,130,246,0.18);animation:pulse 2s infinite;animation-delay:0.3s;"></div>
          <div style="width:18px;height:18px;border-radius:9999px;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 16px rgba(59,130,246,0.8);"></div>
        </div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      }),
    [],
  );

  const wmoCode = weather?.weathercode as number | undefined;
  const wmoEmoji = wmoCode != null ? WMO[wmoCode] ?? "🌤️" : "🌤️";
  const tempNow = weather?.temperature_2m as number | undefined;

  const filteredPins = useMemo(() => {
    if (pinFilter === "all") return savedPins;
    return savedPins.filter((p) => p.flag_type === pinFilter);
  }, [savedPins, pinFilter]);

  const pinCounts = useMemo(() => {
    const c = { dream: 0, visited: 0, gang_trip: 0, interesting: 0 };
    for (const p of savedPins) {
      if (p.flag_type === "dream") c.dream++;
      if (p.flag_type === "visited") c.visited++;
      if (p.flag_type === "gang_trip") c.gang_trip++;
      if (p.flag_type === "interesting") c.interesting++;
    }
    return c;
  }, [savedPins]);

  const top3 = leaderRows.slice(0, 3);
  const meIndex = leaderRows.findIndex((r) => r.userId === currentUserId);
  const meRow = meIndex >= 0 ? leaderRows[meIndex] : undefined;
  const nextAbove = meIndex > 0 ? leaderRows[meIndex - 1] : null;
  const pointsToNext =
    meRow && nextAbove ? Math.max(0, nextAbove.score - meRow.score) : 0;

  async function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    if (!newPinCoords) return;
    try {
      const created = await apiFetch<PinOut>("/pins", {
        method: "POST",
        body: JSON.stringify({
          lat: newPinCoords[0],
          lng: newPinCoords[1],
          name: newPinName.trim() || "Pin",
          flag_type: newPinType,
          note: newPinNotes.trim() || null,
        }),
      });
      setSavedPins((prev) => [created, ...prev]);
      setShowPinForm(false);
      setNewPinCoords(null);
      setNewPinName("");
      setNewPinNotes("");
      showToast("Pin saved! 📍", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  }

  async function handleDeletePin(id: string) {
    try {
      await apiFetch(`/pins/${id}`, { method: "DELETE" });
      setSavedPins((prev) => prev.filter((p) => p.id !== id));
      showToast("Pin removed", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    }
  }

  function openInMaps(lat: number, lon: number, label: string) {
    const encodedLabel = encodeURIComponent(label);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
      apple: `maps://maps.apple.com/?daddr=${lat},${lon}&q=${encodedLabel}`,
      waze: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
      uber: `uber://?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lon}&dropoff[nickname]=${encodedLabel}`,
    };
    if (isAndroid) {
      window.location.href = `geo:${lat},${lon}?q=${lat},${lon}(${encodedLabel})`;
      return;
    }
    if (isIOS) {
      setMapChooser({ open: true, lat, lon, label, urls });
      return;
    }
    window.open(urls.google, "_blank");
  }

  function selectSearchResult(lat: number, lon: number) {
    mapRef.current?.flyTo([lat, lon], 14);
    setSearchQuery("");
    setSearchResults([]);
    setSearchFocused(false);
    if (activeView === "myplan") {
      setRoutePoints((prev) => [...prev, [lat, lon]]);
    }
    if (addPinMode) {
      setNewPinCoords([lat, lon]);
      setShowPinForm(true);
      setAddPinMode(false);
    }
  }

  function onMapPick(lat: number, lng: number) {
    setNewPinCoords([lat, lng]);
    setShowPinForm(true);
    setAddPinMode(false);
  }

  function handleMapModeChange(m: MapMode) {
    setMapMode(m);
  }

  function handleLiveGps() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation([lat, lon]);
        setCoords(`${lat.toFixed(4)}° N · ${lon.toFixed(4)}° E`);
        mapRef.current?.flyTo([lat, lon], 15, { duration: 1.2 });
        void Promise.all([
          fetchAddress(lat, lon),
          fetchWeather(lat, lon),
          fetchNearbyPlaces(lat, lon),
          fetchEvents(lat, lon),
        ]);
      },
      () => showToast("Could not get your location", "error"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const FALLBACK_CENTER: [number, number] = [17.4318, 78.4073];
  const mapCenter = userLocation ?? FALLBACK_CENTER;
  const radiusM = RADIUS_M[activeRadius] ?? 160934;

  const tileUrl =
    mapMode === "street"
      ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      : mapMode === "satellite"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : mapMode === "terrain"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
          : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  const tileAttribution =
    mapMode === "street"
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      : mapMode === "satellite" || mapMode === "terrain"
        ? "Tiles © Esri"
        : mapMode === "heatmap"
          ? "© CartoDB"
          : "© OpenStreetMap © CartoDB";

  const cartoSubdomains =
    mapMode === "street" || mapMode === "satellite" || mapMode === "terrain"
      ? {}
      : { subdomains: "abcd" as const };

  const rainWarn = forecast.find((d) => d.rain > 60);

  const cityShort = useMemo(() => {
    if (address.includes("Getting your location")) return "";
    const first = address.trim().split(/\s+/)[0] ?? "";
    return first.length > 12 ? `${first.slice(0, 12)}…` : first;
  }, [address]);

  const eventGroups = useMemo(() => {
    const t: typeof events = [];
    const tm: typeof events = [];
    const w: typeof events = [];
    for (const ev of events) {
      if (ev.date === "Today" || ev.date.includes(new Date().getDate().toString()))
        t.push(ev);
      else if (ev.date === "Tomorrow") tm.push(ev);
      else w.push(ev);
    }
    if (!t.length && !tm.length && w.length) return { today: events.slice(0, 3), tomorrow: [], weekend: events.slice(3) };
    return { today: t, tomorrow: tm, weekend: w };
  }, [events]);

  return (
    <div
      className={
        mapEmbedded
          ? "relative h-[320px] w-full min-h-[260px] overflow-hidden rounded-xl bg-white sm:h-[360px]"
          : "relative h-screen w-full min-h-0 overflow-hidden bg-white md:h-full md:flex-1"
      }
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .leaflet-popup-content-wrapper {
          background: white !important;
          color: #111827 !important;
          border-radius: 12px !important;
          border: 1px solid rgba(0,0,0,0.1) !important;
        }
        .leaflet-popup-tip {
          background: white !important;
        }
        .leaflet-popup-close-button {
          color: #6b7280 !important;
        }
        .leaflet-control-attribution {
          background: rgba(255,255,255,0.92) !important;
          color: #6b7280 !important;
          font-size: 9px !important;
        }
        .leaflet-container {
          background: #e5e7eb !important;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0.2; }
        }
      `,
        }}
      />

      {/* View switcher + top chrome (hidden when ?embed=1) */}
      {!mapEmbedded ? (
      <>
      <div
        className="absolute left-1/2 z-[1000] flex -translate-x-1/2 gap-0.5 rounded-[30px] border border-black/10 bg-white p-1 shadow-md"
        style={{ top: 14 }}
      >
        {(
          [
            ["nearme", "🌍 Near Me"],
            ["world", "🔥 World"],
            ["myplan", "📋 My Plan"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setActiveView(v)}
            className="rounded-[26px] px-3 py-1.5 text-xs font-semibold transition-all"
            style={
              activeView === v
                ? {
                    background: "#E94560",
                    color: "#fff",
                    boxShadow: "0 2px 12px rgba(233,69,96,0.5)",
                  }
                : { color: "#6b7280" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* A — Search bar (top left) */}
      <div className="absolute left-[14px] top-[14px] z-[1000] w-[280px] max-md:w-[calc(100%-90px)]">
        <div className="relative">
          <div className="flex items-center gap-2 rounded-[24px] bg-white py-2.5 pl-4 pr-3 shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
            <span className="shrink-0 text-[#E94560]" aria-hidden>
              🔍
            </span>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchBlurRef.current) clearTimeout(searchBlurRef.current);
                setSearchFocused(true);
              }}
              onBlur={() => {
                searchBlurRef.current = setTimeout(
                  () => setSearchFocused(false),
                  180,
                );
              }}
              placeholder="Search location..."
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#2C3E50] outline-none placeholder:text-[#6C757D]"
            />
          </div>
          {searchFocused && searchResults.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full z-[1001] mt-1 max-h-48 overflow-auto rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-lg">
              {searchResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="flex w-full gap-2 px-3 py-2 text-left text-xs text-[#111827] hover:bg-gray-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      selectSearchResult(
                        parseFloat(r.lat),
                        parseFloat(r.lon),
                      )
                    }
                  >
                    <span className="text-[#E94560]">📍</span>
                    <span>{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* B — Location + weather chip (top right) */}
      {weather ? (
        <div className="absolute right-[14px] top-[14px] z-[1000] flex max-w-[200px] items-center gap-1.5 rounded-[20px] bg-white px-3 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.15)] max-md:w-[70px] max-md:max-w-[70px] max-md:justify-center max-md:gap-1 max-md:px-2">
          <span
            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#E94560]"
            aria-hidden
          />
          {cityShort ? (
            <span className="hidden min-w-0 truncate text-xs font-semibold text-[#0F3460] md:inline">
              {cityShort}
            </span>
          ) : null}
          {cityShort ? (
            <span className="hidden text-[#ADB5BD] md:inline" aria-hidden>
              |
            </span>
          ) : null}
          <span className="text-base leading-none">{wmoEmoji}</span>
          <span className="text-xs font-bold text-[#0F3460]">
            {tempNow != null ? formatTemp(tempNow, tempUnit) : "—"}
          </span>
          <div
            className="ml-0.5 flex gap-0.5 text-[9px] font-semibold text-[#6C757D]"
            role="group"
            aria-label="Temperature unit"
          >
            <button
              type="button"
              onClick={() => setTempUnit("C")}
              className={
                tempUnit === "C" ? "font-bold text-[#0F3460]" : ""
              }
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => setTempUnit("F")}
              className={
                tempUnit === "F" ? "font-bold text-[#0F3460]" : ""
              }
            >
              °F
            </button>
          </div>
        </div>
      ) : null}

      {/* C — Map mode pills (below view switcher) */}
      <div className="absolute left-1/2 top-[58px] z-[1000] flex max-w-[calc(100vw-24px)] -translate-x-1/2 gap-1 rounded-[20px] bg-white px-2 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.12)] max-md:overflow-x-auto max-md:px-1.5 [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["street", "Street"],
            ["satellite", "Satellite"],
            ["terrain", "Terrain"],
            ["dark", "Dark"],
            ["heatmap", "Heatmap"],
          ] as const
        ).map(([m, lab]) => (
          <button
            key={m}
            type="button"
            onClick={() => handleMapModeChange(m)}
            className={[
              "shrink-0 whitespace-nowrap rounded-2xl px-2.5 py-1 font-bold max-md:px-2 max-md:py-1 max-md:text-[9px]",
              mapMode === m
                ? "bg-[#E94560] px-2.5 py-1 text-[10px] text-white max-md:px-2 max-md:text-[9px]"
                : "bg-transparent px-2.5 py-1 text-[10px] text-[#6C757D] max-md:px-2 max-md:text-[9px]",
            ].join(" ")}
          >
            {lab}
          </button>
        ))}
      </div>

      </>
      ) : null}

      {!mapEmbedded && addPinMode && (
        <div
          className="absolute left-4 right-4 z-[1000] rounded-full border border-black/10 bg-white px-3 py-2 text-center text-xs text-gray-900 shadow-md"
          style={{ top: 100 }}
        >
          Tap anywhere on the map to pin
        </div>
      )}

      {/* Map — base layer; overlays use z-[1000]+ */}
      <div className="absolute inset-0 z-0 min-h-0 w-full">
        <MapContainer
          center={mapCenter}
          zoom={13}
          zoomControl={false}
          className="absolute inset-0 z-0 h-full w-full"
        >
          <MapController mapRef={mapRef} />
          <MapPinClickHandler
            active={addPinMode && !mapEmbedded}
            onPick={onMapPick}
          />
          <TileLayer
            key={mapMode}
            url={tileUrl}
            attribution={tileAttribution}
            {...cartoSubdomains}
          />
          {userLocation && (
            <Circle
              center={userLocation}
              radius={radiusM}
              pathOptions={{
                color: "#E94560",
                fillColor: "#E94560",
                fillOpacity: 0.03,
                weight: 1.5,
                dashArray: "8 6",
              }}
            />
          )}
          {mapMode === "heatmap" &&
            nearbyPlaces.map((p) => (
              <Circle
                key={`h-${p.id}`}
                center={[p.lat, p.lon]}
                radius={420}
                pathOptions={{
                  color: "#E94560",
                  fillColor: "#E94560",
                  fillOpacity: 0.08,
                  weight: 0,
                }}
              />
            ))}
          {userLocation && (
            <Marker position={userLocation} icon={userMarkerIcon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-[#111827]">
                    {sharedLocationMeta
                      ? `${sharedLocationMeta.label} ${
                          sharedLocationMeta.mode === "live"
                            ? "live location"
                            : "current location"
                        }`
                      : "📍 You are here"}
                  </p>
                  <p className="text-xs text-[#6b7280]">{address}</p>
                  <p className="text-[10px] text-[#6b7280]">{coords}</p>
                </div>
              </Popup>
            </Marker>
          )}
          {savedPins.map((pin) => {
            const meta = FLAG_META[pin.flag_type] || FLAG_META.custom;
            const short =
              pin.name.length > 10 ? pin.name.slice(0, 10) + "…" : pin.name;
            const icon = L.divIcon({
              className: "",
              html: `<div style="position:relative;display:inline-block;">
                <div style="background:${meta.bg};color:#fff;border-radius:9999px;padding:4px 8px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;box-shadow:0 2px 8px rgba(0,0,0,0.35);">
                  <span>${meta.emoji}</span><span>${short}</span>
                </div>
                <div style="margin:-2px auto 0;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${meta.bg};opacity:0.9;"></div>
              </div>`,
              iconSize: [120, 36],
              iconAnchor: [60, 34],
            });
            return (
              <Marker
                key={pin.id}
                position={[pin.latitude, pin.longitude]}
                icon={icon}
              >
                <Popup>
                  <div className="max-w-[220px] text-sm">
                    <p className="font-bold text-[#111827]">{pin.name}</p>
                    <span
                      className="mt-1 inline-block rounded px-2 py-0.5 text-[10px] text-white"
                      style={{ background: meta.bg }}
                    >
                      {meta.label}
                    </span>
                    <p className="mt-1 text-[10px] text-[#6b7280]">
                      {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                    </p>
                    <p className="text-[10px] text-[#6b7280]">
                      {new Date(pin.created_at).toLocaleString()}
                    </p>
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg bg-[#E94560] py-1.5 text-[11px] font-bold text-white"
                      onClick={() =>
                        openInMaps(pin.latitude, pin.longitude, pin.name)
                      }
                    >
                      📍 Get Directions
                    </button>
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg bg-red-500/90 py-1.5 text-xs font-semibold text-white"
                      onClick={() => void handleDeletePin(pin.id)}
                    >
                      Remove
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {nearbyPlaces.map((p) => {
            const col = placeColor(p.type);
            const em = placeEmoji(p.type);
            const icon = L.divIcon({
              className: "",
              html: `<div style="width:26px;height:26px;border-radius:9999px;background:${col};display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 6px rgba(0,0,0,0.35);">${em}</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });
            return (
              <Marker key={`n-${p.id}`} position={[p.lat, p.lon]} icon={icon}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-[#111827]">{p.name}</p>
                    <p className="text-[#6b7280]">{p.type}</p>
                    {p.opening_hours && (
                      <p className="mt-1 text-[10px] text-[#6b7280]">
                        {p.opening_hours}
                      </p>
                    )}
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg bg-[#E94560] py-1.5 text-[11px] font-bold text-white"
                      onClick={() => openInMaps(p.lat, p.lon, p.name)}
                    >
                      📍 Get Directions
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {events.map((ev) => {
            if (ev.lat == null || ev.lon == null) return null;
            const free = !ev.paid;
            const icon = L.divIcon({
              className: "",
              html: `<div style="width:28px;height:28px;border-radius:9999px;background:${free ? "#22c55e" : "#E94560"};display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.4);">${free ? "🟢" : "🔴"}</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });
            return (
              <Marker
                key={`e-${ev.id}`}
                position={[ev.lat, ev.lon]}
                icon={icon}
                eventHandlers={{
                  click: () => setSelectedEvent(ev),
                }}
              />
            );
          })}
          {routePoints.map(([la, lo], i) => (
            <Marker
              key={`rp-${i}`}
              position={[la, lo]}
              icon={L.divIcon({
                className: "",
                html: `<div style="min-width:22px;height:22px;border-radius:9999px;background:#E94560;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;">${i + 1}</div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              })}
            />
          ))}
          {routeLine && routeLine.length > 1 && (
            <Polyline
              positions={routeLine}
              pathOptions={{
                color: "#E94560",
                weight: 4,
                opacity: 0.8,
              }}
            />
          )}
        </MapContainer>
      </div>

      {!mapEmbedded ? (
      <>
      {/* Radius */}
      <div
        className="absolute left-3.5 z-[1000] flex -translate-y-1/2 flex-col gap-1"
        style={{ top: "50%" }}
      >
        {(["50mi", "100mi", "200mi", "500mi"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setActiveRadius(r)}
            className="rounded-full border px-2 py-1.5 text-[10px] font-semibold shadow-sm"
            style={
              activeRadius === r
                ? {
                    background: "#E94560",
                    color: "#fff",
                    borderColor: "rgba(233,69,96,0.5)",
                  }
                : {
                    background: "#ffffff",
                    color: "#111827",
                    borderColor: "rgba(0,0,0,0.08)",
                  }
            }
          >
            {r.replace("mi", " mi")}
          </button>
        ))}
      </div>

      {/* Right controls — live GPS above zoom */}
      <div
        className="absolute right-3.5 z-[1000] flex -translate-y-1/2 flex-col gap-2"
        style={{ top: "50%" }}
      >
        <button
          type="button"
          aria-label="Go to current GPS location"
          title="Current location"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#E94560]/30 bg-[#E94560] text-xl text-white shadow-lg ring-2 ring-white"
          onClick={() => handleLiveGps()}
        >
          📍
        </button>
        <button
          type="button"
          aria-label="Search"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-black/10 bg-white text-lg text-gray-900 shadow-md"
          onClick={() => searchInputRef.current?.focus()}
        >
          🔍
        </button>
        <button
          type="button"
          aria-label="Add pin"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-black/10 bg-white text-lg text-gray-900 shadow-md"
          onClick={() => setAddPinMode(true)}
        >
          📌
        </button>
        <div className="my-0.5 h-px w-full bg-black/10" />
        <button
          type="button"
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-black/10 bg-white text-lg font-semibold text-gray-900 shadow-md"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-black/10 bg-white text-lg font-semibold text-gray-900 shadow-md"
          onClick={() => mapRef.current?.zoomOut()}
        >
          −
        </button>
      </div>

      {/* Route summary — above compact row */}
      {activeView === "myplan" && routeMeta ? (
        <div
          className="absolute bottom-[255px] left-1/2 z-[1000] -translate-x-1/2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-center text-xs shadow-md"
        >
          <p className="font-bold text-[#E94560]">{routeMeta.km}</p>
          <p className="text-gray-500">{routeMeta.min}</p>
        </div>
      ) : null}
      {/* Weather panel — above compact row */}
      {showWeather && forecast.length > 0 ? (
        <div className="absolute bottom-[245px] left-4 right-4 z-[999] rounded-2xl bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
          {rainWarn ? (
            <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
              🌧️ Rain expected {rainWarn.date}
            </p>
          ) : null}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {forecast.map((d) => {
              const day = new Date(d.date).toLocaleDateString(undefined, {
                weekday: "short",
              });
              return (
                <div
                  key={d.date}
                  className="min-w-[88px] shrink-0 rounded-xl border border-black/10 bg-gray-50 p-2 text-center"
                >
                  <p className="text-[10px] font-bold text-gray-900">{day}</p>
                  <p className="text-[9px] text-gray-500">{d.date}</p>
                  <p className="text-lg">{WMO[d.code] ?? "🌤️"}</p>
                  <p className="text-[11px] text-gray-900">
                    {formatTemp(d.max, tempUnit)} / {formatTemp(d.min, tempUnit)}
                  </p>
                  <p className="text-[9px] text-sky-600">
                    💧 {Math.round(d.rain)}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Compact row — pins/events + forecast toggle */}
      <div className="absolute bottom-[205px] left-4 right-4 z-[1000] flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
          <span
            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#E94560]"
            aria-hidden
          />
          <span className="min-w-0 text-[11px] text-[#0F3460]">
            {savedPins.length} pins · {events.length} events
          </span>
          <button
            type="button"
            className="ml-auto shrink-0 text-[10px] font-semibold text-[#E94560]"
            onClick={() => setActiveTab("events")}
          >
            View all →
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowWeather((s) => !s)}
          className="flex w-[120px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
        >
          <span className="text-base leading-none">{wmoEmoji}</span>
          <span className="text-[11px] font-medium text-[#0F3460]">
            Forecast
          </span>
          <span className="text-[11px] text-[#6C757D]" aria-hidden>
            {showWeather ? "▲" : "▼"}
          </span>
        </button>
      </div>

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1000] flex flex-col overflow-hidden rounded-t-[28px] border border-[rgba(0,0,0,0.08)] border-b-0 bg-white shadow-md"
        style={{ height: 205 }}
      >
        <div className="flex justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-[rgba(0,0,0,0.12)]" />
        </div>
        <div className="flex shrink-0 border-b border-[rgba(0,0,0,0.08)] px-2 pt-1">
          {(
            [
              ["pins", "📍 My Pins"],
              ["trending", "🔥 Trending"],
              ["leaders", "🏆 Leaders"],
              ["events", "📅 Events"],
            ] as const
          ).map(([t, lab]) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className="flex-1 py-2 text-center text-[11px] font-semibold"
              style={
                activeTab === t
                  ? {
                      color: "#E94560",
                      borderBottom: "2.5px solid #E94560",
                    }
                  : { color: "#6b7280" }
              }
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-2">
          {activeTab === "pins" && (
            <div>
              <p className="mb-2 text-[10px] text-[#6b7280]">
                📍 {savedPins.length} · ⭐ {pinCounts.dream} · ✓{" "}
                {pinCounts.visited} · 👥 {pinCounts.gang_trip} · 💡{" "}
                {pinCounts.interesting}
              </p>
              <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
                {["all", "dream", "visited", "gang_trip", "interesting"].map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPinFilter(f)}
                      className="shrink-0 rounded-full px-2 py-1 text-[10px]"
                      style={
                        pinFilter === f
                          ? { background: "#E94560", color: "#fff" }
                          : {
                              background: "#f3f4f6",
                              color: "#6b7280",
                            }
                      }
                    >
                      {f === "all"
                        ? "All"
                        : f === "dream"
                          ? "⭐ Dream"
                          : f === "visited"
                            ? "✓ Visited"
                            : f === "gang_trip"
                              ? "👥 Gang"
                              : "💡 Interesting"}
                    </button>
                  ),
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filteredPins.map((pin) => {
                  const meta = FLAG_META[pin.flag_type] || FLAG_META.custom;
                  return (
                    <div
                      key={pin.id}
                      className="w-[110px] shrink-0 overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white shadow-sm"
                    >
                      <div
                        className="flex items-center justify-center border-b py-1 text-lg"
                        style={{ borderColor: meta.bg }}
                      >
                        {meta.emoji}
                      </div>
                      <div className="p-1.5">
                        <p className="truncate text-[11px] font-semibold text-[#111827]">
                          {pin.name}
                        </p>
                        <p className="truncate text-[9px] text-[#6b7280]">
                          {pin.latitude.toFixed(2)}, {pin.longitude.toFixed(2)}
                        </p>
                        <p className="text-[9px] text-[#6b7280]">
                          {new Date(pin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAddPinMode(true)}
                  className="flex w-[110px] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(0,0,0,0.15)] p-2 text-[10px] text-[#6b7280]"
                >
                  + Add pin
                </button>
              </div>
              {savedPins.length === 0 && (
                <p className="py-4 text-center text-[11px] text-[#6b7280]">
                  No pins saved yet. Tap + to add your first pin.
                </p>
              )}
            </div>
          )}
          {activeTab === "trending" && (
            <div className="space-y-2">
              {holidays.slice(0, 3).map((h) => (
                <div
                  key={h.date + h.name}
                  className="rounded-lg border border-[#E94560]/30 bg-rose-50 px-2 py-1.5 text-[10px] text-[#E94560]"
                >
                  🎉 {h.name} in {h.daysUntil} days — Consider planning a trip!
                </div>
              ))}
              {trendingItems.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2 rounded-lg border border-[rgba(0,0,0,0.08)] bg-gray-50 px-2 py-1.5"
                >
                  <span className="text-lg">{it.emoji}</span>
                  {flagUrls[it.country] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={flagUrls[it.country]}
                      alt=""
                      className="h-4 w-5 rounded-sm object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-[#111827]">
                      {it.name}
                    </p>
                    <p className="text-[9px] text-[#6b7280]">
                      {it.country} · {Math.round(it.trending_score)} travelers
                      this week
                    </p>
                  </div>
                  <span className="text-[9px] text-[#6b7280]">—</span>
                </div>
              ))}
              {trendingItems.length === 0 && (
                <p className="text-center text-[11px] text-[#6b7280]">
                  No trending data.
                </p>
              )}
            </div>
          )}
          {activeTab === "leaders" && (
            <div>
              {top3.map((row, idx) => (
                <div
                  key={row.userId}
                  className="mb-1 flex items-center gap-2 rounded-lg border border-[rgba(0,0,0,0.08)] bg-gray-50 px-2 py-1.5"
                  style={
                    row.userId === currentUserId
                      ? { borderColor: "#E94560" }
                      : {}
                  }
                >
                  <span>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-[#111827]">
                      {row.name}
                    </p>
                    <p className="text-[9px] text-[#6b7280]">{row.score} pts</p>
                  </div>
                </div>
              ))}
              {meRow && nextAbove && pointsToNext > 0 && (
                <p className="mt-2 text-[10px] text-[#6b7280]">
                  {pointsToNext} more points to pass {nextAbove.name}
                </p>
              )}
              {meRow && nextAbove && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (meRow.score / nextAbove.score) * 100)}%`,
                      background: "#E94560",
                    }}
                  />
                </div>
              )}
              {leaderRows.length === 0 && (
                <p className="text-center text-[11px] text-[#6b7280]">
                  Join groups to appear on the leaderboard.
                </p>
              )}
            </div>
          )}
          {activeTab === "events" && (
            <div className="space-y-3 text-[11px]">
              {["today", "tomorrow", "weekend"].map((section) => {
                const list =
                  section === "today"
                    ? eventGroups.today
                    : section === "tomorrow"
                      ? eventGroups.tomorrow
                      : eventGroups.weekend;
                if (!list.length) return null;
                return (
                  <div key={section}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
                      {section === "today"
                        ? "TODAY"
                        : section === "tomorrow"
                          ? "TOMORROW"
                          : "THIS WEEKEND"}
                    </p>
                    {list.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className="mb-1 flex w-full items-start gap-2 rounded-lg border border-[rgba(0,0,0,0.08)] bg-gray-50 px-2 py-1.5 text-left"
                      >
                        <span className="text-lg">{ev.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#111827]">{ev.name}</p>
                          <p className="text-[9px] text-[#6b7280]">
                            {ev.time || ev.date} · {ev.venue || "Venue TBA"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px]"
                              style={{
                                background: ev.paid
                                  ? "rgba(233,69,96,0.15)"
                                  : "rgba(34,197,94,0.15)",
                                color: "#111827",
                              }}
                            >
                              {ev.price}
                            </span>
                            {ev.distance && (
                              <span className="text-[9px] text-[#6b7280]">
                                {ev.distance}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
              {events.length === 0 && (
                <p className="text-[#6b7280]">No events found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      </>
      ) : null}

      {mapEmbedded ? (
        <div className="absolute bottom-2 right-2 z-[1000] flex flex-col gap-1.5">
          <button
            type="button"
            aria-label="Go to current GPS location"
            title="Current location"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-lg shadow-md"
            onClick={() => handleLiveGps()}
          >
            📍
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            className="flex h-9 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-base font-semibold shadow-md"
            onClick={() => mapRef.current?.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            className="flex h-9 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-base font-semibold shadow-md"
            onClick={() => mapRef.current?.zoomOut()}
          >
            −
          </button>
        </div>
      ) : null}

      {/* Pin form */}
      {showPinForm && newPinCoords && (
        <div
          className={`absolute left-0 right-0 z-[1200] max-h-[55vh] overflow-y-auto rounded-t-[20px] border border-[rgba(0,0,0,0.08)] bg-white p-4 shadow-md ${
            mapEmbedded ? "bottom-3 max-h-[min(55vh,280px)]" : "bottom-[280px]"
          }`}
        >
          <p className="mb-3 text-sm font-bold text-[#111827]">
            📍 Save this location
          </p>
          <form onSubmit={handleSavePin} className="space-y-2">
            <input
              value={newPinName}
              onChange={(e) => setNewPinName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-sm text-[#111827]"
            />
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["dream", "⭐ Dream"],
                  ["interesting", "💡 Interesting"],
                  ["gang_trip", "👥 Gang Trip"],
                  ["visited", "✓ Visited"],
                  ["custom", "📍 Custom"],
                ] as const
              ).map(([v, lab]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNewPinType(v)}
                  className="rounded-full px-2 py-1 text-[10px]"
                  style={
                    newPinType === v
                      ? { background: "#E94560", color: "#fff" }
                      : { background: "#f3f4f6", color: "#6b7280" }
                  }
                >
                  {lab}
                </button>
              ))}
            </div>
            <textarea
              value={newPinNotes}
              onChange={(e) => setNewPinNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-sm text-[#111827]"
            />
            <p className="text-[10px] text-[#6b7280]">
              {newPinCoords[0].toFixed(5)}, {newPinCoords[1].toFixed(5)}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-lg py-2 text-sm font-bold text-white"
                style={{ background: "#E94560" }}
              >
                Save Pin
              </button>
              <button
                type="button"
                className="rounded-lg border border-[rgba(0,0,0,0.08)] px-4 py-2 text-sm text-[#6b7280]"
                onClick={() => {
                  setShowPinForm(false);
                  setNewPinCoords(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Event detail */}
      {selectedEvent && (
        <div
          className={`absolute left-0 right-0 z-[1200] max-h-[50vh] overflow-y-auto rounded-t-[20px] border border-[rgba(0,0,0,0.08)] bg-white p-4 shadow-md ${
            mapEmbedded ? "bottom-3 max-h-[min(50vh,280px)]" : "bottom-[280px]"
          }`}
        >
          <button
            type="button"
            className="absolute right-3 top-3 text-[#6b7280]"
            onClick={() => setSelectedEvent(null)}
          >
            ✕
          </button>
          <p className="text-4xl">{selectedEvent.emoji}</p>
          <p className="mt-1 text-base font-bold text-[#111827]">
            {selectedEvent.name}
          </p>
          <p className="text-xs text-[#6b7280]">
            {selectedEvent.date} {selectedEvent.time && `· ${selectedEvent.time}`}
          </p>
          <p className="text-xs text-[#6b7280]">{selectedEvent.venue}</p>
          <span
            className="mt-2 inline-block rounded px-2 py-0.5 text-[10px] text-[#111827]"
            style={{
              background: selectedEvent.paid
                ? "rgba(233,69,96,0.12)"
                : "rgba(34,197,94,0.12)",
            }}
          >
            {selectedEvent.price}
          </span>
          <p className="mt-2 text-[11px] text-[#6b7280]">
            {hashStable(selectedEvent.id, 18) + 2} Travello users going
          </p>
          <p className="mt-1 text-[11px] text-[#6b7280]">
            {selectedEvent.description || "Discover local experiences with your group."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-gray-50 px-3 py-2 text-[11px] text-[#111827]"
              onClick={() => {
                if (selectedEvent.lat != null && selectedEvent.lon != null) {
                  void (async () => {
                    try {
                      await apiFetch<PinOut>("/pins", {
                        method: "POST",
                        body: JSON.stringify({
                          lat: selectedEvent.lat,
                          lng: selectedEvent.lon,
                          name: selectedEvent.name,
                          flag_type: "interesting",
                          note: selectedEvent.venue || null,
                        }),
                      });
                      loadPins();
                      showToast("Pinned event location", "success");
                    } catch (e) {
                      showToast(
                        e instanceof Error ? e.message : "Error",
                        "error",
                      );
                    }
                  })();
                }
              }}
            >
              📍 Pin Location
            </button>
            <button
              type="button"
              className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-gray-50 px-3 py-2 text-[11px] text-[#111827]"
              onClick={() => router.push("/trips")}
            >
              📅 Add to Plan
            </button>
            <button
              type="button"
              className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-gray-50 px-3 py-2 text-[11px] text-[#111827]"
              onClick={() => {
                const start = new Date();
                const end = new Date(start.getTime() + 3600000);
                const fmt = (d: Date) =>
                  d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                const q = new URLSearchParams({
                  text: selectedEvent.name,
                  dates: `${fmt(start)}/${fmt(end)}`,
                  details: selectedEvent.description || "",
                  location: selectedEvent.venue || "",
                });
                window.open(
                  `https://calendar.google.com/calendar/render?action=TEMPLATE&${q.toString()}`,
                  "_blank",
                );
              }}
            >
              🗓️ Google Calendar
            </button>
            <button
              type="button"
              className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-gray-50 px-3 py-2 text-[11px] text-[#111827]"
              onClick={() => {
                if (
                  selectedEvent.lat == null ||
                  selectedEvent.lon == null
                ) {
                  showToast("No location for this event", "error");
                  return;
                }
                openInMaps(
                  selectedEvent.lat,
                  selectedEvent.lon,
                  selectedEvent.name,
                );
              }}
            >
              🗺️ Directions
            </button>
          </div>
        </div>
      )}

      {/* iOS — open in maps chooser */}
      {mapChooser.open &&
      mapChooser.urls &&
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[9999] bg-[rgba(0,0,0,0.4)]"
            onClick={() => setMapChooser({ open: false })}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[9999] rounded-t-[24px] bg-white px-4 pb-8 pt-5 shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
            <p className="mb-4 text-center text-[13px] text-[#6C757D]">
              Open location in...
            </p>
            <button
              type="button"
              className="mb-2 flex w-full cursor-pointer items-center gap-3 rounded-xl bg-[#F8F9FA] px-4 py-3.5 text-left text-sm font-semibold text-[#0F3460]"
              onClick={() => window.open(mapChooser.urls!.google, "_blank")}
            >
              🗺️ Google Maps
            </button>
            <button
              type="button"
              className="mb-2 flex w-full cursor-pointer items-center gap-3 rounded-xl bg-[#F8F9FA] px-4 py-3.5 text-left text-sm font-semibold text-[#0F3460]"
              onClick={() => {
                window.location.href = mapChooser.urls!.apple;
              }}
            >
              🍎 Apple Maps
            </button>
            <button
              type="button"
              className="mb-2 flex w-full cursor-pointer items-center gap-3 rounded-xl bg-[#F8F9FA] px-4 py-3.5 text-left text-sm font-semibold text-[#0F3460]"
              onClick={() => window.open(mapChooser.urls!.waze, "_blank")}
            >
              🚗 Waze
            </button>
            <button
              type="button"
              className="mb-2 flex w-full cursor-pointer items-center gap-3 rounded-xl bg-[#F8F9FA] px-4 py-3.5 text-left text-sm font-semibold text-[#0F3460]"
              onClick={() => {
                window.location.href = mapChooser.urls!.uber;
              }}
            >
              🚕 Uber
            </button>
            <button
              type="button"
              className="mt-2 w-full cursor-pointer rounded-xl border border-[#E9ECEF] bg-white py-3 text-sm font-semibold text-[#0F3460]"
              onClick={() => setMapChooser({ open: false })}
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}

      {/* Toast */}
      {toast && (
        <div
          className="absolute left-1/2 z-[9999] -translate-x-1/2 whitespace-nowrap rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
          style={{
            bottom: mapEmbedded ? 12 : 220,
            background:
              toast.type === "success"
                ? "rgba(34,197,94,0.95)"
                : "rgba(233,69,96,0.95)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
