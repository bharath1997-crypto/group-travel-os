"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { patchMapLibreTileAbortRace } from "@/app/(dashboard)/live/live-maplibre-tile-abort-fix";
import { liveGeocodingReverse, liveGeocodingSearch } from "@/app/(dashboard)/live/live-geocoding";
import type { FlightPlaceSuggestion } from "@/lib/flight-places-api";
import { fetchNearbyAirports, formatPlaceDetail } from "@/lib/flight-places-api";
import { geolocationUnavailableMessage } from "@/lib/geo";
import {
  getFlightPickerBasemapStyle,
  getLiveMapLibreLayerStyles,
  OPENFREEMAP_STREET_STYLE_URL,
} from "@/lib/map-providers";

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const DEFAULT_ZOOM = 3.5;

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (airport: FlightPlaceSuggestion) => void;
  initialLat?: number;
  initialLng?: number;
};

export default function FlightAirportMapPicker({
  open,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}: Props) {
  const mapShellRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const lastAirportTapRef = useRef<{ id: string; at: number } | null>(null);
  const skipSearchRef = useRef(false);
  const setPinPositionRef = useRef<(lat: number, lng: number, label?: string) => void>(() => {});
  const [mapContainerReady, setMapContainerReady] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchHits, setSearchHits] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
  const [placeLabel, setPlaceLabel] = useState("");
  const [airports, setAirports] = useState<FlightPlaceSuggestion[]>([]);
  const [selected, setSelected] = useState<FlightPlaceSuggestion | null>(null);
  const [loadingAirports, setLoadingAirports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setMapContainerReady(false);
      return;
    }

    const measure = () => {
      const el = mapContainerRef.current;
      if (!el) return;
      const { clientWidth, clientHeight } = el;
      if (clientWidth > 0 && clientHeight > 0) {
        setMapContainerReady(true);
      }
    };

    measure();
    const targets = [mapShellRef.current, mapContainerRef.current].filter(Boolean) as HTMLElement[];
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    targets.forEach((target) => observer?.observe(target));
    window.addEventListener("resize", measure);
    const raf = window.requestAnimationFrame(measure);
    const timer = window.setTimeout(measure, 120);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      setMapContainerReady(false);
    };
  }, [open]);

  const loadNearby = useCallback(async (lat: number, lng: number) => {
    setLoadingAirports(true);
    setError(null);
    setSelected(null);
    try {
      const rows = await fetchNearbyAirports(lat, lng, 12);
      setAirports(rows);
      if (rows.length === 0) {
        setError("No airports found near this location.");
      }
    } catch {
      setAirports([]);
      setError("Could not load nearby airports.");
    } finally {
      setLoadingAirports(false);
    }
  }, []);

  const setPinPosition = useCallback(
    async (lat: number, lng: number, label?: string) => {
      markerRef.current?.setLngLat([lng, lat]);
      const map = mapRef.current;
      if (map) {
        map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 8) });
        map.once("moveend", () => map.resize());
        map.resize();
      }
      if (label) {
        setPlaceLabel(label);
      } else {
        try {
          const reverse = await liveGeocodingReverse(lat, lng);
          setPlaceLabel(reverse?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
          setPlaceLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      }
      void loadNearby(lat, lng);
    },
    [loadNearby],
  );

  useEffect(() => {
    setPinPositionRef.current = setPinPosition;
  }, [setPinPosition]);

  const confirmAirport = useCallback(
    (row: FlightPlaceSuggestion) => {
      onConfirm(row);
    },
    [onConfirm],
  );

  const handleAirportPointer = useCallback(
    (row: FlightPlaceSuggestion) => {
      const now = Date.now();
      const last = lastAirportTapRef.current;
      if (last?.id === row.id && now - last.at < 400) {
        lastAirportTapRef.current = null;
        confirmAirport(row);
        return;
      }
      lastAirportTapRef.current = { id: row.id, at: now };
      setSelected(row);
    },
    [confirmAirport],
  );

  const selectSearchHit = useCallback(
    (hit: { label: string; lat: number; lng: number }) => {
      skipSearchRef.current = true;
      setSearchHits([]);
      setSearchText("");
      void setPinPosition(hit.lat, hit.lng, hit.label);
    },
    [setPinPosition],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function bootstrap() {
      if (initialLat != null && initialLng != null) {
        await setPinPosition(initialLat, initialLng);
        return;
      }

      const blocked = geolocationUnavailableMessage();
      if (blocked || !navigator.geolocation) {
        await setPinPosition(DEFAULT_CENTER[1], DEFAULT_CENTER[0], "United States");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          void setPinPosition(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          if (cancelled) return;
          void setPinPosition(DEFAULT_CENTER[1], DEFAULT_CENTER[0], "United States");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [open, initialLat, initialLng, setPinPosition]);

  useEffect(() => {
    if (!open || !mapContainerReady || !mapContainerRef.current || mapRef.current) return;

    const container = mapContainerRef.current;
    const map = new maplibregl.Map({
      container,
      style: getFlightPickerBasemapStyle(),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      renderWorldCopies: false,
    });

    patchMapLibreTileAbortRace(map);

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    const marker = new maplibregl.Marker({ draggable: true, color: "#0F766E" })
      .setLngLat(DEFAULT_CENTER)
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      void setPinPositionRef.current(lngLat.lat, lngLat.lng);
    });

    map.on("click", (event) => {
      void setPinPositionRef.current(event.lngLat.lat, event.lngLat.lng);
    });

    let usedFallbackStyle = false;
    map.on("error", (event) => {
      const message = event.error?.message || "";
      const tileFailure =
        message.includes("failed to fetch") ||
        message.includes("403") ||
        message.includes("404") ||
        message.includes("Tile");
      if (!tileFailure || usedFallbackStyle) return;
      usedFallbackStyle = true;
      try {
        map.setStyle(getLiveMapLibreLayerStyles().clean || OPENFREEMAP_STREET_STYLE_URL);
      } catch {
        // ignore secondary failure
      }
    });

    const markReady = () => {
      map.resize();
      setMapReady(true);
    };

    map.once("load", markReady);
    map.once("idle", markReady);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.resize()) : null;
    resizeObserver?.observe(container);

    mapRef.current = map;
    markerRef.current = marker;
    window.requestAnimationFrame(() => map.resize());
    const resizeTimer = window.setTimeout(() => map.resize(), 150);

    return () => {
      window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [open, mapContainerReady]);

  useEffect(() => {
    if (!open || !mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const frame = window.requestAnimationFrame(() => map.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [open, mapReady]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      if (skipSearchRef.current) {
        skipSearchRef.current = false;
        return;
      }
      const q = searchText.trim();
      if (q.length < 2) {
        setSearchHits([]);
        return;
      }
      try {
        const hits = await liveGeocodingSearch(q);
        setSearchHits(
          hits.slice(0, 5).map((row) => ({
            label: row.display_name,
            lat: Number(row.lat),
            lng: Number(row.lon),
          })),
        );
      } catch {
        setSearchHits([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, searchText]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose airport on map"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-[min(720px,90vh)] sm:max-w-4xl sm:rounded-2xl sm:shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Choose on map</h2>
            <p className="text-xs text-slate-500">Move the pin or search for a place, then double-tap an airport to select it.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
            aria-label="Close map picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(280px,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-1">
          <div
            ref={mapShellRef}
            className="relative h-full min-h-0"
            style={{ width: "100%", height: "100%" }}
          >
            <div
              ref={mapContainerRef}
              className="absolute inset-0"
              style={{ width: "100%", height: "100%", zIndex: 0 }}
            />
            {!mapReady ? (
              <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-slate-100 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
              </div>
            ) : null}
            <div className="absolute left-3 right-3 top-3 z-10">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchHits[0]) {
                      e.preventDefault();
                      selectSearchHit(searchHits[0]);
                    }
                  }}
                  placeholder="Search for a place"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white/95 py-2 pl-9 pr-3 text-sm shadow-sm backdrop-blur focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              {searchHits.length > 0 ? (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {searchHits.map((hit) => (
                    <li key={`${hit.lat}-${hit.lng}-${hit.label}`}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSearchHit(hit)}
                        className="flex min-h-11 w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-teal-50"
                      >
                        {hit.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col border-t border-slate-200 lg:border-l lg:border-t-0">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected area</p>
              <p className="mt-1 text-sm text-slate-700">{placeLabel || "Move the pin to search nearby airports"}</p>
              {error ? <p className="mt-2 text-xs text-amber-800">{error}</p> : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {loadingAirports ? (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                  Finding nearby airports…
                </div>
              ) : null}
              {airports.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => handleAirportPointer(row)}
                  onDoubleClick={() => confirmAirport(row)}
                  className={`mb-1 flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2 text-left ${
                    selected?.id === row.id ? "bg-teal-50 ring-1 ring-teal-200" : "hover:bg-slate-50"
                  }`}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{row.label}</span>
                    <span className="block truncate text-xs text-slate-500">{formatPlaceDetail(row)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4">
              <p className="mb-2 text-center text-[11px] text-slate-500">
                Double-tap an airport to select it, or use Confirm below.
              </p>
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  if (selected) confirmAirport(selected);
                }}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Confirm airport
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
