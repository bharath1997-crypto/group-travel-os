"use client";

import {
  Menu,
  ChevronDown,
  Bell,
  Sun,
  CloudRain,
  Cloud,
  Loader2,
  MapPin,
  X,
  Compass,
} from "lucide-react";
import { type RefObject } from "react";
import { RovvyLogo } from "@/components/RovvyLogo";

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name: string;
};

type LiveTopBarProps = {
  tripName: string;
  totalMembers: number;
  totalVehicles: number;
  onToggleSidebar: () => void;
  activeMode: "driving" | "bike" | "trek" | "walk";
  onModeChange: (mode: "driving" | "bike" | "trek" | "walk") => void;
  weather: any;
  userAvatarUrl?: string | null;
  userName?: string;
  // Search query parameters wired from parent
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchResults: NominatimPlace[];
  searchLoading: boolean;
  showSearchDropdown: boolean;
  setShowSearchDropdown: (show: boolean) => void;
  onSelectPlace: (place: NominatimPlace) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  routeLoading: boolean;
  destination: any;
  clearNavigation: () => void;
  getPlaceName: (displayName: string) => string;
  sessionId?: string | null;
  hasOnlineMember?: boolean;
};

export function LiveTopBar({
  tripName,
  totalMembers,
  totalVehicles,
  onToggleSidebar,
  activeMode,
  onModeChange,
  weather,
  userAvatarUrl,
  userName = "Traveler",
  searchQuery,
  setSearchQuery,
  searchResults,
  searchLoading,
  showSearchDropdown,
  setShowSearchDropdown,
  onSelectPlace,
  searchInputRef,
  routeLoading,
  destination,
  clearNavigation,
  getPlaceName,
  sessionId = null,
  hasOnlineMember = false,
}: LiveTopBarProps) {
  // Format weather temperature
  const tempF = weather?.current?.temp_f ?? 72;
  const isRaining = weather?.current?.condition?.toLowerCase().includes("rain") ?? false;

  return (
    <header className="relative z-[140] flex h-14 w-full items-center justify-between border-b border-stone-200 bg-white px-4 shadow-sm shrink-0">
      {/* Left side: Hamburger, Brand Logo, LIVE Badge */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 transition"
          aria-label="Toggle Sidebar"
        >
          <Menu size={20} />
        </button>
        <div className="hidden items-center gap-2 sm:flex">
          <RovvyLogo variant="primary" className="h-5 w-auto" />
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
            LIVE
          </span>
        </div>
      </div>

      {/* Center-left: Trip dropdown & status dot */}
      <div className="hidden items-center gap-2 md:flex">
        <div className="flex items-center gap-1 bg-stone-50 hover:bg-stone-100 px-3 py-1.5 rounded-full border border-stone-200/60 cursor-pointer transition">
          <span className="text-xs font-bold text-stone-800 truncate max-w-[160px]">
            {tripName || "Colorado Adventure Trip"}
          </span>
          <ChevronDown size={14} className="text-stone-500" />
        </div>
        {sessionId ? (
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
            hasOnlineMember 
              ? "bg-green-50 text-green-700 border-green-200" 
              : "bg-stone-50 text-stone-600 border-stone-200"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${hasOnlineMember ? "bg-green-500 animate-pulse" : "bg-stone-400"}`} />
            {totalMembers} Member{totalMembers !== 1 ? "s" : ""} • {totalVehicles} Car{totalVehicles !== 1 ? "s" : ""} • Session: {sessionId}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-1 text-[10px] font-semibold text-stone-650 border border-stone-200">
            <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
            No live session
          </div>
        )}
      </div>

      {/* Center: Search input */}
      <div className="relative flex flex-1 max-w-[280px] lg:max-w-[340px] mx-2">
        <div className="relative z-[130] flex w-full items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-left text-sm shadow-sm transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F766E]/20">
          <MapPin size={15} className="shrink-0 text-[#0F766E]" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            placeholder="Search destination or place..."
            className="flex-1 w-full bg-transparent text-xs text-stone-900 placeholder-stone-400 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {routeLoading || searchLoading ? (
            <Loader2 size={13} className="animate-spin text-[#0F766E] shrink-0" />
          ) : null}
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setShowSearchDropdown(false);
                if (destination) {
                  clearNavigation();
                }
              }}
              className="rounded-full p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 shrink-0 transition"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        {/* Suggestion Dropdown */}
        {showSearchDropdown && (searchQuery.trim().length >= 2 || searchResults.length > 0) && (
          <>
            <div
              className="fixed inset-0 z-[120] cursor-default bg-transparent"
              onClick={() => setShowSearchDropdown(false)}
            />
            <div className="absolute top-full left-0 right-0 z-[135] mt-1 max-h-56 w-full overflow-y-auto rounded-2xl bg-white p-1.5 shadow-2xl border border-stone-200">
              {searchLoading && searchResults.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-stone-500">
                  <Loader2 size={12} className="animate-spin text-[#0F766E]" />
                  Searching…
                </div>
              ) : null}
              {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-stone-500">
                  No places found.
                </div>
              ) : null}
              {searchResults.map((place) => (
                <button
                  key={`${place.lat}-${place.lon}-${place.display_name}`}
                  type="button"
                  onClick={() => {
                    onSelectPlace(place);
                    setShowSearchDropdown(false);
                  }}
                  className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition hover:bg-stone-50"
                >
                  <MapPin size={13} className="mt-0.5 shrink-0 text-[#0F766E]" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-stone-900">
                      {getPlaceName(place.display_name)}
                    </span>
                    <span className="block truncate text-[9px] text-stone-500">
                      {place.display_name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Center-right: Mode Selector Pills */}
      <div className="hidden items-center gap-1 bg-stone-100 p-1 rounded-full border border-stone-200 sm:flex">
        {([
          { id: "driving", label: "Drive" },
          { id: "bike", label: "Bike" },
          { id: "trek", label: "Trek" },
          { id: "walk", label: "Walk" },
        ] as const).map((mode) => {
          const active = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onModeChange(mode.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                active
                  ? "bg-[#0F766E] text-white shadow-sm"
                  : "text-stone-650 hover:bg-stone-200"
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Right Side: Weather, Notifications, Avatar */}
      <div className="flex items-center gap-3">
        {/* Weather Indicator */}
        <div className="flex items-center gap-1 rounded-full bg-stone-50 px-2.5 py-1 text-xs font-bold text-stone-700 border border-stone-200/50">
          {isRaining ? (
            <CloudRain size={14} className="text-blue-500 animate-bounce" />
          ) : (
            <Sun size={14} className="text-amber-500 animate-pulse-slow" />
          )}
          <span>{tempF}°F</span>
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          className="relative rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#0F766E]" />
        </button>

        {/* Profile Avatar */}
        <div className="flex items-center gap-2 pl-1 border-l border-stone-200">
          <div className="h-7 w-7 overflow-hidden rounded-full ring-2 ring-teal-500/20 bg-[#0F766E]/10 flex items-center justify-center font-bold text-xs text-[#0F766E]">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              userName.substring(0, 2).toUpperCase()
            )}
          </div>
          <span className="hidden lg:inline text-xs font-bold text-stone-700 max-w-[80px] truncate">
            {userName.split(" ")[0]}
          </span>
        </div>
      </div>
    </header>
  );
}
