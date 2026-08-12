"use client";

import {
  Copy,
  MapPin,
  Navigation,
  Plus,
  Save,
  X,
} from "lucide-react";
import { haversineM } from "@/lib/geo";

export type MapLocationSheetPoint = {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
};

type Props = {
  open: boolean;
  point: MapLocationSheetPoint | null;
  loading?: boolean;
  manualMode?: boolean;
  destinationName?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  canAddStop?: boolean;
  onClose: () => void;
  onSetStartingPoint: (point: MapLocationSheetPoint) => void;
  onSetDestination: (point: MapLocationSheetPoint) => void;
  onAddStop?: (point: MapLocationSheetPoint) => void;
  onCopyCoordinates: (point: MapLocationSheetPoint) => void;
  onSavePlace: (point: MapLocationSheetPoint) => void;
};

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1609.34).toFixed(1)} mi`;
}

export default function LiveMapLocationSheet({
  open,
  point,
  loading = false,
  manualMode = false,
  destinationName,
  destinationLat,
  destinationLng,
  canAddStop = false,
  onClose,
  onSetStartingPoint,
  onSetDestination,
  onAddStop,
  onCopyCoordinates,
  onSavePlace,
}: Props) {
  if (!open || !point) return null;

  const title = point.name || "Selected location";
  const subtitle = point.address || formatCoords(point.lat, point.lng);
  let distanceLine: string | null = null;
  if (
    destinationLat != null &&
    destinationLng != null &&
    Number.isFinite(destinationLat) &&
    Number.isFinite(destinationLng)
  ) {
    const distM = haversineM(point.lat, point.lng, destinationLat, destinationLng);
    distanceLine = destinationName
      ? `${formatDistance(distM)} from ${destinationName}`
      : `${formatDistance(distM)} from destination`;
  }

  const actions = [
    {
      key: "start",
      label: "Set as starting point",
      hint: "Use for route From",
      icon: Navigation,
      onClick: () => onSetStartingPoint(point),
    },
    {
      key: "dest",
      label: "Set as destination",
      hint: "Navigate here",
      icon: MapPin,
      onClick: () => onSetDestination(point),
    },
    ...(canAddStop && onAddStop
      ? [
          {
            key: "stop",
            label: "Add as stop",
            hint: "Insert on current route",
            icon: Plus,
            onClick: () => onAddStop(point),
          },
        ]
      : []),
    {
      key: "copy",
      label: "Copy coordinates",
      hint: formatCoords(point.lat, point.lng),
      icon: Copy,
      onClick: () => onCopyCoordinates(point),
    },
    {
      key: "save",
      label: "Save place",
      hint: "Keep in your recent list",
      icon: Save,
      onClick: () => onSavePlace(point),
    },
  ];

  return (
    <div className="absolute bottom-14 left-0 z-50 w-[min(100vw-1rem,320px)] animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div
        role="dialog"
        aria-label="Location options"
        className="overflow-hidden rounded-2xl border border-white/80 bg-white/98 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-md"
      >
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {manualMode ? (
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                  Manual location
                </p>
              ) : null}
              <h3 className="truncate text-sm font-bold text-stone-900">{title}</h3>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-stone-500">
                {loading ? "Looking up address…" : subtitle}
              </p>
              {distanceLine ? (
                <p className="mt-1 text-[11px] font-semibold text-primary">{distanceLine}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {manualMode ? (
            <p className="mt-2 text-[10px] leading-snug text-stone-500">
              GPS is not available in this browser. Pick a point on the map or use the options below.
            </p>
          ) : null}
        </div>

        <ul className="max-h-[min(50vh,280px)] overflow-y-auto p-1.5">
          {actions.map(({ key, label, hint, icon: Icon, onClick }) => (
            <li key={key}>
              <button
                type="button"
                onClick={onClick}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-stone-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-800">{label}</span>
                  <span className="block truncate text-[10px] text-stone-500">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
