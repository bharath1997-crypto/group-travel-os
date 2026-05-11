"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const OPTIONS = [
  { key: "late", label: "🏃 Running Late", value: "running_late" },
  { key: "way", label: "🚗 On My Way", value: "on_my_way" },
  { key: "here", label: "✅ I'm Here!", value: "here" },
] as const;

export function QuickStatusSheet({
  tripId,
  open,
  onClose,
}: {
  tripId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    function onEv(e: MouseEvent | TouchEvent) {
      const t = panelRef.current;
      if (!t || !open) return;
      if (e.target instanceof Node && !t.contains(e.target as Node))
        onClose();
    }
    if (open) {
      window.addEventListener("mousedown", onEv);
      window.addEventListener("touchstart", onEv, { passive: true });
      return () => {
        window.removeEventListener("mousedown", onEv);
        window.removeEventListener("touchstart", onEv);
      };
    }
    return undefined;
  }, [onClose, open]);

  const pick = useCallback(
    async (value: string) => {
      if (!tripId) return;
      setBusyKey(value);
      try {
        await apiFetch(`/live/trips/${tripId}/quick-status`, {
          method: "POST",
          body: JSON.stringify({ status: value }),
        });
        onClose();
      } catch {
        /* toast optional */
      } finally {
        setBusyKey(null);
      }
    },
    [onClose, tripId],
  );

  return (
    <div
      className={[
        "fixed inset-x-0 bottom-0 z-[4000] transition-transform duration-300 ease-out md:left-[220px] md:inset-auto md:right-10 md:bottom-10 md:max-w-sm",
        open ? "translate-y-0" : "pointer-events-none translate-y-full opacity-0",
      ].join(" ")}
      aria-hidden={!open}
    >
      <div
        ref={panelRef}
        className="mx-auto w-full max-w-lg rounded-t-3xl border border-[#1f3a61] bg-[#0b1426] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 text-[#eaf0fc] shadow-2xl md:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Quick status</p>
          <button
            type="button"
            className="text-xs text-[#9bb2e3] underline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="flex flex-col gap-2 pb-5">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={busyKey !== null || !tripId}
              className="flex w-full items-center justify-between rounded-xl border border-[#2b4681] bg-[#0f1f44] px-4 py-3 text-left text-sm font-medium text-white shadow-sm transition hover:border-[#4467b8] disabled:opacity-50"
              onClick={() => pick(o.value)}
            >
              {o.label}
              {busyKey === o.value ? <span className="text-[10px]">…</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
