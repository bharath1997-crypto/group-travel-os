"use client";

import { Check, ChevronDown, MapPin, Navigation, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type LocationPickerProps = {
  currentCity: string;
  onCityChange: (city: string) => void;
};

type CityGroup = {
  label: string;
  cities: string[];
};

type NominatimReverseResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
};

const CITY_GROUPS: CityGroup[] = [
  {
    label: "United States",
    cities: [
      "New York",
      "Chicago",
      "Los Angeles",
      "Miami",
      "Las Vegas",
      "Nashville",
      "Austin",
      "San Francisco",
      "Boston",
      "Seattle",
      "New Orleans",
      "Denver",
      "Atlanta",
      "Houston",
      "Washington DC",
    ],
  },
  {
    label: "International",
    cities: [
      "London",
      "Paris",
      "Tokyo",
      "Dubai",
      "Barcelona",
      "Rome",
      "Amsterdam",
      "Bangkok",
      "Sydney",
      "Singapore",
      "Toronto",
      "Mexico City",
      "Bali",
      "Istanbul",
      "Cape Town",
    ],
  },
];

export function LocationPicker({ currentCity, onCityChange }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [toast, setToast] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const filteredGroups = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    if (!cleanSearch) return CITY_GROUPS;
    return CITY_GROUPS.map((group) => ({
      ...group,
      cities: group.cities.filter((city) => city.toLowerCase().includes(cleanSearch)),
    })).filter(group => group.cities.length > 0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cleanSearch = search.trim();
      if (cleanSearch) {
        // Try to find exact match first, otherwise use the typed value
        const allFiltered = filteredGroups.flatMap(g => g.cities);
        const match = allFiltered.find(c => c.toLowerCase() === cleanSearch.toLowerCase());
        selectCity(match || cleanSearch);
      }
    }
  };

  const selectCity = (city: string) => {
    onCityChange(city);
    setOpen(false);
    setSearch("");
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      showToast("Could not detect location");
      return;
    }

    setDetecting(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            );
            const data = (await response.json()) as NominatimReverseResponse;
            const detectedCity =
              data.address?.city ??
              data.address?.town ??
              data.address?.village ??
              data.address?.municipality;

            if (!detectedCity) throw new Error("No city found");
            selectCity(detectedCity);
          } catch {
            showToast("Could not detect location");
          } finally {
            setDetecting(false);
          }
        },
        () => {
          setDetecting(false);
          showToast("Could not detect location");
        },
      );
    } catch {
      setDetecting(false);
      showToast("Could not detect location");
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-[#1E293B] bg-[#1E293B] px-4 py-2 transition-all hover:border-primary hover:shadow-lg hover:shadow-[#E94560]/10"
        >
          <MapPin size={12} className="fill-[#E94560] text-primary transition-transform group-hover:scale-110" />
          <span className="text-sm font-bold text-white uppercase tracking-tight">{currentCity}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>
        
        {open && (
           <button 
             type="button"
             onClick={() => { setOpen(false); setSearch(""); }}
             className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
             aria-label="Cancel"
           >
             <X size={14} />
           </button>
        )}
      </div>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-[100] w-[320px] rounded-2xl border border-[#1E293B] bg-[#1E293B] p-4 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-4">
             <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-1">Change Location</h4>
             <p className="text-[10px] text-gray-400 font-medium italic">Your dashboard will refresh to match this city.</p>
          </div>
          
          <div className="flex items-center gap-2 rounded-xl border border-[#1E293B] bg-[#1E3A5F] px-4 py-2.5 focus-within:border-primary transition-colors">
            <Search size={16} className="shrink-0 text-gray-400" />
            <input
              value={search}
              autoFocus
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a city name..."
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-gray-500"
            />
          </div>

          <p className="mb-2 mt-3 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Popular cities
          </p>

          <div className="max-h-[220px] overflow-y-auto">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group, groupIndex) => (
                <div key={group.label}>
                  {groupIndex > 0 ? <div className="my-2 border-t border-[#1E293B]" /> : null}
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    {group.label}
                  </p>
                  {group.cities.map((city) => {
                    const active = city === currentCity;
                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => selectCity(city)}
                        className={[
                          "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[#1E3A5F]",
                          active ? "bg-[#1E3A5F] font-medium text-white" : "text-gray-300",
                        ].join(" ")}
                      >
                        <MapPin size={12} className="shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 text-sm">{city}</span>
                        {active ? <Check size={12} className="text-primary" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              search.trim() ? (
                <button
                  type="button"
                  onClick={() => selectCity(search.trim())}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-3 text-left text-gray-200 hover:bg-[#1E3A5F]"
                >
                  <Search size={14} className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    Search for &ldquo;{search.trim()}&rdquo;
                  </span>
                </button>
              ) : null
            )}
          </div>

          <button
            type="button"
            onClick={detectLocation}
            disabled={detecting}
            className="mt-2 flex w-full cursor-pointer items-center gap-2 border-t border-[#1E293B] pt-2 text-sm text-primary disabled:cursor-wait disabled:opacity-70"
          >
            <Navigation size={14} />
            <span>{detecting ? "Detecting location..." : "Use my current location"}</span>
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[60] rounded-full border border-[#1E293B] bg-[#1E293B] px-3 py-2 text-xs font-medium text-white shadow-lg shadow-black/30">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
