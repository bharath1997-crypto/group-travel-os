"use client";

import { Link as LinkIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

export type ExplorerDrawerItem = {
  id: string;
  title: string;
  source: string;
  venue: string;
  city: string;
  dateLabel: string;
  priceLabel: string;
  description: string;
  emoji: string;
  imageUrl?: string | null;
  sourceUrl?: string | null;
};

type ExplorerItemDetailDrawerProps = {
  item: ExplorerDrawerItem | null;
  onClose: () => void;
  onToast?: (message: string) => void;
};

export function ExplorerItemDetailDrawer({
  item,
  onClose,
  onToast,
}: ExplorerItemDetailDrawerProps) {
  const [displayItem, setDisplayItem] = useState<ExplorerDrawerItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [tripId, setTripId] = useState("");
  const [pendingAction, setPendingAction] = useState<"save" | "vote" | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (item) {
      setDisplayItem(item);
      dragOffsetY.current = 0;
      setDragOffset(0);
      const frame = requestAnimationFrame(() => setSheetOpen(true));
      return () => cancelAnimationFrame(frame);
    }
    setSheetOpen(false);
    const timer = window.setTimeout(() => setDisplayItem(null), 280);
    return () => window.clearTimeout(timer);
  }, [item]);

  const handleAddToCart = async () => {
    if (!displayItem) return;
    setAddingToCart(true);
    try {
      await apiFetch("/cart", {
        method: "POST",
        body: JSON.stringify({
          item_type: "activity",
          item_id: displayItem.id,
          item_name: displayItem.title,
          item_image: displayItem.imageUrl || null,
          item_category: displayItem.source,
          place_name: displayItem.venue || displayItem.city,
          full_address: displayItem.venue || displayItem.city,
          lat: (displayItem as any).latitude || 0.0,
          lng: (displayItem as any).longitude || 0.0,
          price_range: displayItem.priceLabel || null,
          rating: null,
          source: displayItem.source || "explore",
          source_url: displayItem.sourceUrl || null,
        }),
      });
      onToast?.("Added to Travel Cart");
      window.dispatchEvent(new CustomEvent("gt-cart-updated"));
    } catch (err: any) {
      if (err.message && err.message.includes("409")) {
        onToast?.("Item is already in your travel cart!");
      } else {
        onToast?.("Failed to add to cart");
      }
    } finally {
      setAddingToCart(false);
    }
  };


  useEffect(() => {
    if (!displayItem) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [displayItem, onClose]);

  const activeItem = displayItem;
  if (!activeItem) return null;

  const finishDrag = () => {
    if (dragOffsetY.current > 72) {
      onClose();
    } else {
      dragOffsetY.current = 0;
      setDragOffset(0);
    }
    dragStartY.current = null;
  };

  const openTripModal = (action: "save" | "vote") => {
    setPendingAction(action);
    setTripModalOpen(true);
  };

  const runTripAction = async () => {
    if (!pendingAction || !tripId.trim()) {
      onToast?.("Choose a trip first");
      return;
    }
    setBusy(true);
    try {
      if (pendingAction === "save") {
        // Step 1: Save as location
        const locationRes = await apiFetch<{ id: string }>("/locations", {
          method: "POST",
          body: JSON.stringify({
            name: activeItem.title,
            address: activeItem.venue || activeItem.city,
            latitude: (activeItem as any).latitude || 0,
            longitude: (activeItem as any).longitude || 0,
            category: activeItem.source,
            notes: activeItem.description,
          }),
        });
        
        // Step 2: Add to trip
        await apiFetch(`/trips/${tripId.trim()}/locations`, {
          method: "POST",
          body: JSON.stringify({ location_id: locationRes.id }),
        });
        
        onToast?.("Saved to trip");
      } else {
        // Vote is not implemented in backend yet for general explorer items
        onToast?.("Group voting is coming soon!");
      }
      setTripModalOpen(false);
      setTripId("");
      setPendingAction(null);
    } catch {
      onToast?.("This action is not available yet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center px-0 sm:px-4">
      <button
        type="button"
        aria-label="Close details"
        className={`absolute inset-0 cursor-default bg-black/55 transition-opacity duration-300 ${
          sheetOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`relative max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-navy p-5 text-white shadow-2xl transition-transform duration-300 ease-out sm:rounded-[2rem] sm:p-6 ${
          sheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={
          dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)` }
            : undefined
        }
      >
        <div
          className="mx-auto mb-4 h-1.5 w-14 cursor-grab rounded-full bg-white/25 active:cursor-grabbing"
          onPointerDown={(event) => {
            dragStartY.current = event.clientY;
            dragOffsetY.current = 0;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStartY.current == null) return;
            const delta = Math.max(0, event.clientY - dragStartY.current);
            dragOffsetY.current = delta;
            setDragOffset(delta);
          }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
          aria-label="Close drawer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-5 sm:grid-cols-[140px_1fr_auto] sm:items-start">
          <div className="h-32 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E293B] to-primary/80 sm:h-36">
            {activeItem.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeItem.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">
                {activeItem.emoji}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {activeItem.source}
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">
              {activeItem.title}
            </h2>
            <p className="mt-2 text-sm text-white/65">
              {activeItem.venue} · {activeItem.city} · {activeItem.dateLabel}
            </p>
          </div>
          <p className="text-2xl font-black text-primary">{activeItem.priceLabel}</p>
        </div>

        <p className="mt-5 line-clamp-3 text-sm leading-6 text-white/70">
          {activeItem.description ||
            "A curated local experience selected for your trip. Details may vary by platform, so check the source before booking."}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[activeItem.emoji, "📸", "🗺️"].map((emoji, index) => (
            <div
              key={`${emoji}-${index}`}
              className="flex h-20 items-center justify-center rounded-2xl bg-white/10 text-3xl"
            >
              {emoji}
            </div>
          ))}
        </div>

        {(() => {
          let tickets: { title: string; url: string }[] = [];
          let fallbackUrl = activeItem.sourceUrl;
          if (activeItem.sourceUrl) {
            try {
              tickets = JSON.parse(activeItem.sourceUrl);
              fallbackUrl = null;
            } catch {
              // Not JSON, just a normal URL
            }
          }

          return (
            <div className="mt-6">
              {tickets.length > 0 ? (
                <>
                  <p className="mb-3 text-sm font-bold text-white/80">Available Tickets & Info</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {tickets.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                        className="flex items-center justify-between rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                      >
                        <span className="truncate">{t.title}</span>
                        <LinkIcon className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-600 disabled:opacity-50"
                >
                  {addingToCart ? "Adding..." : "Add to Cart"}
                </button>
                <button
                  type="button"
                  onClick={() => openTripModal("save")}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-hover"
                >
                  Save to trip
                </button>
                <button
                  type="button"
                  onClick={() => openTripModal("vote")}
                  className="rounded-2xl border border-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/15"
                >
                  Vote with group
                </button>
                {fallbackUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (fallbackUrl) window.open(fallbackUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="rounded-2xl border border-white/10 px-5 py-3 text-white transition hover:bg-white/10"
                    aria-label="Open source link"
                  >
                    <LinkIcon className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })()}

        {tripModalOpen ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#102f55] p-5 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Choose a trip</h3>
              <p className="mt-1 text-sm text-white/60">
                Enter a trip id for now. Trip picker data can be connected when the endpoint is ready.
              </p>
              <input
                value={tripId}
                onChange={(event) => setTripId(event.target.value)}
                placeholder="Trip ID"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-primary"
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setTripModalOpen(false)}
                  className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-white/75"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={runTripAction}
                  className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Continue"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
