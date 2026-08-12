"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Clock3,
  Compass,
  Globe2,
  Loader2,
  MapPinned,
  MapPin,
  Navigation,
  Trash2,
} from "lucide-react";
import FlightAirportMapPicker from "@/components/travel/FlightAirportMapPicker";
import FlightExploreAirports from "@/components/travel/FlightExploreAirports";
import type { FlightPlaceSuggestion } from "@/lib/flight-places-api";
import {
  fetchFlightPlaces,
  fetchNearbyAirports,
  formatPlaceDetail,
  placeTypeLabel,
} from "@/lib/flight-places-api";
import {
  clearRecentFlightAirports,
  getRecentFlightAirports,
  recentAirportFromSuggestion,
  recordRecentFlightAirport,
  type RecentFlightAirport,
} from "@/lib/flight-recent-airports";
import { geolocationErrorMessage, geolocationUnavailableMessage } from "@/lib/geo";

export type FlightPlaceValue = {
  label: string;
  iata: string;
};

type DropdownMode = "default" | "search" | "explore" | "gps";

type Props = {
  id?: string;
  value: FlightPlaceValue;
  onChange: (next: FlightPlaceValue) => void;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  userId?: string | null;
};

const DEBOUNCE_MS = 220;

type OptionItem =
  | { kind: "action"; id: string; label: string; action: () => void }
  | { kind: "recent"; id: string; airport: RecentFlightAirport }
  | { kind: "place"; id: string; place: FlightPlaceSuggestion };

export default function FlightPlaceInput({
  id,
  value,
  onChange,
  placeholder = "City or airport",
  disabled = false,
  inputClassName,
  userId = null,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(value.label);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DropdownMode>("default");
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<FlightPlaceSuggestion[]>([]);
  const [gpsAirports, setGpsAirports] = useState<FlightPlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [recent, setRecent] = useState<RecentFlightAirport[]>([]);

  useEffect(() => {
    setText(value.label);
  }, [value.label]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setMode("default");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    setRecent(getRecentFlightAirports(8, userId));
  }, [open, userId]);

  useEffect(() => {
    const q = text.trim();
    if (!open || mode === "explore") return;

    if (q.length < 1) {
      setSuggestions([]);
      setMode((current) => (current === "gps" ? "gps" : "default"));
      return;
    }

    setMode("search");
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await fetchFlightPlaces(q, 12);
        setSuggestions(rows);
        setActiveIndex(0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text, open, mode]);

  const confirmSelection = (item: FlightPlaceSuggestion | RecentFlightAirport) => {
    const next = {
      label: item.label,
      iata: item.iata.trim().toUpperCase(),
    };
    onChange(next);
    setText(next.label);
    recordRecentFlightAirport(recentAirportFromSuggestion(item), userId);
    setRecent(getRecentFlightAirports(8, userId));
    setOpen(false);
    setMode("default");
    setGpsAirports([]);
    setGpsError(null);
  };

  const startGps = () => {
    const blocked = geolocationUnavailableMessage();
    if (blocked) {
      setGpsError(blocked);
      setMode("gps");
      setOpen(true);
      return;
    }

    setGpsLoading(true);
    setGpsError(null);
    setMode("gps");
    setOpen(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const rows = await fetchNearbyAirports(pos.coords.latitude, pos.coords.longitude, 12);
          setGpsAirports(rows);
          if (rows.length === 0) setGpsError("No airports found near your location.");
        } catch {
          setGpsAirports([]);
          setGpsError("Could not load nearby airports.");
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        setGpsAirports([]);
        setGpsError(geolocationErrorMessage(err));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 },
    );
  };

  const flatOptions: OptionItem[] = useMemo(() => {
    if (mode === "explore") return [];

    if (mode === "gps") {
      return gpsAirports.map((place) => ({
        kind: "place" as const,
        id: place.id,
        place,
      }));
    }

    if (text.trim().length >= 1) {
      return suggestions.map((place) => ({
        kind: "place" as const,
        id: place.id,
        place,
      }));
    }

    const items: OptionItem[] = [
      {
        kind: "action",
        id: "gps",
        label: "Use current location",
        action: startGps,
      },
      {
        kind: "action",
        id: "map",
        label: "Choose on map",
        action: () => setMapOpen(true),
      },
      {
        kind: "action",
        id: "explore",
        label: "Explore airports",
        action: () => setMode("explore"),
      },
    ];

    for (const airport of recent) {
      items.push({ kind: "recent", id: `recent-${airport.iata}`, airport });
    }
    return items;
  }, [mode, gpsAirports, suggestions, text, recent]);

  const pickOption = (item: OptionItem) => {
    if (item.kind === "action") {
      item.action();
      return;
    }
    if (item.kind === "recent") {
      confirmSelection(item.airport);
      return;
    }
    confirmSelection(item.place);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (mode === "explore") {
        setMode("default");
        return;
      }
      setOpen(false);
      return;
    }

    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (mode === "explore" || flatOptions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatOptions.length) % flatOptions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatOptions[activeIndex];
      if (item) pickOption(item);
    }
  };

  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, FlightPlaceSuggestion[]>();
    for (const row of suggestions) {
      const key = row.group || "Results";
      const bucket = groups.get(key) || [];
      bucket.push(row);
      groups.set(key, bucket);
    }
    return [...groups.entries()];
  }, [suggestions]);

  return (
    <>
      <div ref={wrapRef} className="relative min-w-0 flex-1">
        <input
          id={id}
          type="text"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => {
            setOpen(true);
            if (!text.trim()) setMode("default");
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={
            inputClassName ??
            "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          }
        />

        {open ? (
          <div
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {mode === "explore" ? (
              <FlightExploreAirports
                onSelect={(place) => confirmSelection(place)}
                onClose={() => setMode("default")}
              />
            ) : (
              <div className="max-h-80 overflow-y-auto py-1">
                {mode === "default" && text.trim().length === 0 ? (
                  <>
                    {flatOptions
                      .filter((item) => item.kind === "action")
                      .map((item, idx) => (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={idx === activeIndex}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickOption(item)}
                          className={`flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${
                            idx === activeIndex ? "bg-teal-50/60" : ""
                          }`}
                        >
                          {item.id === "gps" ? (
                            <Navigation className="h-4 w-4 shrink-0 text-teal-600" />
                          ) : item.id === "map" ? (
                            <MapPinned className="h-4 w-4 shrink-0 text-teal-600" />
                          ) : (
                            <Globe2 className="h-4 w-4 shrink-0 text-teal-600" />
                          )}
                          <span className="text-sm font-medium text-slate-900">{item.label}</span>
                        </button>
                      ))}

                    {recent.length > 0 ? (
                      <div className="mt-1 border-t border-slate-100 pt-1">
                        <div className="flex items-center justify-between px-3 py-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Recent airports
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              clearRecentFlightAirports(userId);
                              setRecent([]);
                            }}
                            className="inline-flex min-h-11 items-center gap-1 px-2 text-[11px] font-semibold text-slate-500 hover:text-teal-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Clear
                          </button>
                        </div>
                        {recent.map((airport) => {
                          const optionIndex = flatOptions.findIndex(
                            (item) => item.kind === "recent" && item.airport.iata === airport.iata,
                          );
                          return (
                            <button
                              key={airport.iata}
                              type="button"
                              role="option"
                              aria-selected={optionIndex === activeIndex}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => confirmSelection(airport)}
                              className={`flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${
                                optionIndex === activeIndex ? "bg-teal-50/60" : ""
                              }`}
                            >
                              <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-900">
                                  {airport.label}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  {[airport.iata, airport.city, airport.region, airport.country]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {mode === "gps" ? (
                  <div className="px-3 py-2">
                    {gpsLoading ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                        Finding nearby airports…
                      </div>
                    ) : null}
                    {gpsError ? <p className="py-2 text-sm text-amber-800">{gpsError}</p> : null}
                    {!gpsLoading && gpsAirports.length === 0 && !gpsError ? (
                      <p className="py-2 text-sm text-slate-500">Select an airport from the list when available.</p>
                    ) : null}
                  </div>
                ) : null}

                {mode === "search" && loading && suggestions.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                    Searching airports…
                  </div>
                ) : null}

                {mode === "search" && !loading && text.trim().length >= 1 && suggestions.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-slate-500">No matching airports or cities.</p>
                ) : null}

                {(mode === "search" || mode === "gps") && (mode === "gps" ? gpsAirports : suggestions).length > 0 ? (
                  mode === "search" ? (
                    groupedSuggestions.map(([group, rows]) => (
                      <div key={group}>
                        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {group}
                        </p>
                        {rows.map((place) => {
                          const optionIndex = flatOptions.findIndex(
                            (item) => item.kind === "place" && item.id === place.id,
                          );
                          return (
                            <button
                              key={place.id}
                              type="button"
                              role="option"
                              aria-selected={optionIndex === activeIndex}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => confirmSelection(place)}
                              className={`flex min-h-11 w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${
                                optionIndex === activeIndex ? "bg-teal-50/60" : ""
                              }`}
                            >
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-900">
                                  {place.label}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  {formatPlaceDetail(place)} · {placeTypeLabel(place.place_type)}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    gpsAirports.map((place) => {
                      const optionIndex = flatOptions.findIndex(
                        (item) => item.kind === "place" && item.id === place.id,
                      );
                      return (
                        <button
                          key={place.id}
                          type="button"
                          role="option"
                          aria-selected={optionIndex === activeIndex}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => confirmSelection(place)}
                          className={`flex min-h-11 w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${
                            optionIndex === activeIndex ? "bg-teal-50/60" : ""
                          }`}
                        >
                          <Compass className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">{place.label}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {formatPlaceDetail(place)} · Nearby
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <FlightAirportMapPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={(airport) => {
          confirmSelection(airport);
          setMapOpen(false);
        }}
      />
    </>
  );
}
