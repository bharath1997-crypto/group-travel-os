"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import {
  ArrowLeft,
  Loader2,
  Map as MapIcon,
  Minus,
  Navigation,
  Plus,
} from "lucide-react";

import { type PlaceResult, useExploreMap } from "@/hooks/useExploreMap";

import "maplibre-gl/dist/maplibre-gl.css";

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

type MapMode = "nearby" | "viewport";

type FilterChip = {
  id: string;
  label: string;
  apiCategories: string[] | null;
};

const FILTER_CHIPS: FilterChip[] = [
  { id: "all", label: "All", apiCategories: null },
  { id: "events", label: "Events", apiCategories: ["entertainment"] },
  { id: "restaurants", label: "Restaurants", apiCategories: ["restaurant"] },
  { id: "parks", label: "Parks", apiCategories: ["park"] },
  { id: "nightlife", label: "Nightlife", apiCategories: ["nightlife"] },
  { id: "landmarks", label: "Landmarks", apiCategories: ["landmark", "photo_spot"] },
  { id: "activities", label: "Activities", apiCategories: ["activities", "sports"] },
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

function createMarkerElement(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "14px";
  el.style.height = "14px";
  el.style.borderRadius = "50%";
  el.style.backgroundColor = color;
  el.style.border = "2px solid #FFFFFF";
  el.style.boxShadow = "0 2px 6px rgba(15,23,42,0.35)";
  el.style.cursor = "pointer";
  return el;
}

export function ExploreMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef<MapMode>("nearby");
  const categoriesRef = useRef<string[] | null>(null);

  const [mode, setMode] = useState<MapMode>("nearby");
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
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
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
      const el = createMarkerElement(markerColor(place.category));
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
    <div className="relative h-full min-h-0 w-full bg-white">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

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
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                  active
                    ? "border-[#E94560] bg-[#E94560] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#E94560]/40"
                }`}
              >
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
