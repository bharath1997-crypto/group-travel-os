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

const CORAL = "#E94560";
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

const CATEGORY_ICON_PATHS: Record<string, string> = {
  restaurant:
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  nightlife: '<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>',
  park:
    '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7Z"/><path d="M12 22v-3"/>',
  landmark:
    '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  entertainment:
    '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  shopping:
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  nature: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  trekking: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  sports:
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  activities:
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  photo_spot:
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  gaming:
    '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><rect width="20" height="12" x="2" y="6" rx="2"/>',
  default:
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
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

function buildPopupHtml(place: PlaceResult): string {
  const city = place.address?.city;
  const website = place.website
    ? `<a href="${place.website}" target="_blank" rel="noopener noreferrer" style="color:${CORAL};font-size:12px;">Website</a>`
    : "";
  const hours = place.opening_hours
    ? `<p style="margin:4px 0 0;font-size:11px;color:#64748B;">${place.opening_hours}</p>`
    : "";
  return `
    <div style="font-family:Inter,system-ui,sans-serif;padding:2px 0;">
      <strong style="display:block;color:${CORAL};font-size:14px;margin-bottom:4px;">${place.name}</strong>
      <span style="font-size:11px;color:#64748B;">${place.category ?? "Place"}</span>
      ${city ? `<p style="margin:6px 0 0;font-size:12px;color:#334155;">${city}</p>` : ""}
      ${hours}
      ${website ? `<div style="margin-top:8px;">${website}</div>` : ""}
    </div>
  `;
}

function categoryIconSvg(category: string | null): string {
  const key =
    category && CATEGORY_ICON_PATHS[category] ? category : "default";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${CATEGORY_ICON_PATHS[key]}</svg>`;
}

function createMarkerElement(category: string | null): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.borderRadius = "50%";
  el.style.backgroundColor = markerColor(category);
  el.style.border = "2px solid #FFFFFF";
  el.style.boxShadow = "0 2px 6px rgba(15,23,42,0.35)";
  el.style.cursor = "pointer";
  el.innerHTML = categoryIconSvg(category);
  return el;
}

export function ExploreMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef<MapMode>("viewport");
  const categoriesRef = useRef<string[] | null>(null);

  const [mode, setMode] = useState<MapMode>("viewport");
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>(["all"]);
  const [userCenter, setUserCenter] = useState(DEFAULT_CENTER);

  const { places, loading, error, cached, total, fetchNearby, fetchViewport } =
    useExploreMap();

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

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
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

    mapRef.current = map;

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
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [fetchNearby, runFetch, scheduleViewportFetch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    for (const place of places) {
      const el = createMarkerElement(place.category);
      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: true,
        maxWidth: "280px",
        className: "rovvy-explore-popup",
      }).setHTML(buildPopupHtml(place));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [places]);

  useEffect(() => {
    runFetch();
  }, [apiCategories, mode, runFetch]);

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
    map.flyTo({
      center: [userCenter.lng, userCenter.lat],
      zoom: 13,
      essential: true,
    });
    if (mode === "nearby") {
      void fetchNearby(
        userCenter.lat,
        userCenter.lng,
        NEARBY_RADIUS_M,
        apiCategories,
      );
    }
  };

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

        <div className="pointer-events-auto mt-auto flex flex-wrap gap-2 p-3">
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

      <style jsx global>{`
        .maplibregl-popup-content {
          width: 280px;
          background: #ffffff;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
        }
        .maplibregl-popup-close-button {
          color: #64748b;
        }
      `}</style>
    </div>
  );
}
