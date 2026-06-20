"use client";

import { Loader2, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
};

type DestinationSheetProps = {
  onClose: () => void;
  onSelect: (place: { lat: number; lng: number; name: string }) => void;
};

export async function searchPlaces(query: string): Promise<NominatimPlace[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=us`;
  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "Rovvy/1.0",
    },
  });
  if (!res.ok) return [];
  return (await res.json()) as NominatimPlace[];
}

export function DestinationSheet({ onClose, onSelect }: DestinationSheetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchPlaces(trimmed)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="Close destination search"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(70dvh,520px)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">Search destination</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-stone-200 px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search destination..."
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#0F766E]"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500">
              <Loader2 size={16} className="animate-spin text-[#0F766E]" />
              Searching…
            </div>
          ) : null}

          {!loading && query.trim().length >= 2 && results.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-stone-500">
              No places found.
            </p>
          ) : null}

          {results.map((place) => (
            <button
              key={`${place.lat}-${place.lon}-${place.display_name}`}
              type="button"
              onClick={() =>
                onSelect({
                  lat: Number.parseFloat(place.lat),
                  lng: Number.parseFloat(place.lon),
                  name: place.display_name.split(",")[0] || place.display_name,
                })
              }
              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-stone-50"
            >
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#0F766E]" />
              <span>
                <span className="block text-sm font-medium text-stone-900">
                  {place.display_name.split(",")[0]}
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  {place.display_name}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
