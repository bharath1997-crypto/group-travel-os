"use client";

import {
  BedDouble,
  Cross,
  Fuel,
  Landmark,
  Loader2,
  ParkingCircle,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";

export type PoiCategory = {
  label: string;
  icon: LucideIcon;
  query: string;
  color: string;
};

export const POI_CATEGORIES: PoiCategory[] = [
  { label: "Gas", icon: Fuel, query: "amenity=fuel", color: "#2563eb" },
  {
    label: "Food",
    icon: Utensils,
    query: "amenity=restaurant|amenity=fast_food",
    color: "#ea580c",
  },
  { label: "Hospital", icon: Cross, query: "amenity=hospital", color: "#dc2626" },
  { label: "Hotel", icon: BedDouble, query: "tourism=hotel", color: "#7c3aed" },
  {
    label: "Parking",
    icon: ParkingCircle,
    query: "amenity=parking",
    color: "#475569",
  },
  { label: "ATM", icon: Landmark, query: "amenity=atm", color: "#059669" },
];

type PoiSearchSheetProps = {
  loading: boolean;
  onClose: () => void;
  onSelect: (category: PoiCategory) => void;
};

export function PoiSearchSheet({ loading, onClose, onSelect }: PoiSearchSheetProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="Close POI search"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(50dvh,420px)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">Search nearby</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4">
          {POI_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.label}
                type="button"
                disabled={loading}
                onClick={() => onSelect(category)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-4 text-center transition hover:border-[#0F766E] hover:bg-teal-50 disabled:opacity-60"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: category.color }}
                >
                  <Icon size={18} />
                </span>
                <span className="text-xs font-semibold text-stone-800">
                  {category.label}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 pb-6 text-sm text-stone-500">
            <Loader2 size={16} className="animate-spin text-[#0F766E]" />
            Searching OpenStreetMap…
          </div>
        ) : null}
      </div>
    </div>
  );
}
