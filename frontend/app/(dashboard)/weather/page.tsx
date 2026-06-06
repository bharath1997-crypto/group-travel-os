"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  Snowflake,
  Sun,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from "lucide-react";

import "leaflet/dist/leaflet.css";

/* ─── Dynamic Leaflet (no SSR) ─────────────────────────────────────────── */

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

/* ─── Types ────────────────────────────────────────────────────────────── */

type MapLayer = "street" | "satellite" | "terrain";
type OverlayMode = "off" | "rain" | "temp";
type TempUnit = "C" | "F";

type CityDef = {
  name: string;
  lat: number;
  lng: number;
  country: string;
  priority: 1 | 2 | 3 | 4;
  capital?: boolean;
};

type WeatherData = {
  temperature: number;
  weathercode: number;
  windspeed: number;
  precipitationProbability: number;
  fetchedAt: number;
};

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code?: string;
  admin1?: string;
};

type DisplayCity = CityDef & { key: string; dynamic?: boolean };

/* ─── Constants ────────────────────────────────────────────────────────── */

const MAJOR_CITIES: CityDef[] = [
  // India
  { name: "Mumbai", lat: 19.076, lng: 72.8777, country: "IN", priority: 1 },
  { name: "Delhi", lat: 28.6139, lng: 77.209, country: "IN", priority: 1, capital: true },
  { name: "Bangalore", lat: 12.9716, lng: 77.5946, country: "IN", priority: 1 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707, country: "IN", priority: 1 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639, country: "IN", priority: 1 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867, country: "IN", priority: 1 },
  { name: "Pune", lat: 18.5204, lng: 73.8567, country: "IN", priority: 2 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, country: "IN", priority: 2 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873, country: "IN", priority: 2 },
  { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185, country: "IN", priority: 3 },
  { name: "Surat", lat: 21.1702, lng: 72.8311, country: "IN", priority: 3 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462, country: "IN", priority: 3 },
  // USA
  { name: "Washington DC", lat: 38.9072, lng: -77.0369, country: "US", priority: 1, capital: true },
  { name: "New York", lat: 40.7128, lng: -74.006, country: "US", priority: 1 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, country: "US", priority: 1 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298, country: "US", priority: 1 },
  { name: "Houston", lat: 29.7604, lng: -95.3698, country: "US", priority: 2 },
  { name: "Miami", lat: 25.7617, lng: -80.1918, country: "US", priority: 2 },
  { name: "Seattle", lat: 47.6062, lng: -122.3321, country: "US", priority: 2 },
  // Europe
  { name: "London", lat: 51.5074, lng: -0.1278, country: "GB", priority: 1, capital: true },
  { name: "Paris", lat: 48.8566, lng: 2.3522, country: "FR", priority: 1, capital: true },
  { name: "Berlin", lat: 52.52, lng: 13.405, country: "DE", priority: 1, capital: true },
  { name: "Rome", lat: 41.9028, lng: 12.4964, country: "IT", priority: 1, capital: true },
  { name: "Madrid", lat: 40.4168, lng: -3.7038, country: "ES", priority: 1, capital: true },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041, country: "NL", priority: 1, capital: true },
  // Asia Pacific
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, country: "JP", priority: 1, capital: true },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, country: "SG", priority: 1, capital: true },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, country: "AE", priority: 1, capital: true },
  { name: "Bangkok", lat: 13.7563, lng: 100.5018, country: "TH", priority: 1, capital: true },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, country: "AU", priority: 1 },
  { name: "Canberra", lat: -35.2809, lng: 149.13, country: "AU", priority: 1, capital: true },
  { name: "Bali", lat: -8.3405, lng: 115.092, country: "ID", priority: 2 },
  // Americas
  { name: "Ottawa", lat: 45.4215, lng: -75.6972, country: "CA", priority: 1, capital: true },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, country: "CA", priority: 2 },
  { name: "Brasilia", lat: -15.7801, lng: -47.9292, country: "BR", priority: 1, capital: true },
  { name: "São Paulo", lat: -23.5505, lng: -46.6333, country: "BR", priority: 1 },
  { name: "Mexico City", lat: 19.4326, lng: -99.1332, country: "MX", priority: 1, capital: true },
  // Africa
  { name: "Cairo", lat: 30.0444, lng: 31.2357, country: "EG", priority: 1, capital: true },
  { name: "Abuja", lat: 9.0765, lng: 7.3986, country: "NG", priority: 1, capital: true },
  { name: "Lagos", lat: 6.5244, lng: 3.3792, country: "NG", priority: 1 },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219, country: "KE", priority: 1, capital: true },
  // World capitals — priority 1
  { name: "Islamabad", lat: 33.7294, lng: 73.0931, country: "PK", priority: 1, capital: true },
  { name: "Dhaka", lat: 23.8103, lng: 90.4125, country: "BD", priority: 1, capital: true },
  { name: "Kathmandu", lat: 27.7172, lng: 85.324, country: "NP", priority: 1, capital: true },
  { name: "Colombo", lat: 6.9271, lng: 79.8612, country: "LK", priority: 1, capital: true },
  { name: "Yangon", lat: 16.8661, lng: 96.1951, country: "MM", priority: 1, capital: true },
  { name: "Phnom Penh", lat: 11.5564, lng: 104.9282, country: "KH", priority: 1, capital: true },
  { name: "Vientiane", lat: 17.9757, lng: 102.6331, country: "LA", priority: 1, capital: true },
  { name: "Ulaanbaatar", lat: 47.8864, lng: 106.9057, country: "MN", priority: 1, capital: true },
  { name: "Tashkent", lat: 41.2995, lng: 69.2401, country: "UZ", priority: 1, capital: true },
  { name: "Almaty", lat: 43.222, lng: 76.8512, country: "KZ", priority: 1 },
  { name: "Tbilisi", lat: 41.6938, lng: 44.8015, country: "GE", priority: 1, capital: true },
  { name: "Yerevan", lat: 40.1872, lng: 44.5152, country: "AM", priority: 1, capital: true },
  { name: "Baku", lat: 40.4093, lng: 49.8671, country: "AZ", priority: 1, capital: true },
  { name: "Kyiv", lat: 50.4501, lng: 30.5234, country: "UA", priority: 1, capital: true },
  { name: "Minsk", lat: 53.9045, lng: 27.5615, country: "BY", priority: 1, capital: true },
  { name: "Bucharest", lat: 44.4268, lng: 26.1025, country: "RO", priority: 1, capital: true },
  { name: "Sofia", lat: 42.6977, lng: 23.3219, country: "BG", priority: 1, capital: true },
  { name: "Belgrade", lat: 44.8176, lng: 20.4569, country: "RS", priority: 1, capital: true },
  { name: "Zagreb", lat: 45.815, lng: 15.9819, country: "HR", priority: 1, capital: true },
  { name: "Helsinki", lat: 60.1699, lng: 24.9384, country: "FI", priority: 1, capital: true },
  { name: "Oslo", lat: 59.9139, lng: 10.7522, country: "NO", priority: 1, capital: true },
  { name: "Copenhagen", lat: 55.6761, lng: 12.5683, country: "DK", priority: 1, capital: true },
  { name: "Dublin", lat: 53.3498, lng: -6.2603, country: "IE", priority: 1, capital: true },
  { name: "Brussels", lat: 50.8503, lng: 4.3517, country: "BE", priority: 1, capital: true },
  { name: "Prague", lat: 50.0755, lng: 14.4378, country: "CZ", priority: 1, capital: true },
  { name: "Budapest", lat: 47.4979, lng: 19.0402, country: "HU", priority: 1, capital: true },
  { name: "Bratislava", lat: 48.1486, lng: 17.1077, country: "SK", priority: 1, capital: true },
  { name: "Tallinn", lat: 59.437, lng: 24.7536, country: "EE", priority: 1, capital: true },
  { name: "Riga", lat: 56.9496, lng: 24.1052, country: "LV", priority: 1, capital: true },
  { name: "Vilnius", lat: 54.6872, lng: 25.2797, country: "LT", priority: 1, capital: true },
  { name: "Reykjavik", lat: 64.1266, lng: -21.8174, country: "IS", priority: 1, capital: true },
  { name: "Algiers", lat: 36.7372, lng: 3.0865, country: "DZ", priority: 1, capital: true },
  { name: "Tunis", lat: 36.819, lng: 10.1658, country: "TN", priority: 1, capital: true },
  { name: "Tripoli", lat: 32.8872, lng: 13.1913, country: "LY", priority: 1, capital: true },
  { name: "Khartoum", lat: 15.5007, lng: 32.5599, country: "SD", priority: 1, capital: true },
  { name: "Dakar", lat: 14.7167, lng: -17.4677, country: "SN", priority: 1, capital: true },
  { name: "Kampala", lat: 0.3476, lng: 32.5825, country: "UG", priority: 1, capital: true },
  { name: "Lusaka", lat: -15.4167, lng: 28.2833, country: "ZM", priority: 1, capital: true },
  { name: "Harare", lat: -17.8252, lng: 31.0335, country: "ZW", priority: 1, capital: true },
  { name: "Antananarivo", lat: -18.9137, lng: 47.5361, country: "MG", priority: 1, capital: true },
  { name: "Windhoek", lat: -22.5609, lng: 17.0658, country: "NA", priority: 1, capital: true },
  { name: "Gaborone", lat: -24.6282, lng: 25.9231, country: "BW", priority: 1, capital: true },
  { name: "Maputo", lat: -25.9692, lng: 32.5732, country: "MZ", priority: 1, capital: true },
  { name: "Havana", lat: 23.1136, lng: -82.3666, country: "CU", priority: 1, capital: true },
  { name: "Kingston", lat: 17.997, lng: -76.7936, country: "JM", priority: 1, capital: true },
  { name: "Panama City", lat: 8.9936, lng: -79.5197, country: "PA", priority: 1, capital: true },
  { name: "San Jose", lat: 9.9281, lng: -84.0907, country: "CR", priority: 1, capital: true },
  { name: "Quito", lat: -0.1807, lng: -78.4678, country: "EC", priority: 1, capital: true },
  { name: "La Paz", lat: -16.5, lng: -68.1193, country: "BO", priority: 1, capital: true },
  { name: "Montevideo", lat: -34.9011, lng: -56.1645, country: "UY", priority: 1, capital: true },
  { name: "Asuncion", lat: -25.2867, lng: -57.647, country: "PY", priority: 1, capital: true },
  { name: "Suva", lat: -18.1248, lng: 178.4501, country: "FJ", priority: 1, capital: true },
];

const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  JP: "Japan",
  SG: "Singapore",
  AE: "United Arab Emirates",
  TH: "Thailand",
  AU: "Australia",
  ID: "Indonesia",
  CA: "Canada",
  BR: "Brazil",
  MX: "Mexico",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  PK: "Pakistan",
  BD: "Bangladesh",
  NP: "Nepal",
  LK: "Sri Lanka",
  MM: "Myanmar",
  KH: "Cambodia",
  LA: "Laos",
  MN: "Mongolia",
  UZ: "Uzbekistan",
  KZ: "Kazakhstan",
  GE: "Georgia",
  AM: "Armenia",
  AZ: "Azerbaijan",
  UA: "Ukraine",
  BY: "Belarus",
  RO: "Romania",
  BG: "Bulgaria",
  RS: "Serbia",
  HR: "Croatia",
  FI: "Finland",
  NO: "Norway",
  DK: "Denmark",
  IE: "Ireland",
  BE: "Belgium",
  CZ: "Czech Republic",
  HU: "Hungary",
  SK: "Slovakia",
  EE: "Estonia",
  LV: "Latvia",
  LT: "Lithuania",
  IS: "Iceland",
  DZ: "Algeria",
  TN: "Tunisia",
  LY: "Libya",
  SD: "Sudan",
  SN: "Senegal",
  UG: "Uganda",
  ZM: "Zambia",
  ZW: "Zimbabwe",
  MG: "Madagascar",
  NA: "Namibia",
  BW: "Botswana",
  MZ: "Mozambique",
  CU: "Cuba",
  JM: "Jamaica",
  PA: "Panama",
  CR: "Costa Rica",
  EC: "Ecuador",
  BO: "Bolivia",
  UY: "Uruguay",
  PY: "Paraguay",
  FJ: "Fiji",
};

const BASE_LAYERS: Record<
  MapLayer,
  { url: string; attribution: string; maxZoom?: number }
> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  satellite: {
    url: "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg",
    attribution: "© Stadia Maps © USGS © OpenAerialMap",
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors © OpenTopoMap",
    maxZoom: 17,
  },
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const weatherCache = new Map<string, WeatherData>();
const geocodeViewportCache = new Map<
  string,
  { cities: DisplayCity[]; fetchedAt: number }
>();

const OWM_API_KEY = process.env.NEXT_PUBLIC_OWM_API_KEY ?? "";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function cityKey(c: { name: string; lat: number; lng: number }) {
  return `${c.name}|${c.lat.toFixed(4)}|${c.lng.toFixed(4)}`;
}

const ALL_MAJOR_CITIES: DisplayCity[] = MAJOR_CITIES.map((c) => ({
  ...c,
  key: cityKey(c),
}));

function citySlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function countryFlag(code: string) {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

function getDefaultCenter(): { center: [number, number]; zoom: number } {
  if (typeof navigator === "undefined") {
    return { center: [20, 0], zoom: 2 };
  }
  const locale = navigator.language?.toLowerCase() ?? "";
  if (locale.includes("in") || locale.endsWith("-in")) {
    return { center: [20.5937, 78.9629], zoom: 4 };
  }
  if (locale.includes("us") || locale.endsWith("-us")) {
    return { center: [37.0902, -95.7129], zoom: 4 };
  }
  return { center: [20, 0], zoom: 2 };
}

function cToF(c: number) {
  return (c * 9) / 5 + 32;
}

function formatTempValue(celsius: number, unit: TempUnit) {
  if (unit === "F") return `${Math.round(cToF(celsius))}°F`;
  return `${Math.round(celsius)}°C`;
}

function tempBorderColor(celsius: number) {
  if (celsius < 0) return "#93C5FD";
  if (celsius < 15) return "#E9ECEF";
  if (celsius < 25) return "#6EE7B7";
  if (celsius < 35) return "#FCD34D";
  return "#FCA5A5";
}

function tempTextColor(celsius: number) {
  if (celsius < 0) return "#3B82F6";
  if (celsius < 15) return "#64748B";
  if (celsius < 25) return "#0F766E";
  if (celsius < 35) return "#D97706";
  return "#DC2626";
}

type WeatherIconKind = "sun" | "cloud" | "fog" | "rain" | "snow" | "drizzle" | "thunder";

function wmoToIconKind(code: number): WeatherIconKind {
  if (code === 0) return "sun";
  if (code >= 1 && code <= 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 61, 63, 65].includes(code)) return "rain";
  if ([71, 73, 75, 77].includes(code)) return "snow";
  if ([80, 81, 82].includes(code)) return "drizzle";
  if ([95, 96, 99].includes(code)) return "thunder";
  return "cloud";
}

function wmoToLabel(code: number) {
  const kind = wmoToIconKind(code);
  const labels: Record<WeatherIconKind, string> = {
    sun: "Clear",
    cloud: "Partly Cloudy",
    fog: "Fog",
    rain: "Rain",
    snow: "Snow",
    drizzle: "Showers",
    thunder: "Thunderstorm",
  };
  return labels[kind];
}

function weatherIconSvg(kind: WeatherIconKind, size = 13) {
  const colors: Record<WeatherIconKind, string> = {
    sun: "#F59E0B",
    cloud: "#94A3B8",
    fog: "#94A3B8",
    rain: "#3B82F6",
    snow: "#93C5FD",
    drizzle: "#3B82F6",
    thunder: "#8B5CF6",
  };
  const Icon =
    kind === "sun"
      ? Sun
      : kind === "rain"
        ? CloudRain
        : kind === "snow"
          ? Snowflake
          : kind === "drizzle"
            ? CloudDrizzle
            : kind === "thunder"
              ? CloudLightning
              : Cloud;
  return renderToStaticMarkup(
    <Icon size={size} color={colors[kind]} strokeWidth={2} aria-hidden />,
  );
}

type ZoomLimits = {
  maxTotal: number;
  perCountry: number;
  maxPriority: number;
  capitalsOnly: boolean;
  showCityName: boolean;
};

function getZoomLimits(zoom: number): ZoomLimits {
  if (zoom <= 2) {
    return {
      maxTotal: 80,
      perCountry: 1,
      maxPriority: 1,
      capitalsOnly: true,
      showCityName: false,
    };
  }
  if (zoom <= 4) {
    return {
      maxTotal: 150,
      perCountry: 3,
      maxPriority: 2,
      capitalsOnly: false,
      showCityName: true,
    };
  }
  if (zoom <= 6) {
    return {
      maxTotal: 200,
      perCountry: 10,
      maxPriority: 3,
      capitalsOnly: false,
      showCityName: true,
    };
  }
  if (zoom <= 8) {
    return {
      maxTotal: 100,
      perCountry: Number.POSITIVE_INFINITY,
      maxPriority: 4,
      capitalsOnly: false,
      showCityName: true,
    };
  }
  return {
    maxTotal: 50,
    perCountry: Number.POSITIVE_INFINITY,
    maxPriority: 4,
    capitalsOnly: false,
    showCityName: true,
  };
}

function cityInBounds(city: DisplayCity, bounds: L.LatLngBounds) {
  return bounds.contains([city.lat, city.lng]);
}

function selectCitiesForViewport(
  candidates: DisplayCity[],
  limits: ZoomLimits,
): DisplayCity[] {
  const filtered = candidates.filter((c) => {
    if (c.priority > limits.maxPriority) return false;
    if (limits.capitalsOnly) return Boolean(c.capital);
    return true;
  });

  const grouped = new Map<string, DisplayCity[]>();
  for (const city of filtered) {
    const list = grouped.get(city.country) ?? [];
    list.push(city);
    grouped.set(city.country, list);
  }

  const selected: DisplayCity[] = [];
  for (const group of grouped.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        a.priority - b.priority ||
        Number(Boolean(b.capital)) - Number(Boolean(a.capital)) ||
        a.name.localeCompare(b.name),
    );
    selected.push(...sorted.slice(0, limits.perCountry));
  }

  return selected
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        Number(Boolean(b.capital)) - Number(Boolean(a.capital)) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limits.maxTotal);
}

async function geocodeInViewport(
  centerLat: number,
  centerLng: number,
  bounds: L.LatLngBounds,
  existingKeys: Set<string>,
): Promise<DisplayCity[]> {
  const cacheKey = `${centerLat.toFixed(2)},${centerLng.toFixed(2)}`;
  const cached = geocodeViewportCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.cities.filter(
      (c) => cityInBounds(c, bounds) && !existingKeys.has(c.key),
    );
  }

  try {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search" +
      `?name=&count=20&latitude=${centerLat}` +
      `&longitude=${centerLng}&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: GeocodingResult[] };
    const cities: DisplayCity[] = [];
    for (const r of data.results ?? []) {
      if (!bounds.contains([r.latitude, r.longitude])) continue;
      const key = cityKey({ name: r.name, lat: r.latitude, lng: r.longitude });
      if (existingKeys.has(key)) continue;
      cities.push({
        name: r.name,
        lat: r.latitude,
        lng: r.longitude,
        country: (r.country_code ?? r.country.slice(0, 2)).toUpperCase(),
        priority: 4,
        key,
        dynamic: true,
      });
    }
    geocodeViewportCache.set(cacheKey, { cities, fetchedAt: Date.now() });
    return cities;
  } catch {
    return [];
  }
}

async function updateVisibleMarkers(
  bounds: L.LatLngBounds,
  zoom: number,
  center: L.LatLng,
  pinnedCities: DisplayCity[],
): Promise<{ cities: DisplayCity[]; showCityName: boolean }> {
  const limits = getZoomLimits(zoom);

  const inViewport = ALL_MAJOR_CITIES.filter((c) => cityInBounds(c, bounds));
  let selected = selectCitiesForViewport(inViewport, limits);

  if (zoom >= 9) {
    const existingKeys = new Set(selected.map((c) => c.key));
    const dynamic = await geocodeInViewport(
      center.lat,
      center.lng,
      bounds,
      existingKeys,
    );
    selected = [...selected, ...dynamic].slice(0, limits.maxTotal);
  }

  const merged = new Map<string, DisplayCity>();
  for (const city of selected) merged.set(city.key, city);
  for (const city of pinnedCities) {
    if (cityInBounds(city, bounds)) merged.set(city.key, city);
  }

  return {
    cities: [...merged.values()],
    showCityName: limits.showCityName,
  };
}

async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}` +
      `&longitude=${lng}&current_weather=true` +
      `&hourly=precipitation_probability&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return cached ?? null;
    const data = (await res.json()) as {
      current_weather: {
        temperature: number;
        weathercode: number;
        windspeed: number;
        time: string;
      };
      hourly?: { time: string[]; precipitation_probability: number[] };
    };

    let precip = 0;
    const cw = data.current_weather;
    if (data.hourly?.time && data.hourly.precipitation_probability) {
      const idx = data.hourly.time.findIndex((t) => t === cw.time);
      if (idx >= 0) precip = data.hourly.precipitation_probability[idx] ?? 0;
    }

    const result: WeatherData = {
      temperature: cw.temperature,
      weathercode: cw.weathercode,
      windspeed: cw.windspeed,
      precipitationProbability: precip,
      fetchedAt: Date.now(),
    };
    weatherCache.set(key, result);
    return result;
  } catch {
    return cached ?? null;
  }
}

async function fetchWeatherBatch(cities: DisplayCity[]) {
  const byCountry = new Map<string, DisplayCity[]>();
  for (const c of cities) {
    const list = byCountry.get(c.country) ?? [];
    list.push(c);
    byCountry.set(c.country, list);
  }

  const results = new Map<string, WeatherData>();
  for (const group of byCountry.values()) {
    await Promise.all(
      group.map(async (city) => {
        const w = await fetchWeather(city.lat, city.lng);
        if (w) results.set(city.key, w);
      }),
    );
  }
  return results;
}

async function geocodeSearch(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];
  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}` +
      `&count=5&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: GeocodingResult[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

function createTempIcon(
  city: DisplayCity,
  weather: WeatherData | undefined,
  unit: TempUnit,
  showCityName: boolean,
) {
  const border = weather ? tempBorderColor(weather.temperature) : "#E9ECEF";
  const kind = weather ? wmoToIconKind(weather.weathercode) : "cloud";
  const iconSvg = weatherIconSvg(kind, 12);
  const tempLabel = weather
    ? formatTempValue(weather.temperature, unit)
    : "…";

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
      <div style="
        display:inline-flex;align-items:center;gap:4px;
        background:#FFFFFF;border:0.5px solid ${border};
        border-radius:20px;padding:3px 8px;
        box-shadow:0 2px 8px rgba(0,0,0,0.12);
        font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:500;color:#0F172A;
        white-space:nowrap;
      ">
        <span style="display:inline-flex;align-items:center;line-height:0;">${iconSvg}</span>
        <span>${tempLabel}</span>
      </div>
      ${
        showCityName
          ? `<span style="
        margin-top:2px;font-family:Inter,system-ui,sans-serif;
        font-size:9px;color:#64748B;white-space:nowrap;
      ">${city.name}</span>`
          : ""
      }
    </div>`;

  return L.divIcon({
    className: "weather-temp-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [40, 20],
  });
}

/* ─── Map child components (dynamic) ───────────────────────────────────── */

const MapResizeFix = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner() {
        const map = mod.useMap();
        useEffect(() => {
          const fix = () => map.invalidateSize();
          fix();
          const t = window.setTimeout(fix, 200);
          window.addEventListener("resize", fix);
          return () => {
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

const MapZoomTracker = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner({
        onViewportChange,
      }: {
        onViewportChange: (
          bounds: L.LatLngBounds,
          center: L.LatLng,
          zoom: number,
        ) => void;
      }) {
        const map = mod.useMapEvents({
          zoomend() {
            onViewportChange(map.getBounds(), map.getCenter(), map.getZoom());
          },
          moveend() {
            onViewportChange(map.getBounds(), map.getCenter(), map.getZoom());
          },
        });
        useEffect(() => {
          onViewportChange(map.getBounds(), map.getCenter(), map.getZoom());
        }, [map, onViewportChange]);
        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

const MapFlyTo = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      function Inner({ target }: { target: [number, number] | null }) {
        const map = mod.useMap();
        useEffect(() => {
          if (target) map.flyTo(target, 8, { duration: 1.2 });
        }, [map, target]);
        return null;
      }
      return Inner;
    }),
  { ssr: false },
);

/* ─── UI primitives ──────────────────────────────────────────────────────── */

function FloatingCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#E9ECEF] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] ${className}`}
    >
      {children}
    </div>
  );
}

function PopupContent({
  city,
  weather,
  unit,
}: {
  city: DisplayCity;
  weather: WeatherData;
  unit: TempUnit;
}) {
  const kind = wmoToIconKind(weather.weathercode);
  const countryName = COUNTRY_NAMES[city.country] ?? city.country;
  return (
    <div className="min-w-[160px] font-[Inter,system-ui,sans-serif]">
      <p className="text-sm font-bold text-[#0F172A]">{city.name}</p>
      <p className="mt-0.5 text-xs text-[#64748B]">
        {countryFlag(city.country)} {countryName}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          dangerouslySetInnerHTML={{ __html: weatherIconSvg(kind, 22) }}
          className="inline-flex"
        />
        <span
          className="text-[28px] font-bold leading-none"
          style={{ color: tempTextColor(weather.temperature) }}
        >
          {formatTempValue(weather.temperature, unit)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#64748B]">{wmoToLabel(weather.weathercode)}</p>
      <p className="mt-2 text-xs text-[#475569]">
        Wind {Math.round(weather.windspeed)} km/h
      </p>
      <p className="text-xs text-[#475569]">
        Rain chance {Math.round(weather.precipitationProbability)}%
      </p>
      <a
        href={`/weather/${citySlug(city.name)}`}
        className="mt-3 inline-block text-xs font-semibold text-[#0F766E] hover:underline"
      >
        View forecast →
      </a>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────────── */

export default function WeatherPage() {
  const defaultMap = useMemo(() => getDefaultCenter(), []);

  const [mapLayer, setMapLayer] = useState<MapLayer>("street");
  const [overlay, setOverlay] = useState<OverlayMode>("off");
  const [unit, setUnit] = useState<TempUnit>("C");
  const [visibleCities, setVisibleCities] = useState<DisplayCity[]>([]);
  const [showCityNames, setShowCityNames] = useState(true);
  const [weatherMap, setWeatherMap] = useState<Map<string, WeatherData>>(
    () => new Map(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [extraCities, setExtraCities] = useState<DisplayCity[]>([]);

  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extraCitiesRef = useRef(extraCities);
  extraCitiesRef.current = extraCities;

  const loadWeatherForCities = useCallback(async (cities: DisplayCity[]) => {
    if (cities.length === 0) return;
    const batch = await fetchWeatherBatch(cities);
    setWeatherMap((prev) => {
      const next = new Map(prev);
      batch.forEach((v, k) => next.set(k, v));
      return next;
    });
  }, []);

  const runUpdateVisibleMarkers = useCallback(
    async (bounds: L.LatLngBounds, center: L.LatLng, zoom: number) => {
      const { cities, showCityName } = await updateVisibleMarkers(
        bounds,
        zoom,
        center,
        extraCitiesRef.current,
      );
      setVisibleCities(cities);
      setShowCityNames(showCityName);
      void loadWeatherForCities(cities);
    },
    [loadWeatherForCities],
  );

  const handleViewportChange = useCallback(
    (bounds: L.LatLngBounds, center: L.LatLng, zoom: number) => {
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
      viewportTimer.current = setTimeout(() => {
        void runUpdateVisibleMarkers(bounds, center, zoom);
      }, 300);
    },
    [runUpdateVisibleMarkers],
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void geocodeSearch(searchQuery).then(setSearchResults);
    }, 500);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const selectSearchResult = useCallback(
    async (r: GeocodingResult) => {
      const city: DisplayCity = {
        name: r.name,
        lat: r.latitude,
        lng: r.longitude,
        country: (r.country_code ?? r.country.slice(0, 2)).toUpperCase(),
        priority: 2,
        key: cityKey({ name: r.name, lat: r.latitude, lng: r.longitude }),
        dynamic: true,
      };
      setExtraCities((prev) => {
        const m = new Map(prev.map((c) => [c.key, c]));
        m.set(city.key, city);
        return [...m.values()];
      });
      setFlyTarget([r.latitude, r.longitude]);
      setSearchQuery(r.name);
      setSearchOpen(false);
      setSearchResults([]);
      const w = await fetchWeather(r.latitude, r.longitude);
      if (w) {
        setWeatherMap((prev) => new Map(prev).set(city.key, w));
        setVisibleCities((prev) => {
          if (prev.some((c) => c.key === city.key)) return prev;
          return [...prev, city];
        });
      }
    },
    [],
  );

  const layerConfig = BASE_LAYERS[mapLayer];

  return (
    <div
      className="weather-map-page fixed left-0 right-0 z-10 overflow-hidden bg-white"
      style={{ top: "52px", height: "calc(100vh - 52px)", width: "100%" }}
    >
      {/* Map */}
      <MapContainer
        center={defaultMap.center}
        zoom={defaultMap.zoom}
        className="h-full w-full"
        style={{ height: "100%", width: "100%", background: "#FFFFFF" }}
        zoomControl={false}
        attributionControl
      >
        <MapResizeFix />
        <MapZoomTracker onViewportChange={handleViewportChange} />
        <MapFlyTo target={flyTarget} />

        <TileLayer
          key={mapLayer}
          url={layerConfig.url}
          attribution={layerConfig.attribution}
          maxZoom={layerConfig.maxZoom ?? 19}
        />

        {overlay === "rain" && OWM_API_KEY ? (
          <TileLayer
            url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`}
            attribution="© OpenWeatherMap"
            opacity={0.55}
            maxZoom={19}
          />
        ) : null}

        {overlay === "temp" && OWM_API_KEY ? (
          <TileLayer
            url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`}
            attribution="© OpenWeatherMap"
            opacity={0.55}
            maxZoom={19}
          />
        ) : null}

        {visibleCities.map((city) => {
          const weather = weatherMap.get(city.key);
          const icon = createTempIcon(city, weather, unit, showCityNames);
          return (
            <Marker
              key={city.key}
              position={[city.lat, city.lng]}
              icon={icon}
            >
              {weather ? (
                <Popup className="weather-popup" closeButton>
                  <PopupContent city={city} weather={weather} unit={unit} />
                </Popup>
              ) : null}
            </Marker>
          );
        })}
      </MapContainer>

      {/* Layer switcher — top-left */}
      <FloatingCard className="absolute left-3 top-3 z-[1000] p-1.5">
        <div className="flex gap-1">
          {(["street", "satellite", "terrain"] as MapLayer[]).map((layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => setMapLayer(layer)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                mapLayer === layer
                  ? "bg-[#0F766E] text-white"
                  : "text-[#64748B] hover:bg-[#F8F9FA]"
              }`}
            >
              {layer}
            </button>
          ))}
        </div>
      </FloatingCard>

      {/* Search — top-center */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] w-[320px] max-w-[calc(100vw-24px)] -translate-x-1/2">
        <FloatingCard className="pointer-events-auto relative p-2">
          <div className="flex items-center gap-2">
            <Search size={16} className="shrink-0 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search any city for weather..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="text-[#94A3B8] hover:text-[#64748B]"
                aria-label="Clear"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {searchOpen && searchResults.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#E9ECEF] bg-white py-1 shadow-lg">
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8F9FA]"
                    onClick={() => void selectSearchResult(r)}
                  >
                    <span className="font-medium">{r.name}</span>
                    {r.admin1 ? (
                      <span className="text-[#64748B]">, {r.admin1}</span>
                    ) : null}
                    <span className="text-[#94A3B8]"> · {r.country}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </FloatingCard>
      </div>

      {/* Unit toggle — top-right */}
      <FloatingCard className="absolute right-3 top-3 z-[1000] p-1">
        <div className="flex gap-0.5">
          {(["C", "F"] as TempUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                unit === u
                  ? "bg-[#0F766E] text-white"
                  : "text-[#64748B] hover:bg-[#F8F9FA]"
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
      </FloatingCard>

      {/* Overlay toggle — bottom-center (avoids ROVVY Lounge dock on the right) */}
      <FloatingCard className="absolute bottom-10 left-1/2 z-[1000] -translate-x-1/2 p-1.5">
        <div className="flex flex-col gap-1 sm:flex-row">
          {(
            [
              ["off", "Off"],
              ["rain", "Rain overlay"],
              ["temp", "Temp overlay"],
            ] as [OverlayMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setOverlay(mode)}
              disabled={mode !== "off" && !OWM_API_KEY}
              title={
                mode !== "off" && !OWM_API_KEY
                  ? "Add NEXT_PUBLIC_OWM_API_KEY to .env.local"
                  : undefined
              }
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                overlay === mode
                  ? "bg-[#0F766E] text-white"
                  : "text-[#64748B] hover:bg-[#F8F9FA]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </FloatingCard>

      {/* Legend — bottom-left */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        {legendOpen ? (
          <FloatingCard className="p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-[#0F172A]">Temperature</p>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                className="text-[#94A3B8] hover:text-[#64748B]"
                aria-label="Hide legend"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="space-y-1 text-[11px] text-[#64748B]">
              <p>❄️ &lt; 0°C</p>
              <p>🌡️ 0–15°C</p>
              <p>✅ 15–25°C</p>
              <p>🌤️ 25–35°C</p>
              <p>🔥 &gt; 35°C</p>
            </div>
          </FloatingCard>
        ) : (
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            className="flex items-center gap-1 rounded-xl border border-[#E9ECEF] bg-white px-3 py-2 text-xs font-semibold text-[#64748B] shadow-[0_2px_12px_rgba(0,0,0,0.1)]"
          >
            Legend <ChevronUp size={14} />
          </button>
        )}
      </div>

      <style jsx global>{`
        .weather-temp-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        }
        .leaflet-popup-content {
          margin: 12px 14px;
        }
        .leaflet-container {
          font-family: Inter, system-ui, sans-serif;
          background: #ffffff;
        }
        .weather-map-page .leaflet-control-attribution {
          left: 50% !important;
          right: auto !important;
          bottom: 6px !important;
          transform: translateX(-50%);
          margin: 0 !important;
          max-width: min(90vw, 640px);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-radius: 8px;
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  );
}
