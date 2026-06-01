"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin, Navigation, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cityLabel } from "@/lib/explore-events";
import { type DateQuickPreset } from "@/lib/explore-date-utils";
import { MinimalCalendar } from "./MinimalCalendar";
import { ExploreMapLink } from "./ExploreMapLink";

type ExploreHeaderFiltersProps = {
  city: string;
  onCityChange: (city: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedDate: string | null;
  datePreset?: DateQuickPreset;
  onDateChange: (date: string | null, preset?: DateQuickPreset) => void;
  placeholder?: string;
  compactCalendar?: boolean;
  mapCategory?: string;
};

type CitySuggestion = {
  label: string;
  place_id: number;
};

export function ExploreHeaderFilters({
  city,
  onCityChange,
  searchQuery,
  onSearchChange,
  selectedDate,
  datePreset,
  onDateChange,
  placeholder = "Search items...",
  compactCalendar = false,
  mapCategory,
}: ExploreHeaderFiltersProps) {
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [gpsLocating, setGpsLocating] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch city suggestions based on autocomplete API
  useEffect(() => {
    if (citySearch.length < 2) {
      setCitySuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCityLoading(true);
      try {
        const data = await apiFetch<{ suggestions: CitySuggestion[] }>(
          `/explore/city-autocomplete?q=${encodeURIComponent(citySearch)}`
        );
        setCitySuggestions(data.suggestions || []);
      } catch {
        setCitySuggestions([]);
      } finally {
        setCityLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [citySearch]);

  // Resolves city name to coordinates using OpenStreetMap Nominatim
  const nominatimCityLatLon = async (query: string) => {
    try {
      const q = encodeURIComponent(query.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        { headers: { "User-Agent": "RovvyTravelOS/1.0" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      }
    } catch (e) {
      console.warn("Nominatim geo-lookup failed:", e);
    }
    return null;
  };

  const applyLocationByCoords = (
    coords: { lat: number; lon: number },
    label: string
  ) => {
    const cleanLabel = label.split(",")[0].trim();
    localStorage.setItem("rovvy_explore_city", cleanLabel);
    localStorage.setItem(
      "rovvy_explore_coords",
      JSON.stringify({ lat: coords.lat, lon: coords.lon })
    );
    onCityChange(cleanLabel);
    setShowCityDropdown(false);
    setCitySearch("");
  };

  const selectCity = (suggestion: CitySuggestion) => {
    setCityLoading(true);
    void nominatimCityLatLon(suggestion.label)
      .then((geo) => {
        if (geo) {
          applyLocationByCoords(geo, suggestion.label);
        }
      })
      .finally(() => setCityLoading(false));
  };

  const detectGPSCity = () => {
    if (!navigator.geolocation) return;
    setGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { "User-Agent": "RovvyTravelOS/1.0" } }
          );
          if (res.ok) {
            const data = await res.json();
            const address = data.address;
            const gpsLabel = address.city || address.town || address.village || "My Location";
            applyLocationByCoords({ lat, lon }, gpsLabel);
          }
        } catch {
          applyLocationByCoords({ lat, lon }, "My Location");
        } finally {
          setGpsLocating(false);
        }
      },
      () => {
        setGpsLocating(false);
      }
    );
  };

  const dropdownCityLabel =
    gpsLocating ? "Locating…" : cityLabel(city);

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
        />
      </div>

      {/* Location Selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowCityDropdown((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm hover:border-teal-400 sm:w-auto"
        >
          <div className="flex items-center gap-1.5">
            <MapPin size={15} className="text-teal-600" />
            <span className="font-semibold text-slate-900">{dropdownCityLabel}</span>
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {showCityDropdown && (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="relative mb-1.5">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                type="text"
                placeholder="City name or lat, lon..."
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
              />
            </div>

            {cityLoading && (
              <p className="py-2 text-center text-xs text-slate-400">
                Searching...
              </p>
            )}

            {citySuggestions.map((s) => (
              <button
                key={s.place_id || s.label}
                type="button"
                onClick={() => selectCity(s)}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
              >
                <MapPin size={11} className="shrink-0 text-slate-400" />
                <span className="truncate">{s.label}</span>
              </button>
            ))}

            {!cityLoading &&
              citySearch.length >= 2 &&
              citySuggestions.length === 0 && (
                <p className="py-2 text-center text-xs text-slate-400">
                  No cities found
                </p>
              )}

            <button
              type="button"
              onClick={detectGPSCity}
              className="mt-1 flex w-full items-center gap-1.5 border-t border-slate-100 px-2 py-2 text-left text-xs font-bold text-teal-600 hover:bg-slate-50"
            >
              <Navigation size={11} />
              Use current location
            </button>
          </div>
        )}
      </div>

      {/* Stylish Minimal Calendar */}
      <MinimalCalendar
        selectedDate={selectedDate}
        quickPreset={datePreset}
        onChange={onDateChange}
        compact={compactCalendar}
      />

      {mapCategory ? <ExploreMapLink category={mapCategory} /> : null}
    </div>
  );
}
