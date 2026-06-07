"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { 
  Trash2, 
  Sparkles, 
  MapPin, 
  Compass, 
  Link as LinkIcon, 
  Check, 
  Star, 
  FolderPlus,
  Loader2
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { CartToTripModal } from "@/components/cart/CartToTripModal";

type CartItem = {
  id: string;
  item_type: string;
  item_id: string | null;
  item_name: string;
  item_image: string | null;
  item_category: string | null;
  place_name: string | null;
  full_address: string | null;
  lat: number;
  lng: number;
  price_range: string | null;
  rating: number | null;
  source: string;
  source_url: string | null;
  added_at: string;
};

const CartMap = dynamic(() => import("@/components/cart/CartMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[350px] flex items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        <p className="text-xs text-slate-400">Initializing map canvas...</p>
      </div>
    </div>
  ),
});

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchCart = async () => {
    try {
      const data = await apiFetch<CartItem[]>("/cart");
      setItems(data);
      setSelectedIds(data.map((item) => item.id));
    } catch (err) {
      console.error("Failed to load cart items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRemoveItem = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/cart/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error("Failed to remove item:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm("Are you sure you want to clear your travel cart?")) return;
    setClearing(true);
    try {
      await apiFetch("/cart", { method: "DELETE" });
      setItems([]);
      setSelectedIds([]);
    } catch (err) {
      console.error("Failed to clear cart:", err);
    } finally {
      setClearing(false);
    }
  };

  const handleTripConversionSuccess = (tripId: string) => {
    setIsModalOpen(false);
    router.push("/trip-space");
  };

  const selectedCartItems = items.filter((item) => selectedIds.includes(item.id));

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Travel Cart</h1>
            <p className="text-xs text-slate-500 mt-1">
              Save your experiences, restaurant tables, activities, and extract locations from video. Convert them to a collaborative trip instantly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/cart/extract")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
              Extract location from video
            </button>
            {items.length > 0 && (
              <button
                onClick={handleClearCart}
                disabled={clearing}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 shadow-sm transition-colors disabled:opacity-50"
              >
                {clearing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Clear Cart
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Convert to Trip ({selectedIds.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center bg-white rounded-2xl border border-slate-200">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
              <p className="text-sm text-slate-500">Loading your travel cart...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-300 py-16 px-4 text-center">
            <div className="rounded-full bg-teal-50 p-4 text-teal-700 mb-4">
              <Compass className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Your travel cart is empty</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-2">
              Explore places, restaurant tables, activities, or import locations from Instagram & YouTube, and add them to your cart.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                onClick={() => router.push("/explore")}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition-colors"
              >
                Explore places
              </button>
              <button
                onClick={() => router.push("/cart/extract")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Extract from video
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Cart List */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Select All Bar */}
              <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      selectedIds.length === items.length
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {selectedIds.length === items.length && <Check className="h-3 w-3" />}
                  </div>
                  Select All ({items.length})
                </button>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  {selectedIds.length} item{selectedIds.length !== 1 ? "s" : ""} selected
                </p>
              </div>

              {/* Items list */}
              <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
                {items.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex gap-3 bg-white p-4 rounded-xl border transition-all ${
                        isSelected ? "border-teal-600 ring-1 ring-teal-600/20" : "border-slate-200"
                      }`}
                    >
                      {/* Custom Checkbox */}
                      <button
                        onClick={() => handleToggleSelect(item.id)}
                        className="mt-0.5 shrink-0"
                      >
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-teal-700 bg-teal-700 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </button>

                      {/* Image / Fallback */}
                      <div className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-slate-50 border border-slate-200">
                        {item.item_image ? (
                          <img
                            src={item.item_image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-teal-700 bg-teal-50">
                            <MapPin className="h-6 w-6" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white">
                          {item.item_type}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                            {item.item_name}
                          </h3>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={deletingId === item.id}
                            className="text-slate-400 hover:text-red-600 transition-colors p-0.5"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 leading-normal line-clamp-1">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                          {item.place_name || item.full_address || "No address provided"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {item.rating && (
                            <span className="flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              {item.rating}
                            </span>
                          )}
                          {item.price_range && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
                              {item.price_range}
                            </span>
                          )}
                          {item.item_category && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                              {item.item_category}
                            </span>
                          )}
                          {item.source_url && (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[9px] font-semibold text-teal-700 hover:underline"
                            >
                              View source
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Leaflet Map */}
            <div className="lg:col-span-5 h-[350px] lg:h-auto min-h-[400px]">
              <CartMap items={selectedCartItems} />
            </div>
          </div>
        )}
      </div>

      <CartToTripModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedItems={selectedCartItems}
        onSuccess={handleTripConversionSuccess}
      />
    </div>
  );
}
