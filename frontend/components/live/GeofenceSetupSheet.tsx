"use client";

import { X } from "lucide-react";
import { useState } from "react";

type GeofenceSetupSheetProps = {
  label: string;
  centerLat: number;
  centerLng: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (radiusM: number, label: string) => void;
};

export function GeofenceSetupSheet({
  label: initialLabel,
  centerLat,
  centerLng,
  busy = false,
  onClose,
  onConfirm,
}: GeofenceSetupSheetProps) {
  const [radiusM, setRadiusM] = useState(500);
  const [label, setLabel] = useState(initialLabel);

  return (
    <div className="fixed inset-0 z-[135] flex items-end justify-center bg-black/40">
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">Set safe zone</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-stone-500">
          Center: {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
        </p>
        <label className="mt-4 block text-sm font-medium text-stone-700">
          Label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value.slice(0, 50))}
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-stone-700">
          Radius: {radiusM} m
          <input
            type="range"
            min={100}
            max={5000}
            step={50}
            value={radiusM}
            onChange={(event) => setRadiusM(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(radiusM, label.trim() || "Safe Zone")}
          className="mt-6 w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Confirm safe zone
        </button>
      </div>
    </div>
  );
}
