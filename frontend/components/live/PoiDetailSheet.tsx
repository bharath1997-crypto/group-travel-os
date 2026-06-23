"use client";

import { X } from "lucide-react";

export type PoiPlace = {
  id: number;
  lat: number;
  lng: number;
  name: string;
  address: string;
  categoryLabel: string;
  color: string;
};

type PoiDetailSheetProps = {
  place: PoiPlace;
  onClose: () => void;
  onNavigate: () => void;
};

export function PoiDetailSheet({ place, onClose, onNavigate }: PoiDetailSheetProps) {
  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center bg-black/30">
      <button
        type="button"
        aria-label="Close POI details"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: place.color }}
            >
              {place.categoryLabel}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900">{place.name}</h2>
            {place.address ? (
              <p className="mt-1 text-sm text-stone-600">{place.address}</p>
            ) : null}
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
        <button
          type="button"
          onClick={onNavigate}
          className="w-full rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0d655c]"
        >
          Navigate
        </button>
      </div>
    </div>
  );
}
