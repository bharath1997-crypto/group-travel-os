"use client";

import { useMemo } from "react";
import { Bookmark, FilePlus, MapPin, Users } from "lucide-react";

export type PlacePreviewData = {
  name: string;
  categoryLabel: string;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  distanceM: number | null;
  openingHours: string | null;
  openStatus: string | null;
};

type Props = {
  place: PlacePreviewData;
  loadingDetails: boolean;
  workflowType: string;
  farLocationWarning?: boolean;
  onClose: () => void;
  onSavePlace: () => void;
  onAddStop: () => void;
  onAddToTrip: () => void;
  onCreateMeetPoint: () => void;
  onMakeDestination: () => void;
  onStartLive: () => void;
};

function formatDistanceMiles(m: number | null): string {
  if (m == null) return "Distance unavailable";
  const miles = m / 1609.34;
  if (miles < 0.1) return `${Math.round(m)} m away`;
  return `${miles.toFixed(1)} miles away`;
}

export default function PlacePreviewCard({
  place,
  loadingDetails,
  onClose,
  onSavePlace,
  onAddStop,
  onAddToTrip,
  onCreateMeetPoint,
  onMakeDestination,
  onStartLive,
}: Props) {
  const cityState = useMemo(() => {
    if (!place.address) return "";
    const parts = place.address.split(",").map((p) => p.trim());
    if (parts.length <= 2) return place.address;
    
    // Attempt to extract city and state/region
    // Nominatim addresses typically end with: ..., City, State, Postcode, Country
    // Let's inspect from the end:
    // parts[parts.length - 1] is Country
    // parts[parts.length - 2] is Postcode
    // parts[parts.length - 3] is State
    // parts[parts.length - 4] is City/County
    const state = parts[parts.length - 3] || "";
    const city = parts[parts.length - 4] || parts[parts.length - 5] || "";
    if (city && state) {
      return `${city}, ${state}`;
    }
    return parts.slice(0, 2).join(", ");
  }, [place.address]);

  return (
    <div
      className="fixed left-0 right-0 bottom-0 h-[60vh] bg-white rounded-t-[20px] p-5 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-50 overflow-y-auto"
      role="dialog"
      aria-label="Place preview bottom sheet"
    >
      {/* Close button top right */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 text-lg"
        aria-label="Close preview"
      >
        ✕
      </button>

      {/* Place name and category/description */}
      <div className="pr-10">
        <h3 className="text-2xl font-bold text-stone-900">{place.name}</h3>
        <p className="text-sm text-stone-500 mt-1">{place.categoryLabel || "Place"}</p>
      </div>

      {/* Distance away & Hours */}
      <div className="mt-3">
        <p className="text-sm text-stone-600 font-medium">
          {formatDistanceMiles(place.distanceM)}
          {cityState && ` · ${cityState}`}
        </p>
        <p className="text-xs text-stone-400 mt-1">Hours not available</p>
      </div>

      {/* Buttons grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          type="button"
          onClick={onSavePlace}
          className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <Bookmark className="w-4 h-4 text-stone-500" />
          Save Place
        </button>
        <button
          type="button"
          onClick={onAddStop}
          className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <MapPin className="w-4 h-4 text-stone-500" />
          Add Stop
        </button>
        <button
          type="button"
          onClick={onAddToTrip}
          className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <FilePlus className="w-4 h-4 text-stone-500" />
          Add to Trip
        </button>
        <button
          type="button"
          onClick={onCreateMeetPoint}
          className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <Users className="w-4 h-4 text-stone-500" />
          Create Meet Point
        </button>
      </div>

      {/* Links below buttons */}
      <div className="mt-4 text-center">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-sky-600 hover:underline inline-flex items-center gap-1 font-medium"
        >
          Get Directions →
        </a>
      </div>

      {/* Big buttons full width */}
      <div className="mt-5 space-y-2.5">
        <button
          type="button"
          onClick={onMakeDestination}
          className="w-full rounded-xl bg-sky-900 hover:bg-sky-950 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Make Destination
        </button>
        <button
          type="button"
          onClick={onStartLive}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Start Live 🟢
        </button>
      </div>
    </div>
  );
}
