"use client";

import { Check, ChevronDown, MapPin, Navigation, Search } from "lucide-react";
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
    }));
  }, [search]);

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
            onCityChange(detectedCity);
            setOpen(false);
            setSearch("");
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
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#E9ECEF] bg-white px-3 py-1.5"
      >
        <MapPin size={10} className="fill-[#E94560] text-[#E94560]" />
        <span className="text-sm font-medium text-[#2C3E50]">{currentCity}</span>
        <ChevronDown size={12} className="text-[#6C757D]" />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[280px] rounded-xl border border-[#E9ECEF] bg-white p-3 shadow-lg">
          <div className="flex items-center gap-2 rounded-lg border border-[#E9ECEF] bg-[#F8F9FA] px-3 py-2">
            <Search size={14} className="shrink-0 text-[#6C757D]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cities..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[#2C3E50] outline-none placeholder:text-[#6C757D]"
            />
          </div>

          <p className="mb-2 mt-3 text-[10px] font-medium uppercase tracking-wide text-[#6C757D]">
            Popular cities
          </p>

          <div className="max-h-[220px] overflow-y-auto">
            {filteredGroups.map((group, groupIndex) => (
              <div key={group.label}>
                {groupIndex > 0 ? <div className="my-2 border-t border-[#E9ECEF]" /> : null}
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[#6C757D]">
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
                        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[#F8F9FA]",
                        active ? "bg-[#0F3460]/5 font-medium text-[#0F3460]" : "text-[#2C3E50]",
                      ].join(" ")}
                    >
                      <MapPin size={12} className="shrink-0 text-[#E94560]" />
                      <span className="min-w-0 flex-1 text-sm">{city}</span>
                      {active ? <Check size={12} className="text-[#E94560]" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={detectLocation}
            disabled={detecting}
            className="mt-2 flex w-full cursor-pointer items-center gap-2 border-t border-[#E9ECEF] pt-2 text-sm text-[#E94560] disabled:cursor-wait disabled:opacity-70"
          >
            <Navigation size={14} />
            <span>{detecting ? "Detecting location..." : "Use my current location"}</span>
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[60] rounded-full border border-[#E9ECEF] bg-white px-3 py-2 text-xs font-medium text-[#2C3E50] shadow">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
