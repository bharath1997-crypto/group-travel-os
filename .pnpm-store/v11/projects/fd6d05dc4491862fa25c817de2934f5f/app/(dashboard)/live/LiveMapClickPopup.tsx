"use client";

import { Clock3, Crosshair, MapPin, X } from "lucide-react";
import { formatMapCoordinates } from "./live-map-pick-context";

type Props = {
  screenX: number;
  screenY: number;
  lat: number;
  lng: number;
  localTimeLabel?: string;
  localTimeTimezone?: string | null;
  localTimeApproximate?: boolean;
  localTimeLoading?: boolean;
  onPickLocation: () => void;
  onFindCoordinates: () => void;
  onClose: () => void;
  loading?: boolean;
};

export default function LiveMapClickPopup({
  screenX,
  screenY,
  lat,
  lng,
  localTimeLabel,
  localTimeTimezone,
  localTimeApproximate = false,
  localTimeLoading = false,
  onPickLocation,
  onFindCoordinates,
  onClose,
  loading = false,
}: Props) {
  const left = Math.max(12, Math.min(screenX, window.innerWidth - 240));
  const top = Math.max(72, Math.min(screenY - 8, window.innerHeight - 190));

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-[34] cursor-default bg-transparent"
        aria-label="Close map actions"
        onClick={onClose}
      />
      <div
        className="absolute z-[36] w-[min(15rem,calc(100vw-1.5rem))] rounded-xl border border-stone-200/90 bg-white/95 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.14)] backdrop-blur-md"
        style={{ left, top }}
        role="menu"
        aria-label="Map location actions"
      >
        <div className="flex items-start justify-between gap-2 px-2 py-1.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              Map point
            </p>
            <p className="truncate font-mono text-[10px] text-stone-600">
              {formatMapCoordinates(lat, lng)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mx-2 mb-1 rounded-lg bg-stone-50 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            Local time
          </div>
          <p className="mt-0.5 text-sm font-semibold text-stone-900">
            {localTimeLoading ? "Checking timezone…" : localTimeLabel ?? "Unavailable"}
          </p>
          {localTimeTimezone ? (
            <p className="text-[11px] text-stone-500">
              {localTimeTimezone}
              {localTimeApproximate ? " · estimated" : ""}
            </p>
          ) : localTimeApproximate && !localTimeLoading ? (
            <p className="text-[11px] text-stone-500">Estimated from longitude</p>
          ) : null}
        </div>

        <button
          type="button"
          role="menuitem"
          disabled={loading}
          onClick={onPickLocation}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-stone-800 hover:bg-primary-soft disabled:opacity-60"
        >
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          Pick this location
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={loading}
          onClick={onFindCoordinates}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
        >
          <Crosshair className="h-4 w-4 shrink-0 text-stone-600" />
          Pin coordinates here
        </button>
      </div>
    </>
  );
}
