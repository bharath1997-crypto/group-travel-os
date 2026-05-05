"use client";

import { Link as LinkIcon, X } from "lucide-react";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type ExplorerDrawerItem = {
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
  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [tripId, setTripId] = useState("");
  const [pendingAction, setPendingAction] = useState<"save" | "vote" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

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
        await apiFetch(`/explorer/items/${encodeURIComponent(item.id)}/save`, {
          method: "POST",
          body: JSON.stringify({ trip_id: tripId.trim() }),
        });
        onToast?.("Saved to trip");
      } else {
        await apiFetch(`/explorer/items/${encodeURIComponent(item.id)}/vote`, {
          method: "POST",
          body: JSON.stringify({ trip_id: tripId.trim(), vote: "up" }),
        });
        onToast?.("Vote sent to group");
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 px-0 sm:px-4">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside className="relative max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0F3460] p-5 text-white shadow-2xl sm:rounded-[2rem] sm:p-6">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
          aria-label="Close drawer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-5 sm:grid-cols-[140px_1fr_auto] sm:items-start">
          <div className="h-32 overflow-hidden rounded-3xl bg-gradient-to-br from-[#16213E] to-[#E94560]/80 sm:h-36">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">
                {item.emoji}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#E94560]">
              {item.source}
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">
              {item.title}
            </h2>
            <p className="mt-2 text-sm text-white/65">
              {item.venue} · {item.city} · {item.dateLabel}
            </p>
          </div>
          <p className="text-2xl font-black text-[#E94560]">{item.priceLabel}</p>
        </div>

        <p className="mt-5 line-clamp-3 text-sm leading-6 text-white/70">
          {item.description ||
            "A curated local experience selected for your trip. Details may vary by platform, so check the source before booking."}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[item.emoji, "📸", "🗺️"].map((emoji, index) => (
            <div
              key={`${emoji}-${index}`}
              className="flex h-20 items-center justify-center rounded-2xl bg-white/10 text-3xl"
            >
              {emoji}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <button
            type="button"
            onClick={() => openTripModal("save")}
            className="rounded-2xl bg-[#E94560] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#ff5670]"
          >
            Save to trip
          </button>
          <button
            type="button"
            onClick={() => openTripModal("vote")}
            className="rounded-2xl border border-[#E94560] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E94560]/15"
          >
            Vote with group
          </button>
          <button
            type="button"
            onClick={() => {
              if (item.sourceUrl) window.open(item.sourceUrl, "_blank", "noopener,noreferrer");
            }}
            className="rounded-2xl border border-white/10 px-5 py-3 text-white transition hover:bg-white/10"
            aria-label="Open source link"
          >
            <LinkIcon className="h-5 w-5" />
          </button>
        </div>

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
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#E94560]"
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
                  className="flex-1 rounded-2xl bg-[#E94560] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
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
