"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Search, Target } from "lucide-react";
import type { RouteOrigin } from "./live-types";
import {
  liveAutocompleteSearch,
  SEARCH_DEBOUNCE_MS,
  type AutocompleteResult,
  type SearchBias,
} from "./live-geocoding";

type Props = {
  open: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onUseMapCenter: () => void;
  onPickOnMap: () => void;
  onSelectSearchOrigin: (origin: RouteOrigin) => void;
  gpsAvailable: boolean;
  gpsAccuracyMeters: number | null;
  mapCenterAvailable: boolean;
  searchBias: SearchBias | null;
};

function autocompleteToRouteOrigin(result: AutocompleteResult): RouteOrigin {
  return {
    id: result.id,
    name: result.name,
    address: result.address || undefined,
    latitude: result.lat,
    longitude: result.lng,
    source: "search",
  };
}

export default function LiveRouteOriginSetup({
  open,
  onClose,
  onUseCurrentLocation,
  onUseMapCenter,
  onPickOnMap,
  onSelectSearchOrigin,
  gpsAvailable,
  gpsAccuracyMeters,
  mapCenterAvailable,
  searchBias,
}: Props) {
  const [mode, setMode] = useState<"menu" | "search">("menu");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setQuery("");
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "search") return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await liveAutocompleteSearch(query.trim(), searchBias);
        setResults(rows);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, mode, query, searchBias]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-stone-900/20 p-3 sm:items-center">
      <div
        role="dialog"
        aria-label="Set starting point"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/70 bg-white/98 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-stone-900">Set starting point</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-xs font-semibold text-stone-500 hover:bg-stone-100"
          >
            Close
          </button>
        </div>

        {mode === "menu" ? (
          <ul className="flex flex-col gap-1 p-2">
            <li>
              <button
                type="button"
                disabled={!gpsAvailable}
                onClick={onUseCurrentLocation}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-stone-50 disabled:opacity-50"
              >
                <Navigation className="h-4 w-4 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-800">Use my current location</span>
                  <span className="block text-[11px] text-stone-500">
                    {gpsAvailable
                      ? gpsAccuracyMeters != null && gpsAccuracyMeters > 150
                        ? `GPS available · ±${Math.round(gpsAccuracyMeters)} m accuracy`
                        : "GPS available"
                      : "Use map pick or search instead"}
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setMode("search")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-stone-50"
              >
                <Search className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-stone-800">Search address</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPickOnMap();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-stone-50"
              >
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-stone-800">Pick on map</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled={!mapCenterAvailable}
                onClick={onUseMapCenter}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-stone-50 disabled:opacity-50"
              >
                <Target className="h-4 w-4 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-800">Use current map center</span>
                  <span className="block text-[11px] text-stone-500">
                    {mapCenterAvailable ? "Uses the map view center" : "Move the map first"}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        ) : (
          <div className="p-3">
            <button
              type="button"
              onClick={() => setMode("menu")}
              className="mb-2 text-xs font-semibold text-stone-500 hover:text-stone-700"
            >
              ← Back
            </button>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search start address"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/30"
              autoFocus
            />
            {loading ? (
              <p className="mt-2 px-1 text-xs text-stone-400">Searching…</p>
            ) : null}
            {query.trim().length >= 2 && !loading && results.length === 0 ? (
              <p className="mt-2 px-1 text-xs text-stone-500">No matching places found.</p>
            ) : null}
            <ul className="mt-2 max-h-44 overflow-y-auto">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col rounded-lg px-2 py-2 text-left hover:bg-stone-50"
                    onClick={() => onSelectSearchOrigin(autocompleteToRouteOrigin(result))}
                  >
                    <span className="text-sm font-medium text-stone-800">{result.name}</span>
                    {result.address ? (
                      <span className="text-[11px] text-stone-500 line-clamp-1">{result.address}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
