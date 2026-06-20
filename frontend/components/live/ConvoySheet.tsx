"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  searchPlaces,
  type NominatimPlace,
} from "@/components/live/DestinationSheet";

type ConvoySheetProps = {
  onClose: () => void;
  onStart: (place: { lat: number; lng: number; name: string }) => void;
  busy?: boolean;
};

export function ConvoySheet({ onClose, onStart, busy = false }: ConvoySheetProps) {
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
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="Close convoy sheet"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(70dvh,520px)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Start Convoy</h2>
            <p className="text-xs text-stone-500">All members will follow your route</p>
          </div>
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
            placeholder="Search destination…"
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-stone-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : null}
          {!loading && results.length === 0 && query.trim().length >= 2 ? (
            <p className="px-3 py-6 text-center text-sm text-stone-500">No places found</p>
          ) : null}
          <ul className="space-y-1">
            {results.map((place) => (
              <li key={`${place.lat}-${place.lon}`}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onStart({
                      lat: Number.parseFloat(place.lat),
                      lng: Number.parseFloat(place.lon),
                      name: place.display_name.split(",")[0]?.trim() || place.display_name,
                    })
                  }
                  className="w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-stone-50 disabled:opacity-60"
                >
                  <span className="font-medium text-stone-900">
                    {place.display_name.split(",")[0]}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-stone-500">
                    {place.display_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {busy ? (
          <div className="border-t border-stone-200 px-4 py-3 text-center text-sm text-stone-500">
            <Loader2 size={16} className="mr-2 inline animate-spin" />
            Starting convoy…
          </div>
        ) : null}
      </div>
    </div>
  );
}
