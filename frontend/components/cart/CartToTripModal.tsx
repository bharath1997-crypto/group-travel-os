"use client";

import { useState } from "react";
import { X, Sparkles, MapPin, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";

type CartItem = {
  id: string;
  item_name: string;
  place_name: string | null;
  full_address: string | null;
  item_type: string;
};

type CartToTripModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: CartItem[];
  onSuccess: (tripId: string) => void;
};

export function CartToTripModal({
  isOpen,
  onClose,
  selectedItems,
  onSuccess,
}: CartToTripModalProps) {
  const [tripName, setTripName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setError("Please select at least one item to convert.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ trip_id: string }>(
        "/cart/convert-to-trip",
        {
          method: "POST",
          body: JSON.stringify({
            trip_name: tripName.trim() || undefined,
            selected_item_ids: selectedItems.map((item) => item.id),
          }),
        }
      );

      if (response && response.trip_id) {
        onSuccess(response.trip_id);
      } else {
        throw new Error("Failed to retrieve trip ID from response.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to convert cart to trip.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-2">
          <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Plan Collaborative Trip</h2>
            <p className="text-xs text-slate-500">Convert your saved cart items into a group trip space</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Trip Name
            </label>
            <input
              type="text"
              required
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="e.g., Paris Getaway 2026"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Items to Include ({selectedItems.length})
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {selectedItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50/50">
                  <div className="mt-0.5 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                    {item.item_type}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {item.item_name}
                    </p>
                    <p className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      {item.place_name || item.full_address || "Unknown Location"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              💡 These experiences will be added as "Suggested stops" in your new trip plan.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium bg-red-50 p-2.5 rounded-lg">
              ⚠️ {error}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating Trip..." : "Create Trip"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
